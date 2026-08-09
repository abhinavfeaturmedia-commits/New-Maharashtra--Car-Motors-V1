import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import HighlightText from '../../components/ui/HighlightText';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Lead {
    id: string;
    type: string;
    full_name: string;
    phone: string;
    email: string | null;
    secondary_phone: string | null;
    whatsapp_number: string | null;
    personal_address: string | null;
    office_address: string | null;
    car_make: string | null;
    car_model: string | null;
    car_year: number | null;
    car_mileage: number | null;
    message: string | null;
    source: string;
    status: string;
    created_at: string;
    lead_date: string | null;
    assigned_to: string | null;
    created_by: string | null;
    lead_quality?: string | null;
    budget?: string | null;
    notes?: string | null;
    internal_notes?: string | null;
}

interface StaffProfile {
    id: string;
    full_name: string | null;
    role: string;
}

interface DuplicateLead {
    id: string;
    full_name: string;
    status: string;
    type: string;
    created_at: string;
    assignedName: string; // resolved display name of the assigned staff
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-amber-100 text-amber-700',
    negotiation: 'bg-purple-100 text-purple-700',
    closed_won: 'bg-green-100 text-green-700',
    closed_lost: 'bg-slate-100 text-slate-500',
};

const filterTabs = ['All Leads', 'contact', 'sell_car', 'test_drive', 'insurance', 'finance', 'car_service'];
const statusTabs = ['All Statuses', 'new', 'contacted', 'negotiation', 'closed_won', 'closed_lost'];
const qualityTabs = ['All Types', 'hot', 'warm', 'cold', 'cakewalk'];

const formatQualityEmoji = (val: string | null | undefined) => {
    switch(val) {
        case 'hot': return '🔥 Hot';
        case 'warm': return '☀️ Warm';
        case 'cold': return '❄️ Cold';
        case 'cakewalk': return '🍰 Cakewalk';
        default: return '—';
    }
};

// ─── Component ─────────────────────────────────────────────────────────────────

const AdminLeads = () => {
    const { user, isAdmin } = useAuth();
    const { inventory } = useData();
    const availableInventory = inventory.filter((c: any) => c.status === 'available');

    const [leads, setLeads] = useState<Lead[]>([]);
    const [interestCounts, setInterestCounts] = useState<Record<string, number>>({});
    const [staffMembers, setStaffMembers] = useState<StaffProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('All Leads');
    const [activeStatusFilter, setActiveStatusFilter] = useState('All Statuses');
    const [activeQualityFilter, setActiveQualityFilter] = useState('All Types');
    const [activeStaffFilter, setActiveStaffFilter] = useState('All Staff');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    // leadCarMap: leadId → [{make, model, registration_no, dealer_code, dealer_name, notes}] built from lead_car_interests + inventory + dealers
    const [leadCarMap, setLeadCarMap] = useState<Record<string, Array<{ make: string; model: string; registration_no: string; dealer_code?: string; dealer_name?: string; notes?: string }>>>({});
    const [leadFollowUpMap, setLeadFollowUpMap] = useState<Record<string, Array<{ notes: string; type: string }>>>({});
    const [rpcMatchIds, setRpcMatchIds] = useState<Set<string> | null>(null);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const leadsPerPage = 15;

    // Bulk Actions state
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

    // ─── Delete Confirmation Modal ─────────────────────────────────────────────
    const [deleteModal, setDeleteModal] = useState<{
        open: boolean;
        leadId: string | null;   // null = bulk delete
        count: number;
    }>({ open: false, leadId: null, count: 1 });

    // ─── Lost-Reason Prompt Modal ──────────────────────────────────────────────
    const [lostModal, setLostModal] = useState<{
        open: boolean;
        leadId: string;
        reason: string;
    }>({ open: false, leadId: '', reason: '' });

    // ─── Duplicate Phone Detection ─────────────────────────────────────────────
    const [phoneCheckState, setPhoneCheckState] = useState<'idle' | 'checking' | 'duplicate' | 'clear'>('idle');
    const [duplicateLeads, setDuplicateLeads] = useState<DuplicateLead[]>([]);
    const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
    const phoneCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const navigate = useNavigate();
    const [isAddingManual, setIsAddingManual] = useState(false);
    const [manualForm, setManualForm] = useState<Partial<Lead>>({
        full_name: '',
        phone: '',
        secondary_phone: '',
        whatsapp_number: '',
        personal_address: '',
        office_address: '',
        type: 'contact',
        status: 'new',
        source: 'Walk-in',
        email: '',
        message: '',
        assigned_to: null,
        lead_quality: null,
        budget: null,
    });

    // ─── Pending Car Interests (manual lead form) ────────────────────────────
    const [pendingCarInterests, setPendingCarInterests] = useState<Array<{
        inventory_id: string;
        interest_level: string;
        notes: string;
        carLabel: string;
        // Wishlist fields (when car is not in inventory)
        is_wishlist?: boolean;
        custom_make?: string;
        custom_model?: string;
        custom_year?: string;
        custom_variant?: string;
        custom_color?: string;
    }>>([]);
    const [showCarSelector, setShowCarSelector] = useState(false);
    const [carSelectorMode, setCarSelectorMode] = useState<'stock' | 'wishlist'>('stock');
    const [carSelectorForm, setCarSelectorForm] = useState({ inventory_id: '', interest_level: 'warm', notes: '' });
    const [wishlistForm, setWishlistForm] = useState({ make: '', model: '', year: '', variant: '', color: '', interest_level: 'warm', notes: '' });
    const [carSearch, setCarSearch] = useState('');
    const [carSearchOpen, setCarSearchOpen] = useState(false);

    // Import logic
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);

    // ─── Helpers ───────────────────────────────────────────────────────────────

    /** Look up a staff member's display name from their UUID */
    const getAssignedName = (assignedId: string | null): string => {
        if (!assignedId) return '—';
        const found = staffMembers.find(s => s.id === assignedId);
        return found?.full_name || 'Unknown';
    };

    /** Get avatar initials for assigned staff */
    const getInitials = (name: string | null): string => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    // ─── Data fetching ─────────────────────────────────────────────────────────

    /**
     * Fetch all staff + admin profiles for the "Assign To" dropdown
     * and for resolving assigned_to names in the table.
     * Staff can read profiles because of the "Staff can view profiles" RLS policy.
     */
    const fetchStaff = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .in('role', ['admin', 'staff'])
            .eq('is_active', true)
            .order('full_name');
        if (!error && data) setStaffMembers(data as StaffProfile[]);
    };

    /**
     * Fetch leads from Supabase.
     * - Admin: Supabase RLS returns ALL leads.
     * - Staff: Supabase RLS automatically filters to only leads where
     *   created_by = auth.uid() OR assigned_to = auth.uid().
     * No frontend filtering needed — the database handles it.
     */
    const fetchLeads = async () => {
        setLoading(true);
        try {
            let allLeads: Lead[] = [];
            let from = 0;
            const batchSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('leads')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .range(from, from + batchSize - 1);

                if (error) throw error;
                if (data && data.length > 0) {
                    allLeads = [...allLeads, ...(data as unknown as Lead[])];
                    from += batchSize;
                    if (data.length < batchSize) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }
            setLeads(allLeads);
        } catch (error) {
            console.error('Error fetching leads:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchInterestCounts = useCallback(async () => {
        // Fetch car details from inventory and dealer info
        const { data } = await supabase
            .from('lead_car_interests')
            .select('lead_id, notes, custom_make, custom_model, car:inventory(make, model, registration_no, dealer:dealers(name, dealer_code))');
        if (data) {
            const counts: Record<string, number> = {};
            const carMap: Record<string, Array<{ make: string; model: string; registration_no: string; dealer_code?: string; dealer_name?: string; notes?: string }>> = {};
            data.forEach((r: any) => {
                if (!r.lead_id) return;
                counts[r.lead_id] = (counts[r.lead_id] || 0) + 1;
                
                if (!carMap[r.lead_id]) carMap[r.lead_id] = [];
                
                if (r.car) {
                    // Inventory car
                    const dealer = r.car.dealer || {};
                    carMap[r.lead_id].push({
                        make:            (r.car.make            || '').toLowerCase(),
                        model:           (r.car.model           || '').toLowerCase(),
                        registration_no: (r.car.registration_no || '').toLowerCase(),
                        dealer_code:     (dealer.dealer_code    || '').toLowerCase(),
                        dealer_name:     (dealer.name           || '').toLowerCase(),
                        notes:           (r.notes               || '').toLowerCase()
                    });
                } else if (r.custom_make || r.custom_model) {
                    // Wishlist car (not in inventory)
                    carMap[r.lead_id].push({
                        make:            (r.custom_make  || '').toLowerCase(),
                        model:           (r.custom_model || '').toLowerCase(),
                        registration_no: '',
                        notes:           (r.notes        || '').toLowerCase()
                    });
                }
            });
            setInterestCounts(counts);
            setLeadCarMap(carMap);
        }
    }, []);

    const fetchFollowUps = useCallback(async () => {
        const { data } = await supabase.from('follow_ups').select('lead_id, notes, type');
        if (data) {
            const fuMap: Record<string, Array<{ notes: string; type: string }>> = {};
            data.forEach((r: any) => {
                if (!r.lead_id) return;
                if (!fuMap[r.lead_id]) fuMap[r.lead_id] = [];
                fuMap[r.lead_id].push({
                    notes: (r.notes || '').toLowerCase(),
                    type: (r.type || '').toLowerCase()
                });
            });
            setLeadFollowUpMap(fuMap);
        }
    }, []);

    useEffect(() => {
        fetchStaff();
        fetchLeads();
        fetchInterestCounts();
        fetchFollowUps();
    }, []);

    // ─── Debounced RPC Search ──────────────────────────────────────────────────
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        const query = searchQuery.trim();
        if (query.length < 2) {
            setRpcMatchIds(null); // disable RPC filter layer
            return;
        }

        searchTimeout.current = setTimeout(async () => {
            // Optional: call the backend RPC if the user deployed the migration
            // This falls back silently if the RPC does not exist
            const { data, error } = await supabase.rpc('search_leads_by_text', { search_term: query });
            if (!error && data) {
                setRpcMatchIds(new Set(data.map((id: string) => id)));
            }
        }, 500);

        return () => {
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
        };
    }, [searchQuery]);

    // ─── CSV Import ────────────────────────────────────────────────────────────

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                if (!text) return;

                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                if (lines.length < 2) throw new Error('Empty CSV');

                const newLeads = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    let cols = [];
                    if (line.startsWith('"') && line.endsWith('"')) {
                        cols = line.substring(1, line.length - 1).split('","');
                    } else {
                        cols = line.split(',');
                    }

                    if (cols.length >= 6) {
                        newLeads.push({
                            full_name: cols[1],
                            phone: cols[2],
                            type: cols[3] || 'contact',
                            status: Object.keys(statusColors).includes(cols[4]) ? cols[4] : 'new',
                            source: cols[5],
                            created_by: user?.id ?? null,
                        });
                    }
                }

                if (newLeads.length > 0) {
                    const { error } = await supabase.from('leads').insert(newLeads);
                    if (error) throw error;
                    alert(`Successfully imported ${newLeads.length} leads.`);
                    fetchLeads();
                } else {
                    alert('No valid formatted data found.');
                }
            } catch (error) {
                console.error('Import error:', error);
                alert('Failed to import leads. Check format.');
            } finally {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    // ─── Manual Lead ───────────────────────────────────────────────────────────

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            ...manualForm,
            created_by: user?.id ?? null,
            assigned_to: manualForm.assigned_to ?? (isAdmin ? null : (user?.id ?? null)),
        };

        const { data: newLead, error } = await supabase.from('leads').insert(payload).select('id').single();
        if (!error && newLead) {
            // Insert pending car interests
            if (pendingCarInterests.length > 0) {
                await supabase.from('lead_car_interests').insert(
                    pendingCarInterests.map(i => i.is_wishlist
                        ? {
                            lead_id: newLead.id,
                            inventory_id: null,
                            is_wishlist: true,
                            custom_make: i.custom_make,
                            custom_model: i.custom_model,
                            custom_year: i.custom_year ? Number(i.custom_year) : null,
                            custom_variant: i.custom_variant || null,
                            custom_color: i.custom_color || null,
                            interest_level: i.interest_level,
                            notes: i.notes || null,
                            added_by: user?.id ?? null,
                        }
                        : {
                            lead_id: newLead.id,
                            inventory_id: i.inventory_id,
                            is_wishlist: false,
                            interest_level: i.interest_level,
                            notes: i.notes || null,
                            added_by: user?.id ?? null,
                        }
                    )
                );
            }
            setIsAddingManual(false);
            setPendingCarInterests([]);
            setManualForm({ full_name: '', phone: '', secondary_phone: '', whatsapp_number: '', personal_address: '', office_address: '', type: 'contact', status: 'new', source: 'Walk-in', email: '', message: '', assigned_to: null, lead_quality: null, budget: null });
            fetchLeads();
            fetchInterestCounts();
        } else {
            alert('Error adding lead. Try again.');
        }
    };

    // Open manual form with sensible defaults per role
    const openManualForm = () => {
        setManualForm({
            full_name: '', phone: '', secondary_phone: '', whatsapp_number: '',
            personal_address: '', office_address: '',
            type: 'contact', status: 'new',
            source: 'Walk-in', email: '', message: '',
            lead_quality: null,
            budget: null,
            // Staff automatically assigned to themselves
            assigned_to: isAdmin ? null : (user?.id ?? null),
        });
        // Reset duplicate state each time the form opens
        setPhoneCheckState('idle');
        setDuplicateLeads([]);
        setDuplicateAcknowledged(false);
        // Reset pending car interests and search state
        setPendingCarInterests([]);
        setShowCarSelector(false);
        setCarSelectorMode('stock');
        setCarSelectorForm({ inventory_id: '', interest_level: 'warm', notes: '' });
        setWishlistForm({ make: '', model: '', year: '', variant: '', color: '', interest_level: 'warm', notes: '' });
        setCarSearch('');
        setCarSearchOpen(false);
        setIsAddingManual(true);
    };

    /**
     * Normalize phone: strip spaces, dashes, parentheses, leading +91 / 0
     * so "98123 45678" and "9812345678" are treated as the same number.
     */
    const normalizePhone = (raw: string): string => {
        let n = raw.replace(/[\s\-().+]/g, '');
        if (n.startsWith('91') && n.length === 12) n = n.slice(2); // strip country code
        if (n.startsWith('0') && n.length === 11) n = n.slice(1);  // strip leading 0
        return n;
    };

    /**
     * Debounced duplicate check — fires 600 ms after the user stops typing.
     * Queries Supabase leads for any row whose phone (normalized) matches,
     * then resolves the assigned staff name from the in-memory staffMembers list.
     */
    const checkPhoneDuplicate = useCallback(async (rawPhone: string) => {
        const normalized = normalizePhone(rawPhone);
        if (normalized.length < 7) {
            setPhoneCheckState('idle');
            setDuplicateLeads([]);
            return;
        }

        setPhoneCheckState('checking');

        // We use ilike with a wildcard to catch numbers stored with/without spaces
        const { data, error } = await supabase
            .from('leads')
            .select('id, full_name, status, type, created_at, assigned_to')
            .or(`phone.ilike.%${normalized}%,phone.ilike.%${rawPhone.trim()}%`)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error || !data || data.length === 0) {
            setPhoneCheckState('clear');
            setDuplicateLeads([]);
            return;
        }

        // Resolve assigned staff name from local staffMembers cache
        const resolved: DuplicateLead[] = data.map((l: any) => ({
            id: l.id,
            full_name: l.full_name,
            status: l.status,
            type: l.type,
            created_at: l.created_at,
            assignedName: staffMembers.find(s => s.id === l.assigned_to)?.full_name || 'Unassigned',
        }));

        setDuplicateLeads(resolved);
        setPhoneCheckState('duplicate');
        setDuplicateAcknowledged(false);
    }, [staffMembers]);

    // Watch phone field in manualForm and debounce the check
    useEffect(() => {
        if (!isAddingManual) return;
        const phone = manualForm.phone || '';

        if (phoneCheckTimer.current) clearTimeout(phoneCheckTimer.current);

        if (phone.length < 7) {
            setPhoneCheckState('idle');
            setDuplicateLeads([]);
            return;
        }

        setPhoneCheckState('checking');
        phoneCheckTimer.current = setTimeout(() => {
            checkPhoneDuplicate(phone);
        }, 600);

        return () => {
            if (phoneCheckTimer.current) clearTimeout(phoneCheckTimer.current);
        };
    }, [manualForm.phone, isAddingManual]);

    // ─── Lead Actions ──────────────────────────────────────────────────────────

    const updateLeadStatus = async (id: string, newStatus: string) => {
        const lead = leads.find(l => l.id === id);
        
        // Authorization check
        if (!isAdmin && lead?.assigned_to !== user?.id) {
            const assignedStaff = staffMembers.find(s => s.id === lead?.assigned_to)?.full_name || 'an Admin';
            alert(`This lead is assigned to ${assignedStaff}. Please contact them to update the status.`);
            return;
        }

        const updates: any = { status: newStatus };

        if (newStatus !== 'new' && lead?.status === 'new') {
            updates.contacted_at = new Date().toISOString();
        }

        if (newStatus === 'closed_lost') {
            // Open lost-reason modal instead of window.prompt
            setLostModal({ open: true, leadId: id, reason: '' });
            return; // actual update happens when modal is submitted
        }

        const { error } = await supabase.from('leads').update(updates).eq('id', id);
        if (!error) {
            setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...updates } : l)));
        }
    };

    const confirmLostReason = async () => {
        const updates: any = { status: 'closed_lost' };
        const lead = leads.find(l => l.id === lostModal.leadId);
        if (lead?.status === 'new') updates.contacted_at = new Date().toISOString();
        if (lostModal.reason.trim()) updates.lost_reason = lostModal.reason.trim();
        const { error } = await supabase.from('leads').update(updates).eq('id', lostModal.leadId);
        if (!error) {
            setLeads(prev => prev.map(l => l.id === lostModal.leadId ? { ...l, ...updates } : l));
        }
        setLostModal({ open: false, leadId: '', reason: '' });
    };

    const updateLeadAssignment = async (id: string, assignedTo: string | null) => {
        const { error } = await supabase
            .from('leads')
            .update({ assigned_to: assignedTo })
            .eq('id', id);
        if (!error) {
            setLeads(prev => prev.map(l => (l.id === id ? { ...l, assigned_to: assignedTo } : l)));
        }
    };

    const requestDeleteLead = (id: string) => {
        setDeleteModal({ open: true, leadId: id, count: 1 });
    };

    const requestDeleteSelected = () => {
        setDeleteModal({ open: true, leadId: null, count: selectedLeads.length });
    };

    const confirmDelete = async () => {
        if (deleteModal.leadId) {
            // Single lead delete
            const { error } = await supabase.from('leads').delete().eq('id', deleteModal.leadId);
            if (!error) {
                setLeads(prev => prev.filter(l => l.id !== deleteModal.leadId));
                setSelectedLeads(prev => prev.filter(id => id !== deleteModal.leadId));
            }
        } else {
            // Bulk delete
            const { error } = await supabase.from('leads').delete().in('id', selectedLeads);
            if (!error) {
                setLeads(prev => prev.filter(l => !selectedLeads.includes(l.id)));
                setSelectedLeads([]);
            }
        }
        setDeleteModal({ open: false, leadId: null, count: 1 });
    };

    // ─── CSV Export ────────────────────────────────────────────────────────────

    const exportToCSV = () => {
        const headers = ['Date', 'Name', 'Phone', 'Type', 'Status', 'Source', 'Assigned To'];
        const csvContent = [
            headers.join(','),
            ...filteredAndSearchedLeads.map(l => {
                const displayDate = l.lead_date
                    ? new Date(l.lead_date + 'T00:00:00').toLocaleDateString()
                    : new Date(l.created_at).toLocaleDateString();
                return `"${displayDate}","${l.full_name}","${l.phone}","${l.type}","${l.status}","${l.source}","${getAssignedName(l.assigned_to)}"`;
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'leads_export.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ─── Formatting ────────────────────────────────────────────────────────────

    const formatLabel = (val: string) => {
        const map: Record<string, string> = {
            contact: 'General Contact',
            sell_car: 'Sell Car',
            test_drive: 'Test Drive',
            insurance: 'Insurance',
            finance: 'Finance',
            car_service: 'Car Services',
            new: 'New',
            contacted: 'Contacted',
            negotiation: 'Negotiating',
            closed_won: 'Closed (Won)',
            closed_lost: 'Closed (Lost)'
        };
        return map[val] || val;
    };

    // ─── Filtering & Pagination ─────────────────────────────────────────────────

    const filteredAndSearchedLeads = leads.filter(l => {
        const matchesTab = activeFilter === 'All Leads' || l.type === activeFilter;
        const matchesStatus = activeStatusFilter === 'All Statuses' || l.status === activeStatusFilter;
        const matchesStaff = activeStaffFilter === 'All Staff' || 
                             (activeStaffFilter === 'Unassigned' && !l.assigned_to) ||
                             (l.assigned_to === activeStaffFilter);
        const matchesQuality = activeQualityFilter === 'All Types' || l.lead_quality === activeQualityFilter;
                             
        if (!(matchesTab && matchesStatus && matchesStaff && matchesQuality)) return false;

        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;

        // RPC Filter Layer
        const rpcMatch = rpcMatchIds ? rpcMatchIds.has(l.id) : false;

        // 1. Standard personal fields & metadata
        const localMatch = (
            (l.full_name || '').toLowerCase().includes(q) ||
            (l.phone || '').includes(q) ||
            (l.secondary_phone || '').includes(q) ||
            (l.whatsapp_number || '').includes(q) ||
            (l.email || '').toLowerCase().includes(q) ||
            (l.personal_address || '').toLowerCase().includes(q) ||
            (l.office_address || '').toLowerCase().includes(q) ||
            (l.type || '').toLowerCase().includes(q) ||
            (l.source || '').toLowerCase().includes(q) ||
            (l.status || '').toLowerCase().includes(q) ||
            (l.notes || '').toLowerCase().includes(q) ||
            (l.internal_notes || '').toLowerCase().includes(q) ||
            (l.message || '').toLowerCase().includes(q) ||
            (l.budget || '').toLowerCase().includes(q) ||
            (l.lead_quality || '').toLowerCase().includes(q) ||
            
            // 2. sell_car lead — car the customer wants to sell
            (l.car_make  || '').toLowerCase().includes(q) ||
            (l.car_model || '').toLowerCase().includes(q) ||
            `${(l.car_make || '')} ${(l.car_model || '')}`.toLowerCase().includes(q) ||
            (l.car_year?.toString() || '').includes(q) ||
            (l.car_mileage?.toString() || '').includes(q) ||

            // 3. Staff name (Dealer Name in some contexts)
            (getAssignedName(l.assigned_to) || '').toLowerCase().includes(q) ||

            // 4. Inventory car interests (test_drive / contact / insurance leads)
            (leadCarMap[l.id] || []).some(car =>
                car.make.includes(q) ||
                car.model.includes(q) ||
                car.registration_no.includes(q) ||
                `${car.make} ${car.model}`.includes(q) ||
                (car.dealer_code || '').includes(q) ||
                (car.dealer_name || '').includes(q) ||
                (car.notes || '').includes(q)
            ) ||

            // 5. Follow-ups logs
            (leadFollowUpMap[l.id] || []).some(fu =>
                fu.notes.includes(q) ||
                fu.type.includes(q)
            )
        );

        return localMatch || rpcMatch;
    });

    const totalPages = Math.ceil(filteredAndSearchedLeads.length / leadsPerPage);
    const paginatedLeads = filteredAndSearchedLeads.slice(
        (currentPage - 1) * leadsPerPage,
        currentPage * leadsPerPage
    );

    const tabCount = (tab: string) => tab === 'All Leads' ? leads.length : leads.filter(l => l.type === tab).length;
    const statusCount = (status: string) => {
        const baseLeads = activeFilter === 'All Leads' ? leads : leads.filter(l => l.type === activeFilter);
        return status === 'All Statuses' ? baseLeads.length : baseLeads.filter(l => l.status === status).length;
    };

    const toggleSelectAll = () => {
        if (selectedLeads.length === paginatedLeads.length) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(paginatedLeads.map(l => l.id));
        }
    };

    const toggleSelectLead = (id: string) => {
        setSelectedLeads(prev =>
            prev.includes(id) ? prev.filter(leadId => leadId !== id) : [...prev, id]
        );
    };

    // ─── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">

            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Lead Management</h1>
                    <p className="text-slate-500 text-sm">
                        All customer enquiries across your team.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Search name, phone, car brand or model…"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20 w-full md:w-64 transition-all"
                        />
                    </div>

                    {/* Import — admin only */}
                    {isAdmin && (
                        <>
                            <input
                                type="file"
                                accept=".csv"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={importing}
                                className="h-10 px-4 flex items-center justify-center border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors font-medium text-sm gap-2 disabled:opacity-50"
                                title="Import from CSV"
                            >
                                <span className="material-symbols-outlined text-lg">{importing ? 'hourglass_empty' : 'upload'}</span>
                                {importing ? 'Importing...' : 'Import'}
                            </button>
                        </>
                    )}

                    <button onClick={exportToCSV} className="h-10 px-4 flex items-center justify-center border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors font-medium text-sm gap-2" title="Export to CSV">
                        <span className="material-symbols-outlined text-lg">download</span> Export
                    </button>

                    <button onClick={fetchLeads} className="h-10 w-10 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors" title="Refresh">
                        <span className="material-symbols-outlined text-lg">refresh</span>
                    </button>

                    <button onClick={openManualForm} className="h-10 px-5 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary-light transition-colors">
                        <span className="material-symbols-outlined text-lg">person_add</span> Manual Lead
                    </button>
                </div>
            </div>

            {/* Staff Workload Dashboard */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
                <span className="material-symbols-outlined text-slate-400 text-sm">group</span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">Workload:</span>
                {staffMembers.map(s => {
                    const count = leads.filter(l => l.assigned_to === s.id).length;
                    return (
                        <div key={s.id} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm cursor-pointer hover:border-primary transition-colors" onClick={() => { setActiveStaffFilter(s.id); setCurrentPage(1); setSelectedLeads([]); }} title={`Filter by ${s.full_name}`}>
                            <span className="text-xs font-bold text-primary">{s.full_name || 'Unknown'}</span>
                            <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{count}</span>
                        </div>
                    );
                })}
                <div className="flex items-center gap-1.5 bg-white border border-red-100 rounded-lg px-2 py-1 shadow-sm cursor-pointer hover:border-red-300 transition-colors" onClick={() => { setActiveStaffFilter('Unassigned'); setCurrentPage(1); setSelectedLeads([]); }} title="Filter by Unassigned">
                    <span className="text-xs font-bold text-red-600">Unassigned</span>
                    <span className="text-[10px] font-black bg-red-50 text-red-600 px-1.5 py-0.5 rounded">{leads.filter(l => !l.assigned_to).length}</span>
                </div>
            </div>

            {/* Tabs & Bulk Actions */}
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex gap-1 overflow-x-auto pb-px w-full sm:w-auto">
                        {filterTabs.map(tab => (
                            <button key={tab} onClick={() => { setActiveFilter(tab); setCurrentPage(1); setSelectedLeads([]); }} className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${activeFilter === tab ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>
                                {formatLabel(tab)} <span className="text-xs text-slate-400 ml-1">({tabCount(tab)})</span>
                            </button>
                        ))}
                    </div>
                    {selectedLeads.length > 0 && isAdmin && (
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-primary">{selectedLeads.length} Selected</span>
                            <button onClick={requestDeleteSelected} className="h-8 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors">
                                <span className="material-symbols-outlined text-sm">delete</span> Delete
                            </button>
                        </div>
                    )}
                </div>

                {/* Status sub-tabs & Staff Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                    <div className="flex gap-2 overflow-x-auto pb-2 w-full sm:w-auto">
                        {statusTabs.map(status => (
                            <button
                                key={status}
                                onClick={() => { setActiveStatusFilter(status); setCurrentPage(1); setSelectedLeads([]); }}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all border ${activeStatusFilter === status ? 'bg-primary text-white border-primary' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                            >
                                {status === 'All Statuses' ? 'All Statuses' : formatLabel(status)} <span className="opacity-70 ml-1">({statusCount(status)})</span>
                            </button>
                        ))}
                    </div>
                    
                    {/* Staff Filter Dropdown */}
                    <div className="shrink-0 mb-2 sm:mb-0">
                        <select
                            value={activeStaffFilter}
                            onChange={(e) => { setActiveStaffFilter(e.target.value); setCurrentPage(1); setSelectedLeads([]); }}
                            className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                            <option value="All Staff">All Staff</option>
                            <option value="Unassigned">Unassigned</option>
                            {staffMembers.map(s => (
                                <option key={s.id} value={s.id}>{s.full_name || 'Unknown Staff'}</option>
                            ))}
                        </select>
                    </div>

                    {/* Quality Filter Dropdown */}
                    <div className="shrink-0 mb-2 sm:mb-0">
                        <select
                            value={activeQualityFilter}
                            onChange={(e) => { setActiveQualityFilter(e.target.value); setCurrentPage(1); setSelectedLeads([]); }}
                            className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                            {qualityTabs.map(q => (
                                <option key={q} value={q}>{q === 'All Types' ? 'All Lead Types' : formatQualityEmoji(q)}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Leads Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-x-auto min-h-[400px]">
                <table className="w-full min-w-[1100px]">
                    <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50/50">
                            {isAdmin && (
                                <th className="px-5 py-3 w-12 text-center border-r border-slate-100">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-primary focus:ring-primary/20 w-4 h-4 cursor-pointer"
                                        checked={paginatedLeads.length > 0 && selectedLeads.length === paginatedLeads.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                            )}
                            <th className="text-left px-5 py-3">Lead Date</th>
                            <th className="text-left px-5 py-3">Customer</th>
                            <th className="text-left px-5 py-3">Type</th>
                            <th className="text-left px-5 py-3">Details</th>
                            <th className="text-left px-5 py-3">Assigned To</th>
                            <th className="text-left px-5 py-3">Status</th>
                            <th className="text-right px-5 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={isAdmin ? 8 : 7} className="text-center py-10 text-slate-500">Loading leads...</td></tr>
                        ) : paginatedLeads.length === 0 ? (
                            <tr>
                                <td colSpan={isAdmin ? 8 : 7} className="text-center py-16">
                                    <div className="flex flex-col items-center gap-2 text-slate-400">
                                        <span className="material-symbols-outlined text-4xl">people</span>
                                        <p className="font-semibold text-slate-500">No leads found</p>
                                        <p className="text-xs">
                                            {!isAdmin ? 'No leads are assigned to you yet. Contact your admin.' : 'Try adjusting your filters.'}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedLeads.map(lead => {
                                const assignedName = getAssignedName(lead.assigned_to);
                                const assignedInitials = getInitials(staffMembers.find(s => s.id === lead.assigned_to)?.full_name ?? null);
                                return (
                                    <tr
                                        key={lead.id}
                                        className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/50 cursor-pointer transition-colors ${selectedLeads.includes(lead.id) ? 'bg-primary/5' : ''}`}
                                        onClick={() => navigate(`/admin/leads/${lead.id}${searchQuery.trim() ? `?search=${encodeURIComponent(searchQuery.trim())}` : ''}`)}
                                    >
                                        {/* Checkbox — admin only */}
                                        {isAdmin && (
                                            <td className="px-5 py-4 w-12 text-center border-r border-slate-50" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-300 text-primary focus:ring-primary/20 w-4 h-4 cursor-pointer"
                                                    checked={selectedLeads.includes(lead.id)}
                                                    onChange={() => toggleSelectLead(lead.id)}
                                                />
                                            </td>
                                        )}

                                        {/* Date — prefers admin-set lead_date, falls back to created_at */}
                                        <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">
                                            {lead.lead_date
                                                ? <>
                                                    {new Date(lead.lead_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}<br />
                                                    <span className="text-xs text-slate-400">—</span>
                                                  </>
                                                : <>
                                                    {new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}<br />
                                                    <span className="text-xs text-slate-400">{new Date(lead.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                  </>
                                            }
                                        </td>

                                        {/* Customer */}
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-full bg-primary-light/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                                                    {lead.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-primary">
                                                        <HighlightText text={lead.full_name} highlight={searchQuery} />
                                                    </p>
                                                    <p className="text-xs font-medium text-slate-500">
                                                        <HighlightText text={lead.phone} highlight={searchQuery} />
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Type */}
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col items-start gap-1">
                                                <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded-md text-slate-600">{formatLabel(lead.type)}</span>
                                                {lead.lead_quality && (
                                                    <span className="text-xs font-bold text-slate-700 whitespace-nowrap">{formatQualityEmoji(lead.lead_quality)}</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Details */}
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col gap-1 max-w-[280px]">
                                                {/* Core Details based on Type */}
                                                <div>
                                                    {lead.type === 'sell_car' && (
                                                        <p className="text-sm text-primary font-semibold">
                                                            Sell: <HighlightText text={lead.car_make} highlight={searchQuery} />{' '}
                                                            <HighlightText text={lead.car_model} highlight={searchQuery} />
                                                            {lead.car_year && <span className="text-xs text-slate-500 ml-1">({lead.car_year})</span>}
                                                        </p>
                                                    )}
                                                    {lead.type === 'contact' && (
                                                        <p className="text-sm text-primary font-medium line-clamp-2">
                                                            {lead.message ? <HighlightText text={lead.message} highlight={searchQuery} /> : '—'}
                                                        </p>
                                                    )}
                                                    {lead.type === 'test_drive' && <p className="text-sm text-primary font-semibold">Test Drive Booking</p>}
                                                    {lead.type === 'insurance' && <p className="text-sm text-primary font-semibold">Insurance Inquiry</p>}
                                                    {lead.type === 'finance' && <p className="text-sm text-primary font-semibold">Finance Inquiry</p>}
                                                    {lead.type === 'car_service' && <p className="text-sm text-primary font-semibold">Car Services Request</p>}
                                                </div>

                                                {/* Inquiry Message/Context for non-contact leads if present */}
                                                {lead.type !== 'contact' && lead.message && (
                                                    <p className="text-xs text-slate-500 line-clamp-2">
                                                        <span className="font-bold text-slate-600">Msg: </span>
                                                        <HighlightText text={lead.message} highlight={searchQuery} />
                                                    </p>
                                                )}

                                                {/* Source */}
                                                <p className="text-[10px] text-slate-400">
                                                    From: <HighlightText text={lead.source} highlight={searchQuery} />
                                                </p>

                                                {/* Extra Matches based on search query */}
                                                {searchQuery.trim() && (
                                                    <div className="text-[11px] space-y-1 mt-1 border-t border-slate-100 pt-1">
                                                        {/* Email Match */}
                                                        {lead.email && lead.email.toLowerCase().includes(searchQuery.toLowerCase()) && (
                                                            <div className="text-slate-500 truncate">
                                                                <span className="font-semibold">Email:</span> <HighlightText text={lead.email} highlight={searchQuery} />
                                                            </div>
                                                        )}

                                                        {/* Budget Match */}
                                                        {lead.budget && lead.budget.toLowerCase().includes(searchQuery.toLowerCase()) && (
                                                            <div className="text-slate-500">
                                                                <span className="font-semibold">Budget:</span> <HighlightText text={lead.budget} highlight={searchQuery} />
                                                            </div>
                                                        )}

                                                        {/* Notes Match */}
                                                        {lead.notes && lead.notes.toLowerCase().includes(searchQuery.toLowerCase()) && (
                                                            <div className="text-slate-600 bg-amber-50/50 border border-amber-100/50 rounded px-1.5 py-0.5 mt-0.5">
                                                                <span className="font-bold text-amber-800">Note:</span> <HighlightText text={lead.notes} highlight={searchQuery} />
                                                            </div>
                                                        )}

                                                        {/* Internal Notes Match */}
                                                        {lead.internal_notes && lead.internal_notes.toLowerCase().includes(searchQuery.toLowerCase()) && (
                                                            <div className="text-slate-600 bg-red-50/50 border border-red-100/50 rounded px-1.5 py-0.5 mt-0.5">
                                                                <span className="font-bold text-red-800">Internal Note:</span> <HighlightText text={lead.internal_notes} highlight={searchQuery} />
                                                            </div>
                                                        )}

                                                        {/* Car Interest Match */}
                                                        {(leadCarMap[lead.id] || [])
                                                            .filter(car => 
                                                                car.make.includes(searchQuery.toLowerCase()) ||
                                                                car.model.includes(searchQuery.toLowerCase()) ||
                                                                car.registration_no.includes(searchQuery.toLowerCase()) ||
                                                                `${car.make} ${car.model}`.includes(searchQuery.toLowerCase()) ||
                                                                (car.notes || '').includes(searchQuery.toLowerCase())
                                                            )
                                                            .map((car, idx) => (
                                                                <div key={idx} className="text-slate-600 bg-blue-50/50 border border-blue-100/50 rounded px-1.5 py-0.5 mt-0.5">
                                                                    <span className="font-bold text-blue-800">Car Interest:</span>{' '}
                                                                    <HighlightText text={`${car.make.toUpperCase()} ${car.model.toUpperCase()}`} highlight={searchQuery} />
                                                                    {car.registration_no && ` (${car.registration_no.toUpperCase()})`}
                                                                    {car.notes && (
                                                                        <div className="text-[10px] text-slate-500 italic mt-0.5">
                                                                            Note: <HighlightText text={car.notes} highlight={searchQuery} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))
                                                        }

                                                        {/* Follow-Ups Match */}
                                                        {(leadFollowUpMap[lead.id] || [])
                                                            .filter(fu => fu.notes.includes(searchQuery.toLowerCase()))
                                                            .map((fu, idx) => (
                                                                <div key={idx} className="text-slate-600 bg-emerald-50/50 border border-emerald-100/50 rounded px-1.5 py-0.5 mt-0.5">
                                                                    <span className="font-bold text-emerald-800">Follow-up:</span>{' '}
                                                                    <HighlightText text={fu.notes} highlight={searchQuery} />
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                )}

                                                {/* Interested Cars Count Badge */}
                                                {(interestCounts[lead.id] ?? 0) > 0 && (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 mt-1 self-start">
                                                        <span className="material-symbols-outlined text-[10px]">directions_car</span>
                                                        {interestCounts[lead.id]} interested
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Assigned To — admin can reassign inline */}
                                        <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                                            {isAdmin ? (
                                                <select
                                                    value={lead.assigned_to ?? ''}
                                                    onChange={(e) => updateLeadAssignment(lead.id, e.target.value || null)}
                                                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none bg-white text-slate-600 hover:border-primary/40 focus:ring-2 focus:ring-primary/10 cursor-pointer max-w-[130px] truncate"
                                                    title={assignedName}
                                                >
                                                    <option value="">Unassigned</option>
                                                    {staffMembers.map(s => (
                                                        <option key={s.id} value={s.id}>{s.full_name}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                /* Staff: read-only assigned name */
                                                <div className="flex items-center gap-2">
                                                    {lead.assigned_to ? (
                                                        <>
                                                            <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                                                                {assignedInitials}
                                                            </div>
                                                            <span className="text-xs font-semibold text-slate-600 truncate max-w-[100px]">{assignedName}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Unassigned</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        {/* Status */}
                                        <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                                            <select
                                                value={lead.status}
                                                onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                                                className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg uppercase border outline-none cursor-pointer ${statusColors[lead.status] || 'bg-slate-100 text-slate-500 border-slate-200'}`}
                                            >
                                                <option value="new">New</option>
                                                <option value="contacted">Contacted</option>
                                                <option value="negotiation">Negotiating</option>
                                                <option value="closed_won">Closed (Won)</option>
                                                <option value="closed_lost">Closed (Lost)</option>
                                            </select>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-2">
                                                <a href={`tel:${lead.phone}`} title="Call" className="size-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition-colors">
                                                    <span className="material-symbols-outlined text-[18px]">call</span>
                                                </a>
                                                <a href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" title="WhatsApp" className="size-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-green-100 hover:text-green-600 transition-colors">
                                                    <span className="material-symbols-outlined text-[18px]">chat</span>
                                                </a>
                                                {/* Delete — only admin OR assigned staff */}
                                                {(isAdmin || lead.assigned_to === user?.id) && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); requestDeleteLead(lead.id); }}
                                                        title="Delete Lead"
                                                        className="size-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    </button>
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

            {/* Pagination */}
            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <p className="text-sm text-slate-500">
                        Showing {(currentPage - 1) * leadsPerPage + 1} to {Math.min(currentPage * leadsPerPage, filteredAndSearchedLeads.length)} of {filteredAndSearchedLeads.length} entries
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            Previous
                        </button>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* ── Manual Lead Modal ── */}
            {isAddingManual && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center py-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsAddingManual(false)} />
                    <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col mx-4 max-h-full">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-lg font-bold text-primary font-display">Add Manual Lead</h2>
                                {!isAdmin && (
                                    <p className="text-xs text-slate-400 mt-0.5">This lead will be assigned to you automatically.</p>
                                )}
                            </div>
                            <button type="button" onClick={() => setIsAddingManual(false)} className="p-1 hover:bg-slate-100 rounded-lg"><span className="material-symbols-outlined text-slate-400">close</span></button>
                        </div>
                        <form onSubmit={handleManualSubmit} className="p-5 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                {/* Full Name */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                                    <input required type="text" value={manualForm.full_name || ''}
                                        onChange={e => setManualForm(prev => ({ ...prev, full_name: e.target.value }))}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                        placeholder="e.g. Ramesh Patil" />
                                </div>

                                {/* Phone — with real-time duplicate detection */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number *</label>
                                    <div className="relative">
                                        <input
                                            required
                                            type="tel"
                                            value={manualForm.phone || ''}
                                            onChange={e => setManualForm(prev => ({ ...prev, phone: e.target.value }))}
                                            className={`w-full h-11 border rounded-xl px-4 pr-10 text-sm outline-none focus:ring-2 transition-colors ${
                                                phoneCheckState === 'duplicate'
                                                    ? 'border-amber-400 bg-amber-50 focus:ring-amber-200'
                                                    : phoneCheckState === 'clear'
                                                    ? 'border-green-400 bg-green-50 focus:ring-green-200'
                                                    : 'border-slate-200 focus:ring-primary/10'
                                            }`}
                                            placeholder="98XXX XXXXX"
                                        />
                                        {/* Status icon inside the input */}
                                        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-base material-symbols-outlined ${
                                            phoneCheckState === 'checking' ? 'animate-spin text-slate-400' :
                                            phoneCheckState === 'duplicate' ? 'text-amber-500' :
                                            phoneCheckState === 'clear' ? 'text-green-500' : 'hidden'
                                        }`}>
                                            {phoneCheckState === 'checking' ? 'autorenew' :
                                             phoneCheckState === 'duplicate' ? 'warning' :
                                             phoneCheckState === 'clear' ? 'check_circle' : ''}
                                        </span>
                                    </div>

                                    {/* ── Duplicate Warning Banner ── */}
                                    {phoneCheckState === 'duplicate' && duplicateLeads.length > 0 && (
                                        <div className={`mt-2 rounded-xl border p-3 flex flex-col gap-2 ${
                                            duplicateAcknowledged
                                                ? 'border-slate-200 bg-slate-50'
                                                : 'border-amber-300 bg-amber-50'
                                        }`}>
                                            <div className="flex items-start gap-2">
                                                <span className={`material-symbols-outlined text-lg shrink-0 mt-0.5 ${
                                                    duplicateAcknowledged ? 'text-slate-400' : 'text-amber-500'
                                                }`}>
                                                    {duplicateAcknowledged ? 'info' : 'warning'}
                                                </span>
                                                <div className="flex-1">
                                                    <p className={`text-xs font-bold ${
                                                        duplicateAcknowledged ? 'text-slate-600' : 'text-amber-800'
                                                    }`}>
                                                        {duplicateAcknowledged
                                                            ? 'Duplicate acknowledged — proceed with caution'
                                                            : `⚠️ This phone number already exists in ${duplicateLeads.length > 1 ? `${duplicateLeads.length} leads` : '1 lead'}`
                                                        }
                                                    </p>
                                                    {/* List each duplicate */}
                                                    <div className="mt-1.5 flex flex-col gap-1.5">
                                                        {duplicateLeads.map(dl => (
                                                            <div key={dl.id} className="flex items-center justify-between bg-white/70 rounded-lg px-2.5 py-1.5 border border-amber-100">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                                                                        {dl.full_name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-slate-800">{dl.full_name}</p>
                                                                        <p className="text-[10px] text-slate-400">
                                                                            {formatLabel(dl.type)} · {new Date(dl.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                                                        statusColors[dl.status] || 'bg-slate-100 text-slate-500'
                                                                    }`}>
                                                                        {formatLabel(dl.status)}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-500 font-medium">
                                                                        Assigned: <span className="text-slate-700 font-semibold">{dl.assignedName}</span>
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => navigate(`/admin/leads/${dl.id}`)}
                                                                        className="text-[10px] text-primary font-bold hover:underline"
                                                                    >
                                                                        View →
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Acknowledge checkbox */}
                                            {!duplicateAcknowledged && (
                                                <label className="flex items-center gap-2 cursor-pointer mt-1 pl-1">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-amber-400 text-amber-500 focus:ring-amber-300 w-4 h-4"
                                                        checked={duplicateAcknowledged}
                                                        onChange={e => setDuplicateAcknowledged(e.target.checked)}
                                                    />
                                                    <span className="text-xs text-amber-700 font-semibold">
                                                        I understand this is a duplicate and want to create a new lead anyway
                                                    </span>
                                                </label>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                                    <input type="email" value={manualForm.email || ''}
                                        onChange={e => setManualForm(prev => ({ ...prev, email: e.target.value }))}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                        placeholder="ramesh@example.com" />
                                </div>

                                {/* Lead Quality */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Lead Quality</label>
                                    <select
                                        value={manualForm.lead_quality || ''}
                                        onChange={e => setManualForm(prev => ({ ...prev, lead_quality: e.target.value || null }))}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white"
                                    >
                                        <option value="" disabled>Select Quality...</option>
                                        <option value="hot">🔥 Hot</option>
                                        <option value="warm">☀️ Warm</option>
                                        <option value="cold">❄️ Cold</option>
                                        <option value="cakewalk">🍰 Cakewalk</option>
                                    </select>
                                </div>

                                {/* Budget */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Budget <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                                    <input type="text" value={manualForm.budget || ''}
                                        onChange={e => setManualForm(prev => ({ ...prev, budget: e.target.value }))}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                        placeholder="e.g. 5-6 Lakhs" />
                                </div>

                                {/* Secondary Phone */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Secondary Phone <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                                    <input type="tel" value={manualForm.secondary_phone || ''}
                                        onChange={e => setManualForm(prev => ({ ...prev, secondary_phone: e.target.value }))}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                        placeholder="Alternate number" />
                                </div>

                                {/* WhatsApp Number */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp Number <span className="text-xs text-slate-400 font-normal">(if different)</span></label>
                                    <input type="tel" value={manualForm.whatsapp_number || ''}
                                        onChange={e => setManualForm(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                                        onFocus={e => { if (!e.target.value && manualForm.phone) setManualForm(prev => ({ ...prev, whatsapp_number: prev.phone || '' })); }}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                        placeholder="WhatsApp number (auto-fills from phone)" />
                                </div>

                                {/* Personal Address */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Personal Address <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                                    <input type="text" value={manualForm.personal_address || ''}
                                        onChange={e => setManualForm(prev => ({ ...prev, personal_address: e.target.value }))}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                        placeholder="Home / Residential address" />
                                </div>

                                {/* Office Address */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Office Address <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                                    <input type="text" value={manualForm.office_address || ''}
                                        onChange={e => setManualForm(prev => ({ ...prev, office_address: e.target.value }))}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                        placeholder="Workplace / Office address" />
                                </div>

                                {/* Enquiry Type */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Enquiry Type</label>
                                    <select value={manualForm.type || 'contact'}
                                        onChange={e => setManualForm(prev => ({ ...prev, type: e.target.value }))}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                        <option value="contact">General Contact</option>
                                        <option value="sell_car">Sell Car</option>
                                        <option value="test_drive">Test Drive</option>
                                        <option value="insurance">Insurance</option>
                                        <option value="finance">Finance</option>
                                        <option value="car_service">Car Services</option>
                                    </select>
                                </div>

                                {/* Lead Source */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Lead Source</label>
                                    <select value={manualForm.source || 'Walk-in'}
                                        onChange={e => setManualForm(prev => ({ ...prev, source: e.target.value }))}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                        <option value="Walk-in">Walk-in</option>
                                        <option value="Website Inquiry">Website Inquiry</option>
                                        <option value="WhatsApp">WhatsApp</option>
                                        <option value="Facebook">Facebook</option>
                                        <option value="Instagram">Instagram</option>
                                        <option value="Referral">Referral</option>
                                        <option value="OLX">OLX</option>
                                        <option value="CarTrade">CarTrade</option>
                                        <option value="Car Waale">Car Waale</option>
                                        <option value="Google Ads">Google Ads</option>
                                        <option value="GBN Club">GBN Club</option>
                                        <option value="Saturday Club">Saturday Club</option>
                                        <option value="BNI Club">BNI Club</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                {/* Status */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                    <select value={manualForm.status || 'new'}
                                        onChange={e => setManualForm(prev => ({ ...prev, status: e.target.value }))}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                        <option value="new">New</option>
                                        <option value="contacted">Contacted</option>
                                        <option value="negotiation">Negotiating</option>
                                        <option value="closed_won">Closed (Won)</option>
                                        <option value="closed_lost">Closed (Lost)</option>
                                    </select>
                                </div>

                                {/* Assign To — admin only */}
                                {isAdmin && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Assign To
                                            <span className="text-xs text-slate-400 font-normal ml-1">(optional)</span>
                                        </label>
                                        <select
                                            value={manualForm.assigned_to ?? ''}
                                            onChange={e => setManualForm(prev => ({ ...prev, assigned_to: e.target.value || null }))}
                                            className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white"
                                        >
                                            <option value="">Unassigned</option>
                                            {staffMembers.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.full_name} {s.role === 'admin' ? '(Admin)' : '(Staff)'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* ── Car Interests ── */}
                            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-blue-500 text-base">directions_car</span>
                                        <span className="text-sm font-semibold text-slate-700">Interested Cars</span>
                                        <span className="text-xs text-slate-400 font-normal">(optional)</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowCarSelector(v => !v)}
                                        className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 transition"
                                    >
                                        <span className="material-symbols-outlined text-sm">{showCarSelector ? 'close' : 'add'}</span>
                                        {showCarSelector ? 'Cancel' : 'Add Car'}
                                    </button>
                                </div>

                                {showCarSelector && (() => {
                                    // ── Tab toggle ──────────────────────────────────────
                                    const tabBtn = (mode: 'stock' | 'wishlist', label: string, icon: string) => (
                                        <button type="button" onClick={() => { setCarSelectorMode(mode); setCarSearch(''); setCarSelectorForm(f => ({ ...f, inventory_id: '' })); }}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all ${carSelectorMode === mode ? mode === 'stock' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                            <span className="material-symbols-outlined text-[14px]">{icon}</span>{label}
                                        </button>
                                    );

                                    // ── In-Stock filtered list ───────────────────────────
                                    const normalizedSearch = carSearch.toLowerCase().replace(/\s/g, '');
                                    const filteredCars = availableInventory.filter((car: any) => {
                                        if (!normalizedSearch) return true;
                                        const nameMatch = `${car.year} ${car.make} ${car.model}`.toLowerCase().includes(carSearch.toLowerCase());
                                        const regMatch = (car.registration_no || '').toLowerCase().replace(/\s/g, '').includes(normalizedSearch);
                                        return nameMatch || regMatch;
                                    });
                                    const selectedCar = availableInventory.find((c: any) => c.id === carSelectorForm.inventory_id);

                                    return (
                                        <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3 space-y-2">

                                            {/* ── Mode tabs ── */}
                                            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-lg">
                                                {tabBtn('stock', 'In Stock', 'inventory')}
                                                {tabBtn('wishlist', 'Not In Stock', 'search')}
                                            </div>

                                            {carSelectorMode === 'stock' ? (
                                                <>
                                                    {/* ── Searchable picker ── */}
                                                    <div className="relative">
                                                        <div className="relative">
                                                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">search</span>
                                                            <input type="text" value={carSearch}
                                                                onChange={e => { setCarSearch(e.target.value); setCarSearchOpen(true); if (carSelectorForm.inventory_id) setCarSelectorForm(f => ({ ...f, inventory_id: '' })); }}
                                                                onFocus={() => setCarSearchOpen(true)}
                                                                onBlur={() => setTimeout(() => setCarSearchOpen(false), 150)}
                                                                placeholder="Search by car name or registration no..."
                                                                className="w-full h-9 border border-slate-200 rounded-lg pl-8 pr-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-200" />
                                                            {carSearch && (
                                                                <button type="button" onClick={() => { setCarSearch(''); setCarSelectorForm(f => ({ ...f, inventory_id: '' })); setCarSearchOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                                    <span className="material-symbols-outlined text-[15px]">close</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                        {selectedCar && (
                                                            <div className="mt-1.5 flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                                                                <span className="material-symbols-outlined text-blue-500 text-[14px]">directions_car</span>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs font-bold text-blue-700 truncate">{selectedCar.year} {selectedCar.make} {selectedCar.model}</p>
                                                                    <p className="text-[10px] text-blue-500 font-mono">{selectedCar.registration_no || 'No Reg'} · ₹{Number(selectedCar.price).toLocaleString('en-IN')}</p>
                                                                </div>
                                                                <span className="text-[10px] font-bold text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded">Selected</span>
                                                            </div>
                                                        )}
                                                        {carSearchOpen && (
                                                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                                                                {filteredCars.length === 0 ? (
                                                                    <div className="flex flex-col items-center py-6 text-slate-400">
                                                                        <span className="material-symbols-outlined text-2xl mb-1">search_off</span>
                                                                        <p className="text-xs font-medium">No cars match your search</p>
                                                                        <p className="text-[10px] mt-0.5">Try car name or registration number</p>
                                                                    </div>
                                                                ) : filteredCars.map((car: any) => {
                                                                    const isSelected = car.id === carSelectorForm.inventory_id;
                                                                    const isAlreadyAdded = pendingCarInterests.some(p => p.inventory_id === car.id);
                                                                    return (
                                                                        <button key={car.id} type="button" disabled={isAlreadyAdded}
                                                                            onClick={() => { setCarSelectorForm(f => ({ ...f, inventory_id: car.id })); setCarSearch(`${car.year} ${car.make} ${car.model}`); setCarSearchOpen(false); }}
                                                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-slate-50 last:border-0 ${isAlreadyAdded ? 'opacity-40 cursor-not-allowed bg-slate-50' : isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                                                                            <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                                                <span className="material-symbols-outlined text-slate-500 text-[15px]">directions_car</span>
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-xs font-bold text-slate-700 truncate">{car.year} {car.make} {car.model}</p>
                                                                                <p className="text-[10px] text-slate-400 font-mono">{car.registration_no || 'No Reg'}</p>
                                                                            </div>
                                                                            <div className="text-right shrink-0">
                                                                                <p className="text-xs font-bold text-primary">₹{Number(car.price).toLocaleString('en-IN')}</p>
                                                                                {isAlreadyAdded && <p className="text-[9px] text-slate-400">Added</p>}
                                                                                {isSelected && !isAlreadyAdded && <span className="material-symbols-outlined text-blue-500 text-[14px]">check_circle</span>}
                                                                            </div>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Interest level */}
                                                    <div className="flex gap-1.5">
                                                        {(['hot', 'warm', 'cold'] as const).map(level => (
                                                            <button key={level} type="button" onClick={() => setCarSelectorForm(f => ({ ...f, interest_level: level }))}
                                                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all capitalize ${carSelectorForm.interest_level === level ? level === 'hot' ? 'bg-red-500 text-white border-red-500' : level === 'warm' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-500 text-white border-slate-500' : 'bg-white text-slate-500 border-slate-200'}`}>
                                                                {level === 'hot' ? '🔥' : level === 'warm' ? '⭐' : '❄️'} {level}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <input type="text" value={carSelectorForm.notes} onChange={e => setCarSelectorForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-200" />
                                                    <button type="button" disabled={!carSelectorForm.inventory_id}
                                                        onClick={() => {
                                                            if (!carSelectorForm.inventory_id) return;
                                                            if (pendingCarInterests.some(p => p.inventory_id === carSelectorForm.inventory_id)) { alert('This car is already added.'); return; }
                                                            const car = availableInventory.find((c: any) => c.id === carSelectorForm.inventory_id);
                                                            setPendingCarInterests(prev => [...prev, { inventory_id: carSelectorForm.inventory_id, interest_level: carSelectorForm.interest_level, notes: carSelectorForm.notes, carLabel: car ? `${car.year} ${car.make} ${car.model}` : 'Unknown Car', is_wishlist: false }]);
                                                            setCarSelectorForm({ inventory_id: '', interest_level: 'warm', notes: '' }); setCarSearch(''); setCarSearchOpen(false); setShowCarSelector(false);
                                                        }}
                                                        className="w-full h-9 bg-blue-500 text-white text-sm font-bold rounded-lg hover:bg-blue-600 transition disabled:opacity-40 disabled:cursor-not-allowed">
                                                        Add to List
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    {/* ── Wishlist / Not In Stock form ── */}
                                                    <div className="rounded-lg bg-purple-50 border border-purple-100 px-3 py-2 flex items-center gap-2 mb-1">
                                                        <span className="material-symbols-outlined text-purple-500 text-[15px]">info</span>
                                                        <p className="text-[11px] text-purple-700">Car not in your inventory? Fill in the details below — we'll track what the customer wants.</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Make <span className="text-red-400">*</span></label>
                                                            <input type="text" value={wishlistForm.make} onChange={e => setWishlistForm(f => ({ ...f, make: e.target.value }))} placeholder="e.g. Maruti, Honda" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-200" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Model <span className="text-red-400">*</span></label>
                                                            <input type="text" value={wishlistForm.model} onChange={e => setWishlistForm(f => ({ ...f, model: e.target.value }))} placeholder="e.g. Swift, City" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-200" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Year</label>
                                                            <input type="number" value={wishlistForm.year} onChange={e => setWishlistForm(f => ({ ...f, year: e.target.value }))} placeholder="e.g. 2020" min="1990" max="2030" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-200" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Color</label>
                                                            <input type="text" value={wishlistForm.color} onChange={e => setWishlistForm(f => ({ ...f, color: e.target.value }))} placeholder="e.g. White, Red" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-200" />
                                                        </div>
                                                    </div>
                                                    <input type="text" value={wishlistForm.variant} onChange={e => setWishlistForm(f => ({ ...f, variant: e.target.value }))} placeholder="Variant (optional) — e.g. VXI, ZXI+" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-200" />
                                                    {/* Interest level */}
                                                    <div className="flex gap-1.5">
                                                        {(['hot', 'warm', 'cold'] as const).map(level => (
                                                            <button key={level} type="button" onClick={() => setWishlistForm(f => ({ ...f, interest_level: level }))}
                                                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all capitalize ${wishlistForm.interest_level === level ? level === 'hot' ? 'bg-red-500 text-white border-red-500' : level === 'warm' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-500 text-white border-slate-500' : 'bg-white text-slate-500 border-slate-200'}`}>
                                                                {level === 'hot' ? '🔥' : level === 'warm' ? '⭐' : '❄️'} {level}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <input type="text" value={wishlistForm.notes} onChange={e => setWishlistForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional) — budget, condition, etc." className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-200" />
                                                    <button type="button" disabled={!wishlistForm.make.trim() || !wishlistForm.model.trim()}
                                                        onClick={() => {
                                                            if (!wishlistForm.make.trim() || !wishlistForm.model.trim()) return;
                                                            const label = `${wishlistForm.year ? wishlistForm.year + ' ' : ''}${wishlistForm.make} ${wishlistForm.model}${wishlistForm.variant ? ' ' + wishlistForm.variant : ''}`;
                                                            setPendingCarInterests(prev => [...prev, { inventory_id: '', interest_level: wishlistForm.interest_level, notes: wishlistForm.notes, carLabel: label, is_wishlist: true, custom_make: wishlistForm.make, custom_model: wishlistForm.model, custom_year: wishlistForm.year, custom_variant: wishlistForm.variant, custom_color: wishlistForm.color }]);
                                                            setWishlistForm({ make: '', model: '', year: '', variant: '', color: '', interest_level: 'warm', notes: '' }); setShowCarSelector(false);
                                                        }}
                                                        className="w-full h-9 bg-purple-500 text-white text-sm font-bold rounded-lg hover:bg-purple-600 transition disabled:opacity-40 disabled:cursor-not-allowed">
                                                        Add to Wishlist
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    );
                                })()}

                                {pendingCarInterests.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {pendingCarInterests.map((interest, idx) => (
                                            <div key={idx} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border ${
                                                interest.is_wishlist ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                interest.interest_level === 'hot' ? 'bg-red-50 text-red-600 border-red-200' :
                                                interest.interest_level === 'warm' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}>
                                                <span>{interest.is_wishlist ? '🔍' : interest.interest_level === 'hot' ? '🔥' : interest.interest_level === 'warm' ? '⭐' : '❄️'}</span>
                                                <span>{interest.carLabel}</span>
                                                {interest.is_wishlist && <span className="text-[9px] bg-purple-100 px-1 rounded">Sourcing</span>}
                                                <button type="button" onClick={() => setPendingCarInterests(prev => prev.filter((_, i) => i !== idx))} className="ml-0.5 hover:text-red-500 transition-colors">
                                                    <span className="material-symbols-outlined text-[12px]">close</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : !showCarSelector && (
                                    <p className="text-xs text-slate-400 text-center py-1">No cars added yet. Click "Add Car" to record interest.</p>
                                )}
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Notes / Message</label>
                                <textarea
                                    rows={3}
                                    value={manualForm.message || ''}
                                    onChange={e => setManualForm(prev => ({ ...prev, message: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                    placeholder="Any initial notes or requirements about this lead..."
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={phoneCheckState === 'duplicate' && !duplicateAcknowledged}
                                    className="w-full h-11 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={phoneCheckState === 'duplicate' && !duplicateAcknowledged ? 'Acknowledge the duplicate warning above to save' : ''}
                                >
                                    Save Lead
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* ── Delete Confirmation Modal ── */}
            {deleteModal.open && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteModal({ open: false, leadId: null, count: 1 })} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
                        <div className="size-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                            <span className="material-symbols-outlined text-red-600 text-2xl">delete_forever</span>
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-slate-800">
                                {deleteModal.leadId ? 'Delete Lead?' : `Delete ${deleteModal.count} Leads?`}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                This action is permanent and cannot be undone.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteModal({ open: false, leadId: null, count: 1 })}
                                className="flex-1 h-10 border border-slate-200 rounded-xl text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 h-10 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors"
                            >
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Lost Reason Modal ── */}
            {lostModal.open && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setLostModal({ open: false, leadId: '', reason: '' })} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-slate-500 text-xl">sentiment_dissatisfied</span>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Mark as Closed (Lost)</h3>
                                <p className="text-xs text-slate-500">Why was this lead lost?</p>
                            </div>
                        </div>
                        <select
                            value={lostModal.reason}
                            onChange={e => setLostModal(prev => ({ ...prev, reason: e.target.value }))}
                            className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white"
                        >
                            <option value="">Select a reason (optional)</option>
                            <option value="Price too high">Price too high</option>
                            <option value="Bought elsewhere">Bought elsewhere</option>
                            <option value="Financing failed">Financing failed</option>
                            <option value="Lost contact">Lost contact</option>
                            <option value="Not interested anymore">Not interested anymore</option>
                            <option value="Other">Other</option>
                        </select>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setLostModal({ open: false, leadId: '', reason: '' })}
                                className="flex-1 h-10 border border-slate-200 rounded-xl text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmLostReason}
                                className="flex-1 h-10 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-light transition-colors"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLeads;
