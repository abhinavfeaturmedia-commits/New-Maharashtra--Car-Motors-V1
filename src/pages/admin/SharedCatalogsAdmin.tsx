import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface CatalogInventory {
    make: string;
    model: string;
    year: number;
    thumbnail: string | null;
    price: number;
}

interface CatalogItem {
    inventory_id: string;
    is_liked: boolean;
    comments: string[];
    inventory: CatalogInventory | null;
}

interface CatalogSalesperson {
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
}

interface SharedCatalog {
    id: string;
    customer_name: string;
    customer_phone: string | null;
    custom_message: string | null;
    created_at: string;
    expires_at: string | null;
    is_active: boolean;
    lead_id: string | null;
    customer_id: string | null;
    salesperson: CatalogSalesperson | null;
    items: CatalogItem[];
    catalog_views: { id: string }[];
}

const PAGE_SIZE = 20;

const SharedCatalogsAdmin: React.FC = () => {
    const [catalogs, setCatalogs] = useState<SharedCatalog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Global stats states
    const [totalCatalogsCount, setTotalCatalogsCount] = useState(0);
    const [activeCatalogsCount, setActiveCatalogsCount] = useState(0);
    const [inactiveCatalogsCount, setInactiveCatalogsCount] = useState(0);
    const [totalViewsCount, setTotalViewsCount] = useState(0);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchStats = async () => {
        try {
            const [totalRes, activeRes, viewsRes] = await Promise.all([
                supabase
                    .from('shared_catalogs')
                    .select('*', { count: 'exact', head: true }),
                supabase
                    .from('shared_catalogs')
                    .select('*', { count: 'exact', head: true })
                    .eq('is_active', true)
                    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
                supabase
                    .from('catalog_views')
                    .select('*', { count: 'exact', head: true })
            ]);

            const total = totalRes.count || 0;
            const active = activeRes.count || 0;
            const views = viewsRes.count || 0;

            setTotalCatalogsCount(total);
            setActiveCatalogsCount(active);
            setInactiveCatalogsCount(total - active);
            setTotalViewsCount(views);
        } catch (err) {
            console.error('Error fetching global shared catalog stats:', err);
        }
    };

    const fetchCatalogs = async (pageNum = 0, append = false, searchStr = '') => {
        if (pageNum === 0) setLoading(true);
        else setLoadingMore(true);

        const from = pageNum * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = supabase
            .from('shared_catalogs')
            .select(`
                *,
                salesperson:profiles!shared_catalogs_created_by_fkey(full_name, phone, avatar_url),
                items:shared_catalog_items(
                    inventory_id,
                    is_liked,
                    comments,
                    inventory:inventory_id(make, model, year, thumbnail, price)
                ),
                catalog_views(id)
            `, { count: 'exact' });

        if (searchStr.trim()) {
            const cleanSearch = searchStr.trim();
            // 1. Search matching profile IDs first
            const { data: matchedProfiles } = await supabase
                .from('profiles')
                .select('id')
                .ilike('full_name', `%${cleanSearch}%`);

            const profileIds = matchedProfiles?.map(p => p.id) || [];

            let orCondition = `customer_name.ilike.%${cleanSearch}%,customer_phone.ilike.%${cleanSearch}%`;
            if (profileIds.length > 0) {
                orCondition += `,created_by.in.(${profileIds.map(id => `"${id}"`).join(',')})`;
            }
            query = query.or(orCondition);
        }

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (!error && data) {
            const typed = data as unknown as SharedCatalog[];
            if (append) {
                setCatalogs(prev => [...prev, ...typed]);
            } else {
                setCatalogs(typed);
            }
            if (count !== null) {
                setHasMore(from + data.length < count);
            } else {
                setHasMore(data.length === PAGE_SIZE);
            }
        }

        if (pageNum === 0) setLoading(false);
        else setLoadingMore(false);
    };

    const isMounted = useRef(false);

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            fetchCatalogs(0, false, '');
            fetchStats();
            return;
        }
        const delayDebounceFn = setTimeout(() => {
            setPage(0);
            fetchCatalogs(0, false, search);
        }, 350);

        return () => clearTimeout(delayDebounceFn);
    }, [search]);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchCatalogs(nextPage, true, search);
    };

    const getOrigin = () => {
        const envPublicUrl = import.meta.env.VITE_PUBLIC_URL?.replace(/\/$/, '');
        const isLocal = window.location.hostname === 'localhost'
            || /^192\.168\./.test(window.location.hostname)
            || /^10\./.test(window.location.hostname)
            || /^172\.(1[6-9]|2\d|3[01])\./.test(window.location.hostname);
        return (envPublicUrl && !isLocal) ? envPublicUrl : window.location.origin;
    };

    const handleCopyLink = async (id: string) => {
        const targetUrl = `${getOrigin()}/shared-catalog/${id}`;
        let success = false;

        // Method 1: Modern Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(targetUrl);
                success = true;
            } catch {
                // fall through
            }
        }

        // Method 2: Legacy execCommand fallback
        if (!success) {
            try {
                const el = document.createElement('textarea');
                el.value = targetUrl;
                el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
                document.body.appendChild(el);
                el.focus();
                el.select();
                success = document.execCommand('copy');
                document.body.removeChild(el);
            } catch {
                success = false;
            }
        }

        if (success) {
            setCopiedId(id);
            showToast('Catalog link copied to clipboard!');
            setTimeout(() => setCopiedId(null), 2500);
        } else {
            showToast('Failed to copy. Please manually copy the link.', 'error');
        }
    };

    const handleToggleActive = async (catalog: SharedCatalog) => {
        setTogglingId(catalog.id);
        const newActive = !catalog.is_active;
        const updatePayload: any = { is_active: newActive };
        
        // Reactivating resets/clears expires_at so it doesn't stay expired
        if (newActive) {
            updatePayload.expires_at = null;
        }

        const { error } = await supabase
            .from('shared_catalogs')
            .update(updatePayload)
            .eq('id', catalog.id);

        if (!error) {
            setCatalogs(prev => prev.map(c =>
                c.id === catalog.id ? { ...c, is_active: newActive, expires_at: newActive ? null : c.expires_at } : c
            ));
            showToast(catalog.is_active ? 'Catalog deactivated — link is now inactive.' : 'Catalog activated — link is live again.');
            fetchStats();
        } else {
            showToast('Failed to update catalog status.', 'error');
        }
        setTogglingId(null);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete the catalog for "${name}"? This cannot be undone and will also remove all view records.`)) return;
        setDeletingId(id);
        const { error } = await supabase
            .from('shared_catalogs')
            .delete()
            .eq('id', id);

        if (!error) {
            setCatalogs(prev => prev.filter(c => c.id !== id));
            showToast('Catalog deleted successfully.');
            fetchStats();
        } else {
            showToast('Failed to delete catalog.', 'error');
        }
        setDeletingId(null);
    };

    const isCatalogExpired = (catalog: SharedCatalog): boolean => {
        if (!catalog.is_active) return true;
        if (catalog.expires_at && new Date(catalog.expires_at) < new Date()) return true;
        return false;
    };

    const filtered = catalogs;

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
        });

    const formatPrice = (p: number) => (p / 100000).toFixed(2);

    const publicBase = getOrigin();

    const STATS = [
        { label: 'Total Catalogs', value: totalCatalogsCount, icon: 'folder_shared', color: 'text-primary bg-primary/5' },
        { label: 'Active Links', value: activeCatalogsCount, icon: 'link', color: 'text-green-600 bg-green-50' },
        { label: 'Inactive / Expired', value: inactiveCatalogsCount, icon: 'link_off', color: 'text-red-500 bg-red-50' },
        { label: 'Total Views', value: totalViewsCount, icon: 'visibility', color: 'text-blue-600 bg-blue-50' },
    ];

    return (
        <div className="space-y-6">

            {/* Toast notification */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold transition-all ${
                    toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                    <span className="material-symbols-outlined text-lg">
                        {toast.type === 'success' ? 'check_circle' : 'error'}
                    </span>
                    {toast.msg}
                </div>
            )}

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-2xl">folder_shared</span>
                        Shared Catalogs
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Track and manage every personalized catalog created for customers</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        to="/admin/inventory"
                        className="h-9 px-4 flex items-center gap-1.5 text-sm font-semibold text-primary border border-primary/20 bg-primary/5 rounded-xl hover:bg-primary/10 transition-colors"
                    >
                        <span className="material-symbols-outlined text-base">add</span>
                        New Catalog
                    </Link>
                    <button
                        onClick={() => { setPage(0); fetchCatalogs(0, false, search); fetchStats(); }}
                        className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors"
                        title="Refresh"
                    >
                        <span className="material-symbols-outlined text-lg">refresh</span>
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {STATS.map(stat => (
                    <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-4 flex items-center gap-4">
                        <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                            <span className="material-symbols-outlined text-xl">{stat.icon}</span>
                        </div>
                        <div>
                            <p className="text-2xl font-black text-primary">{stat.value}</p>
                            <p className="text-xs text-slate-400 font-medium leading-tight mt-0.5">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-4">
                <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[18px]">search</span>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by customer name, phone number, or salesperson…"
                        className="w-full h-10 border border-slate-200 rounded-xl pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                    />
                </div>
            </div>

            {/* Catalogs Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">
                                <th className="text-left px-5 py-3.5">Customer</th>
                                <th className="text-left px-5 py-3.5">Cars</th>
                                <th className="text-left px-5 py-3.5">Views</th>
                                <th className="text-left px-5 py-3.5">Created By</th>
                                <th className="text-left px-5 py-3.5">Date</th>
                                <th className="text-left px-5 py-3.5">Status</th>
                                <th className="text-left px-5 py-3.5">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(6)].map((_, i) => (
                                    <tr key={i} className="border-b border-slate-50">
                                        {[140, 80, 50, 100, 110, 60, 100].map((w, j) => (
                                            <td key={j} className="px-5 py-4">
                                                <div className="h-4 bg-slate-100 rounded-lg animate-pulse" style={{ width: `${w}px` }} />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-20">
                                        <span className="material-symbols-outlined text-5xl text-slate-200 block mb-3">folder_shared</span>
                                        <p className="text-slate-400 font-semibold text-sm">
                                            {search
                                                ? 'No catalogs match your search'
                                                : 'No shared catalogs yet'}
                                        </p>
                                        {!search && (
                                            <p className="text-slate-300 text-xs mt-1 mb-4">
                                                Select multiple cars in Inventory, then click "Generate Shared Catalog"
                                            </p>
                                        )}
                                        <Link
                                            to="/admin/inventory"
                                            className="inline-flex items-center gap-1.5 mt-2 h-9 px-4 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-base">directions_car</span>
                                            Go to Inventory
                                        </Link>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(catalog => {
                                    const expired = isCatalogExpired(catalog);
                                    const viewCount = catalog.catalog_views?.length || 0;
                                    const carCount = catalog.items?.length || 0;
                                    const isExpanded = expandedId === catalog.id;

                                    return (
                                        <React.Fragment key={catalog.id}>
                                            {/* Main Row */}
                                            <tr
                                                className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-primary/3' : ''}`}
                                                onClick={() => setExpandedId(isExpanded ? null : catalog.id)}
                                            >
                                                {/* Customer */}
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className={`material-symbols-outlined text-base transition-transform ${isExpanded ? 'rotate-90 text-primary' : 'text-slate-300'}`}>
                                                            chevron_right
                                                        </span>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-800">{catalog.customer_name}</p>
                                                            {catalog.customer_phone && (
                                                                <p className="text-[11px] text-slate-400 mt-0.5">{catalog.customer_phone}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Car thumbnails + count */}
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex -space-x-2">
                                                            {(catalog.items || []).slice(0, 4).map((item, i) => (
                                                                <div key={i} className="size-7 rounded-full overflow-hidden border-2 border-white bg-slate-100 shrink-0 shadow-sm">
                                                                    {item.inventory?.thumbnail ? (
                                                                        <img src={item.inventory.thumbnail} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center bg-slate-200">
                                                                            <span className="material-symbols-outlined text-[10px] text-slate-400">directions_car</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <span className="text-sm font-bold text-slate-600">{carCount}</span>
                                                    </div>
                                                </td>

                                                {/* Views */}
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="material-symbols-outlined text-slate-400 text-[16px]">visibility</span>
                                                        <span className={`text-sm font-bold ${viewCount > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                                            {viewCount}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Created By */}
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm">
                                                            {(catalog.salesperson?.full_name ?? 'A').charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="text-sm text-slate-600 font-medium truncate max-w-[100px]">
                                                            {catalog.salesperson?.full_name ?? 'Admin'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Date */}
                                                <td className="px-5 py-3.5">
                                                    <p className="text-xs text-slate-500 whitespace-nowrap">{formatDate(catalog.created_at)}</p>
                                                </td>

                                                {/* Status */}
                                                <td className="px-5 py-3.5">
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                                                        expired
                                                            ? 'bg-red-50 text-red-600'
                                                            : 'bg-green-50 text-green-700'
                                                    }`}>
                                                        <span className={`size-1.5 rounded-full ${expired ? 'bg-red-400' : 'bg-green-500'}`} />
                                                        {expired
                                                            ? (catalog.is_active && catalog.expires_at ? 'Expired' : 'Inactive')
                                                            : 'Active'
                                                        }
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                                                    <div className="flex gap-0.5 items-center">
                                                        {/* Copy Link */}
                                                        <button
                                                            onClick={() => handleCopyLink(catalog.id)}
                                                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                                            title="Copy catalog link"
                                                        >
                                                            <span className={`material-symbols-outlined text-lg ${copiedId === catalog.id ? 'text-green-500' : 'text-slate-400'}`}>
                                                                {copiedId === catalog.id ? 'check_circle' : 'content_copy'}
                                                            </span>
                                                        </button>

                                                        {/* Preview in new tab */}
                                                        <a
                                                            href={`${publicBase}/shared-catalog/${catalog.id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                                            title="Preview catalog page"
                                                        >
                                                            <span className="material-symbols-outlined text-slate-400 text-lg">open_in_new</span>
                                                        </a>

                                                        {/* Toggle active */}
                                                        <button
                                                            onClick={() => handleToggleActive(catalog)}
                                                            disabled={!!togglingId}
                                                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                                                            title={catalog.is_active ? 'Deactivate link' : 'Reactivate link'}
                                                        >
                                                            {togglingId === catalog.id ? (
                                                                <span className="size-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin block" />
                                                            ) : (
                                                                <span className={`material-symbols-outlined text-lg ${catalog.is_active ? 'text-amber-500' : 'text-green-500'}`}>
                                                                    {catalog.is_active ? 'toggle_off' : 'toggle_on'}
                                                                </span>
                                                            )}
                                                        </button>

                                                        {/* Delete */}
                                                        <button
                                                            onClick={() => handleDelete(catalog.id, catalog.customer_name)}
                                                            disabled={deletingId === catalog.id}
                                                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                            title="Delete catalog"
                                                        >
                                                            {deletingId === catalog.id ? (
                                                                <span className="size-4 border-2 border-red-300 border-t-red-500 rounded-full animate-spin block" />
                                                            ) : (
                                                                <span className="material-symbols-outlined text-red-400 text-lg">delete</span>
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expanded Cars Row */}
                                            {isExpanded && (
                                                <tr className="bg-slate-50/70 border-b border-slate-100">
                                                    <td colSpan={7} className="px-6 py-5">
                                                        <div className="space-y-3">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                                                                    <span className="material-symbols-outlined text-sm text-primary">directions_car</span>
                                                                    {carCount} Vehicle{carCount !== 1 ? 's' : ''} in this catalog
                                                                </p>
                                                                {catalog.custom_message && (
                                                                    <p className="text-[11px] italic text-slate-500 text-right max-w-sm">
                                                                        "{catalog.custom_message}"
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {(catalog.items || []).map((item, i) => (
                                                                    <div key={i} className="flex flex-col gap-2 bg-white border border-slate-100 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow min-w-[240px] max-w-sm">
                                                                        <div className="flex items-center gap-2.5">
                                                                            <div className="size-11 rounded-lg overflow-hidden bg-slate-100 shrink-0 relative border border-slate-100">
                                                                                {item.inventory?.thumbnail ? (
                                                                                    <img src={item.inventory.thumbnail} alt="" className="w-full h-full object-cover" />
                                                                                ) : (
                                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                                        <span className="material-symbols-outlined text-slate-300 text-2xl">directions_car</span>
                                                                                    </div>
                                                                                )}
                                                                                {item.is_liked && (
                                                                                    <div className="absolute top-0 right-0 bg-rose-500 text-white rounded-bl-lg p-0.5 shadow-sm flex items-center justify-center">
                                                                                        <span className="material-symbols-outlined text-[10px] block font-bold">favorite</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="min-w-0 flex-1">
                                                                                <p className="text-xs font-bold text-slate-800 truncate">
                                                                                    {item.inventory
                                                                                        ? `${item.inventory.year} ${item.inventory.make} ${item.inventory.model}`
                                                                                        : 'Vehicle Deleted'
                                                                                    }
                                                                                </p>
                                                                                {item.inventory && (
                                                                                    <p className="text-[11px] text-slate-400 mt-0.5">₹ {formatPrice(item.inventory.price)} Lakh</p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        {item.comments && item.comments.length > 0 && (
                                                                            <div className="mt-1 pt-1.5 border-t border-slate-50 space-y-1">
                                                                                <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Comments</p>
                                                                                {item.comments.map((comment: string, idx: number) => (
                                                                                    <div key={idx} className="bg-slate-50 rounded-lg px-2 py-1 text-[11px] text-slate-600 border border-slate-100 leading-snug">
                                                                                        {comment}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {carCount === 0 && (
                                                                    <p className="text-xs text-slate-400 italic">No vehicles found in this catalog</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                {!loading && (
                    <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                        <p className="text-xs text-slate-400">
                            Showing {filtered.length} catalog{filtered.length !== 1 ? 's' : ''}
                            {hasMore && '+'}
                            {totalViewsCount > 0 && ` · ${totalViewsCount} total views`}
                        </p>
                        {hasMore && (
                            <button
                                onClick={handleLoadMore}
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
                )}
            </div>
        </div>
    );
};

export default SharedCatalogsAdmin;
