import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { formatCurrency } from '../../lib/utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const Analytics = () => {
    const { sales: contextSales, leads: contextLeads, inventory: contextInventory } = useData();
    const [period, setPeriod] = useState('This Year');
    const [loading, setLoading] = useState(true);

    const [stats, setStats] = useState({ grossRevenue: 0, netIncome: 0, avgSale: 0, conversionRate: 0 });
    const [monthlyRev, setMonthlyRev] = useState<number[]>(new Array(12).fill(0));
    const [topModels, setTopModels] = useState<any[]>([]);
    const [funnel, setFunnel] = useState<any[]>([]);
    const [sourceBreakdown, setSourceBreakdown] = useState<any[]>([]);
    const [staffPerformance, setStaffPerformance] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const now = new Date();
                let startDate: Date | null = new Date(now.getFullYear(), 0, 1);
                if (period === 'This Month')   startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                if (period === 'This Quarter') startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                if (period === 'All Time')     startDate = null;

                // Inventory fallback map
                const inventoryMap = new Map((contextInventory || []).map((i: any) => [i.id, i]));

                // ── 1. Fetch Sales (with resilient query & fallback) ───────────
                let salesData: any[] = [];
                try {
                    let salesQuery = supabase
                        .from('sales')
                        .select('sale_price, final_price, profit, sale_type, sale_date, sold_by, inventory_id, car_id, car:inventory!sales_inventory_id_fkey(make, model)');

                    if (startDate) {
                        salesQuery = salesQuery.gte('sale_date', startDate.toISOString().split('T')[0]);
                    }

                    const { data, error } = await salesQuery;
                    if (!error && data && data.length > 0) {
                        salesData = data;
                    } else if (error) {
                        console.warn('Direct sales query notice (using fallback context):', error.message);
                    }
                } catch (sErr) {
                    console.warn('Sales fetch exception, using context sales fallback:', sErr);
                }

                // Fallback to DataContext sales if direct query yields no results
                if (salesData.length === 0 && contextSales && contextSales.length > 0) {
                    salesData = contextSales.filter((s: any) => {
                        if (!startDate) return true;
                        if (!s.sale_date) return false;
                        return new Date(s.sale_date) >= startDate;
                    });
                }

                // ── 2. Fetch Leads (with resilient query & fallback) ───────────
                let leadsData: any[] = [];
                try {
                    let leadsQuery = supabase
                        .from('leads')
                        .select('status, source, created_at');

                    if (startDate) {
                        leadsQuery = leadsQuery.gte('created_at', startDate.toISOString());
                    }

                    const { data, error } = await leadsQuery;
                    if (!error && data) {
                        leadsData = data;
                    }
                } catch (lErr) {
                    console.warn('Leads fetch exception, using context leads fallback:', lErr);
                }

                // Fallback to DataContext leads if direct query yields no results
                if (leadsData.length === 0 && contextLeads && contextLeads.length > 0) {
                    leadsData = contextLeads.filter((l: any) => {
                        if (!startDate) return true;
                        if (!l.created_at) return false;
                        return new Date(l.created_at) >= startDate;
                    });
                }

                // ── 3. Profiles (for staff names) ──────────────────────────────
                const profileMap: Record<string, string> = {};
                try {
                    const { data: profilesData } = await supabase
                        .from('profiles')
                        .select('id, full_name');
                    (profilesData || []).forEach((p: any) => { profileMap[p.id] = p.full_name || 'Unknown'; });
                } catch (pErr) {
                    console.warn('Profiles fetch error:', pErr);
                }

                // ── 4. Process Sales Data ──────────────────────────────────────
                let grossRevenue = 0, netIncome = 0, soldCount = 0;
                const revMap = new Array(12).fill(0);
                const modelsMap: Record<string, { sold: number; revenue: number }> = {};
                const staffMap: Record<string, { deals: number; revenue: number; profit: number }> = {};

                (salesData || []).forEach((s: any) => {
                    const price = Number(s.sale_price ?? s.final_price) || 0;
                    const profit = Number(s.profit) || 0;
                    grossRevenue += price;
                    netIncome += profit;
                    soldCount++;

                    if (s.sale_date) {
                        const date = new Date(s.sale_date);
                        if (!isNaN(date.getTime())) {
                            revMap[date.getMonth()] += profit / 100000; // profit in ₹ Lakhs
                        }
                    }

                    // Car details resolution (with context inventory fallback)
                    const carObj = s.car || inventoryMap.get(s.inventory_id || s.car_id);
                    const key = `${carObj?.make || 'Unknown'} ${carObj?.model || ''}`.trim();
                    if (!modelsMap[key]) modelsMap[key] = { sold: 0, revenue: 0 };
                    modelsMap[key].sold++;
                    modelsMap[key].revenue += price;

                    if (s.sold_by) {
                        if (!staffMap[s.sold_by]) staffMap[s.sold_by] = { deals: 0, revenue: 0, profit: 0 };
                        staffMap[s.sold_by].deals++;
                        staffMap[s.sold_by].revenue += price;
                        staffMap[s.sold_by].profit += profit;
                    }
                });

                // Top Models
                const sortedModels = Object.entries(modelsMap)
                    .sort((a, b) => b[1].sold - a[1].sold)
                    .slice(0, 5)
                    .map(([name, data]) => ({
                        name, sold: data.sold,
                        revenue: formatCurrency(data.revenue),
                        pct: Math.min(100, Math.round((data.sold / Math.max(soldCount, 1)) * 100))
                    }));

                // Staff Performance
                const sortedStaff = Object.entries(staffMap)
                    .sort((a, b) => b[1].deals - a[1].deals)
                    .map(([id, data]) => ({
                        name: profileMap[id] || 'Staff Member',
                        deals: data.deals,
                        revenue: formatCurrency(data.revenue),
                        profit: formatCurrency(data.profit),
                        avg: formatCurrency(data.deals > 0 ? Math.round(data.revenue / data.deals) : 0)
                    }));

                // ── 5. Process Leads Data ──────────────────────────────────────
                let newLeads = 0, contacted = 0, negotiations = 0, closedWon = 0;
                const sourceMap: Record<string, { total: number; won: number }> = {};

                (leadsData || []).forEach(l => {
                    const st = (l.status || '').toLowerCase();
                    if (st === 'new') newLeads++;
                    if (st === 'contacted' || st === 'qualified' || st === 'test_drive') contacted++;
                    if (st === 'negotiation') negotiations++;
                    if (st === 'closed_won' || st === 'won') closedWon++;

                    const src = l.source || 'Website Direct';
                    if (!sourceMap[src]) sourceMap[src] = { total: 0, won: 0 };
                    sourceMap[src].total++;
                    if (st === 'closed_won' || st === 'won') sourceMap[src].won++;
                });

                const totalLeads = (leadsData || []).length;
                const aggNegotiation = closedWon + negotiations;
                const aggContacted   = aggNegotiation + contacted;

                const processedFunnel = [
                    { stage: 'Leads Generated',  count: totalLeads,     pct: 100, color: 'bg-blue-500' },
                    { stage: 'Contacted',         count: aggContacted,   pct: totalLeads > 0 ? Math.round((aggContacted / totalLeads) * 100) : 0,   color: 'bg-purple-500' },
                    { stage: 'Negotiations',      count: aggNegotiation, pct: totalLeads > 0 ? Math.round((aggNegotiation / totalLeads) * 100) : 0, color: 'bg-amber-500' },
                    { stage: 'Closed Deals',      count: closedWon,      pct: totalLeads > 0 ? Math.round((closedWon / totalLeads) * 100) : 0, color: 'bg-green-500' },
                ];

                // Source breakdown
                const sortedSources = Object.entries(sourceMap)
                    .sort((a, b) => b[1].total - a[1].total)
                    .slice(0, 6)
                    .map(([src, data]) => ({
                        source: src, total: data.total, won: data.won,
                        rate: data.total > 0 ? Math.round((data.won / data.total) * 100) : 0,
                        pct: Math.min(100, Math.round((data.total / Math.max(totalLeads, 1)) * 100))
                    }));

                setStats({
                    grossRevenue,
                    netIncome,
                    avgSale: soldCount > 0 ? Math.round(grossRevenue / soldCount) : 0,
                    conversionRate: totalLeads > 0 ? Math.round((soldCount / totalLeads) * 100) : 0,
                });
                setMonthlyRev(revMap);
                setTopModels(sortedModels);
                setFunnel(processedFunnel);
                setSourceBreakdown(sortedSources);
                setStaffPerformance(sortedStaff);

            } catch (err) {
                console.error('Error fetching analytics', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [period, contextSales, contextLeads, contextInventory]);

    const maxRevenue = Math.max(...monthlyRev, 1);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Analytics Dashboard</h1>
                    <p className="text-slate-500 text-sm">Live dealership performance metrics & data insights.</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={period}
                        onChange={e => setPeriod(e.target.value)}
                        className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none shadow-sm cursor-pointer hover:border-slate-300 transition-colors"
                    >
                        <option>This Month</option>
                        <option>This Quarter</option>
                        <option>This Year</option>
                        <option>All Time</option>
                    </select>
                </div>
            </div>

            {/* KPI Cards (Linked to detail pages) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Gross Revenue',     value: loading ? '...' : formatCurrency(stats.grossRevenue), icon: 'currency_rupee', color: 'bg-blue-500/10 text-blue-600',    sub: 'Total sale prices', link: '/admin/sales' },
                    { label: 'Net Income',        value: loading ? '...' : formatCurrency(stats.netIncome),    icon: 'trending_up',    color: 'bg-emerald-500/10 text-emerald-600', sub: 'Profit after costs', link: '/admin/sales' },
                    { label: 'Avg Sale Price',    value: loading ? '...' : formatCurrency(stats.avgSale),      icon: 'sell',           color: 'bg-purple-500/10 text-purple-600', sub: 'Per transaction',  link: '/admin/sales' },
                    { label: 'Conversion Rate',   value: loading ? '...' : `${stats.conversionRate}%`,         icon: 'percent',        color: 'bg-amber-500/10 text-amber-600',   sub: 'Leads → Sales',    link: '/admin/leads' },
                ].map(k => (
                    <Link
                        key={k.label}
                        to={k.link}
                        className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)] hover:shadow-md hover:border-slate-200 transition-all group"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className={`size-10 rounded-xl flex items-center justify-center ${k.color} group-hover:scale-105 transition-transform`}>
                                <span className="material-symbols-outlined text-lg">{k.icon}</span>
                            </div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Live
                            </span>
                        </div>
                        <p className="text-2xl font-black text-primary font-display">{k.value}</p>
                        <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                            {k.label}
                            <span className="material-symbols-outlined text-xs opacity-0 group-hover:opacity-100 transition-opacity text-accent">arrow_forward</span>
                        </p>
                        <p className="text-[10px] text-slate-300 mt-0.5">{k.sub}</p>
                    </Link>
                ))}
            </div>

            {/* Revenue Chart + Funnel */}
            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="font-bold text-primary font-display text-lg mb-0.5">Net Income Trend (₹ Lakhs)</h2>
                            <p className="text-xs text-slate-400">Monthly profit after costs — consignment fee, purchased margin</p>
                        </div>
                        <Link to="/admin/sales" className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
                            Sales Register <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                    </div>
                    <div className="flex items-end gap-2 h-48 pt-4">
                        {loading ? (
                            <div className="w-full flex justify-center items-center h-full text-slate-300 text-sm">Loading chart data…</div>
                        ) : monthlyRev.every(v => v === 0) ? (
                            <div className="w-full flex flex-col justify-center items-center h-full text-slate-300">
                                <span className="material-symbols-outlined text-4xl mb-2">bar_chart</span>
                                <p className="text-sm">No profit data recorded for selected period</p>
                            </div>
                        ) : (
                            MONTHS.map((m, i) => (
                                <div key={m} className="flex-1 flex flex-col items-center gap-1 group relative">
                                    <div className="w-full flex flex-col items-center gap-0.5 relative">
                                        {/* Hover Tooltip */}
                                        <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-10">
                                            ₹{monthlyRev[i].toFixed(2)} L
                                        </div>
                                        <div className="w-3/4 bg-accent/20 rounded-t transition-all" style={{ height: `${(monthlyRev[i] / maxRevenue) * 140}px` }}>
                                            <div className="w-full bg-accent rounded-t transition-all group-hover:bg-primary" style={{ height: `${(monthlyRev[i] / maxRevenue) * 100}%` }} />
                                        </div>
                                    </div>
                                    <span className="text-[9px] text-slate-400 font-medium">{m}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Conversion Funnel */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="font-bold text-primary font-display text-lg">Conversion Funnel</h2>
                        <Link to="/admin/leads" className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
                            View CRM <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                    </div>
                    <div className="space-y-4">
                        {loading ? (
                            <div className="animate-pulse space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-6 bg-slate-100 rounded-lg" />)}</div>
                        ) : funnel.map((f: any) => (
                            <div key={f.stage}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-medium text-slate-600">{f.stage}</span>
                                    <div className="flex gap-2 items-center">
                                        <span className="text-[10px] text-slate-400">{f.pct}%</span>
                                        <span className="text-xs font-bold text-primary">{f.count}</span>
                                    </div>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full ${f.color} rounded-full transition-all duration-1000`} style={{ width: `${Math.max(f.pct, 2)}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Lead Source Breakdown & Top Models */}
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="font-bold text-primary font-display text-lg">Lead Source Performance</h2>
                        <Link to="/admin/leads" className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
                            Leads <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {loading ? (
                            <div className="animate-pulse space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-slate-100 rounded-lg" />)}</div>
                        ) : sourceBreakdown.length === 0 ? (
                            <p className="text-sm text-slate-300 text-center py-8">No lead data recorded for selected period</p>
                        ) : sourceBreakdown.map((s: any) => (
                            <div key={s.source} className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-slate-600 w-28 truncate shrink-0">{s.source}</span>
                                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full" style={{ width: `${Math.max(s.pct, 2)}%` }} />
                                </div>
                                <span className="text-xs font-bold text-primary w-8 text-right shrink-0">{s.total}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${s.rate >= 20 ? 'bg-green-100 text-green-700' : s.rate >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {s.rate}% cvr
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Models */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="font-bold text-primary font-display text-lg">Top Selling Models</h2>
                        <Link to="/admin/inventory" className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
                            Inventory <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                    </div>
                    <div className="space-y-4">
                        {loading ? (
                            <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-8 bg-slate-100 rounded-lg" />)}</div>
                        ) : topModels.length === 0 ? (
                            <div className="py-8 flex justify-center items-center text-slate-300 text-sm">No sales data recorded for selected period</div>
                        ) : topModels.map((m: any, i: number) => (
                            <div key={m.name} className="flex items-center gap-4 group hover:bg-slate-50 p-2 -mx-2 rounded-xl transition-colors">
                                <span className="text-sm font-black text-slate-300 w-6 group-hover:text-accent">{String(i + 1).padStart(2, '0')}</span>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-semibold text-primary">{m.name}</span>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-slate-500">{m.sold} sold</span>
                                            <span className="text-xs font-bold text-primary">{m.revenue}</span>
                                        </div>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000" style={{ width: `${Math.max(m.pct, 2)}%` }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Staff Performance */}
            {staffPerformance.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="font-bold text-primary font-display text-lg">Staff Performance</h2>
                        <Link to="/admin/people" className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
                            Team Directory <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[500px]">
                            <thead>
                                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                    <th className="text-left px-4 py-3">Staff Member</th>
                                    <th className="text-right px-4 py-3">Deals Closed</th>
                                    <th className="text-right px-4 py-3">Revenue</th>
                                    <th className="text-right px-4 py-3">Net Profit</th>
                                    <th className="text-right px-4 py-3">Avg Deal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staffPerformance.map((s: any, i: number) => (
                                    <tr key={s.name} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="size-8 rounded-full bg-gradient-to-br from-primary to-primary-light text-white flex items-center justify-center text-[10px] font-bold">
                                                    {s.name.charAt(0)}
                                                </div>
                                                <span className="text-sm font-semibold text-primary">{s.name}</span>
                                                {i === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">🏆 Top</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-right text-sm font-bold text-primary">{s.deals}</td>
                                        <td className="px-4 py-3.5 text-right text-sm text-slate-600">{s.revenue}</td>
                                        <td className="px-4 py-3.5 text-right text-sm font-semibold text-emerald-600">{s.profit}</td>
                                        <td className="px-4 py-3.5 text-right text-sm text-slate-500">{s.avg}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Analytics;

