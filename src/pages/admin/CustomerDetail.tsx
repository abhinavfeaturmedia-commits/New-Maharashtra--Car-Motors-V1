import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { toWhatsAppUrl } from '../../lib/utils';
import { compressPdf, autoCompressPdf } from '../../lib/pdfCompressor';
import { compressImage, autoCompressImage } from '../../lib/imageCompressor';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface CustomerDeal {
    id: string;
    customer_id: string;
    seller_customer_id: string | null;
    inventory_id: string | null;
    lead_id: string | null;
    sale_id: string | null;
    deal_type: 'purchase' | 'sell_to_us' | 'exchange' | 'consignment';
    deal_status: 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
    inquiry_date: string | null;
    deal_date: string | null;
    rto_date: string | null;
    delivery_date: string | null;
    handover_date: string | null;
    hypothecation_clearance_date: string | null;
    total_amount: number | null;
    advance_paid: number | null;
    balance_due: number | null;
    payment_mode: string | null;
    notes: string | null;
    internal_notes: string | null;
    created_at: string;
    car?: { make: string; model: string; year: number; registration_no: string | null } | null;
    lead?: { full_name: string; status: string } | null;
}

interface CustomerDocument {
    id: string;
    customer_id: string;
    deal_id: string | null;
    doc_type: string;
    doc_label: string | null;
    party_role: 'buyer' | 'seller' | 'general';
    file_name: string | null;
    file_url: string | null;
    file_size_kb: number | null;
    issue_date: string | null;
    expiry_date: string | null;
    is_verified: boolean;
    notes: string | null;
    created_at: string;
    uploaded_by_profile?: { full_name: string | null } | null;
}

interface TimelineEvent {
    id: string;
    type: string;
    title: string;
    description: string;
    date: Date;
    status?: string;
    icon: string;
    color: string;
    data: any;
}

export interface BatchDocItem {
    id: string;
    originalFile: File;
    processedFile: File | null;
    originalSizeKb: number;
    compressedSizeKb: number;
    reductionPercent: number;
    status: 'compressing' | 'ready' | 'uploading' | 'done' | 'error';
    statusText: string;
    doc_type: string;
    party_role: 'buyer' | 'seller' | 'general';
    doc_label: string;
    deal_id: string;
    issue_date: string;
    expiry_date: string;
    notes: string;
    error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPES: { value: string; label: string; hasExpiry: boolean }[] = [
    { value: 'aadhaar',              label: 'Aadhaar Card',           hasExpiry: false },
    { value: 'pan',                  label: 'PAN Card',               hasExpiry: false },
    { value: 'voter_id',             label: 'Voter ID',               hasExpiry: false },
    { value: 'passport',             label: 'Passport',               hasExpiry: true  },
    { value: 'driving_license',      label: 'Driving License',        hasExpiry: true  },
    { value: 'rc_book',              label: 'RC Book',                hasExpiry: false },
    { value: 'insurance',            label: 'Insurance Policy',       hasExpiry: true  },
    { value: 'puc',                  label: 'PUC Certificate',        hasExpiry: true  },
    { value: 'noc',                  label: 'NOC',                    hasExpiry: false },
    { value: 'form_20',              label: 'Form 20',                hasExpiry: false },
    { value: 'form_21',              label: 'Form 21',                hasExpiry: false },
    { value: 'form_29',              label: 'Form 29',                hasExpiry: false },
    { value: 'form_30',              label: 'Form 30',                hasExpiry: false },
    { value: 'hypothecation_letter', label: 'Hypothecation Letter',   hasExpiry: false },
    { value: 'loan_noc',             label: 'Loan NOC',               hasExpiry: false },
    { value: 'bank_noc',             label: 'Bank NOC',               hasExpiry: false },
    { value: 'delivery_receipt',     label: 'Delivery Receipt',       hasExpiry: false },
    { value: 'sales_invoice',        label: 'Sales Invoice',          hasExpiry: false },
    { value: 'rto_receipt',          label: 'RTO Receipt',            hasExpiry: false },
    { value: 'agreement',            label: 'Agreement',              hasExpiry: false },
    { value: 'cheque_copy',          label: 'Cheque Copy',            hasExpiry: false },
    { value: 'other',                label: 'Other',                  hasExpiry: false },
];

const DEAL_TYPES = [
    { value: 'purchase',    label: 'Purchase (Customer Buys)',  icon: 'shopping_cart',   color: 'emerald' },
    { value: 'sell_to_us',  label: 'Sell to Us',               icon: 'sell',            color: 'blue'    },
    { value: 'exchange',    label: 'Exchange',                  icon: 'swap_horiz',      color: 'purple'  },
    { value: 'consignment', label: 'Park & Sell',                 icon: 'handshake',       color: 'amber'   },
];

const DEAL_STATUS_CONFIG = {
    in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700',    icon: 'pending' },
    completed:   { label: 'Completed',   color: 'bg-green-100 text-green-700',  icon: 'check_circle' },
    cancelled:   { label: 'Cancelled',   color: 'bg-red-100 text-red-700',      icon: 'cancel' },
    on_hold:     { label: 'On Hold',     color: 'bg-amber-100 text-amber-700',  icon: 'pause_circle' },
};

interface DealForm {
    deal_type: 'purchase' | 'sell_to_us' | 'exchange' | 'consignment';
    deal_status: 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
    inventory_id: string;
    lead_id: string;
    inquiry_date: string;
    deal_date: string;
    rto_date: string;
    delivery_date: string;
    handover_date: string;
    hypothecation_clearance_date: string;
    total_amount: string;
    advance_paid: string;
    balance_due: string;
    payment_mode: string;
    notes: string;
    internal_notes: string;
}

const emptyDealForm: DealForm = {
    deal_type: 'purchase',
    deal_status: 'in_progress',
    inventory_id: '',
    lead_id: '',
    inquiry_date: '',
    deal_date: new Date().toISOString().slice(0, 10),
    rto_date: '',
    delivery_date: '',
    handover_date: '',
    hypothecation_clearance_date: '',
    total_amount: '',
    advance_paid: '',
    balance_due: '',
    payment_mode: '',
    notes: '',
    internal_notes: '',
};

interface DocForm {
    deal_id: string;
    doc_type: string;
    doc_label: string;
    party_role: 'buyer' | 'seller' | 'general';
    file_url: string;
    file_name: string;
    issue_date: string;
    expiry_date: string;
    notes: string;
}

const emptyDocForm: DocForm = {
    deal_id: '',
    doc_type: 'aadhaar',
    doc_label: '',
    party_role: 'buyer',
    file_url: '',
    file_name: '',
    issue_date: '',
    expiry_date: '',
    notes: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatCurrency = (val: number | null) => {
    if (!val) return '—';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
};

const toDateInputValue = (d: string | null | undefined): string => {
    if (!d) return '';
    const trimmed = String(d).trim();
    if (!trimmed) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const part = trimmed.split('T')[0].split(' ')[0].trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
    try {
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
            const year = parsed.getFullYear();
            const month = String(parsed.getMonth() + 1).padStart(2, '0');
            const day = String(parsed.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    } catch {
        // fallback
    }
    return '';
};

const getDaysUntilExpiry = (expiry: string | null): number | null => {
    if (!expiry) return null;
    return Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000);
};

const getExpiryBadge = (expiry: string | null) => {
    const days = getDaysUntilExpiry(expiry);
    if (days === null) return null;
    if (days < 0)  return { label: `Expired ${Math.abs(days)}d ago`, cls: 'bg-red-100 text-red-700 border-red-200',   icon: 'error',   pulse: true };
    if (days <= 7) return { label: `Expires in ${days}d`,            cls: 'bg-red-50 text-red-600 border-red-100',    icon: 'warning', pulse: true };
    if (days <= 30) return { label: `Expires in ${days}d`,           cls: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'schedule', pulse: false };
    return { label: `Valid — ${days}d left`,                         cls: 'bg-green-50 text-green-700 border-green-100',  icon: 'verified', pulse: false };
};

const getDocLabel = (type: string) => DOC_TYPES.find(d => d.value === type)?.label ?? type;
const docTypeHasExpiry = (type: string) => DOC_TYPES.find(d => d.value === type)?.hasExpiry ?? false;

const getDocTypeIcon = (type: string) => {
    switch (type) {
        case 'rc_book': return 'directions_car';
        case 'insurance': return 'verified_user';
        case 'puc': return 'eco';
        case 'aadhaar':
        case 'pan':
        case 'voter_id':
        case 'passport':
        case 'driving_license':
            return 'badge';
        case 'sales_invoice':
        case 'delivery_receipt':
        case 'rto_receipt':
        case 'cheque_copy':
            return 'receipt_long';
        case 'agreement':
        case 'form_20':
        case 'form_21':
        case 'form_29':
        case 'form_30':
        case 'hypothecation_letter':
        case 'loan_noc':
        case 'bank_noc':
        case 'noc':
            return 'gavel';
        default:
            return 'description';
    }
};

// ─── Component ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'deals' | 'documents' | 'timeline' | 'logs';

const CustomerDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAdmin, profile, user } = useAuth();
    const { sales, refreshData } = useData();
    const { addNotification } = useNotifications();

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    // Overview edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({});
    const [saving, setSaving] = useState(false);

    // Deals state
    const [deals, setDeals] = useState<CustomerDeal[]>([]);
    const [dealsLoading, setDealsLoading] = useState(false);
    const [isAddingDeal, setIsAddingDeal] = useState(false);
    const [dealForm, setDealForm] = useState(emptyDealForm);
    const [dealSaving, setDealSaving] = useState(false);
    const [editingDeal, setEditingDeal] = useState<CustomerDeal | null>(null);

    // Documents state
    const [documents, setDocuments] = useState<CustomerDocument[]>([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [isAddingDoc, setIsAddingDoc] = useState(false);
    const [editingDoc, setEditingDoc] = useState<CustomerDocument | null>(null);
    const [docForm, setDocForm] = useState(emptyDocForm);
    const [docSaving, setDocSaving] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadStatusText, setUploadStatusText] = useState('');
    const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

    // Multi-file batch upload state
    const [batchItems, setBatchItems] = useState<BatchDocItem[]>([]);
    const [batchDefaultDealId, setBatchDefaultDealId] = useState<string>('');
    const [batchDefaultPartyRole, setBatchDefaultPartyRole] = useState<'buyer' | 'seller' | 'general'>('buyer');
    const [isBatchUploading, setIsBatchUploading] = useState(false);
    const [batchOverallProgress, setBatchOverallProgress] = useState(0);
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploadModalTab, setUploadModalTab] = useState<'batch' | 'single'>('batch');

    // Timeline state
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
    const [timelineLoading, setTimelineLoading] = useState(false);

    // Logs state
    const [logs, setLogs] = useState<any[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);

    // Inventory for deal form
    const [inventorySearch, setInventorySearch] = useState('');
    const [inventoryList, setInventoryList] = useState<any[]>([]);

    // Origin Lead state
    const [originLead, setOriginLead] = useState<any | null>(null);

    // Document search & party role filters
    const [docSearchQuery, setDocSearchQuery] = useState('');
    const [docPartyRoleFilter, setDocPartyRoleFilter] = useState<'all' | 'buyer' | 'seller' | 'general'>('all');

    // ─── Fetch customer ───────────────────────────────────────────────────────

    const fetchCustomer = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('id', id)
            .single();
        if (!error && data) {
            setCustomer(data as Customer);
            setEditForm({
                full_name: data.full_name || '',
                phone: data.phone || '',
                alternate_phone: data.alternate_phone || '',
                whatsapp_number: data.whatsapp_number || '',
                email: data.email || '',
                address: data.address || '',
                office_address: data.office_address || '',
                city: data.city || 'Pune',
                occupation: data.occupation || '',
                date_of_birth: data.date_of_birth || '',
                notes: data.notes || '',
            });

            // Fetch matching origin lead by phone
            if (data.phone) {
                const { data: leadData } = await supabase
                    .from('leads')
                    .select('*, assigned_profile:profiles!leads_assigned_to_fkey(full_name, email)')
                    .eq('phone', data.phone)
                    .order('created_at', { ascending: false })
                    .limit(1);
                if (leadData && leadData.length > 0) {
                    setOriginLead(leadData[0]);
                }
            }
        } else {
            navigate('/admin/customers');
        }
        setLoading(false);
    }, [id, navigate]);

    useEffect(() => { fetchCustomer(); }, [fetchCustomer]);

    // ─── Fetch Deals ──────────────────────────────────────────────────────────

    const fetchDeals = useCallback(async () => {
        if (!id) return;
        setDealsLoading(true);
        const { data, error } = await supabase
            .from('customer_deals')
            .select(`
                *,
                car:inventory(make, model, year, registration_no),
                lead:leads(full_name, status)
            `)
            .or(`customer_id.eq.${id},seller_customer_id.eq.${id}`)
            .order('created_at', { ascending: false });

        let allDeals: CustomerDeal[] = [];
        if (error) {
            console.warn('Error fetching customer_deals with seller filter, falling back:', error);
            const { data: fallbackData } = await supabase
                .from('customer_deals')
                .select(`
                    *,
                    car:inventory(make, model, year, registration_no),
                    lead:leads(full_name, status)
                `)
                .eq('customer_id', id)
                .order('created_at', { ascending: false });
            allDeals = (fallbackData as CustomerDeal[]) || [];
        } else {
            allDeals = (data as CustomerDeal[]) || [];
        }

        const existingSaleIds = new Set(allDeals.map(d => d.sale_id).filter(Boolean));

        // Auto-detect any sales for this customer not yet in customer_deals
        const customerSales = sales.filter(s => s.customer_id === id);
        const missingSales = customerSales.filter(s => !existingSaleIds.has(s.id));

        if (missingSales.length > 0) {
            for (const sale of missingSales) {
                const saleDateStr = sale.sale_date
                    ? new Date(sale.sale_date).toISOString().split('T')[0]
                    : new Date(sale.created_at || Date.now()).toISOString().split('T')[0];

                try {
                    const { data: inserted, error: insertErr } = await supabase
                        .from('customer_deals')
                        .insert({
                            customer_id: id,
                            inventory_id: sale.inventory_id || null,
                            lead_id: sale.lead_id || null,
                            sale_id: sale.id,
                            deal_type: sale.sale_type === 'consignment' ? 'consignment' : 'purchase',
                            deal_status: 'completed',
                            inquiry_date: saleDateStr,
                            deal_date: saleDateStr,
                            rto_date: saleDateStr,
                            delivery_date: saleDateStr,
                            handover_date: saleDateStr,
                            total_amount: Number(sale.sale_price ?? sale.final_price ?? 0),
                            advance_paid: Number(sale.sale_price ?? sale.final_price ?? 0),
                            balance_due: sale.payment_status === 'paid' ? 0 : Number(sale.balance_amount || 0),
                            payment_mode: sale.payment_method || 'Paid',
                            notes: `Auto-synced from completed purchase (${sale.car ? `${sale.car.year || ''} ${sale.car.make} ${sale.car.model}` : 'Vehicle'}).`,
                            internal_notes: 'Auto-synchronized from Sales record',
                        })
                        .select(`
                            *,
                            car:inventory(make, model, year, registration_no),
                            lead:leads(full_name, status)
                        `)
                        .single();

                    if (!insertErr && inserted) {
                        allDeals.push(inserted as CustomerDeal);
                        existingSaleIds.add(sale.id);
                    }
                } catch (e) {
                    console.warn('Auto-sync insert error:', e);
                }
            }
        }

        allDeals.sort((a, b) =>
            new Date(b.deal_date || b.created_at).getTime() - new Date(a.deal_date || a.created_at).getTime()
        );

        setDeals(allDeals);
        setDealsLoading(false);
    }, [id, sales]);

    // ─── Fetch Documents ──────────────────────────────────────────────────────

    const fetchDocuments = useCallback(async () => {
        if (!id) return;
        setDocsLoading(true);
        const { data } = await supabase
            .from('customer_documents')
            .select('*, uploaded_by_profile:profiles!uploaded_by(full_name)')
            .eq('customer_id', id)
            .order('created_at', { ascending: false });
        setDocuments((data as CustomerDocument[]) || []);
        setDocsLoading(false);

        // Fire expiry notifications for critical docs
        (data || []).forEach(async (doc: any) => {
            const days = getDaysUntilExpiry(doc.expiry_date);
            if (days !== null && days <= 7) {
                const key = `doc_expiry_critical_${doc.id}_${new Date().toISOString().split('T')[0]}`;
                const { data: existing } = await supabase
                    .from('smart_notifications')
                    .select('id')
                    .eq('dedup_key', key)
                    .limit(1);
                if (!existing || existing.length === 0) {
                    await addNotification({
                        type: 'document_expiry',
                        category: 'critical',
                        priority: 1,
                        icon: 'description',
                        color: 'red',
                        title: days < 0
                            ? `🔴 Document Expired — ${doc.customer?.full_name || 'Customer'}`
                            : `🔴 Document Expiring in ${days} day(s)`,
                        message: `${getDocLabel(doc.doc_type)}${doc.doc_label ? ` (${doc.doc_label})` : ''} for ${customer?.full_name || 'customer'} ${days < 0 ? 'has expired' : `expires in ${days} day(s)`}.`,
                        action_url: `/admin/customers/${id}?tab=documents`,
                        action_label: 'View Documents',
                        related_entity_type: 'customer_document',
                        related_entity_id: doc.id,
                        assigned_to_user_id: null,
                        dedup_key: key,
                        metadata: { doc_type: doc.doc_type, expiry_date: doc.expiry_date, customer_id: id },
                    });
                }
            }
        });
    }, [id, customer, addNotification]);

    // ─── Fetch Timeline ───────────────────────────────────────────────────────

    const fetchTimeline = useCallback(async () => {
        if (!id || !customer) return;
        setTimelineLoading(true);

        const safe = async (q: any) => { try { const r = await q; return r; } catch { return { data: [] }; } };

        const [
            { data: leadsData },
            { data: serviceData },
            { data: testDriveData },
            { data: followUpData },
            { data: visitsData },
        ] = await Promise.all([
            safe(supabase.from('leads').select('*').eq('phone', customer.phone)),
            safe(supabase.from('service_bookings').select('*').eq('phone', customer.phone)),
            safe(supabase.from('test_drive_bookings').select('*, car:inventory(make,model)').eq('phone', customer.phone)),
            safe(supabase.from('follow_ups').select('*').eq('customer_id', id)),
            safe(supabase.from('visits').select('*, staff:profiles!staff_id(full_name)').eq('customer_id', id).order('visit_date', { ascending: false })),
        ]);

        const events: TimelineEvent[] = [];

        // Sales from DataContext
        sales.filter(s => s.customer_id === id).forEach(s => {
            events.push({
                id: `sale-${s.id}`, type: 'sale',
                title: `Purchased ${s.car?.make || ''} ${s.car?.model || ''}`,
                description: `Amount: ${formatCurrency(s.final_price || 0)}`,
                date: new Date(s.sale_date || s.created_at),
                icon: 'directions_car', color: 'emerald', data: s,
            });
        });

        // Deals
        deals.forEach(d => {
            const dt = DEAL_TYPES.find(t => t.value === d.deal_type);
            events.push({
                id: `deal-${d.id}`, type: 'deal',
                title: `Deal: ${dt?.label || d.deal_type}`,
                description: `${d.car ? `${d.car.year} ${d.car.make} ${d.car.model}` : 'Vehicle TBD'} — Status: ${DEAL_STATUS_CONFIG[d.deal_status]?.label}`,
                date: new Date(d.deal_date || d.created_at),
                status: DEAL_STATUS_CONFIG[d.deal_status]?.label,
                icon: dt?.icon || 'handshake', color: dt?.color || 'blue', data: d,
            });
        });

        (leadsData || []).forEach((l: any) => events.push({
            id: `lead-${l.id}`, type: 'lead',
            title: `Enquiry: ${l.type.replace(/_/g, ' ').toUpperCase()}`,
            description: l.message || (l.car_make ? `Interested in ${l.car_make} ${l.car_model || ''}` : 'General Enquiry'),
            date: new Date(l.created_at), status: l.status,
            icon: l.type === 'insurance' ? 'shield' : 'person_search',
            color: l.type === 'insurance' ? 'indigo' : 'primary', data: l,
        }));

        (serviceData || []).forEach((s: any) => events.push({
            id: `service-${s.id}`, type: 'service',
            title: `${s.service_type || 'Service'} Booking`,
            description: `${s.car_make || 'Vehicle'} ${s.car_model || ''} (${s.car_reg_no || 'N/A'})`,
            date: new Date(s.created_at), status: s.status,
            icon: 'home_repair_service', color: 'orange', data: s,
        }));

        (testDriveData || []).forEach((t: any) => events.push({
            id: `td-${t.id}`, type: 'test_drive',
            title: 'Test Drive Booking',
            description: t.car ? `${t.car.make} ${t.car.model}` : 'Vehicle unavailable',
            date: new Date(t.created_at), status: t.status,
            icon: 'drive_eta', color: 'blue', data: t,
        }));

        (followUpData || []).forEach((f: any) => events.push({
            id: `fu-${f.id}`, type: 'follow_up',
            title: `Interaction: ${f.type?.toUpperCase() || 'GENERAL'}`,
            description: f.notes || 'No notes',
            date: new Date(f.created_at), status: f.status,
            icon: f.type === 'call' ? 'call' : f.type === 'whatsapp' ? 'forum' : 'headset_mic',
            color: 'slate', data: f,
        }));

        (visitsData || []).forEach((v: any) => events.push({
            id: `visit-${v.id}`, type: 'visit',
            title: `Visit: ${v.purpose.toUpperCase()}`,
            description: `Outcome: ${v.outcome === 'successful' ? 'Successful' : 'Unsuccessful'}${v.notes ? ' — ' + v.notes : ''}`,
            date: new Date(v.visit_date), status: v.status,
            icon: 'directions_walk',
            color: v.outcome === 'unsuccessful' ? 'slate' : v.status === 'approved' ? 'emerald' : 'amber', data: v,
        }));

        events.sort((a, b) => b.date.getTime() - a.date.getTime());
        setTimeline(events);
        setTimelineLoading(false);
    }, [id, customer, sales, deals]);

    // ─── Fetch Logs ───────────────────────────────────────────────────────────

    const fetchLogs = useCallback(async () => {
        if (!id || !customer) return;
        setLogsLoading(true);
        const { data } = await supabase
            .from('audit_logs')
            .select('id, action, target_type, target_name, details, created_at, profiles:user_id(full_name)')
            .or(`target_name.ilike.%${customer.full_name}%,details.ilike.%${id}%`)
            .order('created_at', { ascending: false })
            .limit(50);
        setLogs(data || []);
        setLogsLoading(false);
    }, [id, customer]);

    // ─── Tab-based data loading ───────────────────────────────────────────────

    useEffect(() => {
        if (!customer) return;
        if (activeTab === 'deals')     { fetchDeals(); fetchDocuments(); }
        if (activeTab === 'documents') { fetchDeals(); fetchDocuments(); }
        if (activeTab === 'timeline')  fetchTimeline();
        if (activeTab === 'logs')      fetchLogs();
    }, [activeTab, customer]);

    // Also fetch deals and documents initially for all tabs and document deal dropdown
    useEffect(() => {
        if (customer) {
            fetchDeals();
            fetchDocuments();
        }
    }, [customer]);

    // ─── URL tab param ────────────────────────────────────────────────────────
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab') as Tab;
        if (t && ['overview', 'deals', 'documents', 'timeline', 'logs'].includes(t)) {
            setActiveTab(t);
        }
    }, []);

    // ─── Inventory search for deal form ───────────────────────────────────────

    useEffect(() => {
        if (!inventorySearch.trim()) { setInventoryList([]); return; }
        const timer = setTimeout(async () => {
            const { data } = await supabase
                .from('inventory')
                .select('id, make, model, year, registration_no, status')
                .or(`make.ilike.%${inventorySearch}%,model.ilike.%${inventorySearch}%,registration_no.ilike.%${inventorySearch}%`)
                .limit(5);
            setInventoryList(data || []);
        }, 300);
        return () => clearTimeout(timer);
    }, [inventorySearch]);

    // ─── Actions ──────────────────────────────────────────────────────────────

    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customer) return;
        setSaving(true);
        const { error } = await supabase.from('customers').update({
            full_name: editForm.full_name, phone: editForm.phone,
            alternate_phone: editForm.alternate_phone || null,
            whatsapp_number: editForm.whatsapp_number || null,
            email: editForm.email || null, address: editForm.address || null,
            office_address: editForm.office_address || null,
            city: editForm.city || null, occupation: editForm.occupation || null,
            date_of_birth: editForm.date_of_birth || null, notes: editForm.notes || null,
        }).eq('id', customer.id);
        setSaving(false);
        if (!error) { setIsEditing(false); fetchCustomer(); refreshData(); }
        else alert('Failed to update customer');
    };

    const handleSaveDeal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customer) return;
        setDealSaving(true);

        const payload = {
            customer_id: customer.id,
            deal_type: dealForm.deal_type,
            deal_status: dealForm.deal_status,
            inventory_id: dealForm.inventory_id || null,
            lead_id: dealForm.lead_id || null,
            inquiry_date: dealForm.inquiry_date || null,
            deal_date: dealForm.deal_date || null,
            rto_date: dealForm.rto_date || null,
            delivery_date: dealForm.delivery_date || null,
            handover_date: dealForm.handover_date || null,
            hypothecation_clearance_date: dealForm.hypothecation_clearance_date || null,
            total_amount: dealForm.total_amount ? Number(dealForm.total_amount) : null,
            advance_paid: dealForm.advance_paid ? Number(dealForm.advance_paid) : null,
            balance_due: dealForm.balance_due ? Number(dealForm.balance_due) : null,
            payment_mode: dealForm.payment_mode || null,
            notes: dealForm.notes || null,
            internal_notes: dealForm.internal_notes || null,
            created_by: profile?.id || null,
        };

        if (editingDeal) {
            const { error } = await supabase.from('customer_deals').update(payload).eq('id', editingDeal.id);
            if (!error) { setEditingDeal(null); fetchDeals(); }
            else alert('Failed to update deal');
        } else {
            const { error } = await supabase.from('customer_deals').insert(payload);
            if (!error) {
                setIsAddingDeal(false);
                setDealForm(emptyDealForm);
                fetchDeals();
                // Audit log
                if (profile) {
                    await supabase.from('audit_logs').insert({
                        user_id: profile.id,
                        action: 'Deal Created',
                        target_type: 'Customer',
                        target_name: customer.full_name,
                        details: `New ${dealForm.deal_type} deal added for ${customer.full_name}`,
                    });
                }
            } else alert('Failed to save deal');
        }
        setDealSaving(false);
    };

    const openEditDeal = (deal: CustomerDeal) => {
        setEditingDeal(deal);
        setDealForm({
            deal_type: deal.deal_type,
            deal_status: deal.deal_status,
            inventory_id: deal.inventory_id || '',
            lead_id: deal.lead_id || '',
            inquiry_date: deal.inquiry_date || '',
            deal_date: deal.deal_date || '',
            rto_date: deal.rto_date || '',
            delivery_date: deal.delivery_date || '',
            handover_date: deal.handover_date || '',
            hypothecation_clearance_date: deal.hypothecation_clearance_date || '',
            total_amount: deal.total_amount ? String(deal.total_amount) : '',
            advance_paid: deal.advance_paid ? String(deal.advance_paid) : '',
            balance_due: deal.balance_due ? String(deal.balance_due) : '',
            payment_mode: deal.payment_mode || '',
            notes: deal.notes || '',
            internal_notes: deal.internal_notes || '',
        });
        setIsAddingDeal(true);
    };

    const detectDocType = (fileName: string): string => {
        const lower = fileName.toLowerCase();
        if (lower.includes('aadhaar') || lower.includes('aadhar')) return 'aadhaar';
        if (lower.includes('pan')) return 'pan';
        if (lower.includes('voter')) return 'voter_id';
        if (lower.includes('passport')) return 'passport';
        if (lower.includes('license') || lower.includes('licence') || lower.includes('driving')) return 'driving_license';
        if (lower.includes('rc') || lower.includes('registration')) return 'rc_book';
        if (lower.includes('insurance') || lower.includes('policy')) return 'insurance';
        if (lower.includes('puc') || lower.includes('pollution')) return 'puc';
        if (lower.includes('noc')) return 'noc';
        if (lower.includes('form 20') || lower.includes('form20')) return 'form_20';
        if (lower.includes('form 21') || lower.includes('form21')) return 'form_21';
        if (lower.includes('form 29') || lower.includes('form29')) return 'form_29';
        if (lower.includes('form 30') || lower.includes('form30')) return 'form_30';
        if (lower.includes('delivery') || lower.includes('challan') || lower.includes('receipt')) return 'delivery_receipt';
        if (lower.includes('invoice') || lower.includes('bill')) return 'sales_invoice';
        if (lower.includes('rto')) return 'rto_receipt';
        if (lower.includes('agreement') || lower.includes('contract')) return 'agreement';
        if (lower.includes('cheque') || lower.includes('check')) return 'cheque_copy';
        return 'other';
    };

    const handleBatchFileSelect = async (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        const newItems: BatchDocItem[] = fileArray.map(file => {
            const detectedType = detectDocType(file.name);
            const initialSizeKb = Math.round(file.size / 1024);
            const baseLabel = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            return {
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                originalFile: file,
                processedFile: null,
                originalSizeKb: initialSizeKb,
                compressedSizeKb: initialSizeKb,
                reductionPercent: 0,
                status: 'compressing',
                statusText: 'Compressing…',
                doc_type: detectedType,
                party_role: batchDefaultPartyRole,
                doc_label: baseLabel.replace(/[_-]/g, ' '),
                deal_id: batchDefaultDealId || docForm.deal_id || '',
                issue_date: '',
                expiry_date: '',
                notes: '',
            };
        });

        setBatchItems(prev => [...prev, ...newItems]);

        // Compress each item asynchronously
        for (const item of newItems) {
            try {
                let processed: File;
                let origSize = item.originalSizeKb;
                let compSize = item.originalSizeKb;
                let reduction = 0;

                const isPdf = item.originalFile.type === 'application/pdf' || item.originalFile.name.toLowerCase().endsWith('.pdf');
                if (isPdf) {
                    const res = await compressPdf(item.originalFile, {
                        targetMaxMb: 1.4,
                        quality: 0.80,
                        maxDimension: 1800,
                        forceCompress: true,
                        onProgress: (_pct, text) => {
                            setBatchItems(curr => curr.map(b => b.id === item.id ? { ...b, statusText: text } : b));
                        }
                    });
                    processed = res.file;
                    origSize = Math.round(res.originalSizeMb * 1024);
                    compSize = Math.round(processed.size / 1024);
                    reduction = res.reductionPercent;
                } else {
                    const res = await compressImage(item.originalFile, {
                        maxTargetKb: 600,
                        maxDimension: 1920,
                        initialQuality: 0.85,
                        onProgress: (_pct, text) => {
                            setBatchItems(curr => curr.map(b => b.id === item.id ? { ...b, statusText: text } : b));
                        }
                    });
                    processed = res.file;
                    origSize = res.originalSizeKb;
                    compSize = res.compressedSizeKb;
                    reduction = res.reductionPercent;
                }

                setBatchItems(curr => curr.map(b => b.id === item.id ? {
                    ...b,
                    processedFile: processed,
                    originalSizeKb: origSize,
                    compressedSizeKb: compSize,
                    reductionPercent: reduction,
                    status: 'ready',
                    statusText: `Ready (${compSize} KB ≤ ${isPdf ? '1.4 MB' : '600 KB'})`,
                } : b));
            } catch (err: any) {
                console.error('Batch compression error:', err);
                setBatchItems(curr => curr.map(b => b.id === item.id ? {
                    ...b,
                    processedFile: item.originalFile,
                    status: 'ready',
                    statusText: 'Original file optimal',
                } : b));
            }
        }
    };

    const handleBatchUploadSave = async () => {
        if (!customer || batchItems.length === 0 || isBatchUploading) return;
        setIsBatchUploading(true);
        setBatchOverallProgress(0);

        const isValidUuid = (val: string | null | undefined): boolean => {
            if (!val) return false;
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val).trim());
        };

        let successCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < batchItems.length; i++) {
            const item = batchItems[i];
            setBatchItems(curr => curr.map(b => b.id === item.id ? { ...b, status: 'uploading', statusText: 'Uploading…' } : b));

            try {
                const fileToUpload = item.processedFile || item.originalFile;
                const ext = fileToUpload.name.split('.').pop() || 'pdf';
                const path = `${customer.id}/${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

                const { error: uploadErr } = await supabase.storage
                    .from('customer-documents')
                    .upload(path, fileToUpload, { upsert: true });

                if (uploadErr) throw uploadErr;

                const { data: urlData } = supabase.storage
                    .from('customer-documents')
                    .getPublicUrl(path);

                const fileUrl = urlData?.publicUrl || null;
                const cleanDealId = isValidUuid(item.deal_id) ? item.deal_id.trim() : null;

                const { error: insertErr } = await supabase.from('customer_documents').insert({
                    customer_id: customer.id,
                    deal_id: cleanDealId,
                    doc_type: item.doc_type,
                    doc_label: item.doc_label ? item.doc_label.trim() : null,
                    party_role: item.party_role,
                    file_url: fileUrl,
                    file_name: item.originalFile.name,
                    issue_date: toDateInputValue(item.issue_date) || null,
                    expiry_date: toDateInputValue(item.expiry_date) || null,
                    notes: item.notes ? item.notes.trim() : null,
                    uploaded_by: profile?.id ?? user?.id ?? null,
                });

                if (insertErr) throw insertErr;

                setBatchItems(curr => curr.map(b => b.id === item.id ? { ...b, status: 'done', statusText: 'Uploaded' } : b));
                successCount++;
            } catch (err: any) {
                console.error('Failed to upload batch document:', err);
                errors.push(`${item.originalFile.name}: ${err.message || 'Upload failed'}`);
                setBatchItems(curr => curr.map(b => b.id === item.id ? { ...b, status: 'error', statusText: 'Failed', error: err.message } : b));
            }

            setBatchOverallProgress(Math.round(((i + 1) / batchItems.length) * 100));
        }

        setIsBatchUploading(false);

        if (successCount > 0) {
            addNotification({
                title: 'Documents Attached',
                message: `Successfully uploaded & compressed ${successCount} document${successCount !== 1 ? 's' : ''}`,
                type: 'success',
            });

            if (profile) {
                await supabase.from('audit_logs').insert({
                    user_id: profile.id,
                    action: 'Batch Documents Uploaded',
                    target_type: 'Customer',
                    target_name: customer.full_name,
                    details: `Uploaded ${successCount} documents for ${customer.full_name}`,
                });
            }

            fetchDocuments();
            fetchDeals();

            if (errors.length === 0) {
                setIsAddingDoc(false);
                setBatchItems([]);
                setDocForm(emptyDocForm);
            }
        }

        if (errors.length > 0) {
            alert(`Some files could not be uploaded:\n${errors.join('\n')}`);
        }
    };

    const handleUploadFile = async (file: File): Promise<string | null> => {
        if (!id) return null;
        setUploadingFile(true);
        setUploadStatusText('Preparing file…');

        let fileToUpload = file;
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            setUploadStatusText('Optimizing PDF (≤ 1.4 MB)…');
            fileToUpload = await autoCompressPdf(file, (_pct, text) => {
                setUploadStatusText(`Compressing PDF: ${text}`);
            });
        } else if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic)$/i.test(file.name)) {
            setUploadStatusText('Optimizing Photo (≤ 600 KB)…');
            fileToUpload = await autoCompressImage(file, (_pct, text) => {
                setUploadStatusText(`Compressing Photo: ${text}`);
            });
        }

        setUploadStatusText('Uploading to storage…');
        const ext = fileToUpload.name.split('.').pop() || 'pdf';
        const path = `${id}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
        const { error } = await supabase.storage.from('customer-documents').upload(path, fileToUpload, { upsert: true });
        setUploadingFile(false);
        setUploadStatusText('');
        if (error) { alert('Upload failed: ' + error.message); return null; }
        const { data: urlData } = supabase.storage.from('customer-documents').getPublicUrl(path);
        return urlData?.publicUrl || null;
    };

    const openEditDoc = (doc: CustomerDocument) => {
        setEditingDoc(doc);
        setUploadModalTab('single');
        setDocForm({
            deal_id: doc.deal_id || '',
            doc_type: doc.doc_type,
            doc_label: doc.doc_label || '',
            party_role: doc.party_role || 'buyer',
            file_url: doc.file_url || '',
            file_name: doc.file_name || '',
            issue_date: toDateInputValue(doc.issue_date),
            expiry_date: toDateInputValue(doc.expiry_date),
            notes: doc.notes || '',
        });
        setIsAddingDoc(true);
    };

    const handleDownloadDoc = async (doc: CustomerDocument) => {
        if (!doc.file_url) {
            alert('No file attached to this document.');
            return;
        }

        setDownloadingDocId(doc.id);

        try {
            const response = await fetch(doc.file_url);
            if (!response.ok) throw new Error('Network response was not ok');
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            // Determine file extension
            let ext = '';
            if (doc.file_name && doc.file_name.includes('.')) {
                ext = '.' + doc.file_name.split('.').pop();
            } else if (doc.file_url.includes('.')) {
                const cleanUrl = doc.file_url.split('?')[0];
                ext = '.' + cleanUrl.split('.').pop();
            } else {
                ext = blob.type.includes('pdf') ? '.pdf' : blob.type.includes('png') ? '.png' : '.jpg';
            }

            const safeCustomerName = (customer?.full_name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
            const safeDocName = (doc.doc_label || getDocLabel(doc.doc_type)).replace(/[^a-zA-Z0-9_-]/g, '_');
            const downloadFilename = `${safeCustomerName}_${safeDocName}${ext}`;

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = downloadFilename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);

            addNotification({
                title: 'Document Downloaded',
                message: `Downloaded ${downloadFilename}`,
                type: 'success',
            });
        } catch (err) {
            console.warn('Direct blob download failed, falling back to direct anchor download:', err);
            const link = document.createElement('a');
            link.href = doc.file_url;
            link.target = '_blank';
            link.download = doc.file_name || `${doc.doc_label || getDocLabel(doc.doc_type)}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } finally {
            setDownloadingDocId(null);
        }
    };

    const handleSaveDoc = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customer) return;
        setDocSaving(true);

        const cleanIssueDate = toDateInputValue(docForm.issue_date) || null;
        const cleanExpiryDate = toDateInputValue(docForm.expiry_date) || null;

        const isValidUuid = (val: string | null | undefined): boolean => {
            if (!val) return false;
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val).trim());
        };

        const cleanDealId = isValidUuid(docForm.deal_id) ? docForm.deal_id.trim() : null;

        const payload = {
            customer_id: customer.id,
            deal_id: cleanDealId,
            doc_type: docForm.doc_type,
            doc_label: docForm.doc_label ? docForm.doc_label.trim() : null,
            party_role: docForm.party_role,
            file_url: docForm.file_url || null,
            file_name: docForm.file_name || null,
            issue_date: cleanIssueDate,
            expiry_date: cleanExpiryDate,
            notes: docForm.notes ? docForm.notes.trim() : null,
            uploaded_by: profile?.id ?? user?.id ?? null,
        };

        if (editingDoc) {
            const { error } = await supabase.from('customer_documents').update(payload).eq('id', editingDoc.id);
            setDocSaving(false);
            if (!error) {
                setEditingDoc(null);
                setIsAddingDoc(false);
                setDocForm(emptyDocForm);
                fetchDocuments();
                fetchDeals();
                if (profile) {
                    await supabase.from('audit_logs').insert({
                        user_id: profile.id,
                        action: 'Document Updated',
                        target_type: 'Customer',
                        target_name: customer.full_name,
                        details: `Updated ${docForm.doc_label || getDocLabel(docForm.doc_type)} for ${customer.full_name}`,
                    });
                }
            } else {
                alert('Failed to update document: ' + error.message);
            }
        } else {
            const { error } = await supabase.from('customer_documents').insert(payload);
            setDocSaving(false);
            if (!error) {
                setIsAddingDoc(false);
                setDocForm(emptyDocForm);
                fetchDocuments();
                fetchDeals();
                if (profile) {
                    await supabase.from('audit_logs').insert({
                        user_id: profile.id,
                        action: 'Document Added',
                        target_type: 'Customer',
                        target_name: customer.full_name,
                        details: `Added ${getDocLabel(docForm.doc_type)} (${docForm.party_role}) for ${customer.full_name}`,
                    });
                }
            } else {
                alert('Failed to save document: ' + error.message);
            }
        }
    };

    const handleDeleteDoc = async (docId: string) => {
        if (!window.confirm('Delete this document?')) return;
        const { error } = await supabase.from('customer_documents').delete().eq('id', docId);
        if (!error) {
            fetchDocuments();
            fetchDeals();
        }
    };

    const handleDeleteDeal = async (dealId: string) => {
        if (!window.confirm('Delete this deal record? This will not affect sales or inventory.')) return;
        const { error } = await supabase.from('customer_deals').delete().eq('id', dealId);
        if (!error) fetchDeals();
    };

    // ─── Computed ─────────────────────────────────────────────────────────────

    const customerSales = sales.filter(s => s.customer_id === id);
    const criticalDocs = documents.filter(d => {
        const days = getDaysUntilExpiry(d.expiry_date);
        return days !== null && days <= 30;
    });

    const filteredDocuments = documents.filter(doc => {
        if (docPartyRoleFilter !== 'all' && doc.party_role !== docPartyRoleFilter) {
            return false;
        }
        if (docSearchQuery.trim()) {
            const q = docSearchQuery.toLowerCase().trim();
            const label = (doc.doc_label || '').toLowerCase();
            const type = getDocLabel(doc.doc_type).toLowerCase();
            const notes = (doc.notes || '').toLowerCase();
            const role = (doc.party_role || '').toLowerCase();
            if (!label.includes(q) && !type.includes(q) && !notes.includes(q) && !role.includes(q)) {
                return false;
            }
        }
        return true;
    });

    const documentsByDeal: Record<string, CustomerDocument[]> = {};
    filteredDocuments.forEach(doc => {
        const key = doc.deal_id || 'general';
        if (!documentsByDeal[key]) documentsByDeal[key] = [];
        documentsByDeal[key].push(doc);
    });

    const TABS: { key: Tab; label: string; icon: string; badge?: number }[] = [
        { key: 'overview',   label: 'Overview',       icon: 'person'           },
        { key: 'deals',      label: 'Deals & Dates',  icon: 'handshake',       badge: deals.length > 0 ? deals.length : undefined },
        { key: 'documents',  label: 'Documents',      icon: 'description',     badge: criticalDocs.length > 0 ? criticalDocs.length : undefined },
        { key: 'timeline',   label: 'Timeline',       icon: 'timeline'         },
        { key: 'logs',       label: 'Audit Logs',     icon: 'history'          },
    ];

    // Color map for timeline
    const timelineColorMap: Record<string, string> = {
        emerald: 'bg-emerald-100 text-emerald-600', blue: 'bg-blue-100 text-blue-600',
        primary: 'bg-primary/10 text-primary', indigo: 'bg-indigo-100 text-indigo-600',
        orange: 'bg-orange-100 text-orange-600', amber: 'bg-amber-100 text-amber-600',
        slate: 'bg-slate-100 text-slate-600', red: 'bg-red-100 text-red-600',
        purple: 'bg-purple-100 text-purple-600',
    };

    // ─── Loading state ────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center py-40">
                <span className="size-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (!customer) return null;

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="space-y-0">
            {/* ── Back Nav ── */}
            <div className="flex items-center gap-2 mb-4">
                <button
                    onClick={() => navigate('/admin/customers')}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary transition-colors"
                >
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                    Customers
                </button>
                <span className="text-slate-300">/</span>
                <span className="text-sm font-semibold text-primary">{customer.full_name}</span>
            </div>

            {/* ── Hero Header ── */}
            <div className="bg-gradient-to-r from-primary to-primary-light rounded-2xl px-6 pt-6 pb-0 mb-0 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }} />
                <div className="relative">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="size-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-white text-2xl font-black">
                                {customer.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white">{customer.full_name}</h1>
                                {customer.occupation && <p className="text-white/70 text-sm mt-0.5">{customer.occupation}</p>}
                                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                    <span className="text-white/60 text-xs flex items-center gap-1">
                                        <span className="material-symbols-outlined text-xs">call</span>{customer.phone}
                                    </span>
                                    {customer.city && <span className="text-white/60 text-xs flex items-center gap-1">
                                        <span className="material-symbols-outlined text-xs">location_on</span>{customer.city}
                                    </span>}
                                    <span className="text-white/50 text-xs">Since {formatDate(customer.created_at)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {customerSales.length > 0 && (
                                <span className="bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/30">
                                    {customerSales.length} Sale{customerSales.length !== 1 ? 's' : ''}
                                </span>
                            )}
                            {criticalDocs.length > 0 && (
                                <Link
                                    to="/admin/customer-alerts"
                                    className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-pulse"
                                >
                                    <span className="material-symbols-outlined text-xs">warning</span>
                                    {criticalDocs.length} Expiry Alert{criticalDocs.length !== 1 ? 's' : ''}
                                </Link>
                            )}
                            <Link
                                to="/admin/happy-customers"
                                className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/30 flex items-center gap-1.5 transition-colors"
                                title="Manage Delivery Celebrations & Stories"
                            >
                                <span className="material-symbols-outlined text-sm">celebration</span> Delivery Story
                            </Link>
                            <a href={`tel:${customer.phone}`} className="size-9 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-colors" title="Call">
                                <span className="material-symbols-outlined text-white text-lg">call</span>
                            </a>
                            <a href={toWhatsAppUrl(customer.whatsapp_number || customer.phone)} target="_blank" rel="noreferrer" className="size-9 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-colors" title="WhatsApp">
                                <span className="material-symbols-outlined text-white text-lg">forum</span>
                            </a>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mt-5 overflow-x-auto pb-0">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all whitespace-nowrap relative ${
                                    activeTab === tab.key
                                        ? 'border-white text-white'
                                        : 'border-transparent text-white/50 hover:text-white/80'
                                }`}
                            >
                                <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                                {tab.label}
                                {tab.badge != null && (
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${tab.key === 'documents' ? 'bg-red-500 text-white animate-pulse' : 'bg-white/30 text-white'}`}>
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Tab Content ── */}
            <div className="bg-white rounded-b-2xl border border-t-0 border-slate-100 shadow-[var(--shadow-card)] min-h-[400px]">

                {/* ────────────────────────────────
                    TAB: OVERVIEW
                ──────────────────────────────── */}
                {activeTab === 'overview' && (
                    <div className="p-6 space-y-6">
                        {/* ── Lead Origin & Conversion Journey Banner ── */}
                        {originLead && (
                            <div className="bg-gradient-to-r from-slate-900 via-primary-dark to-primary text-white rounded-2xl p-5 shadow-lg border border-white/10 relative overflow-hidden">
                                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 size-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
                                <div className="flex items-start justify-between relative z-10 flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="size-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0">
                                            <span className="material-symbols-outlined text-2xl text-emerald-400">conversion_path</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                    🌱 Converted Lead Journey
                                                </span>
                                                {originLead.quality && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white capitalize">
                                                        {originLead.quality} Priority
                                                    </span>
                                                )}
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600/30 text-emerald-200">
                                                    Status: {originLead.status?.toUpperCase() || 'WON'}
                                                </span>
                                            </div>
                                            <h3 className="text-base font-bold text-white mt-1">Originally Enquired on {formatDate(originLead.created_at)}</h3>
                                        </div>
                                    </div>
                                    <Link
                                        to={`/admin/leads/${originLead.id}`}
                                        className="px-4 py-2 bg-white/20 hover:bg-white text-white hover:text-primary rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-sm">open_in_new</span> Original Lead Profile
                                    </Link>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10 relative z-10 text-xs">
                                    <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                                        <span className="text-white/50 block text-[10px] uppercase font-semibold mb-0.5">Lead Source</span>
                                        <span className="font-bold text-white capitalize">{originLead.source?.replace(/_/g, ' ') || 'Direct Walk-in'}</span>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                                        <span className="text-white/50 block text-[10px] uppercase font-semibold mb-0.5">Enquiry Type</span>
                                        <span className="font-bold text-white uppercase">{originLead.type?.replace(/_/g, ' ') || 'Vehicle Purchase'}</span>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                                        <span className="text-white/50 block text-[10px] uppercase font-semibold mb-0.5">Assigned Staff</span>
                                        <span className="font-bold text-white">{originLead.assigned_profile?.full_name || 'Unassigned'}</span>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                                        <span className="text-white/50 block text-[10px] uppercase font-semibold mb-0.5">Interested Model</span>
                                        <span className="font-bold text-emerald-300">{originLead.car_make ? `${originLead.car_make} ${originLead.car_model || ''}` : 'General Enquiry'}</span>
                                    </div>
                                </div>

                                {originLead.message && (
                                    <p className="text-xs text-white/80 mt-3 bg-white/5 rounded-xl p-3 border border-white/10 italic">
                                        "{originLead.message}"
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Edit Form */}
                        {isEditing ? (
                            <form onSubmit={handleEditSave} className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Edit Customer Details</p>
                                    <button type="button" onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
                                        <span className="material-symbols-outlined text-lg">close</span>
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: 'Full Name *', key: 'full_name', required: true },
                                        { label: 'Phone *',     key: 'phone',     required: true },
                                        { label: 'Email',       key: 'email'                     },
                                        { label: 'City',        key: 'city'                      },
                                        { label: 'WhatsApp',    key: 'whatsapp_number'            },
                                        { label: 'Alt Phone',   key: 'alternate_phone'            },
                                        { label: 'Occupation',  key: 'occupation'                 },
                                        { label: 'DOB',         key: 'date_of_birth', type: 'date' },
                                    ].map(f => (
                                        <div key={f.key}>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{f.label}</label>
                                            <input
                                                required={f.required}
                                                type={f.type || 'text'}
                                                value={editForm[f.key] || ''}
                                                onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
                                                className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Address</label>
                                    <textarea rows={2} value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white resize-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Notes</label>
                                    <textarea rows={2} value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white resize-none" />
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setIsEditing(false)} className="flex-1 h-10 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50">Cancel</button>
                                    <button type="submit" disabled={saving} className="flex-1 h-10 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary-light disabled:opacity-60 flex items-center justify-center gap-2">
                                        {saving ? <><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="flex justify-end">
                                <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-light transition-colors">
                                    <span className="material-symbols-outlined text-base">edit</span> Edit Details
                                </button>
                            </div>
                        )}

                        {/* Contact Cards */}
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Contact Information</p>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { icon: 'call',          label: 'Phone',       value: customer.phone },
                                    { icon: 'phone_in_talk', label: 'Alt Phone',   value: customer.alternate_phone },
                                    { icon: 'forum',         label: 'WhatsApp',    value: customer.whatsapp_number },
                                    { icon: 'mail',          label: 'Email',       value: customer.email },
                                    { icon: 'location_on',   label: 'City',        value: customer.city },
                                    { icon: 'work',          label: 'Occupation',  value: customer.occupation },
                                    { icon: 'cake',          label: 'Date of Birth', value: customer.date_of_birth ? formatDate(customer.date_of_birth) : null },
                                ].filter(i => i.value).map((item, i) => (
                                    <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-3">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="material-symbols-outlined text-slate-400 text-sm">{item.icon}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{item.label}</span>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-700 ml-6">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Address */}
                        {(customer.address || customer.office_address) && (
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Addresses</p>
                                <div className="space-y-2">
                                    {customer.address && (
                                        <div className="bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-3">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Residential</p>
                                            <p className="text-sm text-slate-700">{customer.address}</p>
                                        </div>
                                    )}
                                    {customer.office_address && (
                                        <div className="bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-3">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Office</p>
                                            <p className="text-sm text-slate-700">{customer.office_address}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {customer.notes && (
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">sticky_note_2</span> Notes
                                </p>
                                <p className="text-sm text-amber-900">{customer.notes}</p>
                            </div>
                        )}

                        {/* Purchases summary */}
                        {customerSales.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Purchase History</p>
                                <div className="space-y-2">
                                    {customerSales.map(s => (
                                        <div key={s.id} className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-emerald-800">{s.car?.year} {s.car?.make} {s.car?.model}</p>
                                                <p className="text-xs text-emerald-600">{formatDate(s.sale_date || s.created_at)}</p>
                                            </div>
                                            <p className="text-sm font-bold text-emerald-700">{formatCurrency(s.final_price)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ────────────────────────────────
                    TAB: DEALS & DATES
                ──────────────────────────────── */}
                {activeTab === 'deals' && (
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-slate-700">Deal Records</p>
                                <p className="text-xs text-slate-400">Track inquiry → deal → RTO → delivery lifecycle</p>
                            </div>
                            <button
                                onClick={() => { setIsAddingDeal(true); setEditingDeal(null); setDealForm(emptyDealForm); }}
                                className="h-9 px-4 bg-primary text-white font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-primary-light transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">add</span> Add Deal
                            </button>
                        </div>

                        {/* Deal Form Modal */}
                        {isAddingDeal && (
                            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                                    <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 pt-5 pb-6 shrink-0">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h2 className="text-lg font-black text-white">{editingDeal ? 'Edit Deal' : 'Add Deal Record'}</h2>
                                                <p className="text-white/50 text-xs">Document all dates and details for this deal</p>
                                            </div>
                                            <button onClick={() => { setIsAddingDeal(false); setEditingDeal(null); }} className="size-8 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center">
                                                <span className="material-symbols-outlined text-white text-lg">close</span>
                                            </button>
                                        </div>
                                    </div>
                                    <form onSubmit={handleSaveDeal} className="flex-1 overflow-y-auto p-6 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Deal Type *</label>
                                                <select value={dealForm.deal_type} onChange={e => setDealForm({ ...dealForm, deal_type: e.target.value as any })} className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                                    {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Status</label>
                                                <select value={dealForm.deal_status} onChange={e => setDealForm({ ...dealForm, deal_status: e.target.value as any })} className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                                    {Object.entries(DEAL_STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Inventory search */}
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Vehicle (search by make/model/reg)</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={inventorySearch}
                                                    onChange={e => setInventorySearch(e.target.value)}
                                                    placeholder="Search inventory…"
                                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                                />
                                                {inventoryList.length > 0 && (
                                                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl mt-1 shadow-lg z-10">
                                                        {inventoryList.map(car => (
                                                            <button
                                                                key={car.id}
                                                                type="button"
                                                                onClick={() => { setDealForm({ ...dealForm, inventory_id: car.id }); setInventorySearch(`${car.year} ${car.make} ${car.model}`); setInventoryList([]); }}
                                                                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm"
                                                            >
                                                                <span className="font-semibold">{car.year} {car.make} {car.model}</span>
                                                                <span className="text-slate-400 ml-2 text-xs">{car.registration_no || 'No Reg'} · {car.status}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {dealForm.inventory_id && <p className="text-[10px] text-primary mt-1">✓ Vehicle ID: {dealForm.inventory_id.slice(0, 8)}…</p>}
                                        </div>

                                        {/* Key Dates */}
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-2">Key Dates</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { label: 'Inquiry Date',             key: 'inquiry_date'                 },
                                                { label: 'Deal Finalised Date',      key: 'deal_date'                    },
                                                { label: 'RTO / RC Transfer Date',   key: 'rto_date'                     },
                                                { label: 'Delivery Date (Scheduled)',key: 'delivery_date'                },
                                                { label: 'Handover Date (Actual)',    key: 'handover_date'                },
                                                { label: 'Hypothecation Clearance',  key: 'hypothecation_clearance_date' },
                                            ].map(f => (
                                                <div key={f.key}>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{f.label}</label>
                                                    <input type="date" value={(dealForm as any)[f.key]} onChange={e => setDealForm({ ...dealForm, [f.key]: e.target.value })} className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                                </div>
                                            ))}
                                        </div>

                                        {/* Financials */}
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-2">Financials</p>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { label: 'Total Amount (₹)', key: 'total_amount' },
                                                { label: 'Advance Paid (₹)', key: 'advance_paid' },
                                                { label: 'Balance Due (₹)',  key: 'balance_due'  },
                                            ].map(f => (
                                                <div key={f.key}>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{f.label}</label>
                                                    <input type="number" value={(dealForm as any)[f.key]} onChange={e => setDealForm({ ...dealForm, [f.key]: e.target.value })} className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                                </div>
                                            ))}
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Payment Mode</label>
                                            <select value={dealForm.payment_mode} onChange={e => setDealForm({ ...dealForm, payment_mode: e.target.value })} className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                                <option value="">Select…</option>
                                                {['Cash', 'Cheque', 'Online / NEFT', 'Finance / Loan', 'Mixed'].map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Notes</label>
                                            <textarea rows={2} value={dealForm.notes} onChange={e => setDealForm({ ...dealForm, notes: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/10 resize-none" />
                                        </div>
                                        {isAdmin && (
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Internal Notes (Admin Only)</label>
                                                <textarea rows={2} value={dealForm.internal_notes} onChange={e => setDealForm({ ...dealForm, internal_notes: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/10 resize-none bg-amber-50 border-amber-200" />
                                            </div>
                                        )}
                                        <div className="flex gap-3 pt-2">
                                            <button type="button" onClick={() => { setIsAddingDeal(false); setEditingDeal(null); }} className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm">Cancel</button>
                                            <button type="submit" disabled={dealSaving} className="flex-1 h-11 bg-primary text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                                                {dealSaving ? <><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : 'Save Deal'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* Deal Cards */}
                        {dealsLoading ? (
                            <div className="py-16 flex items-center justify-center"><span className="size-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
                        ) : deals.length === 0 ? (
                            <div className="py-16 text-center">
                                <span className="material-symbols-outlined text-4xl text-slate-200 block mb-3">handshake</span>
                                <p className="text-slate-400 font-medium">No deals recorded yet</p>
                                <p className="text-xs text-slate-300 mt-1">Add a deal to track inquiry, dates, and financials.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {deals.map(deal => {
                                    const dt = DEAL_TYPES.find(t => t.value === deal.deal_type);
                                    const st = DEAL_STATUS_CONFIG[deal.deal_status];
                                    const balance = deal.balance_due || 0;
                                    const dealDocs = documents.filter(d => d.deal_id === deal.id);
                                    const expiringDealDocs = dealDocs.filter(d => {
                                        const days = getDaysUntilExpiry(d.expiry_date);
                                        return days !== null && days <= 30;
                                    });
                                    return (
                                        <div key={deal.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                                            {/* Deal header */}
                                            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-10 rounded-xl flex items-center justify-center bg-${dt?.color || 'slate'}-100`}>
                                                        <span className={`material-symbols-outlined text-${dt?.color || 'slate'}-600 text-lg`}>{dt?.icon || 'handshake'}</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800">{dt?.label || deal.deal_type}</p>
                                                        {deal.car && <p className="text-xs text-slate-500">{deal.car.year} {deal.car.make} {deal.car.model} {deal.car.registration_no ? `· ${deal.car.registration_no}` : ''}</p>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {expiringDealDocs.length > 0 && (
                                                        <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-lg animate-pulse flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-xs">warning</span>
                                                            {expiringDealDocs.length} doc{expiringDealDocs.length !== 1 ? 's' : ''} expiring
                                                        </span>
                                                    )}
                                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${st.color}`}>{st.label}</span>
                                                    {isAdmin && (
                                                        <div className="flex gap-1">
                                                            <button onClick={() => openEditDeal(deal)} className="size-7 rounded-lg bg-slate-50 hover:bg-primary/10 text-slate-400 hover:text-primary flex items-center justify-center transition-colors">
                                                                <span className="material-symbols-outlined text-sm">edit</span>
                                                            </button>
                                                            <button onClick={() => handleDeleteDeal(deal.id)} className="size-7 rounded-lg bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors">
                                                                <span className="material-symbols-outlined text-sm">delete</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                             {/* Date timeline strip */}
                                            <div className="px-5 py-4">
                                                <div className="flex gap-2 overflow-x-auto pb-1">
                                                    {[
                                                        { label: 'Inquiry',      date: deal.inquiry_date,                  icon: 'person_search', color: 'blue'    },
                                                        { label: 'Deal Date',    date: deal.deal_date,                     icon: 'handshake',     color: 'emerald' },
                                                        { label: 'RTO',          date: deal.rto_date,                      icon: 'account_balance',color: 'purple' },
                                                        { label: 'Delivery',     date: deal.delivery_date,                 icon: 'local_shipping', color: 'amber'  },
                                                        { label: 'Handover',     date: deal.handover_date,                 icon: 'key',            color: 'green'  },
                                                        { label: 'Hypo Clear',   date: deal.hypothecation_clearance_date,  icon: 'lock_open',      color: 'slate'  },
                                                    ].map((step, i) => (
                                                        <div key={i} className={`flex flex-col items-center min-w-[80px] p-2 rounded-xl text-center ${step.date ? 'bg-slate-50' : 'opacity-40'}`}>
                                                            <span className={`material-symbols-outlined text-sm text-${step.color}-500 mb-1`}>{step.icon}</span>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{step.label}</p>
                                                            <p className={`text-[10px] font-bold mt-0.5 ${step.date ? 'text-slate-700' : 'text-slate-300'}`}>
                                                                {step.date ? formatDate(step.date) : '—'}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Buyer & Seller Linkage Section */}
                                            <div className="px-5 pb-4 border-t border-slate-50 pt-3">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-xs">group</span> Deal Parties & Legal Contact Linkage
                                                </p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {/* Buyer Card */}
                                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex items-start justify-between">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide bg-emerald-100/60 px-2 py-0.5 rounded-md inline-block mb-1">
                                                                👤 Buyer (Purchaser)
                                                            </span>
                                                            <p className="text-xs font-bold text-slate-800">{customer.full_name}</p>
                                                            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                                <span className="material-symbols-outlined text-[11px]">call</span> {customer.phone}
                                                            </p>
                                                            {customer.address && <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]">{customer.address}</p>}
                                                        </div>
                                                    </div>

                                                    {/* Seller Card */}
                                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex items-start justify-between">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide bg-amber-100/60 px-2 py-0.5 rounded-md inline-block mb-1">
                                                                🏷️ Seller / Previous Owner
                                                            </span>
                                                            {deal.seller_customer_id ? (
                                                                <div>
                                                                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1">
                                                                        Seller Linked
                                                                        <Link to={`/admin/customers/${deal.seller_customer_id}`} className="text-primary hover:underline text-[10px] font-bold">
                                                                            [View Seller 360 Hub]
                                                                        </Link>
                                                                    </p>
                                                                    <p className="text-[11px] text-slate-500 mt-0.5">Customer ID: {deal.seller_customer_id.slice(0, 8)}…</p>
                                                                </div>
                                                            ) : (
                                                                <div>
                                                                    <p className="text-xs font-bold text-slate-700">Consignment / Dealership Inventory</p>
                                                                    <p className="text-[10px] text-slate-400 mt-0.5">Original vehicle purchase & NOC records stored in Document Vault</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Financials */}
                                            {(deal.total_amount || deal.advance_paid || deal.balance_due) && (
                                                <div className="px-5 pb-4">
                                                    <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-xl p-3">
                                                        <div className="text-center">
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Total</p>
                                                            <p className="text-sm font-black text-slate-700">{formatCurrency(deal.total_amount)}</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Advance</p>
                                                            <p className="text-sm font-black text-emerald-600">{formatCurrency(deal.advance_paid)}</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Balance</p>
                                                            <p className={`text-sm font-black ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(deal.balance_due)}</p>
                                                        </div>
                                                    </div>
                                                    {deal.payment_mode && <p className="text-[10px] text-slate-400 mt-2 text-center">Payment: {deal.payment_mode}</p>}
                                                </div>
                                            )}

                                            {/* ── Deal Document Vault & Quick Upload ── */}
                                            <div className="px-5 pb-4 border-t border-slate-50 pt-3">
                                                <div className="flex items-center justify-between mb-2.5">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-xs">folder_open</span>
                                                        Attached Deal Documents ({dealDocs.length})
                                                    </p>
                                                    <button
                                                        onClick={() => {
                                                            setIsAddingDoc(true);
                                                            setEditingDoc(null);
                                                            setUploadModalTab('batch');
                                                            setBatchItems([]);
                                                            setBatchDefaultDealId(deal.id);
                                                            setDocForm({ ...emptyDocForm, deal_id: deal.id });
                                                        }}
                                                        className="text-[11px] font-bold text-primary hover:text-primary-light bg-primary/5 hover:bg-primary/10 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-xs">note_add</span>
                                                        + Attach Document to Deal
                                                    </button>
                                                </div>

                                                {dealDocs.length === 0 ? (
                                                    <div className="bg-slate-50/70 border border-dashed border-slate-200 rounded-xl p-3.5 text-center">
                                                        <p className="text-xs text-slate-400 font-medium mb-1.5">No documents attached to this deal yet</p>
                                                        <button
                                                            onClick={() => {
                                                                setIsAddingDoc(true);
                                                                setEditingDoc(null);
                                                                setUploadModalTab('batch');
                                                                setBatchItems([]);
                                                                setBatchDefaultDealId(deal.id);
                                                                setDocForm({ ...emptyDocForm, deal_id: deal.id });
                                                            }}
                                                            className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                                                        >
                                                            <span className="material-symbols-outlined text-xs">upload_file</span>
                                                            Attach Buyer/Seller/RTO Document
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                        {dealDocs.map(doc => {
                                                            const badge = getExpiryBadge(doc.expiry_date);
                                                            const roleConfig = {
                                                                buyer: { label: '👤 Buyer', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                                                                seller: { label: '🏷️ Seller', color: 'bg-amber-50 text-amber-700 border-amber-100' },
                                                                general: { label: '🗂️ General', color: 'bg-slate-50 text-slate-600 border-slate-100' },
                                                            }[doc.party_role || 'general'];
                                                            const docTypeName = getDocLabel(doc.doc_type);

                                                            return (
                                                                <div key={doc.id} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-start justify-between gap-2.5 hover:border-slate-300 hover:bg-slate-50/80 transition-all">
                                                                    <div className="min-w-0 flex-1">
                                                                        {/* Badges row: Role + Document Type Badge */}
                                                                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                                                                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${roleConfig.color}`}>
                                                                                {roleConfig.label}
                                                                            </span>
                                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200/80 flex items-center gap-1">
                                                                                <span className="material-symbols-outlined text-[11px]">{getDocTypeIcon(doc.doc_type)}</span>
                                                                                {docTypeName}
                                                                            </span>
                                                                        </div>

                                                                        {/* Custom Label or Filename */}
                                                                        <p className="text-xs font-black text-slate-800 truncate" title={doc.doc_label || doc.file_name || docTypeName}>
                                                                            {doc.doc_label || doc.file_name || docTypeName}
                                                                        </p>
                                                                        {doc.file_name && doc.doc_label && doc.file_name !== doc.doc_label && (
                                                                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                                                                File: {doc.file_name}
                                                                            </p>
                                                                        )}

                                                                        {/* Date & Expiry */}
                                                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                                            {doc.issue_date && <span className="text-[10px] text-slate-400 font-medium">Issued: {formatDate(doc.issue_date)}</span>}
                                                                            {badge && (
                                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${badge.cls} ${badge.pulse ? 'animate-pulse' : ''}`}>
                                                                                    <span className="material-symbols-outlined text-[10px]">{badge.icon}</span>
                                                                                    {badge.label}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                                                        {doc.file_url && (
                                                                            <a
                                                                                href={doc.file_url}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="size-7 rounded-lg bg-white border border-slate-200 hover:bg-primary hover:text-white hover:border-primary text-slate-500 flex items-center justify-center transition-all"
                                                                                title="View Document"
                                                                            >
                                                                                <span className="material-symbols-outlined text-xs">open_in_new</span>
                                                                            </a>
                                                                        )}
                                                                        {doc.file_url && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDownloadDoc(doc)}
                                                                                disabled={downloadingDocId === doc.id}
                                                                                className="size-7 rounded-lg bg-white border border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 text-slate-400 flex items-center justify-center transition-colors disabled:opacity-50"
                                                                                title="Download Document"
                                                                            >
                                                                                {downloadingDocId === doc.id ? (
                                                                                    <span className="size-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                                                                ) : (
                                                                                    <span className="material-symbols-outlined text-xs">download</span>
                                                                                )}
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openEditDoc(doc)}
                                                                            className="size-7 rounded-lg bg-white border border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 text-slate-400 flex items-center justify-center transition-colors"
                                                                            title="Edit Document"
                                                                        >
                                                                            <span className="material-symbols-outlined text-xs">edit</span>
                                                                        </button>
                                                                        {isAdmin && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDeleteDoc(doc.id)}
                                                                                className="size-7 rounded-lg bg-white border border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 text-slate-400 flex items-center justify-center transition-colors"
                                                                                title="Delete Document"
                                                                            >
                                                                                <span className="material-symbols-outlined text-xs">delete</span>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {deal.notes && <div className="px-5 pb-4 text-xs text-slate-500 italic border-t border-slate-50 pt-3">{deal.notes}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ────────────────────────────────
                    TAB: DOCUMENTS
                ──────────────────────────────── */}
                {activeTab === 'documents' && (
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-slate-700">Documents</p>
                                <p className="text-xs text-slate-400">Buyer docs, seller docs, general KYC — tracked per deal</p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsAddingDoc(true);
                                    setEditingDoc(null);
                                    setUploadModalTab('batch');
                                    setBatchItems([]);
                                    setBatchDefaultDealId('');
                                    setDocForm(emptyDocForm);
                                }}
                                className="h-9 px-4 bg-primary text-white font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-primary-light transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">upload_file</span> Add Document
                            </button>
                        </div>

                        {/* Expiry Alert Banner */}
                        {criticalDocs.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                <span className="material-symbols-outlined text-red-500 text-xl shrink-0 mt-0.5">warning</span>
                                <div>
                                    <p className="text-sm font-bold text-red-700">{criticalDocs.length} document{criticalDocs.length !== 1 ? 's' : ''} expiring within 30 days</p>
                                    <p className="text-xs text-red-600 mt-0.5">
                                        {criticalDocs.map(d => getDocLabel(d.doc_type)).join(', ')}
                                    </p>
                                </div>
                                <Link to="/admin/customer-alerts" className="ml-auto text-xs font-bold text-red-600 hover:text-red-800 whitespace-nowrap">
                                    View All Alerts →
                                </Link>
                            </div>
                        )}

                        {/* Filter Controls & Search */}
                        <div className="flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex-wrap">
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-0">
                                {[
                                    { id: 'all', label: 'All Documents' },
                                    { id: 'buyer', label: '👤 Buyer Docs' },
                                    { id: 'seller', label: '🏷️ Seller Docs' },
                                    { id: 'general', label: '🗂️ General / KYC' },
                                ].map(f => (
                                    <button
                                        key={f.id}
                                        onClick={() => setDocPartyRoleFilter(f.id as any)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                            docPartyRoleFilter === f.id
                                                ? 'bg-white text-primary shadow-xs border border-slate-200'
                                                : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-9 min-w-[220px]">
                                <span className="material-symbols-outlined text-slate-400 text-base">search</span>
                                <input
                                    value={docSearchQuery}
                                    onChange={e => setDocSearchQuery(e.target.value)}
                                    placeholder="Search document name, type..."
                                    className="bg-transparent text-xs text-primary outline-none w-full"
                                />
                                {docSearchQuery && (
                                    <button onClick={() => setDocSearchQuery('')} className="material-symbols-outlined text-slate-300 text-xs hover:text-slate-500">
                                        close
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Document Add Form moved to root */}

                        {/* Documents grouped by Deal */}
                        {docsLoading ? (
                            <div className="py-16 flex items-center justify-center"><span className="size-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
                        ) : documents.length === 0 ? (
                            <div className="py-16 text-center">
                                <span className="material-symbols-outlined text-4xl text-slate-200 block mb-3">folder_open</span>
                                <p className="text-slate-400 font-medium">No documents yet</p>
                                <p className="text-xs text-slate-300 mt-1">Add buyer/seller/KYC documents to track expiry.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {Object.entries(documentsByDeal).map(([dealKey, docs]) => {
                                    const deal = deals.find(d => d.id === dealKey);
                                    const dt = DEAL_TYPES.find(t => t.value === deal?.deal_type);
                                    return (
                                        <div key={dealKey} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-slate-400 text-sm">{deal ? (dt?.icon || 'handshake') : 'badge'}</span>
                                                <p className="text-xs font-bold text-slate-600">
                                                    {deal
                                                        ? `${dt?.label} — ${deal.car ? `${deal.car.year} ${deal.car.make} ${deal.car.model}` : 'Vehicle TBD'} (${formatDate(deal.deal_date || deal.created_at)})`
                                                        : 'General Documents (not linked to a deal)'}
                                                </p>
                                                <span className="ml-auto text-[10px] font-bold text-slate-400">{docs.length} file{docs.length !== 1 ? 's' : ''}</span>
                                            </div>
                                            <div className="divide-y divide-slate-50">
                                                {/* Group by party_role */}
                                                {(['buyer', 'seller', 'general'] as const).map(role => {
                                                    const roleDocs = docs.filter(d => d.party_role === role);
                                                    if (roleDocs.length === 0) return null;
                                                    const roleLabel = { buyer: '👤 Buyer Documents', seller: '🏷️ Seller Documents', general: '🗂️ General / KYC' }[role];
                                                    return (
                                                        <div key={role}>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2 bg-slate-50/50">{roleLabel}</p>
                                                            {roleDocs.map(doc => {
                                                                const badge = getExpiryBadge(doc.expiry_date);
                                                                return (
                                                                    <div key={doc.id} className="flex items-start gap-3.5 px-4 py-3.5 hover:bg-slate-50/70 transition-colors">
                                                                        <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                                                                            <span className="material-symbols-outlined text-lg">{getDocTypeIcon(doc.doc_type)}</span>
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                                <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                                    <span className="material-symbols-outlined text-[12px]">{getDocTypeIcon(doc.doc_type)}</span>
                                                                                    {getDocLabel(doc.doc_type)}
                                                                                </span>
                                                                                <span className="text-sm font-black text-slate-800 truncate">
                                                                                    {doc.doc_label || doc.file_name || getDocLabel(doc.doc_type)}
                                                                                </span>
                                                                            </div>
                                                                            {doc.file_name && doc.doc_label && doc.file_name !== doc.doc_label && (
                                                                                <p className="text-[11px] text-slate-400 mt-0.5">File: {doc.file_name}</p>
                                                                            )}
                                                                            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                                                                                {doc.issue_date && <span className="text-[10px] text-slate-400 font-medium">Issued: {formatDate(doc.issue_date)}</span>}
                                                                                {badge && (
                                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-0.5 ${badge.cls} ${badge.pulse ? 'animate-pulse' : ''}`}>
                                                                                        <span className="material-symbols-outlined text-[11px]">{badge.icon}</span>
                                                                                        {badge.label}
                                                                                    </span>
                                                                                )}
                                                                                {doc.is_verified && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-lg">✓ Verified</span>}
                                                                            </div>
                                                                            {doc.notes && <p className="text-[10px] text-slate-400 mt-1 italic">{doc.notes}</p>}
                                                                        </div>
                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                            {/* View File */}
                                                                            {doc.file_url && (
                                                                                <a
                                                                                    href={doc.file_url}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className="size-8 rounded-lg bg-slate-50 hover:bg-primary/10 text-slate-400 hover:text-primary flex items-center justify-center transition-colors"
                                                                                    title="View file"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                                                                                </a>
                                                                            )}

                                                                            {/* Download File */}
                                                                            {doc.file_url && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleDownloadDoc(doc)}
                                                                                    disabled={downloadingDocId === doc.id}
                                                                                    className="size-8 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 flex items-center justify-center transition-colors disabled:opacity-50"
                                                                                    title="Download document file"
                                                                                >
                                                                                    {downloadingDocId === doc.id ? (
                                                                                        <span className="size-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                                                                    ) : (
                                                                                        <span className="material-symbols-outlined text-sm">download</span>
                                                                                    )}
                                                                                </button>
                                                                            )}

                                                                            {/* Edit Document */}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openEditDoc(doc)}
                                                                                className="size-8 rounded-lg bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-600 flex items-center justify-center transition-colors"
                                                                                title="Edit document & expiry"
                                                                            >
                                                                                <span className="material-symbols-outlined text-sm">edit</span>
                                                                            </button>

                                                                            {/* Delete Document */}
                                                                            {isAdmin && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleDeleteDoc(doc.id)}
                                                                                    className="size-8 rounded-lg bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors"
                                                                                    title="Delete document"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ────────────────────────────────
                    TAB: TIMELINE
                ──────────────────────────────── */}
                {activeTab === 'timeline' && (
                    <div className="p-6">
                        {timelineLoading ? (
                            <div className="py-16 flex items-center justify-center"><span className="size-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
                        ) : timeline.length === 0 ? (
                            <div className="py-16 text-center">
                                <span className="material-symbols-outlined text-4xl text-slate-200 block mb-3">timeline</span>
                                <p className="text-slate-400 font-medium">No activity yet</p>
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-100" />
                                <div className="space-y-4 pl-10">
                                    {timeline.map(event => (
                                        <div key={event.id} className="relative">
                                            <div className={`absolute -left-10 size-8 rounded-xl flex items-center justify-center ${timelineColorMap[event.color] || 'bg-slate-100 text-slate-500'}`}>
                                                <span className="material-symbols-outlined text-sm">{event.icon}</span>
                                            </div>
                                            <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-sm font-bold text-slate-700">{event.title}</p>
                                                    <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">{formatDate(event.date.toISOString())}</span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>
                                                {event.status && (
                                                    <span className="mt-1.5 inline-block text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{event.status}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ────────────────────────────────
                    TAB: AUDIT LOGS
                ──────────────────────────────── */}
                {activeTab === 'logs' && (
                    <div className="p-6 space-y-3">
                        <p className="text-xs text-slate-400">Activity logs related to this customer</p>
                        {logsLoading ? (
                            <div className="py-16 flex items-center justify-center"><span className="size-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
                        ) : logs.length === 0 ? (
                            <div className="py-16 text-center">
                                <span className="material-symbols-outlined text-4xl text-slate-200 block mb-3">history</span>
                                <p className="text-slate-400 font-medium">No audit logs found</p>
                            </div>
                        ) : (
                            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                            <th className="text-left px-4 py-3">Action</th>
                                            <th className="text-left px-4 py-3">Details</th>
                                            <th className="text-left px-4 py-3">By</th>
                                            <th className="text-left px-4 py-3">When</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map((log: any) => (
                                            <tr key={log.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                                                <td className="px-4 py-3 text-xs font-bold text-primary">{log.action}</td>
                                                <td className="px-4 py-3 text-xs text-slate-500">{log.details || '—'}</td>
                                                <td className="px-4 py-3 text-xs text-slate-500">{(log.profiles as any)?.full_name || '—'}</td>
                                                <td className="px-4 py-3 text-[10px] text-slate-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Document Add / Edit Modal (Multi-File Batch + Single Document with Compression) */}
            {isAddingDoc && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className={`bg-white rounded-3xl shadow-2xl w-full ${!editingDoc && uploadModalTab === 'batch' ? 'max-w-3xl' : 'max-w-lg'} max-h-[92vh] overflow-hidden flex flex-col transition-all duration-300`}>
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-primary to-primary-light px-6 pt-5 pb-5 shrink-0">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-black text-white">
                                            {editingDoc ? 'Edit Document' : 'Upload Customer & Deal Documents'}
                                        </h2>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/20">
                                            Auto-Compress: PDF ≤1.4MB · Image ≤600KB
                                        </span>
                                    </div>
                                    <p className="text-white/75 text-xs mt-0.5">
                                        {editingDoc
                                            ? 'Update document metadata, expiry date or replace file'
                                            : 'Upload multiple PDFs and photos with automatic lossless compression'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsAddingDoc(false);
                                        setEditingDoc(null);
                                        setDocForm(emptyDocForm);
                                        setBatchItems([]);
                                    }}
                                    className="size-8 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-colors text-white"
                                >
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            </div>

                            {/* Mode Toggle when Adding */}
                            {!editingDoc && (
                                <div className="flex items-center gap-2 mt-4 bg-black/20 p-1 rounded-xl w-fit">
                                    <button
                                        type="button"
                                        onClick={() => setUploadModalTab('batch')}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            uploadModalTab === 'batch'
                                                ? 'bg-white text-primary shadow-sm'
                                                : 'text-white/80 hover:text-white'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-xs">folder_zip</span>
                                        Multiple Files ({batchItems.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setUploadModalTab('single')}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            uploadModalTab === 'single'
                                                ? 'bg-white text-primary shadow-sm'
                                                : 'text-white/80 hover:text-white'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-xs">description</span>
                                        Single Document & URL
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Modal Body */}
                        {!editingDoc && uploadModalTab === 'batch' ? (
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {/* Global Batch Linkage Defaults */}
                                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Default Linkage Settings for All Files
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                                Link All To Deal
                                            </label>
                                            <select
                                                value={batchDefaultDealId}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setBatchDefaultDealId(val);
                                                    setBatchItems(prev => prev.map(b => ({ ...b, deal_id: val })));
                                                }}
                                                className="w-full h-9 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-primary/10 bg-white font-medium text-slate-700"
                                            >
                                                <option value="">General Documents (not deal-specific)</option>
                                                {deals.map(d => {
                                                    const dt = DEAL_TYPES.find(t => t.value === d.deal_type);
                                                    return (
                                                        <option key={d.id} value={d.id}>
                                                            {dt?.label} — {d.car ? `${d.car.year} ${d.car.make} ${d.car.model}` : 'Vehicle TBD'} ({formatDate(d.deal_date || d.created_at)})
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                                Default Party Role
                                            </label>
                                            <select
                                                value={batchDefaultPartyRole}
                                                onChange={e => {
                                                    const val = e.target.value as any;
                                                    setBatchDefaultPartyRole(val);
                                                    setBatchItems(prev => prev.map(b => ({ ...b, party_role: val })));
                                                }}
                                                className="w-full h-9 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-primary/10 bg-white font-medium text-slate-700"
                                            >
                                                <option value="buyer">👤 Buyer's Document</option>
                                                <option value="seller">🏷️ Seller's Document</option>
                                                <option value="general">🗂️ General / KYC</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Drag & Drop Multi-file Dropzone */}
                                <div
                                    onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                                    onDragLeave={e => { e.preventDefault(); setIsDragOver(false); }}
                                    onDrop={e => {
                                        e.preventDefault();
                                        setIsDragOver(false);
                                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                            handleBatchFileSelect(e.dataTransfer.files);
                                        }
                                    }}
                                    className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                                        isDragOver
                                            ? 'border-primary bg-primary/5 ring-4 ring-primary/10'
                                            : 'border-slate-300 hover:border-primary hover:bg-slate-50/60'
                                    }`}
                                >
                                    <input
                                        type="file"
                                        multiple
                                        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
                                        onChange={e => {
                                            if (e.target.files && e.target.files.length > 0) {
                                                handleBatchFileSelect(e.target.files);
                                            }
                                        }}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                    />
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                                            <span className="material-symbols-outlined text-2xl">upload_file</span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-800">
                                            Drop multiple PDF documents or photos here
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Or <span className="text-primary font-bold hover:underline">browse from device</span> · Supports batch selection
                                        </p>
                                        <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
                                            <span className="text-[10px] font-semibold bg-red-50 text-red-700 px-2 py-0.5 rounded-md border border-red-100">
                                                PDF Max 1.4 MB
                                            </span>
                                            <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
                                                Photos Max 600 KB
                                            </span>
                                            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100">
                                                Lossless Clarity Preserved
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Files Queue List */}
                                {batchItems.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-sm text-primary">checklist</span>
                                                Queued Documents ({batchItems.length})
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => setBatchItems([])}
                                                className="text-[11px] font-bold text-red-500 hover:text-red-700 transition-colors"
                                            >
                                                Clear Queue
                                            </button>
                                        </div>

                                        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                                            {batchItems.map((item, idx) => {
                                                const isPdf = item.originalFile.type === 'application/pdf' || item.originalFile.name.toLowerCase().endsWith('.pdf');
                                                const hasExpiry = docTypeHasExpiry(item.doc_type);

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs hover:border-slate-300 transition-all space-y-2.5"
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${
                                                                    isPdf ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                                                }`}>
                                                                    <span className="material-symbols-outlined text-sm">
                                                                        {isPdf ? 'picture_as_pdf' : 'image'}
                                                                    </span>
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-bold text-slate-800 truncate" title={item.originalFile.name}>
                                                                        {item.originalFile.name}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[10px]">
                                                                        <span className="text-slate-400">
                                                                            Original: {(item.originalSizeKb / 1024).toFixed(1)} MB ({item.originalSizeKb} KB)
                                                                        </span>
                                                                        {item.status === 'compressing' ? (
                                                                            <span className="text-primary font-bold flex items-center gap-1">
                                                                                <span className="size-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                                                                {item.statusText}
                                                                            </span>
                                                                        ) : item.status === 'ready' || item.status === 'done' ? (
                                                                            <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                                                                                Compressed: {item.compressedSizeKb} KB {item.reductionPercent > 0 ? `(-${item.reductionPercent}%)` : ''}
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setBatchItems(curr => curr.filter(b => b.id !== item.id))}
                                                                className="size-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0"
                                                                title="Remove file"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">delete</span>
                                                            </button>
                                                        </div>

                                                        {/* Document Metadata Form for this specific item */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-xs">
                                                            <div>
                                                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Document Type</label>
                                                                <select
                                                                    value={item.doc_type}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        setBatchItems(curr => curr.map(b => b.id === item.id ? { ...b, doc_type: val } : b));
                                                                    }}
                                                                    className="w-full h-8 border border-slate-200 rounded-lg px-2 text-xs outline-none bg-white font-medium"
                                                                >
                                                                    {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                                </select>
                                                            </div>

                                                            <div>
                                                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Party Role</label>
                                                                <select
                                                                    value={item.party_role}
                                                                    onChange={e => {
                                                                        const val = e.target.value as any;
                                                                        setBatchItems(curr => curr.map(b => b.id === item.id ? { ...b, party_role: val } : b));
                                                                    }}
                                                                    className="w-full h-8 border border-slate-200 rounded-lg px-2 text-xs outline-none bg-white font-medium"
                                                                >
                                                                    <option value="buyer">Buyer</option>
                                                                    <option value="seller">Seller</option>
                                                                    <option value="general">General</option>
                                                                </select>
                                                            </div>

                                                            <div>
                                                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">
                                                                    Expiry Date {hasExpiry && <span className="text-red-500 font-bold">*</span>}
                                                                </label>
                                                                <input
                                                                    type="date"
                                                                    value={item.expiry_date}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        setBatchItems(curr => curr.map(b => b.id === item.id ? { ...b, expiry_date: val } : b));
                                                                    }}
                                                                    className={`w-full h-8 border rounded-lg px-2 text-xs outline-none ${
                                                                        hasExpiry ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'
                                                                    }`}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Batch Action Footer */}
                                <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAddingDoc(false);
                                            setBatchItems([]);
                                            setDocForm(emptyDocForm);
                                        }}
                                        className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold rounded-xl text-xs hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={
                                            batchItems.length === 0 ||
                                            isBatchUploading ||
                                            batchItems.some(b => b.status === 'compressing')
                                        }
                                        onClick={handleBatchUploadSave}
                                        className="flex-2 h-11 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-md shadow-primary/20"
                                    >
                                        {isBatchUploading ? (
                                            <>
                                                <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Uploading {batchOverallProgress}%…
                                            </>
                                        ) : batchItems.some(b => b.status === 'compressing') ? (
                                            <>
                                                <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Optimizing Files…
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-sm">cloud_upload</span>
                                                Upload & Save All ({batchItems.length}) Documents
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Single Document Form & Edit View */
                            <form onSubmit={handleSaveDoc} className="flex-1 overflow-y-auto p-6 space-y-4">
                                {/* Link to Deal */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Link to Deal (optional)</label>
                                    <select value={docForm.deal_id} onChange={e => setDocForm({ ...docForm, deal_id: e.target.value })} className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                        <option value="">General (not deal-specific)</option>
                                        {deals.map(d => {
                                            const dt = DEAL_TYPES.find(t => t.value === d.deal_type);
                                            return (
                                                <option key={d.id} value={d.id}>
                                                    {dt?.label} — {d.car ? `${d.car.year} ${d.car.make} ${d.car.model}` : 'Vehicle TBD'} ({formatDate(d.deal_date || d.created_at)})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Document Type *</label>
                                        <select required value={docForm.doc_type} onChange={e => setDocForm({ ...docForm, doc_type: e.target.value })} className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                            {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Party Role *</label>
                                        <select value={docForm.party_role} onChange={e => setDocForm({ ...docForm, party_role: e.target.value as any })} className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                            <option value="buyer">Buyer's Document</option>
                                            <option value="seller">Seller's Document</option>
                                            <option value="general">General / KYC</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Custom Label (optional)</label>
                                    <input type="text" value={docForm.doc_label} onChange={e => setDocForm({ ...docForm, doc_label: e.target.value })} placeholder="e.g. Wife's Aadhaar, Previous Owner RC" className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>

                                {/* File Upload */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                        {editingDoc?.file_url ? 'Replace File (optional)' : 'Upload File (PDF / Image)'}
                                    </label>
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
                                        onChange={async e => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const url = await handleUploadFile(file);
                                            if (url) setDocForm({ ...docForm, file_url: url, file_name: file.name });
                                        }}
                                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                    />
                                    {uploadingFile && (
                                        <p className="text-xs text-primary mt-1.5 flex items-center gap-1.5 bg-primary/5 p-2 rounded-lg font-medium">
                                            <span className="size-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                            {uploadStatusText || 'Uploading & Compressing…'}
                                        </p>
                                    )}
                                    {docForm.file_url && !uploadingFile && (
                                        <div className="mt-1.5 flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-600">
                                            <span className="flex items-center gap-1 text-emerald-600 font-medium truncate">
                                                <span className="material-symbols-outlined text-xs">check_circle</span>
                                                {docForm.file_name || 'File attached'}
                                            </span>
                                            <a href={docForm.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-[11px] font-bold shrink-0 ml-2">
                                                Preview
                                            </a>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Or paste file URL</label>
                                    <input type="url" value={docForm.file_url} onChange={e => setDocForm({ ...docForm, file_url: e.target.value })} placeholder="https://…" className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Issue Date</label>
                                        <input type="date" value={docForm.issue_date} onChange={e => setDocForm({ ...docForm, issue_date: e.target.value })} className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                            Expiry Date {docTypeHasExpiry(docForm.doc_type) && <span className="text-red-400">*</span>}
                                        </label>
                                        <input
                                            type="date"
                                            value={docForm.expiry_date}
                                            onChange={e => setDocForm({ ...docForm, expiry_date: e.target.value })}
                                            required={docTypeHasExpiry(docForm.doc_type)}
                                            className={`w-full h-10 border rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 ${docTypeHasExpiry(docForm.doc_type) ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}
                                        />
                                        {docTypeHasExpiry(docForm.doc_type) && <p className="text-[10px] text-amber-600 mt-0.5">Required for this document type — used for alerts</p>}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Notes</label>
                                    <textarea rows={2} value={docForm.notes} onChange={e => setDocForm({ ...docForm, notes: e.target.value })} placeholder="Add notes, document IDs, or comments..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/10 resize-none" />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => { setIsAddingDoc(false); setEditingDoc(null); setDocForm(emptyDocForm); setBatchItems([]); }} className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm">Cancel</button>
                                    <button type="submit" disabled={docSaving || uploadingFile} className="flex-1 h-11 bg-primary text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                                        {docSaving ? <><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : (editingDoc ? 'Save Changes' : 'Save Document')}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerDetail;
