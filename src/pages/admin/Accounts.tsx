import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';

const statusColors: Record<string, string> = { Completed: 'bg-green-100 text-green-700', Pending: 'bg-amber-100 text-amber-700' };
const TABS = ['All', 'Income', 'Expense', 'Pending'];

const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;
const formatCurrencyLakhs = (val: number) => `₹${(val / 100000).toFixed(2)}L`;

const Accounts = () => {
    const { sales, expenses, inventory } = useData();
    const navigate = useNavigate();
    const [tab, setTab] = useState('All');

    const TRANSACTIONS = useMemo(() => {
        const arr: any[] = [];
        
        // 1. Income from Sales
        // Link → the sold car's admin inventory edit page (car still exists in inventory as "sold")
        sales.forEach(s => {
            if (!s.final_price) return;
            arr.push({
                id: `sale_${s.id}`,
                desc: `Sale — ${s.car?.make} ${s.car?.model} to ${s.customer?.full_name}`,
                type: 'Income',
                amountNum: Number(s.final_price),
                amountStr: `+${formatCurrency(s.final_price)}`,
                date: new Date(s.sale_date).toLocaleDateString('en-IN'),
                rawDate: new Date(s.sale_date).getTime(),
                mode: 'Bank Transfer',
                status: 'Completed',
                // Navigate to the car's admin edit/view page so the admin can inspect it
                link: s.car_id ? `/admin/inventory/${s.car_id}/edit` : null,
            });
        });

        // 2. Expenses from Vehicle Expenses
        // Link → the related car's admin inventory page so the admin can see the full car record
        expenses.forEach(e => {
            arr.push({
                id: `exp_${e.id}`,
                desc: `${e.category} — ${e.car?.make} ${e.car?.model} (${e.description || 'Routine'})`,
                type: 'Expense',
                amountNum: Number(e.amount),
                amountStr: `-${formatCurrency(e.amount)}`,
                date: new Date(e.expense_date).toLocaleDateString('en-IN'),
                rawDate: new Date(e.expense_date).getTime(),
                mode: 'Account Transfer',
                status: 'Completed',
                // Navigate to the car the expense was logged against
                link: e.car_id ? `/admin/inventory/${e.car_id}/edit` : null,
            });
        });

        // 3. Capital Purchases — ONLY cars physically purchased by New Maharashtra Motors.
        //    - source === 'purchased'  → we bought it, so the price is a capital outflow ✓
        //    - source === 'dealer'     → dealer's car listed on our platform (no purchase) ✗
        //    - source === 'consignment'→ customer's car we're selling on their behalf (no purchase) ✗
        inventory
            .filter((i: any) => i.source === 'purchased' || (!i.source && !i.dealer_id && !i.consignment_owner_name))
            .forEach((i: any) => {
                if (!i.price) return;
                arr.push({
                    id: `inv_purc_${i.id}`,
                    desc: `Capital Purchase — ${i.year} ${i.make} ${i.model}`,
                    type: 'Expense',
                    amountNum: Number(i.price),
                    amountStr: `-${formatCurrency(i.price)}`,
                    date: new Date(i.created_at).toLocaleDateString('en-IN'),
                    rawDate: new Date(i.created_at).getTime(),
                    mode: 'Own Purchase',
                    status: 'Completed',
                    // Navigate directly to this car's admin inventory page
                    link: `/admin/inventory/${i.id}/edit`,
                });
            });

        // Sort descending by date
        return arr.sort((a, b) => b.rawDate - a.rawDate);
    }, [sales, expenses, inventory]);

    const filtered = tab === 'All' 
        ? TRANSACTIONS 
        : tab === 'Pending' 
            ? TRANSACTIONS.filter(t => t.status === 'Pending') 
            : TRANSACTIONS.filter(t => t.type === tab);

    // Calculate Summary
    const totalIncome = TRANSACTIONS.filter(t => t.type === 'Income').reduce((s, t) => s + t.amountNum, 0);
    const totalExpense = TRANSACTIONS.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amountNum, 0);
    const netBalance = totalIncome - totalExpense;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Accounts & Payments</h1>
                    <p className="text-slate-500 text-sm">System-generated global operating ledger derived from CRM activity.</p>
                </div>
                <div className="flex gap-2">
                    <span className="py-2 px-3 text-[10px] font-bold tracking-wider uppercase text-green-600 bg-green-100 rounded-lg">SYNCED LEDGER</span>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Gross Verified Income', val: formatCurrencyLakhs(totalIncome), icon: 'trending_up', color: 'bg-green-500/10 text-green-600' },
                    { label: 'Outgoings & Capital', val: formatCurrencyLakhs(totalExpense), icon: 'trending_down', color: 'bg-red-500/10 text-red-600' },
                    { label: 'Net Operative Cashflow', val: formatCurrencyLakhs(netBalance), icon: 'account_balance', color: netBalance >= 0 ? 'bg-blue-500/10 text-blue-600' : 'bg-red-500/10 text-red-600' },
                    { label: 'Pending Collections', val: '₹0.00', icon: 'pending', color: 'bg-amber-500/10 text-amber-600' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)]">
                        <div className={`size-9 rounded-xl flex items-center justify-center ${s.color} mb-2`}><span className="material-symbols-outlined text-lg">{s.icon}</span></div>
                        <p className="text-xl font-black text-primary font-display">{s.val}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="flex gap-1 border-b border-slate-200">
                {TABS.map(t => (
                    <button key={t} onClick={() => setTab(t)} className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${tab === t ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>{t}</button>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-x-auto">
                <table className="w-full min-w-[700px]">
                    <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                            <th className="text-left px-5 py-3">Description</th>
                            <th className="text-left px-5 py-3">Vector</th>
                            <th className="text-left px-5 py-3">Amount</th>
                            <th className="text-left px-5 py-3">Date</th>
                            <th className="text-left px-5 py-3">Memo</th>
                            <th className="text-left px-5 py-3">Status</th>
                            <th className="text-left px-5 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">No transactions recorded for this filter.</td></tr>}
                        {filtered.map(t => (
                            <tr
                                key={t.id}
                                onClick={() => t.link && navigate(t.link)}
                                className={`border-b border-slate-50 last:border-0 transition-colors ${t.link ? 'hover:bg-primary/5 cursor-pointer group' : 'hover:bg-slate-50/50'}`}
                                title={t.link ? 'Click to view car details' : undefined}
                            >
                                <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-primary">{t.desc}</span>
                                        {t.link && (
                                            <span className="material-symbols-outlined text-[14px] text-slate-300 group-hover:text-primary transition-colors shrink-0">open_in_new</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-5 py-3.5"><span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${t.type === 'Income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.type}</span></td>
                                <td className={`px-5 py-3.5 text-sm font-bold ${t.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>{t.amountStr}</td>
                                <td className="px-5 py-3.5 text-sm text-slate-500">{t.date}</td>
                                <td className="px-5 py-3.5 text-sm text-slate-500">{t.mode}</td>
                                <td className="px-5 py-3.5"><span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${statusColors[t.status]}`}>{t.status}</span></td>
                                <td className="px-5 py-3.5">
                                    {t.link && (
                                        <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors text-lg">chevron_right</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Accounts;
