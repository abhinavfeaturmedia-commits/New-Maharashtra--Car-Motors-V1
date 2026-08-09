import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const statusColors: Record<string, string> = {
    'new': 'bg-blue-100 text-blue-700',
    'contacted': 'bg-amber-100 text-amber-700',
    'negotiation': 'bg-purple-100 text-purple-700',
    'closed_won': 'bg-green-100 text-green-700',
    'closed_lost': 'bg-slate-200 text-slate-500',
};

const AdminDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        availableStock: 0, activeLeads: 0, carsSold: 0, netIncomeThisMonth: 0,
        consignmentActive: 0, consignmentFeesMonth: 0, dealerCars: 0, expiringConsignments: 0,
    });
    const [recentLeads, setRecentLeads] = useState<any[]>([]);
    const [actionRequired, setActionRequired] = useState<any[]>([]);
    const [expiringList, setExpiringList] = useState<any[]>([]);

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                // Inventory breakdown
                const { data: inv } = await supabase.from('inventory').select('status, price, source, consignment_end_date');
                let available = 0, sold = 0, consignmentActive = 0, dealerCars = 0;
                const today = new Date();
                const in7Days = new Date(); in7Days.setDate(today.getDate() + 7);
                const expiring: any[] = [];

                (inv || []).forEach((c: any) => {
                    if (c.status === 'available') {
                        available++;
                        if (c.source === 'consignment') {
                            consignmentActive++;
                            if (c.consignment_end_date) {
                                const end = new Date(c.consignment_end_date);
                                if (end <= in7Days) expiring.push(c);
                            }
                        }
                        if (c.source === 'dealer') dealerCars++;
                    }
                    if (c.status === 'sold') sold++;
                });

                // Sales this month — net income
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
                const { data: salesMonth } = await supabase
                    .from('sales')
                    .select('profit, consignment_fee_collected, sale_type')
                    .gte('sale_date', monthStart);
                const netIncomeThisMonth = (salesMonth || []).reduce((a: number, s: any) => a + (Number(s.profit) || 0), 0);
                const consignmentFeesMonth = (salesMonth || [])
                    .filter((s: any) => s.sale_type === 'consignment')
                    .reduce((a: number, s: any) => a + (Number(s.consignment_fee_collected) || 0), 0);

                // Leads
                const { count: activeCount } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .in('status', ['new', 'contacted', 'negotiation']);

                const { data: recentLeadsData } = await supabase
                    .from('leads')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(5);

                const { data: newLeadsData } = await supabase
                    .from('leads')
                    .select('*')
                    .eq('status', 'new')
                    .order('created_at', { ascending: false })
                    .limit(5);

                setStats({ availableStock: available, activeLeads: activeCount || 0, carsSold: sold, netIncomeThisMonth, consignmentActive, consignmentFeesMonth, dealerCars, expiringConsignments: expiring.length });
                setRecentLeads(recentLeadsData || []);
                setActionRequired(newLeadsData || []);
                setExpiringList(expiring.slice(0, 3));
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    const fmt = (val: number) => {
        if (val === 0) return '₹0';
        if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
        return `₹${(val / 100000).toFixed(1)} L`;
    };
    const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const avatar = (n: string) => n ? n.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : 'U';
    const fmtType = (t: string) => t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-primary font-display">Command Center</h1>
                    <p className="text-slate-500 text-xs sm:text-sm">Live snapshot of your dealership metrics.</p>
                </div>
                <div className="flex gap-2 sm:gap-3">
                    <Link to="/admin/analytics" className="h-10 px-3 sm:px-4 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-600 flex items-center gap-2 hover:bg-slate-50 transition-colors shrink-0">
                        <span className="material-symbols-outlined text-lg">monitoring</span> Analytics
                    </Link>
                    <Link to="/admin/inventory/new" className="h-10 px-4 sm:px-5 bg-accent text-primary font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 hover:bg-accent-hover transition-colors shadow-sm shrink-0">
                        <span className="material-symbols-outlined text-lg">add</span> New Listing
                    </Link>
                </div>
            </div>

            {/* Expiring Consignments Alert */}
            {stats.expiringConsignments > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-500 text-xl shrink-0 mt-0.5">warning</span>
                    <div className="flex-1">
                        <p className="font-bold text-amber-800 text-sm">{stats.expiringConsignments} consignment{stats.expiringConsignments > 1 ? 's' : ''} expiring within 7 days!</p>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                            {expiringList.map((c: any, i: number) => (
                                <span key={i} className="text-[11px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                                    {c.make} {c.model} — {new Date(c.consignment_end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </span>
                            ))}
                        </div>
                    </div>
                    <Link to="/admin/consignments" className="text-xs font-bold text-amber-700 hover:underline shrink-0">View All →</Link>
                </div>
            )}

            {/* Main Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Available Stock',        value: stats.availableStock,                             icon: 'inventory_2',      color: 'bg-blue-500/10 text-blue-600' },
                    { label: 'Active Leads',           value: stats.activeLeads,                                icon: 'people',           color: 'bg-green-500/10 text-green-600' },
                    { label: 'Cars Sold Total',        value: stats.carsSold,                                   icon: 'sell',             color: 'bg-amber-500/10 text-amber-600' },
                    { label: 'Net Income This Month',  value: loading ? '...' : fmt(stats.netIncomeThisMonth),  icon: 'currency_rupee',   color: 'bg-purple-500/10 text-purple-600' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-[var(--shadow-card)]">
                        <div className="flex items-center justify-between mb-3">
                            <div className={`size-10 rounded-xl flex items-center justify-center ${s.color}`}>
                                <span className="material-symbols-outlined text-lg">{s.icon}</span>
                            </div>
                        </div>
                        <p className="text-xl sm:text-2xl font-black text-primary font-display truncate">{loading ? '...' : s.value}</p>
                        <p className="text-[10px] sm:text-xs text-slate-400 font-medium uppercase tracking-wider">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* 3-Source Breakdown */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Consignments Active', value: stats.consignmentActive, icon: '🤝', sub: `Fee this month: ${fmt(stats.consignmentFeesMonth)}`, link: '/admin/consignments', border: 'border-purple-200', bg: 'bg-purple-50' },
                    { label: 'Dealer Cars',          value: stats.dealerCars,        icon: '🏪', sub: 'Available from dealers',                               link: '/admin/inventory?tab=available&dealer=dealer',    border: 'border-amber-200',  bg: 'bg-amber-50' },
                    { label: 'Expiring Soon',        value: stats.expiringConsignments, icon: '⏰', sub: 'Consignments ≤ 7 days',                              link: '/admin/consignments', border: stats.expiringConsignments > 0 ? 'border-red-200' : 'border-slate-100', bg: stats.expiringConsignments > 0 ? 'bg-red-50' : 'bg-slate-50' },
                ].map(s => (
                    <Link key={s.label} to={s.link} className={`rounded-2xl border ${s.border} ${s.bg} p-4 shadow-sm hover:shadow-md transition-shadow`}>
                        <div className="text-2xl mb-1">{s.icon}</div>
                        <p className="text-xl font-black text-primary font-display">{loading ? '...' : s.value}</p>
                        <p className="text-xs font-semibold text-slate-600">{s.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{s.sub}</p>
                    </Link>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Recent Leads */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                    <div className="p-4 sm:p-5 flex items-center justify-between">
                        <h2 className="font-bold text-primary font-display text-base sm:text-lg">Recent Activity</h2>
                        <Link to="/admin/leads" className="text-xs sm:text-sm font-semibold text-accent hover:underline flex items-center gap-1">View All <span className="material-symbols-outlined text-sm">arrow_forward</span></Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[600px]">
                            <thead>
                                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                    <th className="text-left px-4 sm:px-5 py-3">Customer</th>
                                    <th className="text-left px-4 sm:px-5 py-3">Type</th>
                                    <th className="text-left px-4 sm:px-5 py-3">Status</th>
                                    <th className="text-left px-4 sm:px-5 py-3">Date</th>
                                    <th className="text-right px-4 sm:px-5 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">Loading...</td></tr>
                                ) : recentLeads.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">No leads yet.</td></tr>
                                ) : recentLeads.map(lead => (
                                    <tr key={lead.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 sm:px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="size-8 rounded-full bg-gradient-to-br from-primary to-primary-light text-white flex items-center justify-center text-[10px] font-bold shrink-0">{avatar(lead.full_name)}</div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs sm:text-sm font-semibold text-primary truncate">{lead.full_name}</span>
                                                    <span className="text-[10px] text-slate-400 truncate">{lead.phone}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 sm:px-5 py-3.5 text-xs text-slate-700 font-medium">{fmtType(lead.type)}</td>
                                        <td className="px-4 sm:px-5 py-3.5">
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${statusColors[lead.status] || 'bg-slate-100'}`}>{lead.status.replace('_', ' ')}</span>
                                        </td>
                                        <td className="px-4 sm:px-5 py-3.5 text-[10px] sm:text-xs text-slate-400 whitespace-nowrap">{fmtDate(lead.created_at)}</td>
                                        <td className="px-4 sm:px-5 py-3.5 text-right">
                                            <Link to={`/admin/leads/${lead.id}`} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors inline-block" title="View Lead">
                                                <span className="material-symbols-outlined text-slate-400 text-lg">open_in_new</span>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right sidebar */}
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-[var(--shadow-card)]">
                        <h3 className="font-bold text-primary font-display text-sm sm:text-base mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-red-500 text-lg">local_fire_department</span> Action Required
                        </h3>
                        <div className="space-y-2.5">
                            {loading ? <p className="text-xs text-slate-400">Loading...</p>
                            : actionRequired.length === 0 ? <p className="text-xs text-slate-400">No new leads require action.</p>
                            : actionRequired.slice(0, 5).map(lead => (
                                <div key={lead.id} className="flex items-center gap-3 p-2.5 bg-red-50/50 rounded-xl border border-red-100">
                                    <div className="size-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[10px] font-bold shrink-0">{avatar(lead.full_name)}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-primary truncate">{lead.full_name}</p>
                                        <p className="text-[10px] text-slate-500 truncate">{fmtType(lead.type)}</p>
                                    </div>
                                    <Link to={`/admin/leads/${lead.id}`} className="p-1.5 hover:bg-red-100 rounded-lg shrink-0">
                                        <span className="material-symbols-outlined text-sm text-red-600">open_in_new</span>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-[var(--shadow-card)]">
                        <h3 className="font-bold text-primary font-display text-sm sm:text-base mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-accent text-lg">inventory_2</span> Quick Actions
                        </h3>
                        <div className="space-y-3">
                            {[
                                { to: '/admin/inventory/new', icon: 'add_a_photo',   title: 'Upload Vehicle',   sub: 'Create a new live listing' },
                                { to: '/admin/leads',         icon: 'contact_mail',  title: 'Manage Leads',    sub: 'View CRM and follow-ups' },
                                { to: '/admin/consignments',  icon: 'handshake',     title: 'Consignments',    sub: 'Track owner listings' },
                            ].map(a => (
                                <Link key={a.to} to={a.to} className="w-full flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-slate-200 transition-colors">
                                    <span className="material-symbols-outlined text-primary text-xl">{a.icon}</span>
                                    <div>
                                        <p className="text-xs font-bold text-primary">{a.title}</p>
                                        <p className="text-[10px] text-slate-500">{a.sub}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
