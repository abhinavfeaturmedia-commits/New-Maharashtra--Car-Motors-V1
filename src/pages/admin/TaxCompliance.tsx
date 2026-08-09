import React, { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';

const statusColors: Record<string, string> = { Filed: 'bg-green-100 text-green-700', Due: 'bg-amber-100 text-amber-700', Overdue: 'bg-red-100 text-red-700', Deposited: 'bg-green-100 text-green-700', Pending: 'bg-amber-100 text-amber-700' };

const formatCurrency = (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`;

const TaxCompliance = () => {
    const { sales, inventory, expenses } = useData();
    const [tab, setTab] = useState<'gst' | 'tds'>('gst');

    const taxMetrics = useMemo(() => {
        // Build GST monthly groupings from active sales
        const monthGroups: Record<string, { taxable: number, cgst: number, sgst: number, net: number, monthSort: string }> = {};

        sales.forEach(s => {
            const date = new Date(s.sale_date);
            const monthStr = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // For sorting
            
            if (!monthGroups[monthStr]) {
                monthGroups[monthStr] = { taxable: 0, cgst: 0, sgst: 0, net: 0, monthSort: monthKey };
            }

            // Assume standard 18% GST calculation on margin (Standard for used cars in India)
            const car = inventory.find(c => c.id === s.inventory_id);
            const purchasePrice = car ? Number(car.price) || 0 : 0;
            const salePrice = Number(s.final_price) || 0;
            const margin = Math.max(0, salePrice - purchasePrice);

            // If margin is positive, calculate 18% GST (9% CGST, 9% SGST)
            const gstAlloc = margin * 0.18;
            const singleTax = gstAlloc / 2;

            monthGroups[monthStr].taxable += margin;
            monthGroups[monthStr].cgst += singleTax;
            monthGroups[monthStr].sgst += singleTax;
            monthGroups[monthStr].net += gstAlloc;
        });

        const gstArray = Object.keys(monthGroups).map(key => {
            const data = monthGroups[key];
            const now = new Date();
            const dateComponents = data.monthSort.split('-');
            const monthDate = new Date(parseInt(dateComponents[0]), parseInt(dateComponents[1]) - 1, 1);
            
            // Assume due logic based on month completion
            const isCompletedMonth = monthDate.getMonth() !== now.getMonth() || monthDate.getFullYear() !== now.getFullYear();

            return {
                month: key,
                taxableStr: formatCurrency(data.taxable),
                cgstStr: formatCurrency(data.cgst),
                sgstStr: formatCurrency(data.sgst),
                inputStr: 'Calculated internally',
                netStr: formatCurrency(data.net),
                rawNet: data.net,
                rawSort: data.monthSort,
                status: isCompletedMonth ? 'Filed' : 'Due'
            };
        }).sort((a, b) => b.rawSort.localeCompare(a.rawSort));

        // Simulated TDS based on expenses
        const contractorExpenses = expenses.filter(e => e.category === 'Detailing' || e.category === 'Repair')
            .reduce((sum, e) => sum + Number(e.amount), 0);
        
        let tdsArray: any[] = [];
        if (contractorExpenses > 0) {
            tdsArray.push({
                section: '194C', desc: 'Contractor Payments (Repairs/Detailing)', 
                amount: formatCurrency(contractorExpenses), 
                tds: formatCurrency(contractorExpenses * 0.02), // 2% TDS mock
                depositDate: 'Dependent on billing cycle', 
                status: 'Pending'
            });
        }

        const totalPayableThisMonth = gstArray.filter(g => g.status === 'Due').reduce((sum, g) => sum + g.rawNet, 0);

        return {
            gstArray,
            tdsArray,
            totalPayableThisMonth
        };
    }, [sales, inventory, expenses]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Tax & Compliance</h1>
                    <p className="text-slate-500 text-sm">Automated live GST calculations based on true vehicle sale margins.</p>
                </div>
                <div className="flex gap-2">
                    <span className="py-2 px-3 text-[10px] font-bold tracking-wider uppercase text-blue-600 bg-blue-100 rounded-lg shadow-sm">DYNAMIC COMPLIANCE</span>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Pending GST Payable', val: formatCurrency(taxMetrics.totalPayableThisMonth), icon: 'receipt', color: 'bg-blue-500/10 text-blue-600' },
                    { label: 'Automated Accounting', val: 'Active', icon: 'credit_score', color: 'bg-green-500/10 text-green-600' },
                    { label: 'TDS Pending', val: 'Check Detail', icon: 'pending_actions', color: 'bg-amber-500/10 text-amber-600' },
                    { label: 'Next Auto-Filing', val: 'End of Month', icon: 'event', color: 'bg-red-500/10 text-red-600' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)]">
                        <div className={`size-9 rounded-xl flex items-center justify-center ${s.color} mb-2`}><span className="material-symbols-outlined text-lg">{s.icon}</span></div>
                        <p className="text-xl font-black text-primary font-display">{s.val}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="flex gap-1 border-b border-slate-200">
                <button onClick={() => setTab('gst')} className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${tab === 'gst' ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>Live Margin GST Summary</button>
                <button onClick={() => setTab('tds')} className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${tab === 'tds' ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>TDS Extractor</button>
            </div>

            {tab === 'gst' ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                    <table className="w-full min-w-[800px]">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                                <th className="text-left px-5 py-3 rounded-tl-xl border-r border-slate-100">Month Grouping</th>
                                <th className="text-left px-5 py-3">Aggregated Margin (Taxable)</th>
                                <th className="text-left px-5 py-3 border-l text-slate-500 border-slate-100">CGST (9%)</th>
                                <th className="text-left px-5 py-3 text-slate-500">SGST (9%)</th>
                                <th className="text-left px-5 py-3 border-l border-slate-100">Input Adjustment</th>
                                <th className="text-left px-5 py-3 bg-blue-50/50">Net Payable Basis</th>
                                <th className="text-left px-5 py-3 bg-blue-50/50">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {taxMetrics.gstArray.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">No finalized sales to deduce margin tax.</td></tr>}
                            {taxMetrics.gstArray.map(g => (
                                <tr key={g.month} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-3.5 text-sm font-semibold text-primary border-r border-slate-100">{g.month}</td>
                                    <td className="px-5 py-3.5 text-sm text-slate-700 font-bold">{g.taxableStr}</td>
                                    <td className="px-5 py-3.5 text-sm text-slate-600 border-l border-slate-100">{g.cgstStr}</td>
                                    <td className="px-5 py-3.5 text-sm text-slate-600">{g.sgstStr}</td>
                                    <td className="px-5 py-3.5 text-xs text-slate-500 italic border-l border-slate-100">{g.inputStr}</td>
                                    <td className="px-5 py-3.5 text-sm font-black text-primary bg-blue-50/10">{g.netStr}</td>
                                    <td className="px-5 py-3.5 bg-blue-50/10"><span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${statusColors[g.status]}`}>{g.status}</span></td>
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
                                <th className="text-left px-5 py-3 rounded-tl-xl border-r border-slate-100">Section Target</th>
                                <th className="text-left px-5 py-3">System Origin</th>
                                <th className="text-left px-5 py-3">Disbursement Volume</th>
                                <th className="text-left px-5 py-3 bg-red-50/50">TDS Liability</th>
                                <th className="text-left px-5 py-3">Deposit Terms</th>
                                <th className="text-left px-5 py-3">Status Block</th>
                            </tr>
                        </thead>
                        <tbody>
                            {taxMetrics.tdsArray.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">No qualifying disbursements found for TDS processing.</td></tr>}
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
        </div>
    );
};

export default TaxCompliance;
