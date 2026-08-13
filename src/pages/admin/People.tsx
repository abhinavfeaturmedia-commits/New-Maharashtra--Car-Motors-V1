import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type PersonType = 'buyer' | 'seller' | 'both';

interface Person {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    city: string | null;
    created_at: string;
    personType: PersonType;
    dealCount: number;
    totalAmount: number;
    lastInteraction: string | null;
    documentCount: number;
    notes: string | null;
}

// ─── Add Customer Modal ───────────────────────────────────────────────────────

const emptyForm = {
    full_name: '',
    phone: '',
    email: '',
    city: 'Pune',
    notes: '',
};

const AddCustomerModal: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.full_name.trim() || !form.phone.trim()) {
            setError('Name and phone number are required.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const { error: err } = await supabase.from('customers').insert({
                full_name: form.full_name.trim(),
                phone: form.phone.trim(),
                email: form.email || null,
                city: form.city || null,
                notes: form.notes || null,
            });
            if (err) throw err;
            onSaved();
        } catch (e: any) {
            setError(e.message || 'Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const field = (label: string, key: keyof typeof form, type = 'text', required = false, placeholder = '') => (
        <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-0.5">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                type={type}
                value={form[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-primary placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition"
            />
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="material-symbols-outlined text-white">person_add</span>
                        </div>
                        <div>
                            <h2 className="font-black text-white">Add New Customer</h2>
                            <p className="text-white/60 text-xs">Buyer, seller, or both</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="size-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-white text-lg">close</span>
                    </button>
                </div>
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    {field('Full Name', 'full_name', 'text', true, 'e.g. Ramesh Patil')}
                    {field('Phone Number', 'phone', 'tel', true, 'e.g. 9876543210')}
                    {field('Email (Optional)', 'email', 'email', false, 'e.g. ramesh@gmail.com')}
                    {field('City', 'city', 'text', false, 'e.g. Pune')}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notes (Optional)</label>
                        <textarea
                            value={form.notes}
                            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                            placeholder="Any notes about this person…"
                            rows={3}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-primary placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        />
                    </div>
                    {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 h-11 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving} className="flex-1 h-11 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm">
                            {saving ? 'Saving…' : 'Save Customer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

const Avatar = ({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) => {
    const initials = name ? name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '?';
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500', 'bg-indigo-500'];
    const color = colors[name.charCodeAt(0) % colors.length];
    const sizeClass = { sm: 'size-8 text-[10px]', md: 'size-10 text-xs', lg: 'size-12 text-sm' }[size];
    return (
        <div className={`${sizeClass} ${color} rounded-full flex items-center justify-center text-white font-bold shrink-0`}>
            {initials}
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const People: React.FC = () => {

    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'buyer' | 'seller'>('all');
    const [showAdd, setShowAdd] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            // Fetch customers with their deal counts and document counts
            const { data: customers } = await supabase
                .from('customers')
                .select(`
                    id, full_name, phone, email, city, created_at, notes,
                    customer_deals(id, deal_type, total_amount, deal_date, created_at),
                    customer_documents(id)
                `)
                .order('created_at', { ascending: false });

            const mapped: Person[] = (customers || []).map((c: any) => {
                const deals: any[] = c.customer_deals || [];
                const docs: any[] = c.customer_documents || [];
                const hasBought = deals.some((d: any) => d.deal_type === 'purchase' || d.deal_type === 'exchange');
                const hasSold = deals.some((d: any) => d.deal_type === 'sell_to_us' || d.deal_type === 'consignment');
                const personType: PersonType = hasBought && hasSold ? 'both' : hasSold ? 'seller' : 'buyer';
                const totalAmount = deals.reduce((a: number, d: any) => a + (Number(d.total_amount) || 0), 0);
                const dates = deals.map((d: any) => d.deal_date || d.created_at).filter(Boolean).sort().reverse();
                return {
                    id: c.id,
                    full_name: c.full_name,
                    phone: c.phone,
                    email: c.email,
                    city: c.city,
                    created_at: c.created_at,
                    notes: c.notes,
                    personType,
                    dealCount: deals.length,
                    totalAmount,
                    lastInteraction: dates[0] || c.created_at,
                    documentCount: docs.length,
                };
            });

            setPeople(mapped);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        return people.filter(p => {
            if (filterType !== 'all' && p.personType !== filterType && !(filterType === 'buyer' && p.personType === 'both') && !(filterType === 'seller' && p.personType === 'both')) return false;
            if (search) {
                const q = search.toLowerCase();
                return p.full_name.toLowerCase().includes(q) || p.phone.includes(q) || (p.email || '').toLowerCase().includes(q) || (p.city || '').toLowerCase().includes(q);
            }
            return true;
        });
    }, [people, search, filterType]);

    const fmtAmt = (v: number) => v > 0 ? (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${v.toLocaleString('en-IN')}`) : null;
    const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    const typeBadge: Record<PersonType, { label: string; color: string }> = {
        buyer:  { label: '🛒 Buyer',  color: 'bg-blue-100 text-blue-700' },
        seller: { label: '🤝 Seller', color: 'bg-amber-100 text-amber-700' },
        both:   { label: '🔄 Both',   color: 'bg-purple-100 text-purple-700' },
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">
                        My Customers
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        All buyers and sellers — <span className="font-semibold text-primary">{people.length} total</span>
                    </p>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="h-10 px-5 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm"
                >
                    <span className="material-symbols-outlined text-lg">person_add</span>
                    Add Customer
                </button>
            </div>

            {/* Search + Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    <input
                        type="text"
                        placeholder="Search by name, phone or city…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm text-primary placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
                <div className="flex gap-2">
                    {(['all', 'buyer', 'seller'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setFilterType(t)}
                            className={`h-11 px-4 rounded-xl text-sm font-semibold border transition-colors capitalize ${
                                filterType === t
                                    ? 'bg-primary text-white border-primary shadow-sm'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {t === 'all' ? 'All People' : t === 'buyer' ? '🛒 Buyers' : '🤝 Sellers'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total People', value: people.length, icon: 'groups', color: 'text-primary' },
                    { label: 'With Deals',   value: people.filter(p => p.dealCount > 0).length, icon: 'handshake', color: 'text-green-600' },
                    { label: 'With Documents', value: people.filter(p => p.documentCount > 0).length, icon: 'folder', color: 'text-amber-600' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
                        <span className={`material-symbols-outlined text-2xl ${s.color}`}>{s.icon}</span>
                        <div>
                            <p className="text-xl font-black text-primary font-display">{loading ? '…' : s.value}</p>
                            <p className="text-xs text-slate-400 font-medium">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* People List */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-8 space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="size-10 rounded-full bg-slate-100 animate-pulse shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-slate-100 animate-pulse rounded w-36" />
                                    <div className="h-3 bg-slate-100 animate-pulse rounded w-24" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-20 flex flex-col items-center gap-3 text-slate-300">
                        <span className="material-symbols-outlined text-6xl">people</span>
                        <p className="text-base font-medium text-slate-400">
                            {search ? 'No customers match your search' : 'No customers yet'}
                        </p>
                        <button onClick={() => setShowAdd(true)} className="h-10 px-5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors mt-2">
                            + Add Your First Customer
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filtered.map(person => {
                            const badge = typeBadge[person.personType];
                            const amt = fmtAmt(person.totalAmount);
                            return (
                                <Link
                                    key={person.id}
                                    to={`/admin/people/${person.id}`}
                                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors"
                                >
                                    <Avatar name={person.full_name} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-bold text-primary">{person.full_name}</p>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}>
                                                {badge.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[13px] text-slate-400">call</span>
                                                {person.phone}
                                            </span>
                                            {person.city && (
                                                <span className="text-xs text-slate-400">📍 {person.city}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                                        <div className="flex items-center gap-2">
                                            {person.dealCount > 0 && (
                                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                                    {person.dealCount} deal{person.dealCount > 1 ? 's' : ''}
                                                </span>
                                            )}
                                            {person.documentCount > 0 && (
                                                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                                    <span className="material-symbols-outlined text-[11px]">folder</span>
                                                    {person.documentCount}
                                                </span>
                                            )}
                                        </div>
                                        {amt && <p className="text-xs font-bold text-green-600">{amt}</p>}
                                        <p className="text-[10px] text-slate-400">
                                            {person.lastInteraction ? fmtDate(person.lastInteraction) : 'New'}
                                        </p>
                                    </div>
                                    <span className="material-symbols-outlined text-slate-300 text-lg shrink-0">chevron_right</span>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>

            {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
        </div>
    );
};

export default People;
