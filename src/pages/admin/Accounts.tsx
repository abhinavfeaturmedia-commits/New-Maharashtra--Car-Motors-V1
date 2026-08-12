import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, X } from 'lucide-react';

// ─── Config ───────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
    Completed: 'bg-green-100 text-green-700',
    Pending:   'bg-amber-100 text-amber-700',
    manual:    'bg-purple-100 text-purple-700',
};
const TABS = ['All', 'Income', 'Expense', 'Pending', 'Manual'];
const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Other'];
const MANUAL_CATEGORIES_INCOME  = ['Service Income', 'Commission Received', 'Rent Received', 'Miscellaneous Income', 'Other'];
const MANUAL_CATEGORIES_EXPENSE = ['Petty Cash', 'Office Rent', 'Utilities', 'Staff Salary', 'Marketing', 'Maintenance', 'GST Payment', 'TDS Payment', 'Other'];

const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;
const formatCurrencyLakhs = (val: number) => `₹${(val / 100000).toFixed(2)}L`;

const emptyForm = {
    description: '',
    type: 'expense' as 'income' | 'expense',
    amount: '',
    mode: 'Cash',
    category: 'Other',
    notes: '',
    status: 'Completed',
    transaction_date: new Date().toISOString().split('T')[0],
};

// ─── Component ────────────────────────────────────────────────────────────────

const Accounts = () => {
    const { sales, expenses, inventory, manualTransactions, refreshData } = useData();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState('All');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // ─── Derived Transactions ─────────────────────────────────────────────────

    const TRANSACTIONS = useMemo(() => {
        const arr: any[] = [];

        // 1. Income from Sales
        sales.forEach(s => {
            const price = Number(s.sale_price ?? s.final_price) || 0;
            if (!price) return;
            arr.push({
                id: `sale_${s.id}`,
                desc: `Sale — ${s.car?.year || ''} ${s.car?.make || ''} ${s.car?.model || ''} → ${s.customer?.full_name || s.customer_name || 'Customer'}`,
                type: 'Income',
                amountNum: price,
                amountStr: `+${formatCurrency(price)}`,
                date: new Date(s.sale_date).toLocaleDateString('en-IN'),
                rawDate: new Date(s.sale_date).getTime(),
                mode: 'Bank Transfer',
                status: 'Completed',
                source: 'auto',
                link: s.car_id ? `/admin/inventory/${s.car_id}/edit` : null,
            });
        });

        // 2. Expenses from Vehicle Expenses
        expenses.forEach(e => {
            arr.push({
                id: `exp_${e.id}`,
                desc: `${e.category} — ${e.car?.make || 'General'} ${e.car?.model || ''} (${e.description || 'Routine'})`,
                type: 'Expense',
                amountNum: Number(e.amount),
                amountStr: `-${formatCurrency(e.amount)}`,
                date: new Date(e.expense_date || e.created_at).toLocaleDateString('en-IN'),
                rawDate: new Date(e.expense_date || e.created_at).getTime(),
                mode: 'Account Transfer',
                status: 'Completed',
                source: 'auto',
                link: e.car_id ? `/admin/inventory/${e.car_id}/edit` : null,
            });
        });

        // 3. Capital Purchases (purchased inventory)
        inventory
            .filter((i: any) => i.source === 'purchased' || (!i.source && !i.dealer_id && !i.consignment_owner_name))
            .forEach((i: any) => {
                const cost = Number(i.purchase_cost || i.price) || 0;
                if (!cost) return;
                arr.push({
                    id: `inv_purc_${i.id}`,
                    desc: `Capital Purchase — ${i.year} ${i.make} ${i.model}`,
                    type: 'Expense',
                    amountNum: cost,
                    amountStr: `-${formatCurrency(cost)}`,
                    date: new Date(i.created_at).toLocaleDateString('en-IN'),
                    rawDate: new Date(i.created_at).getTime(),
                    mode: 'Own Purchase',
                    status: 'Completed',
                    source: 'auto',
                    link: `/admin/inventory/${i.id}/edit`,
                });
            });

        // 4. Manual Transactions from Supabase
        manualTransactions.forEach((mt: any) => {
            const isIncome = mt.type === 'income';
            arr.push({
                id: `manual_${mt.id}`,
                _rawId: mt.id,
                desc: mt.description,
                type: isIncome ? 'Income' : 'Expense',
                amountNum: Number(mt.amount),
                amountStr: isIncome ? `+${formatCurrency(mt.amount)}` : `-${formatCurrency(mt.amount)}`,
                date: new Date(mt.transaction_date).toLocaleDateString('en-IN'),
                rawDate: new Date(mt.transaction_date).getTime(),
                mode: mt.mode || 'Cash',
                status: mt.status || 'Completed',
                source: 'manual',
                category: mt.category,
                notes: mt.notes,
                link: null,
            });
        });

        return arr.sort((a, b) => b.rawDate - a.rawDate);
    }, [sales, expenses, inventory, manualTransactions]);

    const filtered = useMemo(() => {
        if (tab === 'All')     return TRANSACTIONS;
        if (tab === 'Pending') return TRANSACTIONS.filter(t => t.status === 'Pending');
        if (tab === 'Manual')  return TRANSACTIONS.filter(t => t.source === 'manual');
        return TRANSACTIONS.filter(t => t.type === tab);
    }, [TRANSACTIONS, tab]);

    // ─── Summary Stats ────────────────────────────────────────────────────────

    const totalIncome  = TRANSACTIONS.filter(t => t.type === 'Income').reduce((s, t) => s + t.amountNum, 0);
    const totalExpense = TRANSACTIONS.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amountNum, 0);
    const netBalance   = totalIncome - totalExpense;
    const pendingCount = TRANSACTIONS.filter(t => t.status === 'Pending').length;

    // ─── CRUD for Manual Transactions ─────────────────────────────────────────

    const openAddManual = () => {
        setEditId(null);
        setForm(emptyForm);
        setShowForm(true);
    };

    const openEditManual = (t: any) => {
        setEditId(t._rawId);
        setForm({
            description: t.desc,
            type: t.type === 'Income' ? 'income' : 'expense',
            amount: String(t.amountNum),
            mode: t.mode,
            category: t.category || 'Other',
            notes: t.notes || '',
            status: t.status,
            transaction_date: new Date(t.rawDate).toISOString().split('T')[0],
        });
        setShowForm(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.description.trim() || !form.amount) return;
        setIsSaving(true);
        try {
            const payload = {
                description: form.description.trim(),
                type: form.type,
                amount: Number(form.amount),
                mode: form.mode,
                category: form.category,
                notes: form.notes || null,
                status: form.status,
                transaction_date: form.transaction_date,
                created_by: user?.id ?? null,
            };
            if (editId) {
                const { error } = await supabase.from('manual_transactions').update(payload).eq('id', editId);
                if (error) throw error;
                showToast('Transaction updated!');
            } else {
                const { error } = await supabase.from('manual_transactions').insert(payload);
                if (error) throw error;
                showToast('Transaction logged!');
            }
            setShowForm(false);
            setEditId(null);
            setForm(emptyForm);
            refreshData();
        } catch (err: any) {
            showToast(err.message || 'Failed to save', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteManual = async (rawId: string) => {
        if (!confirm('Delete this manual transaction? This cannot be undone.')) return;
        setIsDeletingId(rawId);
        try {
            const { error } = await supabase.from('manual_transactions').delete().eq('id', rawId);
            if (error) throw error;
            showToast('Transaction deleted.');
            refreshData();
        } catch (err: any) {
            showToast(err.message || 'Failed to delete', 'error');
        } finally {
            setIsDeletingId(null);
        }
    };

    const categoryOptions = form.type === 'income' ? MANUAL_CATEGORIES_INCOME : MANUAL_CATEGORIES_EXPENSE;

    return (
        <div className="space-y-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-5 right-5 z-[999] px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    <span className="material-symbols-outlined text-base">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Accounts & <span className="font-serif-italic font-normal text-amber-600">Payments</span></h1>
                    <p className="text-slate-500 text-sm">Comprehensive operating ledger — auto-synced from CRM + manual entries.</p>
                </div>
                <div className="flex gap-2">
                    <span className="py-2 px-3 text-[10px] font-bold tracking-wider uppercase text-green-600 bg-green-100 rounded-lg">SYNCED LEDGER</span>
                    <button onClick={openAddManual} className="h-10 px-4 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-md shadow-primary/20">
                        <Plus size={15} /> Log Manual Entry
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Gross Verified Income',   val: formatCurrencyLakhs(totalIncome),  icon: 'trending_up',    color: 'bg-green-500/10 text-green-600' },
                    { label: 'Outgoings & Capital',     val: formatCurrencyLakhs(totalExpense), icon: 'trending_down',  color: 'bg-red-500/10 text-red-600' },
                    { label: 'Net Operative Cashflow',  val: formatCurrencyLakhs(netBalance),   icon: 'account_balance',color: netBalance >= 0 ? 'bg-blue-500/10 text-blue-600' : 'bg-red-500/10 text-red-600' },
                    { label: 'Pending Collections',     val: String(pendingCount),              icon: 'pending',        color: 'bg-amber-500/10 text-amber-600' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)]">
                        <div className={`size-9 rounded-xl flex items-center justify-center ${s.color} mb-2`}><span className="material-symbols-outlined text-lg">{s.icon}</span></div>
                        <p className="text-xl font-black text-primary font-display">{s.val}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200">
                {TABS.map(t => (
                    <button key={t} onClick={() => setTab(t)} className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${tab === t ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>
                        {t}
                        {t === 'Manual' && manualTransactions.length > 0 && (
                            <span className="ml-1.5 text-[10px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded-full">{manualTransactions.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-x-auto">
                <table className="w-full min-w-[750px]">
                    <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                            <th className="text-left px-5 py-3">Description</th>
                            <th className="text-left px-5 py-3">Type</th>
                            <th className="text-left px-5 py-3">Amount</th>
                            <th className="text-left px-5 py-3">Date</th>
                            <th className="text-left px-5 py-3">Mode</th>
                            <th className="text-left px-5 py-3">Status</th>
                            <th className="text-left px-5 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">No transactions for this filter.</td></tr>
                        )}
                        {filtered.map(t => (
                            <tr
                                key={t.id}
                                className={`border-b border-slate-50 last:border-0 transition-colors ${t.link ? 'hover:bg-primary/5 cursor-pointer group' : 'hover:bg-slate-50/50'} ${t.source === 'manual' ? 'bg-purple-50/20' : ''}`}
                                onClick={() => t.link && navigate(t.link)}
                                title={t.link ? 'Click to view car details' : undefined}
                            >
                                <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-2">
                                        {t.source === 'manual' && (
                                            <span className="material-symbols-outlined text-purple-400 text-base shrink-0" title="Manual Entry">edit_note</span>
                                        )}
                                        <span className="text-sm font-medium text-primary">{t.desc}</span>
                                        {t.link && <span className="material-symbols-outlined text-[14px] text-slate-300 group-hover:text-primary transition-colors shrink-0">open_in_new</span>}
                                    </div>
                                    {t.notes && <p className="text-xs text-slate-400 mt-0.5 pl-6">{t.notes}</p>}
                                </td>
                                <td className="px-5 py-3.5">
                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${t.type === 'Income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.type}</span>
                                </td>
                                <td className={`px-5 py-3.5 text-sm font-bold ${t.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>{t.amountStr}</td>
                                <td className="px-5 py-3.5 text-sm text-slate-500">{t.date}</td>
                                <td className="px-5 py-3.5 text-sm text-slate-500">{t.mode}</td>
                                <td className="px-5 py-3.5">
                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${statusColors[t.status] || 'bg-slate-100 text-slate-500'}`}>{t.status}</span>
                                </td>
                                <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                                    {t.source === 'manual' && (
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => openEditManual(t)} className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors" title="Edit">
                                                <span className="material-symbols-outlined text-base">edit</span>
                                            </button>
                                            <button onClick={() => handleDeleteManual(t._rawId)} disabled={isDeletingId === t._rawId} className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors" title="Delete">
                                                <span className="material-symbols-outlined text-base">delete</span>
                                            </button>
                                        </div>
                                    )}
                                    {t.source === 'auto' && t.link && (
                                        <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors text-lg">chevron_right</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Manual Transaction Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                            <div>
                                <h2 className="text-lg font-black text-primary">{editId ? 'Edit Transaction' : 'Log Manual Transaction'}</h2>
                                <p className="text-xs text-slate-400 mt-0.5">Stored in Supabase and merged into the ledger</p>
                            </div>
                            <button onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }} className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                                <X size={16} className="text-slate-500" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            {/* Type Toggle */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Transaction Type *</label>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setForm(f => ({ ...f, type: 'income', category: 'Other' }))} className={`flex-1 h-10 rounded-xl font-bold text-sm border transition-colors ${form.type === 'income' ? 'bg-green-50 text-green-700 border-green-300' : 'bg-white border-slate-200 text-slate-500'}`}>
                                        ↑ Income
                                    </button>
                                    <button type="button" onClick={() => setForm(f => ({ ...f, type: 'expense', category: 'Other' }))} className={`flex-1 h-10 rounded-xl font-bold text-sm border transition-colors ${form.type === 'expense' ? 'bg-red-50 text-red-700 border-red-300' : 'bg-white border-slate-200 text-slate-500'}`}>
                                        ↓ Expense
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Description *</label>
                                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required placeholder="e.g. Office rent payment for July" className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Amount (₹) *</label>
                                    <input type="number" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required placeholder="0" className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Date *</label>
                                    <input type="date" value={form.transaction_date} onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))} required className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Category</label>
                                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary bg-white">
                                        {categoryOptions.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Payment Mode</label>
                                    <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary bg-white">
                                        {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Status</label>
                                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary bg-white">
                                        <option>Completed</option>
                                        <option>Pending</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Notes (Optional)</label>
                                    <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Reference, memo…" className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors" />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }} className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm">Cancel</button>
                                <button type="submit" disabled={isSaving || !form.description.trim() || !form.amount} className="flex-1 h-10 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
                                    {isSaving ? 'Saving…' : (editId ? 'Update Entry' : 'Log Entry')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Accounts;
