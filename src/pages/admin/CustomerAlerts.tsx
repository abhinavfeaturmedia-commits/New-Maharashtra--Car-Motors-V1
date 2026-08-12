import React, { useState, useEffect, useCallback } from 'react';
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
    purchase: 'Purchase', sell_to_us: 'Sell to Us', exchange: 'Exchange', consignment: 'Consignment',
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
    const { isAdmin } = useAuth();
    const { addNotification } = useNotifications();

    const [documents, setDocuments] = useState<ExpiringDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [daysAhead, setDaysAhead] = useState(60);
    const [docTypeFilter, setDocTypeFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [notifSent, setNotifSent] = useState(false);

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

    useEffect(() => { fetchExpiring(); }, [daysAhead]);

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

    // ─── Document Row ─────────────────────────────────────────────────────────

    const DocRow = ({ doc }: { doc: ExpiringDocument }) => {
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
            buyer: { label: 'Buyer', cls: 'bg-emerald-50 text-emerald-700' },
            seller: { label: 'Seller', cls: 'bg-blue-50 text-blue-700' },
            general: { label: 'General', cls: 'bg-slate-100 text-slate-600' },
        }[doc.party_role];

        return (
            <div className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors border-b border-slate-50 last:border-0 ${isExpired ? 'bg-red-50/30' : isCritical ? 'bg-red-50/10' : ''}`}>
                {/* Avatar */}
                <div className={`size-10 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${isCritical ? 'bg-red-100 text-red-700' : isWarning ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {getInitials(doc.customer_name)}
                </div>

                {/* Customer */}
                <div className="min-w-[160px]">
                    <Link
                        to={`/admin/customers/${doc.customer_id}?tab=documents`}
                        className="text-sm font-bold text-primary hover:underline"
                    >
                        {doc.customer_name}
                    </Link>
                    <p className="text-xs text-slate-400">{doc.customer_phone}</p>
                </div>

                {/* Doc info */}
                <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700">
                        {doc.doc_label || getDocLabel(doc.doc_type)}
                        {doc.doc_label && <span className="text-[10px] text-slate-400 ml-1">({getDocLabel(doc.doc_type)})</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${roleTag.cls}`}>{roleTag.label}</span>
                        {doc.deal_type && (
                            <span className="text-[10px] text-slate-400">Deal: {getDealLabel(doc.deal_type)}</span>
                        )}
                    </div>
                </div>

                {/* Expiry */}
                <div className="text-right min-w-[130px]">
                    <p className="text-xs font-bold text-slate-600">{formatDate(doc.expiry_date)}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-0.5 mt-1 w-fit ml-auto ${urgencyBadge.cls} ${(isCritical) ? 'animate-pulse' : ''}`}>
                        <span className="material-symbols-outlined text-[10px]">{urgencyBadge.icon}</span>
                        {urgencyBadge.label}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                    {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noreferrer" className="size-8 rounded-lg bg-slate-50 hover:bg-primary/10 text-slate-400 hover:text-primary flex items-center justify-center transition-colors" title="View file">
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                        </a>
                    )}
                    <Link
                        to={`/admin/customers/${doc.customer_id}?tab=documents`}
                        className="size-8 rounded-lg bg-slate-50 hover:bg-primary/10 text-slate-400 hover:text-primary flex items-center justify-center transition-colors"
                        title="Open customer"
                    >
                        <span className="material-symbols-outlined text-sm">person</span>
                    </Link>
                    <a href={`tel:${doc.customer_phone}`} className="size-8 rounded-lg bg-slate-50 hover:bg-green-50 text-slate-400 hover:text-green-600 flex items-center justify-center transition-colors" title="Call">
                        <span className="material-symbols-outlined text-sm">call</span>
                    </a>
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
            <div className={`flex items-center justify-between px-5 py-4 border-b border-slate-100 ${badge && badge > 0 ? '' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className={`size-9 rounded-xl flex items-center justify-center ${badgeColor}`}>
                        <span className="material-symbols-outlined text-lg">{icon}</span>
                    </div>
                    <div>
                        <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                            {title}
                            {badge != null && badge > 0 && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
                            )}
                        </p>
                        <p className="text-xs text-slate-400">{subtitle}</p>
                    </div>
                </div>
            </div>
            {docs.length === 0 ? (
                <div className="py-10 text-center">
                    <span className="material-symbols-outlined text-3xl text-slate-200 block mb-2">check_circle</span>
                    <p className="text-sm text-slate-400">{emptyMsg}</p>
                </div>
            ) : (
                <div>{docs.map(doc => <DocRow key={doc.doc_id} doc={doc} />)}</div>
            )}
        </div>
    );

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">
                        Customer <span className="font-serif-italic font-normal text-red-500">Expiry Alerts</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {loading ? '…' : `${documents.length} document${documents.length !== 1 ? 's' : ''} with expiry within ${daysAhead} days`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { setNotifSent(false); fetchExpiring(); }} className="size-9 border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 flex items-center justify-center transition-colors" title="Refresh">
                        <span className="material-symbols-outlined text-lg">refresh</span>
                    </button>
                    <Link to="/admin/customers" className="h-9 px-4 border border-slate-200 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
                        <span className="material-symbols-outlined text-sm">people_alt</span>
                        All Customers
                    </Link>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Critical',  sub: 'Expired or ≤7 days',    count: critical.length,  icon: 'error',        cls: 'bg-red-50 border-red-100',    iconCls: 'text-red-600',   pulse: critical.length > 0 },
                    { label: 'Warning',   sub: '8–30 days to expiry',    count: warning.length,   icon: 'warning',      cls: 'bg-amber-50 border-amber-100', iconCls: 'text-amber-600', pulse: false },
                    { label: 'Upcoming',  sub: '31+ days to expiry',     count: upcoming.length,  icon: 'calendar_today',cls: 'bg-blue-50 border-blue-100',  iconCls: 'text-blue-600',  pulse: false },
                ].map(card => (
                    <div key={card.label} className={`border rounded-2xl p-4 ${card.cls}`}>
                        <div className="flex items-center gap-3">
                            <span className={`material-symbols-outlined text-2xl ${card.iconCls} ${card.pulse && card.count > 0 ? 'animate-pulse' : ''}`}>{card.icon}</span>
                            <div>
                                <p className={`text-2xl font-black ${card.iconCls}`}>{card.count}</p>
                                <p className="text-xs font-bold text-slate-600">{card.label}</p>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">{card.sub}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                {/* Days ahead */}
                <div className="flex items-center gap-1.5">
                    {FILTER_RANGE_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setDaysAhead(opt.value)}
                            className={`h-8 px-3 text-xs font-bold rounded-lg transition-colors ${daysAhead === opt.value ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-primary'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <div className="h-5 w-px bg-slate-200" />

                {/* Doc type */}
                <select value={docTypeFilter} onChange={e => setDocTypeFilter(e.target.value)} className="h-9 border border-slate-200 rounded-xl px-3 text-xs outline-none bg-white text-slate-600">
                    <option value="all">All Doc Types</option>
                    {docTypes.map(t => <option key={t} value={t}>{getDocLabel(t)}</option>)}
                </select>

                {/* Role */}
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="h-9 border border-slate-200 rounded-xl px-3 text-xs outline-none bg-white text-slate-600">
                    <option value="all">All Roles</option>
                    <option value="buyer">Buyer Docs</option>
                    <option value="seller">Seller Docs</option>
                    <option value="general">General / KYC</option>
                </select>

                {/* Search */}
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-9 ml-auto">
                    <span className="material-symbols-outlined text-slate-400 text-base">search</span>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer or doc…" className="bg-transparent text-xs text-primary outline-none w-40" />
                    {search && <button onClick={() => setSearch('')} className="text-slate-300 hover:text-slate-500"><span className="material-symbols-outlined text-sm">close</span></button>}
                </div>
            </div>

            {/* Loading */}
            {loading ? (
                <div className="py-24 flex flex-col items-center gap-3 text-slate-400">
                    <span className="size-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                    <p className="text-sm">Fetching expiry data…</p>
                </div>
            ) : documents.length === 0 ? (
                <div className="py-24 text-center bg-white border border-slate-100 rounded-2xl shadow-[var(--shadow-card)]">
                    <span className="material-symbols-outlined text-5xl text-emerald-300 block mb-4">verified</span>
                    <p className="text-lg font-black text-slate-500">All clear! ✅</p>
                    <p className="text-sm text-slate-400 mt-1">No documents expiring within the next {daysAhead} days.</p>
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
                        subtitle="Expiring in 31–{daysAhead} days — keep on your radar"
                        icon="calendar_today"
                        badge={upcoming.length}
                        badgeColor="bg-blue-100 text-blue-700"
                        docs={upcoming}
                        emptyMsg="Nothing upcoming — well managed!"
                    />
                </div>
            )}

            {/* Info Footer */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 flex items-start gap-3">
                <span className="material-symbols-outlined text-slate-400 text-lg shrink-0 mt-0.5">info</span>
                <div>
                    <p className="text-xs font-bold text-slate-600">How Expiry Alerts Work</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Alerts are automatically generated when you upload a document with an expiry date in the <strong>Customer → Documents</strong> tab.
                        Critical alerts (≤7 days) also create <strong>Smart Notifications</strong> visible in the notification bell.
                        Use the range selector above to see documents expiring further out.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CustomerAlerts;
