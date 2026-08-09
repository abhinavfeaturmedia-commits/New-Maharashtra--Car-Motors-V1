import React, { useState, useMemo } from 'react';
import { TrendingUp, Plus } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';

const catColors: Record<string, string> = { 
    Repair: 'bg-red-100 text-red-700', 
    Detailing: 'bg-blue-100 text-blue-700', 
    Parts: 'bg-purple-100 text-purple-700', 
    Registration: 'bg-green-100 text-green-700',
    Marketing: 'bg-pink-100 text-pink-700',
    Miscellaneous: 'bg-slate-100 text-slate-700'
};

const VehicleExpenses = () => {
    const { expenses, inventory, sales, refreshData } = useData();
    const [tab, setTab] = useState<'expenses' | 'profit'>('expenses');
    
    const [showAdd, setShowAdd] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ car_id: '', category: 'Repair', amount: '', description: '' });

    const handleSaveExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                car_id: form.car_id === 'general' ? null : form.car_id,
                category: form.category,
                amount: Number(form.amount),
                description: form.description
            };
            let queryError;
            
            if (editId) {
                const { error } = await supabase.from('vehicle_expenses').update(payload).eq('id', editId);
                queryError = error;
            } else {
                const { error } = await supabase.from('vehicle_expenses').insert(payload);
                queryError = error;
            }

            if (queryError) throw queryError;
            setForm({ car_id: '', category: 'Repair', amount: '', description: '' });
            setEditId(null);
            setShowAdd(false);
            refreshData();
        } catch (error: any) {
            console.error("Expense insert error:", error);
            alert('Failed to save expense: ' + (error.message || 'Unknown error'));
        }
    };

    const handleEditClick = (e: any) => {
        setForm({
            car_id: e.car_id ? e.car_id : 'general',
            category: e.category || 'Repair',
            amount: e.amount.toString(),
            description: e.description || ''
        });
        setEditId(e.id);
        setShowAdd(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteExpense = async (id: string) => {
        if (!confirm('Are you sure you want to delete this expense log?')) return;
        try {
            const { error } = await supabase.from('vehicle_expenses').delete().eq('id', id);
            if (error) throw error;
            refreshData();
        } catch (error: any) {
            console.error("Delete expense error:", error);
            alert('Failed to delete expense: ' + (error.message || 'Unknown error'));
        }
    };

    // Derived Financial Metrics
    const profitData = useMemo(() => {
        const soldCars = inventory.filter(c => c.status === 'sold' || c.status === 'archived');
        
        let validProfits = 0;
        let totalProfit = 0;

        const ledger = soldCars.map(car => {
            const saleRec = sales.find(s => s.inventory_id === car.id);
            const sellingPrice = saleRec ? Number(saleRec.final_price) : 0;
            
            // Assume the standard 'price' column in inventory is what the dealer paid for it initially.
            const purchasePrice = Number(car.price);
            
            const carExpenses = expenses.filter(e => e.car_id === car.id)
                                        .reduce((acc, curr) => acc + Number(curr.amount), 0);
            
            const netProfit = sellingPrice - (purchasePrice + carExpenses);
            
            // Margin = (Net Profit / Sale Price) * 100
            const margin = sellingPrice > 0 ? ((netProfit / sellingPrice) * 100).toFixed(1) : '0.0';

            if (sellingPrice > 0) {
                validProfits++;
                totalProfit += netProfit;
            }

            return {
                id: car.id,
                vehicle: `${car.year} ${car.make} ${car.model}`,
                purchase: purchasePrice,
                expenses: carExpenses,
                selling: sellingPrice,
                profit: netProfit,
                margin
            };
        }).filter(item => item.selling > 0); // Only show cars that have been formally sold via CRM

        const totalExpenses = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
        const repairs = expenses.filter(e => e.category === 'Repair').reduce((acc, curr) => acc + Number(curr.amount), 0);
        const detailing = expenses.filter(e => e.category === 'Detailing').reduce((acc, curr) => acc + Number(curr.amount), 0);

        return {
            ledger: ledger.sort((a, b) => b.profit - a.profit),
            totalExpenses,
            repairs,
            detailing,
            avgProfit: validProfits > 0 ? (totalProfit / validProfits) : 0
        };
    }, [inventory, sales, expenses]);

    const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Vehicle Finance & Operations</h1>
                    <p className="text-slate-500 text-sm">Track per-vehicle costs, disbursements, and exact CRM profit margins.</p>
                </div>
                <button onClick={() => { setShowAdd(!showAdd); setEditId(null); setForm({ car_id: '', category: 'Repair', amount: '', description: '' }); }} className="h-10 px-5 bg-accent text-primary font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-accent-hover transition-colors">
                    <Plus size={18} /> {showAdd ? 'Cancel' : 'Add Expense'}
                </button>
            </div>

            {showAdd && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm mb-6">
                    <h2 className="text-primary font-bold mb-4 font-display">{editId ? 'Edit Expense Log' : 'Log New Expense'}</h2>
                    <form onSubmit={handleSaveExpense} className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 mb-1">Expense Target</label>
                            <select required value={form.car_id} onChange={e => setForm({...form, car_id: e.target.value})} className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm">
                                <option value="">-- Choose Target --</option>
                                <option value="general" className="font-bold text-primary">🏢 General Business (Not single car)</option>
                                <optgroup label="Inventory Vehicles">
                                    {inventory.map(c => <option key={c.id} value={c.id}>{c.year} {c.make} {c.model} ({c.license_plate})</option>)}
                                </optgroup>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Category</label>
                            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm">
                                {Object.keys(catColors).map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Amount (₹)</label>
                            <input required type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm" placeholder="e.g. 5000" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-white mb-1">Submit</label>
                            <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg hover:bg-primary-light">{editId ? 'Update Log' : 'Save Log'}</button>
                        </div>
                        <div className="col-span-full">
                            <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                            <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm" placeholder="e.g. Replaced AC Compressor" />
                        </div>
                    </form>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Capital Expensed', val: formatCurrency(profitData.totalExpenses), icon: 'receipt_long', color: 'bg-red-500/10 text-red-600' },
                    { label: 'Total Repairs', val: formatCurrency(profitData.repairs), icon: 'build', color: 'bg-amber-500/10 text-amber-600' },
                    { label: 'Total Detailing', val: formatCurrency(profitData.detailing), icon: 'auto_awesome', color: 'bg-blue-500/10 text-blue-600' },
                    { label: 'Avg CRM Margin/Car', val: formatCurrency(profitData.avgProfit), icon: 'trending_up', color: 'bg-green-500/10 text-green-600' },
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
                <button onClick={() => setTab('expenses')} className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${tab === 'expenses' ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent'}`}>Active Disbursement Log</button>
                <button onClick={() => setTab('profit')} className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${tab === 'profit' ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent'}`}>Live True P&L (Sold Cars)</button>
            </div>

            {tab === 'expenses' ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                                <th className="text-left px-5 py-3 rounded-tl-xl border-r border-slate-200">Vehicle Lineaage</th>
                                <th className="text-left px-5 py-3">Category</th>
                                <th className="text-left px-5 py-3">Memo</th>
                                <th className="text-left px-5 py-3">Amount</th>
                                <th className="text-left px-5 py-3">Date Originated</th>
                                <th className="text-right px-5 py-3 border-l border-slate-200">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.length === 0 && <tr><td colSpan={6} className="text-left px-5 py-8 text-slate-400">No expenses logged.</td></tr>}
                            {expenses.map(e => (
                                <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-5 py-3.5 border-r border-slate-100">
                                        {e.car ? (
                                            <span className="text-sm font-semibold text-primary">{e.car.make} {e.car.model} ({e.car.license_plate || 'No plate'})</span>
                                        ) : (
                                            <span className="text-sm font-bold text-slate-500 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">domain</span> General Business</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3.5"><span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${catColors[e.category] || catColors['Miscellaneous']}`}>{e.category}</span></td>
                                    <td className="px-5 py-3.5 text-sm text-slate-600 truncate max-w-48" title={e.description}>{e.description || '—'}</td>
                                    <td className="px-5 py-3.5 text-sm font-bold text-red-600">{formatCurrency(e.amount)}</td>
                                    <td className="px-5 py-3.5 text-sm text-slate-500">{new Date(e.expense_date).toLocaleDateString()}</td>
                                    <td className="px-5 py-3.5 text-right border-l border-slate-100">
                                        <div className="flex gap-2 justify-end md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEditClick(e)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded-lg transition-colors"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                                            <button onClick={() => handleDeleteExpense(e.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-lg transition-colors"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                                <th className="text-left px-5 py-3 rounded-tl-xl border-r border-slate-200">Vehicle Reference</th>
                                <th className="text-left px-5 py-3">Purchase Basis</th>
                                <th className="text-left px-5 py-3 border-r border-slate-200">Logged Maintenance</th>
                                <th className="text-left px-5 py-3 bg-green-50">CRM Final Selling</th>
                                <th className="text-left px-5 py-3 bg-green-50/50">Net PnL</th>
                                <th className="text-left px-5 py-3">Gross Margin</th>
                            </tr>
                        </thead>
                        <tbody>
                            {profitData.ledger.length === 0 && <tr><td colSpan={6} className="text-left px-5 py-8 text-slate-400">No closed deals available to calculate profit margin.</td></tr>}
                            {profitData.ledger.map(p => (
                                <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-3.5 text-sm font-semibold text-primary border-r border-slate-100">{p.vehicle}</td>
                                    <td className="px-5 py-3.5 text-sm text-slate-600">{formatCurrency(p.purchase)}</td>
                                    <td className="px-5 py-3.5 text-sm text-red-600 font-medium border-r border-slate-100">- {formatCurrency(p.expenses)}</td>
                                    <td className="px-5 py-3.5 text-sm text-slate-800 font-bold bg-green-50/30">{formatCurrency(p.selling)}</td>
                                    <td className="px-5 py-3.5 text-sm font-bold text-green-600 bg-green-50/10">+{formatCurrency(p.profit)}</td>
                                    <td className="px-5 py-3.5"><span className="text-xs font-bold text-green-600 flex items-center gap-0.5"><TrendingUp size={12} />{p.margin}%</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default VehicleExpenses;
