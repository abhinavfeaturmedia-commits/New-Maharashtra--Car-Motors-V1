import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { compressPdf } from '../../lib/pdfCompressor';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    alternate_phone: string | null;
    whatsapp_number: string | null;
    address: string | null;
    city: string | null;
    occupation: string | null;
    notes: string | null;
    created_at: string;
}

interface Deal {
    id: string;
    deal_type: string;
    deal_status: string;
    deal_date: string | null;
    handover_date: string | null;
    total_amount: number | null;
    advance_paid: number | null;
    balance_due: number | null;
    payment_mode: string | null;
    notes: string | null;
    car: { make: string; model: string; year: number; registration_no: string | null } | null;
}

interface Note {
    id: string;
    note_type: string;
    content: string;
    created_at: string;
    author_name: string | null;
}

interface Doc {
    id: string;
    doc_type: string;
    doc_label: string | null;
    party_role: string;
    file_name: string | null;
    file_url: string | null;
    file_size_kb: number | null;
    is_verified: boolean;
    expiry_date: string | null;
    created_at: string;
    uploaded_by_name: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtAmt = (v: number | null) =>
    v ? (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${v.toLocaleString('en-IN')}`) : '—';

const dealTypeLabel: Record<string, string> = {
    purchase:    '🛒 Bought a Car',
    sell_to_us:  '🤝 Sold a Car to Us',
    exchange:    '🔄 Exchange Deal',
    consignment: '🅿️ Park & Sell',
};

const dealStatusBadge: Record<string, { label: string; color: string }> = {
    in_progress: { label: '⏳ In Progress', color: 'bg-blue-100 text-blue-700' },
    completed:   { label: '✅ Completed',   color: 'bg-green-100 text-green-700' },
    cancelled:   { label: '❌ Cancelled',   color: 'bg-red-100 text-red-600' },
    on_hold:     { label: '⏸ On Hold',      color: 'bg-amber-100 text-amber-700' },
};

const noteTypeIcon: Record<string, { icon: string; color: string }> = {
    call:     { icon: 'call',           color: 'bg-green-100 text-green-600' },
    visit:    { icon: 'directions_walk', color: 'bg-blue-100 text-blue-600' },
    whatsapp: { icon: 'chat',           color: 'bg-emerald-100 text-emerald-600' },
    general:  { icon: 'note_alt',       color: 'bg-slate-100 text-slate-600' },
};

const docTypeLabel: Record<string, string> = {
    aadhaar: 'Aadhaar Card', pan: 'PAN Card', voter_id: 'Voter ID', passport: 'Passport',
    driving_license: 'Driving License', rc_book: 'RC Book', insurance: 'Insurance',
    puc: 'PUC Certificate', noc: 'NOC', form_20: 'Form 20', form_21: 'Form 21',
    form_29: 'Form 29', form_30: 'Form 30', hypothecation_letter: 'Hypothecation Letter',
    loan_noc: 'Loan NOC', bank_noc: 'Bank NOC', delivery_receipt: 'Delivery Receipt',
    sales_invoice: 'Sales Invoice', rto_receipt: 'RTO Receipt', agreement: 'Agreement',
    cheque_copy: 'Cheque Copy', other: 'Other Document',
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

const Avatar = ({ name }: { name: string }) => {
    const initials = name ? name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '?';
    const colors = ['from-blue-500 to-blue-600', 'from-green-500 to-green-600', 'from-purple-500 to-purple-600', 'from-amber-500 to-amber-600', 'from-pink-500 to-pink-600'];
    const color = colors[name.charCodeAt(0) % colors.length];
    return (
        <div className={`size-16 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-white text-xl font-black shadow-md`}>
            {initials}
        </div>
    );
};

// ─── Add Note Modal ───────────────────────────────────────────────────────────

const AddNoteModal: React.FC<{ customerId: string; onClose: () => void; onSaved: () => void }> = ({ customerId, onClose, onSaved }) => {
    const { profile } = useAuth();
    const [noteType, setNoteType] = useState('general');
    const [content, setContent] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!content.trim()) return;
        setSaving(true);
        try {
            await supabase.from('customer_notes').insert({
                customer_id: customerId,
                note_type: noteType,
                content: content.trim(),
                created_by: profile?.id,
            });
            onSaved();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-4 flex items-center justify-between">
                    <h2 className="font-black text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">note_add</span> Add a Note
                    </h2>
                    <button onClick={onClose} className="size-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-lg">close</span>
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type of Note</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { val: 'call',     label: '📞 Phone Call',   },
                                { val: 'visit',    label: '🚗 Visit',         },
                                { val: 'whatsapp', label: '💬 WhatsApp',      },
                                { val: 'general',  label: '📝 General Note',  },
                            ].map(t => (
                                <button
                                    key={t.val}
                                    onClick={() => setNoteType(t.val)}
                                    className={`h-10 rounded-xl text-sm font-semibold border transition-colors ${
                                        noteType === t.val
                                            ? 'bg-primary text-white border-primary'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">What happened?</label>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="Write what happened, what was discussed, next steps…"
                            rows={4}
                            autoFocus
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-primary placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        />
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 h-11 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving || !content.trim()} className="flex-1 h-11 bg-primary text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-colors shadow-sm">
                            {saving ? 'Saving…' : 'Save Note'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Upload Document Modal ────────────────────────────────────────────────────

const UploadDocModal: React.FC<{ customerId: string; onClose: () => void; onSaved: () => void }> = ({ customerId, onClose, onSaved }) => {
    const { profile, user } = useAuth();
    const [docType, setDocType] = useState('aadhaar');
    const [customLabel, setCustomLabel] = useState('');
    const [partyRole, setPartyRole] = useState('buyer');
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!file) { setError('Please select a file.'); return; }
        setSaving(true);
        setStatusText('Preparing file…');
        setError('');
        try {
            let fileToUpload = file;
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                if (file.size > 2 * 1024 * 1024) {
                    setStatusText('Compressing PDF (>2MB)…');
                    const compResult = await compressPdf(file, {
                        targetMaxMb: 1.5,
                        quality: 0.75,
                        onProgress: (pct, text) => setStatusText(`Compressing: ${text}`)
                    });
                    fileToUpload = compResult.file;
                }
            }

            setStatusText('Uploading to storage…');
            const ext = fileToUpload.name.split('.').pop();
            const path = `${customerId}/${Date.now()}_${docType}.${ext}`;
            const { error: uploadErr } = await supabase.storage
                .from('customer-documents')
                .upload(path, fileToUpload, { upsert: true });
            if (uploadErr) throw uploadErr;

            const { data: { publicUrl } } = supabase.storage.from('customer-documents').getPublicUrl(path);

            await supabase.from('customer_documents').insert({
                customer_id: customerId,
                doc_type: docType,
                doc_label: customLabel || null,
                party_role: partyRole,
                file_name: fileToUpload.name,
                file_url: publicUrl,
                file_size_kb: Math.round(fileToUpload.size / 1024),
                uploaded_by: profile?.id ?? user?.id ?? null,
            });
            onSaved();
        } catch (e: any) {
            setError(e.message || 'Upload failed. Please try again.');
        } finally {
            setSaving(false);
            setStatusText('');
        }
    };

    const commonDocs = [
        { val: 'aadhaar', label: 'Aadhaar Card' },
        { val: 'pan', label: 'PAN Card' },
        { val: 'driving_license', label: 'Driving License' },
        { val: 'rc_book', label: 'RC Book' },
        { val: 'insurance', label: 'Insurance' },
        { val: 'agreement', label: 'Agreement' },
        { val: 'sales_invoice', label: 'Sales Invoice' },
        { val: 'other', label: 'Other' },
    ];

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 flex items-center justify-between">
                    <h2 className="font-black text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">upload_file</span> Upload Document
                    </h2>
                    <button onClick={onClose} className="size-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-lg">close</span>
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Document Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            {commonDocs.map(d => (
                                <button
                                    key={d.val}
                                    onClick={() => setDocType(d.val)}
                                    className={`h-9 px-3 rounded-xl text-xs font-semibold border transition-colors text-left ${
                                        docType === d.val ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custom Label (Optional)</label>
                        <input type="text" value={customLabel} onChange={e => setCustomLabel(e.target.value)}
                            placeholder={`e.g. "Husband's Aadhaar"`}
                            className="w-full h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-primary placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">This document belongs to</label>
                        <div className="flex gap-2">
                            {[{ val: 'buyer', label: '🛒 Buyer' }, { val: 'seller', label: '🤝 Seller' }, { val: 'general', label: '📁 General' }].map(r => (
                                <button key={r.val} onClick={() => setPartyRole(r.val)}
                                    className={`flex-1 h-10 rounded-xl text-xs font-semibold border transition-colors ${
                                        partyRole === r.val ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >{r.label}</button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select File</label>
                        <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                            <span className="material-symbols-outlined text-3xl text-slate-300 mb-1">cloud_upload</span>
                            <p className="text-sm text-slate-500 font-medium">{file ? file.name : 'Click to upload or drag file'}</p>
                            <p className="text-xs text-slate-400 mt-0.5">PDF, JPG, PNG up to 10MB</p>
                            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                                onChange={e => setFile(e.target.files?.[0] || null)}
                            />
                        </label>
                    </div>
                    {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 h-11 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
                        <button onClick={handleSave} disabled={saving || !file}
                            className="flex-1 h-11 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-blue-700 transition-colors shadow-sm truncate px-2">
                            {saving ? (statusText || 'Uploading…') : 'Upload Document'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PersonDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    const { profile } = useAuth();

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [deals, setDeals] = useState<Deal[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [docs, setDocs] = useState<Doc[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'notes' | 'documents'>('overview');
    const [showAddNote, setShowAddNote] = useState(false);
    const [showUploadDoc, setShowUploadDoc] = useState(false);

    const load = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [
                { data: cust },
                { data: dealData },
                { data: noteData },
                { data: docData },
            ] = await Promise.all([
                supabase.from('customers').select('*').eq('id', id).single(),
                supabase.from('customer_deals')
                    .select('id, deal_type, deal_status, deal_date, handover_date, total_amount, advance_paid, balance_due, payment_mode, notes, inventory:inventory_id(make, model, year, registration_no)')
                    .eq('customer_id', id)
                    .order('created_at', { ascending: false }),
                supabase.from('customer_notes')
                    .select('id, note_type, content, created_at, author:created_by(full_name)')
                    .eq('customer_id', id)
                    .order('created_at', { ascending: false }),
                supabase.from('customer_documents')
                    .select('id, doc_type, doc_label, party_role, file_name, file_url, file_size_kb, is_verified, expiry_date, created_at, uploaded_by:uploaded_by(full_name)')
                    .eq('customer_id', id)
                    .order('created_at', { ascending: false }),
            ]);

            setCustomer(cust);
            setDeals((dealData || []).map((d: any) => ({ ...d, car: d.inventory })));
            setNotes((noteData || []).map((n: any) => ({ ...n, author_name: n.author?.full_name || null })));
            setDocs((docData || []).map((d: any) => ({ ...d, uploaded_by_name: d.uploaded_by?.full_name || null })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 bg-slate-100 animate-pulse rounded-xl w-48" />
                <div className="h-40 bg-slate-100 animate-pulse rounded-3xl" />
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="text-center py-20">
                <p className="text-slate-400 text-lg">Customer not found.</p>
                <Link to="/admin/people" className="mt-4 inline-block text-primary font-bold hover:underline">← Back to Customers</Link>
            </div>
        );
    }

    const totalDealt = deals.reduce((a, d) => a + (d.total_amount || 0), 0);

    const tabs = [
        { key: 'overview',   label: 'Overview',  icon: 'person' },
        { key: 'history',    label: `Deals (${deals.length})`,   icon: 'handshake' },
        { key: 'notes',      label: `Notes (${notes.length})`,   icon: 'note_alt' },
        { key: 'documents',  label: `Docs (${docs.length})`,    icon: 'folder' },
    ] as const;

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-400">
                <Link to="/admin/people" className="hover:text-primary font-medium transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">people</span> My Customers
                </Link>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
                <span className="text-primary font-semibold">{customer.full_name}</span>
            </div>

            {/* Profile Card */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-start gap-5">
                    <Avatar name={customer.full_name} />
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-black text-primary font-display">{customer.full_name}</h1>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                            <a href={`tel:${customer.phone}`} className="text-sm text-slate-600 flex items-center gap-1 hover:text-primary transition-colors">
                                <span className="material-symbols-outlined text-base text-slate-400">call</span> {customer.phone}
                            </a>
                            {customer.email && (
                                <a href={`mailto:${customer.email}`} className="text-sm text-slate-600 flex items-center gap-1 hover:text-primary transition-colors">
                                    <span className="material-symbols-outlined text-base text-slate-400">mail</span> {customer.email}
                                </a>
                            )}
                            {customer.city && (
                                <span className="text-sm text-slate-500 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-base text-slate-400">location_on</span> {customer.city}
                                </span>
                            )}
                        </div>
                        {customer.notes && (
                            <p className="text-sm text-slate-500 mt-2 bg-slate-50 rounded-xl px-3 py-2 italic">"{customer.notes}"</p>
                        )}
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                        <p className="text-xs text-slate-400">Customer since</p>
                        <p className="text-sm font-bold text-primary">{fmtDate(customer.created_at)}</p>
                        {totalDealt > 0 && (
                            <>
                                <p className="text-xs text-slate-400 mt-1">Total dealt</p>
                                <p className="text-base font-black text-green-600">{fmtAmt(totalDealt)}</p>
                            </>
                        )}
                    </div>
                </div>

                {/* Contact action buttons */}
                <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-100">
                    <a href={`tel:${customer.phone}`}
                        className="h-9 px-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-green-100 transition-colors">
                        <span className="material-symbols-outlined text-base">call</span> Call
                    </a>
                    <a href={`https://wa.me/91${customer.whatsapp_number || customer.phone}`} target="_blank" rel="noreferrer"
                        className="h-9 px-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-100 transition-colors">
                        <span className="material-symbols-outlined text-base">chat</span> WhatsApp
                    </a>
                    <button onClick={() => { setShowAddNote(true); setActiveTab('notes'); }}
                        className="h-9 px-4 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-slate-100 transition-colors">
                        <span className="material-symbols-outlined text-base">note_add</span> Add Note
                    </button>
                    <button onClick={() => { setShowUploadDoc(true); setActiveTab('documents'); }}
                        className="h-9 px-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-blue-100 transition-colors">
                        <span className="material-symbols-outlined text-base">upload_file</span> Upload Doc
                    </button>
                    <Link to={`/admin/customers/${customer.id}`}
                        className="h-9 px-4 bg-primary/5 border border-primary/20 text-primary rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-primary/10 transition-colors ml-auto">
                        <span className="material-symbols-outlined text-base">open_in_new</span> Full Profile
                    </Link>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 p-1.5 shadow-sm w-full overflow-x-auto">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key as any)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex-1 justify-center ${
                            activeTab === t.key
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-primary'
                        }`}
                    >
                        <span className="material-symbols-outlined text-base">{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-3">
                        <h3 className="font-bold text-primary text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-slate-400">info</span> Contact Details
                        </h3>
                        <div className="space-y-2.5">
                            {[
                                { label: 'Phone', value: customer.phone, icon: 'call' },
                                { label: 'Alt Phone', value: customer.alternate_phone, icon: 'phone_forwarded' },
                                { label: 'WhatsApp', value: customer.whatsapp_number, icon: 'chat' },
                                { label: 'Email', value: customer.email, icon: 'mail' },
                                { label: 'City', value: customer.city, icon: 'location_on' },
                                { label: 'Address', value: customer.address, icon: 'home' },
                                { label: 'Occupation', value: customer.occupation, icon: 'work' },
                            ].filter(f => f.value).map(f => (
                                <div key={f.label} className="flex items-start gap-2">
                                    <span className="material-symbols-outlined text-base text-slate-400 mt-0.5 shrink-0">{f.icon}</span>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">{f.label}</p>
                                        <p className="text-sm text-primary font-medium">{f.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                        <h3 className="font-bold text-primary text-sm flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-base text-slate-400">bar_chart</span> Quick Summary
                        </h3>
                        <div className="space-y-3">
                            {[
                                { label: 'Total Deals', value: deals.length, color: 'text-primary' },
                                { label: 'Completed Deals', value: deals.filter(d => d.deal_status === 'completed').length, color: 'text-green-600' },
                                { label: 'Total Value', value: fmtAmt(totalDealt), color: 'text-green-600' },
                                { label: 'Documents Uploaded', value: docs.length, color: 'text-blue-600' },
                                { label: 'Notes Added', value: notes.length, color: 'text-slate-600' },
                            ].map(s => (
                                <div key={s.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                                    <p className="text-sm text-slate-600">{s.label}</p>
                                    <p className={`text-sm font-black font-display ${s.color}`}>{s.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="space-y-3">
                    {deals.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                            <span className="material-symbols-outlined text-5xl text-slate-200">handshake</span>
                            <p className="text-slate-400 text-sm mt-2">No deals recorded yet</p>
                        </div>
                    ) : deals.map(deal => {
                        const status = dealStatusBadge[deal.deal_status] || { label: deal.deal_status, color: 'bg-slate-100 text-slate-500' };
                        return (
                            <div key={deal.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-base font-bold text-primary">
                                                {deal.car ? `${deal.car.make} ${deal.car.model} (${deal.car.year})` : 'Unknown Vehicle'}
                                            </p>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                                        </div>
                                        <p className="text-sm text-slate-500 mt-0.5">{dealTypeLabel[deal.deal_type] || deal.deal_type}</p>
                                        {deal.car?.registration_no && (
                                            <p className="text-xs text-slate-400 mt-0.5 font-mono">{deal.car.registration_no}</p>
                                        )}
                                    </div>
                                    {deal.total_amount && (
                                        <div className="text-right shrink-0">
                                            <p className="text-lg font-black text-primary font-display">{fmtAmt(deal.total_amount)}</p>
                                            {deal.payment_mode && <p className="text-xs text-slate-400">{deal.payment_mode}</p>}
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-50">
                                    {deal.deal_date && <div><p className="text-[10px] text-slate-400 font-bold uppercase">Deal Date</p><p className="text-xs text-slate-700 font-semibold">{fmtDate(deal.deal_date)}</p></div>}
                                    {deal.handover_date && <div><p className="text-[10px] text-slate-400 font-bold uppercase">Handover</p><p className="text-xs text-slate-700 font-semibold">{fmtDate(deal.handover_date)}</p></div>}
                                    {deal.advance_paid != null && <div><p className="text-[10px] text-slate-400 font-bold uppercase">Advance Paid</p><p className="text-xs text-green-600 font-bold">{fmtAmt(deal.advance_paid)}</p></div>}
                                    {deal.balance_due != null && deal.balance_due > 0 && <div><p className="text-[10px] text-slate-400 font-bold uppercase">Balance Due</p><p className="text-xs text-red-600 font-bold">{fmtAmt(deal.balance_due)}</p></div>}
                                </div>
                                {deal.notes && (
                                    <p className="text-xs text-slate-500 mt-3 bg-slate-50 rounded-xl px-3 py-2 italic">"{deal.notes}"</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {activeTab === 'notes' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={() => setShowAddNote(true)}
                            className="h-10 px-5 bg-primary text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm">
                            <span className="material-symbols-outlined text-lg">note_add</span> Add Note
                        </button>
                    </div>
                    {notes.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                            <span className="material-symbols-outlined text-5xl text-slate-200">note_alt</span>
                            <p className="text-slate-400 text-sm mt-2">No notes yet</p>
                            <button onClick={() => setShowAddNote(true)} className="mt-4 h-9 px-5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
                                Add First Note
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {notes.map(note => {
                                const meta = noteTypeIcon[note.note_type] || noteTypeIcon.general;
                                return (
                                    <div key={note.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-3">
                                        <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
                                            <span className="material-symbols-outlined text-base">{meta.icon}</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-primary leading-relaxed">{note.content}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-[10px] text-slate-400">{fmtDate(note.created_at)}</span>
                                                {note.author_name && (
                                                    <span className="text-[10px] text-slate-400">by {note.author_name}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'documents' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={() => setShowUploadDoc(true)}
                            className="h-10 px-5 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm">
                            <span className="material-symbols-outlined text-lg">upload_file</span> Upload Document
                        </button>
                    </div>
                    {docs.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                            <span className="material-symbols-outlined text-5xl text-slate-200">folder_open</span>
                            <p className="text-slate-400 text-sm mt-2">No documents uploaded yet</p>
                            <button onClick={() => setShowUploadDoc(true)} className="mt-4 h-9 px-5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors">
                                Upload First Document
                            </button>
                        </div>
                    ) : (
                        <div className="grid sm:grid-cols-2 gap-3">
                            {docs.map(doc => {
                                const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
                                const expiringSoon = doc.expiry_date && !isExpired && (new Date(doc.expiry_date).getTime() - Date.now()) < 30 * 24 * 60 * 60 * 1000;
                                return (
                                    <div key={doc.id} className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3 ${isExpired ? 'border-red-200 bg-red-50' : expiringSoon ? 'border-amber-200 bg-amber-50' : 'border-slate-100'}`}>
                                        <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${isExpired ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                            <span className="material-symbols-outlined text-lg">
                                                {doc.file_url?.endsWith('.pdf') ? 'picture_as_pdf' : 'image'}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-primary truncate">
                                                {doc.doc_label || docTypeLabel[doc.doc_type] || doc.doc_type}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                <span className="text-[10px] text-slate-400">{fmtDate(doc.created_at)}</span>
                                                {doc.file_size_kb && <span className="text-[10px] text-slate-400">{doc.file_size_kb} KB</span>}
                                                {doc.expiry_date && (
                                                    <span className={`text-[10px] font-bold ${isExpired ? 'text-red-600' : expiringSoon ? 'text-amber-600' : 'text-slate-400'}`}>
                                                        {isExpired ? '⚠ Expired' : `Exp: ${fmtDate(doc.expiry_date)}`}
                                                    </span>
                                                )}
                                                {doc.is_verified && <span className="text-[10px] font-bold text-green-600">✓ Verified</span>}
                                            </div>
                                        </div>
                                        {doc.file_url && (
                                            <a href={doc.file_url} target="_blank" rel="noreferrer"
                                                className="size-9 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                                                <span className="material-symbols-outlined text-base text-slate-600">download</span>
                                            </a>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {showAddNote && (
                <AddNoteModal
                    customerId={customer.id}
                    onClose={() => setShowAddNote(false)}
                    onSaved={() => { setShowAddNote(false); load(); }}
                />
            )}
            {showUploadDoc && (
                <UploadDocModal
                    customerId={customer.id}
                    onClose={() => setShowUploadDoc(false)}
                    onSaved={() => { setShowUploadDoc(false); load(); }}
                />
            )}
        </div>
    );
};

export default PersonDetail;
