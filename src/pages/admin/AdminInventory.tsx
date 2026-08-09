import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ShareCarModal from '../../components/ShareCarModal';
import HighlightText from '../../components/ui/HighlightText';
import DownloadPhotosModal from '../../components/admin/DownloadPhotosModal';
import CreateSharedCatalogModal from '../../components/admin/CreateSharedCatalogModal';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Car {
    id: string;
    make: string;
    model: string;
    variant: string | null;
    year: number;
    price: number;
    mileage: number | null;
    fuel_type: string | null;
    transmission: string | null;
    color: string | null;
    body_type: string | null;
    ownership: number | null;
    description: string | null;
    features: string[] | null;
    status: string;
    source: string | null;
    dealer_id: string | null;
    consignment_owner_name: string | null;
    thumbnail: string | null;
    images: string[] | null;
    registration_no: string | null;
    created_at: string;
}

const statusColors: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    reserved: 'bg-amber-100 text-amber-700',
    sold: 'bg-slate-200 text-slate-500',
    pending: 'bg-blue-100 text-blue-700',
    archived: 'bg-slate-100 text-slate-400',
};

const tabs = ['All', 'available', 'reserved', 'sold', 'pending', 'archived'];

interface Dealer { id: string; dealer_code: string; name: string; }

// ─── Skeleton ────────────────────────────────────────────────────────────────
const SkeletonRow = () => (
    <tr className="border-b border-slate-50">
        {[...Array(7)].map((_, i) => (
            <td key={i} className="px-5 py-4">
                <div className="h-4 bg-slate-100 rounded-lg animate-pulse" style={{ width: i === 0 ? '180px' : '80px' }} />
            </td>
        ))}
    </tr>
);

// ─── Component ───────────────────────────────────────────────────────────────
const AdminInventory = () => {
    const { hasPermission } = useAuth();
    const canManage = hasPermission('inventory', 'manage');
    
    const [cars, setCars] = useState<Car[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Sync filter states with URL query parameters
    const [searchParams, setSearchParams] = useSearchParams();
    
    const activeTab = searchParams.get('tab') || 'All';
    const searchQuery = searchParams.get('search') || '';
    const dealerFilter = searchParams.get('dealer') || 'all';

    const setActiveTab = (tab: string) => {
        setSearchParams(prev => {
            if (tab === 'All') prev.delete('tab');
            else prev.set('tab', tab);
            return prev;
        });
    };

    const setSearchQuery = (query: string) => {
        setSearchParams(prev => {
            if (!query) prev.delete('search');
            else prev.set('search', query);
            return prev;
        });
    };

    const setDealerFilter = (dealer: string) => {
        setSearchParams(prev => {
            if (dealer === 'all') prev.delete('dealer');
            else prev.set('dealer', dealer);
            return prev;
        });
    };

    // Advanced filters parsed from searchParams
    const selectedMakes = useMemo(() => searchParams.get('makes')?.split(',').filter(Boolean) || [], [searchParams]);
    const selectedModels = useMemo(() => searchParams.get('models')?.split(',').filter(Boolean) || [], [searchParams]);
    const selectedYears = useMemo(() => searchParams.get('years')?.split(',').map(Number).filter(Boolean) || [], [searchParams]);
    const selectedFuels = useMemo(() => searchParams.get('fuels')?.split(',').filter(Boolean) || [], [searchParams]);
    const selectedTransmissions = useMemo(() => searchParams.get('transmissions')?.split(',').filter(Boolean) || [], [searchParams]);
    const selectedBodies = useMemo(() => searchParams.get('bodies')?.split(',').filter(Boolean) || [], [searchParams]);
    const selectedOwnerships = useMemo(() => searchParams.get('ownerships')?.split(',').map(Number).filter(n => !isNaN(n)) || [], [searchParams]);
    const selectedColors = useMemo(() => searchParams.get('colors')?.split(',').filter(Boolean) || [], [searchParams]);
    const priceMin = searchParams.get('price_min') || '';
    const priceMax = searchParams.get('price_max') || '';

    // Filter drawer and local UI states
    const [showFilterDrawer, setShowFilterDrawer] = useState(false);
    const [brandSearch, setBrandSearch] = useState('');
    const [modelSearch, setModelSearch] = useState('');
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        price: true,
        make: true,
        model: true,
        year: false,
        fuel: false,
        transmission: false,
        body: false,
        ownership: false,
        color: false,
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const toggleFilterList = (key: string, value: string | number) => {
        setSearchParams(prev => {
            const current = prev.get(key)?.split(',').filter(Boolean) || [];
            const valStr = String(value);
            let next: string[];
            if (current.includes(valStr)) {
                next = current.filter(x => x !== valStr);
            } else {
                next = [...current, valStr];
            }
            if (next.length === 0) {
                prev.delete(key);
            } else {
                prev.set(key, next.join(','));
            }
            return prev;
        });
    };

    const toggleMake = (make: string) => {
        setSearchParams(prev => {
            const currentMakes = prev.get('makes')?.split(',').filter(Boolean) || [];
            let nextMakes: string[];
            if (currentMakes.includes(make)) {
                nextMakes = currentMakes.filter(x => x !== make);
                // Clean up selected models of this make
                const currentModels = prev.get('models')?.split(',').filter(Boolean) || [];
                const modelsToRemove = new Set(cars.filter(c => c.make === make).map(c => c.model));
                const nextModels = currentModels.filter(m => !modelsToRemove.has(m));
                if (nextModels.length === 0) prev.delete('models');
                else prev.set('models', nextModels.join(','));
            } else {
                nextMakes = [...currentMakes, make];
            }
            if (nextMakes.length === 0) prev.delete('makes');
            else prev.set('makes', nextMakes.join(','));
            return prev;
        });
    };

    const handlePriceChange = (min: string, max: string) => {
        setSearchParams(prev => {
            if (!min) prev.delete('price_min');
            else prev.set('price_min', min);
            if (!max) prev.delete('price_max');
            else prev.set('price_max', max);
            return prev;
        });
    };

    const clearAllFilters = () => {
        setSearchParams(prev => {
            const tab = prev.get('tab');
            const search = prev.get('search');
            const dealer = prev.get('dealer');
            const next = new URLSearchParams();
            if (tab) next.set('tab', tab);
            if (search) next.set('search', search);
            if (dealer) next.set('dealer', dealer);
            return next;
        });
    };

    const activeFiltersCount = 
        selectedMakes.length + 
        selectedModels.length + 
        selectedYears.length + 
        selectedFuels.length + 
        selectedTransmissions.length + 
        selectedBodies.length + 
        selectedOwnerships.length + 
        selectedColors.length + 
        (priceMin ? 1 : 0) + 
        (priceMax ? 1 : 0);

    const [dealers, setDealers] = useState<Dealer[]>([]);
    const [dealerFilterOpen, setDealerFilterOpen] = useState(false);
    const [dealerFilterSearch, setDealerFilterSearch] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [shareCarId, setShareCarId] = useState<string | null>(null);
    const [downloadCarId, setDownloadCarId] = useState<string | null>(null);
    const [shareCounts, setShareCounts] = useState<Record<string, number>>({});
    const [selectedCarIds, setSelectedCarIds] = useState<string[]>([]);
    const [isSharedModalOpen, setIsSharedModalOpen] = useState(false);

    useEffect(() => {
        supabase.from('dealers').select('id, dealer_code, name').then(({ data }) => {
            if (data) {
                const sorted = (data as Dealer[]).sort((a, b) => {
                    const numA = parseInt(a.dealer_code.replace(/\D/g, '')) || 0;
                    const numB = parseInt(b.dealer_code.replace(/\D/g, '')) || 0;
                    return numA - numB;
                });
                setDealers(sorted);
            }
        });
    }, []);

    // Fetch share counts per car
    const fetchShareCounts = async () => {
        const { data } = await supabase
            .from('inventory_shares')
            .select('inventory_id');
        if (data) {
            const counts: Record<string, number> = {};
            data.forEach((row: { inventory_id: string }) => {
                counts[row.inventory_id] = (counts[row.inventory_id] || 0) + 1;
            });
            setShareCounts(counts);
        }
    };

    useEffect(() => { fetchShareCounts(); }, []);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchCars = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) setCars(data as Car[]);
        setLoading(false);
        fetchShareCounts();
    };

    useEffect(() => { fetchCars(); }, []);

    const handleDelete = async (id: string, make: string, model: string) => {
        if (!confirm(`Delete ${make} ${model}? This will permanently remove it from the inventory.`)) return;
        setDeletingId(id);
        const { error } = await supabase.from('inventory').delete().eq('id', id);
        if (error) {
            showToast('Failed to delete car. Please try again.', 'error');
        } else {
            showToast(`${make} ${model} deleted successfully.`);
            setCars(prev => prev.filter(c => c.id !== id));
        }
        setDeletingId(null);
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        const { error } = await supabase
            .from('inventory')
            .update({ status: newStatus })
            .eq('id', id);
        if (error) {
            showToast('Failed to update status.', 'error');
        } else {
            setCars(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
            showToast('Status updated.');
        }
    };

    // Dynamic option count facets based on current active tab and dealer source
    const facets = useMemo(() => {
        const baseCars = cars.filter(c => {
            const matchTab = activeTab === 'All' || c.status === activeTab;
            const matchDealer = dealerFilter === 'all'
                ? true
                : dealerFilter === 'purchased'
                    ? (!c.source || c.source === 'purchased' || c.source === 'own')
                : dealerFilter === 'consignment'
                    ? c.source === 'consignment'
                : dealerFilter === 'dealer'
                    ? c.source === 'dealer'
                    : c.dealer_id === dealerFilter;
            return matchTab && matchDealer;
        });

        const makes: Record<string, number> = {};
        const models: Record<string, number> = {};
        const years: Record<number, number> = {};
        const fuels: Record<string, number> = {};
        const transmissions: Record<string, number> = {};
        const bodies: Record<string, number> = {};
        const ownerships: Record<number, number> = {};
        const colors: Record<string, number> = {};

        baseCars.forEach(c => {
            if (c.make) makes[c.make] = (makes[c.make] || 0) + 1;
            if (c.model) models[c.model] = (models[c.model] || 0) + 1;
            if (c.year) years[c.year] = (years[c.year] || 0) + 1;
            if (c.fuel_type) fuels[c.fuel_type] = (fuels[c.fuel_type] || 0) + 1;
            if (c.transmission) transmissions[c.transmission] = (transmissions[c.transmission] || 0) + 1;
            if (c.body_type) bodies[c.body_type] = (bodies[c.body_type] || 0) + 1;
            if (c.ownership !== null && c.ownership !== undefined) {
                ownerships[c.ownership] = (ownerships[c.ownership] || 0) + 1;
            }
            if (c.color) colors[c.color] = (colors[c.color] || 0) + 1;
        });

        return { makes, models, years, fuels, transmissions, bodies, ownerships, colors };
    }, [cars, activeTab, dealerFilter]);

    const filtered = cars.filter(c => {
        // Status tab
        const matchTab = activeTab === 'All' || c.status === activeTab;
        
        // Search query
        const q = searchQuery.toLowerCase();
        const matchSearch = !q || `${c.make} ${c.model} ${c.variant ?? ''} ${c.registration_no ?? ''}`.toLowerCase().includes(q);
        
        // Dealer source
        const matchDealer = dealerFilter === 'all'
            ? true
            : dealerFilter === 'purchased'
                ? (!c.source || c.source === 'purchased' || c.source === 'own')
            : dealerFilter === 'consignment'
                ? c.source === 'consignment'
            : dealerFilter === 'dealer'
                ? c.source === 'dealer'
                : c.dealer_id === dealerFilter;

        // Makes (Brands)
        if (selectedMakes.length > 0 && !selectedMakes.includes(c.make)) return false;

        // Models
        if (selectedModels.length > 0 && !selectedModels.includes(c.model)) return false;

        // Years
        if (selectedYears.length > 0 && !selectedYears.includes(c.year)) return false;

        // Fuel types
        if (selectedFuels.length > 0 && (!c.fuel_type || !selectedFuels.includes(c.fuel_type))) return false;

        // Transmissions
        if (selectedTransmissions.length > 0 && (!c.transmission || !selectedTransmissions.includes(c.transmission))) return false;

        // Body types
        if (selectedBodies.length > 0 && (!c.body_type || !selectedBodies.includes(c.body_type))) return false;

        // Ownerships
        if (selectedOwnerships.length > 0 && (c.ownership === null || !selectedOwnerships.includes(c.ownership))) return false;

        // Colors
        if (selectedColors.length > 0 && (!c.color || !selectedColors.includes(c.color))) return false;

        // Price range (min and max in Lakhs in query param, stored in absolute rupees in DB)
        const priceLakhs = c.price / 100000;
        if (priceMin && priceLakhs < parseFloat(priceMin)) return false;
        if (priceMax && priceLakhs > parseFloat(priceMax)) return false;

        return matchTab && matchSearch && matchDealer;
    });


    const tabCount = (tab: string) => tab === 'All' ? cars.length : cars.filter(c => c.status === tab).length;

    return (
        <div className="space-y-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    <span className="material-symbols-outlined text-lg">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Inventory Management</h1>
                    <p className="text-slate-500 text-sm">
                        {loading ? 'Loading…' : `${cars.length} vehicles · ${cars.filter(c => c.status === 'available').length} available`}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchCars} className="h-10 w-10 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors" title="Refresh">
                        <span className="material-symbols-outlined text-lg">refresh</span>
                    </button>
                    {canManage && (
                        <Link to="/admin/inventory/new" className="h-10 px-5 bg-accent text-primary font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-accent-hover transition-colors shadow-sm">
                            <span className="material-symbols-outlined text-lg">add</span> Add New Car
                        </Link>
                    )}
                </div>
            </div>

            {/* Search + Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-1 border-b border-slate-200">
                    {tabs.map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2.5 text-sm font-medium border-b-2 capitalize transition-all ${activeTab === tab ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}
                        >
                            {tab === 'All' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}{' '}
                            <span className="text-xs text-slate-400 ml-0.5">({tabCount(tab)})</span>
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    {/* Searchable Dealer Filter */}
                    <div className="relative z-20" onBlur={e => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDealerFilterOpen(false);
                        }
                    }}>
                        <button
                            type="button"
                            onClick={() => setDealerFilterOpen(p => !p)}
                            className="h-10 border border-slate-200 rounded-xl px-3 text-sm text-slate-600 bg-white flex items-center justify-between gap-2 min-w-[160px] max-w-[220px] outline-none focus:ring-2 focus:ring-primary/10"
                        >
                            <span className="truncate">
                                {dealerFilter === 'all' ? 'All Sources' :
                                 dealerFilter === 'purchased' ? 'Purchased' :
                                 dealerFilter === 'consignment' ? 'Consignment' :
                                 dealerFilter === 'dealer' ? 'All Dealer Cars' :
                                 dealers.find(d => d.id === dealerFilter) ? `${dealers.find(d => d.id === dealerFilter)?.dealer_code} — ${dealers.find(d => d.id === dealerFilter)?.name}` : 'All Sources'}
                            </span>
                            <span className="material-symbols-outlined text-[18px] text-slate-400">expand_more</span>
                        </button>
                        
                        {dealerFilterOpen && (
                            <div className="absolute top-full mt-1 right-0 sm:left-0 sm:right-auto w-64 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col">
                                <div className="p-2 border-b border-slate-100">
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">search</span>
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Search dealers or sources..."
                                            value={dealerFilterSearch}
                                            onChange={e => setDealerFilterSearch(e.target.value)}
                                            className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                        />
                                    </div>
                                </div>
                                <div className="max-h-60 overflow-y-auto py-1">
                                    {(() => {
                                        const q = dealerFilterSearch.toLowerCase().trim();
                                        const options: Array<{ id: string; label: string; type: string; code?: string; name?: string }> = [
                                            { id: 'all', label: 'All Sources', type: 'base' },
                                            { id: 'purchased', label: 'Purchased', type: 'base' },
                                            { id: 'consignment', label: 'Consignment', type: 'base' },
                                            { id: 'dealer', label: 'All Dealer Cars', type: 'base' },
                                            ...dealers.map(d => ({ id: d.id, label: `${d.dealer_code} — ${d.name}`, code: d.dealer_code, name: d.name, type: 'dealer' }))
                                        ];
                                        
                                        const filtered = options.filter(o => 
                                            !q || 
                                            o.label.toLowerCase().includes(q) || 
                                            (o.type === 'dealer' && (o.code?.toLowerCase().includes(q) || o.name?.toLowerCase().includes(q)))
                                        );

                                        if (filtered.length === 0) return <div className="px-3 py-2 text-xs text-slate-400">No results found</div>;
                                        
                                        return filtered.map(o => (
                                            <button
                                                key={o.id}
                                                type="button"
                                                onClick={() => {
                                                    setDealerFilter(o.id);
                                                    setDealerFilterOpen(false);
                                                    setDealerFilterSearch('');
                                                }}
                                                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between ${
                                                    dealerFilter === o.id ? 'bg-primary/5 text-primary font-semibold' : 'text-slate-700'
                                                }`}
                                            >
                                                <span className="truncate">{o.label}</span>
                                                {dealerFilter === o.id && <span className="material-symbols-outlined text-primary text-[16px]">check</span>}
                                            </button>
                                        ));
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="relative max-w-xs w-full">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">search</span>
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by make, model, reg…"
                            className="w-full h-10 border border-slate-200 rounded-xl pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                        />
                    </div>
                    {/* Drawer Toggle Button */}
                    <button
                        onClick={() => setShowFilterDrawer(true)}
                        className={`h-10 px-4 rounded-xl text-sm font-semibold flex items-center gap-2 border transition-all shrink-0 cursor-pointer ${
                            activeFiltersCount > 0
                                ? 'bg-primary/5 text-primary border-primary hover:bg-primary/10'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[18px]">filter_alt</span>
                        <span>Filters</span>
                        {activeFiltersCount > 0 && (
                            <span className="flex items-center justify-center size-5 rounded-full bg-primary text-white text-[10px] font-bold">
                                {activeFiltersCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Active Filters Pills */}
            {activeFiltersCount > 0 && (
                <div className="flex flex-wrap gap-2 items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100 animate-fade-in">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">Active Filters:</span>
                    
                    {selectedMakes.map(m => (
                        <span key={m} className="inline-flex items-center gap-1 bg-white text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                            Make: {m}
                            <button onClick={() => toggleMake(m)} className="hover:bg-slate-100 rounded-full p-0.5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors ml-0.5">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </span>
                    ))}

                    {selectedModels.map(m => (
                        <span key={m} className="inline-flex items-center gap-1 bg-white text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                            Model: {m}
                            <button onClick={() => toggleFilterList('models', m)} className="hover:bg-slate-100 rounded-full p-0.5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors ml-0.5">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </span>
                    ))}

                    {selectedYears.map(y => (
                        <span key={y} className="inline-flex items-center gap-1 bg-white text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                            Year: {y}
                            <button onClick={() => toggleFilterList('years', y)} className="hover:bg-slate-100 rounded-full p-0.5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors ml-0.5">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </span>
                    ))}

                    {selectedFuels.map(f => (
                        <span key={f} className="inline-flex items-center gap-1 bg-white text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                            Fuel: {f}
                            <button onClick={() => toggleFilterList('fuels', f)} className="hover:bg-slate-100 rounded-full p-0.5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors ml-0.5">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </span>
                    ))}

                    {selectedTransmissions.map(t => (
                        <span key={t} className="inline-flex items-center gap-1 bg-white text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                            Trans: {t}
                            <button onClick={() => toggleFilterList('transmissions', t)} className="hover:bg-slate-100 rounded-full p-0.5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors ml-0.5">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </span>
                    ))}

                    {selectedBodies.map(b => (
                        <span key={b} className="inline-flex items-center gap-1 bg-white text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                            Body: {b}
                            <button onClick={() => toggleFilterList('bodies', b)} className="hover:bg-slate-100 rounded-full p-0.5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors ml-0.5">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </span>
                    ))}

                    {selectedOwnerships.map(o => (
                        <span key={o} className="inline-flex items-center gap-1 bg-white text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                            Owners: {o === 1 ? '1st Owner' : o === 2 ? '2nd Owner' : o === 3 ? '3rd Owner' : `${o} Owners`}
                            <button onClick={() => toggleFilterList('ownerships', o)} className="hover:bg-slate-100 rounded-full p-0.5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors ml-0.5">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </span>
                    ))}

                    {selectedColors.map(c => (
                        <span key={c} className="inline-flex items-center gap-1 bg-white text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                            Color: {c}
                            <button onClick={() => toggleFilterList('colors', c)} className="hover:bg-slate-100 rounded-full p-0.5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors ml-0.5">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </span>
                    ))}

                    {priceMin && (
                        <span className="inline-flex items-center gap-1 bg-white text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                            Min: ₹{priceMin}L
                            <button onClick={() => handlePriceChange('', priceMax)} className="hover:bg-slate-100 rounded-full p-0.5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors ml-0.5">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </span>
                    )}

                    {priceMax && (
                        <span className="inline-flex items-center gap-1 bg-white text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                            Max: ₹{priceMax}L
                            <button onClick={() => handlePriceChange(priceMin, '')} className="hover:bg-slate-100 rounded-full p-0.5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors ml-0.5">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </span>
                    )}

                    <button
                        onClick={clearAllFilters}
                        className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors px-2 py-1 ml-auto cursor-pointer"
                    >
                        Clear All
                    </button>
                </div>
            )}


            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                <div className="overflow-x-auto relative">
                <table className="w-full min-w-[750px]">
                    <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                            {canManage && (
                                <th className="px-5 py-3 text-left w-10">
                                    <input 
                                        type="checkbox"
                                        checked={selectedCarIds.length > 0 && selectedCarIds.length === filtered.length}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedCarIds(filtered.map(c => c.id));
                                            } else {
                                                setSelectedCarIds([]);
                                            }
                                        }}
                                        className="rounded border-slate-300 text-primary focus:ring-primary size-4 cursor-pointer"
                                    />
                                </th>
                            )}
                            <th className="text-left px-5 py-3">Vehicle</th>
                            <th className="text-left px-5 py-3">Price</th>
                            <th className="text-left px-5 py-3">Details</th>
                            <th className="text-left px-5 py-3">Mileage</th>
                            <th className="text-left px-5 py-3">Status</th>
                            <th className="text-left px-5 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center py-16">
                                    <span className="material-symbols-outlined text-4xl text-slate-200 mb-3 block">directions_car</span>
                                    <p className="text-slate-400 font-medium text-sm">
                                        {searchQuery ? `No results for "${searchQuery}"` : 'No vehicles in this category'}
                                    </p>
                                    <Link to="/admin/inventory/new" className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-accent hover:underline">
                                        <span className="material-symbols-outlined text-base">add</span> Add first car
                                    </Link>
                                </td>
                            </tr>
                        ) : (
                            filtered.map(car => (
                                <tr key={car.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    {canManage && (
                                        <td className="px-5 py-3.5 w-10">
                                            <input 
                                                type="checkbox"
                                                checked={selectedCarIds.includes(car.id)}
                                                onChange={() => {
                                                    if (selectedCarIds.includes(car.id)) {
                                                        setSelectedCarIds(selectedCarIds.filter(id => id !== car.id));
                                                    } else {
                                                        setSelectedCarIds([...selectedCarIds, car.id]);
                                                    }
                                                }}
                                                className="rounded border-slate-300 text-primary focus:ring-primary size-4 cursor-pointer"
                                            />
                                        </td>
                                    )}
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className="size-12 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                                                {car.thumbnail ? (
                                                    <img src={car.thumbnail} alt={`${car.make} ${car.model}`} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-slate-300 text-2xl">directions_car</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-primary">
                                                    {car.year} <HighlightText text={car.make} highlight={searchQuery} /> <HighlightText text={car.model} highlight={searchQuery} />
                                                </p>
                                                {car.variant && <p className="text-xs text-slate-400"><HighlightText text={car.variant} highlight={searchQuery} /></p>}
                                                {car.registration_no && <p className="text-[10px] text-slate-400 font-mono"><HighlightText text={car.registration_no} highlight={searchQuery} /></p>}
                                                {/* Source badge */}
                                                {car.source === 'dealer' ? (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide mt-0.5" title="Dealer Car">
                                                        <span className="material-symbols-outlined text-[10px]">store</span>
                                                        {dealers.find(d => d.id === car.dealer_id)?.dealer_code || 'Dealer'}
                                                    </span>
                                                ) : car.source === 'consignment' ? (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 uppercase tracking-wide mt-0.5" title={`Consignment: ${car.consignment_owner_name || 'Owner'}`}>
                                                        <span className="material-symbols-outlined text-[10px]">handshake</span>
                                                        {car.consignment_owner_name || 'Consignment'}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wide mt-0.5" title="Purchased by us">
                                                        <span className="material-symbols-outlined text-[10px]">home</span>
                                                        Purchased
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <p className="text-sm font-bold text-primary">₹{(car.price / 100000).toFixed(2)}L</p>
                                    </td>
                                    <td className="px-5 py-3.5 text-sm text-slate-500">
                                        {car.fuel_type ?? '—'} · {car.transmission ?? '—'}
                                    </td>
                                    <td className="px-5 py-3.5 text-sm text-slate-500">
                                        {car.mileage ? `${car.mileage.toLocaleString('en-IN')} km` : '—'}
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <select
                                            value={car.status}
                                            onChange={e => handleStatusChange(car.id, e.target.value)}
                                            disabled={!canManage}
                                            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-full uppercase border-0 outline-none ${canManage ? 'cursor-pointer' : 'cursor-default opacity-80'} ${statusColors[car.status] ?? 'bg-slate-100 text-slate-500'}`}
                                        >
                                            {['available', 'reserved', 'sold', 'pending', 'archived'].map(s => (
                                                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex gap-1 items-center">
                                            {/* WhatsApp Share button */}
                                            <button
                                                onClick={() => setShareCarId(car.id)}
                                                className="relative p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                                                title="Share on WhatsApp"
                                            >
                                                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-green-500">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                </svg>
                                                {shareCounts[car.id] > 0 && (
                                                    <span className="absolute -top-1 -right-1 size-4 bg-green-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                                        {shareCounts[car.id] > 9 ? '9+' : shareCounts[car.id]}
                                                    </span>
                                                )}
                                            </button>
                                            {canManage && (
                                                <Link to={`/admin/inventory/${car.id}/edit`} className="p-1.5 hover:bg-slate-100 rounded-lg" title="Edit">
                                                    <span className="material-symbols-outlined text-slate-400 text-lg">edit</span>
                                                </Link>
                                            )}
                                            <button
                                                onClick={() => setDownloadCarId(car.id)}
                                                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                                title="Download Photos"
                                            >
                                                <span className="material-symbols-outlined text-slate-400 text-lg">download</span>
                                            </button>
                                            <Link to={`/car/${car.id}`} target="_blank" className="p-1.5 hover:bg-slate-100 rounded-lg" title="View on website">
                                                <span className="material-symbols-outlined text-slate-400 text-lg">open_in_new</span>
                                            </Link>
                                            {canManage && (
                                                <button
                                                    onClick={() => handleDelete(car.id, car.make, car.model)}
                                                    disabled={deletingId === car.id}
                                                    className={`p-1.5 rounded-lg transition-colors hover:bg-red-50 text-red-500`}
                                                    title="Delete Vehicle"
                                                >
                                                    {deletingId === car.id
                                                        ? <span className="size-4 border-2 border-red-300 border-t-red-500 rounded-full animate-spin block" />
                                                        : <span className="material-symbols-outlined text-lg">delete</span>
                                                    }
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </div>
            </div>

            {/* Share Modal */}
            {shareCarId && (() => {
                const car = cars.find(c => c.id === shareCarId);
                return car ? (
                    <ShareCarModal
                        car={car}
                        onClose={() => {
                            setShareCarId(null);
                            fetchShareCounts();
                        }}
                    />
                ) : null;
            })()}

            {/* Download Modal */}
            {downloadCarId && (() => {
                const car = cars.find(c => c.id === downloadCarId);
                return car ? (
                    <DownloadPhotosModal
                        car={car}
                        isOpen={true}
                        onClose={() => setDownloadCarId(null)}
                    />
                ) : null;
            })()}

            {/* Shared Catalog Modal */}
            <CreateSharedCatalogModal
                isOpen={isSharedModalOpen}
                onClose={() => setIsSharedModalOpen(false)}
                selectedCarIds={selectedCarIds}
                onSuccess={() => setSelectedCarIds([])}
            />

            {/* Sticky Shared Action Bar */}
            {selectedCarIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl px-6 py-4 flex items-center gap-6 shadow-2xl border border-slate-800 animate-slide-up">
                    <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">
                        {selectedCarIds.length} {selectedCarIds.length === 1 ? 'car' : 'cars'} selected
                    </span>
                    <div className="h-4 w-px bg-slate-700 shrink-0" />
                    <button
                        onClick={() => setIsSharedModalOpen(true)}
                        className="flex items-center gap-2 h-9 px-4 bg-accent text-primary rounded-xl text-xs font-bold hover:bg-accent/80 transition-colors shrink-0"
                    >
                        <span className="material-symbols-outlined text-sm">share</span> Generate Shared Catalog
                    </button>
                    <button
                        onClick={() => setSelectedCarIds([])}
                        className="text-xs text-slate-400 hover:text-white font-semibold whitespace-nowrap shrink-0"
                    >
                        Deselect All
                    </button>
                </div>
            )}

            {/* Filter Drawer */}
            <AnimatePresence>
                {showFilterDrawer && (
                    <>
                        {/* Backdrop overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowFilterDrawer(false)}
                            className="fixed inset-0 bg-black/40 z-50 cursor-pointer"
                        />
                        {/* Drawer body */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-full max-w-[420px] bg-white z-50 shadow-2xl flex flex-col h-full border-l border-slate-200 overflow-hidden"
                        >
                            {/* Drawer Header */}
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div>
                                    <h3 className="font-bold text-primary text-base">Filter Inventory</h3>
                                    {activeFiltersCount > 0 && (
                                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{activeFiltersCount} active filter{activeFiltersCount !== 1 ? 's' : ''}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {activeFiltersCount > 0 && (
                                        <button
                                            onClick={clearAllFilters}
                                            className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                                        >
                                            Clear All
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowFilterDrawer(false)}
                                        className="size-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-500 hover:text-primary transition-colors cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-lg">close</span>
                                    </button>
                                </div>
                            </div>

                            {/* Drawer Filters Body */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                
                                {/* Section: Price / Budget */}
                                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                                    <button
                                        onClick={() => toggleSection('price')}
                                        className="w-full p-3.5 flex items-center justify-between text-sm font-bold text-primary hover:bg-slate-50/50 transition-colors cursor-pointer outline-none"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-slate-400 text-[18px]">currency_rupee</span>
                                            Price / Budget
                                        </span>
                                        <span className="material-symbols-outlined text-slate-400 text-lg transition-transform" style={{ transform: expandedSections.price ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                                    </button>
                                    {expandedSections.price && (
                                        <div className="p-4 border-t border-slate-100 bg-slate-50/20 space-y-4">
                                            {/* Quick budget presets */}
                                            <div className="flex flex-wrap gap-1.5">
                                                {[
                                                    { label: 'Under 3L', value: '3' },
                                                    { label: 'Under 5L', value: '5' },
                                                    { label: 'Under 10L', value: '10' },
                                                    { label: 'Under 15L', value: '15' },
                                                    { label: 'Under 20L', value: '20' },
                                                    { label: 'Under 30L', value: '30' },
                                                ].map(b => (
                                                    <button
                                                        key={b.label}
                                                        onClick={() => handlePriceChange('', b.value)}
                                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                                            priceMax === b.value && !priceMin
                                                                ? 'bg-primary text-white border-primary'
                                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                                        }`}
                                                    >
                                                        {b.label}
                                                    </button>
                                                ))}
                                            </div>
                                            {/* Custom Price Range */}
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Min (Lakhs)</label>
                                                    <input
                                                        type="number"
                                                        value={priceMin}
                                                        onChange={e => handlePriceChange(e.target.value, priceMax)}
                                                        placeholder="e.g. 2.5"
                                                        className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Max (Lakhs)</label>
                                                    <input
                                                        type="number"
                                                        value={priceMax}
                                                        onChange={e => handlePriceChange(priceMin, e.target.value)}
                                                        placeholder="e.g. 8.5"
                                                        className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Section: Brand (Make) */}
                                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                                    <button
                                        onClick={() => toggleSection('make')}
                                        className="w-full p-3.5 flex items-center justify-between text-sm font-bold text-primary hover:bg-slate-50/50 transition-colors cursor-pointer outline-none"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-slate-400 text-[18px]">directions_car</span>
                                            Brand / Make
                                        </span>
                                        <span className="material-symbols-outlined text-slate-400 text-lg transition-transform" style={{ transform: expandedSections.make ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                                    </button>
                                    {expandedSections.make && (
                                        <div className="p-3 border-t border-slate-100 bg-slate-50/20 space-y-3">
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">search</span>
                                                <input
                                                    type="text"
                                                    placeholder="Search brands..."
                                                    value={brandSearch}
                                                    onChange={e => setBrandSearch(e.target.value)}
                                                    className="w-full h-8 bg-white border border-slate-200 rounded-lg pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                                />
                                            </div>
                                            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                                                {(() => {
                                                    const makeKeys = Object.keys(facets.makes).filter(m => m.toLowerCase().includes(brandSearch.toLowerCase().trim()));
                                                    if (makeKeys.length === 0) return <p className="text-[11px] text-slate-400 italic p-1">No brands found</p>;
                                                    return makeKeys.sort().map(m => (
                                                        <label key={m} className="flex items-center gap-2.5 cursor-pointer py-0.5 group">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedMakes.includes(m)}
                                                                onChange={() => toggleMake(m)}
                                                                className="rounded border-slate-300 text-primary focus:ring-primary size-4 cursor-pointer"
                                                            />
                                                            <span className="text-xs text-slate-700 group-hover:text-primary transition-colors flex-1 truncate">{m}</span>
                                                            <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 font-bold shrink-0">{facets.makes[m]}</span>
                                                        </label>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Section: Model */}
                                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                                    <button
                                        onClick={() => toggleSection('model')}
                                        className="w-full p-3.5 flex items-center justify-between text-sm font-bold text-primary hover:bg-slate-50/50 transition-colors cursor-pointer outline-none"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-slate-400 text-[18px]">car_tag</span>
                                            Model
                                        </span>
                                        <span className="material-symbols-outlined text-slate-400 text-lg transition-transform" style={{ transform: expandedSections.model ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                                    </button>
                                    {expandedSections.model && (
                                        <div className="p-3 border-t border-slate-100 bg-slate-50/20 space-y-3">
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">search</span>
                                                <input
                                                    type="text"
                                                    placeholder="Search models..."
                                                    value={modelSearch}
                                                    onChange={e => setModelSearch(e.target.value)}
                                                    className="w-full h-8 bg-white border border-slate-200 rounded-lg pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                                />
                                            </div>
                                            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                                                {(() => {
                                                    const availableModels = Object.keys(facets.models).filter(m => {
                                                        if (selectedMakes.length > 0) {
                                                            return cars.some(c => c.model === m && selectedMakes.includes(c.make));
                                                        }
                                                        return true;
                                                    });

                                                    const filteredModels = availableModels.filter(m => m.toLowerCase().includes(modelSearch.toLowerCase().trim()));
                                                    if (filteredModels.length === 0) return <p className="text-[11px] text-slate-400 italic p-1">No models found</p>;
                                                    
                                                    return filteredModels.sort().map(m => (
                                                        <label key={m} className="flex items-center gap-2.5 cursor-pointer py-0.5 group">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedModels.includes(m)}
                                                                onChange={() => toggleFilterList('models', m)}
                                                                className="rounded border-slate-300 text-primary focus:ring-primary size-4 cursor-pointer"
                                                            />
                                                            <span className="text-xs text-slate-700 group-hover:text-primary transition-colors flex-1 truncate">{m}</span>
                                                            <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 font-bold shrink-0">{facets.models[m]}</span>
                                                        </label>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Section: Model Year */}
                                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                                    <button
                                        onClick={() => toggleSection('year')}
                                        className="w-full p-3.5 flex items-center justify-between text-sm font-bold text-primary hover:bg-slate-50/50 transition-colors cursor-pointer outline-none"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-slate-400 text-[18px]">calendar_month</span>
                                            Model Year
                                        </span>
                                        <span className="material-symbols-outlined text-slate-400 text-lg transition-transform" style={{ transform: expandedSections.year ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                                    </button>
                                    {expandedSections.year && (
                                        <div className="p-3 border-t border-slate-100 bg-slate-50/20 pr-1">
                                            <div className="max-h-40 overflow-y-auto space-y-2">
                                                {Object.keys(facets.years).map(Number).sort((a,b) => b-a).map(y => (
                                                    <label key={y} className="flex items-center gap-2.5 cursor-pointer py-0.5 group">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedYears.includes(y)}
                                                            onChange={() => toggleFilterList('years', y)}
                                                            className="rounded border-slate-300 text-primary focus:ring-primary size-4 cursor-pointer"
                                                        />
                                                        <span className="text-xs text-slate-700 group-hover:text-primary transition-colors flex-1">{y}</span>
                                                        <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 font-bold shrink-0">{facets.years[y]}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Section: Fuel Type */}
                                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                                    <button
                                        onClick={() => toggleSection('fuel')}
                                        className="w-full p-3.5 flex items-center justify-between text-sm font-bold text-primary hover:bg-slate-50/50 transition-colors cursor-pointer outline-none"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-slate-400 text-[18px]">local_gas_station</span>
                                            Fuel Type
                                        </span>
                                        <span className="material-symbols-outlined text-slate-400 text-lg transition-transform" style={{ transform: expandedSections.fuel ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                                    </button>
                                    {expandedSections.fuel && (
                                        <div className="p-3 border-t border-slate-100 bg-slate-50/20 pr-1 space-y-2">
                                            {Object.keys(facets.fuels).sort().map(f => (
                                                <label key={f} className="flex items-center gap-2.5 cursor-pointer py-0.5 group">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedFuels.includes(f)}
                                                        onChange={() => toggleFilterList('fuels', f)}
                                                        className="rounded border-slate-300 text-primary focus:ring-primary size-4 cursor-pointer"
                                                    />
                                                    <span className="text-xs text-slate-700 group-hover:text-primary transition-colors flex-1">{f}</span>
                                                    <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 font-bold shrink-0">{facets.fuels[f]}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Section: Transmission */}
                                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                                    <button
                                        onClick={() => toggleSection('transmission')}
                                        className="w-full p-3.5 flex items-center justify-between text-sm font-bold text-primary hover:bg-slate-50/50 transition-colors cursor-pointer outline-none"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-slate-400 text-[18px]">settings_input_hdmi</span>
                                            Transmission
                                        </span>
                                        <span className="material-symbols-outlined text-slate-400 text-lg transition-transform" style={{ transform: expandedSections.transmission ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                                    </button>
                                    {expandedSections.transmission && (
                                        <div className="p-3 border-t border-slate-100 bg-slate-50/20 pr-1 space-y-2">
                                            {Object.keys(facets.transmissions).sort().map(t => (
                                                <label key={t} className="flex items-center gap-2.5 cursor-pointer py-0.5 group">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTransmissions.includes(t)}
                                                        onChange={() => toggleFilterList('transmissions', t)}
                                                        className="rounded border-slate-300 text-primary focus:ring-primary size-4 cursor-pointer"
                                                    />
                                                    <span className="text-xs text-slate-700 group-hover:text-primary transition-colors flex-1">{t}</span>
                                                    <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 font-bold shrink-0">{facets.transmissions[t]}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Section: Body Type */}
                                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                                    <button
                                        onClick={() => toggleSection('body')}
                                        className="w-full p-3.5 flex items-center justify-between text-sm font-bold text-primary hover:bg-slate-50/50 transition-colors cursor-pointer outline-none"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-slate-400 text-[18px]">airport_shuttle</span>
                                            Body Type
                                        </span>
                                        <span className="material-symbols-outlined text-slate-400 text-lg transition-transform" style={{ transform: expandedSections.body ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                                    </button>
                                    {expandedSections.body && (
                                        <div className="p-3 border-t border-slate-100 bg-slate-50/20 pr-1 space-y-2">
                                            {Object.keys(facets.bodies).sort().map(b => (
                                                <label key={b} className="flex items-center gap-2.5 cursor-pointer py-0.5 group">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedBodies.includes(b)}
                                                        onChange={() => toggleFilterList('bodies', b)}
                                                        className="rounded border-slate-300 text-primary focus:ring-primary size-4 cursor-pointer"
                                                    />
                                                    <span className="text-xs text-slate-700 group-hover:text-primary transition-colors flex-1">{b}</span>
                                                    <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 font-bold shrink-0">{facets.bodies[b]}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Section: Ownership */}
                                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                                    <button
                                        onClick={() => toggleSection('ownership')}
                                        className="w-full p-3.5 flex items-center justify-between text-sm font-bold text-primary hover:bg-slate-50/50 transition-colors cursor-pointer outline-none"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-slate-400 text-[18px]">person</span>
                                            Ownership
                                        </span>
                                        <span className="material-symbols-outlined text-slate-400 text-lg transition-transform" style={{ transform: expandedSections.ownership ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                                    </button>
                                    {expandedSections.ownership && (
                                        <div className="p-3 border-t border-slate-100 bg-slate-50/20 pr-1 space-y-2">
                                            {Object.keys(facets.ownerships).map(Number).sort().map(o => (
                                                <label key={o} className="flex items-center gap-2.5 cursor-pointer py-0.5 group">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedOwnerships.includes(o)}
                                                        onChange={() => toggleFilterList('ownerships', o)}
                                                        className="rounded border-slate-300 text-primary focus:ring-primary size-4 cursor-pointer"
                                                    />
                                                    <span className="text-xs text-slate-700 group-hover:text-primary transition-colors flex-1">
                                                        {o === 1 ? '1st Owner' : o === 2 ? '2nd Owner' : o === 3 ? '3rd Owner' : `${o} Owners`}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 font-bold shrink-0">{facets.ownerships[o]}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Section: Color */}
                                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                                    <button
                                        onClick={() => toggleSection('color')}
                                        className="w-full p-3.5 flex items-center justify-between text-sm font-bold text-primary hover:bg-slate-50/50 transition-colors cursor-pointer outline-none"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-slate-400 text-[18px]">palette</span>
                                            Color
                                        </span>
                                        <span className="material-symbols-outlined text-slate-400 text-lg transition-transform" style={{ transform: expandedSections.color ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                                    </button>
                                    {expandedSections.color && (
                                        <div className="p-3 border-t border-slate-100 bg-slate-50/20 pr-1 space-y-2 max-h-40 overflow-y-auto">
                                            {Object.keys(facets.colors).sort().map(c => (
                                                <label key={c} className="flex items-center gap-2.5 cursor-pointer py-0.5 group">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedColors.includes(c)}
                                                        onChange={() => toggleFilterList('colors', c)}
                                                        className="rounded border-slate-300 text-primary focus:ring-primary size-4 cursor-pointer"
                                                    />
                                                    <span className="text-xs text-slate-700 group-hover:text-primary transition-colors flex-1">{c}</span>
                                                    <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 font-bold shrink-0">{facets.colors[c]}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>

                            </div>

                            {/* Drawer Footer */}
                            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                                <button
                                    onClick={() => setShowFilterDrawer(false)}
                                    className="flex-1 h-11 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary-light transition-colors shadow-sm cursor-pointer"
                                >
                                    View {filtered.length} Vehicles
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminInventory;
