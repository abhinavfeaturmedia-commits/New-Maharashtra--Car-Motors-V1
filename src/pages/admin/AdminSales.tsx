import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Plus, X, User } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/utils';
import HighlightText from '../../components/ui/HighlightText';

// ─── Sale Type Config ──────────────────────────────────────────────────────────
const saleTypeBadge: Record<string, { label: string; cls: string }> = {
    purchased:    { label: '🏠 Purchased',   cls: 'bg-blue-100 text-blue-700' },
    consignment:  { label: '🅿️ Park & Sell', cls: 'bg-purple-100 text-purple-700' },
    dealer:       { label: '🏪 Dealer',       cls: 'bg-amber-100 text-amber-700' },
};

const AdminSales = () => {
    const { sales, inventory, loading, refreshData } = useData();
    const { user } = useAuth();

    // ─── Filters ──────────────────────────────────────────────────────────────
    const [period, setPeriod]     = useState('All Time');
    const [typeFilter, setType]   = useState('All');
    const [search, setSearch]     = useState('');
    const [detail, setDetail]     = useState<any>(null);

    // ─── Log New Sale Modal ───────────────────────────────────────────────────
    const [showSaleForm, setShowSaleForm] = useState(false);
    const [saleForm, setSaleForm] = useState({
        inventory_id: '',
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        sale_price: '',
        sale_type: 'purchased',
        profit: '',
        purchase_cost_snapshot: '',
        notes: '',
        sale_date: new Date().toISOString().split('T')[0],
    });
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const availableInventory = inventory.filter((i: any) => i.status === 'available' || i.status === 'reserved');

    const handleLogSale = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!saleForm.inventory_id || !saleForm.customer_name || !saleForm.sale_price) return;
        setIsSaving(true);
        try {
            const selectedCar = inventory.find((i: any) => i.id === saleForm.inventory_id);
            const salePrice = Number(saleForm.sale_price);

            // 1. Customer resolution (find or create)
            let customerId: string | null = null;
            if (saleForm.customer_phone) {
                const { data: existingCust } = await supabase
                    .from('customers')
                    .select('id')
                    .eq('phone', saleForm.customer_phone)
                    .maybeSingle();

                if (existingCust) {
                    customerId = existingCust.id;
                } else {
                    const { data: newCust } = await supabase
                        .from('customers')
                        .insert({
                            full_name: saleForm.customer_name,
                            phone: saleForm.customer_phone,
                            email: saleForm.customer_email || null,
                        })
                        .select('id')
                        .single();
                    if (newCust) customerId = newCust.id;
                }
            }

            // 2. Insert sale record
            const salePayload = {
                customer_id: customerId,
                inventory_id: saleForm.inventory_id,
                car_id: saleForm.inventory_id,
                customer_name: saleForm.customer_name,
                customer_phone: saleForm.customer_phone,
                customer_email: saleForm.customer_email || null,
                sale_price: salePrice,
                final_price: salePrice,
                sale_type: saleForm.sale_type,
                profit: saleForm.profit ? Number(saleForm.profit) : null,
                purchase_cost_snapshot: saleForm.purchase_cost_snapshot ? Number(saleForm.purchase_cost_snapshot) : (selectedCar?.purchase_cost ?? null),
                notes: saleForm.notes || null,
                sale_date: saleForm.sale_date,
                sold_by: user?.id ?? null,
                status: 'completed',
                payment_status: 'paid',
            };

            const { data: saleData, error: saleError } = await supabase.from('sales').insert(salePayload).select('id').single();
            if (saleError) throw saleError;

            // 3. Insert customer deal if customerId exists
            if (customerId) {
                try {
                    await supabase.from('customer_deals').insert({
                        customer_id: customerId,
                        inventory_id: saleForm.inventory_id,
                        sale_id: saleData?.id || null,
                        deal_type: saleForm.sale_type === 'consignment' ? 'consignment' : 'purchase',
                        deal_status: 'completed',
                        deal_date: saleForm.sale_date,
                        handover_date: saleForm.sale_date,
                        total_amount: salePrice,
                        advance_paid: salePrice,
                        balance_due: 0,
                        payment_mode: 'Paid',
                        notes: saleForm.notes || `Sale recorded for ${selectedCar ? `${selectedCar.make} ${selectedCar.model}` : 'vehicle'}`,
                        created_by: user?.id ?? null,
                    });
                } catch (dErr) {
                    console.warn('Customer deal auto-create error:', dErr);
                }

                try {
                    await supabase.from('customer_notes').insert({
                        customer_id: customerId,
                        note_type: 'general',
                        content: `🎉 Vehicle Purchased: ${selectedCar ? `${selectedCar.year || ''} ${selectedCar.make} ${selectedCar.model}` : 'Car'} for ₹${salePrice.toLocaleString('en-IN')}.`,
                        created_by: user?.id ?? null,
                    });
                } catch (nErr) {
                    console.warn('Customer note auto-create error:', nErr);
                }
            }

            // 4. Audit Log
            try {
                await supabase.from('audit_logs').insert({
                    user_id: user?.id ?? null,
                    action: 'Sale Logged',
                    target_type: 'Customer',
                    target_name: saleForm.customer_name,
                    details: `Sale logged manually for ${selectedCar ? `${selectedCar.make} ${selectedCar.model}` : 'vehicle'}. Amount: ₹${salePrice.toLocaleString('en-IN')}`,
                });
            } catch (aErr) {
                console.warn('Audit log error:', aErr);
            }

            // 5. Mark inventory as sold
            const { error: invError } = await supabase
                .from('inventory')
                .update({ status: 'sold' })
                .eq('id', saleForm.inventory_id);
            if (invError) console.error('Inventory status update error:', invError);

            showToast(`Sale logged for ${saleForm.customer_name} ✓`);
            setShowSaleForm(false);
            setSaleForm({
                inventory_id: '', customer_name: '', customer_phone: '', customer_email: '',
                sale_price: '', sale_type: 'purchased', profit: '', purchase_cost_snapshot: '',
                notes: '', sale_date: new Date().toISOString().split('T')[0],
            });
            refreshData();
        } catch (err: any) {
            showToast(err.message || 'Failed to log sale', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Auto-fill purchase cost when car is selected
    const handleCarSelect = (carId: string) => {
        const car = inventory.find((i: any) => i.id === carId);
        setSaleForm(f => ({
            ...f,
            inventory_id: carId,
            purchase_cost_snapshot: car?.purchase_cost ? String(car.purchase_cost) : '',
        }));
    };

    // ─── Filter Logic ─────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        const now = new Date();
        let start: Date | null = null;
        if (period === 'This Month')   start = new Date(now.getFullYear(), now.getMonth(), 1);
        if (period === 'This Quarter') start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        if (period === 'This Year')    start = new Date(now.getFullYear(), 0, 1);

        return sales.filter(s => {
            if (start && new Date(s.sale_date) < start) return false;
            if (typeFilter !== 'All' && s.sale_type !== typeFilter) return false;
            if (search) {
                const q = search.toLowerCase();
                const carName = `${s.car?.make || ''} ${s.car?.model || ''}`.toLowerCase();
                const custName = (s.customer?.full_name || '').toLowerCase();
                if (!carName.includes(q) && !custName.includes(q)) return false;
            }
            return true;
        });
    }, [sales, period, typeFilter, search]);

    // ─── Aggregate Stats ──────────────────────────────────────────────────────
    const totalRevenue       = filtered.reduce((a, s) => a + (Number(s.sale_price ?? s.final_price) || 0), 0);
    const totalNetIncome     = filtered.reduce((a, s) => a + (Number(s.profit) || 0), 0);
    const consignmentFees    = filtered.filter(s => s.sale_type === 'consignment').reduce((a, s) => a + (Number(s.consignment_fee_collected) || 0), 0);
    const avgDealSize        = filtered.length > 0 ? Math.round(totalRevenue / filtered.length) : 0;

    // ─── CSV Export ───────────────────────────────────────────────────────────
    const exportCSV = () => {
        const rows = [
            ['Date', 'Vehicle', 'Customer', 'Phone', 'Sale Type', 'Final Price', 'Profit/Fee', 'Notes'],
            ...filtered.map(s => [
                s.sale_date,
                `${s.car?.year || ''} ${s.car?.make || ''} ${s.car?.model || ''}`.trim(),
                s.customer?.full_name || s.customer_name || '',
                s.customer?.phone || s.customer_phone || '',
                s.sale_type || 'purchased',
                s.sale_price ?? s.final_price ?? '',
                s.profit || '',
                (s.notes || '').replace(/,/g, ';'),
            ])
        ];
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'nmm-sales.csv'; a.click();
    };

    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

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
                    <h1 className="text-2xl font-black text-primary font-display">Sales Ledger</h1>
                    <p className="text-slate-500 text-sm">Full financial record of all vehicle sales.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowSaleForm(true)} className="h-10 px-4 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-md shadow-primary/20">
                        <Plus size={15} /> Log New Sale
                    </button>
                    <button onClick={exportCSV} className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm flex items-center gap-2 transition-colors">
                        <span className="material-symbols-outlined text-lg">download</span> Export CSV
                    </button>
                    <button onClick={refreshData} className="h-10 w-10 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors">
                        <span className="material-symbols-outlined text-lg">refresh</span>
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Sales',       value: loading ? '...' : String(filtered.length),          icon: 'sell',            color: 'bg-green-500/10 text-green-600' },
                    { label: 'Gross Revenue',     value: loading ? '...' : formatCurrency(totalRevenue),     icon: 'currency_rupee',  color: 'bg-blue-500/10 text-blue-600' },
                    { label: 'Net Income',        value: loading ? '...' : formatCurrency(totalNetIncome),   icon: 'trending_up',     color: 'bg-emerald-500/10 text-emerald-600' },
                    { label: 'Park & Sell Fees',  value: loading ? '...' : formatCurrency(consignmentFees),  icon: 'handshake',       color: 'bg-purple-500/10 text-purple-600' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                        <div className="flex items-center justify-between mb-3">
                            <div className={`size-10 rounded-xl flex items-center justify-center ${s.color}`}>
                                <span className="material-symbols-outlined text-lg">{s.icon}</span>
                            </div>
                            <span className="text-[10px] font-bold text-green-600 flex items-center gap-0.5">
                                <TrendingUp size={12} />Live
                            </span>
                        </div>
                        <p className="text-2xl font-black text-primary font-display">{s.value}</p>
                        <p className="text-xs text-slate-400 font-medium">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10 flex-1 min-w-[180px]">
                    <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by car or customer…" className="bg-transparent text-sm text-primary outline-none w-full" />
                    {search && <button onClick={() => setSearch('')} className="material-symbols-outlined text-slate-300 text-base hover:text-slate-500">close</button>}
                </div>
                <select value={period} onChange={e => setPeriod(e.target.value)} className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none">
                    <option>All Time</option>
                    <option>This Month</option>
                    <option>This Quarter</option>
                    <option>This Year</option>
                </select>
                <select value={typeFilter} onChange={e => setType(e.target.value)} className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none">
                    <option value="All">All Types</option>
                    <option value="purchased">🏠 Purchased</option>
                    <option value="consignment">🅿️ Park & Sell</option>
                    <option value="dealer">🏪 Dealer</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[780px]">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                <th className="text-left px-5 py-3">Vehicle</th>
                                <th className="text-left px-5 py-3">Customer</th>
                                <th className="text-left px-5 py-3">Type</th>
                                <th className="text-right px-5 py-3">Sale Price</th>
                                <th className="text-right px-5 py-3">Net Profit / Fee</th>
                                <th className="text-left px-5 py-3">Date</th>
                                <th className="text-left px-5 py-3">Info</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className="text-center py-10 text-slate-400">Loading sales data…</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center">
                                        <span className="material-symbols-outlined text-4xl text-slate-200 mb-3 block">sell</span>
                                        <p className="text-slate-400 font-medium">No sales match your filters</p>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(sale => {
                                    const badge = saleTypeBadge[sale.sale_type || 'purchased'] || saleTypeBadge.purchased;
                                    const profit = Number(sale.profit) || 0;
                                    const isConsignment = sale.sale_type === 'consignment';
                                    return (
                                        <tr key={sale.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setDetail(sale)}>
                                            <td className="px-5 py-3.5">
                                                <div>
                                                    <p className="text-sm font-semibold text-primary">
                                                        {sale.car?.year ? `${sale.car.year} ` : ''}
                                                        <HighlightText text={sale.car?.make || ''} highlight={search} />{' '}
                                                        <HighlightText text={sale.car?.model || (sale.car?.make ? '' : 'Vehicle Record')} highlight={search} />
                                                    </p>
                                                    <p className="text-xs text-slate-400">{sale.car?.registration_no || sale.car?.transmission || ''}</p>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <p className="text-sm font-semibold text-primary"><HighlightText text={sale.customer?.full_name || sale.customer_name || 'Customer Record'} highlight={search} /></p>
                                                <p className="text-xs text-slate-400">{sale.customer?.phone || sale.customer_phone || ''}</p>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <span className="text-sm font-bold text-green-600">{formatCurrency(sale.sale_price ?? sale.final_price ?? 0)}</span>
                                                {isConsignment && <p className="text-[10px] text-slate-400">pass-through</p>}
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <span className={`text-sm font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {formatCurrency(profit)}
                                                </span>
                                                {isConsignment && <p className="text-[10px] text-slate-400">fee only</p>}
                                            </td>
                                            <td className="px-5 py-3.5 text-sm text-slate-500 whitespace-nowrap">{formatDate(sale.sale_date)}</td>
                                            <td className="px-5 py-3.5">
                                                <button className="p-1.5 hover:bg-slate-100 rounded-lg" title="View Details">
                                                    <span className="material-symbols-outlined text-slate-400 text-base">open_in_new</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {detail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDetail(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-primary to-primary-light px-6 pt-6 pb-8 rounded-t-3xl relative">
                            <button onClick={() => setDetail(null)} className="absolute top-4 right-4 size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-lg">close</span>
                            </button>
                            <h2 className="text-xl font-black text-white">{detail.car?.year} {detail.car?.make} {detail.car?.model}</h2>
                            <p className="text-white/70 text-sm mt-1">Sale on {formatDate(detail.sale_date)}</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Customer', value: detail.customer?.full_name || detail.customer_name || '—' },
                                    { label: 'Phone', value: detail.customer?.phone || detail.customer_phone || '—' },
                                    { label: 'Sale Type', value: (saleTypeBadge[detail.sale_type || 'purchased']?.label || '—') },
                                    { label: 'Sale Price', value: formatCurrency(detail.sale_price ?? detail.final_price ?? 0) },
                                    { label: 'Net Income', value: formatCurrency(detail.profit || 0) },
                                    { label: 'Purchase Cost', value: formatCurrency(detail.purchase_cost_snapshot || 0) },
                                    ...(detail.sale_type === 'consignment' ? [{ label: 'Park & Sell Fee', value: formatCurrency(detail.consignment_fee_collected || 0) }] : []),
                                ].map(item => (
                                    <div key={item.label} className="bg-slate-50 rounded-xl px-3.5 py-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{item.label}</p>
                                        <p className="text-sm font-semibold text-primary mt-0.5">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                            {detail.notes && (
                                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                                    <p className="text-xs font-bold text-amber-600 uppercase mb-1">Notes</p>
                                    <p className="text-sm text-amber-900 leading-relaxed">{detail.notes}</p>
                                </div>
                            )}

                            {(detail.customer_id || detail.customer?.id) && (
                                <div className="pt-2">
                                    <Link
                                        to={`/admin/customers/${detail.customer_id || detail.customer?.id}`}
                                        className="w-full h-10 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                                    >
                                        <User className="size-3.5" />
                                        <span>Open Customer 360 CRM Profile</span>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Log New Sale Modal ─── */}
            {showSaleForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                            <div>
                                <h2 className="text-lg font-black text-primary">Log New Sale</h2>
                                <p className="text-xs text-slate-400 mt-0.5">Saved to Supabase — inventory status updated to Sold</p>
                            </div>
                            <button onClick={() => setShowSaleForm(false)} className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                                <X size={16} className="text-slate-500" />
                            </button>
                        </div>
                        <form onSubmit={handleLogSale} className="overflow-y-auto p-6 space-y-4">
                            {/* Car Selection */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Select Vehicle *</label>
                                <select value={saleForm.inventory_id} onChange={e => handleCarSelect(e.target.value)} required className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary bg-white">
                                    <option value="">— Choose a car —</option>
                                    {availableInventory.map((car: any) => (
                                        <option key={car.id} value={car.id}>
                                            {car.year} {car.make} {car.model} {car.variant || ''} — {car.registration_no || car.license_plate || 'No Reg'}
                                        </option>
                                    ))}
                                </select>
                                {availableInventory.length === 0 && (
                                    <p className="text-xs text-amber-600 mt-1">No available vehicles in inventory. Add inventory first.</p>
                                )}
                            </div>

                            {/* Customer */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Customer Name *</label>
                                <input value={saleForm.customer_name} onChange={e => setSaleForm(f => ({ ...f, customer_name: e.target.value }))} required placeholder="Full name of buyer" className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Phone *</label>
                                    <input value={saleForm.customer_phone} onChange={e => setSaleForm(f => ({ ...f, customer_phone: e.target.value }))} required placeholder="10-digit mobile" className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Email (Optional)</label>
                                    <input type="email" value={saleForm.customer_email} onChange={e => setSaleForm(f => ({ ...f, customer_email: e.target.value }))} placeholder="buyer@email.com" className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors" />
                                </div>
                            </div>

                            {/* Sale Details */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Sale Price (₹) *</label>
                                    <input type="number" min="1" value={saleForm.sale_price} onChange={e => setSaleForm(f => ({ ...f, sale_price: e.target.value }))} required placeholder="Final agreed price" className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Sale Date *</label>
                                    <input type="date" value={saleForm.sale_date} onChange={e => setSaleForm(f => ({ ...f, sale_date: e.target.value }))} required className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Purchase Cost Snapshot (₹)</label>
                                    <input type="number" min="0" value={saleForm.purchase_cost_snapshot} onChange={e => setSaleForm(f => ({ ...f, purchase_cost_snapshot: e.target.value }))} placeholder="Auto-filled from inventory" className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Net Profit (₹)</label>
                                    <input type="number" value={saleForm.profit} onChange={e => setSaleForm(f => ({ ...f, profit: e.target.value }))} placeholder="Sale Price − Purchase Cost" className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors" />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Sale Type</label>
                                <div className="flex gap-2">
                                    {Object.entries(saleTypeBadge).map(([key, val]) => (
                                        <button type="button" key={key} onClick={() => setSaleForm(f => ({ ...f, sale_type: key }))} className={`flex-1 h-9 rounded-xl text-xs font-bold border transition-colors ${saleForm.sale_type === key ? val.cls + ' border-current' : 'bg-white border-slate-200 text-slate-500'}`}>
                                            {val.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Notes (Optional)</label>
                                <textarea value={saleForm.notes} onChange={e => setSaleForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Payment method, special terms…" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary resize-none" />
                            </div>

                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={() => setShowSaleForm(false)} className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm">Cancel</button>
                                <button type="submit" disabled={isSaving || !saleForm.inventory_id || !saleForm.customer_name || !saleForm.sale_price} className="flex-1 h-10 bg-green-600 text-white font-bold rounded-xl text-sm hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                                    <span className="material-symbols-outlined text-base">point_of_sale</span>
                                    {isSaving ? 'Saving…' : 'Log Sale'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSales;

