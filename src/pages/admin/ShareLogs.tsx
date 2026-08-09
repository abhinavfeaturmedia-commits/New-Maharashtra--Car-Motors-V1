import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ShareLog {
    id: string;
    inventory_id: string;
    shared_by: string | null;
    customer_name: string;
    customer_phone: string;
    customer_id: string | null;
    message_text: string | null;
    shared_at: string;
    // joined
    inventory?: {
        make: string;
        model: string;
        year: number;
        variant: string | null;
        thumbnail: string | null;
    };
    profile?: {
        full_name: string | null;
        email: string | null;
    };
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
const SkeletonRow = () => (
    <tr className="border-b border-slate-50">
        {[...Array(5)].map((_, i) => (
            <td key={i} className="px-5 py-4">
                <div className="h-4 bg-slate-100 rounded-lg animate-pulse" style={{ width: i === 0 ? '180px' : '100px' }} />
            </td>
        ))}
    </tr>
);

// ─── Component ───────────────────────────────────────────────────────────────
const ShareLogs: React.FC = () => {
    const [logs, setLogs] = useState<ShareLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const PAGE_SIZE = 50;

    const fetchLogs = async (pageNum = 0, append = false) => {
        if (pageNum === 0) setLoading(true);
        else setLoadingMore(true);

        const from = pageNum * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
            .from('inventory_shares')
            .select(`
                *,
                inventory:inventory_id ( make, model, year, variant, thumbnail ),
                profile:shared_by ( full_name, email )
            `)
            .order('shared_at', { ascending: false })
            .range(from, to);

        if (!error && data) {
            if (append) {
                setLogs(prev => [...prev, ...data as ShareLog[]]);
            } else {
                setLogs(data as ShareLog[]);
            }
            setHasMore(data.length === PAGE_SIZE);
        }

        if (pageNum === 0) setLoading(false);
        else setLoadingMore(false);
    };

    useEffect(() => { fetchLogs(0); }, []);

    // ─── Filtering ───────────────────────────────────────────────────────────
    const filtered = logs.filter(log => {
        const q = search.toLowerCase();
        const matchSearch = !q
            || log.customer_name.toLowerCase().includes(q)
            || log.customer_phone.includes(q)
            || `${log.inventory?.make} ${log.inventory?.model}`.toLowerCase().includes(q)
            || (log.profile?.full_name ?? '').toLowerCase().includes(q);

        const logDate = new Date(log.shared_at);
        const matchFrom = !dateFrom || logDate >= new Date(dateFrom);
        const matchTo = !dateTo || logDate <= new Date(dateTo + 'T23:59:59');

        return matchSearch && matchFrom && matchTo;
    });

    // ─── Stats ───────────────────────────────────────────────────────────────
    const now = new Date();
    const thisMonthLogs = logs.filter(l => {
        const d = new Date(l.shared_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const todayLogs = logs.filter(l => {
        const d = new Date(l.shared_at);
        return d.toDateString() === now.toDateString();
    });

    // Unique cars shared
    const uniqueCars = new Set(logs.map(l => l.inventory_id)).size;
    const uniqueCustomers = new Set(logs.map(l => l.customer_phone)).size;

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display flex items-center gap-2">
                        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-green-500 shrink-0">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                        WhatsApp Share Logs
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Track every car shared with customers via WhatsApp</p>
                </div>
                <button
                    onClick={() => { setPage(0); fetchLogs(0); }}
                    className="h-10 w-10 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors"
                    title="Refresh"
                >
                    <span className="material-symbols-outlined text-lg">refresh</span>
                </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Total Shares', value: logs.length, icon: 'share', color: 'text-primary bg-primary/5' },
                    { label: 'This Month', value: thisMonthLogs.length, icon: 'calendar_month', color: 'text-blue-600 bg-blue-50' },
                    { label: 'Today', value: todayLogs.length, icon: 'today', color: 'text-amber-600 bg-amber-50' },
                    { label: 'Unique Customers', value: uniqueCustomers, icon: 'people', color: 'text-green-600 bg-green-50' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-4 flex items-center gap-4">
                        <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                            <span className="material-symbols-outlined text-xl">{stat.icon}</span>
                        </div>
                        <div>
                            <p className="text-2xl font-black text-primary">{stat.value}</p>
                            <p className="text-xs text-slate-400 font-medium">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">search</span>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search customer name, phone, car…"
                        className="w-full h-10 border border-slate-200 rounded-xl pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                    />
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <label className="text-[10px] font-bold text-slate-400 absolute -top-2 left-3 bg-white px-1">From</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                        />
                    </div>
                    <div className="relative">
                        <label className="text-[10px] font-bold text-slate-400 absolute -top-2 left-3 bg-white px-1">To</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                        />
                    </div>
                    {(search || dateFrom || dateTo) && (
                        <button
                            onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}
                            className="h-10 px-3 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-x-auto">
                <table className="w-full min-w-[700px]">
                    <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                            <th className="text-left px-5 py-3">Car Shared</th>
                            <th className="text-left px-5 py-3">Customer</th>
                            <th className="text-left px-5 py-3">Shared By</th>
                            <th className="text-left px-5 py-3">Date & Time</th>
                            <th className="text-left px-5 py-3">Message</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-16">
                                    <svg viewBox="0 0 24 24" className="w-10 h-10 fill-slate-200 mx-auto mb-3">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                    </svg>
                                    <p className="text-slate-400 font-medium text-sm">
                                        {search || dateFrom || dateTo ? 'No results match your filters' : 'No shares yet — share a car from Inventory to get started'}
                                    </p>
                                    <Link to="/admin/inventory" className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-green-600 hover:underline">
                                        <span className="material-symbols-outlined text-base">directions_car</span>
                                        Go to Inventory
                                    </Link>
                                </td>
                            </tr>
                        ) : (
                            filtered.map(log => (
                                <React.Fragment key={log.id}>
                                    <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                        {/* Car */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                                                    {log.inventory?.thumbnail ? (
                                                        <img src={log.inventory.thumbnail} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-slate-300 text-xl">directions_car</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-primary">
                                                        {log.inventory
                                                            ? `${log.inventory.year} ${log.inventory.make} ${log.inventory.model}`
                                                            : 'Car Deleted'}
                                                        {log.inventory?.variant && (
                                                            <span className="text-slate-400 font-normal"> {log.inventory.variant}</span>
                                                        )}
                                                    </p>
                                                    <Link
                                                        to={`/car/${log.inventory_id}`}
                                                        target="_blank"
                                                        className="text-[11px] text-blue-500 hover:underline flex items-center gap-0.5"
                                                    >
                                                        View listing
                                                        <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                                                    </Link>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Customer */}
                                        <td className="px-5 py-3.5">
                                            <p className="text-sm font-semibold text-primary">{log.customer_name}</p>
                                            <a
                                                href={`https://wa.me/91${log.customer_phone.replace(/\D/g, '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[11px] text-green-600 hover:underline flex items-center gap-0.5"
                                            >
                                                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-green-500 shrink-0">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                </svg>
                                                {log.customer_phone}
                                            </a>
                                        </td>

                                        {/* Shared By */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <div className="size-7 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                                    {(log.profile?.full_name ?? 'A').charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm text-slate-600 font-medium">
                                                    {log.profile?.full_name ?? 'Admin'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Date */}
                                        <td className="px-5 py-3.5 text-sm text-slate-500 whitespace-nowrap">
                                            {formatDate(log.shared_at)}
                                        </td>

                                        {/* Message toggle */}
                                        <td className="px-5 py-3.5">
                                            <button
                                                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                                                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">
                                                    {expandedId === log.id ? 'expand_less' : 'expand_more'}
                                                </span>
                                                {expandedId === log.id ? 'Hide' : 'View'}
                                            </button>
                                        </td>
                                    </tr>

                                    {/* Expanded message row */}
                                    {expandedId === log.id && log.message_text && (
                                        <tr className="bg-green-50/40 border-b border-green-100">
                                            <td colSpan={5} className="px-5 py-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="size-6 shrink-0 mt-0.5">
                                                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-green-500">
                                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                        </svg>
                                                    </div>
                                                    <div className="bg-[#e2ffc7] border border-green-100 rounded-2xl rounded-tl-sm px-4 py-3 text-[12px] font-mono text-slate-700 leading-relaxed whitespace-pre-wrap max-w-2xl">
                                                        {log.message_text}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>

                {!loading && filtered.length > 0 && (
                    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                        <p className="text-xs text-slate-400">
                            Showing {filtered.length} of {logs.length}{hasMore ? '+' : ''} share records
                            {uniqueCars > 0 && ` · ${uniqueCars} unique cars`}
                        </p>
                        <div className="flex items-center gap-4">
                            <p className="text-xs text-slate-400">
                                {uniqueCustomers} unique customers reached
                            </p>
                            {hasMore && (
                                <button
                                    onClick={() => { const nextPage = page + 1; setPage(nextPage); fetchLogs(nextPage, true); }}
                                    disabled={loadingMore}
                                    className="h-8 px-4 text-xs font-bold text-primary border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5 disabled:opacity-60"
                                >
                                    {loadingMore && (
                                        <span className="size-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                    )}
                                    {loadingMore ? 'Loading…' : 'Load More'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShareLogs;
