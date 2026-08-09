import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { supabase } from '../../lib/supabase';
import { toWhatsAppUrl, formatCurrency, formatDate } from '../../lib/utils';
import HighlightText from '../../components/ui/HighlightText';

interface ClubMember {
    id: string;
    customer_id: string | null;
    full_name: string;
    phone: string;
    email: string | null;
    membership_no: string;
    status: 'Active' | 'Inactive' | 'Suspended' | 'Expired';
    points: number;
    joining_date: string;
    expiry_date: string | null;
    total_spent: number;
    referred_by: string | null;
    notes: string | null;
    business_name: string | null;
    business_type: string | null;
    business_services: string | null;
    whatsapp_number: string | null;
    alternate_phone: string | null;
    home_address: string | null;
    business_address: string | null;
    created_at: string;
    customer?: {
        full_name: string;
        phone: string;
        email: string | null;
        city: string | null;
    } | null;
}

interface PointsTransaction {
    id: string;
    member_id: string;
    exchange_type: 'given_to_member' | 'taken_from_member';
    service_name: string;
    equivalent_value: number;
    notes: string | null;
    transaction_date: string;
    added_by: string | null;
    added_by_profile?: {
        full_name: string | null;
    } | null;
}

const emptyMemberForm = {
    customer_id: '',
    full_name: '',
    phone: '',
    email: '',
    membership_no: '',
    status: 'Active' as const,
    joining_date: new Date().toISOString().slice(0, 10),
    expiry_date: '',
    referred_by: '',
    notes: '',
    business_name: '',
    business_type: '',
    business_services: '',
    whatsapp_number: '',
    alternate_phone: '',
    home_address: '',
    business_address: '',
};

const ClubMembers: React.FC = () => {
    const { isAdmin, profile } = useAuth();
    const { 
        clubMembers, 
        clubTransactions, 
        customers, 
        sales, 
        settings, 
        loading, 
        refreshData 
    } = useData();

    // ─── Local State ──────────────────────────────────────────────────────────
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [detail, setDetail] = useState<ClubMember | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [isEditingSettings, setIsEditingSettings] = useState(false);
    const [isEditingMember, setIsEditingMember] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    
    // Settings form
    const [clubSettingsForm, setClubSettingsForm] = useState({
        name: 'Royal Club',
        prefix: 'RC',
    });
    
    // Add Member form
    const [addForm, setAddForm] = useState(emptyMemberForm);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    
    // Edit Member form
    const [editForm, setEditForm] = useState({
        status: 'Active' as 'Active' | 'Inactive' | 'Suspended' | 'Expired',
        expiry_date: '',
        referred_by: '',
        notes: '',
        business_name: '',
        business_type: '',
        business_services: '',
        whatsapp_number: '',
        alternate_phone: '',
        home_address: '',
        business_address: '',
    });

    // Detail Modal states
    const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'ledger' | 'settings'>('overview');
    
    // Service exchange log form (inside details modal)
    const [txForm, setTxForm] = useState({
        exchange_type: 'taken_from_member' as 'given_to_member' | 'taken_from_member',
        service_name: '',
        equivalent_value: '',
        notes: '',
    });
    const [txSaving, setTxSaving] = useState(false);

    // ─── Load and Initialize Club Settings ────────────────────────────────────
    const clubSettings = useMemo(() => {
        return settings?.club_settings || { name: 'Royal Club', prefix: 'RC' };
    }, [settings]);

    useEffect(() => {
        if (clubSettings) {
            setClubSettingsForm({
                name: clubSettings.name || 'Royal Club',
                prefix: clubSettings.prefix || 'RC',
            });
        }
    }, [clubSettings]);

    // ─── Generate Membership ID ───────────────────────────────────────────────
    const generateMembershipNumber = (prefix: string) => {
        const randomNum = Math.floor(10000 + Math.random() * 90000); // 5 digits
        return `${prefix.toUpperCase()}-CLUB-${randomNum}`;
    };

    // Auto-generate membership number when opening the "Add Member" form or changing settings
    useEffect(() => {
        if (isAdding && !addForm.membership_no) {
            setAddForm(prev => ({
                ...prev,
                membership_no: generateMembershipNumber(clubSettingsForm.prefix),
            }));
        }
    }, [isAdding, clubSettingsForm.prefix]);

    // ─── Customer Selection Logic (Link existing Customer) ────────────────────
    const matchedCustomers = useMemo(() => {
        const query = customerSearchQuery.toLowerCase().trim();
        if (!query) return [];
        return customers.filter(c => 
            c.full_name?.toLowerCase().includes(query) || 
            c.phone?.includes(query)
        ).slice(0, 5);
    }, [customers, customerSearchQuery]);

    const handleSelectCustomer = (c: any) => {
        setAddForm(prev => ({
            ...prev,
            customer_id: c.id,
            full_name: c.full_name || '',
            phone: c.phone || '',
            email: c.email || '',
            whatsapp_number: c.whatsapp_number || '',
            alternate_phone: c.alternate_phone || '',
            home_address: c.address || '',
            business_address: c.office_address || '',
            notes: c.notes || '',
        }));
        setCustomerSearchQuery(c.full_name);
        setShowCustomerDropdown(false);
    };

    const handleClearCustomerLink = () => {
        setAddForm(prev => ({
            ...prev,
            customer_id: '',
            full_name: '',
            phone: '',
            email: '',
            whatsapp_number: '',
            alternate_phone: '',
            home_address: '',
            business_address: '',
            notes: '',
        }));
        setCustomerSearchQuery('');
    };

    // ─── Search and Filter Members ────────────────────────────────────────────
    const filteredMembers = useMemo(() => {
        const q = search.toLowerCase().trim();
        return clubMembers.filter((m: ClubMember) => {
            // Text Search
            const matchesText = !q ? true : (
                m.full_name?.toLowerCase().includes(q) ||
                m.phone?.includes(q) ||
                m.email?.toLowerCase().includes(q) ||
                m.membership_no?.toLowerCase().includes(q) ||
                m.business_name?.toLowerCase().includes(q) ||
                m.business_type?.toLowerCase().includes(q) ||
                m.business_services?.toLowerCase().includes(q) ||
                m.referred_by?.toLowerCase().includes(q) ||
                m.whatsapp_number?.includes(q) ||
                m.alternate_phone?.includes(q) ||
                m.home_address?.toLowerCase().includes(q) ||
                m.business_address?.toLowerCase().includes(q)
            );
            
            // Status Filter
            const matchesStatus = statusFilter === 'all' ? true : m.status === statusFilter;
            
            return matchesText && matchesStatus;
        });
    }, [clubMembers, search, statusFilter]);

    // ─── Profile Details 360 Loader ───────────────────────────────────────────
    const memberTransactions = useMemo(() => {
        if (!detail) return [];
        return clubTransactions.filter((tx: PointsTransaction) => tx.member_id === detail.id);
    }, [detail, clubTransactions]);

    const detailCounts = useMemo(() => {
        if (!detail) return { taken: 0, given: 0 };
        const taken = memberTransactions.filter((tx: PointsTransaction) => tx.exchange_type === 'taken_from_member').length;
        const given = memberTransactions.filter((tx: PointsTransaction) => tx.exchange_type === 'given_to_member').length;
        return { taken, given };
    }, [detail, memberTransactions]);

    const handleOpenDetail = (member: ClubMember) => {
        setDetail(member);
        setActiveDetailTab('overview');
        setEditForm({
            status: member.status,
            expiry_date: member.expiry_date || '',
            referred_by: member.referred_by || '',
            notes: member.notes || '',
            business_name: member.business_name || '',
            business_type: member.business_type || '',
            business_services: member.business_services || '',
            whatsapp_number: member.whatsapp_number || '',
            alternate_phone: member.alternate_phone || '',
            home_address: member.home_address || '',
            business_address: member.business_address || '',
        });
        setTxForm({
            exchange_type: 'taken_from_member',
            service_name: '',
            equivalent_value: '',
            notes: '',
        });
    };

    // ─── Save Club Settings ───────────────────────────────────────────────────
    const handleSaveClubSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clubSettingsForm.name.trim() || !clubSettingsForm.prefix.trim()) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('dealership_settings').upsert({
                setting_key: 'club_settings',
                setting_value: {
                    name: clubSettingsForm.name.trim(),
                    prefix: clubSettingsForm.prefix.trim().toUpperCase(),
                }
            });
            if (error) throw error;
            setIsEditingSettings(false);
            refreshData();
        } catch (err: any) {
            console.error('Failed to save settings:', err);
            alert('Failed to save settings: ' + (err.message || err));
        } finally {
            setSaving(false);
        }
    };

    // ─── Save New Member ──────────────────────────────────────────────────────
    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addForm.full_name.trim() || !addForm.phone.trim() || !addForm.membership_no.trim()) {
            alert('Name, Phone and Membership ID are required.');
            return;
        }

        setSaving(true);
        try {
            // Calculate sales total if linked
            let totalSpent = 0;
            if (addForm.customer_id) {
                const customerSales = sales.filter(s => s.customer_id === addForm.customer_id);
                totalSpent = customerSales.reduce((acc, curr) => acc + (Number(curr.final_price) || 0), 0);
            }

            const memberPayload = {
                customer_id: addForm.customer_id ? addForm.customer_id : null,
                full_name: addForm.full_name.trim(),
                phone: addForm.phone.trim(),
                email: addForm.email.trim() || null,
                membership_no: addForm.membership_no.trim().toUpperCase(),
                status: addForm.status,
                joining_date: addForm.joining_date,
                expiry_date: addForm.expiry_date ? addForm.expiry_date : null,
                total_spent: totalSpent,
                referred_by: addForm.referred_by.trim() || null,
                notes: addForm.notes.trim() || null,
                business_name: addForm.business_name.trim() || null,
                business_type: addForm.business_type.trim() || null,
                business_services: addForm.business_services.trim() || null,
                whatsapp_number: addForm.whatsapp_number.trim() || null,
                alternate_phone: addForm.alternate_phone.trim() || null,
                home_address: addForm.home_address.trim() || null,
                business_address: addForm.business_address.trim() || null,
                points: 0, 
                added_by: profile?.id || null,
            };

            const { data: newMember, error: memberError } = await supabase
                .from('club_members')
                .insert(memberPayload)
                .select()
                .single();

            if (memberError) throw memberError;

            setIsAdding(false);
            setAddForm(emptyMemberForm);
            setCustomerSearchQuery('');
            refreshData();
        } catch (err: any) {
            console.error('Failed to add member:', err);
            alert('Failed to add member: ' + (err.message || err));
        } finally {
            setSaving(false);
        }
    };

    // ─── Edit Member Settings ─────────────────────────────────────────────────
    const handleUpdateMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!detail) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('club_members')
                .update({
                    status: editForm.status,
                    expiry_date: editForm.expiry_date ? editForm.expiry_date : null,
                    referred_by: editForm.referred_by.trim() || null,
                    notes: editForm.notes.trim() || null,
                    business_name: editForm.business_name.trim() || null,
                    business_type: editForm.business_type.trim() || null,
                    business_services: editForm.business_services.trim() || null,
                    whatsapp_number: editForm.whatsapp_number.trim() || null,
                    alternate_phone: editForm.alternate_phone.trim() || null,
                    home_address: editForm.home_address.trim() || null,
                    business_address: editForm.business_address.trim() || null,
                })
                .eq('id', detail.id);

            if (error) throw error;
            
            const updatedDetail = {
                ...detail,
                status: editForm.status,
                expiry_date: editForm.expiry_date ? editForm.expiry_date : null,
                referred_by: editForm.referred_by.trim() || null,
                notes: editForm.notes.trim() || null,
                business_name: editForm.business_name.trim() || null,
                business_type: editForm.business_type.trim() || null,
                business_services: editForm.business_services.trim() || null,
                whatsapp_number: editForm.whatsapp_number.trim() || null,
                alternate_phone: editForm.alternate_phone.trim() || null,
                home_address: editForm.home_address.trim() || null,
                business_address: editForm.business_address.trim() || null,
            };
            setDetail(updatedDetail);
            setIsEditingMember(false);
            refreshData();
        } catch (err: any) {
            console.error('Failed to update member:', err);
            alert('Failed to update member: ' + (err.message || err));
        } finally {
            setSaving(false);
        }
    };

    // ─── Add Service Exchange ──────────────────────────────────────────────────
    const handleAddTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!detail || !txForm.service_name.trim()) return;

        setTxSaving(true);
        try {
            const { error } = await supabase.from('club_service_exchanges').insert({
                member_id: detail.id,
                exchange_type: txForm.exchange_type,
                service_name: txForm.service_name.trim(),
                equivalent_value: Number(txForm.equivalent_value) || 0.00,
                notes: txForm.notes.trim() || null,
                added_by: profile?.id
            });
            if (error) throw error;

            setTxForm({
                exchange_type: 'taken_from_member',
                service_name: '',
                equivalent_value: '',
                notes: '',
            });

            refreshData();
        } catch (err: any) {
            console.error('Failed to log service exchange:', err);
            alert('Failed to log transaction: ' + (err.message || err));
        } finally {
            setTxSaving(false);
        }
    };

    // ─── Delete Member ────────────────────────────────────────────────────────
    const handleDeleteMember = async () => {
        if (!detail) return;
        if (!window.confirm(`Are you absolutely sure you want to remove ${detail.full_name} from the club? This will delete all logged service exchanges.`)) return;
        setDeleting(true);
        try {
            const { error } = await supabase.from('club_members').delete().eq('id', detail.id);
            if (error) throw error;
            setDetail(null);
            refreshData();
        } catch (err: any) {
            console.error('Failed to delete member:', err);
            alert('Failed to delete member: ' + (err.message || err));
        } finally {
            setDeleting(false);
        }
    };

    // ─── Badge color helper ──────────────────────────────────────────────────
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active': return 'bg-green-50 text-green-700 border-green-200';
            case 'Inactive': return 'bg-slate-100 text-slate-500 border-slate-200';
            case 'Suspended': return 'bg-red-50 text-red-700 border-red-200';
            case 'Expired': return 'bg-amber-50 text-amber-700 border-amber-200';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    // ─── Statistics Calculation ───────────────────────────────────────────────
    const stats = useMemo(() => {
        const total = clubMembers.length;
        const active = clubMembers.filter((m: ClubMember) => m.status === 'Active').length;
        const totalExchanges = clubTransactions.length;
        const withBusiness = clubMembers.filter((m: ClubMember) => !!m.business_name).length;
        return { total, active, totalExchanges, withBusiness };
    }, [clubMembers, clubTransactions]);

    const memberExchangeCounts = useMemo(() => {
        const counts: Record<string, { taken: number; given: number }> = {};
        clubTransactions.forEach((tx: any) => {
            if (!counts[tx.member_id]) {
                counts[tx.member_id] = { taken: 0, given: 0 };
            }
            if (tx.exchange_type === 'taken_from_member') {
                counts[tx.member_id].taken += 1;
            } else if (tx.exchange_type === 'given_to_member') {
                counts[tx.member_id].given += 1;
            }
        });
        return counts;
    }, [clubTransactions]);

    return (
        <div className="space-y-6 text-left">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-black text-primary font-display">
                            {clubSettings.name} Directory
                        </h1>
                        <button 
                            onClick={() => setIsEditingSettings(true)}
                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-primary transition-colors"
                            title="Edit Club Name & Settings"
                        >
                            <span className="material-symbols-outlined text-lg">settings</span>
                        </button>
                    </div>
                    <p className="text-slate-500 text-sm">
                        {loading ? '...' : stats.total} registered club members under the prefix "{clubSettings.prefix}".
                    </p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsAdding(true)} 
                        className="h-10 px-5 bg-primary text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-primary-light transition-colors shadow-sm animate-fade-in"
                    >
                        <span className="material-symbols-outlined text-lg">person_add</span> Add Club Member
                    </button>
                    <button 
                        onClick={refreshData} 
                        className="h-10 w-10 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors" 
                        title="Refresh"
                    >
                        <span className="material-symbols-outlined text-lg">refresh</span>
                    </button>
                </div>
            </div>

            {/* Stats Dashboard Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-100 shadow-sm p-4 rounded-2xl flex items-center gap-4">
                    <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined">group</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Members</p>
                        <p className="text-lg font-black text-primary">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-white border border-slate-100 shadow-sm p-4 rounded-2xl flex items-center gap-4">
                    <div className="size-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600 shrink-0">
                        <span className="material-symbols-outlined">how_to_reg</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Active Members</p>
                        <p className="text-lg font-black text-primary">{stats.active}</p>
                    </div>
                </div>
                <div className="bg-white border border-slate-100 shadow-sm p-4 rounded-2xl flex items-center gap-4">
                    <div className="size-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                        <span className="material-symbols-outlined">storefront</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Businesses Registered</p>
                        <p className="text-lg font-black text-primary">{stats.withBusiness}</p>
                    </div>
                </div>
                <div className="bg-white border border-slate-100 shadow-sm p-4 rounded-2xl flex items-center gap-4">
                    <div className="size-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
                        <span className="material-symbols-outlined">sync_alt</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Services Swapped</p>
                        <p className="text-lg font-black text-primary">{stats.totalExchanges.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 border border-slate-100 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 h-10 flex-1">
                    <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
                    <input 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        placeholder="Search by name, phone, business, referrer, membership no…" 
                        className="bg-transparent text-sm text-primary outline-none w-full" 
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="material-symbols-outlined text-slate-300 text-base hover:text-slate-500">
                            close
                        </button>
                    )}
                </div>
                <div>
                    <select 
                        value={statusFilter} 
                        onChange={e => setStatusFilter(e.target.value)}
                        className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-primary/10 w-full sm:w-auto cursor-pointer"
                    >
                        <option value="all">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Expired">Expired</option>
                    </select>
                </div>
            </div>

            {/* Listing Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto relative">
                    <table className="w-full min-w-[900px]">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50/50">
                                <th className="text-left px-5 py-3.5">Membership Details</th>
                                <th className="text-left px-5 py-3.5">Member Name</th>
                                <th className="text-left px-5 py-3.5">Business Details</th>
                                <th className="text-left px-5 py-3.5">Status</th>
                                <th className="text-left px-5 py-3.5">Services Swapped</th>
                                <th className="text-left px-5 py-3.5">Spend Profile</th>
                                <th className="text-left px-5 py-3.5">Joined</th>
                                <th className="text-left px-5 py-3.5">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        Loading membership data...
                                    </td>
                                </tr>
                            ) : filteredMembers.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center">
                                        <span className="material-symbols-outlined text-4xl text-slate-200 mb-3 block">card_membership</span>
                                        <p className="text-slate-400 font-medium">No members found</p>
                                        <p className="text-xs text-slate-300 mt-1">Register a customer in the club program.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredMembers.map((m: ClubMember) => {
                                    const counts = memberExchangeCounts[m.id] || { taken: 0, given: 0 };
                                    return (
                                        <tr 
                                            key={m.id} 
                                            onClick={() => handleOpenDetail(m)} 
                                            className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 cursor-pointer transition-colors"
                                        >
                                            <td className="px-5 py-4">
                                                <span className="text-xs font-black bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200">
                                                    <HighlightText text={m.membership_no} highlight={search} />
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="size-9 rounded-full bg-gradient-to-br from-primary to-primary-light text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-sm">
                                                        {m.full_name?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-primary">
                                                            <HighlightText text={m.full_name} highlight={search} />
                                                        </p>
                                                        <p className="text-[10px] text-slate-400">
                                                            <HighlightText text={m.phone} highlight={search} />
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                {m.business_name ? (
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-700 truncate max-w-[180px]">
                                                            <HighlightText text={m.business_name} highlight={search} />
                                                        </p>
                                                        {m.business_type && (
                                                            <p className="text-[9px] font-medium text-slate-400">
                                                                <HighlightText text={m.business_type} highlight={search} />
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-300 font-medium">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(m.status)}`}>
                                                    {m.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-green-50 text-green-700 border border-green-200" title="Services Taken from Member">
                                                        📥 {counts.taken}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200" title="Services Given to Member">
                                                        📤 {counts.given}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-xs font-medium text-slate-700">
                                                    {formatCurrency(m.total_spent)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                                                {formatDate(m.joining_date)}
                                            </td>
                                            <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                                                <div className="flex gap-1">
                                                    <a href={`tel:${m.phone}`} className="p-1.5 hover:bg-green-50 rounded-lg text-green-500" title="Call">
                                                        <span className="material-symbols-outlined text-base">call</span>
                                                    </a>
                                                    <a 
                                                        href={toWhatsAppUrl(m.whatsapp_number || m.phone)} 
                                                        target="_blank" 
                                                        rel="noreferrer" 
                                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400" 
                                                        title="WhatsApp"
                                                    >
                                                        <span className="material-symbols-outlined text-base">chat</span>
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

            {/* ─── MODAL: EDIT SETTINGS (CLUB NAME / PREFIX) ─── */}
            {isEditingSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-gradient-to-r from-primary to-primary-light px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <span className="material-symbols-outlined">settings</span>
                                <h2 className="font-black">Edit Club Settings</h2>
                            </div>
                            <button onClick={() => setIsEditingSettings(false)} className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSaveClubSettings} className="p-5 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Club Entity Name</label>
                                <input 
                                    required 
                                    value={clubSettingsForm.name} 
                                    onChange={e => setClubSettingsForm({...clubSettingsForm, name: e.target.value})} 
                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" 
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Membership ID Prefix</label>
                                <input 
                                    required 
                                    value={clubSettingsForm.prefix} 
                                    onChange={e => setClubSettingsForm({...clubSettingsForm, prefix: e.target.value.toUpperCase()})} 
                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" 
                                    maxLength={4}
                                />
                                <p className="text-[10px] text-slate-400 mt-1">E.g., "RC" will generate membership numbers like "RC-CLUB-12345".</p>
                            </div>
                            <button 
                                type="submit" 
                                disabled={saving} 
                                className="w-full h-10 bg-primary text-white font-bold rounded-xl text-sm flex items-center justify-center hover:bg-primary-light transition disabled:opacity-60"
                            >
                                {saving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── MODAL: ADD CLUB MEMBER ─── */}
            {isAdding && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden my-8 text-left">
                        <div className="bg-gradient-to-r from-primary to-primary-light px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <span className="material-symbols-outlined font-black">person_add</span>
                                <h2 className="font-black">Add Club Member</h2>
                            </div>
                            <button onClick={() => { setIsAdding(false); setAddForm(emptyMemberForm); setCustomerSearchQuery(''); }} className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        <form onSubmit={handleAddMember} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                            {/* Customer link autocomplete */}
                            <div className="relative">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Link Existing Customer Profile (Optional)</label>
                                    {addForm.customer_id && (
                                        <button 
                                            type="button" 
                                            onClick={handleClearCustomerLink}
                                            className="text-[10px] font-bold text-red-500 hover:underline flex items-center gap-0.5"
                                        >
                                            <span className="material-symbols-outlined text-xs">link_off</span> Unlink
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 h-10">
                                    <span className="material-symbols-outlined text-slate-400 text-sm">person_search</span>
                                    <input 
                                        value={customerSearchQuery} 
                                        onChange={e => {
                                            setCustomerSearchQuery(e.target.value);
                                            setShowCustomerDropdown(true);
                                            setAddForm(prev => ({ ...prev, full_name: e.target.value }));
                                        }}
                                        onFocus={() => setShowCustomerDropdown(true)}
                                        placeholder="Type customer name or phone to look up…" 
                                        className="bg-transparent text-sm text-primary outline-none w-full" 
                                    />
                                </div>
                                
                                {showCustomerDropdown && matchedCustomers.length > 0 && (
                                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-50">
                                        {matchedCustomers.map(c => (
                                            <div 
                                                key={c.id} 
                                                onClick={() => handleSelectCustomer(c)}
                                                className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs"
                                            >
                                                <div>
                                                    <p className="font-bold text-slate-700">{c.full_name}</p>
                                                    <p className="text-slate-400 text-[10px]">{c.phone} {c.email ? `• ${c.email}` : ''}</p>
                                                </div>
                                                <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full">Link Profile</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Full Name *</label>
                                    <input 
                                        required 
                                        value={addForm.full_name} 
                                        onChange={e => setAddForm({...addForm, full_name: e.target.value})} 
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" 
                                        disabled={!!addForm.customer_id}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Phone Number *</label>
                                    <input 
                                        required 
                                        value={addForm.phone} 
                                        onChange={e => setAddForm({...addForm, phone: e.target.value})} 
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" 
                                        disabled={!!addForm.customer_id}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">WhatsApp Number</label>
                                    <input 
                                        value={addForm.whatsapp_number} 
                                        onChange={e => setAddForm({...addForm, whatsapp_number: e.target.value})} 
                                        placeholder="With country code, e.g., 91..."
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" 
                                        disabled={!!addForm.customer_id}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Alternative Number</label>
                                    <input 
                                        value={addForm.alternate_phone} 
                                        onChange={e => setAddForm({...addForm, alternate_phone: e.target.value})} 
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" 
                                        disabled={!!addForm.customer_id}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Email Address</label>
                                    <input 
                                        type="email"
                                        value={addForm.email} 
                                        onChange={e => setAddForm({...addForm, email: e.target.value})} 
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" 
                                        disabled={!!addForm.customer_id}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Home Address</label>
                                    <input 
                                        value={addForm.home_address} 
                                        onChange={e => setAddForm({...addForm, home_address: e.target.value})} 
                                        placeholder="Residential Address"
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" 
                                        disabled={!!addForm.customer_id}
                                    />
                                </div>
                            </div>

                            {/* Business details section */}
                            <div className="border-t border-slate-100 pt-3 space-y-3">
                                <p className="text-[10px] font-black text-primary uppercase tracking-wide flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[15px]">storefront</span> Business Profile
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Business Name</label>
                                        <input 
                                            value={addForm.business_name} 
                                            onChange={e => setAddForm({...addForm, business_name: e.target.value})} 
                                            placeholder="Company, Shop or Brand Name"
                                            className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" 
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Business Address</label>
                                        <input 
                                            value={addForm.business_address} 
                                            onChange={e => setAddForm({...addForm, business_address: e.target.value})} 
                                            placeholder="Office or Shop Address"
                                            className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" 
                                            disabled={!!addForm.customer_id}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Kind of Business</label>
                                        <input 
                                            value={addForm.business_type} 
                                            onChange={e => setAddForm({...addForm, business_type: e.target.value})} 
                                            placeholder="E.g., Retail, Car washing, IT, Cafe"
                                            className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" 
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Services Provided</label>
                                        <textarea 
                                            rows={2}
                                            value={addForm.business_services} 
                                            onChange={e => setAddForm({...addForm, business_services: e.target.value})} 
                                            placeholder="Describe the services this business offers..."
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/10 resize-none" 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Membership ID</label>
                                    <input 
                                        required
                                        value={addForm.membership_no} 
                                        onChange={e => setAddForm({...addForm, membership_no: e.target.value.toUpperCase()})} 
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 font-bold bg-slate-50" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Joining Date</label>
                                    <input 
                                        type="date"
                                        required
                                        value={addForm.joining_date} 
                                        onChange={e => setAddForm({...addForm, joining_date: e.target.value})} 
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 text-slate-600" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Status</label>
                                    <select 
                                        value={addForm.status} 
                                        onChange={e => setAddForm({...addForm, status: e.target.value as any})}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 text-slate-600 cursor-pointer"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                        <option value="Suspended">Suspended</option>
                                        <option value="Expired">Expired</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Expiry Date (Optional)</label>
                                    <input 
                                        type="date"
                                        value={addForm.expiry_date} 
                                        onChange={e => setAddForm({...addForm, expiry_date: e.target.value})} 
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 text-slate-600" 
                                    />
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Referred By (Optional)</label>
                                    <input 
                                        value={addForm.referred_by} 
                                        onChange={e => setAddForm({...addForm, referred_by: e.target.value})} 
                                        placeholder="Name of the person who referred them"
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" 
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Internal Notes</label>
                                <textarea 
                                    rows={2} 
                                    value={addForm.notes} 
                                    onChange={e => setAddForm({...addForm, notes: e.target.value})} 
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/10 resize-none" 
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={saving} 
                                className="w-full h-11 bg-primary text-white font-bold rounded-xl text-sm flex items-center justify-center hover:bg-primary-light transition disabled:opacity-60 shadow-sm"
                            >
                                {saving ? 'Adding Member...' : 'Register Club Member'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── MODAL: MEMBER PROFILE 360 ─── */}
            {detail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDetail(null)}>
                    <div 
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" 
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Gradient header card */}
                        <div className="bg-gradient-to-r from-primary to-primary-light px-6 pt-6 pb-8 text-white relative shrink-0">
                            <div className="absolute top-4 right-4 flex gap-2">
                                <button 
                                    onClick={() => {
                                        setIsEditingMember(!isEditingMember);
                                        setActiveDetailTab('settings');
                                    }} 
                                    className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors" 
                                    title="Edit settings"
                                >
                                    <span className="material-symbols-outlined text-white text-lg">edit</span>
                                </button>
                                <button onClick={() => setDetail(null)} className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                                    <span className="material-symbols-outlined text-white text-lg">close</span>
                                </button>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <div className="size-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white text-2xl font-black shadow-inner">
                                    {detail.full_name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="text-left">
                                    <h2 className="text-xl font-black">{detail.full_name}</h2>
                                    <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mt-0.5">
                                        ID: {detail.membership_no}
                                    </p>
                                    <div className="flex gap-2 mt-1.5">
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border bg-white/10 text-white border-white/20`}>
                                            {detail.status.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex border-b border-slate-100 bg-slate-50/50 px-4 pt-1 shrink-0 overflow-x-auto scrollbar-none">
                            {[
                                { id: 'overview', label: 'Overview', icon: 'badge' },
                                { id: 'ledger', label: 'Service Timeline', icon: 'swap_horiz' },
                                { id: 'settings', label: 'Settings', icon: 'manage_accounts' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveDetailTab(tab.id as any);
                                        if (tab.id !== 'settings') setIsEditingMember(false);
                                    }}
                                    className={`px-4 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                        activeDetailTab === tab.id
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Modal Body Container */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 text-left">
                            {activeDetailTab === 'overview' && (
                                <div className="space-y-5">
                                    {/* Action items */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <a href={`tel:${detail.phone}`} className="h-11 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-green-200 shadow-sm">
                                            <span className="material-symbols-outlined text-base">call</span> Call Member
                                        </a>
                                        <a href={toWhatsAppUrl(detail.whatsapp_number || detail.phone)} target="_blank" rel="noreferrer" className="h-11 bg-[#25D366] text-white hover:bg-[#1ebd5a] rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm">
                                            <span className="material-symbols-outlined text-base">chat</span> WhatsApp
                                        </a>
                                    </div>

                                    {/* Main Membership Card View */}
                                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-5 rounded-3xl text-white shadow-xl relative overflow-hidden">
                                        <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-[140px] text-white/5 pointer-events-none select-none font-thin">
                                            stars
                                        </span>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">LOYALTY MEMBER CARD</p>
                                                <p className="text-sm font-black tracking-wider mt-1">{detail.full_name}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">{detail.membership_no}</p>
                                            </div>
                                        </div>
                                        <div className="mt-8 flex justify-between items-end">
                                            <div>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">SERVICES SWAPPED</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-green-500/20 text-green-300 border border-green-500/30">
                                                        📥 {detailCounts.taken} Taken
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                        📤 {detailCounts.given} Given
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">JOINED</p>
                                                <p className="text-[11px] font-bold mt-0.5">{formatDate(detail.joining_date)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contact Details Grid */}
                                    <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 space-y-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[15px]">contacts</span> Contact Directory
                                        </p>
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px]">Mobile Phone</span>
                                                <span className="font-semibold text-slate-700">{detail.phone}</span>
                                            </div>
                                            {detail.alternate_phone && (
                                                <div>
                                                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px]">Alternative Phone</span>
                                                    <span className="font-semibold text-slate-700">{detail.alternate_phone}</span>
                                                </div>
                                            )}
                                            {detail.whatsapp_number && (
                                                <div>
                                                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px]">WhatsApp Link</span>
                                                    <span className="font-semibold text-slate-700">{detail.whatsapp_number}</span>
                                                </div>
                                            )}
                                            {detail.email && (
                                                <div className="col-span-2">
                                                    <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px]">Email Address</span>
                                                    <span className="font-semibold text-slate-700 truncate block">{detail.email}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Address Profiles Grid */}
                                    {(detail.home_address || detail.business_address) && (
                                        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 space-y-3">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[15px]">location_on</span> Location Addresses
                                            </p>
                                            <div className="space-y-3 text-xs">
                                                {detail.home_address && (
                                                    <div>
                                                        <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[12px]">home</span> Residential Home Address
                                                        </span>
                                                        <span className="font-semibold text-slate-700 block mt-0.5 leading-relaxed">{detail.home_address}</span>
                                                    </div>
                                                )}
                                                {detail.business_address && (
                                                    <div>
                                                        <span className="font-bold text-slate-400 block uppercase tracking-wide text-[9px] flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[12px]">business</span> Commercial Office Address
                                                        </span>
                                                        <span className="font-semibold text-slate-700 block mt-0.5 leading-relaxed">{detail.business_address}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Business Profile details */}
                                    <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 space-y-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[15px]">storefront</span> Business Profile
                                        </p>
                                        {detail.business_name ? (
                                            <div className="space-y-2">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700">{detail.business_name}</p>
                                                    {detail.business_type && (
                                                        <p className="text-[10px] text-slate-400 mt-0.5">{detail.business_type}</p>
                                                    )}
                                                </div>
                                                {detail.business_services && (
                                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-600 leading-relaxed">
                                                        <p className="font-semibold text-slate-500 text-[9px] uppercase tracking-wide mb-1">Services Provided</p>
                                                        {detail.business_services}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">No business profile details registered for this member.</p>
                                        )}
                                    </div>

                                    {/* Details Stats */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white border border-slate-100 shadow-sm rounded-xl px-4 py-3">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Total Spend Value</p>
                                            <p className="text-base font-black text-slate-700 mt-0.5">{formatCurrency(detail.total_spent)}</p>
                                        </div>
                                        <div className="bg-white border border-slate-100 shadow-sm rounded-xl px-4 py-3">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Referred By</p>
                                            <p className="text-xs font-semibold text-slate-700 mt-1 truncate">{detail.referred_by || 'None'}</p>
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    {detail.notes && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
                                            <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider mb-1">Membership Notes</p>
                                            <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-line">{detail.notes}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeDetailTab === 'ledger' && (
                                <div className="space-y-4">
                                    {/* Service Exchange Action Form */}
                                    <form onSubmit={handleAddTransaction} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3 text-left">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest font-display">Record Service Exchange</p>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Exchange Type</label>
                                                <select 
                                                    value={txForm.exchange_type} 
                                                    onChange={e => setTxForm({...txForm, exchange_type: e.target.value as any})}
                                                    className="w-full h-8 border border-slate-200 rounded-lg px-2 text-xs outline-none focus:ring-2 focus:ring-primary/10 font-medium text-slate-600 cursor-pointer"
                                                >
                                                    <option value="taken_from_member">📥 Taken from Member (Inbound)</option>
                                                    <option value="given_to_member">📤 Given to Member (Outbound)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Equivalent Value (₹)</label>
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="E.g., 1500 (Optional)"
                                                    value={txForm.equivalent_value} 
                                                    onChange={e => setTxForm({...txForm, equivalent_value: e.target.value})} 
                                                    className="w-full h-8 border border-slate-200 rounded-lg px-2 text-xs outline-none focus:ring-2 focus:ring-primary/10 font-semibold"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Service Name / Description *</label>
                                            <input 
                                                required
                                                placeholder="E.g., Free Wheel Alignment, Printing Banners"
                                                value={txForm.service_name} 
                                                onChange={e => setTxForm({...txForm, service_name: e.target.value})} 
                                                className="w-full h-8 border border-slate-200 rounded-lg px-2 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Notes / Details</label>
                                            <textarea 
                                                rows={2}
                                                placeholder="Additional details about the exchange..."
                                                value={txForm.notes} 
                                                onChange={e => setTxForm({...txForm, notes: e.target.value})} 
                                                className="w-full border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-primary/10 text-xs resize-none"
                                            />
                                        </div>
                                        <button 
                                            type="submit" 
                                            disabled={txSaving} 
                                            className="w-full h-9 bg-primary text-white font-bold rounded-xl text-xs flex items-center justify-center hover:bg-primary-light transition disabled:opacity-60 shadow-sm"
                                        >
                                            {txSaving ? 'Saving...' : 'Log Service Exchange'}
                                        </button>
                                    </form>

                                    {/* Dual Timeline Columns */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Inbound (Taken from Member) Column */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
                                                <span className="inline-flex size-6 items-center justify-center rounded-full bg-green-500/10 text-green-600 font-bold text-xs">
                                                    📥
                                                </span>
                                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Services Taken (Inbound)</h3>
                                            </div>
                                            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                                                {memberTransactions.filter((tx: any) => tx.exchange_type === 'taken_from_member').length === 0 ? (
                                                    <p className="text-[11px] text-slate-400 italic py-4 text-center">No inbound services logged.</p>
                                                ) : (
                                                    memberTransactions
                                                        .filter((tx: any) => tx.exchange_type === 'taken_from_member')
                                                        .map((tx: any) => (
                                                            <div key={tx.id} className="bg-white border-l-4 border-l-green-500 border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <p className="text-xs font-bold text-slate-800 leading-snug">{tx.service_name}</p>
                                                                    {Number(tx.equivalent_value) > 0 && (
                                                                        <span className="shrink-0 text-[10px] font-black text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                                                                            {formatCurrency(Number(tx.equivalent_value))}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {tx.notes && (
                                                                    <p className="text-[10px] text-slate-500 mt-1 bg-slate-50 p-1.5 rounded border border-slate-100/50">{tx.notes}</p>
                                                                )}
                                                                <div className="flex justify-between items-center mt-2 text-[9px] text-slate-400">
                                                                    <span>{formatDate(tx.transaction_date)}</span>
                                                                    {tx.added_by_profile?.full_name && (
                                                                        <span className="flex items-center gap-0.5">
                                                                            👤 {tx.added_by_profile.full_name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))
                                                )}
                                            </div>
                                        </div>

                                        {/* Outbound (Given to Member) Column */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
                                                <span className="inline-flex size-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 font-bold text-xs">
                                                    📤
                                                </span>
                                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Services Given (Outbound)</h3>
                                            </div>
                                            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                                                {memberTransactions.filter((tx: any) => tx.exchange_type === 'given_to_member').length === 0 ? (
                                                    <p className="text-[11px] text-slate-400 italic py-4 text-center">No outbound services logged.</p>
                                                ) : (
                                                    memberTransactions
                                                        .filter((tx: any) => tx.exchange_type === 'given_to_member')
                                                        .map((tx: any) => (
                                                            <div key={tx.id} className="bg-white border-l-4 border-l-blue-500 border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <p className="text-xs font-bold text-slate-800 leading-snug">{tx.service_name}</p>
                                                                    {Number(tx.equivalent_value) > 0 && (
                                                                        <span className="shrink-0 text-[10px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                                                            {formatCurrency(Number(tx.equivalent_value))}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {tx.notes && (
                                                                    <p className="text-[10px] text-slate-500 mt-1 bg-slate-50 p-1.5 rounded border border-slate-100/50">{tx.notes}</p>
                                                                )}
                                                                <div className="flex justify-between items-center mt-2 text-[9px] text-slate-400">
                                                                    <span>{formatDate(tx.transaction_date)}</span>
                                                                    {tx.added_by_profile?.full_name && (
                                                                        <span className="flex items-center gap-0.5">
                                                                            👤 {tx.added_by_profile.full_name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeDetailTab === 'settings' && (
                                <div className="space-y-5">
                                    {/* Edit Member Form */}
                                    <form onSubmit={handleUpdateMember} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-4">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-left font-display">Update Membership</p>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Membership Status</label>
                                                <select 
                                                    value={editForm.status} 
                                                    onChange={e => setEditForm({...editForm, status: e.target.value as any})}
                                                    className="w-full h-9 border border-slate-200 rounded-lg px-2 text-xs outline-none focus:ring-2 focus:ring-primary/10 text-slate-600 font-semibold cursor-pointer"
                                                >
                                                    <option value="Active">Active</option>
                                                    <option value="Inactive">Inactive</option>
                                                    <option value="Suspended">Suspended</option>
                                                    <option value="Expired">Expired</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Expiry Date</label>
                                                <input 
                                                    type="date"
                                                    value={editForm.expiry_date} 
                                                    onChange={e => setEditForm({...editForm, expiry_date: e.target.value})} 
                                                    className="w-full h-9 border border-slate-200 rounded-lg px-2 text-xs outline-none focus:ring-2 focus:ring-primary/10 text-slate-600"
                                                />
                                            </div>

                                            <div className="col-span-2 border-t border-slate-100 pt-3 space-y-2">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Edit Contact & Address Info</p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">WhatsApp Number</label>
                                                        <input 
                                                            value={editForm.whatsapp_number} 
                                                            onChange={e => setEditForm({...editForm, whatsapp_number: e.target.value})} 
                                                            className="w-full h-8 border border-slate-200 rounded-lg px-2 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Alternative Phone</label>
                                                        <input 
                                                            value={editForm.alternate_phone} 
                                                            onChange={e => setEditForm({...editForm, alternate_phone: e.target.value})} 
                                                            className="w-full h-8 border border-slate-200 rounded-lg px-2 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                                        />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Home Address</label>
                                                        <input 
                                                            value={editForm.home_address} 
                                                            onChange={e => setEditForm({...editForm, home_address: e.target.value})} 
                                                            className="w-full h-8 border border-slate-200 rounded-lg px-2 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                                        />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Business Address</label>
                                                        <input 
                                                            value={editForm.business_address} 
                                                            onChange={e => setEditForm({...editForm, business_address: e.target.value})} 
                                                            className="w-full h-8 border border-slate-200 rounded-lg px-2 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="col-span-2 border-t border-slate-100 pt-3 space-y-2">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Edit Business Profile</p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Business Name</label>
                                                        <input 
                                                            value={editForm.business_name} 
                                                            onChange={e => setEditForm({...editForm, business_name: e.target.value})} 
                                                            className="w-full h-8 border border-slate-200 rounded-lg px-2 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Kind of Business</label>
                                                        <input 
                                                            value={editForm.business_type} 
                                                            onChange={e => setEditForm({...editForm, business_type: e.target.value})} 
                                                            className="w-full h-8 border border-slate-200 rounded-lg px-2 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                                        />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Services Provided</label>
                                                        <textarea 
                                                            rows={2}
                                                            value={editForm.business_services} 
                                                            onChange={e => setEditForm({...editForm, business_services: e.target.value})} 
                                                            className="w-full border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-primary/10 text-xs resize-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="col-span-2 border-t border-slate-100 pt-3">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Referred By</label>
                                                <input 
                                                    value={editForm.referred_by} 
                                                    onChange={e => setEditForm({...editForm, referred_by: e.target.value})} 
                                                    className="w-full h-9 border border-slate-200 rounded-lg px-2 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Internal Notes</label>
                                            <textarea 
                                                rows={2} 
                                                value={editForm.notes} 
                                                onChange={e => setEditForm({...editForm, notes: e.target.value})} 
                                                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/10 resize-none"
                                            />
                                        </div>

                                        <button 
                                            type="submit" 
                                            disabled={saving} 
                                            className="w-full h-9 bg-primary text-white font-bold rounded-lg text-xs flex items-center justify-center hover:bg-primary-light transition disabled:opacity-60"
                                        >
                                            {saving ? 'Saving...' : 'Save Settings'}
                                        </button>
                                    </form>

                                    {/* Delete option */}
                                    {isAdmin && (
                                        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-red-800">Danger Zone</p>
                                                <p className="text-[10px] text-red-500 mt-0.5">Remove this member from the club database.</p>
                                            </div>
                                            <button 
                                                onClick={handleDeleteMember}
                                                disabled={deleting}
                                                className="px-4 h-9 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 disabled:opacity-60"
                                            >
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                                {deleting ? 'Deleting...' : 'Delete Member'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClubMembers;
