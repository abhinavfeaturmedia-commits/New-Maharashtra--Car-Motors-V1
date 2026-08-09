import React, { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { 
    Plus, Search, Edit2, Trash2, Shield, 
    Briefcase, FileText, CheckCircle, Clock, 
    XCircle, HelpCircle, ChevronRight, TrendingUp,
    Percent, Landmark, IndianRupee, Send, Sparkles
} from 'lucide-react';

const LOAN_STATUSES = [
    { value: 'pending', label: 'Pending Docs', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    { value: 'docs_submitted', label: 'Docs Submitted', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    { value: 'bank_processing', label: 'Bank Processing', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    { value: 'approved', label: 'Approved', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { value: 'disbursed', label: 'Disbursed', color: 'bg-green-100 text-green-700 border-green-200' },
    { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200' },
    { value: 'cancelled', label: 'Cancelled', color: 'bg-slate-100 text-slate-500 border-slate-200' }
];

const INS_STATUSES = [
    { value: 'pending', label: 'Pending Quote', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    { value: 'quote_sent', label: 'Quote Sent', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    { value: 'payment_pending', label: 'Payment Pending', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    { value: 'policy_issued', label: 'Policy Issued', color: 'bg-green-100 text-green-700 border-green-200' },
    { value: 'cancelled', label: 'Cancelled', color: 'bg-slate-100 text-slate-500 border-slate-200' }
];

const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;
const formatCurrencyLakhs = (val: number) => `₹${(val / 100000).toFixed(2)}L`;

const emptyForm = {
    type: 'loan',
    customer_id: '',
    car_id: '',
    full_name: '',
    phone: '',
    email: '',
    status: 'pending',
    provider_name: '',
    amount: '',
    tenure_months: '',
    interest_rate: '',
    premium_amount: '',
    policy_number: '',
    commission_earned: '',
    notes: '',
    expiry_date: ''
};

const FinanceServices = () => {
    const { financeServices, customers, inventory, leads, refreshData } = useData();
    
    // UI State
    const [tab, setTab] = useState<'all' | 'loan' | 'insurance' | 'expiries'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    
    // Modals
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState(emptyForm);
    const [isEditMode, setIsEditMode] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
    
    // Customer Selection Helper
    const [custSearch, setCustSearch] = useState('');
    const [custSearchOpen, setCustSearchOpen] = useState(false);

    // Car Selection Helper
    const [carSearch, setCarSearch] = useState('');
    const [carSearchOpen, setCarSearchOpen] = useState(false);

    // Client Drawer Details State
    const [selectedClient, setSelectedClient] = useState<{ name: string; phone: string; email?: string } | null>(null);
    const [clientDrawerOpen, setClientDrawerOpen] = useState(false);
    const [clientDetailsLoading, setClientDetailsLoading] = useState(false);
    const [matchedCustomer, setMatchedCustomer] = useState<any | null>(null);
    const [matchedLeads, setMatchedLeads] = useState<any[]>([]);
    const [clientTimeline, setClientTimeline] = useState<any[]>([]);
    const [newNote, setNewNote] = useState('');
    const [newNoteType, setNewNoteType] = useState('note');
    const [noteSaving, setNoteSaving] = useState(false);

    // AI Underwriting Advice Logic
    const aiRecommendation = useMemo(() => {
        if (formData.type === 'loan') {
            const loanAmt = Number(formData.amount) || 0;
            if (!formData.car_id) {
                return {
                    title: "Link a Vehicle",
                    text: "Select a vehicle from the directory to get real-time bank approval matching.",
                    type: "info"
                };
            }
            const car = inventory.find(c => c.id === formData.car_id);
            if (!car) return null;
            const price = Number(car.price) || 0;
            const year = Number(car.year) || 0;
            const currentYear = new Date().getFullYear();
            const age = currentYear - year;

            if (loanAmt <= 0) {
                return {
                    title: "Enter Loan Amount",
                    text: "Input the requested loan principal to calculate LTV eligibility.",
                    type: "info"
                };
            }

            const downpayment = price - loanAmt;
            const downpaymentPercent = (downpayment / price) * 100;

            if (age > 8) {
                return {
                    title: "Risk Alert: Older Vehicle",
                    text: `This vehicle is ${age} years old. Prime banks (HDFC/ICICI) typically reject assets > 8 years old. Highly recommend NBFCs like Mahindra Finance or Shriram Finance (est. approval probability: 85%).`,
                    type: "warning"
                };
            }

            if (downpaymentPercent < 15) {
                return {
                    title: "Low Downpayment (" + Math.round(downpaymentPercent) + "% LTV)",
                    text: `Downpayment is under 15% (₹${downpayment.toLocaleString('en-IN')}). High approval risk. Recommend processing via Cholamandalam Finance or SBI (requires strong income proofs) for higher approval probability.`,
                    type: "warning"
                };
            }

            if (downpaymentPercent >= 30) {
                return {
                    title: "Prime Profile (" + Math.round(downpaymentPercent) + "% Downpayment)",
                    text: `High downpayment (₹${downpayment.toLocaleString('en-IN')}). Recommended partners: HDFC Bank or ICICI Bank for instant online approval and lowest interest rates (9.0% - 9.5%).`,
                    type: "success"
                };
            }

            return {
                title: "Standard Profile",
                text: `LTV ratio is at standard levels. Process via Axis Bank or SBI Car Loans for reliable underwriting.`,
                type: "success"
            };
        } else {
            // Insurance Add-ons Advisor
            if (!formData.car_id) {
                return {
                    title: "Link a Vehicle",
                    text: "Select a vehicle from the directory to suggest optional add-on covers.",
                    type: "info"
                };
            }
            const car = inventory.find(c => c.id === formData.car_id);
            if (!car) return null;
            const year = Number(car.year) || 0;
            const currentYear = new Date().getFullYear();
            const age = currentYear - year;

            if (age < 3) {
                return {
                    title: "New Vehicle Cover Package",
                    text: "Highly recommended add-ons: Zero Depreciation + Engine Protection + Return to Invoice (RTI) cover to secure full showroom invoice value in case of total loss.",
                    type: "success"
                };
            }

            if (age >= 3 && age <= 7) {
                return {
                    title: "Mid-Age Vehicle Package",
                    text: "Recommended add-ons: Zero Depreciation (standard parts cover) + Roadside Assistance (RSA) + Consumables Cover for cost-effective protection.",
                    type: "success"
                };
            }

            return {
                title: "Older Vehicle Package",
                text: "Zero Depreciation is not cost-effective for vehicles > 7 years. Recommend a standard Comprehensive policy with Third-Party liability + Personal Accident (PA) Cover.",
                type: "info"
            };
        }
    }, [formData.type, formData.amount, formData.car_id, inventory]);

    // Compute Filtered Files
    const filteredFiles = useMemo(() => {
        return financeServices.filter(file => {
            // Tab Filter
            if (tab === 'expiries') {
                if (file.type !== 'insurance') return false;
                if (!file.expiry_date) return false;
                const expDate = new Date(file.expiry_date);
                const today = new Date();
                const diffTime = expDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays >= -30 && diffDays <= 30; // Expiring in next 30 days or expired in last 30 days
            } else if (tab !== 'all' && file.type !== tab) {
                return false;
            }
            
            // Status Filter
            if (statusFilter !== 'all' && file.status !== statusFilter) return false;
            
            // Search Query
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const nameMatch = file.full_name?.toLowerCase().includes(query) || file.customer?.full_name?.toLowerCase().includes(query);
                const phoneMatch = file.phone?.includes(query);
                const providerMatch = file.provider_name?.toLowerCase().includes(query);
                const policyMatch = file.policy_number?.toLowerCase().includes(query);
                return nameMatch || phoneMatch || providerMatch || policyMatch;
            }
            
            return true;
        });
    }, [financeServices, tab, statusFilter, searchQuery]);

    // Compute Stats
    const stats = useMemo(() => {
        const loans = financeServices.filter(f => f.type === 'loan');
        const ins = financeServices.filter(f => f.type === 'insurance');
        
        const activeLoansCount = loans.filter(l => ['docs_submitted', 'bank_processing', 'approved'].includes(l.status)).length;
        const totalApprovedLoansVal = loans.filter(l => l.status === 'disbursed').reduce((acc, l) => acc + Number(l.amount || 0), 0);
        const totalInsPremiumVal = ins.filter(i => i.status === 'policy_issued').reduce((acc, i) => acc + Number(i.premium_amount || 0), 0);
        const totalCommissionsVal = financeServices.reduce((acc, f) => acc + Number(f.commission_earned || 0), 0);

        return {
            activeLoansCount,
            totalApprovedLoansVal,
            totalInsPremiumVal,
            totalCommissionsVal
        };
    }, [financeServices]);

    // Handle Edit Trigger
    const openEditModal = (file: any) => {
        setIsEditMode(true);
        setActiveId(file.id);
        setFormData({
            type: file.type,
            customer_id: file.customer_id || '',
            car_id: file.car_id || '',
            full_name: file.full_name,
            phone: file.phone,
            email: file.email || '',
            status: file.status,
            provider_name: file.provider_name || '',
            amount: file.amount ? String(file.amount) : '',
            tenure_months: file.tenure_months ? String(file.tenure_months) : '',
            interest_rate: file.interest_rate ? String(file.interest_rate) : '',
            premium_amount: file.premium_amount ? String(file.premium_amount) : '',
            policy_number: file.policy_number || '',
            commission_earned: file.commission_earned ? String(file.commission_earned) : '',
            notes: file.notes || '',
            expiry_date: file.expiry_date || ''
        });
        
        // Setup selectors
        if (file.customer_id) {
            const cust = customers.find(c => c.id === file.customer_id);
            setCustSearch(cust ? `${cust.full_name} (${cust.phone})` : '');
        } else {
            setCustSearch('');
        }
        
        if (file.car_id) {
            const car = inventory.find(i => i.id === file.car_id);
            setCarSearch(car ? `${car.year} ${car.make} ${car.model}` : '');
        } else {
            setCarSearch('');
        }
        
        setIsFormOpen(true);
    };

    // Handle Open New Modal
    const openNewModal = (type: 'loan' | 'insurance') => {
        setIsEditMode(false);
        setActiveId(null);
        setFormData({ ...emptyForm, type });
        setCustSearch('');
        setCarSearch('');
        setIsFormOpen(true);
    };

    // Save Form
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.full_name || !formData.phone) {
            alert('Please provide Name and Phone.');
            return;
        }

        setIsSaving(true);
        const payload: any = {
            type: formData.type,
            customer_id: formData.customer_id || null,
            car_id: formData.car_id || null,
            full_name: formData.full_name,
            phone: formData.phone,
            email: formData.email || null,
            status: formData.status,
            provider_name: formData.provider_name || null,
            amount: formData.amount ? Number(formData.amount) : null,
            tenure_months: formData.tenure_months ? parseInt(formData.tenure_months) : null,
            interest_rate: formData.interest_rate ? Number(formData.interest_rate) : null,
            premium_amount: formData.premium_amount ? Number(formData.premium_amount) : null,
            policy_number: formData.policy_number || null,
            commission_earned: formData.commission_earned ? Number(formData.commission_earned) : 0,
            notes: formData.notes || null,
            expiry_date: formData.expiry_date || null
        };

        try {
            if (isEditMode && activeId) {
                const { error } = await supabase.from('finance_services').update(payload).eq('id', activeId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('finance_services').insert(payload);
                if (error) throw error;
            }

            await refreshData();
            setIsFormOpen(false);
        } catch (error: any) {
            console.error('Error saving finance service:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Delete File
    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this service file?')) return;
        try {
            const { error } = await supabase.from('finance_services').delete().eq('id', id);
            if (error) throw error;
            await refreshData();
        } catch (error: any) {
            console.error('Error deleting service file:', error);
            alert(`Delete failed: ${error.message}`);
        }
    };

    // Fetch Client Details & 360 Timeline
    const fetchClientDetails = async (client: { name: string; phone: string; email?: string }) => {
        setClientDetailsLoading(true);
        try {
            const { data: custData } = await supabase
                .from('customers')
                .select('*')
                .eq('phone', client.phone)
                .maybeSingle();
            
            setMatchedCustomer(custData);

            const { data: leadsData } = await supabase
                .from('leads')
                .select('*')
                .eq('phone', client.phone);
            
            setMatchedLeads(leadsData || []);

            const events: any[] = [];

            if (leadsData) {
                leadsData.forEach((l: any) => {
                    events.push({
                        id: `lead-${l.id}`,
                        type: 'lead',
                        title: `Enquiry: ${l.type?.replace('_', ' ').toUpperCase() || 'GENERAL'}`,
                        description: l.message || 'General enquiry received.',
                        date: new Date(l.created_at),
                        icon: l.type === 'insurance' ? 'shield' : 'file-text',
                        color: 'text-blue-500 bg-blue-50 border-blue-100'
                    });
                });
            }

            if (leadsData && leadsData.length > 0) {
                const leadIds = leadsData.map(l => l.id);
                const { data: leadActs } = await supabase
                    .from('lead_activities')
                    .select('*')
                    .in('lead_id', leadIds);
                
                if (leadActs) {
                    leadActs.forEach((act: any) => {
                        events.push({
                            id: `act-${act.id}`,
                            type: 'activity',
                            title: `Lead Log: ${act.activity_type?.toUpperCase()}`,
                            description: act.notes || '',
                            date: new Date(act.created_at),
                            icon: 'message-square',
                            color: 'text-amber-500 bg-amber-50 border-amber-100'
                        });
                    });
                }
            }

            if (custData) {
                const { data: followUpsData } = await supabase
                    .from('follow_ups')
                    .select('*')
                    .eq('customer_id', custData.id);
                
                if (followUpsData) {
                    followUpsData.forEach((f: any) => {
                        events.push({
                            id: `fu-${f.id}`,
                            type: 'follow_up',
                            title: `CRM Log: ${f.type?.toUpperCase() || 'NOTE'}`,
                            description: f.notes || 'No description',
                            date: new Date(f.created_at),
                            icon: f.type === 'call' ? 'phone' : f.type === 'whatsapp' ? 'message-square' : 'file-text',
                            color: 'text-indigo-500 bg-indigo-50 border-indigo-100'
                        });
                    });
                }
            }

            events.sort((a, b) => b.date.getTime() - a.date.getTime());
            setClientTimeline(events);
        } catch (error) {
            console.error("Error fetching client details:", error);
        } finally {
            setClientDetailsLoading(false);
        }
    };

    // Add Client Activity Note
    const handleAddClientNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNote.trim() || !selectedClient) return;
        setNoteSaving(true);
        try {
            if (matchedCustomer) {
                const { error } = await supabase.from('follow_ups').insert({
                    customer_id: matchedCustomer.id,
                    type: newNoteType,
                    notes: newNote.trim(),
                    status: 'completed',
                    next_followup_date: new Date().toISOString().split('T')[0]
                });
                if (error) throw error;
            } else if (matchedLeads.length > 0) {
                const { error } = await supabase.from('lead_activities').insert({
                    lead_id: matchedLeads[0].id,
                    activity_type: newNoteType === 'note' ? 'meeting' : newNoteType,
                    notes: newNote.trim()
                });
                if (error) throw error;
            } else {
                const { data: custData, error: custErr } = await supabase.from('customers').insert({
                    full_name: selectedClient.name,
                    phone: selectedClient.phone,
                    email: selectedClient.email || null,
                    notes: 'Auto-created during note logging.'
                }).select('id').single();
                
                if (custErr) throw custErr;
                
                const { error } = await supabase.from('follow_ups').insert({
                    customer_id: custData.id,
                    type: newNoteType,
                    notes: newNote.trim(),
                    status: 'completed',
                    next_followup_date: new Date().toISOString().split('T')[0]
                });
                if (error) throw error;
            }

            setNewNote('');
            alert('Note added successfully!');
            fetchClientDetails(selectedClient);
        } catch (error: any) {
            console.error("Error saving note:", error);
            alert(`Failed to save note: ${error.message}`);
        } finally {
            setNoteSaving(false);
        }
    };

    // Auto-Register Customer Profile
    const handleCreateCustomerProfile = async () => {
        if (!selectedClient) return;
        setClientDetailsLoading(true);
        try {
            const { data, error } = await supabase.from('customers').insert({
                full_name: selectedClient.name,
                phone: selectedClient.phone,
                email: selectedClient.email || null,
                loyalty_status: 'silver'
            }).select('*').single();
            if (error) throw error;
            
            setMatchedCustomer(data);
            alert('Customer profile created successfully!');
            fetchClientDetails(selectedClient);
        } catch (error: any) {
            console.error("Error creating customer profile:", error);
            alert(`Failed: ${error.message}`);
        } finally {
            setClientDetailsLoading(false);
        }
    };

    const getStatusBadge = (type: string, status: string) => {
        const statuses = type === 'loan' ? LOAN_STATUSES : INS_STATUSES;
        const config = statuses.find(s => s.value === status) || { label: status, color: 'bg-slate-100 text-slate-600' };
        return (
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border uppercase shrink-0 ${config.color}`}>
                {config.label}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Finance & Insurance Services</h1>
                    <p className="text-slate-500 text-sm">Process, tracks, and manages customer loans and vehicle insurance contracts.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button
                        onClick={() => openNewModal('loan')}
                        className="h-10 px-4 bg-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-primary-light transition-all shadow-sm"
                    >
                        <Plus size={15} /> New Loan Case
                    </button>
                    <button
                        onClick={() => openNewModal('insurance')}
                        className="h-10 px-4 bg-accent text-primary text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-amber-500 transition-all shadow-sm"
                    >
                        <Plus size={15} /> New Insurance Case
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)]">
                    <div className="size-9 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-600 mb-2">
                        <Clock size={18} />
                    </div>
                    <p className="text-xl font-black text-primary font-display">{stats.activeLoansCount}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Active Loan Files</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)]">
                    <div className="size-9 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-600 mb-2">
                        <Landmark size={18} />
                    </div>
                    <p className="text-xl font-black text-primary font-display">{formatCurrencyLakhs(stats.totalApprovedLoansVal)}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Total Disbursed Loans</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)]">
                    <div className="size-9 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-600 mb-2">
                        <Shield size={18} />
                    </div>
                    <p className="text-xl font-black text-primary font-display">{formatCurrencyLakhs(stats.totalInsPremiumVal)}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Insurance Premium Issued</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)]">
                    <div className="size-9 rounded-xl flex items-center justify-center bg-purple-500/10 text-purple-600 mb-2">
                        <TrendingUp size={18} />
                    </div>
                    <p className="text-xl font-black text-primary font-display">{formatCurrency(stats.totalCommissionsVal)}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Total Commission Earned</p>
                </div>
            </div>

            {/* Filter Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-2">
                {/* Tabs */}
                <div className="flex gap-1">
                    {([
                        { id: 'all', label: 'All Services' },
                        { id: 'loan', label: 'Loans' },
                        { id: 'insurance', label: 'Insurance Policies' },
                        { id: 'expiries', label: 'Upcoming Expiries (30 Days)' }
                    ] as const).map(t => (
                        <button
                            key={t.id}
                            onClick={() => { setTab(t.id); setStatusFilter('all'); }}
                            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                                tab === t.id ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Search & Actions */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search client, policy, provider..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full h-9 pl-9 pr-4 text-xs border border-slate-200 rounded-lg outline-none bg-white focus:border-primary"
                        />
                    </div>

                    {/* Status filter */}
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="h-9 px-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-semibold outline-none cursor-pointer"
                    >
                        <option value="all">All Statuses</option>
                        {tab === 'all' && (
                            <>
                                <option value="pending">Pending / New</option>
                                <option value="bank_processing">Processing</option>
                                <option value="approved">Approved</option>
                                <option value="disbursed">Disbursed / Issued</option>
                                <option value="rejected">Rejected</option>
                                <option value="cancelled">Cancelled</option>
                            </>
                        )}
                        {tab === 'loan' && LOAN_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        {tab === 'insurance' && INS_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-x-auto">
                <table className="w-full min-w-[900px]">
                    <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50/50">
                            <th className="text-left px-5 py-3">Client Details</th>
                            <th className="text-left px-5 py-3">Service Type</th>
                            <th className="text-left px-5 py-3">Vehicle Details</th>
                            <th className="text-left px-5 py-3">Provider & ID</th>
                            <th className="text-left px-5 py-3">Financial Context</th>
                            <th className="text-left px-5 py-3">Commission</th>
                            <th className="text-left px-5 py-3">Status</th>
                            <th className="text-center px-5 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredFiles.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                                    No finance or insurance records match your criteria.
                                </td>
                            </tr>
                        )}
                        {filteredFiles.map(file => (
                            <tr key={file.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                {/* Client */}
                                <td className="px-5 py-3.5">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const client = { name: file.full_name, phone: file.phone, email: file.email };
                                            setSelectedClient(client);
                                            fetchClientDetails(client);
                                            setClientDrawerOpen(true);
                                        }}
                                        className="text-left hover:text-blue-600 transition-colors group focus:outline-none"
                                    >
                                        <div className="font-bold text-sm text-primary group-hover:underline flex items-center gap-1">
                                            {file.full_name}
                                            <span className="material-symbols-outlined text-[12px] opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                                        </div>
                                        <div className="text-xs text-slate-400">{file.phone} {file.email ? `• ${file.email}` : ''}</div>
                                    </button>
                                </td>
                                
                                {/* Service Type */}
                                <td className="px-5 py-3.5">
                                    {file.type === 'loan' ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                                            <Landmark size={12} /> Loan
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                                            <Shield size={12} /> Insurance
                                        </span>
                                    )}
                                </td>

                                {/* Vehicle */}
                                <td className="px-5 py-3.5 text-xs text-slate-700">
                                    {file.car ? (
                                        <>
                                            <span className="font-semibold">{file.car.year} {file.car.make} {file.car.model}</span>
                                            <div className="text-[10px] text-slate-400 font-mono">Stock: {file.car.registration_no || 'No Reg'}</div>
                                        </>
                                    ) : (
                                        <span className="text-slate-400">—</span>
                                    )}
                                </td>

                                {/* Provider */}
                                <td className="px-5 py-3.5 text-xs">
                                    <div className="font-semibold text-slate-700">{file.provider_name || 'Not assigned'}</div>
                                    {file.type === 'insurance' && file.policy_number && (
                                        <div className="text-[10px] text-slate-400 font-mono">Policy: {file.policy_number}</div>
                                    )}
                                    {file.type === 'insurance' && file.expiry_date && (
                                        <div className="text-[10px] text-red-500 font-semibold flex items-center gap-1 mt-0.5">
                                            <Clock size={10} /> Exp: {new Date(file.expiry_date).toLocaleDateString('en-IN')}
                                        </div>
                                    )}
                                </td>

                                {/* Financial Info */}
                                <td className="px-5 py-3.5 text-xs text-slate-700">
                                    {file.type === 'loan' ? (
                                        <>
                                            <div>Amt: <span className="font-bold">{file.amount ? formatCurrency(file.amount) : '—'}</span></div>
                                            {file.interest_rate && (
                                                <div className="text-[10px] text-slate-400">
                                                    Rate: {file.interest_rate}% • {file.tenure_months}M
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div>Premium: <span className="font-bold">{file.premium_amount ? formatCurrency(file.premium_amount) : '—'}</span></div>
                                            {file.amount && (
                                                <div className="text-[10px] text-slate-400">IDV: {formatCurrency(file.amount)}</div>
                                            )}
                                        </>
                                    )}
                                </td>

                                {/* Commission */}
                                <td className="px-5 py-3.5 text-xs text-slate-700 font-semibold">
                                    {file.commission_earned ? formatCurrency(file.commission_earned) : '₹0'}
                                </td>

                                {/* Status */}
                                <td className="px-5 py-3.5">
                                    {getStatusBadge(file.type, file.status)}
                                </td>

                                {/* Actions */}
                                <td className="px-5 py-3.5">
                                    <div className="flex items-center justify-center gap-1.5">
                                        {file.type === 'insurance' && file.expiry_date && (() => {
                                            const expDate = new Date(file.expiry_date);
                                            const today = new Date();
                                            const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                            const isUpcoming = diffDays >= -30 && diffDays <= 30;
                                            
                                            if (isUpcoming) {
                                                const message = encodeURIComponent(
                                                    `Hello ${file.full_name}, this is New Maharashtra Motors. We noticed that your insurance policy (${file.policy_number || 'N/A'}) for your vehicle is expiring on ${expDate.toLocaleDateString('en-IN')}. Let's renew this to avoid coverage gaps. Please reply to proceed.`
                                                );
                                                const whatsappUrl = `https://wa.me/91${file.phone.replace(/[^0-9]/g, '')}?text=${message}`;
                                                
                                                return (
                                                    <a
                                                        href={whatsappUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-1.5 hover:bg-green-50 text-green-500 hover:text-green-600 rounded-lg transition-colors flex items-center justify-center"
                                                        title="Send WhatsApp Renewal Reminder"
                                                    >
                                                        <Send size={13} />
                                                    </a>
                                                );
                                            }
                                            return null;
                                        })()}
                                        <button
                                            onClick={() => openEditModal(file)}
                                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-primary rounded-lg transition-colors"
                                            title="Edit Case"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(file.id)}
                                            className="p-1.5 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition-colors"
                                            title="Delete Case"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add / Edit Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 bg-primary text-white flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="font-bold font-display text-base">
                                    {isEditMode ? `Edit ${formData.type === 'loan' ? 'Loan' : 'Insurance'} File` : `New ${formData.type === 'loan' ? 'Loan' : 'Insurance'} Case`}
                                </h3>
                                <p className="text-[11px] text-slate-300">Fill in the contract information and financial status.</p>
                            </div>
                            <button
                                onClick={() => setIsFormOpen(false)}
                                className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>

                        {/* Modal Body / Scrollable Form */}
                        <form onSubmit={handleSave} className="overflow-y-auto p-6 space-y-4 flex-1">
                            {/* Personal Details */}
                            <div className="border-b border-slate-100 pb-3">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Client Information</h4>
                                
                                {/* Smart Customer Selector */}
                                <div className="mb-3 relative">
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Search Existing Customer or Lead (Optional)</label>
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={custSearch}
                                            onChange={e => {
                                                setCustSearch(e.target.value);
                                                setCustSearchOpen(true);
                                                if (formData.customer_id) {
                                                    setFormData(f => ({ ...f, customer_id: '', full_name: '', phone: '', email: '' }));
                                                }
                                            }}
                                            onFocus={() => setCustSearchOpen(true)}
                                            onBlur={() => setTimeout(() => setCustSearchOpen(false), 200)}
                                            placeholder="Search by name, phone, or email in customers & leads..."
                                            className="w-full h-10 pl-8 border border-slate-200 rounded-xl text-xs outline-none bg-white focus:border-primary"
                                        />
                                    </div>

                                    {custSearchOpen && (
                                        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                                            {(() => {
                                                const search = custSearch.toLowerCase();
                                                const matchedCustomers = customers.filter(c => 
                                                    c.full_name.toLowerCase().includes(search) || 
                                                    c.phone.includes(search) ||
                                                    (c.email && c.email.toLowerCase().includes(search))
                                                ).map(c => ({ ...c, isLead: false }));

                                                const matchedLeads = leads.filter(l => 
                                                    (l.full_name && l.full_name.toLowerCase().includes(search)) || 
                                                    (l.phone && l.phone.includes(search)) ||
                                                    (l.email && l.email.toLowerCase().includes(search))
                                                ).map(l => ({ ...l, isLead: true }));

                                                const combined = [...matchedCustomers, ...matchedLeads].slice(0, 15);

                                                if (combined.length === 0) {
                                                    return (
                                                        <div className="px-4 py-3 text-xs text-slate-400 text-center">No customers or leads match your query</div>
                                                    );
                                                }

                                                return combined.map(item => (
                                                    <button
                                                        key={`${item.isLead ? 'lead' : 'cust'}-${item.id}`}
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData(f => ({
                                                                ...f,
                                                                customer_id: item.isLead ? '' : item.id,
                                                                full_name: item.full_name || '',
                                                                phone: item.phone || '',
                                                                email: item.email || ''
                                                            }));
                                                            setCustSearch(`${item.full_name} (${item.phone})${item.isLead ? ' [Lead]' : ' [Customer]'}`);
                                                            setCustSearchOpen(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs border-b last:border-0 text-slate-700 flex justify-between items-center"
                                                    >
                                                        <div>
                                                            <div className="font-bold text-primary">{item.full_name}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono">{item.phone} {item.email ? `• ${item.email}` : ''}</div>
                                                        </div>
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                                            item.isLead ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                                        }`}>
                                                            {item.isLead ? `Lead: ${item.type || 'contact'}` : 'Customer'}
                                                        </span>
                                                    </button>
                                                ));
                                            })()}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Full Name *</label>
                                        <input
                                            required
                                            type="text"
                                            value={formData.full_name}
                                            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                            className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:border-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Phone Number *</label>
                                        <input
                                            required
                                            type="tel"
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:border-primary"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Email (Optional)</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:border-primary"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Service / Financial Details */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Service Details</h4>
                                
                                {/* Smart Inventory Car Selector */}
                                <div className="mb-3 relative">
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Select Car Linkage (Optional)</label>
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={carSearch}
                                            onChange={e => {
                                                setCarSearch(e.target.value);
                                                setCarSearchOpen(true);
                                                if (formData.car_id) {
                                                    setFormData(f => ({ ...f, car_id: '' }));
                                                }
                                            }}
                                            onFocus={() => setCarSearchOpen(true)}
                                            onBlur={() => setTimeout(() => setCarSearchOpen(false), 200)}
                                            placeholder="Search inventory by make, model, registration number..."
                                            className="w-full h-10 pl-8 border border-slate-200 rounded-xl text-xs outline-none bg-white focus:border-primary"
                                        />
                                    </div>

                                    {carSearchOpen && (
                                        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                                            {inventory.filter(car => 
                                                `${car.year} ${car.make} ${car.model}`.toLowerCase().includes(carSearch.toLowerCase()) || 
                                                (car.registration_no || '').toLowerCase().includes(carSearch.toLowerCase())
                                            ).map(car => (
                                                <button
                                                    key={car.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData(f => ({ ...f, car_id: car.id }));
                                                        setCarSearch(`${car.year} ${car.make} ${car.model} (${car.registration_no || 'No Reg'})`);
                                                        setCarSearchOpen(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs border-b last:border-0 text-slate-700"
                                                >
                                                    <div className="font-bold">{car.year} {car.make} {car.model}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">
                                                        ₹{Number(car.price).toLocaleString('en-IN')} • Reg: {car.registration_no || 'No Reg'}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {/* Loan Specific Fields */}
                                    {formData.type === 'loan' ? (
                                        <>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Bank Name / Provider</label>
                                                <input
                                                    type="text"
                                                    value={formData.provider_name}
                                                    onChange={e => setFormData({ ...formData, provider_name: e.target.value })}
                                                    placeholder="e.g. HDFC Bank, SBI"
                                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:border-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Loan Amount (Principal)</label>
                                                <input
                                                    type="number"
                                                    value={formData.amount}
                                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                                    placeholder="₹ Principal Amount"
                                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:border-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Loan Tenure (Months)</label>
                                                <input
                                                    type="number"
                                                    value={formData.tenure_months}
                                                    onChange={e => setFormData({ ...formData, tenure_months: e.target.value })}
                                                    placeholder="e.g. 36, 60"
                                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:border-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Interest Rate (%)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.interest_rate}
                                                    onChange={e => setFormData({ ...formData, interest_rate: e.target.value })}
                                                    placeholder="e.g. 9.50"
                                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:border-primary"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        /* Insurance Specific Fields */
                                        <>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Insurer Name / Provider</label>
                                                <input
                                                    type="text"
                                                    value={formData.provider_name}
                                                    onChange={e => setFormData({ ...formData, provider_name: e.target.value })}
                                                    placeholder="e.g. TATA AIG, ICICI Lombard"
                                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:border-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Premium Amount</label>
                                                <input
                                                    type="number"
                                                    value={formData.premium_amount}
                                                    onChange={e => setFormData({ ...formData, premium_amount: e.target.value })}
                                                    placeholder="₹ Policy Premium"
                                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:border-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Policy Number</label>
                                                <input
                                                    type="text"
                                                    value={formData.policy_number}
                                                    onChange={e => setFormData({ ...formData, policy_number: e.target.value })}
                                                    placeholder="Insurer Policy ID"
                                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:border-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Insurance IDV / Value Cover</label>
                                                <input
                                                    type="number"
                                                    value={formData.amount}
                                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                                    placeholder="₹ Declared Value Cover"
                                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:border-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Insurance Expiry Date</label>
                                                <input
                                                    type="date"
                                                    value={formData.expiry_date}
                                                    onChange={e => setFormData({ ...formData, expiry_date: e.target.value })}
                                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:border-primary"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* Status & Commission */}
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Commission Earned (₹)</label>
                                        <input
                                            type="number"
                                            value={formData.commission_earned}
                                            onChange={e => setFormData({ ...formData, commission_earned: e.target.value })}
                                            placeholder="Swami Motors Profit"
                                            className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:border-primary font-bold text-green-600 bg-green-50/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Processing Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                                            className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none bg-white focus:border-primary cursor-pointer"
                                        >
                                            {formData.type === 'loan' ? (
                                                LOAN_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)
                                            ) : (
                                                INS_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)
                                            )}
                                        </select>
                                    </div>

                                    {/* Notes */}
                                    <div className="col-span-2">
                                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Administrative Notes</label>
                                        <textarea
                                            rows={3}
                                            value={formData.notes}
                                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                            placeholder="Add updates or tracking codes..."
                                            className="w-full border border-slate-200 rounded-xl p-3 text-xs outline-none focus:border-primary"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* AI Advisor Panel */}
                            {aiRecommendation && (
                                <div className={`p-4 rounded-2xl border text-xs leading-relaxed animate-in fade-in duration-200 ${
                                    aiRecommendation.type === 'warning' 
                                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                                        : aiRecommendation.type === 'success'
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                            : 'bg-blue-50 border-blue-200 text-blue-800'
                                }`}>
                                    <div className="flex items-center gap-2 mb-1.5 font-bold">
                                        <Sparkles size={14} className={
                                            aiRecommendation.type === 'warning'
                                                ? 'text-amber-500'
                                                : aiRecommendation.type === 'success'
                                                    ? 'text-emerald-500'
                                                    : 'text-blue-500'
                                        } />
                                        <span className="uppercase tracking-wide text-[10px]">AI Underwriting Advisor: {aiRecommendation.title}</span>
                                    </div>
                                    <p className="text-slate-600 font-medium">{aiRecommendation.text}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    className="h-10 px-5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="h-10 px-6 bg-primary text-white font-bold rounded-xl text-xs hover:bg-primary-light transition-colors flex items-center justify-center gap-1.5"
                                >
                                    {isSaving ? (
                                        <span className="size-3 animate-spin border-2 border-white/30 border-t-white rounded-full" />
                                    ) : 'Save Details'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Client Details Slide-over Drawer */}
            {clientDrawerOpen && selectedClient && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" 
                        onClick={() => setClientDrawerOpen(false)}
                    />
                    
                    {/* Drawer Content */}
                    <div className="relative w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-display">Client Details Hub</span>
                                <h3 className="text-lg font-black text-primary font-display flex items-center gap-2 mt-0.5">
                                    {selectedClient.name}
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                                        matchedCustomer ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-amber-100 text-amber-800 border-amber-200'
                                    }`}>
                                        {matchedCustomer ? `${matchedCustomer.loyalty_status || 'Customer'} Member` : 'Lead Only'}
                                    </span>
                                </h3>
                            </div>
                            <button 
                                onClick={() => setClientDrawerOpen(false)}
                                className="size-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        {/* Body - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-5 gap-6">
                            {/* Left Panel: Information Card (2/5 size) */}
                            <div className="md:col-span-2 space-y-5">
                                {/* Profile Info */}
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 font-display">
                                        <Briefcase size={12} /> Contact Profile
                                    </h4>
                                    
                                    <div className="space-y-2 text-xs">
                                        <div>
                                            <span className="text-slate-400 block text-[10px] font-semibold">Mobile Phone</span>
                                            <a href={`tel:${selectedClient.phone}`} className="font-bold text-primary hover:underline flex items-center gap-1">
                                                {selectedClient.phone}
                                            </a>
                                        </div>
                                        {selectedClient.email && (
                                            <div>
                                                <span className="text-slate-400 block text-[10px] font-semibold">Email Address</span>
                                                <a href={`mailto:${selectedClient.email}`} className="font-semibold text-slate-600 hover:underline">
                                                    {selectedClient.email}
                                                </a>
                                            </div>
                                        )}
                                        {matchedCustomer && (
                                            <>
                                                {matchedCustomer.alternate_phone && (
                                                    <div>
                                                        <span className="text-slate-400 block text-[10px] font-semibold">Alternate Phone</span>
                                                        <span className="font-semibold text-slate-600">{matchedCustomer.alternate_phone}</span>
                                                    </div>
                                                )}
                                                {matchedCustomer.address && (
                                                    <div>
                                                        <span className="text-slate-400 block text-[10px] font-semibold">Home Address</span>
                                                        <span className="font-semibold text-slate-600 block leading-relaxed">{matchedCustomer.address}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {!matchedCustomer && !clientDetailsLoading && (
                                        <button
                                            type="button"
                                            onClick={handleCreateCustomerProfile}
                                            className="w-full h-9 bg-primary hover:bg-primary-light text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1"
                                        >
                                            <Plus size={14} /> Register Customer Profile
                                        </button>
                                    )}
                                </div>

                                {/* Active Service Files Summary */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 font-display">
                                        <Landmark size={12} /> Financial Files
                                    </h4>
                                    <div className="space-y-2">
                                        {financeServices.filter(f => f.phone === selectedClient.phone).map(f => (
                                            <div key={f.id} className="p-3 border border-slate-100 bg-white rounded-xl shadow-sm flex items-center justify-between gap-2">
                                                <div>
                                                    <p className="text-xs font-bold text-primary capitalize">{f.type === 'loan' ? 'Car Loan' : 'Car Insurance'}</p>
                                                    <p className="text-[10px] text-slate-400">{f.provider_name || 'N/A'}</p>
                                                </div>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                                                    f.type === 'loan'
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                    {f.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right Panel: Activities and Notes (3/5 size) */}
                            <div className="md:col-span-3 flex flex-col h-full space-y-5">
                                {/* Note Form */}
                                <form onSubmit={handleAddClientNote} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3 shrink-0">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 font-display">
                                        <FileText size={12} /> Log Interaction Note
                                    </h4>
                                    
                                    <div className="flex gap-2">
                                        {([
                                            { id: 'note', label: 'General Note' },
                                            { id: 'call', label: 'Call Log' },
                                            { id: 'whatsapp', label: 'WhatsApp' }
                                        ] as const).map(n => (
                                            <button
                                                key={n.id}
                                                type="button"
                                                onClick={() => setNewNoteType(n.id)}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                                                    newNoteType === n.id
                                                        ? 'bg-primary text-white border-primary shadow-sm'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                {n.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="relative">
                                        <textarea
                                            required
                                            rows={3}
                                            value={newNote}
                                            onChange={e => setNewNote(e.target.value)}
                                            placeholder="Write summary of the call or interaction details..."
                                            className="w-full border border-slate-200 rounded-xl p-3 text-xs outline-none bg-white focus:border-primary shadow-inner"
                                        />
                                    </div>

                                    <div className="flex justify-end">
                                        <button
                                            type="submit"
                                            disabled={noteSaving}
                                            className="h-8 px-4 bg-primary hover:bg-primary-light text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                                        >
                                            {noteSaving ? <span className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Log Activity'}
                                        </button>
                                    </div>
                                </form>

                                {/* Timeline */}
                                <div className="flex-1 flex flex-col min-h-[250px]">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5 shrink-0 font-display">
                                        <Clock size={12} /> Activity History
                                    </h4>
                                    
                                    <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[300px]">
                                        {clientDetailsLoading ? (
                                            <div className="space-y-3 animate-pulse">
                                                {[1, 2].map(i => <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl h-16 w-full" />)}
                                            </div>
                                        ) : clientTimeline.length === 0 ? (
                                            <div className="text-center text-slate-400 py-10 text-xs font-medium">
                                                No activity records found for this client.
                                            </div>
                                        ) : (
                                            <div className="relative border-l-2 border-slate-100 pl-4 ml-2 space-y-4">
                                                {clientTimeline.map((item, idx) => (
                                                    <div key={item.id} className="relative">
                                                        <div className="absolute -left-[23px] top-1 bg-white p-0.5 rounded-full">
                                                            <div className="size-2 bg-slate-300 rounded-full" />
                                                        </div>
                                                        <div className="text-xs bg-slate-50 border border-slate-100/50 rounded-xl p-3 shadow-sm">
                                                            <div className="flex justify-between items-start gap-2 mb-1">
                                                                <span className="font-bold text-primary block">{item.title}</span>
                                                                <span className="text-[9px] text-slate-400 font-mono">
                                                                    {item.date.toLocaleDateString('en-IN')} {item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <p className="text-slate-500 leading-relaxed">{item.description}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceServices;
