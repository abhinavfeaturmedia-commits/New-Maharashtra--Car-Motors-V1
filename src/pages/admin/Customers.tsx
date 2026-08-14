import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
    city: 'Pune',
    occupation: '',
    date_of_birth: '',
    notes: '',
};

const Customers = () => {
    const { isAdmin, profile } = useAuth();
    const { addNotification } = useNotifications();
    const { customers, sales, loading, refreshData } = useData();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
    const [previewCustomer, setPreviewCustomer] = useState<Customer | null>(null);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [detail, setDetail] = useState<Customer | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState(emptyForm);
    const [addForm, setAddForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // ─── Scope Filters & Recent Searches ─────────────────────────────────────────
    type ScopeFilter = 'all' | 'buyers' | 'prospects' | 'expiring_docs' | 'high_ltv' | 'multi_deal' | 'sellers' | 'active_recent';
    const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');

    const [searchHistory, setSearchHistory] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('mm_recent_customer_searches');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const saveSearchTerm = (term: string) => {
        const trimmed = term.trim();
        if (!trimmed || trimmed.length < 2) return;
        setSearchHistory(prev => {
            const updated = [trimmed, ...prev.filter(t => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6);
            try { localStorage.setItem('mm_recent_customer_searches', JSON.stringify(updated)); } catch {}
            return updated;
        });
    };

    const clearSearchHistory = () => {
        setSearchHistory([]);
        try { localStorage.removeItem('mm_recent_customer_searches'); } catch {}
    };

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

    // ─── Customer Data Export State & Field Definitions ───────────────────────
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportScope, setExportScope] = useState<'all' | 'filtered' | 'buyers' | 'prospects'>('all');
    const [exportDatePreset, setExportDatePreset] = useState<'all' | '30d' | '90d' | 'this_year' | 'custom'>('all');
    const [exportCustomStartDate, setExportCustomStartDate] = useState('');
    const [exportCustomEndDate, setExportCustomEndDate] = useState('');
    const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
    const [isExporting, setIsExporting] = useState(false);

    const EXPORT_FIELD_GROUPS = useMemo(() => [
        {
            title: 'Contact & Personal Information',
            category: 'contact',
            icon: 'badge',
            fields: [
                { id: 'full_name', label: 'Full Name', defaultChecked: true },
                { id: 'phone', label: 'Primary Phone', defaultChecked: true },
                { id: 'alternate_phone', label: 'Alternate Phone', defaultChecked: false },
                { id: 'whatsapp_number', label: 'WhatsApp Number', defaultChecked: true },
                { id: 'email', label: 'Email Address', defaultChecked: true },
                { id: 'city', label: 'City / Region', defaultChecked: true },
                { id: 'address', label: 'Residential Address', defaultChecked: false },
                { id: 'office_address', label: 'Office Address', defaultChecked: false },
                { id: 'occupation', label: 'Occupation / Business', defaultChecked: false },
                { id: 'date_of_birth', label: 'Date of Birth', defaultChecked: false },
                { id: 'created_at', label: 'Customer Since (Added Date)', defaultChecked: true },
            ]
        },
        {
            title: 'Sales, Vehicles & Financial Metrics',
            category: 'sales',
            icon: 'payments',
            fields: [
                { id: 'customer_type', label: 'Customer Segment (Buyer / Prospect)', defaultChecked: true },
                { id: 'total_purchases', label: 'Total Purchases Count', defaultChecked: true },
                { id: 'lifetime_value', label: 'Lifetime Spent / LTV Volume (₹)', defaultChecked: true },
                { id: 'purchased_vehicles', label: 'Purchased Vehicles (Make, Model, Year, Reg No)', defaultChecked: true },
                { id: 'last_purchase_date', label: 'Latest Purchase Date', defaultChecked: true },
                { id: 'last_purchase_amount', label: 'Latest Purchase Amount (₹)', defaultChecked: false },
            ]
        },
        {
            title: 'CRM Intelligence & System IDs',
            category: 'engagement',
            icon: 'folder_shared',
            fields: [
                { id: 'notes', label: 'Staff Internal Notes', defaultChecked: false },
                { id: 'customer_id', label: 'Customer Database UUID', defaultChecked: false },
            ]
        }
    ], []);

    const [selectedFields, setSelectedFields] = useState<Set<string>>(() => {
        const initial = new Set<string>();
        [
            'full_name', 'phone', 'whatsapp_number', 'email', 'city', 'created_at',
            'customer_type', 'total_purchases', 'lifetime_value', 'purchased_vehicles', 'last_purchase_date'
        ].forEach(f => initial.add(f));
        return initial;
    });

    const toggleField = (id: string) => {
        setSelectedFields(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleGroup = (groupCategory: string) => {
        const group = EXPORT_FIELD_GROUPS.find(g => g.category === groupCategory);
        if (!group) return;
        const allGroupIds = group.fields.map(f => f.id);
        const allSelected = allGroupIds.every(id => selectedFields.has(id));

        setSelectedFields(prev => {
            const next = new Set(prev);
            if (allSelected) {
                allGroupIds.forEach(id => next.delete(id));
            } else {
                allGroupIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const applyFieldPreset = (preset: 'contacts' | 'sales' | 'all' | 'none') => {
        if (preset === 'none') {
            setSelectedFields(new Set());
        } else if (preset === 'all') {
            const all = new Set<string>();
            EXPORT_FIELD_GROUPS.forEach(g => g.fields.forEach(f => all.add(f.id)));
            setSelectedFields(all);
        } else if (preset === 'contacts') {
            setSelectedFields(new Set([
                'full_name', 'phone', 'alternate_phone', 'whatsapp_number', 'email', 'city', 'address', 'created_at'
            ]));
        } else if (preset === 'sales') {
            setSelectedFields(new Set([
                'full_name', 'phone', 'city', 'customer_type', 'total_purchases', 'lifetime_value', 'purchased_vehicles', 'last_purchase_date'
            ]));
        }
    };

    // ─── Debounced RPC search with rich match metadata ───────────────────────
    const [rpcMatches, setRpcMatches] = useState<Map<string, { type: string; snippet: string }> | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Document & Deal Aggregations for CRM Filters ────────────────────────
    const [expiringDocCustomerIds, setExpiringDocCustomerIds] = useState<Set<string>>(new Set());
    const [customerDocsMap, setCustomerDocsMap] = useState<Map<string, Array<{ id: string; doc_type: string; doc_label: string | null; expiry_date: string | null; file_url: string | null }>>>(new Map());
    const [customerDealsMap, setCustomerDealsMap] = useState<Map<string, Array<{ id: string; car_title: string; reg_no: string; is_seller: boolean; sale_price: number }>>>(new Map());
    const [sellerCustomerIds, setSellerCustomerIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        supabase
            .from('customer_documents')
            .select('id, customer_id, doc_type, doc_label, expiry_date, file_url')
            .then(({ data }) => {
                const expSet = new Set<string>();
                const docMap = new Map<string, Array<{ id: string; doc_type: string; doc_label: string | null; expiry_date: string | null; file_url: string | null }>>();
                (data || []).forEach((d: any) => {
                    if (!d.customer_id) return;
                    if (!docMap.has(d.customer_id)) docMap.set(d.customer_id, []);
                    docMap.get(d.customer_id)!.push(d);
                    if (d.expiry_date) {
                        const days = Math.floor((new Date(d.expiry_date).getTime() - Date.now()) / 86400000);
                        if (days <= 30) {
                            expSet.add(d.customer_id);
                        }
                    }
                });
                setExpiringDocCustomerIds(expSet);
                setCustomerDocsMap(docMap);
            });
    }, []);

    useEffect(() => {
        supabase
            .from('customer_deals')
            .select('id, customer_id, seller_customer_id, total_amount, inventory:inventory_id(make, model, year, registration_no)')
            .then(({ data }) => {
                const dMap = new Map<string, Array<{ id: string; car_title: string; reg_no: string; is_seller: boolean; sale_price: number }>>();
                const sSet = new Set<string>();
                (data || []).forEach((d: any) => {
                    const inv = d.inventory;
                    const carTitle = inv ? `${inv.year || ''} ${inv.make || ''} ${inv.model || ''}`.trim() : 'Vehicle Deal';
                    const regNo = inv?.registration_no || '';
                    const amt = Number(d.total_amount) || 0;
                    if (d.customer_id) {
                        if (!dMap.has(d.customer_id)) dMap.set(d.customer_id, []);
                        dMap.get(d.customer_id)!.push({ id: d.id, car_title: carTitle, reg_no: regNo, is_seller: false, sale_price: amt });
                    }
                    if (d.seller_customer_id) {
                        sSet.add(d.seller_customer_id);
                        if (!dMap.has(d.seller_customer_id)) dMap.set(d.seller_customer_id, []);
                        dMap.get(d.seller_customer_id)!.push({ id: d.id, car_title: carTitle, reg_no: regNo, is_seller: true, sale_price: amt });
                    }
                });
                setCustomerDealsMap(dMap);
                setSellerCustomerIds(sSet);
            });
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const q = search.trim();
        if (!q) {
            setRpcMatches(null);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            try {
                const { data, error } = await supabase.rpc('search_customers_by_text', { search_term: q });
                if (!error && data) {
                    const matchMap = new Map<string, { type: string; snippet: string }>();
                    if (Array.isArray(data)) {
                        data.forEach((row: any) => {
                            if (row && typeof row.id === 'string') {
                                matchMap.set(row.id, {
                                    type: row.match_type || 'contact',
                                    snippet: row.match_snippet || 'Matched Profile'
                                });
                            } else if (typeof row === 'string') {
                                matchMap.set(row, { type: 'contact', snippet: 'Matched Profile' });
                            }
                        });
                    }
                    setRpcMatches(matchMap);
                    saveSearchTerm(q);
                }
            } catch (err) {
                console.error('Customer search RPC error:', err);
            }
        }, 250);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [search]);

    // ─── Keyboard Navigation Listener ──────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) && document.activeElement !== searchInputRef.current) {
                e.preventDefault();
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
                return;
            }
            if (e.key === 'Escape') {
                if (previewCustomer) {
                    setPreviewCustomer(null);
                } else if (showSearchDropdown) {
                    setShowSearchDropdown(false);
                } else if (search) {
                    setSearch('');
                } else {
                    searchInputRef.current?.blur();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [previewCustomer, showSearchDropdown, search]);

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
                        action_url: `/admin/customers`,
                        action_label: 'View Customers',
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
    const [customerCarInterestMap, setCustomerCarInterestMap] = useState<Map<string, Array<{ make: string; model: string; registration_no: string; clean_reg: string }>>>(new Map());

    useEffect(() => {
        supabase
            .from('lead_car_interests')
            .select('customer_id, car:inventory(make, model, registration_no, license_plate)')
            .not('customer_id', 'is', null)
            .then(({ data }) => {
                const map = new Map<string, Array<{ make: string; model: string; registration_no: string; clean_reg: string }>>();
                (data || []).forEach((r: any) => {
                    if (!r.customer_id || !r.car) return;
                    if (!map.has(r.customer_id)) map.set(r.customer_id, []);
                    const reg = (r.car.registration_no || r.car.license_plate || '').toLowerCase();
                    map.get(r.customer_id)!.push({
                        make:            (r.car.make            || '').toLowerCase(),
                        model:           (r.car.model           || '').toLowerCase(),
                        registration_no: reg,
                        clean_reg:       reg.replace(/[^a-z0-9]/g, ''),
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
        const map = new Map<string, Array<{ make: string; model: string; registration_no: string; clean_reg: string }>>();
        for (const sale of (sales || [])) {
            const cid = sale.customer_id;
            if (!cid || !sale.car) continue;
            if (!map.has(cid)) map.set(cid, []);
            const reg = (sale.car.registration_no || sale.car.license_plate || '').toLowerCase();
            map.get(cid)!.push({
                make:            (sale.car.make            || '').toLowerCase(),
                model:           (sale.car.model           || '').toLowerCase(),
                registration_no: reg,
                clean_reg:       reg.replace(/[^a-z0-9]/g, ''),
            });
        }
        return map;
    }, [sales]);

    // ─── Customer Aggregations & Multi-Token Intelligence ────────────────────
    const customerSalesMap = useMemo(() => {
        const map = new Map<string, any[]>();
        (sales || []).forEach(s => {
            if (!s.customer_id) return;
            if (!map.has(s.customer_id)) map.set(s.customer_id, []);
            map.get(s.customer_id)!.push(s);
        });
        return map;
    }, [sales]);

    const customerLtvMap = useMemo(() => {
        const map = new Map<string, number>();
        (sales || []).forEach(s => {
            if (!s.customer_id) return;
            const amt = Number(s.sale_price ?? s.final_price) || 0;
            map.set(s.customer_id, (map.get(s.customer_id) || 0) + amt);
        });
        return map;
    }, [sales]);

    const totalPurchasesVolume = useMemo(() => {
        return sales.reduce((sum, s) => sum + (Number(s.sale_price ?? s.final_price) || 0), 0);
    }, [sales]);

    const activeBuyersCount = useMemo(() => {
        const buyerIds = new Set(sales.map(s => s.customer_id).filter(Boolean));
        return customers.filter(c => buyerIds.has(c.id)).length;
    }, [customers, sales]);

    const expiringDocsCount = useMemo(() => {
        return customers.filter(c => expiringDocCustomerIds.has(c.id)).length;
    }, [customers, expiringDocCustomerIds]);

    const highLtvCount = useMemo(() => {
        return customers.filter(c => (customerLtvMap.get(c.id) || 0) >= 1000000).length;
    }, [customers, customerLtvMap]);

    const multiDealCount = useMemo(() => {
        return customers.filter(c => {
            const sCount = (customerSalesMap.get(c.id) || []).length;
            const dCount = (customerDealsMap.get(c.id) || []).length;
            return (sCount + dCount) >= 2;
        }).length;
    }, [customers, customerSalesMap, customerDealsMap]);

    const sellersCount = useMemo(() => {
        return customers.filter(c => sellerCustomerIds.has(c.id)).length;
    }, [customers, sellerCustomerIds]);

    const activeRecentCount = useMemo(() => {
        const thirtyDaysAgo = Date.now() - 30 * 86400000;
        return customers.filter(c => {
            const created = new Date(c.created_at || '').getTime();
            const custSales = customerSalesMap.get(c.id) || [];
            const hasRecentSale = custSales.some(s => new Date(s.sale_date || s.created_at || '').getTime() >= thirtyDaysAgo);
            return created >= thirtyDaysAgo || hasRecentSale;
        }).length;
    }, [customers, customerSalesMap]);

    // ─── Multi-Token Query Parser & Filter ────────────────────────────────────
    const { filtered, customerMatchReasonMap } = useMemo(() => {
        const rawQ = search.trim();
        const reasonMap = new Map<string, { type: string; snippet: string }>();

        let list = customers;

        // 1. Apply Scope Filter
        const buyerIds = new Set(sales.map(s => s.customer_id).filter(Boolean));

        if (scopeFilter === 'buyers') {
            list = list.filter(c => buyerIds.has(c.id));
        } else if (scopeFilter === 'prospects') {
            list = list.filter(c => !buyerIds.has(c.id));
        } else if (scopeFilter === 'expiring_docs') {
            list = list.filter(c => expiringDocCustomerIds.has(c.id));
        } else if (scopeFilter === 'high_ltv') {
            list = list.filter(c => (customerLtvMap.get(c.id) || 0) >= 1000000);
        } else if (scopeFilter === 'multi_deal') {
            list = list.filter(c => {
                const sCount = (customerSalesMap.get(c.id) || []).length;
                const dCount = (customerDealsMap.get(c.id) || []).length;
                return (sCount + dCount) >= 2;
            });
        } else if (scopeFilter === 'sellers') {
            list = list.filter(c => sellerCustomerIds.has(c.id));
        } else if (scopeFilter === 'active_recent') {
            const thirtyDaysAgo = Date.now() - 30 * 86400000;
            list = list.filter(c => {
                const created = new Date(c.created_at || '').getTime();
                const custSales = customerSalesMap.get(c.id) || [];
                const hasRecentSale = custSales.some(s => new Date(s.sale_date || s.created_at || '').getTime() >= thirtyDaysAgo);
                return created >= thirtyDaysAgo || hasRecentSale;
            });
        }

        if (!rawQ) {
            return { filtered: list, customerMatchReasonMap: reasonMap };
        }

        // 2. Tokenize Query
        const tokens = rawQ.toLowerCase().split(/\s+/).filter(Boolean);
        const cleanRawQ = rawQ.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        const resultList = list.filter(c => {
            // Check if backend RPC confirmed this customer
            if (rpcMatches && rpcMatches.has(c.id)) {
                reasonMap.set(c.id, rpcMatches.get(c.id)!);
                return true;
            }

            const cleanPhone = (c.phone || '').replace(/\D/g, '');
            const cleanAltPhone = (c.alternate_phone || '').replace(/\D/g, '');
            const cleanWhatsapp = (c.whatsapp_number || '').replace(/\D/g, '');
            const purchasedCars = customerCarMap.get(c.id) || [];
            const interestedCars = customerCarInterestMap.get(c.id) || [];
            const docs = customerDocsMap.get(c.id) || [];
            const deals = customerDealsMap.get(c.id) || [];
            const ltv = customerLtvMap.get(c.id) || 0;

            let matchedSnippet: { type: string; snippet: string } | null = null;

            const allTokensMatch = tokens.every(token => {
                // Syntax: city:pune
                if (token.startsWith('city:')) {
                    const val = token.slice(5);
                    return c.city?.toLowerCase().includes(val);
                }
                // Syntax: car:ertiga
                if (token.startsWith('car:') || token.startsWith('make:') || token.startsWith('model:')) {
                    const val = token.split(':')[1];
                    const carMatch = purchasedCars.find(car => car.make.includes(val) || car.model.includes(val))
                        || interestedCars.find(car => car.make.includes(val) || car.model.includes(val));
                    if (carMatch) {
                        matchedSnippet = { type: 'vehicle', snippet: `🚗 ${carMatch.make} ${carMatch.model}` };
                        return true;
                    }
                    return false;
                }
                // Syntax: reg:mh09
                if (token.startsWith('reg:') || token.startsWith('no:')) {
                    const val = token.split(':')[1].replace(/[^a-z0-9]/g, '');
                    const purchasedCarMatch = purchasedCars.find(car => car.clean_reg.includes(val));
                    if (purchasedCarMatch) {
                        matchedSnippet = { type: 'vehicle', snippet: `🚗 Reg: ${purchasedCarMatch.registration_no}` };
                        return true;
                    }
                    const interestCarMatch = interestedCars.find(car => car.clean_reg.includes(val));
                    if (interestCarMatch) {
                        matchedSnippet = { type: 'vehicle', snippet: `🚗 Reg: ${interestCarMatch.registration_no}` };
                        return true;
                    }
                    const dealMatch = deals.find(d => d.reg_no.replace(/[^a-z0-9]/g, '').toLowerCase().includes(val));
                    if (dealMatch) {
                        matchedSnippet = { type: 'vehicle', snippet: `🚗 Reg: ${dealMatch.reg_no}` };
                        return true;
                    }
                    return false;
                }
                // Syntax: doc:invoice
                if (token.startsWith('doc:')) {
                    const val = token.slice(4);
                    const docMatch = docs.find(d => (d.doc_label || '').toLowerCase().includes(val) || d.doc_type.toLowerCase().includes(val));
                    if (docMatch) {
                        matchedSnippet = { type: 'document', snippet: `📄 ${docMatch.doc_label || docMatch.doc_type}` };
                        return true;
                    }
                    return false;
                }
                // Syntax: >5L or >1000000
                if (token.startsWith('>') || token.startsWith('min:')) {
                    const numStr = token.replace(/[^0-9]/g, '');
                    const isLakh = token.includes('l') || token.includes('cr');
                    let targetVal = Number(numStr) || 0;
                    if (token.includes('cr')) targetVal *= 10000000;
                    else if (isLakh) targetVal *= 100000;
                    return ltv >= targetVal;
                }

                // General token match
                if (c.full_name?.toLowerCase().includes(token)) {
                    if (!matchedSnippet) matchedSnippet = { type: 'contact', snippet: `👤 ${c.full_name}` };
                    return true;
                }
                if (c.phone?.includes(token) || (cleanRawQ && cleanPhone.includes(cleanRawQ))) {
                    if (!matchedSnippet) matchedSnippet = { type: 'contact', snippet: `📞 ${c.phone}` };
                    return true;
                }
                if (c.city?.toLowerCase().includes(token)) {
                    if (!matchedSnippet) matchedSnippet = { type: 'contact', snippet: `📍 ${c.city}` };
                    return true;
                }
                if (c.occupation?.toLowerCase().includes(token)) {
                    if (!matchedSnippet) matchedSnippet = { type: 'contact', snippet: `💼 ${c.occupation}` };
                    return true;
                }
                if (c.email?.toLowerCase().includes(token)) {
                    if (!matchedSnippet) matchedSnippet = { type: 'contact', snippet: `✉️ ${c.email}` };
                    return true;
                }
                if (c.notes?.toLowerCase().includes(token)) {
                    if (!matchedSnippet) matchedSnippet = { type: 'contact', snippet: `📝 ${c.notes.slice(0, 30)}…` };
                    return true;
                }

                // Car check
                const carMatch = purchasedCars.find(car => car.make.includes(token) || car.model.includes(token) || car.registration_no.includes(token) || (cleanRawQ && car.clean_reg.includes(cleanRawQ)));
                if (carMatch) {
                    matchedSnippet = { type: 'vehicle', snippet: `🚗 ${carMatch.make} ${carMatch.model} (${carMatch.registration_no})` };
                    return true;
                }

                const dealMatch = deals.find(d => d.car_title.toLowerCase().includes(token) || d.reg_no.toLowerCase().includes(token));
                if (dealMatch) {
                    matchedSnippet = { type: 'vehicle', snippet: `🏷️ Deal: ${dealMatch.car_title} (${dealMatch.reg_no})` };
                    return true;
                }

                const docMatch = docs.find(d => (d.doc_label || '').toLowerCase().includes(token) || d.doc_type.toLowerCase().includes(token));
                if (docMatch) {
                    matchedSnippet = { type: 'document', snippet: `📄 ${docMatch.doc_label || docMatch.doc_type}` };
                    return true;
                }

                const intMatch = interestedCars.find(car => car.make.includes(token) || car.model.includes(token));
                if (intMatch) {
                    matchedSnippet = { type: 'lead', snippet: `🎯 Interest: ${intMatch.make} ${intMatch.model}` };
                    return true;
                }

                return false;
            });

            if (allTokensMatch && matchedSnippet) {
                reasonMap.set(c.id, matchedSnippet);
            }

            return allTokensMatch;
        });

        return { filtered: resultList, customerMatchReasonMap: reasonMap };
    }, [customers, sales, scopeFilter, search, rpcMatches, customerCarMap, customerCarInterestMap, customerDocsMap, customerDealsMap, expiringDocCustomerIds, customerLtvMap, customerSalesMap, sellerCustomerIds]);

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
            city: c.city || 'Pune',
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
            city: editForm.city || 'Pune',
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
        const { error } = await supabase.from('customers').insert({
            full_name: addForm.full_name,
            phone: addForm.phone,
            alternate_phone: addForm.alternate_phone || null,
            whatsapp_number: addForm.whatsapp_number || null,
            email: addForm.email || null,
            address: addForm.address || null,
            office_address: addForm.office_address || null,
            city: addForm.city || 'Pune',
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

    // ─── Export Dataset Computation & Download Handler ────────────────────────
    const exportDataset = useMemo(() => {
        let baseList: Customer[] = [];
        const buyerIds = new Set(sales.map(s => s.customer_id).filter(Boolean));

        if (exportScope === 'all') baseList = customers;
        else if (exportScope === 'filtered') baseList = filtered;
        else if (exportScope === 'buyers') baseList = customers.filter(c => buyerIds.has(c.id));
        else if (exportScope === 'prospects') baseList = customers.filter(c => !buyerIds.has(c.id));

        // Date filter based on created_at
        if (exportDatePreset === '30d') {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);
            baseList = baseList.filter(c => new Date(c.created_at) >= cutoff);
        } else if (exportDatePreset === '90d') {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 90);
            baseList = baseList.filter(c => new Date(c.created_at) >= cutoff);
        } else if (exportDatePreset === 'this_year') {
            const startOfYear = new Date(new Date().getFullYear(), 0, 1);
            baseList = baseList.filter(c => new Date(c.created_at) >= startOfYear);
        } else if (exportDatePreset === 'custom' && exportCustomStartDate) {
            const start = new Date(exportCustomStartDate);
            const end = exportCustomEndDate ? new Date(exportCustomEndDate + 'T23:59:59') : new Date();
            baseList = baseList.filter(c => {
                const d = new Date(c.created_at);
                return d >= start && d <= end;
            });
        }

        return baseList;
    }, [customers, filtered, sales, exportScope, exportDatePreset, exportCustomStartDate, exportCustomEndDate]);

    const handleExecuteExport = () => {
        if (selectedFields.size === 0) {
            alert('Please select at least one field to export.');
            return;
        }

        if (exportDataset.length === 0) {
            alert('No customer records match the selected audience and date filters.');
            return;
        }

        setIsExporting(true);

        try {
            // Build rich relational export rows
            const formattedRows = exportDataset.map(c => {
                const custSales = sales.filter(s => s.customer_id === c.id);
                const totalSpent = custSales.reduce((sum, s) => sum + (Number(s.sale_price ?? s.final_price) || 0), 0);
                const isBuyer = custSales.length > 0;
                
                const vehicleList = custSales.map(s => {
                    if (s.car) {
                        return `${s.car.year || ''} ${s.car.make || ''} ${s.car.model || ''}${s.car.registration_no ? ` (${s.car.registration_no})` : ''}`.trim();
                    }
                    return `Car ID: ${s.inventory_id || s.car_id || 'N/A'}`;
                }).filter(Boolean).join('; ');

                const latestSale = custSales[0];
                const latestPurchaseDate = latestSale?.sale_date ? new Date(latestSale.sale_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
                const latestPurchaseAmount = latestSale ? Number(latestSale.sale_price ?? latestSale.final_price) || 0 : 0;

                const row: Record<string, any> = {};

                if (selectedFields.has('full_name')) row['Full Name'] = c.full_name || '';
                if (selectedFields.has('phone')) row['Primary Phone'] = c.phone || '';
                if (selectedFields.has('alternate_phone')) row['Alternate Phone'] = c.alternate_phone || '';
                if (selectedFields.has('whatsapp_number')) row['WhatsApp Number'] = c.whatsapp_number || c.phone || '';
                if (selectedFields.has('email')) row['Email Address'] = c.email || '';
                if (selectedFields.has('city')) row['City'] = c.city || '';
                if (selectedFields.has('address')) row['Residential Address'] = c.address || '';
                if (selectedFields.has('office_address')) row['Office Address'] = c.office_address || '';
                if (selectedFields.has('occupation')) row['Occupation'] = c.occupation || '';
                if (selectedFields.has('date_of_birth')) row['Date of Birth'] = c.date_of_birth || '';
                if (selectedFields.has('created_at')) row['Customer Since'] = c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
                
                if (selectedFields.has('customer_type')) row['Customer Segment'] = isBuyer ? 'Verified Buyer' : 'Active Prospect';
                if (selectedFields.has('total_purchases')) row['Total Purchases'] = custSales.length;
                if (selectedFields.has('lifetime_value')) row['Lifetime Spent (INR)'] = totalSpent;
                if (selectedFields.has('purchased_vehicles')) row['Purchased Vehicles'] = vehicleList || 'None';
                if (selectedFields.has('last_purchase_date')) row['Latest Purchase Date'] = latestPurchaseDate;
                if (selectedFields.has('last_purchase_amount')) row['Latest Purchase Amount (INR)'] = latestPurchaseAmount;
                
                if (selectedFields.has('notes')) row['Staff Notes'] = c.notes || '';
                if (selectedFields.has('customer_id')) row['Customer UUID'] = c.id;

                return row;
            });

            const timestamp = new Date().toISOString().slice(0, 10);
            const audienceTag = exportScope === 'all' ? 'All' : exportScope === 'buyers' ? 'Buyers' : exportScope === 'prospects' ? 'Prospects' : 'Filtered';

            if (exportFormat === 'csv') {
                const filename = `Maharashtra_Motors_Customers_${audienceTag}_${timestamp}.csv`;
                const headers = Object.keys(formattedRows[0]);
                const csvRows = [
                    headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
                    ...formattedRows.map(row =>
                        headers.map(h => {
                            const val = row[h] ?? '';
                            const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
                            return `"${str.replace(/"/g, '""')}"`;
                        }).join(',')
                    )
                ].join('\r\n');

                const blob = new Blob(['\uFEFF' + csvRows], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else {
                const filename = `Maharashtra_Motors_Customers_${audienceTag}_${timestamp}.json`;
                const jsonBlob = new Blob([JSON.stringify(formattedRows, null, 2)], { type: 'application/json;charset=utf-8;' });
                const url = URL.createObjectURL(jsonBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }

            addNotification({
                title: 'Customer Export Generated',
                message: `Successfully exported ${formattedRows.length} customer records with ${selectedFields.size} fields.`,
                type: 'success'
            });

            setIsExportModalOpen(false);
        } catch (err: any) {
            console.error('Export failed:', err);
            alert('Failed to generate export: ' + (err.message || 'Unknown error'));
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Customer Directory</h1>
                    <p className="text-slate-500 text-sm">{loading ? '...' : customers.length} verified customers in your database.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setIsExportModalOpen(true)}
                        className="h-10 px-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-slate-200 transition-colors border border-slate-200 shadow-xs"
                        title="Export customer data with custom field selection"
                    >
                        <span className="material-symbols-outlined text-base text-slate-600">download</span> Export Data
                    </button>
                    <Link to="/admin/sales" className="h-10 px-3.5 bg-green-50 text-green-700 font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-green-100 transition-colors border border-green-200">
                        <span className="material-symbols-outlined text-base">point_of_sale</span> Sales
                    </Link>
                    <Link to="/admin/leads" className="h-10 px-3.5 bg-purple-50 text-purple-700 font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-purple-100 transition-colors border border-purple-200">
                        <span className="material-symbols-outlined text-base">person_search</span> Leads
                    </Link>
                    <Link to="/admin/customer-alerts" className="h-10 px-3.5 bg-red-50 text-red-600 font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-red-100 transition-colors border border-red-200">
                        <span className="material-symbols-outlined text-base">warning</span> Expiry Alerts
                    </Link>
                    <button onClick={() => setIsAdding(true)} className="h-10 px-4 bg-primary text-white font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-primary-light transition-colors shadow-sm">
                        <span className="material-symbols-outlined text-base">person_add</span> Add Customer
                    </button>
                    <button onClick={refreshData} className="h-10 w-10 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors" title="Refresh">
                        <span className="material-symbols-outlined text-base">refresh</span>
                    </button>
                </div>
            </div>

            {/* CRM Summary KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)]">
                    <div className="size-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                        <span className="material-symbols-outlined text-lg">groups</span>
                    </div>
                    <p className="text-xl font-black text-primary font-display">{customers.length}</p>
                    <p className="text-xs text-slate-400 font-medium">Total Directory</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)]">
                    <div className="size-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center mb-2">
                        <span className="material-symbols-outlined text-lg">verified</span>
                    </div>
                    <p className="text-xl font-black text-primary font-display">{activeBuyersCount}</p>
                    <p className="text-xs text-slate-400 font-medium">Verified Buyers</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)]">
                    <div className="size-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
                        <span className="material-symbols-outlined text-lg">payments</span>
                    </div>
                    <p className="text-xl font-black text-primary font-display">{formatCurrency(totalPurchasesVolume)}</p>
                    <p className="text-xs text-slate-400 font-medium">Lifetime LTV Volume</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)]">
                    <div className="size-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
                        <span className="material-symbols-outlined text-lg">person_search</span>
                    </div>
                    <p className="text-xl font-black text-primary font-display">{customers.length - activeBuyersCount}</p>
                    <p className="text-xs text-slate-400 font-medium">Active Prospects</p>
                </div>
            </div>

            {/* ── Filter Tabs, Quick Scope Pills & Search Bar ── */}
            <div className="space-y-3">
                {/* Search Bar & Command Center Bar */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Primary Scope Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1 overflow-x-auto">
                        {[
                            { id: 'all', label: 'All Customers', count: customers.length, icon: 'groups' },
                            { id: 'buyers', label: 'Verified Buyers', count: activeBuyersCount, icon: 'verified' },
                            { id: 'prospects', label: 'Prospects', count: customers.length - activeBuyersCount, icon: 'person_search' },
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setScopeFilter(t.id as any)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                                    scopeFilter === t.id
                                        ? 'bg-white text-primary shadow-xs'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <span className="material-symbols-outlined text-sm">{t.icon}</span>
                                {t.label} ({t.count})
                            </button>
                        ))}
                    </div>

                    {/* Search Input Box with Keyboard Hints & Recent Dropdown */}
                    <div className="relative w-full max-w-lg">
                        <div className="flex items-center gap-2 bg-white border border-slate-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 rounded-xl px-3 h-11 transition-all shadow-xs">
                            <span className="material-symbols-outlined text-slate-400 text-lg shrink-0">search</span>
                            <input
                                ref={searchInputRef}
                                value={search}
                                onChange={e => {
                                    setSearch(e.target.value);
                                    setShowSearchDropdown(true);
                                }}
                                onFocus={() => setShowSearchDropdown(true)}
                                placeholder="Search name, phone, email, city, car brand, reg. no (e.g. MH09, Ertiga)…"
                                className="bg-transparent text-sm text-primary outline-none w-full placeholder:text-slate-400"
                            />
                            {search ? (
                                <button
                                    onClick={() => {
                                        setSearch('');
                                        setShowSearchDropdown(false);
                                    }}
                                    className="material-symbols-outlined text-slate-300 text-base hover:text-slate-600 transition-colors"
                                    title="Clear search"
                                >
                                    close
                                </button>
                            ) : (
                                <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 hidden sm:inline-block">
                                    / or ⌘K
                                </span>
                            )}
                        </div>

                        {/* Recent Searches Dropdown */}
                        {showSearchDropdown && !search && searchHistory.length > 0 && (
                            <div className="absolute top-12 left-0 right-0 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5 animate-in fade-in slide-in-from-top-1">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                        <span className="material-symbols-outlined text-xs">history</span> Recent Searches
                                    </span>
                                    <button
                                        onClick={clearSearchHistory}
                                        className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        Clear History
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {searchHistory.map((term, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                setSearch(term);
                                                setShowSearchDropdown(false);
                                            }}
                                            className="text-xs font-medium text-slate-700 bg-slate-50 hover:bg-primary/10 hover:text-primary border border-slate-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-xs text-slate-400">search</span>
                                            {term}
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                                    <span>Tip: You can use <code className="font-mono text-primary font-bold">city:pune</code> or <code className="font-mono text-primary font-bold">reg:mh09</code></span>
                                    <button onClick={() => setShowSearchDropdown(false)} className="text-slate-400 hover:text-slate-600 font-bold">Close</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Scope Filter Chips Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">tune</span> Quick Scopes:
                    </span>

                    <button
                        onClick={() => setScopeFilter(scopeFilter === 'expiring_docs' ? 'all' : 'expiring_docs')}
                        className={`px-3 py-1 rounded-xl font-bold border transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            scopeFilter === 'expiring_docs'
                                ? 'bg-red-500 text-white border-red-500 shadow-xs'
                                : 'bg-red-50/70 text-red-700 border-red-200/80 hover:bg-red-100'
                        }`}
                    >
                        <span className="material-symbols-outlined text-xs">warning</span>
                        Expiring Docs ({expiringDocsCount})
                    </button>

                    <button
                        onClick={() => setScopeFilter(scopeFilter === 'high_ltv' ? 'all' : 'high_ltv')}
                        className={`px-3 py-1 rounded-xl font-bold border transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            scopeFilter === 'high_ltv'
                                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                : 'bg-amber-50/70 text-amber-800 border-amber-200/80 hover:bg-amber-100'
                        }`}
                    >
                        <span className="material-symbols-outlined text-xs">diamond</span>
                        High LTV &gt;₹10L ({highLtvCount})
                    </button>

                    <button
                        onClick={() => setScopeFilter(scopeFilter === 'multi_deal' ? 'all' : 'multi_deal')}
                        className={`px-3 py-1 rounded-xl font-bold border transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            scopeFilter === 'multi_deal'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-emerald-50/70 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100'
                        }`}
                    >
                        <span className="material-symbols-outlined text-xs">repeat</span>
                        Multi-Deal 2+ ({multiDealCount})
                    </button>

                    <button
                        onClick={() => setScopeFilter(scopeFilter === 'sellers' ? 'all' : 'sellers')}
                        className={`px-3 py-1 rounded-xl font-bold border transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            scopeFilter === 'sellers'
                                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                : 'bg-purple-50/70 text-purple-800 border-purple-200/80 hover:bg-purple-100'
                        }`}
                    >
                        <span className="material-symbols-outlined text-xs">sell</span>
                        Sellers / Consignment ({sellersCount})
                    </button>

                    <button
                        onClick={() => setScopeFilter(scopeFilter === 'active_recent' ? 'all' : 'active_recent')}
                        className={`px-3 py-1 rounded-xl font-bold border transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            scopeFilter === 'active_recent'
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-blue-50/70 text-blue-800 border-blue-200/80 hover:bg-blue-100'
                        }`}
                    >
                        <span className="material-symbols-outlined text-xs">schedule</span>
                        Active 30d ({activeRecentCount})
                    </button>

                    {scopeFilter !== 'all' && (
                        <button
                            onClick={() => setScopeFilter('all')}
                            className="px-2.5 py-1 text-slate-400 hover:text-slate-700 text-[11px] font-bold underline whitespace-nowrap"
                        >
                            Reset Scope
                        </button>
                    )}
                </div>
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
                            <th className="text-left px-5 py-3">Sales & Deals</th>
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
                                    <p className="text-xs text-slate-300 mt-1">Try clearing your search query or reset filter scope.</p>
                                    {(search || scopeFilter !== 'all') && (
                                        <button
                                            onClick={() => { setSearch(''); setScopeFilter('all'); }}
                                            className="mt-3 px-4 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-all"
                                        >
                                            Clear All Filters
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((c: Customer, idx: number) => {
                                const custSales = getCustomerSales(c.id);
                                const deals = customerDealsMap.get(c.id) || [];
                                const docs = customerDocsMap.get(c.id) || [];
                                const ltv = customerLtvMap.get(c.id) || 0;
                                const isSeller = sellerCustomerIds.has(c.id);
                                const matchReason = customerMatchReasonMap.get(c.id);
                                const isSelected = selectedRowIndex === idx;

                                return (
                                    <tr
                                        key={c.id}
                                        onClick={() => navigate(`/admin/customers/${c.id}`)}
                                        className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/70 cursor-pointer transition-colors group ${
                                            isSelected ? 'bg-primary/5 ring-1 ring-primary/20' : ''
                                        }`}
                                    >
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-start gap-2.5">
                                                <div className="size-9 rounded-full bg-gradient-to-br from-primary to-primary-light text-white flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                                                    {c.full_name?.charAt(0).toUpperCase() || 'U'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-primary group-hover:text-accent transition-colors flex items-center gap-1">
                                                        <HighlightText text={c.full_name} highlight={search} />
                                                        <span className="material-symbols-outlined text-xs opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                                                    </p>
                                                    
                                                    {c.occupation && <p className="text-[10px] text-slate-400">{c.occupation}</p>}

                                                    {/* Match Reasoning Badge */}
                                                    {search && matchReason && (
                                                        <div className="mt-1 flex items-center gap-1">
                                                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                                                matchReason.type === 'vehicle' 
                                                                    ? 'bg-amber-50 text-amber-800 border-amber-200/80' 
                                                                    : matchReason.type === 'document'
                                                                    ? 'bg-purple-50 text-purple-800 border-purple-200/80'
                                                                    : matchReason.type === 'lead'
                                                                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200/80'
                                                                    : 'bg-blue-50 text-blue-800 border-blue-200/80'
                                                            }`}>
                                                                <span className="material-symbols-outlined text-[11px]">
                                                                    {matchReason.type === 'vehicle' ? 'directions_car' : matchReason.type === 'document' ? 'description' : matchReason.type === 'lead' ? 'track_changes' : 'search_insights'}
                                                                </span>
                                                                <span><HighlightText text={matchReason.snippet} highlight={search} /></span>
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-sm font-medium text-slate-700"><HighlightText text={c.phone} highlight={search} /></p>
                                            {c.email && <p className="text-[10px] text-slate-400 truncate max-w-[160px]"><HighlightText text={c.email} highlight={search} /></p>}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-slate-600"><HighlightText text={c.city || 'Pune'} highlight={search} /></td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex flex-col gap-0.5">
                                                {custSales.length > 0 ? (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-green-50 text-green-700 uppercase tracking-wide inline-block w-max">
                                                        {custSales.length} Purchase{custSales.length > 1 ? 's' : ''} ({formatCurrency(ltv)})
                                                    </span>
                                                ) : isSeller ? (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 uppercase tracking-wide inline-block w-max">
                                                        🏷️ Consignment Seller
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-300">—</span>
                                                )}
                                                {deals.length > custSales.length && (
                                                    <span className="text-[9px] text-slate-400 font-medium">
                                                        {deals.length} total deal records
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">{formatDate(c.created_at)}</td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        setPreviewCustomer(c);
                                                    }}
                                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                                    title="Quick Glance Preview"
                                                >
                                                    <span className="material-symbols-outlined text-xs">visibility</span> Glance
                                                </button>
                                                <Link to={`/admin/customers/${c.id}`} onClick={e => e.stopPropagation()} className="px-2.5 py-1 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-xs">account_box</span> 360 Hub
                                                </Link>
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

            {/* ── Interactive Live Customer Glance Slide-Over Drawer ── */}
            {previewCustomer && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity" onClick={() => setPreviewCustomer(null)}>
                    <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between animate-in slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="size-12 rounded-2xl bg-gradient-to-br from-primary to-primary-light text-white flex items-center justify-center text-lg font-bold shadow-md">
                                        {previewCustomer.full_name?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-900">{previewCustomer.full_name}</h3>
                                        <p className="text-xs text-slate-500">{previewCustomer.city || 'Pune'} · {previewCustomer.occupation || 'Customer'}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Added: {formatDate(previewCustomer.created_at)}</p>
                                    </div>
                                </div>
                                <button onClick={() => setPreviewCustomer(null)} className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-base">close</span>
                                </button>
                            </div>

                            {/* Quick Action Contact Bar */}
                            <div className="grid grid-cols-3 gap-2">
                                <a
                                    href={`tel:${previewCustomer.phone}`}
                                    className="flex flex-col items-center justify-center p-2.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl transition-colors text-center border border-green-200/80"
                                >
                                    <span className="material-symbols-outlined text-lg mb-0.5">call</span>
                                    <span className="text-[11px] font-bold">Call Phone</span>
                                </a>
                                <a
                                    href={`https://wa.me/91${(previewCustomer.whatsapp_number || previewCustomer.phone).replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex flex-col items-center justify-center p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors text-center border border-emerald-200/80"
                                >
                                    <span className="material-symbols-outlined text-lg mb-0.5">chat</span>
                                    <span className="text-[11px] font-bold">WhatsApp</span>
                                </a>
                                <a
                                    href={previewCustomer.email ? `mailto:${previewCustomer.email}` : '#'}
                                    className={`flex flex-col items-center justify-center p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors text-center border border-blue-200/80 ${!previewCustomer.email ? 'opacity-50 pointer-events-none' : ''}`}
                                >
                                    <span className="material-symbols-outlined text-lg mb-0.5">mail</span>
                                    <span className="text-[11px] font-bold">Send Email</span>
                                </a>
                            </div>

                            {/* Financial Metrics */}
                            <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Lifetime Spent (LTV)</p>
                                    <p className="text-base font-black text-slate-900 mt-0.5">{formatCurrency(customerLtvMap.get(previewCustomer.id) || 0)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Purchases / Deals</p>
                                    <p className="text-base font-black text-primary mt-0.5">{(customerSalesMap.get(previewCustomer.id) || []).length} Purchases</p>
                                </div>
                            </div>

                            {/* Linked Cars & Deals */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm">directions_car</span> Linked Vehicles & Deals
                                </h4>
                                {((customerCarMap.get(previewCustomer.id) || []).length === 0 && (customerDealsMap.get(previewCustomer.id) || []).length === 0) ? (
                                    <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl">No purchased vehicles linked yet.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {(customerCarMap.get(previewCustomer.id) || []).map((car, i) => (
                                            <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                                                <span className="font-bold text-slate-800 uppercase">{car.make} {car.model}</span>
                                                <span className="font-mono text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">{car.registration_no || 'No Reg'}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Vault Documents Status */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm">folder_open</span> Document Vault
                                </h4>
                                {((customerDocsMap.get(previewCustomer.id) || []).length === 0) ? (
                                    <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl">No vault documents attached yet.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {(customerDocsMap.get(previewCustomer.id) || []).map(doc => {
                                            const days = doc.expiry_date ? Math.floor((new Date(doc.expiry_date).getTime() - Date.now()) / 86400000) : null;
                                            return (
                                                <div key={doc.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                                                    <span className="font-medium text-slate-700 truncate max-w-[200px]">{doc.doc_label || doc.doc_type}</span>
                                                    {days !== null ? (
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${days <= 30 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                            {days <= 30 ? `Exp in ${days}d` : 'Valid'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400">KYC</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Slide-over Footer */}
                        <div className="pt-4 border-t border-slate-100 mt-6 flex items-center gap-2">
                            <button
                                onClick={() => navigate(`/admin/customers/${previewCustomer.id}`)}
                                className="flex-1 h-11 bg-primary text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 hover:bg-primary-light transition-colors shadow-sm"
                            >
                                <span className="material-symbols-outlined text-sm">account_box</span> Open 360 Hub
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                    <input type="text" value={addForm.city} onChange={e => setAddForm({ ...addForm, city: e.target.value })} placeholder="Pune" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
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

            {/* ─── Export Customer Data Modal ─── */}
            {isExportModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-2xl w-full overflow-hidden my-6 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                                    <span className="material-symbols-outlined text-xl">download</span>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-primary font-display">Export Customer Directory</h3>
                                    <p className="text-xs text-slate-500">Configure target audience, select data columns, and export</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsExportModalOpen(false)}
                                className="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 overflow-y-auto space-y-5 divide-y divide-slate-100">
                            {/* Step 1: Target Audience & Date Filter */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-sm text-primary">group</span>
                                        1. Select Customer Audience
                                    </label>
                                    <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                                        {exportDataset.length} Records Selected
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { id: 'all', label: 'All Customers', count: customers.length },
                                        { id: 'filtered', label: 'Current View', count: filtered.length },
                                        { id: 'buyers', label: 'Verified Buyers', count: activeBuyersCount },
                                        { id: 'prospects', label: 'Prospects Only', count: Math.max(0, customers.length - activeBuyersCount) },
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setExportScope(opt.id as any)}
                                            className={`p-2.5 rounded-2xl border text-left transition-all ${
                                                exportScope === opt.id
                                                    ? 'border-primary bg-primary/5 shadow-xs'
                                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                            }`}
                                        >
                                            <p className={`text-xs font-bold ${exportScope === opt.id ? 'text-primary' : 'text-slate-700'}`}>
                                                {opt.label}
                                            </p>
                                            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{opt.count} customers</p>
                                        </button>
                                    ))}
                                </div>

                                {/* Date Range Preset Selector */}
                                <div className="pt-2">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[11px] font-bold text-slate-600">Joined / Added Date Filter</label>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[
                                            { id: 'all', label: 'All Time' },
                                            { id: '30d', label: 'Last 30 Days' },
                                            { id: '90d', label: 'Last 90 Days' },
                                            { id: 'this_year', label: 'This Year (2026)' },
                                            { id: 'custom', label: 'Custom Range' },
                                        ].map(preset => (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => setExportDatePreset(preset.id as any)}
                                                className={`text-xs font-semibold px-3 py-1 rounded-xl border transition-all ${
                                                    exportDatePreset === preset.id
                                                        ? 'bg-primary text-white border-primary shadow-xs'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                }`}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom Date Pickers */}
                                    {exportDatePreset === 'custom' && (
                                        <div className="grid grid-cols-2 gap-3 mt-2.5 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Start Date</label>
                                                <input
                                                    type="date"
                                                    value={exportCustomStartDate}
                                                    onChange={e => setExportCustomStartDate(e.target.value)}
                                                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">End Date</label>
                                                <input
                                                    type="date"
                                                    value={exportCustomEndDate}
                                                    onChange={e => setExportCustomEndDate(e.target.value)}
                                                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Step 2: Granular Column Selection */}
                            <div className="pt-4 space-y-3">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-sm text-primary">checklist</span>
                                        2. Select Columns To Export
                                    </label>

                                    {/* Quick Preset Buttons */}
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => applyFieldPreset('contacts')}
                                            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
                                        >
                                            ⚡ Contacts
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyFieldPreset('sales')}
                                            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition"
                                        >
                                            💼 Sales & LTV
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyFieldPreset('all')}
                                            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition"
                                        >
                                            🔍 Full Dossier
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyFieldPreset('none')}
                                            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                {/* Field Categories Accordion / Cards */}
                                <div className="space-y-3">
                                    {EXPORT_FIELD_GROUPS.map(group => {
                                        const allInGroupSelected = group.fields.every(f => selectedFields.has(f.id));
                                        const someInGroupSelected = group.fields.some(f => selectedFields.has(f.id));

                                        return (
                                            <div key={group.category} className="border border-slate-200 rounded-2xl p-3 bg-white">
                                                <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-base text-primary">{group.icon}</span>
                                                        <span className="text-xs font-bold text-slate-800">{group.title}</span>
                                                        <span className="text-[10px] font-semibold text-slate-400">
                                                            ({group.fields.filter(f => selectedFields.has(f.id)).length}/{group.fields.length})
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleGroup(group.category)}
                                                        className="text-[11px] font-bold text-primary hover:underline"
                                                    >
                                                        {allInGroupSelected ? 'Deselect All' : 'Select All'}
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {group.fields.map(field => {
                                                        const isChecked = selectedFields.has(field.id);
                                                        return (
                                                            <label
                                                                key={field.id}
                                                                className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                                                                    isChecked
                                                                        ? 'border-primary/40 bg-primary/5 text-slate-900 font-semibold'
                                                                        : 'border-slate-100 hover:border-slate-200 bg-slate-50/50 text-slate-600'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => toggleField(field.id)}
                                                                    className="size-4 rounded border-slate-300 text-primary focus:ring-primary accent-primary"
                                                                />
                                                                <span className="truncate">{field.label}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Step 3: Format & Summary */}
                            <div className="pt-4 space-y-3">
                                <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm text-primary">tune</span>
                                    3. Export File Format
                                </label>

                                <div className="grid grid-cols-2 gap-3">
                                    <label
                                        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer select-none transition-all ${
                                            exportFormat === 'csv'
                                                ? 'border-primary bg-primary/5 shadow-xs'
                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="export_format"
                                            checked={exportFormat === 'csv'}
                                            onChange={() => setExportFormat('csv')}
                                            className="size-4 text-primary focus:ring-primary accent-primary"
                                        />
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">CSV Spreadsheet (.csv)</p>
                                            <p className="text-[10px] text-slate-400">Excel, Google Sheets & CRM friendly</p>
                                        </div>
                                    </label>

                                    <label
                                        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer select-none transition-all ${
                                            exportFormat === 'json'
                                                ? 'border-primary bg-primary/5 shadow-xs'
                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="export_format"
                                            checked={exportFormat === 'json'}
                                            onChange={() => setExportFormat('json')}
                                            className="size-4 text-primary focus:ring-primary accent-primary"
                                        />
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">JSON Data File (.json)</p>
                                            <p className="text-[10px] text-slate-400">Standard structured format for backup</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between flex-wrap gap-3">
                            <div className="text-xs text-slate-500">
                                <span className="font-bold text-slate-800">{exportDataset.length}</span> customers • <span className="font-bold text-slate-800">{selectedFields.size}</span> columns selected
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsExportModalOpen(false)}
                                    className="px-4 h-10 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExecuteExport}
                                    disabled={isExporting || exportDataset.length === 0 || selectedFields.size === 0}
                                    className="px-5 h-10 rounded-xl bg-primary hover:bg-primary-light text-white font-bold text-xs transition shadow-sm flex items-center gap-2 disabled:opacity-60"
                                >
                                    {isExporting ? (
                                        <>
                                            <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Generating File…
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-base">download</span>
                                            Download Export ({exportFormat.toUpperCase()})
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Customers;
