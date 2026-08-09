import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { toWhatsAppUrl } from '../../lib/utils';
import HighlightText from '../../components/ui/HighlightText';

const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-slate-200 text-slate-500',
};

const typeFilters = ['All', 'test_drive', 'service'] as const;
const dateTabs = ['Today', 'This Week', 'All'] as const;

const AdminBookings = () => {
    const { bookings, leads, loading, refreshData } = useData();
    const [typeTab, setTypeTab]   = useState<string>('All');
    const [dateTab, setDateTab]   = useState<string>('All');
    const [search, setSearch]     = useState('');
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [pendingUpdate, setPendingUpdate] = useState<{ id: string; old: string; newStatus: string } | null>(null);
    const [rpcMatchIds, setRpcMatchIds] = useState<Set<string> | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Debounced RPC search ────────────────────────────────────────────────
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const q = search.trim();
        if (!q) {
            setRpcMatchIds(null);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            const { data, error } = await supabase.rpc('search_bookings_by_text', { search_term: q });
            if (!error && data) {
                setRpcMatchIds(new Set(data as string[]));
            }
        }, 450);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [search]);

    // ─── Date helpers ─────────────────────────────────────────────────────────
    const todayStr  = new Date().toISOString().split('T')[0];
    const weekStart = (() => {
        const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0];
    })();
    const weekEnd = (() => {
        const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay())); return d.toISOString().split('T')[0];
    })();

    const isWithin24h = (dateStr: string) => {
        if (!dateStr) return false;
        const diff = new Date(dateStr).getTime() - Date.now();
        return diff > 0 && diff < 24 * 60 * 60 * 1000;
    };

    // ─── Filtered list ────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        return bookings
            .filter(b => {
                if (typeTab !== 'All' && b.booking_type !== typeTab) return false;
                if (dateTab === 'Today'     && b.booking_date !== todayStr)                   return false;
                if (dateTab === 'This Week' && (b.booking_date < weekStart || b.booking_date > weekEnd)) return false;
                if (search) {
                    const q = search.toLowerCase().trim();
                    // If RPC has returned results, use them as the primary filter
                    if (rpcMatchIds !== null) {
                        return rpcMatchIds.has(b.id);
                    }
                    // Instant client-side filter while RPC is loading (expanded fields)
                    const lead = b.lead || {};
                    const car  = b.car  || {};
                    const localMatch = [
                        lead.full_name, lead.phone, lead.email,
                        lead.secondary_phone, lead.whatsapp_number,
                        lead.personal_address, lead.office_address,
                        lead.notes, lead.internal_notes,
                        lead.budget, lead.message, lead.source, lead.type,
                        car.make, car.model, String(car.year || ''), car.registration_no,
                        b.status, b.booking_type, b.notes,
                    ].some(v => v && String(v).toLowerCase().includes(q));
                    if (!localMatch) return false;
                }
                return true;
            })
            .sort((a, b) => new Date(a.booking_date + 'T' + (a.booking_time || '00:00')).getTime() -
                             new Date(b.booking_date + 'T' + (b.booking_time || '00:00')).getTime());
    }, [bookings, typeTab, dateTab, search, rpcMatchIds, todayStr, weekStart, weekEnd]);

    // ─── Stats ────────────────────────────────────────────────────────────────
    const todayCount   = bookings.filter(b => b.booking_date === todayStr && b.status === 'scheduled').length;
    const weekCount    = bookings.filter(b => b.booking_date >= weekStart && b.booking_date <= weekEnd && b.status === 'scheduled').length;
    const pendingCount = bookings.filter(b => b.status === 'scheduled').length;

    // ─── Update Status ────────────────────────────────────────────────────────
    const updateStatus = async (id: string, oldStatus: string, newStatus: string) => {
        if (oldStatus === newStatus) return;
        // If completing a test_drive, capture for prompt
        const booking = bookings.find(b => b.id === id);
        if (newStatus === 'completed' && booking?.booking_type === 'test_drive' && booking?.lead?.id) {
            setPendingUpdate({ id, old: oldStatus, newStatus });
            return;
        }
        await commitStatusUpdate(id, newStatus);
    };

    const commitStatusUpdate = async (id: string, newStatus: string) => {
        setUpdatingId(id);
        const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', id);
        if (!error) refreshData();
        else alert('Failed to update booking status');
        setUpdatingId(null);
        setPendingUpdate(null);
    };

    const handleUpdateWithLeadPromotion = async (promoteToNegotiation: boolean) => {
        if (!pendingUpdate) return;
        await commitStatusUpdate(pendingUpdate.id, pendingUpdate.newStatus);
        if (promoteToNegotiation) {
            const booking = bookings.find(b => b.id === pendingUpdate.id);
            if (booking?.lead?.id) {
                await supabase.from('leads').update({ status: 'negotiation' }).eq('id', booking.lead.id);
                await supabase.from('lead_activities').insert({
                    lead_id: booking.lead.id,
                    activity_type: 'meeting',
                    notes: `Test drive completed on ${booking.booking_date}. Lead moved to Negotiation.`,
                    created_by: 'system',
                });
                refreshData();
            }
        }
    };

    const formatDate = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const formatTime = (t: string) => {
        if (!t) return 'TBA';
        if (t.includes('T')) return new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        return t.substring(0, 5);
    };
    const tabLabel = (t: string) => ({ test_drive: 'Test Drives', service: 'Service', All: 'All' }[t] || t);
    const typeCount = (t: string) => t === 'All' ? bookings.length : bookings.filter(b => b.booking_type === t).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Booking Schedule</h1>
                    <p className="text-slate-500 text-sm">Manage scheduled test drives and service appointments.</p>
                </div>
                <button onClick={refreshData} className="h-10 w-10 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors" title="Refresh">
                    <span className="material-symbols-outlined text-lg">refresh</span>
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: "Today's Scheduled", val: todayCount,   icon: 'today',         color: 'bg-blue-500/10 text-blue-600' },
                    { label: 'This Week',          val: weekCount,    icon: 'calendar_month', color: 'bg-purple-500/10 text-purple-600' },
                    { label: 'Pending Total',      val: pendingCount, icon: 'pending_actions', color: 'bg-amber-500/10 text-amber-600' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                        <div className={`size-10 rounded-xl flex items-center justify-center ${s.color} mb-3`}>
                            <span className="material-symbols-outlined text-lg">{s.icon}</span>
                        </div>
                        <p className="text-2xl font-black text-primary font-display">{loading ? '...' : s.val}</p>
                        <p className="text-xs text-slate-400 font-medium">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap gap-3 items-center">
                {/* Date tabs */}
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                    {dateTabs.map(tab => (
                        <button key={tab} onClick={() => setDateTab(tab)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${dateTab === tab ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-primary'}`}>
                            {tab}
                        </button>
                    ))}
                </div>
                {/* Type filter */}
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                    {typeFilters.map(t => (
                        <button key={t} onClick={() => setTypeTab(t)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${typeTab === t ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-primary'}`}>
                            {tabLabel(t)} <span className="text-xs text-slate-400 ml-0.5">({typeCount(t)})</span>
                        </button>
                    ))}
                </div>
                {/* Search */}
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10 flex-1 min-w-[200px]">
                    <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, notes, car, dealer, follow-ups…" className="bg-transparent text-sm text-primary outline-none w-full" />
                    {search && <button onClick={() => setSearch('')} className="material-symbols-outlined text-slate-300 text-base hover:text-slate-500">close</button>}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                <th className="text-left px-5 py-3">Type</th>
                                <th className="text-left px-5 py-3">Lead / Client</th>
                                <th className="text-left px-5 py-3">Vehicle</th>
                                <th className="text-left px-5 py-3">Date &amp; Time</th>
                                <th className="text-left px-5 py-3">Status</th>
                                <th className="text-left px-5 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="text-center py-10 text-slate-400">Loading bookings…</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center">
                                        <span className="material-symbols-outlined text-4xl text-slate-200 mb-3 block">event_note</span>
                                        <p className="text-slate-400 font-medium">No bookings match filters</p>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(b => {
                                    const urgent = isWithin24h(b.booking_date);
                                    return (
                                        <tr key={b.id} className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors ${urgent && b.status === 'scheduled' ? 'bg-amber-50/40 border-l-2 border-l-amber-400' : ''}`}>
                                            <td className="px-5 py-3.5">
                                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${b.booking_type === 'test_drive' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {b.booking_type === 'test_drive' ? '🚗 Test Drive' : '🔧 Service'}
                                                </span>
                                                {urgent && b.status === 'scheduled' && (
                                                    <span className="block mt-1 text-[9px] font-bold text-amber-600 uppercase">⏰ Within 24h</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="size-7 rounded-full bg-gradient-to-br from-primary to-primary-light text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                                                        {b.lead?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                                                    </div>
                                                    <div>
                                                        {b.lead?.id ? (
                                                            <Link to={`/admin/leads/${b.lead.id}`} onClick={e => e.stopPropagation()} className="text-sm font-medium text-primary hover:text-accent hover:underline line-clamp-1">
                                                                <HighlightText text={b.lead.full_name || 'Unknown'} highlight={search} />
                                                            </Link>
                                                        ) : (
                                                            <p className="text-sm font-medium text-primary line-clamp-1"><HighlightText text={b.lead?.full_name || 'Deleted Lead'} highlight={search} /></p>
                                                        )}
                                                        <p className="text-[10px] text-slate-400"><HighlightText text={b.lead?.phone || ''} highlight={search} /></p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-sm text-slate-700">
                                                {b.car ? <span>{b.car.year} <HighlightText text={b.car.make} highlight={search} /> <HighlightText text={b.car.model} highlight={search} /></span> : <span className="text-slate-300 italic">No specific car</span>}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <p className="text-sm text-primary font-bold">{formatDate(b.booking_date)}</p>
                                                <p className="text-[10px] uppercase font-bold text-slate-400">{formatTime(b.booking_time)}</p>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <select
                                                    value={b.status || 'scheduled'}
                                                    onChange={e => updateStatus(b.id, b.status, e.target.value)}
                                                    disabled={updatingId === b.id}
                                                    className={`text-[10px] font-bold px-2 py-1 rounded border-none cursor-pointer outline-none ${statusColors[b.status || 'scheduled'] || 'bg-slate-100 text-slate-500'}`}
                                                >
                                                    <option value="scheduled">SCHEDULED</option>
                                                    <option value="completed">COMPLETED</option>
                                                    <option value="cancelled">CANCELLED</option>
                                                    <option value="no_show">NO SHOW</option>
                                                </select>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex gap-1">
                                                    <a href={`tel:${b.lead?.phone}`} className="p-1.5 hover:bg-green-50 rounded-lg" title="Call" onClick={e => e.stopPropagation()}>
                                                        <span className="material-symbols-outlined text-green-500 text-lg">call</span>
                                                    </a>
                                                    <a href={toWhatsAppUrl(b.lead?.phone || '')} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-slate-100 rounded-lg" title="WhatsApp" onClick={e => e.stopPropagation()}>
                                                        <span className="material-symbols-outlined text-slate-400 text-lg">forum</span>
                                                    </a>
                                                    {b.lead?.id && (
                                                        <Link to={`/admin/leads/${b.lead.id}`} className="p-1.5 hover:bg-blue-50 rounded-lg" title="View Lead" onClick={e => e.stopPropagation()}>
                                                            <span className="material-symbols-outlined text-blue-400 text-lg">person</span>
                                                        </Link>
                                                    )}
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

            {/* Test Drive Completion Prompt */}
            {pendingUpdate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-xl bg-green-50 flex items-center justify-center">
                                <span className="material-symbols-outlined text-green-600 text-xl">directions_car</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-primary">Test Drive Completed</h3>
                                <p className="text-xs text-slate-500">Would you like to advance this lead?</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4">
                            The test drive is done. Move the lead to <strong>Negotiating</strong> status and log an activity automatically?
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => handleUpdateWithLeadPromotion(false)} className="flex-1 h-10 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-200 transition">
                                Just Complete
                            </button>
                            <button onClick={() => handleUpdateWithLeadPromotion(true)} className="flex-1 h-10 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary-light transition">
                                Move to Negotiation
                            </button>
                        </div>
                        <button onClick={() => setPendingUpdate(null)} className="w-full text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminBookings;
