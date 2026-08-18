import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpiringDocument {
    doc_id: string;
    customer_id: string;
    customer_name: string;
    customer_phone: string;
    deal_id: string | null;
    deal_type: string | null;
    doc_type: string;
    doc_label: string | null;
    party_role: 'buyer' | 'seller' | 'general';
    expiry_date: string;
    days_remaining: number;
    is_expired: boolean;
    file_url: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
    aadhaar: 'Aadhaar Card', pan: 'PAN Card', voter_id: 'Voter ID',
    passport: 'Passport', driving_license: 'Driving License', rc_book: 'RC Book',
    insurance: 'Insurance Policy', puc: 'PUC Certificate', noc: 'NOC',
    form_20: 'Form 20', form_21: 'Form 21', form_29: 'Form 29', form_30: 'Form 30',
    hypothecation_letter: 'Hypothecation Letter', loan_noc: 'Loan NOC', bank_noc: 'Bank NOC',
    delivery_receipt: 'Delivery Receipt', sales_invoice: 'Sales Invoice',
    rto_receipt: 'RTO Receipt', agreement: 'Agreement', cheque_copy: 'Cheque Copy', other: 'Other',
};

const DEAL_TYPE_LABELS: Record<string, string> = {
    purchase: 'Purchase', sell_to_us: 'Sell to Us', exchange: 'Exchange', consignment: 'Park & Sell',
};

const getDocLabel = (type: string) => DOC_TYPE_LABELS[type] ?? type;
const getDealLabel = (type: string | null) => type ? (DEAL_TYPE_LABELS[type] ?? type) : 'General';

const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

// ─── Component ────────────────────────────────────────────────────────────────

const FILTER_RANGE_OPTIONS = [
    { label: '30 days', value: 30 },
    { label: '60 days', value: 60 },
    { label: '90 days', value: 90 },
    { label: '180 days', value: 180 },
];

const CustomerAlerts = () => {
    const { isAdmin, user } = useAuth();
    const { addNotification } = useNotifications();

    const [documents, setDocuments] = useState<ExpiringDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [daysAhead, setDaysAhead] = useState(60);
    const [docTypeFilter, setDocTypeFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [notifSent, setNotifSent] = useState(false);
    const [configSaving, setConfigSaving] = useState(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Load saved alert config from Supabase ────────────────────────────────
    useEffect(() => {
        if (!user?.id) return;
        supabase
            .from('customer_alert_configs')
            .select('days_threshold')
            .eq('user_id', user.id)
            .eq('alert_type', 'expiring_docs')
            .limit(1)
            .then(({ data }) => {
                if (data && data.length > 0 && data[0].days_threshold) {
                    setDaysAhead(data[0].days_threshold);
                }
            });
    }, [user?.id]);

    // ─── Persist daysAhead preference with debounce ───────────────────────────
    const saveDaysAhead = useCallback((days: number) => {
        if (!user?.id) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        setConfigSaving(true);
        saveTimer.current = setTimeout(async () => {
            await supabase
                .from('customer_alert_configs')
                .upsert(
                    { user_id: user.id, alert_type: 'expiring_docs', days_threshold: days, is_enabled: true },
                    { onConflict: 'user_id,alert_type' }
                );
            setConfigSaving(false);
        }, 800);
    }, [user?.id]);

    const handleRangeChange = (days: number) => {
        setDaysAhead(days);
        saveDaysAhead(days);
    };

    // ─── Fetch expiring docs via RPC ──────────────────────────────────────────

    const fetchExpiring = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_expiring_documents', { days_ahead: daysAhead });
            if (!error && data) {
                setDocuments(data as ExpiringDocument[]);

                // Fire smart notifications for newly discovered critical docs (only once per session)
                if (!notifSent && isAdmin) {
                    const critical = (data as ExpiringDocument[]).filter(d => d.days_remaining <= 7);
                    const today = new Date().toISOString().split('T')[0];
                    for (const doc of critical) {
                        const key = `doc_expiry_alert_${doc.doc_id}_${today}`;
                        const { data: existing } = await supabase
                            .from('smart_notifications')
                            .select('id')
                            .eq('dedup_key', key)
                            .limit(1);
                        if (!existing || existing.length === 0) {
                            await addNotification({
                                type: 'document_expiry',
                                category: 'critical',
                                priority: 1,
                                icon: 'description',
                                color: 'red',
                                title: doc.is_expired
                                    ? `🔴 Expired: ${getDocLabel(doc.doc_type)} — ${doc.customer_name}`
                                    : `🔴 Expiring in ${doc.days_remaining}d: ${getDocLabel(doc.doc_type)}`,
                                message: `${getDocLabel(doc.doc_type)} for ${doc.customer_name} (${doc.customer_phone}) ${doc.is_expired ? 'expired on' : 'expires on'} ${formatDate(doc.expiry_date)}.`,
                                action_url: `/admin/customers/${doc.customer_id}?tab=documents`,
                                action_label: 'View Customer',
                                related_entity_type: 'customer_document',
                                related_entity_id: doc.doc_id,
                                assigned_to_user_id: null,
                                dedup_key: key,
                                metadata: {
                                    doc_type: doc.doc_type,
                                    expiry_date: doc.expiry_date,
                                    customer_id: doc.customer_id,
                                    days_remaining: doc.days_remaining,
                                },
                            });
                        }
                    }
                    setNotifSent(true);
                }
            }
        } catch (err) {
            console.error('Failed to fetch expiring documents', err);
        } finally {
            setLoading(false);
        }
    }, [daysAhead, isAdmin, notifSent, addNotification]);

    useEffect(() => { fetchExpiring(); }, [daysAhead]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Filtering ────────────────────────────────────────────────────────────

    const filtered = documents.filter(doc => {
        const q = search.toLowerCase().trim();
        if (docTypeFilter !== 'all' && doc.doc_type !== docTypeFilter) return false;
        if (roleFilter !== 'all' && doc.party_role !== roleFilter) return false;
        if (q && !`${doc.customer_name} ${doc.customer_phone} ${doc.doc_type}`.toLowerCase().includes(q)) return false;
        return true;
    });

    const critical  = filtered.filter(d => d.is_expired || d.days_remaining <= 7);
    const warning   = filtered.filter(d => !d.is_expired && d.days_remaining > 7 && d.days_remaining <= 30);
    const upcoming  = filtered.filter(d => !d.is_expired && d.days_remaining > 30);

    const docTypes = [...new Set(documents.map(d => d.doc_type))];

    // ─── Document Row (Responsive: Desktop Table Row + Mobile Tap Card) ──────

    const DocRow = ({ doc }: { doc: ExpiringDocument }) => {
        const [isExpanded, setIsExpanded] = useState(false);
        const isExpired = doc.is_expired;
        const isCritical = isExpired || doc.days_remaining <= 7;
        const isWarning = !isCritical && doc.days_remaining <= 30;

        const urgencyBadge = isExpired
            ? { cls: 'bg-red-100 text-red-800 border-red-200', label: `Expired ${Math.abs(doc.days_remaining)}d ago`, icon: 'error' }
            : isCritical
                ? { cls: 'bg-red-50 text-red-700 border-red-100', label: `Expires in ${doc.days_remaining}d`, icon: 'warning' }
                : isWarning
                    ? { cls: 'bg-amber-50 text-amber-700 border-amber-100', label: `Expires in ${doc.days_remaining}d`, icon: 'schedule' }
                    : { cls: 'bg-blue-50 text-blue-700 border-blue-100', label: `${doc.days_remaining}d remaining`, icon: 'calendar_today' };

        const roleTag = {
            buyer: { label: 'Buyer', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
            seller: { label: 'Seller', cls: 'bg-blue-50 text-blue-700 border-blue-100' },
            general: { label: 'General', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
        }[doc.party_role];

        return (
            <div className={`border-b border-slate-100 last:border-0 transition-colors ${isExpired ? 'bg-red-50/20' : isCritical ? 'bg-red-50/10' : 'hover:bg-slate-50/70'}`}>
                {/* ── Desktop View (≥ 640px) ── */}
                <div className="hidden sm:flex items-center gap-4 px-5 py-4">
                    {/* Avatar */}
                    <div className={`size-10 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${isCritical ? 'bg-red-100 text-red-700' : isWarning ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {getInitials(doc.customer_name)}
                    </div>

                    {/* Customer */}
                    <div className="min-w-[160px]">
                        <Link
                            to={`/admin/customers/${doc.customer_id}?tab=documents`}
                            className="text-sm font-bold text-primary hover:underline block truncate max-w-[180px]"
                        >
                            {doc.customer_name}
                        </Link>
                        <p className="text-xs text-slate-400 font-mono">{doc.customer_phone}</p>
                    </div>

                    {/* Doc info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                            {doc.doc_label || getDocLabel(doc.doc_type)}
                            {doc.doc_label && <span className="text-[10px] text-slate-400 ml-1 font-normal">({getDocLabel(doc.doc_type)})</span>}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${roleTag.cls}`}>{roleTag.label}</span>
                            {doc.deal_type && (
                                <span className="text-[10px] text-slate-400">Deal: {getDealLabel(doc.deal_type)}</span>
                            )}
                        </div>
                    </div>

                    {/* Expiry */}
                    <div className="text-right min-w-[130px] shrink-0">
                        <p className="text-xs font-bold text-slate-700">{formatDate(doc.expiry_date)}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border inline-flex items-center gap-0.5 mt-1 ${urgencyBadge.cls} ${isCritical ? 'animate-pulse' : ''}`}>
                            <span className="material-symbols-outlined text-[10px]">{urgencyBadge.icon}</span>
                            {urgencyBadge.label}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                        {doc.file_url && (
                            <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="size-8 rounded-lg bg-slate-50 hover:bg-primary/10 text-slate-500 hover:text-primary flex items-center justify-center transition-colors"
                                title="View file"
                            >
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                            </a>
                        )}
                        <Link
                            to={`/admin/customers/${doc.customer_id}?tab=documents`}
                            className="size-8 rounded-lg bg-slate-50 hover:bg-primary/10 text-slate-500 hover:text-primary flex items-center justify-center transition-colors"
                            title="Open customer profile"
                        >
                            <span className="material-symbols-outlined text-sm">person</span>
                        </Link>
                        <a
                            href={`tel:${doc.customer_phone}`}
                            className="size-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors"
                            title="Call customer"
                        >
                            <span className="material-symbols-outlined text-sm">call</span>
                        </a>
                    </div>
                </div>

                {/* ── Mobile View (< 640px): Tap-to-Expand Card ── */}
                <div className="sm:hidden p-4 space-y-3">
                    {/* Header Row: Avatar + Customer + Status Badge */}
                    <div
                        onClick={() => setIsExpanded(v => !v)}
                        className="flex items-start justify-between gap-2.5 cursor-pointer active:opacity-80"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={`size-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${isCritical ? 'bg-red-100 text-red-700' : isWarning ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                {getInitials(doc.customer_name)}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">
                                    {doc.customer_name}
                                </p>
                                <p className="text-xs text-slate-400 font-mono">
                                    {doc.customer_phone}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 ${urgencyBadge.cls} ${isCritical ? 'animate-pulse' : ''}`}>
                                <span className="material-symbols-outlined text-[10px]">{urgencyBadge.icon}</span>
                                {urgencyBadge.label}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                {isExpanded ? 'Less' : 'Details'}
                                <span className="material-symbols-outlined text-xs transition-transform">
                                    {isExpanded ? 'expand_less' : 'expand_more'}
                                </span>
                            </span>
                        </div>
                    </div>

                    {/* Document Meta Row */}
                    <div
                        onClick={() => setIsExpanded(v => !v)}
                        className="bg-slate-50/80 rounded-xl p-2.5 flex items-center justify-between gap-2 border border-slate-100 cursor-pointer"
                    >
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">
                                {doc.doc_label || getDocLabel(doc.doc_type)}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${roleTag.cls}`}>
                                    {roleTag.label}
                                </span>
                                {doc.deal_type && (
                                    <span className="text-[10px] text-slate-500 truncate">
                                        Deal: {getDealLabel(doc.deal_type)}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-[10px] text-slate-400 uppercase font-semibold">Expiry Date</p>
                            <p className="text-xs font-bold text-slate-700">{formatDate(doc.expiry_date)}</p>
                        </div>
                    </div>

                    {/* Expandable Action Drawer */}
                    {isExpanded && (
                        <div className="pt-2 border-t border-dashed border-slate-200 space-y-2 animate-in fade-in duration-200">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-white p-2 rounded-lg border border-slate-100">
                                    <span className="text-[10px] text-slate-400 block uppercase">Document ID</span>
                                    <span className="font-mono text-[11px] text-slate-600 truncate block">#{doc.doc_id.slice(0, 8)}</span>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-100">
                                    <span className="text-[10px] text-slate-400 block uppercase">Days Left</span>
                                    <span className={`font-bold text-xs ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-blue-600'}`}>
                                        {doc.is_expired ? `${Math.abs(doc.days_remaining)} days ago` : `${doc.days_remaining} days`}
                                    </span>
                                </div>
                            </div>

                            {/* 1-Tap Mobile Action Buttons */}
                            <div className="flex items-center gap-2 pt-1">
                                <a
                                    href={`tel:${doc.customer_phone}`}
                                    className="flex-1 h-9 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-transform"
                                >
                                    <span className="material-symbols-outlined text-sm">call</span>
                                    Call Now
                                </a>

                                <Link
                                    to={`/admin/customers/${doc.customer_id}?tab=documents`}
                                    className="flex-1 h-9 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-transform"
                                >
                                    <span className="material-symbols-outlined text-sm">person</span>
                                    Profile
                                </Link>

                                {doc.file_url && (
                                    <a
                                        href={doc.file_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 active:scale-98 transition-transform"
                                        title="View Document"
                                    >
                                        <span className="material-symbols-outlined text-sm">visibility</span>
                                        File
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ─── Section Block ────────────────────────────────────────────────────────

    const SectionBlock = ({
        title, subtitle, icon, badge, badgeColor, docs, emptyMsg,
    }: {
        title: string; subtitle: string; icon: string;
        badge?: number; badgeColor: string; docs: ExpiringDocument[]; emptyMsg: string;
    }) => (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className={`size-8 sm:size-9 rounded-xl flex items-center justify-center shrink-0 ${badgeColor}`}>
                        <span className="material-symbols-outlined text-base sm:text-lg">{icon}</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                            <span>{title}</span>
                            {badge != null && badge > 0 && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
                            )}
                        </p>
                        <p className="text-[11px] sm:text-xs text-slate-400 truncate">{subtitle}</p>
                    </div>
                </div>
            </div>
            {docs.length === 0 ? (
                <div className="py-8 sm:py-10 text-center px-4">
                    <span className="material-symbols-outlined text-3xl text-slate-200 block mb-1.5">check_circle</span>
                    <p className="text-xs sm:text-sm text-slate-400">{emptyMsg}</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-100">{docs.map(doc => <DocRow key={doc.doc_id} doc={doc} />)}</div>
            )}
        </div>
    );

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-primary font-display">
                        Customer <span className="font-serif-italic font-normal text-red-500">Expiry Alerts</span>
                    </h1>
                    <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                        {loading ? 'Fetching records…' : `${documents.length} document${documents.length !== 1 ? 's' : ''} with expiry within ${daysAhead} days`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setNotifSent(false); fetchExpiring(); }}
                        className="size-9 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 flex items-center justify-center transition-colors shadow-xs"
                        title="Refresh"
                    >
                        <span className="material-symbols-outlined text-lg">refresh</span>
                    </button>
                    <Link
                        to="/admin/customers"
                        className="h-9 px-3.5 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                        <span className="material-symbols-outlined text-sm">people_alt</span>
                        <span>All Customers</span>
                    </Link>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {[
                    { label: 'Critical',  sub: 'Expired or ≤7 days',    count: critical.length,  icon: 'error',        cls: 'bg-red-50/80 border-red-200/80',    iconCls: 'text-red-600',   pulse: critical.length > 0 },
                    { label: 'Warning',   sub: '8–30 days to expiry',    count: warning.length,   icon: 'warning',      cls: 'bg-amber-50/80 border-amber-200/80', iconCls: 'text-amber-600', pulse: false },
                    { label: 'Upcoming',  sub: `31–${daysAhead} days to expiry`, count: upcoming.length, icon: 'calendar_today',cls: 'bg-blue-50/80 border-blue-200/80',  iconCls: 'text-blue-600',  pulse: false },
                ].map(card => (
                    <div key={card.label} className={`border rounded-2xl p-3.5 sm:p-4 ${card.cls} shadow-xs`}>
                        <div className="flex items-center justify-between sm:justify-start sm:gap-3">
                            <div className="flex items-center gap-3">
                                <span className={`material-symbols-outlined text-2xl ${card.iconCls} ${card.pulse && card.count > 0 ? 'animate-pulse' : ''}`}>
                                    {card.icon}
                                </span>
                                <div>
                                    <p className={`text-xl sm:text-2xl font-black ${card.iconCls}`}>{card.count}</p>
                                    <p className="text-xs font-bold text-slate-700">{card.label}</p>
                                </div>
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium sm:hidden">{card.sub}</span>
                        </div>
                        <p className="hidden sm:block text-[11px] text-slate-500 mt-2 font-medium">{card.sub}</p>
                    </div>
                ))}
            </div>

            {/* Filters Section */}
            <div className="bg-white border border-slate-100 rounded-2xl p-3.5 sm:p-4 shadow-[var(--shadow-card)] space-y-3">
                {/* Search Bar - Full Width on Mobile */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 h-10 w-full">
                    <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by customer name, phone, or doc type…"
                        className="bg-transparent text-xs text-primary outline-none flex-1 placeholder:text-slate-400"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                            <span className="material-symbols-outlined text-base">close</span>
                        </button>
                    )}
                </div>

                {/* Range Pills & Dropdowns */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
                    {/* Days Threshold Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                        <span className="text-[11px] font-bold text-slate-400 uppercase mr-1 shrink-0">Range:</span>
                        {FILTER_RANGE_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => handleRangeChange(opt.value)}
                                className={`h-8 px-3 text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                                    daysAhead === opt.value
                                        ? 'bg-primary text-white shadow-xs'
                                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:border-slate-300'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                        {configSaving && (
                            <span className="text-[10px] text-slate-400 animate-pulse flex items-center gap-1 shrink-0 ml-1">
                                <span className="material-symbols-outlined text-[12px]">sync</span> Saving…
                            </span>
                        )}
                        {!configSaving && user?.id && (
                            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 shrink-0 ml-1">
                                <span className="material-symbols-outlined text-[12px]">cloud_done</span> Saved
                            </span>
                        )}
                    </div>

                    {/* Select Dropdowns: Grid 2-cols on Mobile, Row on Desktop */}
                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                        {/* Doc type */}
                        <select
                            value={docTypeFilter}
                            onChange={e => setDocTypeFilter(e.target.value)}
                            className="h-9 border border-slate-200 rounded-xl px-2.5 text-xs outline-none bg-slate-50 text-slate-700 font-medium cursor-pointer"
                        >
                            <option value="all">All Doc Types</option>
                            {docTypes.map(t => <option key={t} value={t}>{getDocLabel(t)}</option>)}
                        </select>

                        {/* Role */}
                        <select
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                            className="h-9 border border-slate-200 rounded-xl px-2.5 text-xs outline-none bg-slate-50 text-slate-700 font-medium cursor-pointer"
                        >
                            <option value="all">All Roles</option>
                            <option value="buyer">Buyer Docs</option>
                            <option value="seller">Seller Docs</option>
                            <option value="general">General / KYC</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Loading */}
            {loading ? (
                <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
                    <span className="size-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                    <p className="text-sm font-medium">Fetching expiry data…</p>
                </div>
            ) : documents.length === 0 ? (
                <div className="py-20 text-center bg-white border border-slate-100 rounded-2xl shadow-[var(--shadow-card)] px-4">
                    <span className="material-symbols-outlined text-5xl text-emerald-400 block mb-3">verified</span>
                    <p className="text-lg font-black text-slate-800">All clear! ✅</p>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
                        No documents expiring within the next {daysAhead} days matching your filters.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <SectionBlock
                        title="🔴 Critical"
                        subtitle="Already expired or expiring within 7 days — act immediately"
                        icon="error"
                        badge={critical.length}
                        badgeColor="bg-red-100 text-red-700"
                        docs={critical}
                        emptyMsg="No critical expirations — all good in this range!"
                    />
                    <SectionBlock
                        title="🟡 Warning"
                        subtitle="Expiring in 8–30 days — plan renewal now"
                        icon="warning"
                        badge={warning.length}
                        badgeColor="bg-amber-100 text-amber-700"
                        docs={warning}
                        emptyMsg="No documents expiring in the warning range."
                    />
                    <SectionBlock
                        title="📅 Upcoming"
                        subtitle={`Expiring in 31–${daysAhead} days — keep on your radar`}
                        icon="calendar_today"
                        badge={upcoming.length}
                        badgeColor="bg-blue-100 text-blue-700"
                        docs={upcoming}
                        emptyMsg="Nothing upcoming — well managed!"
                    />
                </div>
            )}

            {/* Info Footer */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-slate-400 text-lg shrink-0 mt-0.5">info</span>
                <div>
                    <p className="text-xs font-bold text-slate-700">How Expiry Alerts Work</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Alerts are automatically generated when documents with expiry dates are uploaded in <strong>Customer → Documents</strong>.
                        Critical alerts (≤7 days) trigger <strong>Smart Notifications</strong>. Tap any card on mobile to see complete details and call or view the customer profile.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CustomerAlerts;
