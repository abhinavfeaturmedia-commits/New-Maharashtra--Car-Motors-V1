import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toWhatsAppUrl } from '../../lib/utils';
import HighlightText from '../../components/ui/HighlightText';

interface ConsignmentCar {
    id: string;
    make: string;
    model: string;
    variant: string | null;
    year: number;
    price: number;
    status: string;
    thumbnail: string | null;
    registration_no: string | null;
    consignment_owner_name: string | null;
    consignment_owner_phone: string | null;
    consignment_agreed_price: number | null;
    consignment_fee_type: 'fixed' | 'percentage' | null;
    consignment_fee_value: number | null;
    consignment_start_date: string | null;
    consignment_end_date: string | null;
    created_at: string;
}

const getExpiryStatus = (endDate: string | null): { label: string; cls: string; daysLeft: number | null } => {
    if (!endDate) return { label: 'No Expiry', cls: 'bg-slate-100 text-slate-500', daysLeft: null };
    const now = new Date();
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: `Expired ${Math.abs(diff)}d ago`, cls: 'bg-red-100 text-red-700', daysLeft: diff };
    if (diff <= 7) return { label: `${diff}d left`, cls: 'bg-red-100 text-red-700', daysLeft: diff };
    if (diff <= 30) return { label: `${diff}d left`, cls: 'bg-amber-100 text-amber-700', daysLeft: diff };
    return { label: `${diff}d left`, cls: 'bg-green-100 text-green-700', daysLeft: diff };
};

const statusColors: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    reserved: 'bg-amber-100 text-amber-700',
    sold: 'bg-slate-200 text-slate-500',
    pending: 'bg-blue-100 text-blue-700',
};

const SkeletonRow = () => (
    <tr className="border-b border-slate-50">
        {[...Array(7)].map((_, i) => (
            <td key={i} className="px-5 py-4">
                <div className="h-4 bg-slate-100 rounded-lg animate-pulse" style={{ width: i === 0 ? '160px' : '80px' }} />
            </td>
        ))}
    </tr>
);

const ConsignmentTracker = () => {
    const [cars, setCars] = useState<ConsignmentCar[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [saleModal, setSaleModal] = useState<{ car: ConsignmentCar } | null>(null);
    const [saleForm, setSaleForm] = useState({ buyer_name: '', final_price: '' });
    const [saleSaving, setSaleSaving] = useState(false);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchCars = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('inventory')
            .select('id,make,model,variant,year,price,status,thumbnail,registration_no,consignment_owner_name,consignment_owner_phone,consignment_agreed_price,consignment_fee_type,consignment_fee_value,consignment_start_date,consignment_end_date,created_at')
            .eq('source', 'consignment')
            .order('created_at', { ascending: false });
        if (!error && data) setCars(data as ConsignmentCar[]);
        setLoading(false);
    };

    useEffect(() => { fetchCars(); }, []);

    const handleStatusChange = async (id: string, newStatus: string) => {
        if (newStatus === 'sold') {
            const car = cars.find(c => c.id === id);
            if (car) {
                setSaleModal({ car });
                setSaleForm({ buyer_name: '', final_price: String(car.consignment_agreed_price || car.price || '') });
                return; // open modal first
            }
        }
        const { error } = await supabase.from('inventory').update({ status: newStatus }).eq('id', id);
        if (error) {
            showToast('Failed to update status.', 'error');
        } else {
            setCars(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
            showToast('Status updated.');
        }
    };

    const handleRecordSale = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!saleModal) return;
        const car = saleModal.car;
        const salePrice = Number(saleForm.final_price);
        setSaleSaving(true);
        try {
            // Compute fee
            let fee = 0;
            if (car.consignment_fee_type === 'fixed') fee = car.consignment_fee_value || 0;
            else if (car.consignment_fee_type === 'percentage' && car.consignment_fee_value) fee = Math.round(salePrice * car.consignment_fee_value / 100);

            // Insert sale record
            const { error: saleErr } = await supabase.from('sales').insert({
                inventory_id: car.id,
                sale_date: new Date().toISOString().split('T')[0],
                final_price: salePrice,
                sale_type: 'consignment',
                profit: fee,
                consignment_fee_collected: fee,
                purchase_cost_snapshot: 0,
                status: 'completed',
                payment_status: 'paid',
                notes: `Consignment sale — buyer: ${saleForm.buyer_name}. Owner: ${car.consignment_owner_name || 'Unknown'}. Swami fee: ₹${fee.toLocaleString('en-IN')}`,
            });
            if (saleErr) throw saleErr;

            // Mark car sold
            await supabase.from('inventory').update({ status: 'sold' }).eq('id', car.id);
            setCars(prev => prev.map(c => c.id === car.id ? { ...c, status: 'sold' } : c));
            setSaleModal(null);
            showToast(`Sale recorded. Swami earned ₹${fee.toLocaleString('en-IN')} fee.`);
        } catch (err) {
            showToast('Failed to record sale.', 'error');
        } finally {
            setSaleSaving(false);
        }
    };

    const filtered = cars.filter(c => {
        const matchStatus = statusFilter === 'all' || c.status === statusFilter;
        const q = searchQuery.toLowerCase();
        const matchSearch = !q ||
            `${c.make} ${c.model} ${c.variant ?? ''} ${c.consignment_owner_name ?? ''} ${c.registration_no ?? ''}`.toLowerCase().includes(q);
        return matchStatus && matchSearch;
    });

    // Summary stats
    const active = cars.filter(c => c.status === 'available' || c.status === 'reserved').length;
    const sold = cars.filter(c => c.status === 'sold').length;
    const expiringSoon = cars.filter(c => {
        if (!c.consignment_end_date || c.status === 'sold') return false;
        const diff = Math.ceil((new Date(c.consignment_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 7;
    }).length;
    const totalFee = cars.filter(c => c.status === 'sold').reduce((sum, c) => {
        if (!c.consignment_fee_value) return sum;
        if (c.consignment_fee_type === 'fixed') return sum + c.consignment_fee_value;
        if (c.consignment_fee_type === 'percentage' && c.price) return sum + (c.price * c.consignment_fee_value / 100);
        return sum;
    }, 0);

    return (
        <div className="space-y-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    <span className="material-symbols-outlined text-lg">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-600 text-2xl">handshake</span>
                        Consignment Tracker
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">Cars listed on behalf of their owners — track status, fees, and expiry</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchCars} className="h-10 w-10 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors" title="Refresh">
                        <span className="material-symbols-outlined text-lg">refresh</span>
                    </button>
                    <Link to="/admin/inventory/new" className="h-10 px-5 bg-purple-600 text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-purple-700 transition-colors shadow-sm">
                        <span className="material-symbols-outlined text-lg">add</span> Add Consignment
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Active Listings', value: active, icon: 'inventory_2', cls: 'text-purple-600', bg: 'bg-purple-50' },
                    { label: 'Sold', value: sold, icon: 'sell', cls: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Expiring ≤ 7 Days', value: expiringSoon, icon: 'schedule', cls: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'Total Fees Earned', value: `₹${(totalFee / 1000).toFixed(1)}K`, icon: 'payments', cls: 'text-amber-600', bg: 'bg-amber-50' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)] flex items-center gap-3">
                        <div className={`size-10 ${s.bg} rounded-xl flex items-center justify-center shrink-0`}>
                            <span className={`material-symbols-outlined text-xl ${s.cls}`}>{s.icon}</span>
                        </div>
                        <div>
                            <p className="text-lg font-black text-primary">{s.value}</p>
                            <p className="text-xs text-slate-500">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex gap-2 flex-wrap">
                    {['all', 'available', 'reserved', 'sold', 'pending'].map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`h-9 px-4 rounded-xl text-xs font-bold capitalize transition-all border ${statusFilter === s ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                        >
                            {s === 'all' ? 'All' : s}
                        </button>
                    ))}
                </div>
                <div className="relative max-w-xs w-full ml-auto">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">search</span>
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search owner, car, reg…"
                        className="w-full h-10 border border-slate-200 rounded-xl pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-purple-200"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                <th className="text-left px-5 py-3">Car</th>
                                <th className="text-left px-5 py-3">Owner</th>
                                <th className="text-left px-5 py-3">Agreed Price</th>
                                <th className="text-left px-5 py-3">Our Fee</th>
                                <th className="text-left px-5 py-3">Listing Period</th>
                                <th className="text-left px-5 py-3">Expiry</th>
                                <th className="text-left px-5 py-3">Status / Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16">
                                        <span className="material-symbols-outlined text-4xl text-slate-200 mb-3 block">handshake</span>
                                        <p className="text-slate-400 font-medium text-sm">
                                            {searchQuery ? `No results for "${searchQuery}"` : 'No consignment cars found'}
                                        </p>
                                        <Link to="/admin/inventory/new" className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-purple-600 hover:underline">
                                            <span className="material-symbols-outlined text-base">add</span> Add first consignment
                                        </Link>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(car => {
                                    const expiry = getExpiryStatus(car.consignment_end_date);
                                    const ourFee = (() => {
                                        if (!car.consignment_fee_value) return '—';
                                        if (car.consignment_fee_type === 'fixed') return `₹${car.consignment_fee_value.toLocaleString('en-IN')}`;
                                        if (car.consignment_fee_type === 'percentage') return `${car.consignment_fee_value}%`;
                                        return '—';
                                    })();
                                    const whatsappLink = car.consignment_owner_phone
                                        ? toWhatsAppUrl(car.consignment_owner_phone, `Hi, regarding your ${car.year} ${car.make} ${car.model} listed with us`)
                                        : null;

                                    return (
                                        <tr key={car.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                            {/* Car */}
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                                                        {car.thumbnail ? (
                                                            <img src={car.thumbnail} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <span className="material-symbols-outlined text-slate-300 text-xl">directions_car</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-primary">
                                                            {car.year} <HighlightText text={car.make} highlight={searchQuery} /> <HighlightText text={car.model} highlight={searchQuery} />
                                                        </p>
                                                        {car.variant && <p className="text-xs text-slate-400"><HighlightText text={car.variant} highlight={searchQuery} /></p>}
                                                        {car.registration_no && <p className="text-[10px] text-slate-400 font-mono"><HighlightText text={car.registration_no} highlight={searchQuery} /></p>}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Owner */}
                                            <td className="px-5 py-3.5">
                                                <p className="text-sm font-semibold text-slate-700">
                                                    <HighlightText text={car.consignment_owner_name || '—'} highlight={searchQuery} />
                                                </p>
                                                {car.consignment_owner_phone && (
                                                    <p className="text-xs text-slate-400 font-mono">{car.consignment_owner_phone}</p>
                                                )}
                                            </td>

                                            {/* Agreed Price */}
                                            <td className="px-5 py-3.5">
                                                {car.consignment_agreed_price ? (
                                                    <p className="text-sm font-bold text-slate-700">₹{(car.consignment_agreed_price / 100000).toFixed(2)}L</p>
                                                ) : (
                                                    <p className="text-sm text-slate-400">₹{(car.price / 100000).toFixed(2)}L</p>
                                                )}
                                                <p className="text-[10px] text-slate-400">Listed: ₹{(car.price / 100000).toFixed(2)}L</p>
                                            </td>

                                            {/* Fee */}
                                            <td className="px-5 py-3.5">
                                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg bg-purple-100 text-purple-700">
                                                    <span className="material-symbols-outlined text-[12px]">payments</span>
                                                    {ourFee}
                                                    {car.consignment_fee_type === 'percentage' && car.consignment_fee_value && car.price
                                                        ? <span className="text-purple-500 font-normal">(≈₹{Math.round(car.price * car.consignment_fee_value / 100).toLocaleString('en-IN')})</span>
                                                        : null
                                                    }
                                                </span>
                                            </td>

                                            {/* Listing Period */}
                                            <td className="px-5 py-3.5 text-xs text-slate-500">
                                                {car.consignment_start_date
                                                    ? new Date(car.consignment_start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                                    : '—'
                                                }
                                                {car.consignment_end_date && (
                                                    <>
                                                        <br />
                                                        <span className="text-slate-400">to</span>{' '}
                                                        {new Date(car.consignment_end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </>
                                                )}
                                            </td>

                                            {/* Expiry */}
                                            <td className="px-5 py-3.5">
                                                {car.status === 'sold' ? (
                                                    <span className="text-xs text-slate-400 italic">Sold</span>
                                                ) : (
                                                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg ${expiry.cls}`}>
                                                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                        {expiry.label}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Status / Actions */}
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <select
                                                        value={car.status}
                                                        onChange={e => handleStatusChange(car.id, e.target.value)}
                                                        className={`text-[10px] font-bold px-2.5 py-1.5 rounded-full uppercase border-0 cursor-pointer outline-none ${statusColors[car.status] ?? 'bg-slate-100 text-slate-500'}`}
                                                    >
                                                        {['available', 'reserved', 'sold', 'pending'].map(s => (
                                                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                                        ))}
                                                    </select>
                                                    {whatsappLink && (
                                                        <a
                                                            href={whatsappLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title="WhatsApp owner"
                                                            className="p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                                                        >
                                                            <svg viewBox="0 0 24 24" className="w-[16px] h-[16px] fill-green-500">
                                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                            </svg>
                                                        </a>
                                                    )}
                                                    <Link to={`/admin/inventory/${car.id}/edit`} className="p-1.5 hover:bg-slate-100 rounded-lg" title="Edit">
                                                        <span className="material-symbols-outlined text-slate-400 text-lg">edit</span>
                                                    </Link>
                                                    <Link to={`/car/${car.id}`} target="_blank" className="p-1.5 hover:bg-slate-100 rounded-lg" title="View on website">
                                                        <span className="material-symbols-outlined text-slate-400 text-lg">open_in_new</span>
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info note */}
            <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-purple-500 text-xl shrink-0">info</span>
                <div>
                    <p className="text-sm font-bold text-purple-800 mb-1">How Consignment Works</p>
                    <p className="text-xs text-purple-700">
                        The buyer pays directly to the car owner. Swami Motors earns only the agreed service fee (fixed amount or percentage of sale).
                        No funds pass through Swami Motors for the car itself.
                    </p>
                </div>
            </div>
            {/* Sale Recording Modal */}
            {saleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-600 to-purple-400 px-6 pt-6 pb-8">
                            <h2 className="text-xl font-black text-white">Record Consignment Sale</h2>
                            <p className="text-white/70 text-sm mt-1">{saleModal.car.year} {saleModal.car.make} {saleModal.car.model}</p>
                        </div>
                        <form onSubmit={handleRecordSale} className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Buyer Name</label>
                                <input required value={saleForm.buyer_name} onChange={e => setSaleForm({...saleForm, buyer_name: e.target.value})} placeholder="Buyer's full name" className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-purple-200" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Final Sale Price (₹)</label>
                                <input required type="number" value={saleForm.final_price} onChange={e => setSaleForm({...saleForm, final_price: e.target.value})} className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-purple-200" />
                            </div>
                            {saleForm.final_price && (() => {
                                const car = saleModal.car;
                                const price = Number(saleForm.final_price);
                                const fee = car.consignment_fee_type === 'fixed'
                                    ? car.consignment_fee_value || 0
                                    : car.consignment_fee_type === 'percentage' && car.consignment_fee_value
                                        ? Math.round(price * car.consignment_fee_value / 100) : 0;
                                return fee > 0 ? (
                                    <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 text-sm font-semibold text-purple-700">
                                        🤝 Swami earns: ₹{fee.toLocaleString('en-IN')} ({car.consignment_fee_type === 'percentage' ? `${car.consignment_fee_value}%` : 'fixed'})
                                    </div>
                                ) : null;
                            })()}
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setSaleModal(null)} className="flex-1 h-10 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-200 transition">Cancel</button>
                                <button type="submit" disabled={saleSaving} className="flex-1 h-10 bg-purple-600 text-white font-bold rounded-xl text-sm hover:bg-purple-700 transition disabled:opacity-60">{saleSaving ? 'Saving…' : 'Confirm Sale'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsignmentTracker;
