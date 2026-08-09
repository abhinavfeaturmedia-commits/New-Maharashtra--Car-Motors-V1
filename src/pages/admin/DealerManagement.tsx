import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import HighlightText from '../../components/ui/HighlightText';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Dealer {
    id: string;
    dealer_code: string;
    name: string;
    contact_person: string | null;
    phone: string | null;
    alternate_phone: string | null;
    whatsapp_number: string | null;
    email: string | null;
    city: string | null;
    address: string | null;
    gst_number: string | null;
    notes: string | null;
    status: 'active' | 'inactive' | 'archived';
    created_at: string;
}

interface DealerCar {
    id: string;
    make: string;
    model: string;
    variant: string | null;
    year: number;
    price: number;
    dealer_asking_price: number | null;
    our_margin: number | null;
    dealer_commission: number | null;
    status: string;
    source: string;
    dealer_id: string | null;
    thumbnail: string | null;
    registration_no: string | null;
    created_at: string;
}

interface Settlement {
    id: string;
    dealer_id: string;
    inventory_id: string | null;
    amount: number;
    settlement_date: string | null;
    status: 'pending' | 'paid';
    notes: string | null;
    created_at: string;
    car?: { make: string; model: string; year: number } | null;
    dealer?: { name: string; dealer_code: string } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatCurrency = (val: number | null | undefined) => {
    if (!val && val !== 0) return '—';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
};

const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const generateDealerCode = (existingCodes: string[]) => {
    let n = existingCodes.length + 1;
    let code = `DLR-${String(n).padStart(3, '0')}`;
    while (existingCodes.includes(code)) {
        n++;
        code = `DLR-${String(n).padStart(3, '0')}`;
    }
    return code;
};

const getCodeNumber = (code: string) => {
    const num = parseInt(code.replace(/\D/g, ''), 10);
    return isNaN(num) ? 0 : num;
};

const getAvatarGradient = (name: string) => {
    const colors = [
        'from-pink-500 to-rose-500',
        'from-purple-500 to-indigo-500',
        'from-blue-500 to-cyan-500',
        'from-teal-500 to-emerald-500',
        'from-amber-500 to-orange-500',
        'from-fuchsia-500 to-purple-600',
        'from-violet-500 to-purple-500',
        'from-sky-500 to-blue-600'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
};

const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-amber-100 text-amber-700',
    archived: 'bg-slate-100 text-slate-400',
};

const carStatusColors: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    reserved: 'bg-amber-100 text-amber-700',
    sold: 'bg-slate-200 text-slate-500',
    pending: 'bg-blue-100 text-blue-700',
};

// ─── Blank form ────────────────────────────────────────────────────────────
const BLANK_DEALER = {
    dealer_code: '',
    name: '',
    contact_person: '',
    phone: '',
    alternate_phone: '',
    whatsapp_number: '',
    email: '',
    city: '',
    address: '',
    gst_number: '',
    notes: '',
    status: 'active' as 'active' | 'inactive' | 'archived',
};

const BLANK_SETTLEMENT = {
    dealer_id: '',
    inventory_id: '',
    amount: '',
    settlement_date: '',
    status: 'pending' as 'pending' | 'paid',
    notes: '',
};

// ─── Main Component ───────────────────────────────────────────────────────────
const DealerManagement = () => {
    const [activeTab, setActiveTab] = useState<'dealers' | 'inventory' | 'financials' | 'activity'>('dealers');

    // Data
    const [dealers, setDealers] = useState<Dealer[]>([]);
    const [dealerCars, setDealerCars] = useState<DealerCar[]>([]);
    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [loading, setLoading] = useState(true);

    // UI state
    const [search, setSearch] = useState('');
    const [filterDealer, setFilterDealer] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [sortBy, setSortBy] = useState<'number' | 'name' | 'date' | 'cars'>('number');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // Modals
    const [showDealerModal, setShowDealerModal] = useState(false);
    const [editingDealer, setEditingDealer] = useState<Dealer | null>(null);
    const [dealerForm, setDealerForm] = useState(BLANK_DEALER);
    const [savingDealer, setSavingDealer] = useState(false);

    const [showSettlementModal, setShowSettlementModal] = useState(false);
    const [editingSettlement, setEditingSettlement] = useState<Settlement | null>(null);
    const [settlementForm, setSettlementForm] = useState(BLANK_SETTLEMENT);
    const [savingSettlement, setSavingSettlement] = useState(false);

    // ─── Toast ────────────────────────────────────────────────────────────
    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // ─── Fetch ────────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [{ data: dealerData }, { data: carData }, { data: settlementData }] = await Promise.all([
            supabase.from('dealers').select('*').order('created_at', { ascending: false }),
            supabase.from('inventory').select('*').eq('source', 'dealer').order('created_at', { ascending: false }),
            supabase.from('dealer_settlements').select('*, car:inventory(make,model,year), dealer:dealers(name,dealer_code)').order('created_at', { ascending: false }),
        ]);
        if (dealerData) setDealers(dealerData as Dealer[]);
        if (carData) setDealerCars(carData as DealerCar[]);
        if (settlementData) setSettlements(settlementData as Settlement[]);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ─── Dealer CRUD ──────────────────────────────────────────────────────
    const openAddDealer = () => {
        const code = generateDealerCode(dealers.map(d => d.dealer_code));
        setDealerForm({ ...BLANK_DEALER, dealer_code: code });
        setEditingDealer(null);
        setShowDealerModal(true);
    };

    const openEditDealer = (d: Dealer) => {
        setEditingDealer(d);
        setDealerForm({
            dealer_code: d.dealer_code,
            name: d.name,
            contact_person: d.contact_person || '',
            phone: d.phone || '',
            alternate_phone: d.alternate_phone || '',
            whatsapp_number: d.whatsapp_number || '',
            email: d.email || '',
            city: d.city || '',
            address: d.address || '',
            gst_number: d.gst_number || '',
            notes: d.notes || '',
            status: d.status,
        });
        setShowDealerModal(true);
    };

    const saveDealer = async () => {
        if (!dealerForm.name.trim() || !dealerForm.dealer_code.trim()) {
            showToast('Dealer name and code are required.', 'error');
            return;
        }
        setSavingDealer(true);
        const payload = {
            dealer_code: dealerForm.dealer_code.toUpperCase(),
            name: dealerForm.name.trim(),
            contact_person: dealerForm.contact_person || null,
            phone: dealerForm.phone || null,
            alternate_phone: dealerForm.alternate_phone || null,
            whatsapp_number: dealerForm.whatsapp_number || null,
            email: dealerForm.email || null,
            city: dealerForm.city || null,
            address: dealerForm.address || null,
            gst_number: dealerForm.gst_number || null,
            notes: dealerForm.notes || null,
            status: dealerForm.status,
            updated_at: new Date().toISOString(),
        };
        let error;
        if (editingDealer) {
            ({ error } = await supabase.from('dealers').update(payload).eq('id', editingDealer.id));
        } else {
            ({ error } = await supabase.from('dealers').insert(payload));
        }
        setSavingDealer(false);
        if (error) { showToast(error.message, 'error'); return; }
        showToast(editingDealer ? 'Dealer updated.' : 'Dealer added.');
        setShowDealerModal(false);
        fetchAll();
    };

    const deleteDealer = async (d: Dealer) => {
        if (!confirm(`Permanently delete dealer "${d.name}"? This cannot be undone.`)) return;
        const { error } = await supabase.from('dealers').delete().eq('id', d.id);
        if (error) showToast(error.message, 'error');
        else { showToast('Dealer deleted.'); fetchAll(); }
    };

    // ─── Settlement CRUD ──────────────────────────────────────────────────
    const openAddSettlement = () => {
        setEditingSettlement(null);
        setSettlementForm({ ...BLANK_SETTLEMENT });
        setShowSettlementModal(true);
    };

    const openEditSettlement = (s: Settlement) => {
        setEditingSettlement(s);
        setSettlementForm({
            dealer_id: s.dealer_id,
            inventory_id: s.inventory_id || '',
            amount: String(s.amount),
            settlement_date: s.settlement_date || '',
            status: s.status,
            notes: s.notes || '',
        });
        setShowSettlementModal(true);
    };

    const saveSettlement = async () => {
        if (!settlementForm.dealer_id || !settlementForm.amount) {
            showToast('Dealer and amount are required.', 'error');
            return;
        }
        setSavingSettlement(true);
        const payload = {
            dealer_id: settlementForm.dealer_id,
            inventory_id: settlementForm.inventory_id || null,
            amount: Number(settlementForm.amount),
            settlement_date: settlementForm.settlement_date || null,
            status: settlementForm.status,
            notes: settlementForm.notes || null,
            updated_at: new Date().toISOString(),
        };
        let error;
        if (editingSettlement) {
            ({ error } = await supabase.from('dealer_settlements').update(payload).eq('id', editingSettlement.id));
        } else {
            ({ error } = await supabase.from('dealer_settlements').insert(payload));
        }
        setSavingSettlement(false);
        if (error) { showToast(error.message, 'error'); return; }
        showToast(editingSettlement ? 'Settlement updated.' : 'Settlement recorded.');
        setShowSettlementModal(false);
        fetchAll();
    };

    const markSettlementPaid = async (s: Settlement) => {
        const { error } = await supabase.from('dealer_settlements').update({ status: 'paid', settlement_date: new Date().toISOString().split('T')[0] }).eq('id', s.id);
        if (error) showToast(error.message, 'error');
        else { showToast('Marked as paid.'); fetchAll(); }
    };

    const getDealerById = (id: string) => dealers.find(d => d.id === id);
    const getDealerCarCount = (dealerId: string) => dealerCars.filter(c => c.dealer_id === dealerId).length;
    const getDealerSoldCount = (dealerId: string) => dealerCars.filter(c => c.dealer_id === dealerId && c.status === 'sold').length;

    // ─── Filtered lists ───────────────────────────────────────────────────
    const filteredDealers = dealers.filter(d => {
        const q = search.toLowerCase();
        const matchSearch = !q || d.name.toLowerCase().includes(q) || d.dealer_code.toLowerCase().includes(q) || (d.city || '').toLowerCase().includes(q);
        const matchStatus = filterStatus === 'all' || d.status === filterStatus;
        return matchSearch && matchStatus;
    }).sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'number') {
            comparison = getCodeNumber(a.dealer_code) - getCodeNumber(b.dealer_code);
        } else if (sortBy === 'name') {
            comparison = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
        } else if (sortBy === 'date') {
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        } else if (sortBy === 'cars') {
            comparison = getDealerCarCount(a.id) - getDealerCarCount(b.id);
        }
        return sortOrder === 'asc' ? comparison : -comparison;
    });

    const filteredCars = dealerCars.filter(c => {
        const q = search.toLowerCase();
        const matchSearch = !q || `${c.make} ${c.model}`.toLowerCase().includes(q) || (c.registration_no || '').toLowerCase().includes(q);
        const matchDealer = filterDealer === 'all' || c.dealer_id === filterDealer;
        return matchSearch && matchDealer;
    });

    const filteredSettlements = settlements.filter(s => {
        const matchDealer = filterDealer === 'all' || s.dealer_id === filterDealer;
        const matchStatus = filterStatus === 'all' || s.status === filterStatus;
        return matchDealer && matchStatus;
    });

    // ─── Summary Stats (for Financials tab) ────────────────────────────────
    const totalPending = settlements.filter(s => s.status === 'pending').reduce((sum, s) => sum + s.amount, 0);
    const totalPaid = settlements.filter(s => s.status === 'paid').reduce((sum, s) => sum + s.amount, 0);
    const activeDealer = dealers.filter(d => d.status === 'active').length;
    const totalDealerCars = dealerCars.length;
    const soldDealerCars = dealerCars.filter(c => c.status === 'sold').length;

    const tabs = [
        { key: 'dealers', label: 'Dealers', icon: 'store', count: dealers.filter(d => d.status === 'active').length },
        { key: 'inventory', label: 'Dealer Inventory', icon: 'directions_car', count: totalDealerCars },
        { key: 'financials', label: 'Financials', icon: 'payments', count: settlements.filter(s => s.status === 'pending').length },
        { key: 'activity', label: 'Activity', icon: 'timeline', count: null },
    ] as const;

    return (
        <div className="space-y-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold transition-all animate-fade-in ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    <span className="material-symbols-outlined text-lg">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-primary font-display tracking-tight flex items-center gap-2">
                        <span className="material-symbols-outlined text-3xl text-primary">store</span>
                        Dealer Management
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Manage dealer partnerships · <span className="font-semibold text-primary">{activeDealer} active</span> · <span className="font-semibold text-blue-600">{totalDealerCars} cars listed</span> · <span className="font-semibold text-green-600">{soldDealerCars} sold</span>
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchAll} className="h-11 w-11 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-primary transition-all shadow-sm" title="Refresh">
                        <span className="material-symbols-outlined text-lg">refresh</span>
                    </button>
                    {activeTab === 'dealers' && (
                        <button onClick={openAddDealer} className="h-11 px-6 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary-light transition-all shadow-md hover:shadow-lg">
                            <span className="material-symbols-outlined text-lg">add</span> Add Dealer
                        </button>
                    )}
                    {activeTab === 'financials' && (
                        <button onClick={openAddSettlement} className="h-11 px-6 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary-light transition-all shadow-md hover:shadow-lg">
                            <span className="material-symbols-outlined text-lg">add</span> Add Settlement
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Active Dealers', value: String(activeDealer), icon: 'store', color: 'text-primary', bg: 'bg-primary/5', border: 'border-primary/10' },
                    { label: 'Cars Listed', value: String(totalDealerCars), icon: 'directions_car', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                    { label: 'Pending Payouts', value: formatCurrency(totalPending), icon: 'pending_actions', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
                    { label: 'Total Paid Out', value: formatCurrency(totalPaid), icon: 'check_circle', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
                ].map(card => (
                    <div key={card.label} className={`bg-white rounded-2xl border ${card.border} p-5 shadow-sm hover:shadow-md transition-all duration-300`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{card.label}</span>
                            <div className={`size-8 rounded-xl ${card.bg} flex items-center justify-center`}>
                                <span className={`material-symbols-outlined ${card.color} text-base`}>{card.icon}</span>
                            </div>
                        </div>
                        <p className={`text-2xl font-black ${card.color} font-display`}>{loading ? '…' : card.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => { setActiveTab(tab.key); setSearch(''); setFilterDealer('all'); setFilterStatus('all'); }}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${activeTab === tab.key ? 'text-primary border-primary font-bold bg-primary/5 rounded-t-xl' : 'text-slate-500 border-transparent hover:text-primary hover:bg-slate-50 rounded-t-xl'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                        {tab.label}
                        {tab.count !== null && <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-primary text-white font-bold' : 'bg-slate-100 text-slate-500 font-semibold'}`}>{tab.count}</span>}
                    </button>
                ))}
            </div>

            {/* ─── TAB: DEALERS ─────────────────────────────────────────────────── */}
            {activeTab === 'dealers' && (
                <div className="space-y-4">
                    {/* Filters bar */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex flex-wrap items-center gap-3 flex-1">
                            {/* Search */}
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-11 w-full sm:w-72 shadow-sm focus-within:ring-2 focus-within:ring-primary/15 transition-all">
                                <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dealer name, code, city…" className="bg-transparent text-sm text-primary outline-none w-full" />
                            </div>

                            {/* Status filter */}
                            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-11 border border-slate-200 rounded-xl px-4 text-sm text-slate-600 bg-white outline-none shadow-sm cursor-pointer hover:border-slate-300 focus:ring-2 focus:ring-primary/15">
                                <option value="all">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="archived">Archived</option>
                            </select>
                            
                            {/* Vertical divider */}
                            <span className="hidden sm:inline text-slate-200 h-6 w-px"></span>

                            {/* Sequential Sorting Controls */}
                            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                                <span className="material-symbols-outlined text-slate-400 text-base pl-2 pr-1 select-none">sort</span>
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        if (sortBy === 'number') {
                                            setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
                                        } else {
                                            setSortBy('number');
                                            setSortOrder('asc');
                                        }
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${sortBy === 'number' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    Number Wise 
                                    {sortBy === 'number' && (
                                        <span className="material-symbols-outlined text-xs">{sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                                    )}
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        if (sortBy === 'name') {
                                            setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
                                        } else {
                                            setSortBy('name');
                                            setSortOrder('asc');
                                        }
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${sortBy === 'name' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    Name Wise
                                    {sortBy === 'name' && (
                                        <span className="material-symbols-outlined text-xs">{sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm shrink-0 self-end lg:self-auto">
                            <button 
                                onClick={() => setViewMode('grid')}
                                className={`h-9 px-3 flex items-center justify-center rounded-lg transition-colors gap-1.5 ${viewMode === 'grid' ? 'bg-primary text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                title="Grid View"
                            >
                                <span className="material-symbols-outlined text-lg">grid_view</span>
                                <span className="text-xs font-bold">Grid</span>
                            </button>
                            <button 
                                onClick={() => setViewMode('list')}
                                className={`h-9 px-3 flex items-center justify-center rounded-lg transition-colors gap-1.5 ${viewMode === 'list' ? 'bg-primary text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                title="List View"
                            >
                                <span className="material-symbols-outlined text-lg">table_rows</span>
                                <span className="text-xs font-bold">List</span>
                            </button>
                        </div>
                    </div>

                    {/* Loading Skeletal state */}
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 h-56 animate-pulse" />
                            ))}
                        </div>
                    ) : filteredDealers.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center shadow-sm">
                            <span className="material-symbols-outlined text-5xl text-slate-200 block mb-3">store_mall_directory</span>
                            <p className="font-bold text-slate-400">No dealers found</p>
                            <p className="text-xs text-slate-300 mt-1">Add your first dealer partner to get started.</p>
                        </div>
                    ) : viewMode === 'grid' ? (
                        /* Dealer Cards Grid View */
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredDealers.map(dealer => {
                                const pendingPayouts = settlements.filter(s => s.dealer_id === dealer.id && s.status === 'pending').length;
                                return (
                                    <div key={dealer.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-slate-200/60 transition-all duration-300 group flex flex-col justify-between h-full">
                                        <div>
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-11 rounded-xl bg-gradient-to-br ${getAvatarGradient(dealer.name)} flex items-center justify-center font-black text-white text-base shadow-sm shrink-0`}>
                                                        {dealer.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-primary text-sm hover:underline cursor-pointer" onClick={() => openEditDealer(dealer)}>
                                                            <HighlightText text={dealer.name} highlight={search} />
                                                        </p>
                                                        <p className="text-[10px] font-bold text-slate-400 font-mono tracking-wider mt-0.5"><HighlightText text={dealer.dealer_code} highlight={search} /></p>
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0 ${statusColors[dealer.status]}`}>
                                                    {dealer.status}
                                                </span>
                                            </div>

                                            <div className="space-y-2 text-xs text-slate-500 mb-4 border-b border-slate-50 pb-4">
                                                {dealer.contact_person && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-slate-300 text-[14px]">person</span>
                                                        <span className="text-slate-700 font-medium">{dealer.contact_person}</span>
                                                    </div>
                                                )}
                                                {dealer.phone && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-slate-300 text-[14px]">call</span>
                                                        <a href={`tel:${dealer.phone}`} className="hover:text-primary transition-colors font-medium">{dealer.phone}</a>
                                                    </div>
                                                )}
                                                {dealer.whatsapp_number && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-slate-300 text-[14px]">chat</span>
                                                        <a href={`https://wa.me/91${dealer.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:text-green-700 transition-colors font-semibold flex items-center gap-1">
                                                            {dealer.whatsapp_number}
                                                            <span className="text-[9px] px-1 bg-green-50 text-green-500 rounded border border-green-100 uppercase">WA</span>
                                                        </a>
                                                    </div>
                                                )}
                                                {dealer.city && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-slate-300 text-[14px]">location_on</span>
                                                        <span className="font-medium text-slate-600"><HighlightText text={dealer.city} highlight={search} /></span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            {/* Interactive Stats Panel with routing click events */}
                                            <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                                                <div 
                                                    onClick={() => { setActiveTab('inventory'); setFilterDealer(dealer.id); }}
                                                    className="bg-white rounded-lg p-2 text-center shadow-xs cursor-pointer border border-transparent hover:border-primary/10 hover:shadow-sm hover:scale-[1.02] transition-all"
                                                    title="Click to view dealer inventory"
                                                >
                                                    <p className="text-lg font-black text-primary leading-none mb-0.5">{getDealerCarCount(dealer.id)}</p>
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Total Cars</p>
                                                </div>
                                                <div className="bg-white rounded-lg p-2 text-center shadow-xs border border-transparent">
                                                    <p className="text-lg font-black text-green-600 leading-none mb-0.5">{getDealerSoldCount(dealer.id)}</p>
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Sold</p>
                                                </div>
                                                <div 
                                                    onClick={() => {
                                                        setActiveTab('financials');
                                                        setFilterDealer(dealer.id);
                                                        setFilterStatus(pendingPayouts > 0 ? 'pending' : 'all');
                                                    }}
                                                    className={`rounded-lg p-2 text-center shadow-xs cursor-pointer border transition-all hover:scale-[1.02] ${pendingPayouts > 0 ? 'bg-amber-50 border-amber-100 hover:bg-amber-100/70' : 'bg-white border-transparent hover:border-amber-200'}`}
                                                    title="Click to view settlements"
                                                >
                                                    <p className={`text-lg font-black leading-none mb-0.5 ${pendingPayouts > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{pendingPayouts}</p>
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Pending</p>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => openEditDealer(dealer)}
                                                    className="flex-1 h-9 bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <span className="material-symbols-outlined text-base">edit</span> Edit
                                                </button>
                                                <button
                                                    onClick={() => deleteDealer(dealer)}
                                                    className="h-9 px-3 bg-red-50 border border-red-100 text-red-500 text-xs font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
                                                    title="Delete dealer"
                                                >
                                                    <span className="material-symbols-outlined text-base">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* Dealer List Datatable View (with true sequence) */
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px] border-collapse">
                                    <thead>
                                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50/50">
                                            <th className="text-left px-6 py-4">Code</th>
                                            <th className="text-left px-6 py-4">Dealer Name</th>
                                            <th className="text-left px-6 py-4">Contact Info</th>
                                            <th className="text-left px-6 py-4">Location</th>
                                            <th className="text-center px-6 py-4">Inventory Stats</th>
                                            <th className="text-left px-6 py-4">Status</th>
                                            <th className="text-right px-6 py-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredDealers.map(dealer => {
                                            const carCount = getDealerCarCount(dealer.id);
                                            const soldCount = getDealerSoldCount(dealer.id);
                                            const pendingPayouts = settlements.filter(s => s.dealer_id === dealer.id && s.status === 'pending').length;
                                            return (
                                                <tr key={dealer.id} className="hover:bg-slate-50/30 transition-colors group">
                                                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-600">
                                                        {dealer.dealer_code}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`size-8 rounded-lg bg-gradient-to-br ${getAvatarGradient(dealer.name)} flex items-center justify-center font-black text-white text-xs shadow-xs shrink-0`}>
                                                                {dealer.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-primary text-sm hover:underline cursor-pointer" onClick={() => openEditDealer(dealer)}>
                                                                    <HighlightText text={dealer.name} highlight={search} />
                                                                </p>
                                                                {dealer.gst_number && (
                                                                    <p className="text-[9px] text-slate-400 font-mono mt-0.5 uppercase">GST: {dealer.gst_number}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-slate-500">
                                                        <div className="space-y-0.5">
                                                            {dealer.contact_person && <p className="font-medium text-slate-700">{dealer.contact_person}</p>}
                                                            <div className="flex items-center gap-2">
                                                                {dealer.phone && <a href={`tel:${dealer.phone}`} className="hover:text-primary transition-colors">{dealer.phone}</a>}
                                                                {dealer.whatsapp_number && (
                                                                    <a href={`https://wa.me/91${dealer.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-green-500 hover:text-green-600 transition-colors flex items-center" title="Send WhatsApp">
                                                                        <svg className="size-3.5 fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.424 2.5 1.14 3.473l-.744 2.718 2.79-.731a5.717 5.717 0 002.582.617h.002c3.18 0 5.766-2.586 5.767-5.767a5.772 5.772 0 00-5.769-5.774zm3.435 8.16c-.1.285-.572.545-.826.58-.24.032-.552.058-1.284-.24-.925-.378-1.503-1.32-1.55-1.382-.047-.062-.394-.523-.394-1.002 0-.479.25-.713.34-.81.089-.096.196-.12.261-.12.066 0 .132.001.189.004.06.002.138-.023.216.166.089.215.305.744.344.821.039.078.065.169.013.273-.052.104-.078.169-.156.26-.078.09-.163.2-.234.273-.078.078-.16.163-.069.32.091.156.405.67.87 1.085.6.535 1.107.7 1.267.78.16.08.254.065.349-.046.096-.11.411-.479.522-.642.11-.162.221-.137.371-.081.15.056.953.45 1.117.531.163.081.272.122.311.19.039.068.039.394-.061.679zM12 .003C5.384.003.007 5.378.007 12a11.93 11.93 0 001.821 6.272L.022 24l5.894-1.547a11.95 11.95 0 006.087 1.63c6.613 0 11.99-5.378 11.99-12S18.616.003 12.001.003z"/></svg>
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                                                        {dealer.city ? <HighlightText text={dealer.city} highlight={search} /> : '—'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-center gap-3 text-xs">
                                                            <button 
                                                                onClick={() => { setActiveTab('inventory'); setFilterDealer(dealer.id); }}
                                                                className="px-2.5 py-1 bg-slate-50 hover:bg-primary hover:text-white border border-slate-200 rounded-lg font-bold text-slate-600 transition-all"
                                                                title="View Inventory"
                                                            >
                                                                {carCount} listed
                                                            </button>
                                                            <span className="text-slate-400 font-semibold">{soldCount} sold</span>
                                                            {pendingPayouts > 0 ? (
                                                                <button 
                                                                    onClick={() => { setActiveTab('financials'); setFilterDealer(dealer.id); setFilterStatus('pending'); }}
                                                                    className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-100 rounded-md font-bold transition-colors animate-pulse"
                                                                    title="Click to view pending settlements"
                                                                >
                                                                    {pendingPayouts} pending
                                                                </button>
                                                            ) : (
                                                                <span className="text-slate-300">0 pending</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${statusColors[dealer.status]}`}>
                                                            {dealer.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                            <button
                                                                onClick={() => openEditDealer(dealer)}
                                                                className="size-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-500 hover:text-primary transition-colors"
                                                                title="Edit"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">edit</span>
                                                            </button>
                                                            <button
                                                                onClick={() => deleteDealer(dealer)}
                                                                className="size-8 flex items-center justify-center hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                                                                title="Delete"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">delete</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── TAB: DEALER INVENTORY ────────────────────────────────────────── */}
            {activeTab === 'inventory' && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-11 flex-1 max-w-sm shadow-sm focus-within:ring-2 focus-within:ring-primary/15 transition-all">
                            <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search make, model, reg…" className="bg-transparent text-sm text-primary outline-none w-full" />
                        </div>
                        <select value={filterDealer} onChange={e => setFilterDealer(e.target.value)} className="h-11 border border-slate-200 rounded-xl px-4 text-sm text-slate-600 bg-white outline-none shadow-sm cursor-pointer hover:border-slate-300 focus:ring-2 focus:ring-primary/15">
                            <option value="all">All Dealers</option>
                            {dealers.map(d => <option key={d.id} value={d.id}>{d.dealer_code} — {d.name}</option>)}
                        </select>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto relative">
                            <table className="w-full min-w-[700px]">
                            <thead>
                                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50/50">
                                    <th className="text-left px-6 py-4">Vehicle</th>
                                    <th className="text-left px-6 py-4">Dealer</th>
                                    <th className="text-left px-6 py-4">Asking Price</th>
                                    <th className="text-left px-6 py-4">Dealer Cost</th>
                                    <th className="text-left px-6 py-4">Commission</th>
                                    <th className="text-left px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={6} className="py-10 text-center text-slate-400">Loading…</td></tr>
                                ) : filteredCars.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-16 text-center">
                                            <span className="material-symbols-outlined text-4xl text-slate-200 mb-3 block">directions_car</span>
                                            <p className="text-slate-400 font-medium text-sm">No dealer cars found</p>
                                            <p className="text-xs text-slate-300 mt-1">Add a new car and tag it as a dealer car.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCars.map(car => {
                                        const dealer = getDealerById(car.dealer_id || '');
                                        return (
                                            <tr key={car.id} className="hover:bg-slate-50/30 transition-colors group">
                                                <td className="px-6 py-4.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-11 rounded-lg overflow-hidden bg-slate-100 shrink-0 shadow-xs border border-slate-150">
                                                            {car.thumbnail
                                                                ? <img src={car.thumbnail} alt="" className="w-full h-full object-cover" />
                                                                : <div className="w-full h-full flex items-center justify-center bg-slate-50"><span className="material-symbols-outlined text-slate-300 text-lg">directions_car</span></div>
                                                            }
                                                        </div>
                                                        <div>
                                                            <Link 
                                                                to={`/admin/inventory/${car.id}/edit`} 
                                                                className="text-sm font-semibold text-primary hover:text-amber-600 hover:underline transition-colors flex items-center gap-1.5"
                                                            >
                                                                {car.year} <HighlightText text={car.make} highlight={search} /> <HighlightText text={car.model} highlight={search} />
                                                                <span className="material-symbols-outlined text-xs opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                                                            </Link>
                                                            {car.registration_no && <p className="text-[10px] text-slate-400 font-mono mt-0.5"><HighlightText text={car.registration_no} highlight={search} /></p>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4.5">
                                                    {dealer ? (
                                                        <div>
                                                            <p className="text-sm font-semibold text-primary hover:underline cursor-pointer" onClick={() => { setActiveTab('dealers'); setSearch(dealer.dealer_code); }}>{dealer.name}</p>
                                                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">{dealer.dealer_code}</p>
                                                        </div>
                                                    ) : <span className="text-slate-300 text-sm">—</span>}
                                                </td>
                                                <td className="px-5 py-3.5 text-sm text-slate-600">{formatCurrency(car.dealer_commission)}</td>
                                                <td className="px-5 py-3.5">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${carStatusColors[car.status] ?? 'bg-slate-100 text-slate-500'}`}>
                                                        {car.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── TAB: FINANCIALS ──────────────────────────────────────────────── */}
            {activeTab === 'financials' && (
                <div className="space-y-4">
                    {/* Pending alert if any */}
                    {totalPending > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                            <span className="material-symbols-outlined text-amber-500 text-xl">warning</span>
                            <div>
                                <p className="text-sm font-bold text-amber-800">
                                    {formatCurrency(totalPending)} pending across {settlements.filter(s => s.status === 'pending').length} settlement{settlements.filter(s => s.status === 'pending').length !== 1 ? 's' : ''}
                                </p>
                                <p className="text-xs text-amber-600">Mark them as paid once funds are transferred.</p>
                            </div>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <select value={filterDealer} onChange={e => setFilterDealer(e.target.value)} className="h-10 border border-slate-200 rounded-xl px-4 text-sm text-slate-600 bg-white outline-none">
                            <option value="all">All Dealers</option>
                            {dealers.map(d => <option key={d.id} value={d.id}>{d.dealer_code} — {d.name}</option>)}
                        </select>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-10 border border-slate-200 rounded-xl px-4 text-sm text-slate-600 bg-white outline-none">
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                        </select>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                        <div className="overflow-x-auto relative">
                            <table className="w-full min-w-[650px]">
                            <thead>
                                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                    <th className="text-left px-5 py-3">Dealer</th>
                                    <th className="text-left px-5 py-3">Car</th>
                                    <th className="text-left px-5 py-3">Amount</th>
                                    <th className="text-left px-5 py-3">Date</th>
                                    <th className="text-left px-5 py-3">Status</th>
                                    <th className="text-left px-5 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} className="py-10 text-center text-slate-400">Loading…</td></tr>
                                ) : filteredSettlements.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-16 text-center">
                                            <span className="material-symbols-outlined text-4xl text-slate-200 mb-3 block">payments</span>
                                            <p className="text-slate-400 font-medium text-sm">No settlements yet</p>
                                            <button onClick={openAddSettlement} className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-primary hover:underline">
                                                <span className="material-symbols-outlined text-base">add</span> Record first settlement
                                            </button>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSettlements.map(s => (
                                        <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <p className="text-sm font-semibold text-primary">{s.dealer?.name || '—'}</p>
                                                <p className="text-[10px] font-mono text-slate-400">{s.dealer?.dealer_code}</p>
                                            </td>
                                            <td className="px-5 py-3.5 text-sm text-slate-600">
                                                {s.car ? `${s.car.year} ${s.car.make} ${s.car.model}` : '—'}
                                            </td>
                                            <td className="px-5 py-3.5 text-sm font-bold text-primary">{formatCurrency(s.amount)}</td>
                                            <td className="px-5 py-3.5 text-xs text-slate-500">{formatDate(s.settlement_date)}</td>
                                            <td className="px-5 py-3.5">
                                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${s.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex gap-1">
                                                    {s.status === 'pending' && (
                                                        <button onClick={() => markSettlementPaid(s)} className="h-8 px-3 text-xs font-bold bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-sm">check</span> Mark Paid
                                                        </button>
                                                    )}
                                                    <button onClick={() => openEditSettlement(s)} className="p-1.5 hover:bg-slate-100 rounded-lg" title="Edit">
                                                        <span className="material-symbols-outlined text-slate-400 text-base">edit</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── TAB: ACTIVITY ────────────────────────────────────────────────── */}
            {activeTab === 'activity' && (
                <div className="space-y-3">
                    {loading ? (
                        <div className="py-10 text-center text-slate-400">Loading…</div>
                    ) : (
                        <>
                            {/* Combine cars and settlements into a unified activity feed */}
                            {[
                                ...dealerCars.map(c => ({
                                    id: `car-${c.id}`,
                                    date: c.created_at,
                                    type: 'car_listed' as const,
                                    dealer: getDealerById(c.dealer_id || ''),
                                    car: c,
                                    settlement: null,
                                })),
                                ...settlements.map(s => ({
                                    id: `set-${s.id}`,
                                    date: s.created_at,
                                    type: s.status === 'paid' ? 'settlement_paid' as const : 'settlement_pending' as const,
                                    dealer: getDealerById(s.dealer_id),
                                    car: null,
                                    settlement: s,
                                })),
                            ]
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .slice(0, 50)
                                .map(item => (
                                    <div key={item.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)] flex items-start gap-4">
                                        <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                                            item.type === 'car_listed' ? 'bg-blue-50' :
                                            item.type === 'settlement_paid' ? 'bg-green-50' : 'bg-amber-50'
                                        }`}>
                                            <span className={`material-symbols-outlined text-lg ${
                                                item.type === 'car_listed' ? 'text-blue-500' :
                                                item.type === 'settlement_paid' ? 'text-green-500' : 'text-amber-500'
                                            }`}>
                                                {item.type === 'car_listed' ? 'directions_car' : item.type === 'settlement_paid' ? 'check_circle' : 'pending'}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-primary">
                                                {item.type === 'car_listed' && item.car && `Car Listed: ${item.car.year} ${item.car.make} ${item.car.model}`}
                                                {item.type === 'settlement_paid' && item.settlement && `Settlement Paid: ${formatCurrency(item.settlement.amount)}`}
                                                {item.type === 'settlement_pending' && item.settlement && `Settlement Pending: ${formatCurrency(item.settlement.amount)}`}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {item.dealer ? `${item.dealer.name} (${item.dealer.dealer_code})` : 'Unknown dealer'} · {formatDate(item.date)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            }
                            {dealerCars.length === 0 && settlements.length === 0 && (
                                <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center shadow-[var(--shadow-card)]">
                                    <span className="material-symbols-outlined text-4xl text-slate-200 block mb-3">timeline</span>
                                    <p className="text-slate-400 font-medium">No activity yet</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ════════ DEALER MODAL ════════ */}
            {showDealerModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-primary font-display">{editingDealer ? 'Edit Dealer' : 'Add New Dealer'}</h2>
                                <p className="text-xs text-slate-500">Internal dealer record — never shown to customers.</p>
                            </div>
                            <button onClick={() => setShowDealerModal(false)} className="size-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300 transition-colors">
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Dealer Code <span className="text-red-400">*</span></label>
                                    <input
                                        value={dealerForm.dealer_code}
                                        onChange={e => setDealerForm(f => ({ ...f, dealer_code: e.target.value.toUpperCase() }))}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/10"
                                        placeholder="DLR-001"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
                                    <select value={dealerForm.status} onChange={e => setDealerForm(f => ({ ...f, status: e.target.value as any }))} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm bg-white outline-none">
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Dealer Name <span className="text-red-400">*</span></label>
                                <input value={dealerForm.name} onChange={e => setDealerForm(f => ({ ...f, name: e.target.value }))} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" placeholder="e.g., Rajesh Motors Pvt. Ltd." />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Contact Person</label>
                                    <input value={dealerForm.contact_person} onChange={e => setDealerForm(f => ({ ...f, contact_person: e.target.value }))} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" placeholder="Name" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Phone</label>
                                    <input type="tel" value={dealerForm.phone} onChange={e => setDealerForm(f => ({ ...f, phone: e.target.value }))} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" placeholder="9999999999" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Alternate Number</label>
                                    <input type="tel" value={dealerForm.alternate_phone} onChange={e => setDealerForm(f => ({ ...f, alternate_phone: e.target.value }))} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" placeholder="9888888888" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">WhatsApp Number</label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-green-500">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                        </span>
                                        <input type="tel" value={dealerForm.whatsapp_number} onChange={e => setDealerForm(f => ({ ...f, whatsapp_number: e.target.value }))} className="w-full h-11 border border-slate-200 rounded-xl pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" placeholder="9999999999" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                                    <input type="email" value={dealerForm.email} onChange={e => setDealerForm(f => ({ ...f, email: e.target.value }))} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" placeholder="dealer@email.com" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">City</label>
                                    <input value={dealerForm.city} onChange={e => setDealerForm(f => ({ ...f, city: e.target.value }))} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" placeholder="Kolhapur" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Dealer Address <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                                <textarea value={dealerForm.address} onChange={e => setDealerForm(f => ({ ...f, address: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 resize-none" placeholder="Shop No., Street, Area, City — Pincode" />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">GST Number <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                                <input value={dealerForm.gst_number} onChange={e => setDealerForm(f => ({ ...f, gst_number: e.target.value.toUpperCase() }))} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/10" placeholder="27AABCS1429B1Z1" />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Internal Notes</label>
                                <textarea value={dealerForm.notes} onChange={e => setDealerForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 resize-none" placeholder="Any internal notes about this dealer…" />
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 flex gap-3">
                            <button onClick={() => setShowDealerModal(false)} className="flex-1 h-11 border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors">Cancel</button>
                            <button onClick={saveDealer} disabled={savingDealer} className="flex-1 h-11 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary-light transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                                {savingDealer ? <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-lg">save</span>}
                                {editingDealer ? 'Save Changes' : 'Add Dealer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════ SETTLEMENT MODAL ════════ */}
            {showSettlementModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-primary font-display">{editingSettlement ? 'Edit Settlement' : 'Record Settlement'}</h2>
                                <p className="text-xs text-slate-500">Track payments owed to dealer partners.</p>
                            </div>
                            <button onClick={() => setShowSettlementModal(false)} className="size-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300 transition-colors">
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Dealer <span className="text-red-400">*</span></label>
                                <select value={settlementForm.dealer_id} onChange={e => setSettlementForm(f => ({ ...f, dealer_id: e.target.value }))} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm bg-white outline-none">
                                    <option value="">Select Dealer</option>
                                    {dealers.filter(d => d.status !== 'archived').map(d => (
                                        <option key={d.id} value={d.id}>{d.dealer_code} — {d.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Linked Car <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                                <select value={settlementForm.inventory_id} onChange={e => setSettlementForm(f => ({ ...f, inventory_id: e.target.value }))} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm bg-white outline-none">
                                    <option value="">— Not linked to specific car —</option>
                                    {dealerCars.filter(c => !settlementForm.dealer_id || c.dealer_id === settlementForm.dealer_id).map(c => (
                                        <option key={c.id} value={c.id}>{c.year} {c.make} {c.model} {c.registration_no ? `(${c.registration_no})` : ''}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Amount (₹) <span className="text-red-400">*</span></label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                                        <input type="number" value={settlementForm.amount} onChange={e => setSettlementForm(f => ({ ...f, amount: e.target.value }))} className="w-full h-11 border border-slate-200 rounded-xl pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" placeholder="50000" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Settlement Date</label>
                                    <input type="date" value={settlementForm.settlement_date} onChange={e => setSettlementForm(f => ({ ...f, settlement_date: e.target.value }))} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
                                <div className="flex gap-2">
                                    {(['pending', 'paid'] as const).map(s => (
                                        <button key={s} type="button" onClick={() => setSettlementForm(f => ({ ...f, status: s }))}
                                            className={`flex-1 h-10 rounded-xl text-sm font-bold capitalize transition-all border ${settlementForm.status === s ? (s === 'paid' ? 'bg-green-100 border-green-200 text-green-700' : 'bg-amber-100 border-amber-200 text-amber-700') : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Notes</label>
                                <textarea value={settlementForm.notes} onChange={e => setSettlementForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 resize-none" placeholder="e.g., NEFT transfer for Swift Dzire sale" />
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 flex gap-3">
                            <button onClick={() => setShowSettlementModal(false)} className="flex-1 h-11 border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors">Cancel</button>
                            <button onClick={saveSettlement} disabled={savingSettlement} className="flex-1 h-11 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary-light transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                                {savingSettlement ? <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-lg">save</span>}
                                {editingSettlement ? 'Save Changes' : 'Record Settlement'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DealerManagement;
