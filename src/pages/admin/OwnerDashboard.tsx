import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const fmt = (val: number) => {
    if (val === 0) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
};

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const statusLabel: Record<string, { label: string; color: string }> = {
    available:   { label: 'For Sale',    color: 'bg-green-100 text-green-700' },
    reserved:    { label: 'Reserved',    color: 'bg-amber-100 text-amber-700' },
    sold:        { label: 'Sold',        color: 'bg-slate-200 text-slate-500' },
    pending:     { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
    archived:    { label: 'Hidden',      color: 'bg-slate-100 text-slate-400' },
    new:         { label: 'New Inquiry', color: 'bg-blue-100 text-blue-700' },
    contacted:   { label: 'Contacted',   color: 'bg-purple-100 text-purple-700' },
    negotiation: { label: '🔥 In Talks', color: 'bg-orange-100 text-orange-700' },
    closed_won:  { label: '✅ Deal Done', color: 'bg-green-100 text-green-700' },
    closed_lost: { label: 'Didn\'t Work', color: 'bg-slate-100 text-slate-500' },
};

interface Stats {
    carsForSale: number;
    carsSoldThisMonth: number;
    totalCustomers: number;
    incomeThisMonth: number;
    followUpsDue: number;
    carsTotal: number;
}

interface RecentActivity {
    id: string;
    type: 'sale' | 'lead' | 'customer';
    title: string;
    subtitle: string;
    date: string;
    badge: string;
    badgeColor: string;
    link: string;
}

const OwnerDashboard: React.FC = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Stats>({
        carsForSale: 0, carsSoldThisMonth: 0, totalCustomers: 0,
        incomeThisMonth: 0, followUpsDue: 0, carsTotal: 0,
    });
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [actionNeeded, setActionNeeded] = useState<any[]>([]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const today = new Date();
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
                const todayStr = today.toISOString().split('T')[0];

                const [
                    { data: inv },
                    { data: salesMonth },
                    { count: custCount },
                    { data: hotLeads },
                    { data: recentSales },
                    { data: recentLeads },
                ] = await Promise.all([
                    supabase.from('inventory').select('id, make, model, year, price, status, source, created_at'),
                    supabase.from('sales').select('profit, sale_date').gte('sale_date', monthStart),
                    supabase.from('customers').select('*', { count: 'exact', head: true }),
                    supabase.from('leads').select('id, full_name, phone, status, created_at').in('status', ['new', 'negotiation']).order('created_at', { ascending: false }).limit(5),
                    supabase.from('sales').select('id, sale_date, inventory:inventory_id(make, model, year), customer:customer_id(full_name)').order('sale_date', { ascending: false }).limit(5),
                    supabase.from('leads').select('id, full_name, status, created_at, type').order('created_at', { ascending: false }).limit(5),
                ]);

                const carsForSale = (inv || []).filter((c: any) => c.status === 'available').length;
                const carsSoldThisMonth = (salesMonth || []).length;
                const incomeThisMonth = (salesMonth || []).reduce((a: number, s: any) => a + (Number(s.profit) || 0), 0);

                setStats({
                    carsForSale,
                    carsSoldThisMonth,
                    totalCustomers: custCount || 0,
                    incomeThisMonth,
                    followUpsDue: (hotLeads || []).length,
                    carsTotal: (inv || []).length,
                });

                setActionNeeded(hotLeads || []);

                // Build recent activity feed
                const activity: RecentActivity[] = [];
                (recentSales || []).forEach((s: any) => {
                    const car = s.inventory;
                    const cust = s.customer;
                    activity.push({
                        id: s.id,
                        type: 'sale',
                        title: car ? `${car.make} ${car.model} (${car.year}) Sold` : 'Car Sold',
                        subtitle: cust?.full_name ? `Buyer: ${cust.full_name}` : 'Sale recorded',
                        date: s.sale_date,
                        badge: '✅ Deal Done',
                        badgeColor: 'bg-green-100 text-green-700',
                        link: '/admin/sales',
                    });
                });
                (recentLeads || []).slice(0, 3).forEach((l: any) => {
                    const s = statusLabel[l.status] || { label: l.status, color: 'bg-slate-100 text-slate-500' };
                    activity.push({
                        id: l.id,
                        type: 'lead',
                        title: l.full_name,
                        subtitle: `Inquiry — ${l.type?.replace(/_/g, ' ') || 'General'}`,
                        date: l.created_at,
                        badge: s.label,
                        badgeColor: s.color,
                        link: `/admin/leads/${l.id}`,
                    });
                });
                activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setRecentActivity(activity.slice(0, 8));
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const BigCard = ({ icon, iconBg, title, value, sub, link, linkLabel }: {
        icon: string; iconBg: string; title: string; value: string | number; sub: string; link: string; linkLabel: string;
    }) => (
        <Link to={link} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col gap-4">
            <div className={`size-14 rounded-2xl flex items-center justify-center ${iconBg}`}>
                <span className="material-symbols-outlined text-2xl">{icon}</span>
            </div>
            <div>
                <p className="text-3xl font-black text-primary font-display">{loading ? '…' : value}</p>
                <p className="text-sm font-bold text-slate-700 mt-0.5">{title}</p>
                <p className="text-xs text-slate-400 mt-1">{sub}</p>
            </div>
            <div className="mt-auto pt-3 border-t border-slate-100">
                <span className="text-xs font-bold text-primary flex items-center gap-1">
                    {linkLabel} <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </span>
            </div>
        </Link>
    );

    return (
        <div className="space-y-8">
            {/* Welcome header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">
                        {greeting()}, <span className="text-amber-600 font-serif-italic font-normal">
                            {profile?.full_name?.split(' ')[0] || 'Boss'} 👋
                        </span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Here's what's happening at your showroom today.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link
                        to="/admin/inventory/new"
                        className="h-10 px-5 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <span className="material-symbols-outlined text-lg">add</span> Add a Car
                    </Link>
                    <Link
                        to="/admin/people"
                        className="h-10 px-4 bg-amber-50 border border-amber-200 text-amber-700 font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-amber-100 transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">person_add</span>
                        <span className="hidden sm:inline">Add Customer</span>
                    </Link>
                </div>
            </div>

            {/* Action needed alert */}
            {!loading && actionNeeded.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
                    <span className="text-2xl">🔥</span>
                    <div className="flex-1">
                        <p className="font-bold text-orange-800 text-sm">
                            {actionNeeded.length} customer{actionNeeded.length > 1 ? 's' : ''} need{actionNeeded.length === 1 ? 's' : ''} your attention
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                            {actionNeeded.map((l: any) => (
                                <Link
                                    key={l.id}
                                    to={`/admin/leads/${l.id}`}
                                    className="text-xs bg-orange-100 text-orange-800 font-semibold px-2.5 py-1 rounded-full hover:bg-orange-200 transition-colors"
                                >
                                    {l.full_name}
                                </Link>
                            ))}
                        </div>
                    </div>
                    <Link to="/admin/leads" className="text-xs font-bold text-orange-700 hover:underline shrink-0">
                        View All →
                    </Link>
                </div>
            )}

            {/* 4 Big Action Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <BigCard
                    icon="directions_car"
                    iconBg="bg-blue-100 text-blue-600"
                    title="Cars Available for Sale"
                    value={stats.carsForSale}
                    sub={`${stats.carsTotal} cars total in showroom`}
                    link="/admin/inventory"
                    linkLabel="View all cars"
                />
                <BigCard
                    icon="sell"
                    iconBg="bg-green-100 text-green-600"
                    title="Cars Sold This Month"
                    value={stats.carsSoldThisMonth}
                    sub="Deals closed this month"
                    link="/admin/sales"
                    linkLabel="See sales history"
                />
                <BigCard
                    icon="people"
                    iconBg="bg-purple-100 text-purple-600"
                    title="Total Customers"
                    value={stats.totalCustomers}
                    sub="Buyers & sellers in your system"
                    link="/admin/people"
                    linkLabel="View all people"
                />
                <BigCard
                    icon="currency_rupee"
                    iconBg="bg-amber-100 text-amber-600"
                    title="Income This Month"
                    value={fmt(stats.incomeThisMonth)}
                    sub="Net profit from all deals"
                    link="/admin/accounts"
                    linkLabel="See accounts"
                />
            </div>

            {/* Quick Actions row */}
            <div>
                <h2 className="text-base font-bold text-primary font-display mb-3">Quick Actions</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { icon: 'add_a_photo',    label: 'Add a Car',        sub: 'New vehicle listing', link: '/admin/inventory/new',  bg: 'bg-blue-50 hover:bg-blue-100 border-blue-100',    ic: 'text-blue-600' },
                        { icon: 'person_search',  label: 'Add a Customer',   sub: 'New buyer or seller',  link: '/admin/people',         bg: 'bg-purple-50 hover:bg-purple-100 border-purple-100', ic: 'text-purple-600' },
                        { icon: 'point_of_sale',  label: 'Record a Sale',    sub: 'Mark a deal as done', link: '/admin/sales',          bg: 'bg-green-50 hover:bg-green-100 border-green-100',  ic: 'text-green-600' },
                        { icon: 'handshake',      label: 'Track Consignment',sub: 'Owner-listed vehicles',link: '/admin/consignments',   bg: 'bg-amber-50 hover:bg-amber-100 border-amber-100',  ic: 'text-amber-600' },
                    ].map(a => (
                        <Link
                            key={a.link}
                            to={a.link}
                            className={`flex items-center gap-3 p-4 rounded-2xl border ${a.bg} transition-colors`}
                        >
                            <div className="size-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                                <span className={`material-symbols-outlined text-xl ${a.ic}`}>{a.icon}</span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-primary">{a.label}</p>
                                <p className="text-[10px] text-slate-400 truncate">{a.sub}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Recent Activity feed */}
            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-5 flex items-center justify-between border-b border-slate-100">
                        <h2 className="font-bold text-primary font-display">Recent Activity</h2>
                        <Link to="/admin/leads" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                            See all <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-3 px-5 py-4">
                                    <div className="size-10 rounded-xl bg-slate-100 animate-pulse shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 bg-slate-100 animate-pulse rounded w-40" />
                                        <div className="h-3 bg-slate-100 animate-pulse rounded w-24" />
                                    </div>
                                </div>
                            ))
                        ) : recentActivity.length === 0 ? (
                            <div className="py-16 flex flex-col items-center gap-2 text-slate-300">
                                <span className="material-symbols-outlined text-5xl">hourglass_empty</span>
                                <p className="text-sm font-medium">No activity yet</p>
                            </div>
                        ) : recentActivity.map(a => (
                            <Link
                                key={`${a.type}-${a.id}`}
                                to={a.link}
                                className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50/70 transition-colors"
                            >
                                <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                                    a.type === 'sale' ? 'bg-green-100' : a.type === 'lead' ? 'bg-blue-100' : 'bg-purple-100'
                                }`}>
                                    <span className={`material-symbols-outlined text-lg ${
                                        a.type === 'sale' ? 'text-green-600' : a.type === 'lead' ? 'text-blue-600' : 'text-purple-600'
                                    }`}>
                                        {a.type === 'sale' ? 'sell' : a.type === 'lead' ? 'person_search' : 'people'}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-primary truncate">{a.title}</p>
                                    <p className="text-xs text-slate-400 truncate">{a.subtitle}</p>
                                </div>
                                <div className="shrink-0 text-right space-y-1">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.badgeColor}`}>{a.badge}</span>
                                    <p className="text-[10px] text-slate-300">{fmtDate(a.date)}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Right: Tips / Help */}
                <div className="space-y-4">
                    <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-white">
                        <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-2">Quick Tip</p>
                        <p className="text-sm font-semibold leading-relaxed">
                            To add a new car, click <strong>"Add a Car"</strong> from anywhere. You can upload photos, set price, and publish it to the website instantly.
                        </p>
                        <Link
                            to="/admin/inventory/new"
                            className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-colors"
                        >
                            Add a Car <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                        <h3 className="font-bold text-primary text-sm mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500 text-lg">star</span>
                            What You Can Do Here
                        </h3>
                        <div className="space-y-2.5">
                            {[
                                { icon: 'directions_car', text: 'Add & track your vehicles', link: '/admin/inventory' },
                                { icon: 'people',         text: 'Manage buyers & sellers',   link: '/admin/people' },
                                { icon: 'attach_file',    text: 'Upload customer documents', link: '/admin/people' },
                                { icon: 'note_alt',       text: 'Add notes on any customer', link: '/admin/people' },
                                { icon: 'payments',       text: 'Track sales & income',      link: '/admin/sales' },
                            ].map(item => (
                                <Link
                                    key={item.text}
                                    to={item.link}
                                    className="flex items-center gap-2.5 text-sm text-slate-600 hover:text-primary transition-colors"
                                >
                                    <span className="material-symbols-outlined text-base text-slate-400">{item.icon}</span>
                                    {item.text}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OwnerDashboard;
