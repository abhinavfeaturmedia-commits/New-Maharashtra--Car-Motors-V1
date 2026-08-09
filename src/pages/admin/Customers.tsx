import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { supabase } from '../../lib/supabase';
import { toWhatsAppUrl } from '../../lib/utils';
import HighlightText from '../../components/ui/HighlightText';

interface Customer {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    alternate_phone: string | null;
    whatsapp_number: string | null;
    address: string | null;
    office_address: string | null;
    city: string | null;
    occupation: string | null;
    date_of_birth: string | null;
    notes: string | null;
    created_at: string;
}

type TimelineEventType = 'sale' | 'lead' | 'service' | 'test_drive' | 'follow_up' | 'car_interest' | 'visit';

export interface TimelineEvent {
    id: string;
    type: TimelineEventType;
    title: string;
    description: string;
    date: Date;
    status?: string;
    icon: string;
    color: string;
    data: any;
}

const emptyForm = {
    full_name: '',
    phone: '',
    alternate_phone: '',
    whatsapp_number: '',
    email: '',
    address: '',
    office_address: '',
    city: 'Kolhapur',
    occupation: '',
    date_of_birth: '',
    notes: '',
};

const Customers = () => {
    const { isAdmin, profile } = useAuth();
    const { addNotification } = useNotifications();
    const { customers, sales, loading, refreshData } = useData();
    const [search, setSearch] = useState('');
    const [detail, setDetail] = useState<Customer | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState(emptyForm);
    const [addForm, setAddForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // ─── Visits State ──────────────────────────────────────────────────────────
    interface Visit {
        id: string;
        lead_id: string | null;
        customer_id: string | null;
        staff_id: string;
        visit_date: string;
        purpose: string;
        location: string | null;
        notes: string | null;
        outcome: 'successful' | 'unsuccessful' | 'pending';
        status: 'pending_approval' | 'approved' | 'rejected';
        approved_by: string | null;
        approved_at: string | null;
        admin_remarks: string | null;
        created_at: string;
        staff?: { full_name: string | null } | null;
    }

    const [visits, setVisits] = useState<Visit[]>([]);
    const [visitsLoading, setVisitsLoading] = useState(false);
    const [isLoggingVisit, setIsLoggingVisit] = useState(false);
    const [visitForm, setVisitForm] = useState({
        visit_date: new Date().toISOString().slice(0, 10),
        purpose: 'Test Drive',
        location: '',
        outcome: 'successful' as 'successful' | 'unsuccessful',
        notes: '',
    });
    const [visitSaving, setVisitSaving] = useState(false);

    // ─── Debounced RPC search ────────────────────────────────────────────────
    const [rpcMatchIds, setRpcMatchIds] = useState<Set<string> | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const q = search.trim();
        if (!q) {
            setRpcMatchIds(null);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            const { data, error } = await supabase.rpc('search_customers_by_text', { search_term: q });
            if (!error && data) {
                setRpcMatchIds(new Set(data as string[]));
            }
        }, 450);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [search]);

    // ─── Customer 360 History ─────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'overview' | 'timeline'>('overview');
    const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
    const [customerInterests, setCustomerInterests] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        if (!detail) { 
            setCustomerInterests([]); 
            setTimelineEvents([]);
            setActiveTab('overview');
            return; 
        }

        const fetchHistory = async () => {
            setHistoryLoading(true);
            
            const safeFetch = async (query: any) => {
                try { const res = await query; return res; } 
                catch { return { data: [] }; }
            };

            const [
                { data: interestsData },
                { data: leadsData },
                { data: serviceData },
                { data: testDriveData },
                { data: followUpData },
                { data: visitsData },
            ] = await Promise.all([
                safeFetch(supabase.from('lead_car_interests').select('*, car:inventory(id, make, model, year, price, thumbnail)').eq('customer_id', detail.id)),
                safeFetch(supabase.from('leads').select('*').eq('phone', detail.phone)),
                safeFetch(supabase.from('service_bookings').select('*').eq('phone', detail.phone)),
                safeFetch(supabase.from('test_drive_bookings').select('*, car:inventory(make, model)').eq('phone', detail.phone)),
                safeFetch(supabase.from('follow_ups').select('*').eq('customer_id', detail.id)),
                safeFetch(supabase.from('visits').select('*, staff:profiles!staff_id(full_name)').eq('customer_id', detail.id).order('visit_date', { ascending: false })),
            ]);

            setCustomerInterests(interestsData || []);
            setVisits(visitsData as Visit[] || []);

            const events: TimelineEvent[] = [];

            // 1. Sales (from DataContext)
            const custSales = sales.filter(s => s.customer_id === detail.id);
            custSales.forEach(s => {
                events.push({
                    id: `sale-${s.id}`,
                    type: 'sale',
                    title: `Purchased ${s.car?.make || ''} ${s.car?.model || ''}`,
                    description: `Amount: ₹${(s.final_price || 0).toLocaleString('en-IN')}`,
                    date: new Date(s.sale_date || s.created_at),
                    icon: 'directions_car',
                    color: 'emerald',
                    data: s
                });
            });

            // 2. Leads (Car Interests, Insurance, Services)
            (leadsData || []).forEach((l: any) => {
                events.push({
                    id: `lead-${l.id}`,
                    type: 'lead',
                    title: `Enquiry: ${l.type.replace('_', ' ').toUpperCase()}`,
                    description: l.message || (l.car_make ? `Interested in ${l.car_make} ${l.car_model || ''}` : 'General Enquiry'),
                    date: new Date(l.created_at),
                    status: l.status,
                    icon: l.type === 'insurance' ? 'shield' : l.type === 'service' ? 'build' : l.type === 'sell_car' ? 'sell' : 'person_search',
                    color: l.type === 'insurance' ? 'indigo' : l.type === 'service' ? 'orange' : 'primary',
                    data: l
                });
            });

            // 3. Service Bookings
            (serviceData || []).forEach((s: any) => {
                events.push({
                    id: `service-${s.id}`,
                    type: 'service',
                    title: `${s.service_type || 'Service'} Booking`,
                    description: `${s.car_make || 'Vehicle'} ${s.car_model || ''} (${s.car_reg_no || 'N/A'})`,
                    date: new Date(s.created_at),
                    status: s.status,
                    icon: 'home_repair_service',
                    color: 'orange',
                    data: s
                });
            });

            // 4. Test Drives
            (testDriveData || []).forEach((t: any) => {
                events.push({
                    id: `td-${t.id}`,
                    type: 'test_drive',
                    title: `Test Drive Booking`,
                    description: t.car ? `${t.car.make} ${t.car.model}` : 'Vehicle details unavailable',
                    date: new Date(t.created_at),
                    status: t.status,
                    icon: 'drive_eta',
                    color: 'blue',
                    data: t
                });
            });

            // 5. Follow-ups
            (followUpData || []).forEach((f: any) => {
                events.push({
                    id: `fu-${f.id}`,
                    type: 'follow_up',
                    title: `Interaction: ${f.type?.toUpperCase() || 'GENERAL'}`,
                    description: f.notes || 'No notes provided',
                    date: new Date(f.created_at),
                    status: f.status,
                    icon: f.type === 'call' ? 'call' : f.type === 'whatsapp' ? 'forum' : f.type === 'meeting' ? 'handshake' : 'headset_mic',
                    color: 'slate',
                    data: f
                });
            });

            // 6. Visits
            (visitsData || []).forEach((v: any) => {
                events.push({
                    id: `visit-${v.id}`,
                    type: 'visit',
                    title: `Visit: ${v.purpose.toUpperCase()}`,
                    description: `Outcome: ${v.outcome === 'successful' ? 'Successful' : 'Unsuccessful'}. Location: ${v.location || 'N/A'}${v.notes ? ' — ' + v.notes : ''}`,
                    date: new Date(v.visit_date),
                    status: v.status === 'pending_approval' ? 'Pending Approval' : v.status?.toUpperCase(),
                    icon: 'directions_walk',
                    color: v.outcome === 'unsuccessful' ? 'slate' : v.status === 'approved' ? 'emerald' : v.status === 'rejected' ? 'red' : 'amber',
                    data: v
                });
            });

            // Sort descending by date
            events.sort((a, b) => b.date.getTime() - a.date.getTime());
            setTimelineEvents(events);
            setHistoryLoading(false);
        };

        fetchHistory();
    }, [detail, sales]);

    const handleLogVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (visitSaving || !detail) return;
        setVisitSaving(true);

        const payload = {
            lead_id: null,
            customer_id: detail.id,
            staff_id: profile?.id,
            visit_date: visitForm.visit_date,
            purpose: visitForm.purpose,
            location: visitForm.location.trim() || null,
            notes: visitForm.notes.trim() || null,
            outcome: visitForm.outcome,
            status: visitForm.outcome === 'successful' ? 'pending_approval' : 'approved',
        };

        try {
            const { data, error } = await supabase.from('visits').insert(payload).select().single();
            if (!error && data) {
                if (visitForm.outcome === 'successful') {
                    await addNotification({
                        type: 'visit_logged',
                        category: 'critical',
                        priority: 2,
                        icon: 'notifications_active',
                        color: 'amber',
                        title: `🔔 Visit Approval Required`,
                        message: `${profile?.full_name || 'Staff'} logged a successful visit for Customer: ${detail.full_name} (${visitForm.purpose}).`,
                        action_url: `/admin/visits`,
                        action_label: 'View Visits Queue',
                        related_entity_type: 'visit',
                        related_entity_id: data.id,
                        assigned_to_user_id: null,
                        dedup_key: `visit_approval_required_${data.id}`,
                        metadata: {
                            visit_id: data.id,
                            staff_name: profile?.full_name || 'Staff',
                            customer_name: detail.full_name
                        },
                        is_read: false,
                        is_dismissed: false
                    });
                }

                setVisitForm({
                    visit_date: new Date().toISOString().slice(0, 10),
                    purpose: 'Test Drive',
                    location: '',
                    outcome: 'successful',
                    notes: '',
                });
                setIsLoggingVisit(false);
                refreshData();
                setDetail({ ...detail });
            } else {
                throw error;
            }
        } catch (err: any) {
            console.error('Failed to log visit:', err);
            alert('Failed to log visit: ' + (err?.message || 'Please try again.'));
        } finally {
            setVisitSaving(false);
        }
    };

    /**
     * Bulk-fetch lead_car_interests with customer_id so we can search ALL customers
     * by car interest (make/model/reg) without opening their detail panel first.
     * This is separate from the per-detail fetch above which loads full car info for display.
     */
    const [customerCarInterestMap, setCustomerCarInterestMap] = useState<Map<string, Array<{ make: string; model: string; registration_no: string }>>>(new Map());

    useEffect(() => {
        supabase
            .from('lead_car_interests')
            .select('customer_id, car:inventory(make, model, registration_no)')
            .not('customer_id', 'is', null)
            .then(({ data }) => {
                const map = new Map<string, Array<{ make: string; model: string; registration_no: string }>>();
                (data || []).forEach((r: any) => {
                    if (!r.customer_id || !r.car) return;
                    if (!map.has(r.customer_id)) map.set(r.customer_id, []);
                    map.get(r.customer_id)!.push({
                        make:            (r.car.make            || '').toLowerCase(),
                        model:           (r.car.model           || '').toLowerCase(),
                        registration_no: (r.car.registration_no || '').toLowerCase(),
                    });
                });
                setCustomerCarInterestMap(map);
            });
    }, []);

    /**
     * Build a lookup map: customerId → array of purchased car info.
     * Source: sales with joined car:inventory(*) already loaded in DataContext.
     * This allows searching customers by registration number, make, or model
     * without any extra DB round-trip.
     */
    const customerCarMap = useMemo(() => {
        const map = new Map<string, Array<{ make: string; model: string; registration_no: string }>>(
        );
        for (const sale of (sales || [])) {
            const cid = sale.customer_id;
            if (!cid || !sale.car) continue;
            if (!map.has(cid)) map.set(cid, []);
            map.get(cid)!.push({
                make:            (sale.car.make            || '').toLowerCase(),
                model:           (sale.car.model           || '').toLowerCase(),
                registration_no: (sale.car.registration_no || '').toLowerCase(),
            });
        }
        return map;
    }, [sales]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return customers;

        // If RPC results are ready, use them as primary filter (searches relations deeply)
        if (rpcMatchIds !== null) {
            return customers.filter(c => rpcMatchIds.has(c.id));
        }

        // Instant local filter while RPC loads (covers all direct customer fields + car lookup maps)
        return customers.filter(c => {
            // 1. Standard personal fields (expanded)
            if ([
                c.full_name, c.phone, c.email, c.city,
                c.alternate_phone, c.whatsapp_number,
                c.address, c.office_address,
                c.occupation, c.notes,
            ].some(v => v && String(v).toLowerCase().includes(q))) return true;

            // 2. Cars from PURCHASE history (sales → inventory)
            const purchasedCars = customerCarMap.get(c.id) || [];
            if (purchasedCars.some(car =>
                car.make.includes(q) ||
                car.model.includes(q) ||
                car.registration_no.includes(q) ||
                `${car.make} ${car.model}`.includes(q)
            )) return true;

            // 3. Cars from INTEREST history (lead_car_interests with customer_id)
            const interestedCars = customerCarInterestMap.get(c.id) || [];
            return interestedCars.some(car =>
                car.make.includes(q) ||
                car.model.includes(q) ||
                car.registration_no.includes(q) ||
                `${car.make} ${car.model}`.includes(q)
            );
        });
    }, [customers, search, rpcMatchIds, customerCarMap, customerCarInterestMap]);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatCurrency = (val: number) => {
        if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
        if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
        return `₹${val.toLocaleString('en-IN')}`;
    };

    const getCustomerSales = (id: string) => sales.filter(s => s.customer_id === id);

    const openDetail = (c: Customer) => {
        setDetail(c);
        setIsEditing(false);
        setEditForm({
            full_name: c.full_name || '',
            phone: c.phone || '',
            alternate_phone: c.alternate_phone || '',
            whatsapp_number: c.whatsapp_number || '',
            email: c.email || '',
            address: c.address || '',
            office_address: c.office_address || '',
            city: c.city || 'Kolhapur',
            occupation: c.occupation || '',
            date_of_birth: c.date_of_birth || '',
            notes: c.notes || '',
        });
    };

    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!detail || !editForm.full_name || !editForm.phone) return;
        setSaving(true);
        const { error } = await supabase.from('customers').update({
            full_name: editForm.full_name,
            phone: editForm.phone,
            alternate_phone: editForm.alternate_phone || null,
            whatsapp_number: editForm.whatsapp_number || null,
            email: editForm.email || null,
            address: editForm.address || null,
            office_address: editForm.office_address || null,
            city: editForm.city || 'Kolhapur',
            occupation: editForm.occupation || null,
            date_of_birth: editForm.date_of_birth || null,
            notes: editForm.notes || null,
        }).eq('id', detail.id);
        setSaving(false);
        if (!error) {
            setIsEditing(false);
            refreshData();
            setDetail(prev => prev ? { ...prev, ...editForm } as Customer : null);
        } else { alert('Failed to update customer'); }
    };

    const handleDelete = async () => {
        if (!detail) return;
        if (!window.confirm(`Delete ${detail.full_name}? This cannot be undone.`)) return;
        setDeleting(true);
        const { error } = await supabase.from('customers').delete().eq('id', detail.id);
        setDeleting(false);
        if (!error) { setDetail(null); refreshData(); }
        else alert('Failed to delete customer');
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addForm.full_name || !addForm.phone) return;
        setSaving(true);
        const { supabase } = await import('../../lib/supabase');
        const { error } = await supabase.from('customers').insert({
            full_name: addForm.full_name,
            phone: addForm.phone,
            alternate_phone: addForm.alternate_phone || null,
            whatsapp_number: addForm.whatsapp_number || null,
            email: addForm.email || null,
            address: addForm.address || null,
            office_address: addForm.office_address || null,
            city: addForm.city || 'Kolhapur',
            occupation: addForm.occupation || null,
            date_of_birth: addForm.date_of_birth || null,
            notes: addForm.notes || null,
        });
        setSaving(false);
        if (!error) {
            setIsAdding(false);
            setAddForm(emptyForm);
            refreshData();
        } else {
            console.error(error);
            alert('Failed to add customer');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Customer Directory</h1>
                    <p className="text-slate-500 text-sm">{loading ? '...' : customers.length} verified customers in your database.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsAdding(true)} className="h-10 px-5 bg-primary text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-primary-light transition-colors shadow-sm">
                        <span className="material-symbols-outlined text-lg">person_add</span> Add Customer
                    </button>
                    <button onClick={refreshData} className="h-10 w-10 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors" title="Refresh">
                        <span className="material-symbols-outlined text-lg">refresh</span>
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10 w-full max-w-lg">
                <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, email, city, car brand or reg. no…" className="bg-transparent text-sm text-primary outline-none w-full" />
                {search && <button onClick={() => setSearch('')} className="material-symbols-outlined text-slate-300 text-base hover:text-slate-500">close</button>}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                <div className="overflow-x-auto relative">
                    <table className="w-full min-w-[600px]">
                    <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                            <th className="text-left px-5 py-3">Customer</th>
                            <th className="text-left px-5 py-3">Contact</th>
                            <th className="text-left px-5 py-3">City</th>
                            <th className="text-left px-5 py-3">Sales</th>
                            <th className="text-left px-5 py-3">Added On</th>
                            <th className="text-left px-5 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="py-10 text-center text-slate-400">Loading customers...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-16 text-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-200 mb-3 block">people_alt</span>
                                    <p className="text-slate-400 font-medium">No customers found</p>
                                    <p className="text-xs text-slate-300 mt-1">Convert leads or add a customer manually.</p>
                                </td>
                            </tr>
                        ) : (
                            filtered.map((c: Customer) => {
                                const custSales = getCustomerSales(c.id);
                                return (
                                    <tr key={c.id} onClick={() => openDetail(c)} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 cursor-pointer transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="size-9 rounded-full bg-gradient-to-br from-primary to-primary-light text-white flex items-center justify-center text-sm font-bold shrink-0">
                                                    {c.full_name?.charAt(0).toUpperCase() || 'U'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-primary"><HighlightText text={c.full_name} highlight={search} /></p>
                                                    {c.occupation && <p className="text-[10px] text-slate-400">{c.occupation}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-sm font-medium text-slate-700"><HighlightText text={c.phone} highlight={search} /></p>
                                            {c.email && <p className="text-[10px] text-slate-400 truncate max-w-[160px]"><HighlightText text={c.email} highlight={search} /></p>}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-slate-600"><HighlightText text={c.city || '—'} highlight={search} /></td>
                                        <td className="px-5 py-3.5">
                                            {custSales.length > 0 ? (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-green-50 text-green-700 uppercase tracking-wide">
                                                    {custSales.length} Purchase{custSales.length > 1 ? 's' : ''}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-slate-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">{formatDate(c.created_at)}</td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex gap-1">
                                                <a href={`tel:${c.phone}`} className="p-1.5 hover:bg-green-50 rounded-lg" title="Call" onClick={e => e.stopPropagation()}>
                                                    <span className="material-symbols-outlined text-green-500 text-base">call</span>
                                                </a>
                                        <a href={`https://wa.me/91${(c.whatsapp_number || c.phone).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-slate-100 rounded-lg" title="WhatsApp" onClick={e => e.stopPropagation()}>
                                                    <span className="material-symbols-outlined text-slate-400 text-base">chat</span>
                                                </a>
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

            {/* ── Customer Detail Modal ── */}
            {detail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDetail(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className="bg-gradient-to-r from-primary to-primary-light px-6 pt-6 pb-8 rounded-t-3xl relative">
                            <div className="absolute top-4 right-4 flex gap-2">
                                <button onClick={() => setIsEditing(v => !v)} className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors" title="Edit">
                                    <span className="material-symbols-outlined text-white text-lg">{isEditing ? 'close' : 'edit'}</span>
                                </button>
                                <button onClick={() => setDetail(null)} className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                                    <span className="material-symbols-outlined text-white text-lg">close</span>
                                </button>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="size-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-white text-2xl font-black">
                                    {detail.full_name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white">{detail.full_name}</h2>
                                    {detail.occupation && <p className="text-white/70 text-sm mt-0.5">{detail.occupation}</p>}
                                    <p className="text-white/50 text-xs mt-1">Customer since {formatDate(detail.created_at)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="flex border-b border-slate-100 bg-slate-50/50 px-4 pt-2">
                            {(['overview', 'timeline'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-3 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors ${
                                        activeTab === tab
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="px-6 py-5 bg-slate-50/30">
                            {activeTab === 'overview' && (
                                <div className="space-y-5">
                                    {/* Edit Form */}
                                    {isEditing && (
                                        <form onSubmit={handleEditSave} className="space-y-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Edit Details</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Full Name *</label><input required value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" /></div>
                                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Phone *</label><input required value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" /></div>
                                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Email</label><input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" /></div>
                                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">City</label><input value={editForm.city} onChange={e => setEditForm({...editForm, city: e.target.value})} className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" /></div>
                                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">WhatsApp</label><input value={editForm.whatsapp_number} onChange={e => setEditForm({...editForm, whatsapp_number: e.target.value})} className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" /></div>
                                                <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Occupation</label><input value={editForm.occupation} onChange={e => setEditForm({...editForm, occupation: e.target.value})} className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" /></div>
                                            </div>
                                            <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Notes</label><textarea rows={2} value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/10 resize-none" /></div>
                                            <div className="flex gap-2">
                                                {isAdmin && (
                                                    <button type="button" onClick={handleDelete} disabled={deleting} className="flex-1 h-10 bg-red-50 text-red-600 font-bold rounded-xl text-sm hover:bg-red-100 transition disabled:opacity-60">{deleting ? 'Deleting…' : 'Delete Customer'}</button>
                                                )}
                                                <button type="submit" disabled={saving} className="flex-1 h-10 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary-light transition disabled:opacity-60">{saving ? 'Saving…' : 'Save Changes'}</button>
                                            </div>
                                        </form>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <a href={`tel:${detail.phone}`} className="h-11 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-green-200 shadow-sm">
                                            <span className="material-symbols-outlined text-base">call</span> Call
                                        </a>
                                        <a href={toWhatsAppUrl(detail.whatsapp_number || detail.phone)} target="_blank" rel="noreferrer" className="h-11 bg-[#25D366] text-white hover:bg-[#1ebd5a] rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm">
                                            <span className="material-symbols-outlined text-base">forum</span> WhatsApp
                                        </a>
                                    </div>

                                    {/* Contact Info */}
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Contact Information</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { icon: 'call', label: 'Phone', value: detail.phone },
                                                { icon: 'phone_in_talk', label: 'Alt. Phone', value: detail.alternate_phone },
                                                { icon: 'forum', label: 'WhatsApp', value: detail.whatsapp_number },
                                                { icon: 'mail', label: 'Email', value: detail.email },
                                                { icon: 'location_on', label: 'City', value: detail.city },
                                            ].map((item, i) => item.value && (
                                                <div key={i} className="bg-white border border-slate-100 shadow-sm rounded-xl px-3.5 py-3">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="material-symbols-outlined text-slate-400 text-sm">{item.icon}</span>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{item.label}</p>
                                                    </div>
                                                    <p className="text-sm font-semibold text-slate-700 pl-6">{item.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Personal Info */}
                                    {(detail.address || detail.office_address || detail.date_of_birth) && (
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Personal Details</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                {detail.date_of_birth && (
                                                    <div className="bg-white border border-slate-100 shadow-sm rounded-xl px-3.5 py-3">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="material-symbols-outlined text-slate-400 text-sm">cake</span>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Date of Birth</p>
                                                        </div>
                                                        <p className="text-sm font-semibold text-slate-700 pl-6">{formatDate(detail.date_of_birth)}</p>
                                                    </div>
                                                )}
                                                {detail.address && (
                                                    <div className="bg-white border border-slate-100 shadow-sm rounded-xl px-3.5 py-3 col-span-2">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="material-symbols-outlined text-slate-400 text-sm">home</span>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Personal Address</p>
                                                        </div>
                                                        <p className="text-sm font-semibold text-slate-700 pl-6">{detail.address}</p>
                                                    </div>
                                                )}
                                                {detail.office_address && (
                                                    <div className="bg-white border border-slate-100 shadow-sm rounded-xl px-3.5 py-3 col-span-2">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="material-symbols-outlined text-slate-400 text-sm">business</span>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Office Address</p>
                                                        </div>
                                                        <p className="text-sm font-semibold text-slate-700 pl-6">{detail.office_address}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Notes */}
                                    {detail.notes && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 shadow-sm">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="material-symbols-outlined text-amber-500 text-sm">sticky_note_2</span>
                                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Notes</p>
                                            </div>
                                            <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">{detail.notes}</p>
                                        </div>
                                    )}

                                    {/* Car Interests */}
                                    {(historyLoading || customerInterests.length > 0) && (
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Car Interests</p>
                                            {historyLoading ? (
                                                <div className="h-16 bg-slate-100 rounded-xl animate-pulse"></div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {customerInterests.map((interest: any) => (
                                                        <div key={interest.id} className="flex items-center gap-3 bg-white border border-slate-100 shadow-sm rounded-xl px-3.5 py-2.5">
                                                            <div className="size-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                                                {interest.car?.thumbnail ? (
                                                                    <img src={interest.car.thumbnail} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                        <span className="material-symbols-outlined text-slate-400 text-base">directions_car</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-bold text-slate-700 truncate">
                                                                    {interest.car?.year} {interest.car?.make} {interest.car?.model}
                                                                </p>
                                                                <p className="text-xs text-slate-500 font-medium">₹{interest.car?.price?.toLocaleString('en-IN')}</p>
                                                            </div>
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 border ${
                                                                interest.interest_level === 'hot' ? 'bg-red-50 text-red-600 border-red-200' :
                                                                interest.interest_level === 'warm' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                'bg-slate-50 text-slate-500 border-slate-200'
                                                            }`}>
                                                                {interest.interest_level === 'hot' ? '🔥' : interest.interest_level === 'warm' ? '⭐' : '❄️'} {interest.interest_level}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ── Visits Log Panel ────────────────────────── */}
                                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-4">
                                        {/* Header */}
                                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                                            <div className="flex items-center gap-2">
                                                <div className="size-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-emerald-600 text-[18px]">directions_walk</span>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-primary text-xs leading-none">Customer Visits</h4>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">{visits.length} visit{visits.length !== 1 ? 's' : ''} logged</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setIsLoggingVisit(v => !v)}
                                                className={`flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-bold transition-all ${
                                                    isLoggingVisit
                                                        ? 'bg-slate-200 text-slate-600'
                                                        : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm'
                                                }`}
                                            >
                                                <span className="material-symbols-outlined text-sm">{isLoggingVisit ? 'close' : 'add'}</span>
                                                {isLoggingVisit ? 'Cancel' : 'Log Visit'}
                                            </button>
                                        </div>

                                        {isLoggingVisit && (
                                            <form onSubmit={handleLogVisit} className="p-4 border-b border-slate-100 bg-slate-50/30 space-y-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Visit Date</label>
                                                    <input
                                                        required
                                                        type="date"
                                                        value={visitForm.visit_date}
                                                        onChange={e => setVisitForm({ ...visitForm, visit_date: e.target.value })}
                                                        className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs outline-none focus:border-emerald-400 bg-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Purpose</label>
                                                    <select
                                                        value={visitForm.purpose}
                                                        onChange={e => setVisitForm({ ...visitForm, purpose: e.target.value })}
                                                        className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs outline-none focus:border-emerald-400 bg-white"
                                                    >
                                                        <option value="Test Drive">Test Drive</option>
                                                        <option value="Valuation">Valuation</option>
                                                        <option value="Document Collection">Document Collection</option>
                                                        <option value="Showroom Visit">Showroom Visit</option>
                                                        <option value="General Check-in">General Check-in</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Location</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Showroom, Customer Home, etc."
                                                        value={visitForm.location}
                                                        onChange={e => setVisitForm({ ...visitForm, location: e.target.value })}
                                                        className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs outline-none focus:border-emerald-400 bg-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Outcome</label>
                                                    <div className="flex gap-4 py-1">
                                                        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                name="cust_visit_outcome"
                                                                checked={visitForm.outcome === 'successful'}
                                                                onChange={() => setVisitForm({ ...visitForm, outcome: 'successful' })}
                                                                className="accent-emerald-600"
                                                            />
                                                            Successful (Requires Approval)
                                                        </label>
                                                        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                name="cust_visit_outcome"
                                                                checked={visitForm.outcome === 'unsuccessful'}
                                                                onChange={() => setVisitForm({ ...visitForm, outcome: 'unsuccessful' })}
                                                                className="accent-slate-600"
                                                            />
                                                            Unsuccessful
                                                        </label>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Notes / Remarks</label>
                                                    <textarea
                                                        placeholder="Any specific feedback or details..."
                                                        value={visitForm.notes}
                                                        onChange={e => setVisitForm({ ...visitForm, notes: e.target.value })}
                                                        rows={2}
                                                        className="w-full border border-slate-200 rounded-lg p-3 text-xs outline-none focus:border-emerald-400 bg-white"
                                                    />
                                                </div>
                                                <button
                                                    type="submit"
                                                    disabled={visitSaving}
                                                    className="w-full h-9 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                                                >
                                                    {visitSaving ? (
                                                        <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Saving...</>
                                                    ) : (
                                                        <><span className="material-symbols-outlined text-sm">save</span> Log Visit</>
                                                    )}
                                                </button>
                                            </form>
                                        )}

                                        {/* Visits History List */}
                                        <div className="divide-y divide-slate-50 max-h-[240px] overflow-y-auto">
                                            {visitsLoading ? (
                                                <div className="py-4 text-center text-xs text-slate-400">Loading visits...</div>
                                            ) : visits.length === 0 ? (
                                                <div className="py-6 text-center">
                                                    <span className="material-symbols-outlined text-2xl text-slate-200 block mb-1">directions_walk</span>
                                                    <p className="text-[11px] text-slate-400">No visits logged for this customer yet.</p>
                                                </div>
                                            ) : visits.map(v => (
                                                <div key={v.id} className="px-3.5 py-2.5 flex items-start gap-3 hover:bg-slate-50/60 transition-colors">
                                                    <div className={`size-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                                        v.outcome === 'unsuccessful' ? 'bg-slate-100 text-slate-400' :
                                                        v.status === 'approved' ? 'bg-green-100 text-green-600' :
                                                        v.status === 'rejected' ? 'bg-red-100 text-red-600' :
                                                        'bg-amber-100 text-amber-600'
                                                    }`}>
                                                        <span className="material-symbols-outlined text-[14px]">
                                                            {v.outcome === 'unsuccessful' ? 'close' :
                                                             v.status === 'approved' ? 'check_circle' :
                                                             v.status === 'rejected' ? 'cancel' : 'pending'}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                                            <span className="text-xs font-bold text-primary">{v.purpose}</span>
                                                            <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full ${
                                                                v.outcome === 'unsuccessful' ? 'bg-slate-100 text-slate-500' :
                                                                v.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                                v.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                                'bg-amber-100 text-amber-700'
                                                            }`}>
                                                                {v.outcome === 'unsuccessful' ? 'Unsuccessful' :
                                                                 v.status === 'approved' ? 'Approved' :
                                                                 v.status === 'rejected' ? 'Rejected' : 'Pending Approval'}
                                                            </span>
                                                        </div>
                                                        {v.location && (
                                                            <p className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                                                <span className="material-symbols-outlined text-[10px]">location_on</span>
                                                                {v.location}
                                                            </p>
                                                        )}
                                                        {v.notes && <p className="text-[11px] text-slate-500 mt-0.5">{v.notes}</p>}
                                                        {v.admin_remarks && (
                                                            <p className="text-[9px] text-slate-500 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 mt-0.5">
                                                                <span className="font-semibold text-primary">Admin: </span>{v.admin_remarks}
                                                            </p>
                                                        )}
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[9px] text-slate-400 font-medium">
                                                                By {v.staff?.full_name || 'Staff'} • {new Date(v.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Lead Origin Link */}
                                    {(detail as any).lead_id && (
                                        <Link to={`/admin/leads/${(detail as any).lead_id}`} onClick={() => setDetail(null)} className="flex items-center justify-center gap-2 h-11 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 transition-colors">
                                            <span className="material-symbols-outlined text-base">person_search</span> View Original Lead
                                        </Link>
                                    )}
                                </div>
                            )}

                            {activeTab === 'timeline' && (
                                <div className="space-y-4">
                                    {historyLoading ? (
                                        <div className="py-12 text-center text-slate-400 font-medium animate-pulse flex flex-col items-center gap-3">
                                            <span className="size-6 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin"></span>
                                            Loading history...
                                        </div>
                                    ) : timelineEvents.length === 0 ? (
                                        <div className="py-16 text-center bg-white border border-slate-100 rounded-2xl shadow-sm">
                                            <span className="material-symbols-outlined text-4xl text-slate-200 mb-3 block">history</span>
                                            <p className="text-slate-500 font-medium text-sm">No history found for this customer.</p>
                                        </div>
                                    ) : (
                                        <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 pb-4 pt-2">
                                            {timelineEvents.map((event, idx) => {
                                                const bgCol = event.color === 'emerald' ? 'bg-emerald-500' :
                                                              event.color === 'indigo' ? 'bg-indigo-500' :
                                                              event.color === 'orange' ? 'bg-orange-500' :
                                                              event.color === 'blue' ? 'bg-blue-500' :
                                                              event.color === 'primary' ? 'bg-primary' : 'bg-slate-500';
                                                
                                                const textCol = event.color === 'emerald' ? 'text-emerald-700' :
                                                                event.color === 'indigo' ? 'text-indigo-700' :
                                                                event.color === 'orange' ? 'text-orange-700' :
                                                                event.color === 'blue' ? 'text-blue-700' :
                                                                event.color === 'primary' ? 'text-primary' : 'text-slate-700';

                                                return (
                                                    <div key={event.id || idx} className="relative pl-6">
                                                        {/* Timeline node */}
                                                        <div className={`absolute -left-[17px] top-1 size-8 rounded-full border-4 border-slate-50 flex items-center justify-center text-white ${bgCol} shadow-sm z-10`}>
                                                            <span className="material-symbols-outlined text-[14px]">{event.icon}</span>
                                                        </div>
                                                        {/* Content card */}
                                                        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] transition-all relative group overflow-hidden">
                                                            {event.type === 'sale' && <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-100/50 to-transparent rounded-bl-full pointer-events-none -mr-4 -mt-4"></div>}
                                                            
                                                            <div className="flex justify-between items-start gap-3 mb-1.5 relative z-10">
                                                                <h4 className={`text-sm font-black ${textCol}`}>{event.title}</h4>
                                                                <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                                                    {formatDate(event.date.toISOString())}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-600 font-medium leading-relaxed relative z-10">{event.description}</p>
                                                            
                                                            {event.status && (
                                                                <div className="mt-2.5 relative z-10">
                                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200`}>
                                                                        Status: {event.status}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add Customer Modal ── */}
            {isAdding && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-primary font-display">Add Customer</h2>
                                <p className="text-xs text-slate-500">Manually add a new customer to the directory.</p>
                            </div>
                            <button onClick={() => setIsAdding(false)} className="size-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors">
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

                            {/* Name */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Full Name <span className="text-red-400">*</span></label>
                                <input required type="text" value={addForm.full_name} onChange={e => setAddForm({ ...addForm, full_name: e.target.value })} placeholder="e.g., Rahul Patil" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                            </div>

                            {/* Phone + Alt Phone */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Phone <span className="text-red-400">*</span></label>
                                    <input required type="tel" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} placeholder="9876543210" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Alternate Phone <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                                    <input type="tel" value={addForm.alternate_phone} onChange={e => setAddForm({ ...addForm, alternate_phone: e.target.value })} placeholder="9876543210" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                            </div>

                            {/* WhatsApp Number */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">WhatsApp Number <span className="text-xs text-slate-400 font-normal">(if different from primary)</span></label>
                                <input type="tel" value={addForm.whatsapp_number} onChange={e => setAddForm({ ...addForm, whatsapp_number: e.target.value })} placeholder="WhatsApp number" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                            </div>

                            {/* Email + Occupation */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Email <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                                    <input type="email" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} placeholder="rahul@example.com" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Occupation <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                                    <input type="text" value={addForm.occupation} onChange={e => setAddForm({ ...addForm, occupation: e.target.value })} placeholder="e.g., Teacher, Engineer" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                            </div>

                            {/* City + DOB */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">City</label>
                                    <input type="text" value={addForm.city} onChange={e => setAddForm({ ...addForm, city: e.target.value })} placeholder="Kolhapur" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Date of Birth <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                                    <input type="date" value={addForm.date_of_birth} onChange={e => setAddForm({ ...addForm, date_of_birth: e.target.value })} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                            </div>

                            {/* Personal Address */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Personal Address <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                                <input type="text" value={addForm.address} onChange={e => setAddForm({ ...addForm, address: e.target.value })} placeholder="Street, Area, Landmark" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                            </div>

                            {/* Office Address */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Office Address <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                                <input type="text" value={addForm.office_address} onChange={e => setAddForm({ ...addForm, office_address: e.target.value })} placeholder="Workplace / Office address" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Internal Notes <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                                <textarea rows={3} value={addForm.notes} onChange={e => setAddForm({ ...addForm, notes: e.target.value })} placeholder="Any notes about this customer…" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 resize-none" />
                            </div>

                            <div className="pt-1">
                                <button type="submit" disabled={saving} className="w-full h-12 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70">
                                    {saving
                                        ? <><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                                        : <><span className="material-symbols-outlined text-lg">person_add</span> Save Customer</>
                                    }
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Customers;
