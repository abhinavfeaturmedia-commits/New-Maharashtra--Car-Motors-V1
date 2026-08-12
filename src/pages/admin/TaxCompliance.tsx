import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Config ───────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
    filed:    'bg-green-100 text-green-700',
    due:      'bg-amber-100 text-amber-700',
    overdue:  'bg-red-100 text-red-700',
    Filed:    'bg-green-100 text-green-700',
    Due:      'bg-amber-100 text-amber-700',
    Overdue:  'bg-red-100 text-red-700',
    Deposited:'bg-green-100 text-green-700',
    Pending:  'bg-amber-100 text-amber-700',
};

const formatCurrency = (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`;

// ─── Component ────────────────────────────────────────────────────────────────

const TaxCompliance = () => {
    const { sales, inventory, expenses, taxFilings, refreshData } = useData();
    const { user, profile } = useAuth();
    const [tab, setTab] = useState<'gst' | 'tds'>('gst');
    const [filingModal, setFilingModal] = useState<{ monthKey: string; monthLabel: string; netPayable: number } | null>(null);
    const [refNo, setRefNo] = useState('');
    const [filingNotes, setFilingNotes] = useState('');
    const [isFiling, setIsFiling] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // ─── Build filing lookup (monthKey → filing record) ───────────────────────
    const filingMap = useMemo(() => {
        const map: Record<string, any> = {};
        taxFilings.forEach((f: any) => { map[f.month_key] = f; });
        return map;
    }, [taxFilings]);

    // ─── GST Computation ──────────────────────────────────────────────────────

    const taxMetrics = useMemo(() => {
        const monthGroups: Record<string, { taxable: number; cgst: number; sgst: number; net: number; monthSort: string; label: string }> = {};

        sales.forEach(s => {
            const date = new Date(s.sale_date);
            const monthKey  = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const monthLabel = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

            if (!monthGroups[monthKey]) {
                monthGroups[monthKey] = { taxable: 0, cgst: 0, sgst: 0, net: 0, monthSort: monthKey, label: monthLabel };
            }

            // GST on margin (standard for used cars in India)
            const car = inventory.find((c: any) => c.id === (s.inventory_id ?? s.car_id));
            const purchasePrice = car ? Number(car.purchase_cost ?? car.price) || 0 : 0;
            const salePrice = Number(s.sale_price ?? s.final_price) || 0;
            const margin = Math.max(0, salePrice - purchasePrice);
            const gstAlloc  = margin * 0.18;
            const singleTax = gstAlloc / 2;

            monthGroups[monthKey].taxable += margin;
            monthGroups[monthKey].cgst += singleTax;
            monthGroups[monthKey].sgst += singleTax;
            monthGroups[monthKey].net   += gstAlloc;
        });

        const now = new Date();
        const gstArray = Object.keys(monthGroups).map(key => {
            const data = monthGroups[key];
            const [yr, mo] = key.split('-').map(Number);
            const monthDate = new Date(yr, mo - 1, 1);
            const isCurrentMonth = monthDate.getMonth() === now.getMonth() && monthDate.getFullYear() === now.getFullYear();
            const isPast = monthDate < new Date(now.getFullYear(), now.getMonth(), 1);

            // Check if manually filed in Supabase
            const filingRecord = filingMap[key];
            let status = isCurrentMonth ? 'due' : (isPast ? 'overdue' : 'due');
            if (filingRecord?.status === 'filed') status = 'filed';

            return {
                monthKey: key,
                month: data.label,
                taxableStr: formatCurrency(data.taxable),
                cgstStr:    formatCurrency(data.cgst),
                sgstStr:    formatCurrency(data.sgst),
                inputStr:   'Calculated internally',
                netStr:     formatCurrency(data.net),
                rawNet:     data.net,
                rawSort:    data.monthSort,
                status,
                filingRecord,
            };
        }).sort((a, b) => b.rawSort.localeCompare(a.rawSort));

        // TDS from expenses
        const contractorExpenses = expenses
            .filter((e: any) => e.category === 'Detailing' || e.category === 'Repair')
            .reduce((sum: number, e: any) => sum + Number(e.amount), 0);

        let tdsArray: any[] = [];
        if (contractorExpenses > 0) {
            tdsArray.push({
                section: '194C',
                desc: 'Contractor Payments (Repairs/Detailing)',
                amount: formatCurrency(contractorExpenses),
                tds: formatCurrency(contractorExpenses * 0.02),
                depositDate: 'Dependent on billing cycle',
                status: 'Pending',
            });
        }

        const totalPayableThisMonth = gstArray
            .filter(g => g.status === 'due' || g.status === 'overdue')
            .reduce((sum, g) => sum + g.rawNet, 0);

        const filedCount = gstArray.filter(g => g.status === 'filed').length;

        return { gstArray, tdsArray, totalPayableThisMonth, filedCount };
    }, [sales, inventory, expenses, filingMap]);

    // ─── Mark as Filed ────────────────────────────────────────────────────────

    const openFilingModal = (g: any) => {
        setFilingModal({ monthKey: g.monthKey, monthLabel: g.month, netPayable: g.rawNet });
        setRefNo('');
        setFilingNotes('');
    };

    const handleMarkFiled = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!filingModal) return;
        setIsFiling(true);
        try {
            const existing = filingMap[filingModal.monthKey];
            const payload = {
                month_key:      filingModal.monthKey,
                month_label:    filingModal.monthLabel,
                net_payable:    filingModal.netPayable,
                status:         'filed',
                filed_at:       new Date().toISOString(),
                filed_by:       user?.id ?? null,
                filed_by_name:  (profile as any)?.full_name ?? user?.email ?? 'Admin',
                reference_no:   refNo.trim() || null,
                notes:          filingNotes.trim() || null,
            };

            if (existing) {
                const { error } = await supabase.from('tax_filings').update(payload).eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('tax_filings').insert(payload);
                if (error) throw error;
            }

            showToast(`GST for ${filingModal.monthLabel} marked as Filed ✓`);
            setFilingModal(null);
            refreshData();
        } catch (err: any) {
            showToast(err.message || 'Failed to mark as filed', 'error');
        } finally {
            setIsFiling(false);
        }
    };

    const handleUnmarkFiled = async (monthKey: string, monthLabel: string) => {
        const existing = filingMap[monthKey];
        if (!existing) return;
        if (!confirm(`Unmark ${monthLabel} as filed? This will reset it to "Due".`)) return;
        try {
            const { error } = await supabase.from('tax_filings').update({ status: 'due', filed_at: null, filed_by: null, reference_no: null }).eq('id', existing.id);
            if (error) throw error;
            showToast(`${monthLabel} reset to Due.`);
            refreshData();
        } catch (err: any) {
            showToast(err.message || 'Failed to unmark', 'error');
        }
    };

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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Tax & Compliance</h1>
                    <p className="text-slate-500 text-sm">Live GST calculations on vehicle sale margins — filing status persisted to Supabase.</p>
                </div>
                <span className="py-2 px-3 text-[10px] font-bold tracking-wider uppercase text-blue-600 bg-blue-100 rounded-lg shadow-sm">DYNAMIC COMPLIANCE</span>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Pending GST Payable',  val: formatCurrency(taxMetrics.totalPayableThisMonth), icon: 'receipt',          color: 'bg-blue-500/10 text-blue-600' },
                    { label: 'Months Filed',          val: String(taxMetrics.filedCount),                   icon: 'task_alt',          color: 'bg-green-500/10 text-green-600' },
                    { label: 'TDS Pending',           val: 'Check Detail',                                  icon: 'pending_actions',   color: 'bg-amber-500/10 text-amber-600' },
                    { label: 'Next Auto-Filing',      val: 'End of Month',                                  icon: 'event',             color: 'bg-red-500/10 text-red-600' },
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
                <button onClick={() => setTab('gst')} className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${tab === 'gst' ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>Live Margin GST Summary</button>
                <button onClick={() => setTab('tds')} className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${tab === 'tds' ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>TDS Extractor</button>
            </div>

            {tab === 'gst' ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                    <table className="w-full min-w-[900px]">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                                <th className="text-left px-5 py-3 border-r border-slate-100">Month</th>
                                <th className="text-left px-5 py-3">Taxable Margin</th>
                                <th className="text-left px-5 py-3 border-l border-slate-100">CGST (9%)</th>
                                <th className="text-left px-5 py-3">SGST (9%)</th>
                                <th className="text-left px-5 py-3 border-l border-slate-100">Input Adj.</th>
                                <th className="text-left px-5 py-3 bg-blue-50/50">Net Payable</th>
                                <th className="text-left px-5 py-3 bg-blue-50/50">Status</th>
                                <th className="text-left px-5 py-3 bg-blue-50/50">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {taxMetrics.gstArray.length === 0 && (
                                <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">No finalized sales to deduce margin tax.</td></tr>
                            )}
                            {taxMetrics.gstArray.map(g => (
                                <tr key={g.monthKey} className={`border-b border-slate-50 last:border-0 transition-colors ${g.status === 'filed' ? 'bg-green-50/30' : 'hover:bg-slate-50/50'}`}>
                                    <td className="px-5 py-3.5 border-r border-slate-100">
                                        <p className="text-sm font-semibold text-primary">{g.month}</p>
                                        {g.filingRecord?.reference_no && (
                                            <p className="text-xs text-slate-400 mt-0.5">Ref: {g.filingRecord.reference_no}</p>
                                        )}
                                    </td>
                                    <td className="px-5 py-3.5 text-sm text-slate-700 font-bold">{g.taxableStr}</td>
                                    <td className="px-5 py-3.5 text-sm text-slate-600 border-l border-slate-100">{g.cgstStr}</td>
                                    <td className="px-5 py-3.5 text-sm text-slate-600">{g.sgstStr}</td>
                                    <td className="px-5 py-3.5 text-xs text-slate-500 italic border-l border-slate-100">{g.inputStr}</td>
                                    <td className="px-5 py-3.5 text-sm font-black text-primary bg-blue-50/10">{g.netStr}</td>
                                    <td className="px-5 py-3.5 bg-blue-50/10">
                                        <div>
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${statusColors[g.status]}`}>{g.status}</span>
                                            {g.filingRecord?.filed_by_name && (
                                                <p className="text-[10px] text-slate-400 mt-1">by {g.filingRecord.filed_by_name}</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 bg-blue-50/10">
                                        {g.status === 'filed' ? (
                                            <button onClick={() => handleUnmarkFiled(g.monthKey, g.month)} className="text-xs px-3 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors font-medium">
                                                Unmark
                                            </button>
                                        ) : (
                                            <button onClick={() => openFilingModal(g)} className="text-xs px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors font-bold flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">task_alt</span>
                                                Mark Filed
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                    <table className="w-full min-w-[800px]">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                                <th className="text-left px-5 py-3 border-r border-slate-100">Section Target</th>
                                <th className="text-left px-5 py-3">System Origin</th>
                                <th className="text-left px-5 py-3">Disbursement Volume</th>
                                <th className="text-left px-5 py-3 bg-red-50/50">TDS Liability</th>
                                <th className="text-left px-5 py-3">Deposit Terms</th>
                                <th className="text-left px-5 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {taxMetrics.tdsArray.length === 0 && (
                                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">No qualifying disbursements found for TDS processing.</td></tr>
                            )}
                            {taxMetrics.tdsArray.map(t => (
                                <tr key={t.section + t.desc} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-3.5 text-sm font-bold text-primary border-r border-slate-100">{t.section}</td>
                                    <td className="px-5 py-3.5 text-sm text-slate-600 font-medium">{t.desc}</td>
                                    <td className="px-5 py-3.5 text-sm text-slate-600">{t.amount}</td>
                                    <td className="px-5 py-3.5 text-sm font-bold text-red-600 bg-red-50/10">{t.tds}</td>
                                    <td className="px-5 py-3.5 text-xs text-slate-500">{t.depositDate}</td>
                                    <td className="px-5 py-3.5"><span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${statusColors[t.status]}`}>{t.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Mark as Filed Modal */}
            {filingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-green-600 px-6 py-5">
                            <h2 className="text-lg font-black text-white">Mark GST as Filed</h2>
                            <p className="text-green-100 text-sm mt-0.5">{filingModal.monthLabel} — Net Payable: {formatCurrency(filingModal.netPayable)}</p>
                        </div>
                        <form onSubmit={handleMarkFiled} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">GST Filing Reference No. (Optional)</label>
                                <input value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="e.g. ARN-123456" className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-green-500 transition-colors" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Notes (Optional)</label>
                                <textarea value={filingNotes} onChange={e => setFilingNotes(e.target.value)} rows={3} placeholder="Any additional notes about this filing…" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-green-500 transition-colors resize-none" />
                            </div>
                            <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-800">
                                <strong>This action will:</strong> Save the filing record to Supabase with the current timestamp and your name. The month will show as "Filed" across all sessions and users.
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setFilingModal(null)} className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm">Cancel</button>
                                <button type="submit" disabled={isFiling} className="flex-1 h-10 bg-green-600 text-white font-bold rounded-xl text-sm hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-base">task_alt</span>
                                    {isFiling ? 'Saving…' : 'Confirm Filing'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaxCompliance;
