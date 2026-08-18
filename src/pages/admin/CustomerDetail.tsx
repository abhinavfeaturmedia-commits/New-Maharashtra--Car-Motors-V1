import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { toWhatsAppUrl } from '../../lib/utils';
import { compressPdf } from '../../lib/pdfCompressor';
import { compressImage } from '../../lib/imageCompressor';
import {
    ArrowLeft,
    Phone,
    Mail,
    MapPin,
    Calendar,
    Briefcase,
    ShoppingBag,
    AlertTriangle,
    CheckCircle2,
    Clock,
    FileText,
    Download,
    Eye,
    Plus,
    Edit3,
    Trash2,
    Search,
    X,
    ExternalLink,
    Sparkles,
    Shield,
    FileCheck,
    Truck,
    Key,
    Lock,
    Copy,
    Check,
    MessageCircle,
    UserCheck,
    Car,
    Award,
    ChevronDown,
    ChevronUp,
    UploadCloud,
    Link2,
    Unlink,
    Printer,
    CheckCheck,
    ArrowUpRight,
    Camera,
    Star,
    Crown,
    Landmark,
    MessageSquare
} from 'lucide-react';

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
    car?: { id?: string; make: string; model: string; year: number; registration_no: string | null; thumbnail?: string | null; images?: string[] | null } | null;
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

interface StructuredNote {
    id: string;
    customer_id: string;
    note_type: 'call' | 'visit' | 'whatsapp' | 'general';
    content: string;
    created_at: string;
    created_by?: string | null;
    author_name?: string | null;
}

interface CustomerDeliveryStory {
    id: string;
    customer_id: string | null;
    inventory_id: string | null;
    sale_id: string | null;
    customer_name: string;
    customer_city: string | null;
    car_title: string;
    registration_no: string | null;
    delivery_date: string;
    photo_url: string;
    additional_photos: string[] | null;
    review_quote: string | null;
    rating: number;
    video_url: string | null;
    is_featured: boolean;
    tags: string[] | null;
    created_at: string;
}

interface TimelineEvent {
    id: string;
    type: string;
    title: string;
    description: string;
    date: Date;
    status?: string;
    icon: any;
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

const DOC_TYPES: { value: string; label: string; category: string; hasExpiry: boolean }[] = [
    { value: 'aadhaar',              label: 'Aadhaar Card',           category: 'kyc',        hasExpiry: false },
    { value: 'pan',                  label: 'PAN Card',               category: 'kyc',        hasExpiry: false },
    { value: 'voter_id',             label: 'Voter ID',               category: 'kyc',        hasExpiry: false },
    { value: 'passport',             label: 'Passport',               category: 'kyc',        hasExpiry: true  },
    { value: 'driving_license',      label: 'Driving License',        category: 'kyc',        hasExpiry: true  },
    { value: 'rc_book',              label: 'RC Book (Registration)', category: 'vehicle',    hasExpiry: false },
    { value: 'insurance',            label: 'Insurance Policy',       category: 'vehicle',    hasExpiry: true  },
    { value: 'puc',                  label: 'PUC Certificate',        category: 'vehicle',    hasExpiry: true  },
    { value: 'noc',                  label: 'Bank / RTO NOC',         category: 'vehicle',    hasExpiry: false },
    { value: 'form_20',              label: 'Form 20',                category: 'rto',        hasExpiry: false },
    { value: 'form_21',              label: 'Form 21 (Sale Cert)',    category: 'rto',        hasExpiry: false },
    { value: 'form_29',              label: 'Form 29 (Notice of Trf)',category: 'rto',        hasExpiry: false },
    { value: 'form_30',              label: 'Form 30 (Transfer App)', category: 'rto',        hasExpiry: false },
    { value: 'hypothecation_letter', label: 'Hypothecation Letter',   category: 'rto',        hasExpiry: false },
    { value: 'loan_noc',             label: 'Loan NOC Letter',        category: 'rto',        hasExpiry: false },
    { value: 'delivery_receipt',     label: 'Delivery Receipt',       category: 'agreements', hasExpiry: false },
    { value: 'sales_invoice',        label: 'Sales Invoice / Bill',   category: 'agreements', hasExpiry: false },
    { value: 'rto_receipt',          label: 'RTO Tax / Fee Receipt',  category: 'rto',        hasExpiry: false },
    { value: 'agreement',            label: 'Sale Agreement',         category: 'agreements', hasExpiry: false },
    { value: 'cheque_copy',          label: 'Cheque / Payment Proof', category: 'agreements', hasExpiry: false },
    { value: 'other',                label: 'Other Document',         category: 'other',      hasExpiry: false },
];

const DEAL_TYPES = [
    { value: 'purchase',    label: 'Customer Purchase', icon: ShoppingBag, color: 'emerald' },
    { value: 'sell_to_us',  label: 'Sell to Dealership', icon: Car,        color: 'blue'    },
    { value: 'exchange',    label: 'Exchange Trade-In',  icon: Truck,      color: 'purple'  },
    { value: 'consignment', label: 'Park & Sell',        icon: Key,        color: 'amber'   },
];

const DEAL_STATUS_CONFIG = {
    in_progress: { label: 'In Progress', color: 'bg-blue-50 text-blue-700 border-blue-200',    icon: Clock },
    completed:   { label: 'Completed',   color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    cancelled:   { label: 'Cancelled',   color: 'bg-red-50 text-red-700 border-red-200',        icon: AlertTriangle },
    on_hold:     { label: 'On Hold',     color: 'bg-amber-50 text-amber-700 border-amber-200',  icon: Clock },
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

interface DeliveryStoryForm {
    inventory_id: string;
    car_title: string;
    registration_no: string;
    delivery_date: string;
    photo_url: string;
    review_quote: string;
    rating: number;
    video_url: string;
    is_featured: boolean;
    tags: string;
}

const emptyDeliveryStoryForm: DeliveryStoryForm = {
    inventory_id: '',
    car_title: '',
    registration_no: '',
    delivery_date: new Date().toISOString().slice(0, 10),
    photo_url: '',
    review_quote: '',
    rating: 5,
    video_url: '',
    is_featured: true,
    tags: 'Certified Pre-Owned, Verified Buyer',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return d;
    }
};

const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
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
    } catch { /* ignore */ }
    return '';
};

const cleanUuid = (val: string | null | undefined): string | null => {
    if (!val) return null;
    const t = String(val).trim();
    return t.length > 0 ? t : null;
};

const getDaysUntilExpiry = (expiry: string | null | undefined): number | null => {
    if (!expiry) return null;
    return Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000);
};

const getExpiryBadge = (expiry: string | null | undefined) => {
    const days = getDaysUntilExpiry(expiry);
    if (days === null) return null;
    if (days < 0)  return { label: `Expired ${Math.abs(days)}d ago`, cls: 'bg-red-50 text-red-700 border-red-200',   icon: AlertTriangle };
    if (days <= 7) return { label: `Expires in ${days}d`,            cls: 'bg-red-50 text-red-600 border-red-200',    icon: AlertTriangle };
    if (days <= 30) return { label: `Expires in ${days}d`,           cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock };
    return { label: `Valid (${days}d left)`,                         cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',  icon: CheckCircle2 };
};

const getDocLabel = (type: string) => DOC_TYPES.find(d => d.value === type)?.label ?? type;

type Tab = 'deals' | 'overview' | 'documents' | 'delivery' | 'timeline' | 'logs';

// ─── Main Component ───────────────────────────────────────────────────────────

const CustomerDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isAdmin, profile, user } = useAuth();
    const { sales, refreshData, clubMembers, financeServices } = useData();
    const { addNotification } = useNotifications();

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);

    // Deep-linked Tab Navigation via URL searchParams
    const requestedTab = searchParams.get('tab') as Tab;
    const initialTab: Tab = (['deals', 'overview', 'documents', 'delivery', 'timeline', 'logs'].includes(requestedTab) ? requestedTab : 'deals');
    const [activeTab, setActiveTabState] = useState<Tab>(initialTab);

    const handleTabChange = (newTab: Tab) => {
        setActiveTabState(newTab);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', newTab);
            return next;
        }, { replace: true });
    };

    // Overview edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({});
    const [saving, setSaving] = useState(false);
    const [copiedPhone, setCopiedPhone] = useState(false);

    // Deals state
    const [deals, setDeals] = useState<CustomerDeal[]>([]);
    const [dealsLoading, setDealsLoading] = useState(false);
    const [isAddingDeal, setIsAddingDeal] = useState(false);
    const [dealForm, setDealForm] = useState(emptyDealForm);
    const [dealSaving, setDealSaving] = useState(false);
    const [editingDeal, setEditingDeal] = useState<CustomerDeal | null>(null);
    const [expandedDealIds, setExpandedDealIds] = useState<Set<string>>(new Set());
    const hasAutoExpandedRef = useRef(false);

    // Documents state
    const [documents, setDocuments] = useState<CustomerDocument[]>([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [isAddingDoc, setIsAddingDoc] = useState(false);
    const [selectedDealForUpload, setSelectedDealForUpload] = useState<string>('');
    const [docForm, setDocForm] = useState(emptyDocForm);
    const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
    const [linkingDocId, setLinkingDocId] = useState<string | null>(null);

    // Multi-file batch upload state
    const [batchItems, setBatchItems] = useState<BatchDocItem[]>([]);
    const [batchDefaultPartyRole, setBatchDefaultPartyRole] = useState<'buyer' | 'seller' | 'general'>('buyer');
    const [isBatchUploading, setIsBatchUploading] = useState(false);
    const [batchOverallProgress, setBatchOverallProgress] = useState(0);
    const [isDragOver, setIsDragOver] = useState(false);

    // Document Category Filters & Search
    const [docSearchQuery, setDocSearchQuery] = useState('');
    const [docCategoryFilter, setDocCategoryFilter] = useState<string>('all');

    // Delivery Stories state
    const [deliveries, setDeliveries] = useState<CustomerDeliveryStory[]>([]);
    const [deliveriesLoading, setDeliveriesLoading] = useState(false);
    const [isAddingDeliveryStory, setIsAddingDeliveryStory] = useState(false);
    const [deliveryStoryForm, setDeliveryStoryForm] = useState(emptyDeliveryStoryForm);
    const [deliveryStorySaving, setDeliveryStorySaving] = useState(false);
    const [deliveryPhotoUploading, setDeliveryPhotoUploading] = useState(false);

    // Structured Customer Notes state
    const [customerNotes, setCustomerNotes] = useState<StructuredNote[]>([]);
    const [notesLoading, setNotesLoading] = useState(false);
    const [quickNote, setQuickNote] = useState('');
    const [quickNoteType, setQuickNoteType] = useState<'call' | 'visit' | 'whatsapp' | 'general'>('call');
    const [noteSaving, setNoteSaving] = useState(false);

    // Timeline state
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
    const [timelineLoading, setTimelineLoading] = useState(false);

    // Logs state
    const [logs, setLogs] = useState<any[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);

    // Inventory search for deal & delivery forms
    const [inventorySearch, setInventorySearch] = useState('');
    const [inventoryList, setInventoryList] = useState<any[]>([]);

    // Origin Lead state
    const [originLead, setOriginLead] = useState<any | null>(null);

    // ─── Fetch Customer ───────────────────────────────────────────────────────

    const fetchCustomer = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
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

                // Fetch origin lead by phone
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
        } catch (err) {
            console.error('Error in fetchCustomer:', err);
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    useEffect(() => {
        fetchCustomer();
    }, [fetchCustomer]);

    // Live inventory query effect for Deal & Delivery Forms (Corrected to thumbnail/images)
    useEffect(() => {
        if (!inventorySearch.trim() || inventorySearch.length < 2) {
            setInventoryList([]);
            return;
        }
        const timer = setTimeout(async () => {
            const query = inventorySearch.trim();
            const { data } = await supabase
                .from('inventory')
                .select('id, make, model, year, registration_no, thumbnail, images')
                .or(`make.ilike.%${query}%,model.ilike.%${query}%,registration_no.ilike.%${query}%`)
                .limit(8);
            if (data) setInventoryList(data);
        }, 250);
        return () => clearTimeout(timer);
    }, [inventorySearch]);

    // ─── Computed Matching Sales ──────────────────────────────────────────────
    const customerSales = useMemo(() => {
        if (!customer) return [];
        return (sales || []).filter(s => {
            if (s.customer_id === id || s.customer?.id === id) return true;
            if (customer.phone && (s.customer?.phone === customer.phone || s.customer_phone === customer.phone || s.phone === customer.phone)) return true;
            if (customer.email && (s.customer?.email === customer.email || s.customer_email === customer.email)) return true;
            return false;
        });
    }, [sales, id, customer]);

    // ─── Computed Customer Club Membership & Finance Apps ────────────────────
    const customerClubMember = useMemo(() => {
        if (!customer) return null;
        return (clubMembers || []).find(m => 
            m.customer_id === id || 
            (customer.phone && m.phone === customer.phone) || 
            (customer.email && m.email === customer.email)
        );
    }, [clubMembers, id, customer]);

    const customerFinanceApps = useMemo(() => {
        if (!customer) return [];
        return (financeServices || []).filter(f => 
            f.customer_id === id || 
            (customer.phone && f.phone === customer.phone)
        );
    }, [financeServices, id, customer]);

    // ─── Fetch & Synchronize Deals ────────────────────────────────────────────

    const fetchDeals = useCallback(async () => {
        if (!id) return;
        setDealsLoading(true);
        try {
            // 1. Query direct Supabase customer_deals records with corrected inventory fields
            const { data: dbDeals, error: dealsErr } = await supabase
                .from('customer_deals')
                .select(`
                    *,
                    car:inventory(id, make, model, year, registration_no, thumbnail, images),
                    lead:leads(full_name, status)
                `)
                .or(`customer_id.eq.${id},seller_customer_id.eq.${id}`)
                .order('created_at', { ascending: false });

            const resolvedDbDeals: CustomerDeal[] = (!dealsErr && dbDeals) ? (dbDeals as CustomerDeal[]) : [];
            const mergedDeals: CustomerDeal[] = [...resolvedDbDeals];

            // 2. Iterate each sale to attach vehicle particulars or map missing sales in memory
            for (const sale of customerSales) {
                const existingIndex = mergedDeals.findIndex(d => d.sale_id === sale.id || d.id === sale.id);

                if (existingIndex >= 0) {
                    if (!mergedDeals[existingIndex].car && sale.car) {
                        mergedDeals[existingIndex].car = {
                            id: sale.car.id,
                            make: sale.car.make,
                            model: sale.car.model,
                            year: sale.car.year,
                            registration_no: sale.car.registration_no || sale.car.license_plate || null,
                            thumbnail: sale.car.thumbnail || sale.car.images?.[0] || null,
                            images: sale.car.images || null,
                        };
                    }
                    if (!mergedDeals[existingIndex].sale_id) {
                        mergedDeals[existingIndex].sale_id = sale.id;
                    }
                } else {
                    const saleDateStr = sale.sale_date
                        ? new Date(sale.sale_date).toISOString().split('T')[0]
                        : new Date(sale.created_at || Date.now()).toISOString().split('T')[0];

                    mergedDeals.push({
                        id: sale.id,
                        customer_id: id,
                        sale_id: sale.id,
                        deal_type: sale.sale_type === 'consignment' ? 'consignment' : sale.sale_type === 'exchange' ? 'exchange' : 'purchase',
                        deal_status: 'completed',
                        inquiry_date: saleDateStr,
                        deal_date: saleDateStr,
                        rto_date: saleDateStr,
                        delivery_date: saleDateStr,
                        handover_date: saleDateStr,
                        hypothecation_clearance_date: null,
                        total_amount: Number(sale.sale_price ?? sale.final_price ?? 0),
                        advance_paid: Number(sale.sale_price ?? sale.final_price ?? 0),
                        balance_due: sale.payment_status === 'paid' ? 0 : Number(sale.balance_amount || 0),
                        payment_mode: sale.payment_method || 'Paid',
                        notes: sale.notes || `Purchased ${sale.car ? `${sale.car.year || ''} ${sale.car.make} ${sale.car.model}` : 'Vehicle'}.`,
                        internal_notes: 'Synchronized from Sales ledger',
                        created_at: sale.created_at || new Date().toISOString(),
                        car: sale.car ? {
                            id: sale.car.id,
                            make: sale.car.make,
                            model: sale.car.model,
                            year: sale.car.year,
                            registration_no: sale.car.registration_no || sale.car.license_plate || null,
                            thumbnail: sale.car.thumbnail || sale.car.images?.[0] || null,
                            images: sale.car.images || null,
                        } : null,
                    } as CustomerDeal);
                }
            }

            // Sort newest deal first
            mergedDeals.sort((a, b) =>
                new Date(b.deal_date || b.created_at).getTime() - new Date(a.deal_date || a.created_at).getTime()
            );

            setDeals(mergedDeals);
            
            // Auto expand only ONCE on initial load
            if (mergedDeals.length > 0 && !hasAutoExpandedRef.current) {
                hasAutoExpandedRef.current = true;
                setExpandedDealIds(new Set([mergedDeals[0].id]));
            }
        } catch (err) {
            console.error('Error in fetchDeals:', err);
        } finally {
            setDealsLoading(false);
        }
    }, [id, customerSales]);

    // ─── Fetch Documents ──────────────────────────────────────────────────────

    const fetchDocuments = useCallback(async () => {
        if (!id) return;
        setDocsLoading(true);
        try {
            const { data } = await supabase
                .from('customer_documents')
                .select('*, uploaded_by_profile:profiles!uploaded_by(full_name)')
                .eq('customer_id', id)
                .order('created_at', { ascending: false });

            setDocuments((data as CustomerDocument[]) || []);
        } catch (err) {
            console.error('Error fetching documents:', err);
        } finally {
            setDocsLoading(false);
        }
    }, [id]);

    // ─── Fetch Structured Customer Notes ─────────────────────────────────────

    const fetchCustomerNotes = useCallback(async () => {
        if (!id) return;
        setNotesLoading(true);
        try {
            const { data, error } = await supabase
                .from('customer_notes')
                .select('*, profiles:created_by(full_name)')
                .eq('customer_id', id)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setCustomerNotes(data.map(n => ({
                    id: n.id,
                    customer_id: n.customer_id,
                    note_type: n.note_type || 'general',
                    content: n.content,
                    created_at: n.created_at,
                    created_by: n.created_by,
                    author_name: n.profiles?.full_name || 'Staff'
                })));
            }
        } catch (err) {
            console.error('Error fetching customer notes:', err);
        } finally {
            setNotesLoading(false);
        }
    }, [id]);

    // ─── Fetch Delivery Stories ───────────────────────────────────────────────

    const fetchDeliveries = useCallback(async () => {
        if (!id || !customer) return;
        setDeliveriesLoading(true);
        try {
            const { data } = await supabase
                .from('customer_deliveries')
                .select('*')
                .or(`customer_id.eq.${id},customer_name.ilike.%${customer.full_name}%`)
                .order('delivery_date', { ascending: false });

            setDeliveries((data as CustomerDeliveryStory[]) || []);
        } catch (err) {
            console.error('Error fetching customer deliveries:', err);
        } finally {
            setDeliveriesLoading(false);
        }
    }, [id, customer]);

    // ─── Fetch Timeline ───────────────────────────────────────────────────────

    const fetchTimeline = useCallback(async () => {
        if (!id || !customer) return;
        setTimelineLoading(true);

        const safe = async (q: any) => {
            try { return await q; } catch { return { data: [] }; }
        };

        try {
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
                safe(supabase.from('visits').select('*').eq('customer_id', id).order('visit_date', { ascending: false })),
            ]);

            const events: TimelineEvent[] = [];

            // Sales
            customerSales.forEach(s => {
                events.push({
                    id: `sale-${s.id}`,
                    type: 'sale',
                    title: `Vehicle Purchased: ${s.car?.year || ''} ${s.car?.make || ''} ${s.car?.model || ''}`,
                    description: `Amount: ${formatCurrency(s.final_price || s.sale_price || 0)} · Payment: ${s.payment_status?.toUpperCase() || 'PAID'}`,
                    date: new Date(s.sale_date || s.created_at),
                    icon: Car,
                    color: 'emerald',
                    data: s,
                });
            });

            // Deals
            deals.forEach(d => {
                const dt = DEAL_TYPES.find(t => t.value === d.deal_type);
                events.push({
                    id: `deal-${d.id}`,
                    type: 'deal',
                    title: `Deal: ${dt?.label || d.deal_type}`,
                    description: `${d.car ? `${d.car.year} ${d.car.make} ${d.car.model}` : 'Vehicle TBD'} — Status: ${DEAL_STATUS_CONFIG[d.deal_status]?.label}`,
                    date: new Date(d.deal_date || d.created_at),
                    status: DEAL_STATUS_CONFIG[d.deal_status]?.label,
                    icon: dt?.icon || Key,
                    color: dt?.color || 'blue',
                    data: d,
                });
            });

            // Delivery Stories
            deliveries.forEach(del => {
                events.push({
                    id: `delivery-${del.id}`,
                    type: 'delivery',
                    title: `Delivery Celebration: ${del.car_title}`,
                    description: del.review_quote ? `"${del.review_quote}" (Rating: ${del.rating}★)` : `Vehicle Handover Celebration in ${del.customer_city || 'Pune'}`,
                    date: new Date(del.delivery_date),
                    icon: Sparkles,
                    color: 'amber',
                    data: del,
                });
            });

            // Leads
            (leadsData || []).forEach((l: any) => events.push({
                id: `lead-${l.id}`,
                type: 'lead',
                title: `Lead Enquiry: ${l.type ? l.type.replace(/_/g, ' ').toUpperCase() : 'PURCHASE'}`,
                description: l.message || (l.car_make ? `Interested in ${l.car_make} ${l.car_model || ''}` : 'General Showroom Enquiry'),
                date: new Date(l.created_at),
                status: l.status,
                icon: Shield,
                color: 'blue',
                data: l,
            }));

            // Service
            (serviceData || []).forEach((s: any) => events.push({
                id: `service-${s.id}`,
                type: 'service',
                title: `Service Booking: ${s.service_type || 'General Maintenance'}`,
                description: `${s.car_make || 'Vehicle'} ${s.car_model || ''} (${s.car_reg_no || 'N/A'})`,
                date: new Date(s.created_at),
                status: s.status,
                icon: Truck,
                color: 'amber',
                data: s,
            }));

            // Test Drive
            (testDriveData || []).forEach((t: any) => events.push({
                id: `td-${t.id}`,
                type: 'test_drive',
                title: 'Test Drive Scheduled',
                description: t.car ? `${t.car.make} ${t.car.model}` : 'Vehicle Booking',
                date: new Date(t.created_at),
                status: t.status,
                icon: Key,
                color: 'purple',
                data: t,
            }));

            // Visits
            (visitsData || []).forEach((v: any) => events.push({
                id: `visit-${v.id}`,
                type: 'visit',
                title: `Showroom Visit: ${v.purpose ? v.purpose.toUpperCase() : 'GENERAL'}`,
                description: `Outcome: ${v.outcome === 'successful' ? 'Successful' : 'In Discussion'}${v.notes ? ' — ' + v.notes : ''}`,
                date: new Date(v.visit_date),
                status: v.status,
                icon: UserCheck,
                color: 'emerald',
                data: v,
            }));

            // Follow-ups
            (followUpData || []).forEach((f: any) => events.push({
                id: `followup-${f.id}`,
                type: 'followup',
                title: `Follow-up: ${f.type?.toUpperCase() || 'CALL'}`,
                description: `${f.notes || 'Routine touchpoint'} ${f.is_done ? '• Completed' : '• Scheduled'}`,
                date: new Date(f.due_date || f.created_at),
                status: f.is_done ? 'Done' : 'Pending',
                icon: Phone,
                color: 'purple',
                data: f,
            }));

            events.sort((a, b) => b.date.getTime() - a.date.getTime());
            setTimeline(events);
        } catch (err) {
            console.error('Error fetching timeline:', err);
        } finally {
            setTimelineLoading(false);
        }
    }, [id, customer, customerSales, deals, deliveries]);

    // ─── Fetch Logs ───────────────────────────────────────────────────────────

    const fetchLogs = useCallback(async () => {
        if (!id || !customer) return;
        setLogsLoading(true);
        try {
            const { data } = await supabase
                .from('audit_logs')
                .select('id, action, target_type, target_name, details, created_at, profiles:user_id(full_name)')
                .or(`target_name.ilike.%${customer.full_name}%,details.ilike.%${id}%`)
                .order('created_at', { ascending: false })
                .limit(50);

            setLogs(data || []);
        } catch (err) {
            console.error('Error fetching logs:', err);
        } finally {
            setLogsLoading(false);
        }
    }, [id, customer]);

    // Initial Loaders
    useEffect(() => {
        if (customer) {
            fetchDeals();
            fetchDocuments();
            fetchCustomerNotes();
            fetchDeliveries();
        }
    }, [customer, fetchDeals, fetchDocuments, fetchCustomerNotes, fetchDeliveries]);

    useEffect(() => {
        if (!customer) return;
        if (activeTab === 'timeline') fetchTimeline();
        if (activeTab === 'logs') fetchLogs();
    }, [activeTab, customer, fetchTimeline, fetchLogs]);

    // ─── Toggle Accordion Deal Card ───────────────────────────────────────────
    const toggleDealExpand = (dealId: string) => {
        setExpandedDealIds(prev => {
            const next = new Set(prev);
            if (next.has(dealId)) {
                next.delete(dealId);
            } else {
                next.add(dealId);
            }
            return next;
        });
    };

    // ─── Handlers ─────────────────────────────────────────────────────────────

    const handleCopyPhone = () => {
        if (!customer?.phone) return;
        navigator.clipboard.writeText(customer.phone);
        setCopiedPhone(true);
        setTimeout(() => setCopiedPhone(false), 2000);
    };

    const handleSaveCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customer) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('customers')
                .update({
                    full_name: editForm.full_name,
                    phone: editForm.phone,
                    alternate_phone: cleanUuid(editForm.alternate_phone),
                    whatsapp_number: cleanUuid(editForm.whatsapp_number),
                    email: cleanUuid(editForm.email),
                    address: cleanUuid(editForm.address),
                    office_address: cleanUuid(editForm.office_address),
                    city: cleanUuid(editForm.city),
                    occupation: cleanUuid(editForm.occupation),
                    date_of_birth: toDateInputValue(editForm.date_of_birth) || null,
                    notes: cleanUuid(editForm.notes),
                })
                .eq('id', customer.id);

            if (!error) {
                setIsEditing(false);
                await fetchCustomer();
                refreshData();
                addNotification({
                    title: 'Customer Updated',
                    message: `Profile details saved for ${editForm.full_name}`,
                    type: 'success',
                });
            } else {
                alert('Failed to update customer: ' + error.message);
            }
        } catch (err) {
            console.error('Error saving customer:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveQuickNote = async () => {
        if (!customer || !quickNote.trim()) return;
        setNoteSaving(true);
        try {
            // 1. Insert into structured customer_notes table
            const { error: noteErr } = await supabase
                .from('customer_notes')
                .insert({
                    customer_id: customer.id,
                    note_type: quickNoteType,
                    content: quickNote.trim(),
                    created_by: profile?.id || user?.id || null,
                });

            // 2. Also append note to customer text notes for backwards compatibility
            const existingNotes = customer.notes ? `${customer.notes}\n` : '';
            const timestamp = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            const author = profile?.full_name || 'Staff';
            const updated = `${existingNotes}[${timestamp} by ${author} (${quickNoteType.toUpperCase()})]: ${quickNote.trim()}`;

            await supabase
                .from('customers')
                .update({ notes: updated })
                .eq('id', customer.id);

            if (!noteErr) {
                setQuickNote('');
                await fetchCustomerNotes();
                await fetchCustomer();
                addNotification({
                    title: 'Note Logged',
                    message: `${quickNoteType.toUpperCase()} note recorded for customer`,
                    type: 'success',
                });
            }
        } catch (err) {
            console.error('Error saving quick note:', err);
        } finally {
            setNoteSaving(false);
        }
    };

    const handleSaveDeal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customer) return;
        setDealSaving(true);

        const totalNum = dealForm.total_amount ? Number(dealForm.total_amount) : 0;
        const advanceNum = dealForm.advance_paid ? Number(dealForm.advance_paid) : 0;
        const computedBalance = dealForm.balance_due !== '' ? Number(dealForm.balance_due) : Math.max(0, totalNum - advanceNum);

        const resolvedInventoryId = cleanUuid(dealForm.inventory_id || editingDeal?.inventory_id || (editingDeal?.car ? editingDeal.car.id : null));
        const resolvedSaleId = cleanUuid(editingDeal?.sale_id);
        const resolvedLeadId = cleanUuid(dealForm.lead_id || editingDeal?.lead_id);

        const payload: any = {
            customer_id: customer.id,
            sale_id: resolvedSaleId,
            inventory_id: resolvedInventoryId,
            lead_id: resolvedLeadId,
            deal_type: dealForm.deal_type,
            deal_status: dealForm.deal_status,
            inquiry_date: toDateInputValue(dealForm.inquiry_date) || null,
            deal_date: toDateInputValue(dealForm.deal_date) || null,
            rto_date: toDateInputValue(dealForm.rto_date) || null,
            delivery_date: toDateInputValue(dealForm.delivery_date) || null,
            handover_date: toDateInputValue(dealForm.handover_date) || null,
            hypothecation_clearance_date: toDateInputValue(dealForm.hypothecation_clearance_date) || null,
            total_amount: totalNum || null,
            advance_paid: advanceNum || null,
            balance_due: computedBalance,
            payment_mode: cleanUuid(dealForm.payment_mode) || (advanceNum >= totalNum && totalNum > 0 ? 'Paid in Full' : 'Partial'),
            notes: cleanUuid(dealForm.notes),
            internal_notes: cleanUuid(dealForm.internal_notes),
        };

        // 1. Instant optimistic update so user sees results without lag
        if (editingDeal) {
            setDeals(prev => prev.map(d => (d.id === editingDeal.id || (d.sale_id && d.sale_id === editingDeal.sale_id)) ? {
                ...d,
                ...payload,
                deal_type: payload.deal_type,
                deal_status: payload.deal_status,
                car: d.car || (editingDeal.car || null),
            } : d));
        }

        try {
            let targetDealId: string | null = null;
            if (editingDeal) {
                targetDealId = await ensureDealExistsInDb(editingDeal.id);
            }

            if (targetDealId) {
                const { error } = await supabase.from('customer_deals').update(payload).eq('id', targetDealId);
                if (!error) {
                    setEditingDeal(null);
                    setIsAddingDeal(false);
                    setDealForm(emptyDealForm);
                    setInventorySearch('');
                    addNotification({ title: 'Deal Updated', message: 'Vehicle deal and milestone details updated successfully', type: 'success' });
                    fetchDeals();
                } else {
                    console.error('Supabase deal update error:', error);
                    alert('Failed to update deal: ' + error.message);
                    fetchDeals();
                }
            } else {
                const { data: createdDeal, error } = await supabase.from('customer_deals').insert(payload).select('id').single();
                if (!error) {
                    setIsAddingDeal(false);
                    setDealForm(emptyDealForm);
                    setInventorySearch('');
                    addNotification({ title: 'Deal Created', message: 'New vehicle deal milestone record created', type: 'success' });
                    fetchDeals();
                } else {
                    console.error('Supabase deal insert error:', error);
                    alert('Failed to save deal: ' + error.message);
                }
            }
        } catch (err: any) {
            console.error('Error saving deal:', err);
            alert('Error saving deal: ' + (err.message || 'Unknown error'));
        } finally {
            setDealSaving(false);
        }
    };

    const handleDeleteDeal = async (dealId: string) => {
        if (!window.confirm('Delete this deal milestone record? This will unlink attached deal documents to general vault.')) return;
        const validId = await ensureDealExistsInDb(dealId) || dealId;
        await supabase.from('customer_documents').update({ deal_id: null }).eq('deal_id', validId);
        await supabase.from('customer_deals').delete().eq('id', validId);
        fetchDeals();
        fetchDocuments();
        addNotification({ title: 'Deal Removed', message: 'Deal record deleted and documents unlinked to vault', type: 'info' });
    };

    // ─── Quick Single Milestone Date Updater ─────────────────────────────────
    const handleQuickUpdateMilestone = async (deal: CustomerDeal, milestoneKey: keyof CustomerDeal, dateValue: string | null) => {
        const cleanDate = dateValue ? toDateInputValue(dateValue) : null;
        // 1. Instant optimistic update
        setDeals(prev => prev.map(d => (d.id === deal.id || (d.sale_id && d.sale_id === deal.sale_id)) ? { ...d, [milestoneKey]: cleanDate } : d));

        try {
            const validDealId = await ensureDealExistsInDb(deal.id);
            if (!validDealId) return;

            const { error } = await supabase
                .from('customer_deals')
                .update({ [milestoneKey]: cleanDate })
                .eq('id', validDealId);

            if (!error) {
                setDeals(prev => prev.map(d => (d.id === deal.id || d.id === validDealId || (d.sale_id && d.sale_id === deal.sale_id)) ? { ...d, id: validDealId, [milestoneKey]: cleanDate } : d));
                addNotification({
                    title: 'Milestone Updated',
                    message: cleanDate ? `Milestone recorded as ${formatDate(cleanDate)}` : 'Milestone cleared',
                    type: 'success',
                });
            } else {
                console.error('Failed to update milestone in DB:', error);
                alert('Failed to update milestone: ' + error.message);
                fetchDeals();
            }
        } catch (err: any) {
            console.error('Error updating milestone:', err);
        }
    };

    // ─── Quick Sync All Milestones with Deal Date ─────────────────────────────
    const handleQuickSyncAllMilestones = async (deal: CustomerDeal) => {
        const syncDate = toDateInputValue(deal.deal_date) || new Date().toISOString().split('T')[0];

        // 1. Instant optimistic update
        setDeals(prev => prev.map(d => (d.id === deal.id || (d.sale_id && d.sale_id === deal.sale_id)) ? {
            ...d,
            inquiry_date: d.inquiry_date || syncDate,
            deal_date: d.deal_date || syncDate,
            rto_date: d.rto_date || syncDate,
            delivery_date: d.delivery_date || syncDate,
            handover_date: d.handover_date || syncDate,
            hypothecation_clearance_date: d.hypothecation_clearance_date || syncDate,
            deal_status: 'completed'
        } : d));

        try {
            const validDealId = await ensureDealExistsInDb(deal.id);
            if (!validDealId) return;

            const { error } = await supabase
                .from('customer_deals')
                .update({
                    inquiry_date: deal.inquiry_date || syncDate,
                    deal_date: deal.deal_date || syncDate,
                    rto_date: deal.rto_date || syncDate,
                    delivery_date: deal.delivery_date || syncDate,
                    handover_date: deal.handover_date || syncDate,
                    hypothecation_clearance_date: deal.hypothecation_clearance_date || syncDate,
                    deal_status: 'completed'
                })
                .eq('id', validDealId);

            if (!error) {
                setDeals(prev => prev.map(d => (d.id === deal.id || d.id === validDealId || (d.sale_id && d.sale_id === deal.sale_id)) ? {
                    ...d,
                    id: validDealId,
                    inquiry_date: d.inquiry_date || syncDate,
                    deal_date: d.deal_date || syncDate,
                    rto_date: d.rto_date || syncDate,
                    delivery_date: d.delivery_date || syncDate,
                    handover_date: d.handover_date || syncDate,
                    hypothecation_clearance_date: d.hypothecation_clearance_date || syncDate,
                    deal_status: 'completed'
                } : d));

                addNotification({
                    title: 'Milestones Synchronized',
                    message: `All 6 milestone stages marked complete`,
                    type: 'success'
                });
            } else {
                console.error('Failed to sync milestones in DB:', error);
                alert('Failed to sync milestones: ' + error.message);
                fetchDeals();
            }
        } catch (err: any) {
            console.error('Error syncing milestones:', err);
        }
    };

    // ─── Print Clean Delivery & Deal Voucher ─────────────────────────────────
    const handlePrintDealSummary = (deal: CustomerDeal) => {
        const win = window.open('', '_blank');
        if (!win) return;
        const carTitle = deal.car ? `${deal.car.year} ${deal.car.make} ${deal.car.model}` : 'Vehicle Particulars';
        const reg = deal.car?.registration_no || 'Reg Pending';
        const price = formatCurrency(deal.total_amount);
        const advance = formatCurrency(deal.advance_paid);
        const balance = formatCurrency(deal.balance_due);
        const dealDate = formatDate(deal.deal_date);

        win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Deal Summary - ${customer?.full_name} - ${carTitle}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #0f172a; max-width: 800px; margin: 0 auto; line-height: 1.5; }
                    .header { border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .brand { font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; }
                    .title { font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 2px; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
                    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
                    .card h4 { margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 800; }
                    .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; border-bottom: 1px dashed #f1f5f9; }
                    .row:last-child { border-bottom: none; }
                    .row .label { color: #64748b; font-size: 12px; }
                    .row .val { font-weight: 700; color: #0f172a; }
                    .milestones { margin-top: 20px; border-top: 1px dashed #cbd5e1; padding-top: 20px; }
                    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
                    @media print { body { padding: 15px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="brand">NEW MAHARASHTRA CAR MOTORS</div>
                        <div class="title">Vehicle Deal & Handover Voucher</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:12px;font-weight:700;">Issue Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        <div style="font-size:11px;color:#64748b;">Deal Finalized: ${dealDate}</div>
                    </div>
                </div>

                <div class="grid">
                    <div class="card">
                        <h4>Customer Details</h4>
                        <div class="row"><span class="label">Customer Name:</span><span class="val">${customer?.full_name}</span></div>
                        <div class="row"><span class="label">Primary Phone:</span><span class="val">${customer?.phone}</span></div>
                        <div class="row"><span class="label">City / Location:</span><span class="val">${customer?.city || 'Pune Hub'}</span></div>
                        <div class="row"><span class="label">Customer ID:</span><span class="val">${customer?.id.slice(0, 8).toUpperCase()}</span></div>
                    </div>
                    <div class="card">
                        <h4>Vehicle Particulars</h4>
                        <div class="row"><span class="label">Vehicle:</span><span class="val">${carTitle}</span></div>
                        <div class="row"><span class="label">Registration No:</span><span class="val">${reg}</span></div>
                        <div class="row"><span class="label">Deal Nature:</span><span class="val" style="text-transform:capitalize;">${deal.deal_type}</span></div>
                        <div class="row"><span class="label">Status:</span><span class="val" style="text-transform:capitalize;">${deal.deal_status}</span></div>
                    </div>
                </div>

                <div class="card" style="margin-bottom:20px;">
                    <h4>Financial Summary</h4>
                    <div class="row"><span class="label">Total Agreed Amount:</span><span class="val" style="font-size:15px;color:#0f172a;">${price}</span></div>
                    <div class="row"><span class="label">Advance / Token Amount Paid:</span><span class="val" style="color:#059669;">${advance}</span></div>
                    <div class="row"><span class="label">Balance Outstanding:</span><span class="val" style="color:#dc2626;">${balance}</span></div>
                    <div class="row"><span class="label">Payment Mode:</span><span class="val">${deal.payment_mode || 'Paid in Full'}</span></div>
                </div>

                <div class="milestones">
                    <h4 style="font-size:11px;text-transform:uppercase;color:#64748b;margin-bottom:12px;font-weight:800;">Milestone Execution Stages</h4>
                    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;">
                        <div style="padding:10px;background:#f8fafc;border-radius:8px;font-size:12px;border:1px solid #e2e8f0;">
                            <div style="color:#64748b;font-size:10px;text-transform:uppercase;font-weight:700;">1. Inquiry</div>
                            <div style="font-weight:700;margin-top:2px;">${deal.inquiry_date ? formatDate(deal.inquiry_date) : 'Completed'}</div>
                        </div>
                        <div style="padding:10px;background:#f8fafc;border-radius:8px;font-size:12px;border:1px solid #e2e8f0;">
                            <div style="color:#64748b;font-size:10px;text-transform:uppercase;font-weight:700;">2. Deal Finalized</div>
                            <div style="font-weight:700;margin-top:2px;">${deal.deal_date ? formatDate(deal.deal_date) : 'Completed'}</div>
                        </div>
                        <div style="padding:10px;background:#f8fafc;border-radius:8px;font-size:12px;border:1px solid #e2e8f0;">
                            <div style="color:#64748b;font-size:10px;text-transform:uppercase;font-weight:700;">3. RTO / Transfer</div>
                            <div style="font-weight:700;margin-top:2px;">${deal.rto_date ? formatDate(deal.rto_date) : 'Completed'}</div>
                        </div>
                        <div style="padding:10px;background:#f8fafc;border-radius:8px;font-size:12px;border:1px solid #e2e8f0;">
                            <div style="color:#64748b;font-size:10px;text-transform:uppercase;font-weight:700;">4. Delivery</div>
                            <div style="font-weight:700;margin-top:2px;">${deal.delivery_date ? formatDate(deal.delivery_date) : 'Completed'}</div>
                        </div>
                        <div style="padding:10px;background:#f8fafc;border-radius:8px;font-size:12px;border:1px solid #e2e8f0;">
                            <div style="color:#64748b;font-size:10px;text-transform:uppercase;font-weight:700;">5. Handover</div>
                            <div style="font-weight:700;margin-top:2px;">${deal.handover_date ? formatDate(deal.handover_date) : 'Completed'}</div>
                        </div>
                        <div style="padding:10px;background:#f8fafc;border-radius:8px;font-size:12px;border:1px solid #e2e8f0;">
                            <div style="color:#64748b;font-size:10px;text-transform:uppercase;font-weight:700;">6. Hypo Clearance</div>
                            <div style="font-weight:700;margin-top:2px;">${deal.hypothecation_clearance_date ? formatDate(deal.hypothecation_clearance_date) : 'N/A'}</div>
                        </div>
                    </div>
                </div>

                <div class="footer">
                    New Maharashtra Car Motors · All rights reserved · System Generated Deal Record
                </div>
                <script>window.print();</script>
            </body>
            </html>
        `);
        win.document.close();
    };

    // ─── Open Upload Modal for Specific Deal ───────────────────────────────────

    const handleOpenUploadForDeal = async (deal: CustomerDeal) => {
        const resolvedDealId = await ensureDealExistsInDb(deal.id) || deal.id;
        setSelectedDealForUpload(resolvedDealId);
        setDocForm({ ...emptyDocForm, deal_id: resolvedDealId });
        setBatchItems([]);
        setIsAddingDoc(true);
    };

    // ─── Ensure Deal Exists in Supabase DB ────────────────────────────────────
    const ensureDealExistsInDb = async (targetDealId: string): Promise<string | null> => {
        if (!targetDealId || !id) return null;
        const targetDeal = deals.find(d => d.id === targetDealId || d.sale_id === targetDealId);

        // 1. Check if targetDealId is already a valid UUID row in customer_deals
        try {
            const { data: existing, error: existErr } = await supabase
                .from('customer_deals')
                .select('id')
                .eq('id', targetDealId)
                .maybeSingle();
            if (!existErr && existing?.id) return existing.id;
        } catch { /* continue */ }

        // 2. Check if a customer_deals record exists with this sale_id
        if (targetDeal?.sale_id) {
            try {
                const { data: bySale, error: saleErr } = await supabase
                    .from('customer_deals')
                    .select('id')
                    .eq('sale_id', targetDeal.sale_id)
                    .maybeSingle();
                if (!saleErr && bySale?.id) {
                    setDeals(prev => prev.map(d => (d.id === targetDealId || d.sale_id === targetDeal?.sale_id) ? { ...d, id: bySale.id } : d));
                    return bySale.id;
                }
            } catch { /* continue */ }
        }

        // 3. Insert clean row into customer_deals table with proper foreign keys
        try {
            const saleDateStr = toDateInputValue(targetDeal?.deal_date) || new Date().toISOString().split('T')[0];
            const payload = {
                customer_id: id,
                sale_id: cleanUuid(targetDeal?.sale_id),
                inventory_id: cleanUuid(targetDeal?.inventory_id || (targetDeal?.car ? targetDeal.car.id : null)),
                lead_id: cleanUuid(targetDeal?.lead_id),
                deal_type: targetDeal?.deal_type || 'purchase',
                deal_status: targetDeal?.deal_status || 'completed',
                inquiry_date: toDateInputValue(targetDeal?.inquiry_date) || saleDateStr,
                deal_date: saleDateStr,
                rto_date: toDateInputValue(targetDeal?.rto_date) || saleDateStr,
                delivery_date: toDateInputValue(targetDeal?.delivery_date) || saleDateStr,
                handover_date: toDateInputValue(targetDeal?.handover_date) || saleDateStr,
                hypothecation_clearance_date: toDateInputValue(targetDeal?.hypothecation_clearance_date) || null,
                total_amount: Number(targetDeal?.total_amount || 0),
                advance_paid: Number(targetDeal?.advance_paid || 0),
                balance_due: Number(targetDeal?.balance_due || 0),
                payment_mode: cleanUuid(targetDeal?.payment_mode) || 'Paid',
                notes: cleanUuid(targetDeal?.notes) || 'Customer Vehicle Deal',
            };

            const { data: createdDeal, error: insErr } = await supabase
                .from('customer_deals')
                .insert(payload)
                .select('id')
                .single();

            if (!insErr && createdDeal?.id) {
                setDeals(prev => prev.map(d => (d.id === targetDealId || d.sale_id === targetDeal?.sale_id) ? { ...d, id: createdDeal.id } : d));
                return createdDeal.id;
            } else if (insErr) {
                console.error('Failed to create customer_deals record:', insErr);
            }
        } catch (e) {
            console.error('Error ensuring deal exists in customer_deals:', e);
        }
        return null;
    };

    // ─── Instant Document Link/Unlink to Deal ─────────────────────────────────

    const handleLinkDocumentToDeal = async (docId: string, dealId: string | null) => {
        setLinkingDocId(docId);
        try {
            let validDealId: string | null = null;
            if (dealId) {
                validDealId = await ensureDealExistsInDb(dealId);
                if (!validDealId) {
                    alert('Could not synchronize the deal record in the database. Please try again.');
                    return;
                }
            }

            const { error } = await supabase
                .from('customer_documents')
                .update({ deal_id: validDealId })
                .eq('id', docId);

            if (!error) {
                setDocuments(prev => prev.map(d => d.id === docId ? { ...d, deal_id: validDealId } : d));
                addNotification({
                    title: validDealId ? 'Document Linked' : 'Document Unlinked',
                    message: validDealId ? 'Document attached to vehicle deal' : 'Document moved to general customer vault',
                    type: 'success',
                });
                fetchDocuments();
                fetchDeals();
            } else {
                alert('Failed to update document link: ' + error.message);
            }
        } catch (err: any) {
            console.error('Error linking document:', err);
            alert('Error linking document: ' + (err.message || 'Unknown error'));
        } finally {
            setLinkingDocId(null);
        }
    };

    // ─── Batch Document Upload Handlers ───────────────────────────────────────

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
        if (lower.includes('delivery') || lower.includes('receipt')) return 'delivery_receipt';
        if (lower.includes('invoice') || lower.includes('bill')) return 'sales_invoice';
        if (lower.includes('agreement') || lower.includes('contract')) return 'agreement';
        if (lower.includes('cheque') || lower.includes('check')) return 'cheque_copy';
        return 'other';
    };

    const handleBatchFileSelect = async (files: FileList | File[], targetDealId?: string) => {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        const effectiveDealId = targetDealId || selectedDealForUpload || docForm.deal_id || '';

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
                statusText: 'Optimizing…',
                doc_type: detectedType,
                party_role: batchDefaultPartyRole,
                doc_label: baseLabel.replace(/[_-]/g, ' '),
                deal_id: effectiveDealId,
                issue_date: '',
                expiry_date: '',
                notes: '',
            };
        });

        setBatchItems(prev => [...prev, ...newItems]);

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
                    statusText: `Ready (${compSize} KB)`,
                } : b));
            } catch {
                setBatchItems(curr => curr.map(b => b.id === item.id ? {
                    ...b,
                    processedFile: item.originalFile,
                    status: 'ready',
                    statusText: 'Original file ready',
                } : b));
            }
        }
    };

    // ─── Resilient Storage Uploader (Multi-bucket fallback) ───────────────────
    const uploadFileToSupabaseStorage = async (customerId: string, file: File): Promise<string> => {
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `documents/${customerId}/${Date.now()}_${cleanFileName}`;

        // 1. Try 'customer-documents' bucket
        try {
            const { error: err1 } = await supabase.storage
                .from('customer-documents')
                .upload(path, file, { upsert: true });
            if (!err1) {
                const { data } = supabase.storage.from('customer-documents').getPublicUrl(path);
                if (data?.publicUrl) return data.publicUrl;
            }
        } catch { /* proceed to fallback */ }

        // 2. Try 'car-images' bucket
        try {
            const { error: err2 } = await supabase.storage
                .from('car-images')
                .upload(path, file, { upsert: true });
            if (!err2) {
                const { data } = supabase.storage.from('car-images').getPublicUrl(path);
                if (data?.publicUrl) return data.publicUrl;
            }
        } catch { /* proceed to fallback */ }

        // 3. Fallback: Convert to Data URL
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to parse file for vault'));
            reader.readAsDataURL(file);
        });
    };

    const handleBatchUploadSave = async () => {
        if (!customer || batchItems.length === 0 || isBatchUploading) return;
        setIsBatchUploading(true);
        setBatchOverallProgress(0);

        let successCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < batchItems.length; i++) {
            const item = batchItems[i];
            setBatchItems(curr => curr.map(b => b.id === item.id ? { ...b, status: 'uploading', statusText: 'Uploading…' } : b));

            try {
                const fileToUpload = item.processedFile || item.originalFile;
                const fileUrl = await uploadFileToSupabaseStorage(customer.id, fileToUpload);
                
                // Resolve real deal UUID from DB
                const rawDealId = item.deal_id || selectedDealForUpload || docForm.deal_id;
                const cleanDealId = rawDealId ? await ensureDealExistsInDb(rawDealId) : null;

                const { data: insertedDoc, error: insertErr } = await supabase
                    .from('customer_documents')
                    .insert({
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
                    })
                    .select('*, uploaded_by_profile:profiles!uploaded_by(full_name)')
                    .single();

                if (insertErr) throw insertErr;

                if (insertedDoc) {
                    setDocuments(prev => [insertedDoc as CustomerDocument, ...prev]);
                }

                setBatchItems(curr => curr.map(b => b.id === item.id ? { ...b, status: 'done', statusText: 'Uploaded' } : b));
                successCount++;
            } catch (err: any) {
                console.error('Document upload error:', item.originalFile.name, err);
                errors.push(`${item.originalFile.name}: ${err.message || 'Upload failed'}`);
                setBatchItems(curr => curr.map(b => b.id === item.id ? { ...b, status: 'error', statusText: `Failed: ${err.message || 'Error'}`, error: err.message } : b));
            }

            setBatchOverallProgress(Math.round(((i + 1) / batchItems.length) * 100));
        }

        setIsBatchUploading(false);

        if (successCount > 0) {
            addNotification({
                title: 'Documents Vault Updated',
                message: `Uploaded ${successCount} document${successCount !== 1 ? 's' : ''} to vault`,
                type: 'success',
            });
            fetchDocuments();
            fetchDeals();

            if (errors.length === 0) {
                setIsAddingDoc(false);
                setBatchItems([]);
                setDocForm(emptyDocForm);
                setSelectedDealForUpload('');
            }
        }
    };

    const handleDownloadDoc = async (doc: CustomerDocument) => {
        if (!doc.file_url) return;
        setDownloadingDocId(doc.id);
        try {
            const response = await fetch(doc.file_url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            let ext = '';
            if (doc.file_name && doc.file_name.includes('.')) {
                ext = '.' + doc.file_name.split('.').pop();
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
        } catch {
            window.open(doc.file_url, '_blank');
        } finally {
            setDownloadingDocId(null);
        }
    };

    const handleDeleteDoc = async (docId: string) => {
        if (!window.confirm('Delete this document from customer vault?')) return;
        const { error } = await supabase.from('customer_documents').delete().eq('id', docId);
        if (!error) {
            fetchDocuments();
            fetchDeals();
        }
    };

    // ─── Delivery Story Upload & Save Handlers ────────────────────────────────
    const handleDeliveryPhotoSelect = async (file: File) => {
        setDeliveryPhotoUploading(true);
        try {
            const compressed = await compressImage(file, {
                maxTargetKb: 500,
                maxDimension: 1600,
                initialQuality: 0.85
            });
            const photoUrl = await uploadFileToSupabaseStorage(customer?.id || 'deliveries', compressed.file);
            setDeliveryStoryForm(prev => ({ ...prev, photo_url: photoUrl }));
            addNotification({
                title: 'Photo Uploaded',
                message: 'Delivery handover photo ready',
                type: 'success'
            });
        } catch (err: any) {
            console.error('Error uploading delivery photo:', err);
            alert('Failed to upload delivery photo: ' + (err.message || 'Error'));
        } finally {
            setDeliveryPhotoUploading(false);
        }
    };

    const handleSaveDeliveryStory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customer || !deliveryStoryForm.photo_url) {
            alert('Please select or upload a delivery photo.');
            return;
        }
        setDeliveryStorySaving(true);
        try {
            const tagArray = deliveryStoryForm.tags
                ? deliveryStoryForm.tags.split(',').map(t => t.trim()).filter(Boolean)
                : ['Certified Pre-Owned', 'Verified Buyer'];

            const payload = {
                customer_id: customer.id,
                inventory_id: cleanUuid(deliveryStoryForm.inventory_id),
                customer_name: customer.full_name,
                customer_city: customer.city || 'Pune',
                car_title: deliveryStoryForm.car_title || 'Certified Pre-Owned Car',
                registration_no: cleanUuid(deliveryStoryForm.registration_no),
                delivery_date: toDateInputValue(deliveryStoryForm.delivery_date) || new Date().toISOString().slice(0, 10),
                photo_url: deliveryStoryForm.photo_url,
                review_quote: cleanUuid(deliveryStoryForm.review_quote),
                rating: Number(deliveryStoryForm.rating || 5),
                video_url: cleanUuid(deliveryStoryForm.video_url),
                is_featured: Boolean(deliveryStoryForm.is_featured),
                tags: tagArray,
            };

            const { error } = await supabase.from('customer_deliveries').insert(payload);
            if (!error) {
                setIsAddingDeliveryStory(false);
                setDeliveryStoryForm(emptyDeliveryStoryForm);
                setInventorySearch('');
                addNotification({
                    title: 'Delivery Story Published',
                    message: `Delivery celebration added for ${customer.full_name}`,
                    type: 'success'
                });
                await fetchDeliveries();
            } else {
                alert('Failed to save delivery story: ' + error.message);
            }
        } catch (err: any) {
            console.error('Error saving delivery story:', err);
            alert('Error saving delivery story: ' + (err.message || 'Unknown error'));
        } finally {
            setDeliveryStorySaving(false);
        }
    };

    // ─── Financial & Metric Calculations ──────────────────────────────────────

    const lifetimePurchasesValue = useMemo(() => {
        return customerSales.reduce((sum, s) => sum + Number(s.final_price || s.sale_price || 0), 0);
    }, [customerSales]);

    const totalBalanceOutstanding = useMemo(() => {
        return deals.reduce((sum, d) => sum + Number(d.balance_due || 0), 0);
    }, [deals]);

    const criticalDocs = useMemo(() => {
        return documents.filter(d => {
            const days = getDaysUntilExpiry(d.expiry_date);
            return days !== null && days <= 30;
        });
    }, [documents]);

    const filteredDocuments = useMemo(() => {
        return documents.filter(doc => {
            if (docCategoryFilter !== 'all') {
                const typeObj = DOC_TYPES.find(d => d.value === doc.doc_type);
                if (docCategoryFilter === 'buyer' && doc.party_role !== 'buyer') return false;
                if (docCategoryFilter === 'seller' && doc.party_role !== 'seller') return false;
                if (docCategoryFilter === 'kyc' && typeObj?.category !== 'kyc') return false;
                if (docCategoryFilter === 'vehicle' && typeObj?.category !== 'vehicle') return false;
                if (docCategoryFilter === 'rto' && typeObj?.category !== 'rto') return false;
                if (docCategoryFilter === 'agreements' && typeObj?.category !== 'agreements') return false;
            }

            if (docSearchQuery.trim()) {
                const q = docSearchQuery.toLowerCase().trim();
                const label = (doc.doc_label || '').toLowerCase();
                const type = getDocLabel(doc.doc_type).toLowerCase();
                const notes = (doc.notes || '').toLowerCase();
                return label.includes(q) || type.includes(q) || notes.includes(q);
            }
            return true;
        });
    }, [documents, docCategoryFilter, docSearchQuery]);

    // Helper to check if a document is linked to a deal
    const isDocLinkedToDeal = (doc: CustomerDocument, deal: CustomerDeal) => {
        if (!doc.deal_id) return false;
        if (doc.deal_id === deal.id) return true;
        if (deal.sale_id && doc.deal_id === deal.sale_id) return true;
        if (deal.inventory_id && doc.deal_id === deal.inventory_id) return true;
        if (deal.car?.id && doc.deal_id === deal.car.id) return true;
        return false;
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center py-40">
                <span className="size-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (!customer) return null;

    const initials = customer.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    return (
        <div className="space-y-6">
            {/* ── Top Header Navigation & Quick Action Bar ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/admin/customers')}
                        className="size-9 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-primary hover:bg-slate-50 flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                        title="Back to Customers"
                    >
                        <ArrowLeft className="size-4" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">Customer Profile</span>
                            <span className="text-slate-300">/</span>
                            <span className="text-xs font-bold text-primary font-mono">ID: {customer.id.slice(0, 8)}</span>
                        </div>
                        <h1 className="text-xl font-black text-primary font-display flex items-center gap-2">
                            {customer.full_name}
                        </h1>
                    </div>
                </div>

                {/* Direct Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                    <a
                        href={`tel:${customer.phone}`}
                        className="h-10 px-3.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                        <Phone className="size-3.5 text-emerald-600" />
                        <span>Call</span>
                    </a>

                    <a
                        href={toWhatsAppUrl(customer.whatsapp_number || customer.phone)}
                        target="_blank"
                        rel="noreferrer"
                        className="h-10 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm shadow-emerald-600/20"
                    >
                        <MessageCircle className="size-3.5" />
                        <span>WhatsApp</span>
                    </a>

                    <button
                        onClick={() => {
                            setIsAddingDeal(true);
                            setEditingDeal(null);
                            setDealForm(emptyDealForm);
                        }}
                        className="h-10 px-3.5 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm shadow-primary/20 cursor-pointer"
                    >
                        <Plus className="size-3.5" />
                        <span>New Deal</span>
                    </button>

                    <button
                        onClick={() => {
                            // Prefill delivery story with latest deal vehicle
                            const latestDeal = deals[0];
                            setDeliveryStoryForm({
                                ...emptyDeliveryStoryForm,
                                inventory_id: latestDeal?.inventory_id || (latestDeal?.car?.id || ''),
                                car_title: latestDeal?.car ? `${latestDeal.car.year} ${latestDeal.car.make} ${latestDeal.car.model}` : '',
                                registration_no: latestDeal?.car?.registration_no || '',
                            });
                            setInventorySearch(latestDeal?.car ? `${latestDeal.car.year} ${latestDeal.car.make} ${latestDeal.car.model}` : '');
                            setIsAddingDeliveryStory(true);
                        }}
                        className="h-10 px-3.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Add Delivery Story & Testimonial"
                    >
                        <Sparkles className="size-3.5 text-amber-600" />
                        <span>Delivery Story</span>
                    </button>
                </div>
            </div>

            {/* ── Customer 360 Hero Card & KPI Strip ── */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-[var(--shadow-card)] space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
                    <div className="flex items-start gap-4">
                        <div className="size-16 rounded-2xl bg-gradient-to-br from-primary via-slate-800 to-primary-light text-white font-black text-2xl flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
                            {initials}
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-2xl font-black text-primary font-display">{customer.full_name}</h2>
                                {customerClubMember && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-xs">
                                        <Crown className="size-3" /> VIP Club Member
                                    </span>
                                )}
                                {customerSales.length > 1 ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                                        <Award className="size-3 text-amber-600" /> Repeat Buyer
                                    </span>
                                ) : customerSales.length === 1 ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <CheckCircle2 className="size-3 text-emerald-600" /> Car Owner
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
                                        Prospect
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-0.5">
                                <div className="flex items-center gap-1.5">
                                    <Phone className="size-3.5 text-slate-400" />
                                    <span className="font-semibold text-slate-700">{customer.phone}</span>
                                    <button
                                        onClick={handleCopyPhone}
                                        className="p-1 text-slate-400 hover:text-primary transition-colors cursor-pointer"
                                        title="Copy phone"
                                    >
                                        {copiedPhone ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                                    </button>
                                </div>

                                {customer.email && (
                                    <div className="flex items-center gap-1.5">
                                        <Mail className="size-3.5 text-slate-400" />
                                        <span>{customer.email}</span>
                                    </div>
                                )}

                                {customer.city && (
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="size-3.5 text-slate-400" />
                                        <span>{customer.city}</span>
                                    </div>
                                )}

                                {customer.occupation && (
                                    <div className="flex items-center gap-1.5">
                                        <Briefcase className="size-3.5 text-slate-400" />
                                        <span>{customer.occupation}</span>
                                    </div>
                                )}

                                <div className="flex items-center gap-1.5 text-slate-400">
                                    <Calendar className="size-3.5" />
                                    <span>Client since {formatDate(customer.created_at)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsEditing(true)}
                        className="h-9 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer self-start lg:self-center"
                    >
                        <Edit3 className="size-3.5" />
                        <span>Edit Profile</span>
                    </button>
                </div>

                {/* Financial & Status KPI Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lifetime Purchases</p>
                        <p className="text-xl font-black text-primary font-display">{formatCurrency(lifetimePurchasesValue)}</p>
                        <p className="text-[11px] text-slate-500 font-medium">{customerSales.length} vehicle transaction{customerSales.length !== 1 ? 's' : ''}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active Deals & Lifecycle</p>
                        <p className="text-xl font-black text-primary font-display">{deals.length}</p>
                        <p className="text-[11px] text-slate-500 font-medium">{deals.filter(d => d.deal_status === 'completed').length} completed</p>
                    </div>

                    <div className={`p-4 rounded-2xl border space-y-1 ${
                        totalBalanceOutstanding > 0 ? 'bg-red-50/70 border-red-200 text-red-900' : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    }`}>
                        <p className="text-[10px] font-black uppercase tracking-wider opacity-70">Balance Due</p>
                        <p className="text-xl font-black font-display">{formatCurrency(totalBalanceOutstanding)}</p>
                        <p className="text-[11px] font-medium opacity-80">{totalBalanceOutstanding === 0 ? 'All Payments Cleared' : 'Pending Payment'}</p>
                    </div>

                    <div className={`p-4 rounded-2xl border space-y-1 ${
                        criticalDocs.length > 0 ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-100'
                    }`}>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vault & Expiry</p>
                        <p className="text-xl font-black font-display text-primary">{documents.length} Docs</p>
                        <p className="text-[11px] font-medium text-amber-700">
                            {criticalDocs.length > 0 ? `${criticalDocs.length} expiring soon` : 'All documents active'}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Segmented Navigation Tabs ── */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                <div className="flex border-b border-slate-100 bg-slate-50/50 p-1.5 gap-1 overflow-x-auto">
                    {[
                        { key: 'deals',      label: 'Deals & Lifecycle',    icon: Key,        badge: deals.length },
                        { key: 'overview',   label: 'Overview & Story',     icon: UserCheck },
                        { key: 'documents',  label: 'Document Vault',       icon: FileText,   badge: criticalDocs.length > 0 ? criticalDocs.length : undefined, badgeAlert: criticalDocs.length > 0 },
                        { key: 'delivery',   label: 'Delivery Stories',     icon: Sparkles,   badge: deliveries.length > 0 ? deliveries.length : undefined },
                        { key: 'timeline',   label: 'Interaction Timeline', icon: Clock },
                        { key: 'logs',       label: 'Audit Trail',          icon: Shield },
                    ].map(t => {
                        const Icon = t.icon;
                        const active = activeTab === t.key;
                        return (
                            <button
                                key={t.key}
                                onClick={() => handleTabChange(t.key as Tab)}
                                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-2xl whitespace-nowrap transition-all cursor-pointer ${
                                    active ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                                }`}
                            >
                                <Icon className={`size-4 ${active ? 'text-primary' : 'text-slate-400'}`} />
                                <span>{t.label}</span>
                                {t.badge !== undefined && (
                                    <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                                        t.badgeAlert ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                        {t.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="p-6">
                    {/* ════════════════════════════════════════════
                        TAB: DEALS & LIFECYCLE (Interactive Accordion)
                    ════════════════════════════════════════════ */}
                    {activeTab === 'deals' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Deals & Vehicle Transactions ({deals.length})</h3>
                                    <p className="text-xs text-slate-400">Click any deal to expand or minimize details, financials, and attached documents</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsAddingDeal(true);
                                        setEditingDeal(null);
                                        setDealForm(emptyDealForm);
                                    }}
                                    className="h-10 px-4 bg-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-primary-light transition-colors shadow-sm cursor-pointer"
                                >
                                    <Plus className="size-4" />
                                    <span>Add Deal Record</span>
                                </button>
                            </div>

                            {dealsLoading ? (
                                <div className="py-20 flex justify-center"><span className="size-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
                            ) : deals.length === 0 ? (
                                <div className="py-16 text-center bg-slate-50 rounded-3xl border border-slate-100">
                                    <Key className="size-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-700">No deals on record</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Click "Add Deal Record" to track this customer's vehicle lifecycle.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {deals.map(deal => {
                                        const isExpanded = expandedDealIds.has(deal.id);
                                        const dt = DEAL_TYPES.find(t => t.value === deal.deal_type);
                                        const st = DEAL_STATUS_CONFIG[deal.deal_status] || DEAL_STATUS_CONFIG['in_progress'];
                                        
                                        // Match documents linked directly to this deal
                                        const dealDocs = documents.filter(d => isDocLinkedToDeal(d, deal));
                                        
                                        // Documents in general vault not linked to this deal
                                        const unlinkedVaultDocs = documents.filter(d => !isDocLinkedToDeal(d, deal));

                                        const milestones = [
                                            { key: 'inquiry_date' as keyof CustomerDeal, label: 'Inquiry', date: deal.inquiry_date, icon: Search },
                                            { key: 'deal_date' as keyof CustomerDeal, label: 'Deal Finalized', date: deal.deal_date, icon: Key },
                                            { key: 'rto_date' as keyof CustomerDeal, label: 'RTO / Transfer', date: deal.rto_date, icon: Shield },
                                            { key: 'delivery_date' as keyof CustomerDeal, label: 'Delivery', date: deal.delivery_date, icon: Truck },
                                            { key: 'handover_date' as keyof CustomerDeal, label: 'Actual Handover', date: deal.handover_date, icon: CheckCircle2 },
                                            { key: 'hypothecation_clearance_date' as keyof CustomerDeal, label: 'Hypo Cleared', date: deal.hypothecation_clearance_date, icon: Lock },
                                        ];
                                        const completedMilestones = milestones.filter(m => Boolean(m.date)).length;
                                        const progressPct = Math.round((completedMilestones / milestones.length) * 100);

                                        return (
                                            <div 
                                                key={deal.id} 
                                                className={`bg-white border rounded-3xl transition-all overflow-hidden ${
                                                    isExpanded ? 'border-primary/30 shadow-md ring-1 ring-primary/10' : 'border-slate-100 shadow-sm hover:border-slate-200'
                                                }`}
                                            >
                                                {/* ── Collapsed Deal Header (Click to Expand / Minimize) ── */}
                                                <div 
                                                    onClick={() => toggleDealExpand(deal.id)}
                                                    className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none hover:bg-slate-50/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3.5">
                                                        <div className={`size-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                                                            isExpanded ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-primary/10 text-primary'
                                                        }`}>
                                                            <Car className="size-6" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4 className="text-base font-bold text-slate-800">
                                                                    {deal.car ? `${deal.car.year} ${deal.car.make} ${deal.car.model}` : `${dt?.label || 'Vehicle Deal'}`}
                                                                </h4>
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${st.color}`}>
                                                                    {st.label}
                                                                </span>
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                                                    {dt?.label || 'Purchase'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                                                                <span>{deal.car?.registration_no ? `Reg: ${deal.car.registration_no}` : 'Registration Pending'}</span>
                                                                <span>•</span>
                                                                <span>Deal Date: {formatDate(deal.deal_date)}</span>
                                                                <span>•</span>
                                                                <span className="font-bold text-primary">{dealDocs.length} Document{dealDocs.length !== 1 ? 's' : ''} Attached</span>
                                                                <span>•</span>
                                                                <span className="text-emerald-600 font-semibold">{completedMilestones}/6 Stages Complete</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between md:justify-end gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                                                        <div className="text-left md:text-right">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Agreed Price</span>
                                                            <p className="text-base font-black text-primary font-display">{formatCurrency(deal.total_amount)}</p>
                                                            {Number(deal.balance_due || 0) > 0 ? (
                                                                <p className="text-[10px] font-bold text-red-600">Balance: {formatCurrency(deal.balance_due)}</p>
                                                            ) : (
                                                                <p className="text-[10px] font-bold text-emerald-600">Paid in Full</p>
                                                            )}
                                                        </div>

                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleDealExpand(deal.id);
                                                            }}
                                                            className={`size-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                                                                isExpanded ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'
                                                            }`}
                                                            title={isExpanded ? 'Minimize Deal Details' : 'Expand Deal Details'}
                                                        >
                                                            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* ── Expanded 360 Deal Details ── */}
                                                {isExpanded && (
                                                    <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-5 bg-slate-50/30">
                                                        {/* Visual 6-Stage Milestone Stepper & Progress */}
                                                        <div>
                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                                        Deal Milestone Lifecycle
                                                                    </span>
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                        {progressPct}% Complete ({completedMilestones}/6)
                                                                    </span>
                                                                </div>

                                                                {/* Quick Action & Linkage Toolbar */}
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    {completedMilestones < 6 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleQuickSyncAllMilestones(deal);
                                                                            }}
                                                                            className="h-7 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                                                            title="Sync all milestones with deal date"
                                                                        >
                                                                            <CheckCheck className="size-3" />
                                                                            <span>Sync All Milestones</span>
                                                                        </button>
                                                                    )}

                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handlePrintDealSummary(deal);
                                                                        }}
                                                                        className="h-7 px-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                                                                        title="Print Deal Voucher & Handover Sheet"
                                                                    >
                                                                        <Printer className="size-3 text-slate-500" />
                                                                        <span>Print Voucher</span>
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingDeal(deal);
                                                                            setInventorySearch(deal.car ? `${deal.car.year} ${deal.car.make} ${deal.car.model}` : '');
                                                                            setDealForm({
                                                                                deal_type: deal.deal_type,
                                                                                deal_status: deal.deal_status,
                                                                                inventory_id: deal.inventory_id || (deal.car ? (deal.car as any).id : '') || '',
                                                                                lead_id: deal.lead_id || '',
                                                                                inquiry_date: toDateInputValue(deal.inquiry_date),
                                                                                deal_date: toDateInputValue(deal.deal_date),
                                                                                rto_date: toDateInputValue(deal.rto_date),
                                                                                delivery_date: toDateInputValue(deal.delivery_date),
                                                                                handover_date: toDateInputValue(deal.handover_date),
                                                                                hypothecation_clearance_date: toDateInputValue(deal.hypothecation_clearance_date),
                                                                                total_amount: deal.total_amount ? String(deal.total_amount) : '',
                                                                                advance_paid: deal.advance_paid ? String(deal.advance_paid) : '',
                                                                                balance_due: deal.balance_due !== undefined && deal.balance_due !== null ? String(deal.balance_due) : '',
                                                                                payment_mode: deal.payment_mode || '',
                                                                                notes: deal.notes || '',
                                                                                internal_notes: deal.internal_notes || '',
                                                                            });
                                                                            setIsAddingDeal(true);
                                                                        }}
                                                                        className="h-7 px-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                                                                    >
                                                                        <Edit3 className="size-3 text-slate-500" />
                                                                        <span>Edit Deal</span>
                                                                    </button>

                                                                    {isAdmin && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeleteDeal(deal.id);
                                                                            }}
                                                                            className="size-7 rounded-lg bg-white border border-slate-200 hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                                                                            title="Delete Deal Record"
                                                                        >
                                                                            <Trash2 className="size-3" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Milestone Progress Bar */}
                                                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-3">
                                                                <div 
                                                                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                                                    style={{ width: `${progressPct}%` }} 
                                                                />
                                                            </div>

                                                            {/* Interactive 6 Milestone Cards */}
                                                            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
                                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                                                    {milestones.map((m) => {
                                                                        const Icon = m.icon;
                                                                        const isCompleted = Boolean(m.date);
                                                                        return (
                                                                            <div
                                                                                key={m.label}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (!isCompleted) {
                                                                                        handleQuickUpdateMilestone(deal, m.key, deal.deal_date || new Date().toISOString().split('T')[0]);
                                                                                    }
                                                                                }}
                                                                                className={`rounded-2xl p-3 text-center transition-all relative group flex flex-col justify-between ${
                                                                                    isCompleted 
                                                                                        ? 'bg-emerald-50/50 border border-emerald-200/80 shadow-xs' 
                                                                                        : 'bg-slate-50 border border-slate-200 hover:border-primary/50 hover:bg-primary/5 cursor-pointer'
                                                                                }`}
                                                                            >
                                                                                <div>
                                                                                    <div className={`size-8 rounded-xl mx-auto flex items-center justify-center mb-1.5 transition-colors ${
                                                                                        isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/80 text-slate-500 group-hover:bg-primary group-hover:text-white'
                                                                                    }`}>
                                                                                        <Icon className="size-4" />
                                                                                    </div>
                                                                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{m.label}</p>
                                                                                    <p className={`text-xs font-bold mt-0.5 ${isCompleted ? 'text-slate-800' : 'text-slate-400 group-hover:text-primary'}`}>
                                                                                        {m.date ? formatDate(m.date) : 'Pending'}
                                                                                    </p>
                                                                                </div>

                                                                                <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-center justify-center">
                                                                                    {isCompleted ? (
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                                                                                                <Check className="size-3 text-emerald-600" /> Done
                                                                                            </span>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    handleQuickUpdateMilestone(deal, m.key, null);
                                                                                                }}
                                                                                                className="text-[9px] font-bold text-slate-400 hover:text-red-500 hover:underline cursor-pointer"
                                                                                                title="Clear milestone date"
                                                                                            >
                                                                                                (Clear)
                                                                                            </button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleQuickUpdateMilestone(deal, m.key, deal.deal_date || new Date().toISOString().split('T')[0]);
                                                                                            }}
                                                                                            className="w-full py-1 px-2 rounded-lg bg-white border border-slate-200 group-hover:border-primary group-hover:bg-primary group-hover:text-white text-[10px] font-bold text-slate-700 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                                                                        >
                                                                                            <Plus className="size-2.5" /> Mark Done
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Cross-Page Connected Linkages Strip */}
                                                        <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-xs flex items-center gap-2 flex-wrap text-xs">
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">Connected Modules:</span>
                                                            
                                                            <Link
                                                                to="/admin/inventory"
                                                                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold flex items-center gap-1 transition-colors border border-slate-200/60"
                                                            >
                                                                <Car className="size-3 text-primary" />
                                                                <span>Inventory Hub</span>
                                                                <ArrowUpRight className="size-2.5 text-slate-400" />
                                                            </Link>

                                                            <Link
                                                                to="/admin/sales"
                                                                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold flex items-center gap-1 transition-colors border border-slate-200/60"
                                                            >
                                                                <ShoppingBag className="size-3 text-emerald-600" />
                                                                <span>Sales Ledger</span>
                                                                <ArrowUpRight className="size-2.5 text-slate-400" />
                                                            </Link>

                                                            {deal.deal_type === 'consignment' && (
                                                                <Link
                                                                    to="/admin/consignments"
                                                                    className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold flex items-center gap-1 transition-colors border border-slate-200/60"
                                                                >
                                                                    <Award className="size-3 text-amber-600" />
                                                                    <span>Park & Sell / Consignments</span>
                                                                    <ArrowUpRight className="size-2.5 text-slate-400" />
                                                                </Link>
                                                            )}

                                                            {originLead && (
                                                                <Link
                                                                    to={`/admin/leads/${originLead.id}`}
                                                                    className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold flex items-center gap-1 transition-colors border border-slate-200/60"
                                                                >
                                                                    <Sparkles className="size-3 text-blue-600" />
                                                                    <span>Original Lead Profile</span>
                                                                    <ArrowUpRight className="size-2.5 text-slate-400" />
                                                                </Link>
                                                            )}

                                                            <Link
                                                                to={`/admin/people/${customer.id}`}
                                                                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold flex items-center gap-1 transition-colors border border-slate-200/60"
                                                            >
                                                                <UserCheck className="size-3 text-purple-600" />
                                                                <span>Owner Mode Dossier</span>
                                                                <ArrowUpRight className="size-2.5 text-slate-400" />
                                                            </Link>
                                                        </div>

                                                        {/* Financial Breakdown Grid */}
                                                        <div>
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                                                                Financial Summary
                                                            </span>
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                                                <div className="p-3 bg-white rounded-xl border border-slate-100">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total Agreed Price</span>
                                                                    <p className="text-sm font-black text-primary mt-0.5">{formatCurrency(deal.total_amount)}</p>
                                                                </div>
                                                                <div className="p-3 bg-white rounded-xl border border-slate-100">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Advance / Token Paid</span>
                                                                    <p className="text-sm font-black text-emerald-600 mt-0.5">{formatCurrency(deal.advance_paid)}</p>
                                                                </div>
                                                                <div className="p-3 bg-white rounded-xl border border-slate-100">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Balance Outstanding</span>
                                                                    <p className={`text-sm font-black mt-0.5 ${Number(deal.balance_due || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                                        {formatCurrency(deal.balance_due)}
                                                                    </p>
                                                                </div>
                                                                <div className="p-3 bg-white rounded-xl border border-slate-100">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Payment Method</span>
                                                                    <p className="text-sm font-bold text-slate-700 mt-0.5">{deal.payment_mode || 'Paid in Full'}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Attached Deal Documents */}
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                                    <FileCheck className="size-3.5 text-primary" /> Documents Attached to this Deal ({dealDocs.length})
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleOpenUploadForDeal(deal);
                                                                    }}
                                                                    className="h-7 px-3 bg-primary hover:bg-primary-light text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                                                                >
                                                                    <Plus className="size-3" />
                                                                    <span>Attach Documents</span>
                                                                </button>
                                                            </div>

                                                            {/* Deal Documents List */}
                                                            {dealDocs.length > 0 ? (
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    {dealDocs.map(doc => (
                                                                        <div key={doc.id} className="bg-white border border-slate-100 rounded-xl p-3 flex items-center justify-between text-xs shadow-xs">
                                                                            <div className="min-w-0 pr-2">
                                                                                <p className="font-bold text-slate-800 truncate">{doc.doc_label || getDocLabel(doc.doc_type)}</p>
                                                                                <p className="text-[10px] text-slate-400 capitalize">{doc.party_role} · {getDocLabel(doc.doc_type)}</p>
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5">
                                                                                {doc.file_url && (
                                                                                    <a
                                                                                        href={doc.file_url}
                                                                                        target="_blank"
                                                                                        rel="noreferrer"
                                                                                        className="size-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors"
                                                                                        title="Open in Browser"
                                                                                    >
                                                                                        <Eye className="size-3.5" />
                                                                                    </a>
                                                                                )}
                                                                                {doc.file_url && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleDownloadDoc(doc)}
                                                                                        disabled={downloadingDocId === doc.id}
                                                                                        className="size-7 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 flex items-center justify-center transition-colors cursor-pointer"
                                                                                        title="Download"
                                                                                    >
                                                                                        <Download className="size-3.5" />
                                                                                    </button>
                                                                                )}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleLinkDocumentToDeal(doc.id, null)}
                                                                                    disabled={linkingDocId === doc.id}
                                                                                    className="size-7 rounded-lg bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-600 flex items-center justify-center transition-colors cursor-pointer"
                                                                                    title="Unlink from this deal"
                                                                                >
                                                                                    <Unlink className="size-3.5" />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleOpenUploadForDeal(deal);
                                                                    }}
                                                                    className="bg-white border-2 border-dashed border-slate-200 hover:border-primary/50 hover:bg-primary/5 rounded-2xl p-5 text-center transition-all cursor-pointer group"
                                                                >
                                                                    <UploadCloud className="size-7 text-slate-300 group-hover:text-primary mx-auto mb-1.5 transition-colors" />
                                                                    <p className="text-xs font-bold text-slate-700 group-hover:text-primary transition-colors">
                                                                        No documents attached to this vehicle deal yet
                                                                    </p>
                                                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                                                        Click here to upload RC Book, Insurance, Form 29/30, Delivery Receipt, or Invoices
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* Available General Vault Documents Picker (1-click Link) */}
                                                            {unlinkedVaultDocs.length > 0 && (
                                                                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                                            <Link2 className="size-3 text-slate-400" /> Available in Customer Vault ({unlinkedVaultDocs.length}) — Click to Link
                                                                        </span>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                        {unlinkedVaultDocs.map(doc => (
                                                                            <div key={doc.id} className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs hover:bg-slate-100 transition-colors">
                                                                                <div className="min-w-0 pr-2">
                                                                                    <p className="font-bold text-slate-700 truncate">{doc.doc_label || getDocLabel(doc.doc_type)}</p>
                                                                                    <p className="text-[10px] text-slate-400 capitalize">{getDocLabel(doc.doc_type)}</p>
                                                                                </div>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleLinkDocumentToDeal(doc.id, deal.id)}
                                                                                    disabled={linkingDocId === doc.id}
                                                                                    className="h-6 px-2 bg-white hover:bg-primary hover:text-white border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 shadow-xs"
                                                                                    title="Link this document to this deal"
                                                                                >
                                                                                    <Plus className="size-2.5" />
                                                                                    <span>Link</span>
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════════════════════════════════════════════
                        TAB: OVERVIEW & CRM JOURNEY
                    ════════════════════════════════════════════ */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* VIP Club Membership Card (if member) */}
                            {customerClubMember && (
                                <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-white rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
                                    <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3.5">
                                            <div className="size-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 shadow-sm">
                                                <Crown className="size-6 text-yellow-100" />
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded text-yellow-100">
                                                    Loyalty Rewards Active
                                                </span>
                                                <h3 className="text-lg font-black text-white mt-0.5">
                                                    {customerClubMember.membership_no ? `Card: ${customerClubMember.membership_no}` : 'Premium Club Member'}
                                                </h3>
                                                <p className="text-xs text-amber-100 mt-0.5">
                                                    Tier: <strong className="text-white uppercase">{customerClubMember.tier || 'Platinum'}</strong> · Joined: {formatDate(customerClubMember.created_at)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="bg-black/15 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-right">
                                                <span className="text-[10px] uppercase font-bold text-amber-200">Available Services</span>
                                                <p className="text-xl font-black text-white">{customerClubMember.available_services || customerClubMember.points || 0}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Lead Conversion Card */}
                            {originLead && (
                                <div className="bg-gradient-to-r from-slate-900 via-primary to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 size-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                                    <div className="relative z-10 space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="size-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-400 shrink-0">
                                                    <Sparkles className="size-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                            Lead Conversion Journey
                                                        </span>
                                                        <span className="text-[10px] font-bold text-white/60">
                                                            Original Enquiry: {formatDate(originLead.created_at)}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-base font-bold text-white mt-0.5">
                                                        Converted to Customer Profile
                                                    </h3>
                                                </div>
                                            </div>

                                            <Link
                                                to={`/admin/leads/${originLead.id}`}
                                                className="px-3.5 py-1.5 bg-white/10 hover:bg-white text-white hover:text-primary rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 self-start sm:self-center"
                                            >
                                                <ExternalLink className="size-3.5" />
                                                <span>Original Lead Profile</span>
                                            </Link>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2">
                                            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Channel / Source</p>
                                                <p className="font-bold text-white mt-0.5 capitalize">{originLead.source?.replace(/_/g, ' ') || 'Website Direct'}</p>
                                            </div>
                                            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Enquiry Type</p>
                                                <p className="font-bold text-white mt-0.5 uppercase">{originLead.type?.replace(/_/g, ' ') || 'Car Purchase'}</p>
                                            </div>
                                            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Assigned Advisor</p>
                                                <p className="font-bold text-white mt-0.5">{originLead.assigned_profile?.full_name || 'Showroom Team'}</p>
                                            </div>
                                            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Interested Model</p>
                                                <p className="font-bold text-emerald-300 mt-0.5">{originLead.car_make ? `${originLead.car_make} ${originLead.car_model || ''}` : 'Showroom Selection'}</p>
                                            </div>
                                        </div>

                                        {originLead.message && (
                                            <p className="text-xs text-white/80 bg-white/5 border border-white/10 rounded-2xl p-3 italic">
                                                "{originLead.message}"
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Linked Finance & Loan Applications */}
                            {customerFinanceApps.length > 0 && (
                                <div className="bg-white rounded-3xl border border-slate-100 p-5 space-y-3 shadow-xs">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Landmark className="size-4 text-primary" /> Finance & Insurance Applications ({customerFinanceApps.length})
                                        </h4>
                                        <Link to="/admin/finance-services" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                            <span>Finance Desk</span>
                                            <ArrowUpRight className="size-3" />
                                        </Link>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {customerFinanceApps.map((f: any) => (
                                            <div key={f.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-slate-800 uppercase">{f.service_type || 'Loan Application'}</span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                        f.status === 'approved' || f.status === 'disbursed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {f.status?.toUpperCase() || 'IN PROGRESS'}
                                                    </span>
                                                </div>
                                                <p className="text-slate-600 font-medium">{f.bank_name ? `Bank: ${f.bank_name}` : 'Provider Pending'} · Amount: {formatCurrency(f.loan_amount || f.amount)}</p>
                                                {f.car && <p className="text-[11px] text-slate-400">🚗 {f.car.year} {f.car.make} {f.car.model}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Contact Details & Addresses Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white rounded-3xl border border-slate-100 p-5 space-y-4 shadow-xs">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Contact & Personal Profile</h4>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex items-center justify-between py-2 border-b border-slate-50">
                                            <span className="text-slate-400">Primary Mobile</span>
                                            <span className="font-bold text-slate-800">{customer.phone}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2 border-b border-slate-50">
                                            <span className="text-slate-400">WhatsApp Contact</span>
                                            <span className="font-bold text-slate-800">{customer.whatsapp_number || customer.phone}</span>
                                        </div>
                                        {customer.alternate_phone && (
                                            <div className="flex items-center justify-between py-2 border-b border-slate-50">
                                                <span className="text-slate-400">Alternate Phone</span>
                                                <span className="font-bold text-slate-800">{customer.alternate_phone}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between py-2 border-b border-slate-50">
                                            <span className="text-slate-400">Email Address</span>
                                            <span className="font-bold text-slate-800">{customer.email || 'Not Provided'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2 border-b border-slate-50">
                                            <span className="text-slate-400">Occupation / Business</span>
                                            <span className="font-bold text-slate-800">{customer.occupation || '—'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-slate-400">Date of Birth</span>
                                            <span className="font-bold text-slate-800">{customer.date_of_birth ? formatDate(customer.date_of_birth) : '—'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl border border-slate-100 p-5 space-y-4 shadow-xs">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Registered Addresses</h4>
                                    <div className="space-y-3 text-xs">
                                        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Residential Address</p>
                                            <p className="text-slate-700 font-medium leading-relaxed">{customer.address || 'No residential address on file'}</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Office / Commercial Address</p>
                                            <p className="text-slate-700 font-medium leading-relaxed">{customer.office_address || 'No office address on file'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Customer Notes & Structured Log */}
                            <div className="bg-white rounded-3xl border border-slate-100 p-5 space-y-4 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <MessageSquare className="size-4 text-primary" /> Relationship Touchpoints & Notes ({customerNotes.length})
                                    </h4>
                                </div>

                                {/* Structured Notes History */}
                                {notesLoading ? (
                                    <div className="py-4 text-center text-xs text-slate-400">Loading notes…</div>
                                ) : customerNotes.length > 0 ? (
                                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                                        {customerNotes.map(n => (
                                            <div key={n.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-xs space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                                        n.note_type === 'call' ? 'bg-emerald-100 text-emerald-800' :
                                                        n.note_type === 'visit' ? 'bg-blue-100 text-blue-800' :
                                                        n.note_type === 'whatsapp' ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-800'
                                                    }`}>
                                                        {n.note_type}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">{formatDate(n.created_at)} by {n.author_name || 'Staff'}</span>
                                                </div>
                                                <p className="text-slate-800 font-medium leading-relaxed">{n.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : customer.notes ? (
                                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-950 whitespace-pre-line leading-relaxed font-medium">
                                        {customer.notes}
                                    </div>
                                ) : null}

                                {/* Quick Log Input */}
                                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
                                    <select
                                        value={quickNoteType}
                                        onChange={e => setQuickNoteType(e.target.value as any)}
                                        className="h-10 border border-slate-200 rounded-xl px-2.5 text-xs bg-slate-50 outline-none font-bold text-slate-700"
                                    >
                                        <option value="call">📞 Phone Call</option>
                                        <option value="visit">🚶 Visit</option>
                                        <option value="whatsapp">💬 WhatsApp</option>
                                        <option value="general">📝 General Note</option>
                                    </select>
                                    <input
                                        type="text"
                                        placeholder="Add interaction touchpoint (e.g. Discussed RC transfer, requested 2nd key)…"
                                        value={quickNote}
                                        onChange={e => setQuickNote(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleSaveQuickNote(); }}
                                        className="h-10 border border-slate-200 rounded-xl px-3.5 text-xs bg-slate-50 flex-1 outline-none focus:bg-white focus:ring-2 focus:ring-primary/10"
                                    />
                                    <button
                                        onClick={handleSaveQuickNote}
                                        disabled={!quickNote.trim() || noteSaving}
                                        className="h-10 px-4 bg-primary hover:bg-primary-light text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                                    >
                                        {noteSaving ? 'Saving…' : 'Log Note'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════
                        TAB: DOCUMENT VAULT & EXPIRY ALERTS
                    ════════════════════════════════════════════ */}
                    {activeTab === 'documents' && (
                        <div className="space-y-6">
                            {/* Expiry Alarm Banner */}
                            {criticalDocs.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-3xl p-4 sm:p-5 flex items-start gap-3.5">
                                    <div className="size-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0 mt-0.5">
                                        <AlertTriangle className="size-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-red-900">
                                            {criticalDocs.length} Document{criticalDocs.length !== 1 ? 's' : ''} Expiring / Expired
                                        </h4>
                                        <p className="text-xs text-red-700 mt-0.5">
                                            Action required: Renew {criticalDocs.map(d => d.doc_label || getDocLabel(d.doc_type)).join(', ')} to keep vehicle & legal records valid.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Filter Bar & Batch Upload Action */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                                    {[
                                        { id: 'all', label: 'All Vault Docs' },
                                        { id: 'buyer', label: 'Buyer KYC' },
                                        { id: 'seller', label: 'Seller NOCs' },
                                        { id: 'vehicle', label: 'RC & Insurance' },
                                        { id: 'rto', label: 'RTO Forms' },
                                        { id: 'agreements', label: 'Invoices & Proofs' },
                                    ].map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => setDocCategoryFilter(f.id)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                                docCategoryFilter === f.id ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 h-10 w-full sm:w-64">
                                        <Search className="size-3.5 text-slate-400 shrink-0" />
                                        <input
                                            value={docSearchQuery}
                                            onChange={e => setDocSearchQuery(e.target.value)}
                                            placeholder="Search vault…"
                                            className="bg-transparent text-xs text-primary outline-none w-full"
                                        />
                                    </div>

                                    <button
                                        onClick={() => {
                                            setSelectedDealForUpload('');
                                            setDocForm(emptyDocForm);
                                            setBatchItems([]);
                                            setIsAddingDoc(true);
                                        }}
                                        className="h-10 px-4 bg-primary hover:bg-primary-light text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer shrink-0"
                                    >
                                        <Plus className="size-4" />
                                        <span>Add Document</span>
                                    </button>
                                </div>
                            </div>

                            {/* Documents Grid */}
                            {docsLoading ? (
                                <div className="py-20 flex justify-center"><span className="size-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
                            ) : filteredDocuments.length === 0 ? (
                                <div className="py-16 text-center bg-slate-50 rounded-3xl border border-slate-100">
                                    <FileText className="size-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-700">No documents found</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Upload Aadhaar, PAN, RC, Insurance, or RTO forms to the vault.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredDocuments.map(doc => {
                                        const badge = getExpiryBadge(doc.expiry_date);
                                        const BadgeIcon = badge?.icon;
                                        const linkedDeal = deals.find(d => isDocLinkedToDeal(doc, d));

                                        return (
                                            <div key={doc.id} className="bg-white rounded-3xl border border-slate-100 p-5 shadow-[var(--shadow-card)] flex flex-col justify-between space-y-4">
                                                <div>
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-100">
                                                            {getDocLabel(doc.doc_type)}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400 capitalize bg-slate-50 px-2 py-0.5 rounded-md">
                                                            {doc.party_role}
                                                        </span>
                                                    </div>

                                                    <h4 className="text-sm font-bold text-slate-800 truncate" title={doc.doc_label || doc.file_name || getDocLabel(doc.doc_type)}>
                                                        {doc.doc_label || doc.file_name || getDocLabel(doc.doc_type)}
                                                    </h4>

                                                    {doc.file_name && (
                                                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{doc.file_name}</p>
                                                    )}

                                                    {linkedDeal ? (
                                                        <div className="mt-2 flex items-center justify-between gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                            <div className="flex items-center gap-1 truncate">
                                                                <Car className="size-3 text-emerald-600 shrink-0" />
                                                                <span className="truncate">
                                                                    {linkedDeal.car ? `${linkedDeal.car.year} ${linkedDeal.car.make} ${linkedDeal.car.model}` : 'Linked to Deal'}
                                                                </span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleLinkDocumentToDeal(doc.id, null)}
                                                                disabled={linkingDocId === doc.id}
                                                                className="text-emerald-700 hover:text-red-600 transition-colors shrink-0 ml-1 cursor-pointer"
                                                                title="Unlink from this deal"
                                                            >
                                                                <Unlink className="size-3" />
                                                            </button>
                                                        </div>
                                                    ) : deals.length > 0 ? (
                                                        <div className="mt-2">
                                                            <select
                                                                onChange={(e) => {
                                                                    if (e.target.value) handleLinkDocumentToDeal(doc.id, e.target.value);
                                                                }}
                                                                defaultValue=""
                                                                className="w-full text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 outline-none"
                                                            >
                                                                <option value="" disabled>+ Link to Vehicle Deal…</option>
                                                                {deals.map(d => (
                                                                    <option key={d.id} value={d.id}>
                                                                        🚗 {d.car ? `${d.car.year} ${d.car.make} ${d.car.model}` : d.deal_type}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    ) : null}

                                                    {badge && (
                                                        <div className={`mt-3 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${badge.cls}`}>
                                                            {BadgeIcon && <BadgeIcon className="size-3" />}
                                                            <span>{badge.label}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-xs">
                                                    <span className="text-[10px] text-slate-400">
                                                        {doc.issue_date ? `Issued: ${formatDate(doc.issue_date)}` : `Added ${formatDate(doc.created_at)}`}
                                                    </span>

                                                    <div className="flex items-center gap-1.5">
                                                        {doc.file_url && (
                                                            <a
                                                                href={doc.file_url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="size-8 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors"
                                                                title="Open in Browser"
                                                            >
                                                                <Eye className="size-3.5" />
                                                            </a>
                                                        )}

                                                        {doc.file_url && (
                                                            <button
                                                                onClick={() => handleDownloadDoc(doc)}
                                                                disabled={downloadingDocId === doc.id}
                                                                className="size-8 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 flex items-center justify-center transition-colors cursor-pointer"
                                                                title="Download Clean Copy"
                                                            >
                                                                <Download className="size-3.5" />
                                                            </button>
                                                        )}

                                                        {isAdmin && (
                                                            <button
                                                                onClick={() => handleDeleteDoc(doc.id)}
                                                                className="size-8 rounded-lg bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors cursor-pointer"
                                                                title="Delete from Vault"
                                                            >
                                                                <Trash2 className="size-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════════════════════════════════════════════
                        TAB: DELIVERY STORIES & CELEBRATIONS
                    ════════════════════════════════════════════ */}
                    {activeTab === 'delivery' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Customer Delivery Celebrations ({deliveries.length})</h3>
                                    <p className="text-xs text-slate-400">Handover memories, quotes, and showcase cards</p>
                                </div>
                                <button
                                    onClick={() => {
                                        const latestDeal = deals[0];
                                        setDeliveryStoryForm({
                                            ...emptyDeliveryStoryForm,
                                            inventory_id: latestDeal?.inventory_id || (latestDeal?.car?.id || ''),
                                            car_title: latestDeal?.car ? `${latestDeal.car.year} ${latestDeal.car.make} ${latestDeal.car.model}` : '',
                                            registration_no: latestDeal?.car?.registration_no || '',
                                        });
                                        setInventorySearch(latestDeal?.car ? `${latestDeal.car.year} ${latestDeal.car.make} ${latestDeal.car.model}` : '');
                                        setIsAddingDeliveryStory(true);
                                    }}
                                    className="h-10 px-4 bg-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-primary-light transition-colors shadow-sm cursor-pointer"
                                >
                                    <Plus className="size-4" />
                                    <span>Add Delivery Story</span>
                                </button>
                            </div>

                            {deliveriesLoading ? (
                                <div className="py-20 flex justify-center"><span className="size-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
                            ) : deliveries.length === 0 ? (
                                <div className="py-16 text-center bg-slate-50 rounded-3xl border border-slate-100">
                                    <Camera className="size-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-700">No delivery stories on file</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Capture car keys handover photos, quotes, and celebrate customer milestones.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {deliveries.map(del => (
                                        <div key={del.id} className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                                            <div>
                                                <div className="relative aspect-video bg-slate-100 overflow-hidden">
                                                    <img src={del.photo_url} alt={del.car_title} className="w-full h-full object-cover" />
                                                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-black text-amber-300">
                                                        <Star className="size-3 fill-amber-300" />
                                                        <span>{del.rating}★</span>
                                                    </div>
                                                </div>
                                                <div className="p-4 space-y-2">
                                                    <h4 className="text-sm font-bold text-slate-800">{del.car_title}</h4>
                                                    <p className="text-[11px] text-slate-400">{formatDate(del.delivery_date)} · {del.customer_city || 'Pune Hub'}</p>
                                                    {del.review_quote && (
                                                        <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                            "{del.review_quote}"
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="p-4 pt-0 flex items-center justify-between text-xs">
                                                <Link to="/admin/happy-customers" className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1">
                                                    <span>View on Showcase</span>
                                                    <ArrowUpRight className="size-3" />
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════════════════════════════════════════════
                        TAB: UNIFIED INTERACTION TIMELINE
                    ════════════════════════════════════════════ */}
                    {activeTab === 'timeline' && (
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-slate-800">Unified Customer Activity History</h3>

                            {timelineLoading ? (
                                <div className="py-20 flex justify-center"><span className="size-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
                            ) : timeline.length === 0 ? (
                                <div className="py-16 text-center bg-slate-50 rounded-3xl border border-slate-100">
                                    <Clock className="size-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-700">No interaction events yet</p>
                                </div>
                            ) : (
                                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                                    {timeline.map(ev => {
                                        const Icon = ev.icon;
                                        return (
                                            <div key={ev.id} className="relative flex items-start gap-4">
                                                <div className="absolute -left-6 size-4.5 rounded-full bg-white border-2 border-primary mt-1" />
                                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex-1 space-y-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                            <Icon className="size-3.5 text-primary" />
                                                            <span>{ev.title}</span>
                                                        </h4>
                                                        <span className="text-[10px] font-semibold text-slate-400">
                                                            {formatDate(ev.date.toISOString())}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-600">{ev.description}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════════════════════════════════════════════
                        TAB: AUDIT TRAIL
                    ════════════════════════════════════════════ */}
                    {activeTab === 'logs' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-800">Staff Mutation & Audit Logs</h3>
                            {logsLoading ? (
                                <div className="py-20 flex justify-center"><span className="size-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
                            ) : logs.length === 0 ? (
                                <div className="py-16 text-center bg-slate-50 rounded-3xl border border-slate-100">
                                    <Shield className="size-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-700">No audit logs recorded for this customer profile</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {logs.map(l => (
                                        <div key={l.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between text-xs">
                                            <div>
                                                <p className="font-bold text-slate-800">{l.action}</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">{l.details}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] text-slate-400">{formatDate(l.created_at)}</span>
                                                <p className="text-[10px] font-bold text-primary">{l.profiles?.full_name || 'System'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ════════════════════════════════════════════
                MODAL: Edit Customer Profile
            ════════════════════════════════════════════ */}
            {isEditing && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsEditing(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-primary to-primary-light text-white p-5 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold font-display">Edit Customer Profile</h2>
                                <p className="text-xs text-slate-300">Update personal and contact info</p>
                            </div>
                            <button onClick={() => setIsEditing(false)} className="size-7 rounded-full bg-white/20 flex items-center justify-center text-white cursor-pointer">
                                <X className="size-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCustomer} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={editForm.full_name || ''}
                                        onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Phone *</label>
                                    <input
                                        type="text"
                                        required
                                        value={editForm.phone || ''}
                                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Number</label>
                                    <input
                                        type="text"
                                        value={editForm.whatsapp_number || ''}
                                        onChange={e => setEditForm({ ...editForm, whatsapp_number: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={editForm.email || ''}
                                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                                    <input
                                        type="text"
                                        value={editForm.city || ''}
                                        onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Occupation</label>
                                    <input
                                        type="text"
                                        value={editForm.occupation || ''}
                                        onChange={e => setEditForm({ ...editForm, occupation: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Residential Address</label>
                                <textarea
                                    rows={2}
                                    value={editForm.address || ''}
                                    onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                                    className="w-full border border-slate-200 rounded-xl p-3 text-xs outline-none resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Office / Business Address</label>
                                <textarea
                                    rows={2}
                                    value={editForm.office_address || ''}
                                    onChange={e => setEditForm({ ...editForm, office_address: e.target.value })}
                                    className="w-full border border-slate-200 rounded-xl p-3 text-xs outline-none resize-none"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 h-10 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 h-10 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                    {saving ? 'Saving…' : 'Save Customer Details'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════
                MODAL: Deal Add / Edit
            ════════════════════════════════════════════ */}
            {isAddingDeal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsAddingDeal(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-primary to-primary-light text-white p-5 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold font-display">{editingDeal ? 'Edit Deal Record' : 'Add Deal Record'}</h2>
                                <p className="text-xs text-slate-300">Milestone lifecycle & financial tracker</p>
                            </div>
                            <button onClick={() => setIsAddingDeal(false)} className="size-7 rounded-full bg-white/20 flex items-center justify-center text-white cursor-pointer">
                                <X className="size-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveDeal} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Deal Type *</label>
                                    <select
                                        value={dealForm.deal_type}
                                        onChange={e => setDealForm({ ...dealForm, deal_type: e.target.value as any })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs bg-white outline-none"
                                    >
                                        {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Deal Status</label>
                                    <select
                                        value={dealForm.deal_status}
                                        onChange={e => setDealForm({ ...dealForm, deal_status: e.target.value as any })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs bg-white outline-none"
                                    >
                                        {Object.entries(DEAL_STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Inventory search */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-bold text-slate-700">Vehicle Selection</label>
                                    {dealForm.inventory_id && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDealForm({ ...dealForm, inventory_id: '' });
                                                setInventorySearch('');
                                            }}
                                            className="text-[10px] font-bold text-red-500 hover:underline cursor-pointer"
                                        >
                                            Clear Selection
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={inventorySearch}
                                        onChange={e => setInventorySearch(e.target.value)}
                                        placeholder="Search make, model or reg number…"
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:border-primary"
                                    />
                                    {inventoryList.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl mt-1 shadow-lg z-20 overflow-hidden max-h-48 overflow-y-auto">
                                            {inventoryList.map(car => (
                                                <button
                                                    key={car.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setDealForm({ ...dealForm, inventory_id: car.id });
                                                        setInventorySearch(`${car.year} ${car.make} ${car.model}${car.registration_no ? ` (${car.registration_no})` : ''}`);
                                                        setInventoryList([]);
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 text-xs flex items-center justify-between cursor-pointer border-b border-slate-100 last:border-0"
                                                >
                                                    <span className="font-bold text-slate-800">{car.year} {car.make} {car.model}</span>
                                                    <span className="text-slate-400 font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">{car.registration_no || 'No Reg'}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Milestone Dates */}
                            <div className="flex items-center justify-between pt-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Milestone Dates</p>
                                {dealForm.deal_date && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const d = dealForm.deal_date;
                                            setDealForm(prev => ({
                                                ...prev,
                                                inquiry_date: prev.inquiry_date || d,
                                                rto_date: prev.rto_date || d,
                                                delivery_date: prev.delivery_date || d,
                                                handover_date: prev.handover_date || d,
                                                hypothecation_clearance_date: prev.hypothecation_clearance_date || d,
                                                deal_status: 'completed'
                                            }));
                                        }}
                                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 cursor-pointer flex items-center gap-1"
                                    >
                                        <Sparkles className="size-2.5" /> Auto-fill from Deal Date
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Deal Finalized Date</label>
                                    <input
                                        type="date"
                                        value={dealForm.deal_date}
                                        onChange={e => setDealForm({ ...dealForm, deal_date: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">RTO / Transfer Date</label>
                                    <input
                                        type="date"
                                        value={dealForm.rto_date}
                                        onChange={e => setDealForm({ ...dealForm, rto_date: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Date</label>
                                    <input
                                        type="date"
                                        value={dealForm.delivery_date}
                                        onChange={e => setDealForm({ ...dealForm, delivery_date: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Actual Handover Date</label>
                                    <input
                                        type="date"
                                        value={dealForm.handover_date}
                                        onChange={e => setDealForm({ ...dealForm, handover_date: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                            </div>

                            {/* Financials */}
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider pt-2">Financials</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Total Agreed (₹)</label>
                                    <input
                                        type="number"
                                        value={dealForm.total_amount}
                                        onChange={e => {
                                            const total = e.target.value;
                                            const advance = dealForm.advance_paid || '0';
                                            const computedBal = total !== '' ? String(Math.max(0, Number(total) - Number(advance))) : '';
                                            setDealForm({ 
                                                ...dealForm, 
                                                total_amount: total,
                                                balance_due: computedBal,
                                                payment_mode: dealForm.payment_mode || (Number(advance) >= Number(total) ? 'Paid in Full' : 'Partial')
                                            });
                                        }}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Advance (₹)</label>
                                    <input
                                        type="number"
                                        value={dealForm.advance_paid}
                                        onChange={e => {
                                            const advance = e.target.value;
                                            const total = dealForm.total_amount || '0';
                                            const computedBal = total !== '' ? String(Math.max(0, Number(total) - Number(advance))) : '';
                                            setDealForm({ 
                                                ...dealForm, 
                                                advance_paid: advance,
                                                balance_due: computedBal,
                                                payment_mode: Number(advance) >= Number(total) && Number(total) > 0 ? 'Paid in Full' : dealForm.payment_mode
                                            });
                                        }}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Balance Due (₹)</label>
                                    <input
                                        type="number"
                                        value={dealForm.balance_due}
                                        onChange={e => setDealForm({ ...dealForm, balance_due: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
                                <select
                                    value={dealForm.payment_mode}
                                    onChange={e => setDealForm({ ...dealForm, payment_mode: e.target.value })}
                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs bg-white outline-none"
                                >
                                    <option value="">Select Mode…</option>
                                    {['Cash', 'Cheque', 'Online / NEFT', 'Finance / Loan', 'Mixed'].map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddingDeal(false)}
                                    className="flex-1 h-10 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={dealSaving}
                                    className="flex-1 h-10 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                    {dealSaving ? 'Saving…' : 'Save Deal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════
                MODAL: Document Vault Upload & Deal Attachment
            ════════════════════════════════════════════ */}
            {isAddingDoc && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsAddingDoc(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-primary to-primary-light text-white p-5 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold font-display">Document Vault Upload</h2>
                                <p className="text-xs text-slate-300">Attach KYC, RC, Insurance & RTO documents to customer and deals</p>
                            </div>
                            <button onClick={() => setIsAddingDoc(false)} className="size-7 rounded-full bg-white/20 flex items-center justify-center text-white cursor-pointer">
                                <X className="size-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                            {/* Target Deal Selector */}
                            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200">
                                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                                    <Car className="size-3.5 text-primary" />
                                    <span>Link Documents to Deal / Vehicle</span>
                                </label>
                                <select
                                    value={selectedDealForUpload}
                                    onChange={e => {
                                        const newDealId = e.target.value;
                                        setSelectedDealForUpload(newDealId);
                                        setBatchItems(curr => curr.map(b => ({ ...b, deal_id: newDealId })));
                                    }}
                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs bg-white outline-none font-medium"
                                >
                                    <option value="">📁 General Customer Document (Account Level)</option>
                                    {deals.map(d => (
                                        <option key={d.id} value={d.id}>
                                            🚗 {d.car ? `${d.car.year} ${d.car.make} ${d.car.model} (${d.car.registration_no || 'No Reg'})` : d.deal_type} — {formatCurrency(d.total_amount)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Drag & Drop Zone */}
                            <div
                                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={e => {
                                    e.preventDefault();
                                    setIsDragOver(false);
                                    if (e.dataTransfer.files) handleBatchFileSelect(e.dataTransfer.files);
                                }}
                                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
                                    isDragOver ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50/60'
                                }`}
                            >
                                <FileText className="size-10 text-slate-400 mx-auto mb-2" />
                                <p className="text-xs font-bold text-slate-700">Drag & drop files or browse</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">Supports PDF and photos with auto-compression</p>
                                <input
                                    type="file"
                                    multiple
                                    accept=".pdf,image/*"
                                    id="vault-file-input"
                                    className="hidden"
                                    onChange={e => { if (e.target.files) handleBatchFileSelect(e.target.files); }}
                                />
                                <label
                                    htmlFor="vault-file-input"
                                    className="mt-3 inline-flex items-center gap-1 px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                                >
                                    <span>Browse Files</span>
                                </label>
                            </div>

                            {/* Batch Items Queue */}
                            {batchItems.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
                                        Selected Documents ({batchItems.length})
                                    </p>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {batchItems.map(item => (
                                            <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2 text-xs">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-slate-800 truncate max-w-[200px]">{item.originalFile.name}</span>
                                                    <span className="text-[10px] font-bold text-slate-500">{item.statusText}</span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Doc Type</label>
                                                        <select
                                                            value={item.doc_type}
                                                            onChange={e => setBatchItems(curr => curr.map(b => b.id === item.id ? { ...b, doc_type: e.target.value } : b))}
                                                            className="w-full h-8 border border-slate-200 rounded-lg px-2 text-[11px] bg-white outline-none"
                                                        >
                                                            {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Role</label>
                                                        <select
                                                            value={item.party_role}
                                                            onChange={e => setBatchItems(curr => curr.map(b => b.id === item.id ? { ...b, party_role: e.target.value as any } : b))}
                                                            className="w-full h-8 border border-slate-200 rounded-lg px-2 text-[11px] bg-white outline-none"
                                                        >
                                                            <option value="buyer">Buyer</option>
                                                            <option value="seller">Seller</option>
                                                            <option value="general">General</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Expiry Date</label>
                                                        <input
                                                            type="date"
                                                            value={item.expiry_date}
                                                            onChange={e => setBatchItems(curr => curr.map(b => b.id === item.id ? { ...b, expiry_date: e.target.value } : b))}
                                                            className="w-full h-8 border border-slate-200 rounded-lg px-2 text-[11px] outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Custom Label</label>
                                                        <input
                                                            type="text"
                                                            value={item.doc_label}
                                                            onChange={e => setBatchItems(curr => curr.map(b => b.id === item.id ? { ...b, doc_label: e.target.value } : b))}
                                                            placeholder="e.g. Front & Back"
                                                            className="w-full h-8 border border-slate-200 rounded-lg px-2 text-[11px] outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {isBatchUploading && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs font-bold text-primary">
                                        <span>Uploading to Secure Vault…</span>
                                        <span>{batchOverallProgress}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${batchOverallProgress}%` }} />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddingDoc(false)}
                                    className="flex-1 h-10 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleBatchUploadSave}
                                    disabled={batchItems.length === 0 || isBatchUploading}
                                    className="flex-1 h-10 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-xs transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {isBatchUploading ? 'Uploading…' : `Upload ${batchItems.length} Document(s)`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════
                MODAL: Add Delivery Story / Handover
            ════════════════════════════════════════════ */}
            {isAddingDeliveryStory && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsAddingDeliveryStory(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-primary to-primary-light text-white p-5 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold font-display">Customer Delivery Story</h2>
                                <p className="text-xs text-slate-300">Vehicle keys handover celebration & testimonial</p>
                            </div>
                            <button onClick={() => setIsAddingDeliveryStory(false)} className="size-7 rounded-full bg-white/20 flex items-center justify-center text-white cursor-pointer">
                                <X className="size-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveDeliveryStory} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                            {/* Vehicle search / title */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Delivered Vehicle *</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        required
                                        value={deliveryStoryForm.car_title}
                                        onChange={e => {
                                            setDeliveryStoryForm({ ...deliveryStoryForm, car_title: e.target.value });
                                            setInventorySearch(e.target.value);
                                        }}
                                        placeholder="e.g. 2014 Maruti Suzuki Ertiga"
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:border-primary"
                                    />
                                    {inventoryList.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl mt-1 shadow-lg z-20 overflow-hidden max-h-48 overflow-y-auto">
                                            {inventoryList.map(car => (
                                                <button
                                                    key={car.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setDeliveryStoryForm({
                                                            ...deliveryStoryForm,
                                                            inventory_id: car.id,
                                                            car_title: `${car.year} ${car.make} ${car.model}`,
                                                            registration_no: car.registration_no || '',
                                                        });
                                                        setInventoryList([]);
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 text-xs flex items-center justify-between cursor-pointer border-b border-slate-100 last:border-0"
                                                >
                                                    <span className="font-bold text-slate-800">{car.year} {car.make} {car.model}</span>
                                                    <span className="text-slate-400 font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">{car.registration_no || 'No Reg'}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Date</label>
                                    <input
                                        type="date"
                                        value={deliveryStoryForm.delivery_date}
                                        onChange={e => setDeliveryStoryForm({ ...deliveryStoryForm, delivery_date: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Registration No</label>
                                    <input
                                        type="text"
                                        value={deliveryStoryForm.registration_no}
                                        onChange={e => setDeliveryStoryForm({ ...deliveryStoryForm, registration_no: e.target.value })}
                                        placeholder="MH12AB1234"
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                            </div>

                            {/* Handover Photo Upload */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Handover Celebration Photo *</label>
                                {deliveryStoryForm.photo_url ? (
                                    <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 mb-2">
                                        <img src={deliveryStoryForm.photo_url} alt="Delivery" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => setDeliveryStoryForm({ ...deliveryStoryForm, photo_url: '' })}
                                            className="absolute top-2 right-2 size-7 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"
                                        >
                                            <X className="size-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center bg-slate-50">
                                        <Camera className="size-8 text-slate-400 mx-auto mb-1" />
                                        <p className="text-xs font-bold text-slate-700">Upload Handover Photo</p>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            id="delivery-photo-input"
                                            className="hidden"
                                            onChange={e => {
                                                if (e.target.files?.[0]) handleDeliveryPhotoSelect(e.target.files[0]);
                                            }}
                                        />
                                        <label
                                            htmlFor="delivery-photo-input"
                                            className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-xs font-bold rounded-xl cursor-pointer"
                                        >
                                            {deliveryPhotoUploading ? 'Uploading…' : 'Browse Photo'}
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* Customer Review Quote & Rating */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Customer Review Quote</label>
                                <textarea
                                    rows={2}
                                    value={deliveryStoryForm.review_quote}
                                    onChange={e => setDeliveryStoryForm({ ...deliveryStoryForm, review_quote: e.target.value })}
                                    placeholder="e.g. Excellent condition and smooth delivery experience with Maharashtra Motors!"
                                    className="w-full border border-slate-200 rounded-xl p-3 text-xs outline-none resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Rating</label>
                                    <select
                                        value={deliveryStoryForm.rating}
                                        onChange={e => setDeliveryStoryForm({ ...deliveryStoryForm, rating: Number(e.target.value) })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs bg-white outline-none"
                                    >
                                        <option value={5}>⭐⭐⭐⭐⭐ (5 Stars)</option>
                                        <option value={4}>⭐⭐⭐⭐ (4 Stars)</option>
                                        <option value={3}>⭐⭐⭐ (3 Stars)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Tags (comma separated)</label>
                                    <input
                                        type="text"
                                        value={deliveryStoryForm.tags}
                                        onChange={e => setDeliveryStoryForm({ ...deliveryStoryForm, tags: e.target.value })}
                                        placeholder="Verified Buyer, Certified"
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddingDeliveryStory(false)}
                                    className="flex-1 h-10 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={deliveryStorySaving || deliveryPhotoUploading}
                                    className="flex-1 h-10 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                    {deliveryStorySaving ? 'Publishing…' : 'Publish Story'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerDetail;
