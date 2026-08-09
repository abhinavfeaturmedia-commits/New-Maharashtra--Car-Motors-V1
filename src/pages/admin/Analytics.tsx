import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const Analytics = () => {
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
                let startDate = new Date(now.getFullYear(), 0, 1);
                if (period === 'This Month')   startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                if (period === 'This Quarter') startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

                // ── Sales ──────────────────────────────────────────────────────
                let salesData: any[] = [];
                let salesFrom = 0;
                let hasMoreSales = true;
                while (hasMoreSales) {
                    const { data, error } = await supabase
                        .from('sales')
                        .select('final_price, profit, sale_type, sale_date, sold_by, car:inventory(make, model)')
                        .gte('sale_date', startDate.toISOString())
                        .range(salesFrom, salesFrom + 999);
                    if (error) throw error;
                    if (data && data.length > 0) {
                        salesData = [...salesData, ...data];
                        salesFrom += 1000;
                        if (data.length < 1000) hasMoreSales = false;
                    } else {
                        hasMoreSales = false;
                    }
                }

                // ── Leads ──────────────────────────────────────────────────────
                let leadsData: any[] = [];
                let leadsFrom = 0;
                let hasMoreLeads = true;
                while (hasMoreLeads) {
                    const { data, error } = await supabase
                        .from('leads')
                        .select('status, source, created_at')
                        .gte('created_at', startDate.toISOString())
                        .range(leadsFrom, leadsFrom + 999);
                    if (error) throw error;
                    if (data && data.length > 0) {
                        leadsData = [...leadsData, ...data];
                        leadsFrom += 1000;
                        if (data.length < 1000) hasMoreLeads = false;
                    } else {
                        hasMoreLeads = false;
                    }
                }

                // ── Profiles (for staff names) ─────────────────────────────────
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, full_name');

                const profileMap: Record<string, string> = {};
                (profilesData || []).forEach((p: any) => { profileMap[p.id] = p.full_name || 'Unknown'; });

                // ── Process Sales ──────────────────────────────────────────────
                let grossRevenue = 0, netIncome = 0, soldCount = 0;
                const revMap = new Array(12).fill(0);
                const modelsMap: Record<string, { sold: number; revenue: number }> = {};
                const staffMap: Record<string, { deals: number; revenue: number; profit: number }> = {};

                (salesData || []).forEach((s: any) => {
                    const price = Number(s.final_price) || 0;
                    const profit = Number(s.profit) || 0;
                    grossRevenue += price;
                    netIncome += profit;
                    soldCount++;

                    const date = new Date(s.sale_date);
                    revMap[date.getMonth()] += profit / 100000; // net income in Lakhs

                    const key = `${s.car?.make || 'Unknown'} ${s.car?.model || ''}`.trim();
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
                        name: profileMap[id] || 'Staff',
                        deals: data.deals,
                        revenue: formatCurrency(data.revenue),
                        profit: formatCurrency(data.profit),
                        avg: formatCurrency(data.deals > 0 ? Math.round(data.revenue / data.deals) : 0)
                    }));

                // ── Process Leads ──────────────────────────────────────────────
                let newLeads = 0, contacted = 0, negotiations = 0, closedWon = 0;
                const sourceMap: Record<string, { total: number; won: number }> = {};

                (leadsData || []).forEach(l => {
                    if (l.status === 'new')         newLeads++;
                    if (l.status === 'contacted')   contacted++;
                    if (l.status === 'negotiation') negotiations++;
                    if (l.status === 'closed_won')  closedWon++;

                    const src = l.source || 'Unknown';
                    if (!sourceMap[src]) sourceMap[src] = { total: 0, won: 0 };
                    sourceMap[src].total++;
                    if (l.status === 'closed_won') sourceMap[src].won++;
                });

                const totalLeads = (leadsData || []).length;
                const aggNegotiation = closedWon + negotiations;
                const aggContacted   = aggNegotiation + contacted;
                const aggLeads       = aggContacted + newLeads;

                const processedFunnel = [
                    { stage: 'Leads Generated',  count: totalLeads,     pct: 100, color: 'bg-blue-500' },
                    { stage: 'Contacted',         count: aggContacted,   pct: totalLeads > 0 ? Math.round((aggContacted / totalLeads) * 100) : 0,   color: 'bg-purple-500' },
                    { stage: 'Negotiations',      count: aggNegotiation, pct: aggContacted > 0 ? Math.round((aggNegotiation / aggContacted) * 100) : 0, color: 'bg-amber-500' },
                    { stage: 'Closed Deals',      count: closedWon,      pct: aggNegotiation > 0 ? Math.round((closedWon / aggNegotiation) * 100) : 0, color: 'bg-green-500' },
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
    }, [period]);

    const maxRevenue = Math.max(...monthlyRev, 1);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Analytics Dashboard</h1>
                    <p className="text-slate-500 text-sm">Live dealership performance metrics.</p>
                </div>
                <select value={period} onChange={e => setPeriod(e.target.value)} className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none">
                    <option>This Month</option><option>This Quarter</option><option>This Year</option>
                </select>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Gross Revenue',     value: loading ? '...' : formatCurrency(stats.grossRevenue), icon: 'currency_rupee', color: 'bg-blue-500/10 text-blue-600',    sub: 'Total sale prices' },
                    { label: 'Net Income',        value: loading ? '...' : formatCurrency(stats.netIncome),    icon: 'trending_up',    color: 'bg-emerald-500/10 text-emerald-600', sub: 'Profit after costs' },
                    { label: 'Avg Sale Price',    value: loading ? '...' : formatCurrency(stats.avgSale),      icon: 'sell',           color: 'bg-purple-500/10 text-purple-600', sub: 'Per transaction' },
                    { label: 'Conversion Rate',   value: loading ? '...' : `${stats.conversionRate}%`,         icon: 'percent',        color: 'bg-amber-500/10 text-amber-600',   sub: 'Leads → Sales' },
                ].map(k => (
                    <div key={k.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                        <div className="flex items-center justify-between mb-3">
                            <div className={`size-10 rounded-xl flex items-center justify-center ${k.color}`}>
                                <span className="material-symbols-outlined text-lg">{k.icon}</span>
                            </div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Live
                            </span>
                        </div>
                        <p className="text-2xl font-black text-primary font-display">{k.value}</p>
                        <p className="text-xs text-slate-400 font-medium">{k.label}</p>
                        <p className="text-[10px] text-slate-300 mt-0.5">{k.sub}</p>
                    </div>
                ))}
            </div>

            {/* Revenue Chart + Funnel */}
            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                    <h2 className="font-bold text-primary font-display text-lg mb-1">Net Income Trend (₹ Lakhs)</h2>
                    <p className="text-xs text-slate-400 mb-5">Monthly profit after costs — consignment fee, purchased margin</p>
                    <div className="flex items-end gap-2 h-48">
                        {loading ? (
                            <div className="w-full flex justify-center items-center h-full text-slate-300">Loading chart…</div>
                        ) : monthlyRev.every(v => v === 0) ? (
                            <div className="w-full flex flex-col justify-center items-center h-full text-slate-300">
                                <span className="material-symbols-outlined text-4xl mb-2">bar_chart</span>
                                <p className="text-sm">No sales data for selected period</p>
                            </div>
                        ) : (
                            MONTHS.map((m, i) => (
                                <div key={m} className="flex-1 flex flex-col items-center gap-1 group">
                                    <div className="w-full flex flex-col items-center gap-0.5 relative">
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

                {/* Funnel (no fake website visits) */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                    <h2 className="font-bold text-primary font-display text-lg mb-6">Conversion Funnel</h2>
                    <div className="space-y-3">
                        {loading ? (
                            <div className="animate-pulse space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-4 bg-slate-100 rounded" />)}</div>
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

            {/* Lead Source Breakdown */}
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                    <h2 className="font-bold text-primary font-display text-lg mb-5">Lead Source Performance</h2>
                    <div className="space-y-3">
                        {loading ? (
                            <div className="animate-pulse space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-slate-100 rounded" />)}</div>
                        ) : sourceBreakdown.length === 0 ? (
                            <p className="text-sm text-slate-300 text-center py-8">No lead data</p>
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
                    <h2 className="font-bold text-primary font-display text-lg mb-5">Top Selling Models</h2>
                    <div className="space-y-4">
                        {loading ? (
                            <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-8 bg-slate-100 rounded" />)}</div>
                        ) : topModels.length === 0 ? (
                            <div className="py-8 flex justify-center items-center text-slate-300 text-sm">No sales data</div>
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
                    <h2 className="font-bold text-primary font-display text-lg mb-5">Staff Performance</h2>
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
