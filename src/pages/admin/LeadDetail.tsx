import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { toWhatsAppUrl, formatPriceLakh } from '../../lib/utils';
import HighlightText from '../../components/ui/HighlightText';
import { generateOpenRouterCompletion } from '../../lib/openrouter';
import { FALLBACK_INVENTORY } from '../../data/mockInventory';


// ─── Follow-Up Types ──────────────────────────────────────────────────────────

interface FollowUp {
    id: string;
    lead_id: string;
    contacted_via: string[];
    outcome: 'answered' | 'no_answer' | 'callback_requested' | 'not_interested' | 'interested' | 'converted' | null;
    notes: string | null;
    next_followup_date: string | null;
    is_done: boolean;
    created_by: string | null;
    assigned_to: string | null;
    created_at: string;
    duration_minutes: number | null;
}

// ─── Car Interest Types ───────────────────────────────────────────────────────

interface CarInterest {
    id: string;
    lead_id: string;
    customer_id: string | null;
    inventory_id: string | null;
    interest_level: 'hot' | 'warm' | 'cold';
    notes: string | null;
    created_at: string;
    is_wishlist?: boolean;
    custom_make?: string | null;
    custom_model?: string | null;
    custom_year?: number | null;
    custom_variant?: string | null;
    custom_color?: string | null;
    car?: {
        id: string;
        make: string;
        model: string;
        year: number;
        price: number;
        thumbnail: string | null;
        status: string;
    };
}

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
    lost_reason: string | null;
    contacted_at: string | null;
    created_at: string;
    lead_date: string | null;
    assigned_to: string | null;
    lead_quality?: string | null;
    budget?: string | null;
    notes?: string | null;
    internal_notes?: string | null;
    assigned_profile?: {
        full_name: string;
        email: string | null;
    } | null;
}

interface StaffProfile {
    id: string;
    full_name: string;
    role: string;
}

const statusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-amber-100 text-amber-700',
    negotiation: 'bg-purple-100 text-purple-700',
    closed_won: 'bg-green-100 text-green-700',
    closed_lost: 'bg-slate-100 text-slate-500',
};

const formatStatus = (val: string) => {
    const map: Record<string, string> = {
        new: 'New',
        contacted: 'Contacted',
        negotiation: 'Negotiating',
        closed_won: 'Closed (Won)',
        closed_lost: 'Closed (Lost)'
    };
    return map[val] || val;
};

const formatType = (val: string) => {
    const map: Record<string, string> = {
        contact: 'General Contact',
        sell_car: 'Sell Car',
        test_drive: 'Test Drive',
        insurance: 'Insurance',
        finance: 'Finance',
        car_service: 'Car Services',
    };
    return map[val] || val;
};

const formatQualityEmoji = (val: string | null | undefined) => {
    switch(val) {
        case 'hot': return '🔥 Hot';
        case 'warm': return '☀️ Warm';
        case 'cold': return '❄️ Cold';
        case 'cakewalk': return '🍰 Cakewalk';
        default: return null;
    }
};

// ─── AI Response Drafting Widget ──────────────────────────────────────────────
const AiResponseWidget: React.FC<{ lead: any; linkedCars: any[]; openRouterSettings: any }> = ({
    lead,
    linkedCars,
    openRouterSettings
}) => {
    const [draft, setDraft] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tone, setTone] = useState('polite');

    const [sentiment, setSentiment] = useState<{ score: string; sentiment: string; explanation: string } | null>(null);
    const [analyzing, setAnalyzing] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        setDraft('');
        
        try {
            const systemPrompt = `You are a professional sales assistant at "New Maharashtra Motors", a premier automotive dealership and service provider in Kolhapur, Maharashtra, India.
Your goal is to draft a helpful, professional, and persuasive response to a customer enquiry.
Keep the message concise, friendly, and structured for WhatsApp/email.
Do NOT use generic placeholders like "[Your Name]" or "[Dealer Name]" - sign off as "Sales Team, New Maharashtra Motors".
Provide real Indian context (e.g. Kolhapur, prices in Lakhs if mentioned). 
Write the draft directly without any introductory conversational wrapper (like "Here is the draft:").`;

            let carDetailsText = 'any suitable vehicle in our catalog';
            if (linkedCars && linkedCars.length > 0) {
                carDetailsText = linkedCars.map(c => `${c.year} ${c.make} ${c.model} (${c.transmission}, ${c.fuel_type}, Price: ₹${(c.price / 100000).toFixed(2)} Lakh)`).join(', ');
            } else if (lead.car_make) {
                carDetailsText = `${lead.car_year || ''} ${lead.car_make} ${lead.car_model || ''}`;
            }

            const toneDescription = tone === 'polite' 
                ? 'polite, professional, helpful, and welcoming'
                : tone === 'persuasive'
                ? 'persuasive, sales-oriented, emphasizing excellent value, and encouraging action (booking a visit/test drive)'
                : 'short, direct, and straightforward for quick WhatsApp messaging';

            const userPrompt = `Draft a response to:
Customer Name: ${lead.full_name}
Enquiry Type: ${lead.type === 'sell_car' ? 'Wants to SELL their car' : 'Wants to BUY a car'}
Customer Message: "${lead.message || 'Interested in vehicles'}"
Interested Vehicle(s): ${carDetailsText}
Budget: ${lead.budget || 'Not specified'}

The tone should be: ${toneDescription}.
Format the response clearly with line breaks suitable for WhatsApp. Include a call to action asking them to schedule a showroom visit at Kasaba Bawada, Kolhapur or book a test drive.`;

            const apiKey = openRouterSettings.api_key;
            const model = openRouterSettings.default_model === 'custom' 
                ? openRouterSettings.custom_model 
                : openRouterSettings.default_model;

            const response = await generateOpenRouterCompletion({
                apiKey,
                model,
                systemPrompt,
                userPrompt
            });
            
            setDraft(response);
        } catch (err: any) {
            console.error('AI Draft generation failed:', err);
            setError(err.message || 'Failed to generate response. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(draft);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleAnalyzeSentiment = async () => {
        if (!lead.message) return;
        setAnalyzing(true);
        setError(null);
        try {
            const systemPrompt = `You are an expert CRM analyst. Analyze the following customer car inquiry and return a JSON object with:
1. "score": "Hot" (highly interested, ready to buy/sell), "Warm" (interested but has questions/conditional), or "Cold" (low interest, spam, or generic enquiry).
2. "sentiment": "Positive", "Neutral", or "Negative".
3. "explanation": a concise 1-sentence explanation of why you gave this score.
Return ONLY valid JSON. No markdown backticks, no other text.`;
            const userPrompt = `Customer Message: "${lead.message}"`;
            
            const apiKey = openRouterSettings.api_key;
            const model = openRouterSettings.default_model === 'custom' 
                ? openRouterSettings.custom_model 
                : openRouterSettings.default_model;

            const response = await generateOpenRouterCompletion({
                apiKey,
                model,
                systemPrompt,
                userPrompt
            });
            
            const cleaned = response.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            setSentiment(parsed);
        } catch (err: any) {
            console.error('Sentiment analysis failed:', err);
            setError(err.message || 'Sentiment analysis failed.');
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <select
                    value={tone}
                    onChange={e => setTone(e.target.value)}
                    className="flex-1 h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-xs text-slate-700 outline-none focus:border-primary/40 focus:bg-white transition-colors cursor-pointer"
                >
                    <option value="polite">Professional & Polite</option>
                    <option value="persuasive">Persuasive (Sales-focused)</option>
                    <option value="short">Quick & Direct (WhatsApp)</option>
                </select>
                
                <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="h-9 px-4 bg-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-primary/95 disabled:opacity-50 transition-all shrink-0"
                >
                    <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>
                        {loading ? 'sync' : 'auto_awesome'}
                    </span>
                    {loading ? 'Generating...' : 'Generate Draft'}
                </button>
            </div>

            {openRouterSettings?.features?.sentiment_analysis && lead.message && (
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Customer Sentiment</span>
                    {!sentiment ? (
                        <button
                            onClick={handleAnalyzeSentiment}
                            disabled={analyzing}
                            className="text-[10px] text-primary hover:text-primary-light font-bold flex items-center gap-1"
                        >
                            {analyzing && <span className="material-symbols-outlined text-xs animate-spin">sync</span>}
                            {analyzing ? 'Analyzing...' : '⚡ Analyze Sentiment'}
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                sentiment.score === 'Hot' ? 'bg-red-500/10 text-red-600' :
                                sentiment.score === 'Warm' ? 'bg-amber-500/10 text-amber-600' :
                                'bg-slate-500/10 text-slate-600'
                            }`}>{sentiment.score} Lead</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                sentiment.sentiment === 'Positive' ? 'bg-green-500/10 text-green-600' :
                                sentiment.sentiment === 'Negative' ? 'bg-red-500/10 text-red-600' :
                                'bg-slate-500/10 text-slate-600'
                            }`}>{sentiment.sentiment}</span>
                        </div>
                    )}
                </div>
            )}

            {sentiment && (
                <div className="bg-purple-50/50 rounded-xl border border-purple-100/60 p-3 text-xs text-purple-900 leading-normal animate-fadeIn">
                    <p className="font-semibold text-[10px] text-purple-600 uppercase tracking-wider mb-0.5">Analyst Explanation</p>
                    <p className="italic">"{sentiment.explanation}"</p>
                </div>
            )}

            {error && (
                <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-xs">error</span> {error}
                </p>
            )}

            {draft && (
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-3.5 space-y-3 animate-fadeIn">
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-body">
                        {draft}
                    </pre>
                    <div className="flex gap-2 border-t border-slate-200/60 pt-3">
                        <button
                            onClick={handleCopy}
                            className="flex-1 h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                        >
                            <span className="material-symbols-outlined text-xs">{copied ? 'check' : 'content_copy'}</span>
                            {copied ? 'Copied!' : 'Copy Reply'}
                        </button>
                        <a
                            href={toWhatsAppUrl(lead.whatsapp_number || lead.phone, draft)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 h-8 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                        >
                            <span className="material-symbols-outlined text-xs">chat</span>
                            Open in WhatsApp
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};

const LeadDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const highlightQuery = searchParams.get('search') || '';
    const { inventory, activities, settings, refreshData } = useData() as any;
    const { profile, user } = useAuth();
    const { addNotification } = useNotifications();
    
    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [linkedCars, setLinkedCars] = useState<any[]>([]);
    const [linkedAccessories, setLinkedAccessories] = useState<any[]>([]);

    const isAdmin = profile?.role === 'admin';
    const canEdit = isAdmin || (lead?.assigned_to === profile?.id);
    
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Lead>>({});

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

    // Conversion State
    const [isConverting, setIsConverting] = useState(false);
    const [convertForm, setConvertForm] = useState({ inventory_id: '', final_price: '' });
    const [convertCarSearch, setConvertCarSearch] = useState('');
    const [convertCarSearchOpen, setConvertCarSearchOpen] = useState(false);

    // Staff State
    const [staffMembers, setStaffMembers] = useState<StaffProfile[]>([]);

    // Activity State
    const [note, setNote] = useState('');
    const [noteType, setNoteType] = useState('note');

    // Task State
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [taskForm, setTaskForm] = useState({ title: '', due_date: '', priority: 'Medium', description: '' });

    // ─── Follow-Up State ───────────────────────────────────────────────────────
    const [followUps, setFollowUps] = useState<FollowUp[]>([]);
    const [followUpsLoading, setFollowUpsLoading] = useState(false);
    const [isLoggingFollowUp, setIsLoggingFollowUp] = useState(false);
    const [followUpForm, setFollowUpForm] = useState({
        contacted_via: ['call'] as string[],
        outcome: 'answered' as NonNullable<FollowUp['outcome']>,
        notes: '',
        next_followup_date: '',
        duration_minutes: '',
    });
    const [followUpSaving, setFollowUpSaving] = useState(false);

    // ─── Car Interest State ────────────────────────────────────────────────────
    const [carInterests, setCarInterests] = useState<CarInterest[]>([]);
    const [carInterestsLoading, setCarInterestsLoading] = useState(false);
    const [isAddingCarInterest, setIsAddingCarInterest] = useState(false);
    const [carInterestForm, setCarInterestForm] = useState({ inventory_id: '', interest_level: 'warm', notes: '' });
    const [carInterestSaving, setCarInterestSaving] = useState(false);
    const [carSearch, setCarSearch] = useState('');
    const [carSearchOpen, setCarSearchOpen] = useState(false);
    const [carSelectorMode, setCarSelectorMode] = useState<'stock' | 'wishlist'>('stock');
    const [wishlistForm, setWishlistForm] = useState({ make: '', model: '', year: '', variant: '', color: '', interest_level: 'warm', notes: '' });

    // Service Conversion State
    const [isConvertingService, setIsConvertingService] = useState(false);
    const [serviceForm, setServiceForm] = useState({
        type: 'loan',
        provider_name: '',
        amount: '',
        premium_amount: '',
        policy_number: '',
        tenure_months: '',
        interest_rate: '',
        commission_earned: '',
        notes: ''
    });
    const [serviceSaving, setServiceSaving] = useState(false);

    const fetchFollowUps = useCallback(async () => {
        if (!id) return;
        setFollowUpsLoading(true);
        const { data, error } = await supabase
            .from('follow_ups')
            .select('*')
            .eq('lead_id', id)
            .order('created_at', { ascending: false });
        if (!error && data) setFollowUps(data as FollowUp[]);
        setFollowUpsLoading(false);
    }, [id]);

    const fetchCarInterests = useCallback(async () => {
        if (!id) return;
        setCarInterestsLoading(true);
        const { data, error } = await supabase
            .from('lead_car_interests')
            .select('*, car:inventory(id, make, model, year, price, thumbnail, status)')
            .eq('lead_id', id)
            .order('created_at', { ascending: false });
        if (!error && data) setCarInterests(data as CarInterest[]);
        setCarInterestsLoading(false);
    }, [id]);

    const handleLogFollowUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (followUpSaving) return;
        setFollowUpSaving(true);

        const formattedNextDate = followUpForm.next_followup_date
            ? followUpForm.next_followup_date.slice(0, 10)
            : null;

        const payload: any = {
            lead_id: id,
            contacted_via: followUpForm.contacted_via,
            outcome: followUpForm.outcome,
            notes: followUpForm.notes.trim() || null,
            next_followup_date: formattedNextDate,
            duration_minutes: followUpForm.duration_minutes
                ? Number(followUpForm.duration_minutes)
                : null,
            assigned_to: profile?.id ?? user?.id ?? null,
            created_by: profile?.id ?? user?.id ?? null,
            is_done: false,
            type: 'followup',
        };

        const { error } = await supabase.from('follow_ups').insert(payload);
        if (!error) {
            // Also log an activity for the timeline
            const methodsJoined = followUpForm.contacted_via.join(', ');
            const activityNoteText = `Follow-up via ${methodsJoined}: ${outcomeLabel(followUpForm.outcome)}${followUpForm.notes ? ' — ' + followUpForm.notes : ''}`;
            await supabase.from('lead_activities').insert({
                lead_id: id,
                type: 'followup',
                activity_type: followUpForm.contacted_via.join(',') || 'call',
                title: `Follow-up (${methodsJoined})`,
                description: activityNoteText,
                notes: activityNoteText,
                created_by: profile?.id ?? user?.id ?? null,
            });

            // If a next follow-up date was scheduled, insert a reminder task in tasks table
            if (formattedNextDate) {
                await supabase.from('tasks').insert({
                    lead_id: id,
                    title: `Follow-up with ${lead?.full_name || 'Lead'} (${methodsJoined})`,
                    description: followUpForm.notes.trim() || `Scheduled follow-up via ${methodsJoined}`,
                    due_date: new Date(formattedNextDate + 'T10:00:00').toISOString(),
                    priority: 'Medium',
                    status: 'pending',
                    assigned_to: lead?.assigned_to ?? profile?.id ?? user?.id ?? null,
                    created_by: profile?.id ?? user?.id ?? null,
                    category: 'followup'
                });
            }

            // If outcome is converted, update lead status
            if (followUpForm.outcome === 'converted' && lead?.status !== 'closed_won') {
                await supabase.from('leads').update({ status: 'negotiation' }).eq('id', id);
            }

            setFollowUpForm({ contacted_via: ['call'], outcome: 'answered', notes: '', next_followup_date: '', duration_minutes: '' });
            setIsLoggingFollowUp(false);
            fetchFollowUps();
            refreshData();
        } else {
            console.error('Failed to save follow-up:', error);
            alert('Failed to save follow-up: ' + (error.message || 'Please try again.'));
        }
        setFollowUpSaving(false);
    };

    const markFollowUpDone = async (fuId: string) => {
        await supabase.from('follow_ups').update({ is_done: true }).eq('id', fuId);
        fetchFollowUps();
    };

    const outcomeLabel = (val: string) => {
        const map: Record<string, string> = {
            answered: 'Answered',
            no_answer: 'No Answer',
            callback_requested: 'Callback Requested',
            not_interested: 'Not Interested',
            interested: 'Interested',
            converted: 'Converted',
        };
        return map[val] || val;
    };

    const fetchVisits = useCallback(async () => {
        if (!id) return;
        setVisitsLoading(true);
        const { data, error } = await supabase
            .from('visits')
            .select('*, staff:profiles!staff_id(full_name)')
            .eq('lead_id', id)
            .order('visit_date', { ascending: false });
        if (!error && data) setVisits(data as Visit[]);
        setVisitsLoading(false);
    }, [id]);

    const handleLogVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (visitSaving) return;
        setVisitSaving(true);

        const staffIdToUse = profile?.id ?? user?.id;
        if (!staffIdToUse) {
            alert('Cannot log visit: User session profile missing. Please log in again.');
            setVisitSaving(false);
            return;
        }

        const visitDateFormatted = visitForm.visit_date ? visitForm.visit_date.slice(0, 10) : new Date().toISOString().slice(0, 10);

        const payload = {
            lead_id: id,
            customer_id: null,
            staff_id: staffIdToUse,
            visit_date: visitDateFormatted,
            purpose: visitForm.purpose,
            location: visitForm.location.trim() || null,
            notes: visitForm.notes.trim() || null,
            outcome: visitForm.outcome,
            status: visitForm.outcome === 'successful' ? 'pending_approval' : 'approved',
        };

        try {
            const { data, error } = await supabase.from('visits').insert(payload).select().single();
            if (!error && data) {
                const noteText = `Visit logged on ${new Date(visitDateFormatted + 'T00:00:00').toLocaleDateString('en-IN')}: ${visitForm.purpose} was logged as ${visitForm.outcome === 'successful' ? 'Successful (Awaiting admin approval)' : 'Unsuccessful'}.${visitForm.notes ? ' Notes: ' + visitForm.notes : ''}`;
                // Log activity to lead timeline
                await supabase.from('lead_activities').insert({
                    lead_id: id,
                    type: 'visit',
                    activity_type: 'visit',
                    title: `Customer Visit (${visitForm.purpose})`,
                    description: noteText,
                    notes: noteText,
                    created_by: staffIdToUse,
                });

                // If outcome is successful, notify admins
                if (visitForm.outcome === 'successful') {
                    const targetName = lead?.full_name || 'Client';
                    await addNotification({
                        type: 'visit_logged',
                        category: 'critical',
                        priority: 2,
                        icon: 'notifications_active',
                        color: 'amber',
                        title: `🔔 Visit Approval Required`,
                        message: `${profile?.full_name || 'Staff'} logged a successful visit for ${targetName} (${visitForm.purpose}).`,
                        action_url: `/admin/leads/${id}`,
                        action_label: 'View Lead Detail',
                        related_entity_type: 'visit',
                        related_entity_id: data.id,
                        assigned_to_user_id: null,
                        dedup_key: `visit_approval_required_${data.id}`,
                        metadata: {
                            visit_id: data.id,
                            staff_name: profile?.full_name || 'Staff',
                            lead_name: targetName
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
                fetchVisits();
                refreshData();
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

    const outcomeColor = (val: string | null) => {
        if (!val) return 'bg-slate-100 text-slate-500';
        const map: Record<string, string> = {
            answered: 'bg-blue-100 text-blue-700',
            no_answer: 'bg-slate-100 text-slate-500',
            callback_requested: 'bg-amber-100 text-amber-700',
            not_interested: 'bg-red-100 text-red-600',
            interested: 'bg-green-100 text-green-700',
            converted: 'bg-emerald-100 text-emerald-700',
        };
        return map[val] || 'bg-slate-100 text-slate-500';
    };

    const handleAddCarInterest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (carInterestSaving) return;

        // Validation
        if (carSelectorMode === 'stock' && !carInterestForm.inventory_id) return;
        if (carSelectorMode === 'wishlist' && (!wishlistForm.make.trim() || !wishlistForm.model.trim())) return;

        setCarInterestSaving(true);

        let error;
        if (carSelectorMode === 'wishlist') {
            ({ error } = await supabase.from('lead_car_interests').insert({
                lead_id: id,
                inventory_id: null,
                is_wishlist: true,
                custom_make: wishlistForm.make.trim(),
                custom_model: wishlistForm.model.trim(),
                custom_year: wishlistForm.year ? Number(wishlistForm.year) : null,
                custom_variant: wishlistForm.variant.trim() || null,
                custom_color: wishlistForm.color.trim() || null,
                interest_level: wishlistForm.interest_level,
                notes: wishlistForm.notes.trim() || null,
                added_by: profile?.id ?? null,
            }));
        } else {
            ({ error } = await supabase.from('lead_car_interests').insert({
                lead_id: id,
                inventory_id: carInterestForm.inventory_id,
                is_wishlist: false,
                interest_level: carInterestForm.interest_level,
                notes: carInterestForm.notes.trim() || null,
                added_by: profile?.id ?? null,
            }));
        }

        if (!error) {
            setCarInterestForm({ inventory_id: '', interest_level: 'warm', notes: '' });
            setWishlistForm({ make: '', model: '', year: '', variant: '', color: '', interest_level: 'warm', notes: '' });
            setCarSearch('');
            setCarSelectorMode('stock');
            setIsAddingCarInterest(false);
            fetchCarInterests();
        } else {
            alert('Failed to save. ' + (error.message || 'Please try again.'));
        }
        setCarInterestSaving(false);
    };

    const handleRemoveCarInterest = async (interestId: string) => {
        const { error } = await supabase.from('lead_car_interests').delete().eq('id', interestId);
        if (!error) setCarInterests(prev => prev.filter(i => i.id !== interestId));
    };

    const viaIcon = (via: string) => {
        const map: Record<string, string> = {
            call: 'call', whatsapp: 'chat', email: 'mail', visit: 'directions_walk', meeting: 'groups',
        };
        return map[via] || 'phone';
    };

    const handleAddActivity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!note.trim()) return;

        try {
            const { error } = await supabase.from('lead_activities').insert({
                lead_id: id,
                type: noteType || 'note',
                activity_type: noteType || 'note',
                title: noteType === 'call' ? 'Logged Call' : noteType === 'email' ? 'Sent Email' : noteType === 'meeting' ? 'Meeting' : 'Internal Note',
                description: note.trim(),
                notes: note.trim(),
                created_by: profile?.id ?? user?.id ?? null,
            });

            if (!error) {
                setNote('');
                await refreshData();
            } else {
                console.error('Failed to log activity:', error);
                alert('Failed to log activity: ' + (error.message || 'Please try again.'));
            }
        } catch (error: any) {
            console.error(error);
            alert('Failed to log activity: ' + (error?.message || 'Please try again.'));
        }
    };

    const fetchStaff = useCallback(async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .in('role', ['admin', 'staff'])
            .eq('is_active', true)
            .order('full_name');
        if (!error && data) setStaffMembers(data as StaffProfile[]);
    }, []);

    const fetchLead = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('leads').select('*, assigned_profile:profiles!leads_assigned_to_fkey(full_name, email)').eq('id', id).single();
            if (data) {
                setLead(data as unknown as Lead);
                setEditForm(data);
                setServiceForm(prev => ({
                    ...prev,
                    type: data.type === 'insurance' ? 'insurance' : 'loan'
                }));
            }
        } catch (error) {
            console.error("Error fetching lead:", error);
        } finally {
            setLoading(false);
        }
    };

    // ─── Linked Sales State ───────────────────────────────────────────────────
    const [linkedSales, setLinkedSales] = useState<any[]>([]);

    const fetchSales = useCallback(async () => {
        if (!id) return;
        try {
            const { data, error } = await supabase
                .from('sales')
                .select('*, car:inventory!sales_inventory_id_fkey(*)')
                .or(`lead_id.eq.${id}`);

            if (!error && data) {
                setLinkedSales(data);
            }
        } catch (err) {
            console.error("Error fetching sales for lead:", err);
        }
    }, [id]);

    useEffect(() => {
        const fetchLinkedItems = async () => {
            try {
                // Fetch linked cars
                const { data: carsData, error: carsErr } = await supabase
                    .from('lead_inventory_items')
                    .select('inventory(*)')
                    .eq('lead_id', id);
                
                if (!carsErr && carsData) {
                    setLinkedCars(carsData.map((item: any) => item.inventory).filter(Boolean));
                }

                // Fetch linked accessories
                const { data: accData, error: accErr } = await supabase
                    .from('lead_accessories')
                    .select('accessories(*)')
                    .eq('lead_id', id);
                
                if (!accErr && accData) {
                    setLinkedAccessories(accData.map((item: any) => item.accessories).filter(Boolean));
                }
            } catch (err) {
                console.error("Error fetching linked items:", err);
            }
        };

        if (id) {
            fetchLead();
            fetchFollowUps();
            fetchCarInterests();
            fetchStaff();
            fetchVisits();
            fetchLinkedItems();
            fetchSales();
        }
    }, [id, fetchFollowUps, fetchCarInterests, fetchStaff, fetchVisits, fetchSales]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Remove joined fields that shouldn't be updated
            const { assigned_profile, ...updatePayload } = editForm;
            
            const { error } = await supabase.from('leads').update(updatePayload).eq('id', id);
            if (!error) {
                // Log status change or update
                let activityNote = 'Lead details updated.';
                let type = 'note';
                if (lead?.status !== editForm.status) {
                    type = 'status_change';
                    activityNote = `Lead status changed from ${formatStatus(lead?.status || '')} to ${formatStatus(editForm.status || '')}.`;
                } else if (lead?.assigned_to !== editForm.assigned_to) {
                    type = 'assignment_change';
                    const newAssignee = staffMembers.find(s => s.id === editForm.assigned_to)?.full_name || 'Unassigned';
                    activityNote = `Lead assigned to ${newAssignee}.`;
                }

                await supabase.from('lead_activities').insert({
                    lead_id: id,
                    type: type || 'note',
                    activity_type: type,
                    title: type === 'status_change' ? 'Status Changed' : type === 'assignment_change' ? 'Assignment Changed' : 'Lead Updated',
                    description: activityNote,
                    notes: activityNote,
                    created_by: profile?.id ?? user?.id ?? null,
                });

                setLead({ ...lead, ...editForm } as Lead);
                setIsEditing(false);
                await refreshData();
            } else {
                alert('Error updating lead.');
            }
        } catch (error) {
            console.error("Error updating lead", error);
        }
    };

    const handleQualityChange = async (newQuality: string) => {
        if (!id || newQuality === lead?.lead_quality) return;

        try {
            const { error } = await supabase.from('leads').update({ lead_quality: newQuality }).eq('id', id);
            if (!error) {
                await supabase.from('lead_activities').insert({
                    lead_id: id,
                    type: 'note',
                    activity_type: 'note',
                    title: 'Quality Rating Updated',
                    description: `Lead quality updated to ${newQuality}.`,
                    notes: `Lead quality updated to ${newQuality}.`,
                    created_by: profile?.id ?? user?.id ?? null,
                });
                
                setLead(prev => prev ? { ...prev, lead_quality: newQuality } : null);
                setEditForm(prev => ({ ...prev, lead_quality: newQuality }));
                await refreshData();
            } else {
                alert('Error updating lead quality.');
            }
        } catch (error) {
            console.error("Error updating lead quality", error);
        }
    };

    const handleConvert = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!convertForm.inventory_id || !convertForm.final_price) return;

        try {
            // ── 1. Fetch full inventory details (source, purchase_cost, fees) ────
            const { data: carData, error: carFetchErr } = await supabase
                .from('inventory')
                .select('id, make, model, year, price, source, purchase_cost, consignment_fee_type, consignment_fee_value, consignment_agreed_price, consignment_owner_name')
                .eq('id', convertForm.inventory_id)
                .single();
            if (carFetchErr || !carData) throw new Error('Could not fetch car details.');

            const salePrice = Number(convertForm.final_price);
            const source = carData.source || 'purchased';

            // ── 2. Compute profit & sale_type based on source ────────────────────
            let profit = 0;
            let saleType = 'purchased';
            let consignmentFeeCollected: number | null = null;

            if (source === 'consignment') {
                saleType = 'consignment';
                // Swami earns only the fee; buyer pays owner directly
                if (carData.consignment_fee_type === 'fixed') {
                    consignmentFeeCollected = carData.consignment_fee_value || 0;
                } else if (carData.consignment_fee_type === 'percentage' && carData.consignment_fee_value) {
                    consignmentFeeCollected = Math.round(salePrice * carData.consignment_fee_value / 100);
                }
                profit = consignmentFeeCollected || 0;
            } else if (source === 'dealer') {
                saleType = 'dealer';
                profit = salePrice - (carData.purchase_cost || 0);
            } else {
                // purchased
                saleType = 'purchased';
                profit = salePrice - (carData.purchase_cost || 0);
            }

            // ── 3. Duplicate customer check — reuse existing if phone matches ──
            let customerId: string;
            const { data: existingCustomer } = await supabase
                .from('customers')
                .select('id, full_name')
                .eq('phone', lead?.phone || '')
                .maybeSingle();

            if (existingCustomer) {
                customerId = existingCustomer.id;
            } else {
                // Create new customer
                const { data: custData, error: custErr } = await supabase.from('customers').insert({
                    full_name: lead?.full_name,
                    phone: lead?.phone,
                    email: lead?.email,
                    alternate_phone: lead?.secondary_phone || null,
                    address: lead?.personal_address || null,
                    office_address: lead?.office_address || null,
                    whatsapp_number: lead?.whatsapp_number || null,
                    lead_id: lead?.id || null,
                    loyalty_status: 'silver'
                }).select('id').single();
                if (custErr || !custData) throw new Error('Failed to create customer record.');
                customerId = custData.id;
            }

            // ── 4. Insert Sale (atomic — car NOT marked sold yet) ────────────────
            const { data: saleData, error: saleErr } = await supabase.from('sales').insert({
                customer_id: customerId,
                customer_name: lead?.full_name || '',
                customer_phone: lead?.phone || '',
                customer_email: lead?.email || null,
                inventory_id: convertForm.inventory_id,
                lead_id: lead?.id,
                sold_by: profile?.id,
                sale_date: new Date().toISOString().split('T')[0],
                sale_price: salePrice,
                final_price: salePrice,
                sale_type: saleType,
                profit: profit,
                purchase_cost_snapshot: carData.purchase_cost || null,
                consignment_fee_collected: consignmentFeeCollected,
                status: 'completed',
                payment_status: 'paid',
                notes: source === 'consignment'
                    ? `Consignment sale — buyer paid ${carData.consignment_owner_name || 'owner'} directly. Swami fee: ₹${profit.toLocaleString('en-IN')}`
                    : 'Converted from lead workflow'
            }).select('id').single();
            if (saleErr) throw new Error('Failed to log sale record. ' + saleErr.message);

            // ── 4b. Insert Customer Deal (populates Customer 360 Deals tab) ─────────
            try {
                await supabase.from('customer_deals').insert({
                    customer_id: customerId,
                    inventory_id: convertForm.inventory_id,
                    lead_id: lead?.id || null,
                    sale_id: saleData?.id || null,
                    deal_type: source === 'consignment' ? 'consignment' : 'purchase',
                    deal_status: 'completed',
                    inquiry_date: lead?.created_at ? new Date(lead.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    deal_date: new Date().toISOString().split('T')[0],
                    handover_date: new Date().toISOString().split('T')[0],
                    total_amount: salePrice,
                    advance_paid: salePrice,
                    balance_due: 0,
                    payment_mode: 'Paid',
                    notes: source === 'consignment'
                        ? `Consignment deal closed from lead. Fee earned: ₹${profit.toLocaleString('en-IN')}`
                        : `Purchased vehicle: ${carData.year || ''} ${carData.make} ${carData.model}`,
                    created_by: profile?.id ?? null,
                });
            } catch (dealErr) {
                console.warn('Could not auto-create customer deal row:', dealErr);
            }

            // ── 4c. Insert Customer Note (populates Owner/Admin Note timeline) ─────
            try {
                await supabase.from('customer_notes').insert({
                    customer_id: customerId,
                    note_type: 'general',
                    content: `🎉 Deal Closed & Vehicle Delivered: ${carData.year || ''} ${carData.make} ${carData.model} for ₹${salePrice.toLocaleString('en-IN')}.`,
                    created_by: profile?.id ?? null,
                });
            } catch (noteErr) {
                console.warn('Could not auto-create customer note:', noteErr);
            }

            // ── 4d. Audit Log ──────────────────────────────────────────────────────
            try {
                await supabase.from('audit_logs').insert({
                    user_id: profile?.id ?? null,
                    action: 'Lead Converted to Sale',
                    target_type: 'Customer',
                    target_name: lead?.full_name || 'Customer',
                    details: `Lead #${lead?.id?.slice(0, 8)} converted to sale for ${carData.make} ${carData.model}. Total: ₹${salePrice.toLocaleString('en-IN')}`,
                });
            } catch (auditErr) {
                console.warn('Could not write audit log:', auditErr);
            }

            // ── 5. Now mark car as sold (only after sale record confirmed) ───────
            await supabase.from('inventory').update({ status: 'sold' }).eq('id', convertForm.inventory_id);

            // ── 6. Link car interests to customer ────────────────────────────────
            await supabase.from('lead_car_interests')
                .update({ customer_id: customerId })
                .eq('lead_id', lead?.id);

            // ── 7. Update Lead status ────────────────────────────────────────────
            await supabase.from('leads').update({ status: 'closed_won' }).eq('id', lead?.id);

            // ── 8. Log Activity ──────────────────────────────────────────────────
            const saleNoteText = source === 'consignment'
                ? `Consignment sale ₹${salePrice.toLocaleString('en-IN')} — Swami earned ₹${profit.toLocaleString('en-IN')} fee.`
                : `Sale closed for ₹${salePrice.toLocaleString('en-IN')}. Profit: ₹${profit.toLocaleString('en-IN')}.`;
            await supabase.from('lead_activities').insert({
                lead_id: lead?.id,
                type: 'meeting',
                activity_type: 'meeting',
                title: 'Sale Closed & Converted',
                description: saleNoteText,
                notes: saleNoteText,
                created_by: profile?.id ?? user?.id ?? null,
            });

            await refreshData();
            setIsConverting(false);
            setConvertForm({ inventory_id: '', final_price: '' });
            setConvertCarSearch('');
            setConvertCarSearchOpen(false);
            fetchLead();

            const customerMsg = existingCustomer
                ? `Linked to existing customer: ${existingCustomer.full_name}.`
                : 'New customer record created.';
            alert(`Sale recorded! ${customerMsg}\nSwami earnings: ₹${profit.toLocaleString('en-IN')}`);
        } catch (error: any) {
            console.error('Error converting lead', error);
            alert(`Conversion failed: ${error.message}`);
        }
    };

    const handleConvertService = async (e: React.FormEvent) => {
        e.preventDefault();
        setServiceSaving(true);
        try {
            let customerId: string;
            const { data: existingCustomer } = await supabase
                .from('customers')
                .select('id, full_name')
                .eq('phone', lead?.phone || '')
                .maybeSingle();

            if (existingCustomer) {
                customerId = existingCustomer.id;
            } else {
                const { data: custData, error: custErr } = await supabase.from('customers').insert({
                    full_name: lead?.full_name,
                    phone: lead?.phone,
                    email: lead?.email,
                    alternate_phone: lead?.secondary_phone || null,
                    address: lead?.personal_address || null,
                    office_address: lead?.office_address || null,
                    whatsapp_number: lead?.whatsapp_number || null,
                    lead_id: lead?.id || null,
                    loyalty_status: 'silver'
                }).select('id').single();
                if (custErr || !custData) throw new Error('Failed to create customer record.');
                customerId = custData.id;
            }

            const carId = carInterests.length > 0 ? carInterests[0].inventory_id : null;

            const payload: any = {
                type: serviceForm.type,
                customer_id: customerId,
                car_id: carId || null,
                full_name: lead?.full_name,
                phone: lead?.phone,
                email: lead?.email,
                status: serviceForm.type === 'loan' ? 'approved' : 'policy_issued',
                provider_name: serviceForm.provider_name.trim() || null,
                amount: serviceForm.amount ? Number(serviceForm.amount) : null,
                tenure_months: serviceForm.tenure_months ? parseInt(serviceForm.tenure_months) : null,
                interest_rate: serviceForm.interest_rate ? Number(serviceForm.interest_rate) : null,
                premium_amount: serviceForm.premium_amount ? Number(serviceForm.premium_amount) : null,
                policy_number: serviceForm.policy_number.trim() || null,
                commission_earned: serviceForm.commission_earned ? Number(serviceForm.commission_earned) : 0,
                notes: serviceForm.notes.trim() || null
            };

            const { error: servErr } = await supabase.from('finance_services').insert(payload);
            if (servErr) throw servErr;

            await supabase.from('leads').update({ status: 'closed_won' }).eq('id', lead?.id);

            const serviceNoteText = `Converted to ${serviceForm.type === 'loan' ? 'Loan' : 'Insurance'} service file. Provider: ${serviceForm.provider_name || 'N/A'}. Commission: ₹${Number(serviceForm.commission_earned || 0).toLocaleString('en-IN')}`;
            await supabase.from('lead_activities').insert({
                lead_id: lead?.id,
                type: 'meeting',
                activity_type: 'meeting',
                title: 'Service File Converted',
                description: serviceNoteText,
                notes: serviceNoteText,
                created_by: profile?.id ?? user?.id ?? null,
            });

            await refreshData();
            setIsConvertingService(false);
            setServiceForm({
                type: 'loan',
                provider_name: '',
                amount: '',
                premium_amount: '',
                policy_number: '',
                tenure_months: '',
                interest_rate: '',
                commission_earned: '',
                notes: ''
            });
            fetchLead();
            alert(`${serviceForm.type === 'loan' ? 'Loan' : 'Insurance'} service file created successfully!`);
        } catch (error: any) {
            console.error('Error converting lead to service file:', error);
            alert(`Conversion failed: ${error.message}`);
        } finally {
            setServiceSaving(false);
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!taskForm.title || !taskForm.due_date) return;
        
        const { error } = await supabase.from('tasks').insert({
            lead_id: id,
            title: taskForm.title,
            description: taskForm.description || null,
            due_date: new Date(taskForm.due_date).toISOString(),
            priority: taskForm.priority,
            status: 'todo'
        });
        
        if (!error) {
            setTaskForm({ title: '', due_date: '', priority: 'Medium', description: '' });
            setIsAddingTask(false);
            refreshData(); // To pull tasks 
        } else {
            console.error(error);
            alert("Failed to create task");
        }
    };

    if (loading) return <div className="text-center py-20 text-slate-500 font-medium">Loading lead details...</div>;
    if (!lead) return (
        <div className="text-center py-20">
            <h3 className="text-xl font-bold text-slate-700 mb-4">Lead not found</h3>
            <Link to="/admin/leads" className="text-primary hover:underline">Return to Leads</Link>
        </div>
    );

    const leadActivities = activities.filter((a: any) => a.lead_id === id);
    const activityIcon = (type: string) => {
        if(type === 'call') return {icon: 'call', color: 'bg-green-500'};
        if(type === 'whatsapp') return {icon: 'chat', color: 'bg-green-600'};
        if(type === 'visit') return {icon: 'directions_walk', color: 'bg-emerald-600'};
        if(type === 'email') return {icon: 'mail', color: 'bg-blue-500'};
        if(type === 'meeting') return {icon: 'groups', color: 'bg-purple-500'};
        if(type === 'note') return {icon: 'sticky_note_2', color: 'bg-amber-500'};
        if(type === 'status_change') return {icon: 'swap_horiz', color: 'bg-indigo-500'};
        if(type === 'assignment_change') return {icon: 'person_add_alt', color: 'bg-teal-500'};
        return {icon: 'info', color: 'bg-slate-500'};
    };

    const dynamicTimeline = leadActivities.map((a: any) => {
        const types = a.activity_type ? a.activity_type.split(',') : ['note'];
        const mainStyle = activityIcon(types[0]);
        const allIcons = types.map((t: string) => activityIcon(t).icon);
        return {
            icons: allIcons,
            title: a.activity_type ? a.activity_type.replace(/,/g, ', ').toUpperCase() : 'ACTIVITY',
            desc: a.notes,
            time: new Date(a.created_at).toLocaleString('en-IN', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}),
            color: mainStyle.color
        };
    });

    const fullTimeline = [
        ...dynamicTimeline,
        { icons: ['person_add'], title: 'LEAD GENERATED', desc: `Inquiry received via ${formatType(lead.type)}`, time: new Date(lead.lead_date ? lead.lead_date + 'T00:00:00' : lead.created_at).toLocaleString('en-IN', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}), color: 'bg-slate-800' }
    ];

    const availableCars = inventory.filter((c: any) => c.status !== 'sold');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-2 gap-3">
                <div className="flex items-center gap-3">
                    <Link to="/admin/leads" className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><span className="material-symbols-outlined text-slate-400">arrow_back</span></Link>
                    <h1 className="text-xl font-bold text-primary font-display">Lead <span className="font-serif-italic font-normal text-amber-600">Profile</span></h1>
                </div>
                {!isEditing && (
                    <div className="flex gap-2">
                        <button onClick={() => {
                            const isAdmin = profile?.role === 'admin';
                            if (!isAdmin && lead.assigned_to !== profile?.id) {
                                const assignedStaff = staffMembers.find(s => s.id === lead.assigned_to)?.full_name || 'an Admin';
                                alert(`This lead is assigned to ${assignedStaff}. Please contact them to edit.`);
                                return;
                            }
                            setIsEditing(true);
                        }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">edit</span> Edit
                        </button>
                    </div>
                )}
            </div>

            {isEditing ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)] max-w-3xl">
                    <h2 className="text-lg font-bold text-primary font-display mb-6">Edit Lead Details</h2>
                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                            <input required type="text" value={editForm.full_name || ''} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                            <input required type="tel" value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Secondary Phone <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                            <input type="tel" value={editForm.secondary_phone || ''} onChange={e => setEditForm({ ...editForm, secondary_phone: e.target.value })} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" placeholder="Alternate number" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp Number <span className="text-xs text-slate-400 font-normal">(if different)</span></label>
                            <input type="tel" value={editForm.whatsapp_number || ''} onChange={e => setEditForm({ ...editForm, whatsapp_number: e.target.value })} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" placeholder="WhatsApp number" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Personal Address <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                            <input type="text" value={editForm.personal_address || ''} onChange={e => setEditForm({ ...editForm, personal_address: e.target.value })} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" placeholder="Residential address" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Office Address <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                            <input type="text" value={editForm.office_address || ''} onChange={e => setEditForm({ ...editForm, office_address: e.target.value })} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" placeholder="Workplace address" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <input type="email" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                            <select value={editForm.status || 'new'} onChange={e => {
                                const updates: any = { status: e.target.value };
                                if (e.target.value !== 'new' && lead?.status === 'new') {
                                    updates.contacted_at = new Date().toISOString();
                                }
                                setEditForm({ ...editForm, ...updates });
                            }} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                <option value="new">New</option>
                                <option value="contacted">Contacted</option>
                                <option value="negotiation">Negotiating</option>
                                <option value="closed_won">Closed (Won)</option>
                                <option value="closed_lost">Closed (Lost)</option>
                            </select>
                        </div>
                        
                        {editForm.status === 'closed_lost' && (
                            <div>
                                <label className="block text-sm font-medium text-red-700 mb-1">Reason for Lost Lead</label>
                                <select value={editForm.lost_reason || ''} onChange={e => setEditForm({ ...editForm, lost_reason: e.target.value })} className="w-full h-11 border border-red-200 bg-red-50 text-red-800 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-red-500/20">
                                    <option value="" disabled>Select Reason...</option>
                                    <option value="Price too high">Price too high</option>
                                    <option value="Bought elsewhere">Bought elsewhere</option>
                                    <option value="Financing failed">Financing failed</option>
                                    <option value="Lost contact">Lost contact / Ghosted</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Lead Quality</label>
                            <select value={editForm.lead_quality || ''} onChange={e => setEditForm({ ...editForm, lead_quality: e.target.value || null })} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                <option value="" disabled>Select Quality...</option>
                                <option value="hot">🔥 Hot</option>
                                <option value="warm">☀️ Warm</option>
                                <option value="cold">❄️ Cold</option>
                                <option value="cakewalk">🍰 Cakewalk</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Budget</label>
                            <input type="text" value={editForm.budget || ''} onChange={e => setEditForm({ ...editForm, budget: e.target.value })} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" placeholder="e.g. 5-6 Lakhs" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Lead Date <span className="text-xs text-slate-400 font-normal">(optional — overrides system date)</span></label>
                            <input
                                type="date"
                                value={(editForm as any).lead_date ?? lead.created_at.slice(0, 10)}
                                onChange={e => setEditForm({ ...editForm, lead_date: e.target.value || null } as any)}
                                className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Back-date walk-in leads or correct the recorded date.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                            <select value={editForm.type || 'contact'} onChange={e => setEditForm({ ...editForm, type: e.target.value })} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                <option value="contact">General Contact</option>
                                <option value="sell_car">Sell Car</option>
                                <option value="test_drive">Test Drive</option>
                                <option value="insurance">Insurance</option>
                                <option value="finance">Finance</option>
                                <option value="car_service">Car Services</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
                            <select
                                value={editForm.assigned_to || ''}
                                onChange={e => setEditForm({ ...editForm, assigned_to: e.target.value || null })}
                                className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white"
                            >
                                <option value="">Unassigned</option>
                                {staffMembers.map(staff => (
                                    <option key={staff.id} value={staff.id}>
                                        {staff.full_name} ({staff.role})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
                            <select value={editForm.source || 'Walk-in'} onChange={e => setEditForm({ ...editForm, source: e.target.value })} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
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

                        {editForm.type === 'sell_car' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Car Make</label>
                                    <input type="text" value={editForm.car_make || ''} onChange={e => setEditForm({ ...editForm, car_make: e.target.value })} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Car Model</label>
                                    <input type="text" value={editForm.car_model || ''} onChange={e => setEditForm({ ...editForm, car_model: e.target.value })} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Car Year</label>
                                    <input type="number" value={editForm.car_year || ''} onChange={e => setEditForm({ ...editForm, car_year: Number(e.target.value) })} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Car Mileage</label>
                                    <input type="number" value={editForm.car_mileage || ''} onChange={e => setEditForm({ ...editForm, car_mileage: Number(e.target.value) })} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                            </>
                        )}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Message / Notes</label>
                            <textarea rows={4} value={editForm.message || ''} onChange={e => setEditForm({ ...editForm, message: e.target.value })} className="w-full border border-slate-200 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors">Cancel</button>
                            <button type="submit" className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary-light transition-colors">Save Changes</button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Left - Profile & Info */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)] relative overflow-hidden">
                            {lead.status === 'closed_won' && (
                                <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 pb-4 pr-12 -mr-8 -mt-2 rotate-45 transform origin-top-right">
                                    CONVERTED
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row items-start gap-5">
                                <div className="size-16 rounded-2xl bg-gradient-to-br from-primary to-primary-light text-white flex items-center justify-center text-2xl font-bold shadow-lg shrink-0">
                                    {lead.full_name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h2 className="text-2xl font-black text-primary font-display">
                                            <HighlightText text={lead.full_name} highlight={highlightQuery} />
                                        </h2>
                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${statusColors[lead.status] || 'bg-slate-100 text-slate-500'}`}>{formatStatus(lead.status)}</span>
                                        {canEdit ? (
                                            <select
                                                value={lead.lead_quality || ''}
                                                onChange={e => handleQualityChange(e.target.value)}
                                                className="text-[10px] font-bold px-2.5 py-1 rounded-full border outline-none cursor-pointer bg-white text-slate-700 border-slate-200 hover:border-primary/40 focus:ring-2 focus:ring-primary/20"
                                            >
                                                <option value="" disabled>Set Quality</option>
                                                <option value="hot">🔥 Hot</option>
                                                <option value="warm">☀️ Warm</option>
                                                <option value="cold">❄️ Cold</option>
                                                <option value="cakewalk">🍰 Cakewalk</option>
                                            </select>
                                        ) : lead.lead_quality && (
                                            <span className="text-[10px] font-bold bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200 text-slate-700">
                                                {formatQualityEmoji(lead.lead_quality)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mt-2">
                                        <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[15px]">category</span> {formatType(lead.type)}
                                        </span>
                                        {/* ── Lead Date — inline editable by admin ── */}
                                        {canEdit ? (
                                            <span className="flex items-center gap-1 group cursor-pointer relative" title="Change lead date">
                                                <span className="material-symbols-outlined text-[15px] text-slate-400">event</span>
                                                <span className="text-sm text-slate-500 group-hover:text-primary transition-colors pointer-events-none select-none">
                                                    {lead.lead_date
                                                        ? new Date(lead.lead_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' })
                                                        : new Date(lead.created_at).toLocaleDateString()
                                                    }
                                                </span>
                                                <span className="material-symbols-outlined text-[12px] text-slate-300 group-hover:text-primary transition-colors pointer-events-none">edit</span>
                                                <input
                                                    type="date"
                                                    value={lead.lead_date ?? lead.created_at.slice(0, 10)}
                                                    onChange={async e => {
                                                        const newDate = e.target.value || null;
                                                        const { error } = await supabase.from('leads').update({ lead_date: newDate }).eq('id', id);
                                                        if (!error) {
                                                            setLead(prev => prev ? { ...prev, lead_date: newDate } : null);
                                                            setEditForm(prev => ({ ...prev, lead_date: newDate }));
                                                            await supabase.from('lead_activities').insert({
                                                                lead_id: id,
                                                                activity_type: 'note',
                                                                notes: `Lead date updated to ${newDate ? new Date(newDate + 'T00:00:00').toLocaleDateString('en-IN') : 'system default'}.`,
                                                                created_by: profile?.id ?? null,
                                                            });
                                                        }
                                                    }}
                                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                />
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[15px]">event</span>
                                                {lead.lead_date
                                                    ? new Date(lead.lead_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' })
                                                    : new Date(lead.created_at).toLocaleDateString()
                                                }
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full text-xs font-semibold text-slate-600 border border-slate-200">Source: {lead.source || 'Website'}</span>
                                        {lead.assigned_profile ? (
                                            <span className="flex items-center gap-1 bg-blue-50 px-2.5 py-0.5 rounded-full text-xs font-bold text-blue-700 border border-blue-200">
                                                <span className="material-symbols-outlined text-[14px]">assignment_ind</span>
                                                Assigned: {lead.assigned_profile.full_name}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 bg-amber-50 px-2.5 py-0.5 rounded-full text-xs font-bold text-amber-700 border border-amber-200">
                                                <span className="material-symbols-outlined text-[14px]">warning</span>
                                                Unassigned
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="size-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                                        <span className="material-symbols-outlined text-slate-400 text-sm">call</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Primary Phone</p>
                                        <p className="text-sm font-bold text-primary"><HighlightText text={lead.phone} highlight={highlightQuery} /></p>
                                    </div>
                                </div>
                                {lead.secondary_phone && (
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                                            <span className="material-symbols-outlined text-slate-400 text-sm">phone_in_talk</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">Secondary Phone</p>
                                            <p className="text-sm font-bold text-primary"><HighlightText text={lead.secondary_phone} highlight={highlightQuery} /></p>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center gap-3">
                                    <div className="size-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                                        <span className="material-symbols-outlined text-slate-400 text-sm">mail</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Email Address</p>
                                        <p className="text-sm font-bold text-primary">{lead.email ? <HighlightText text={lead.email} highlight={highlightQuery} /> : 'Not provided'}</p>
                                    </div>
                                </div>
                                {lead.budget && (
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                                            <span className="material-symbols-outlined text-slate-400 text-sm">account_balance_wallet</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">Budget</p>
                                            <p className="text-sm font-bold text-primary"><HighlightText text={lead.budget} highlight={highlightQuery} /></p>
                                        </div>
                                    </div>
                                )}
                                {lead.whatsapp_number && (
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                                            <span className="material-symbols-outlined text-slate-400 text-sm">forum</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">WhatsApp</p>
                                            <p className="text-sm font-bold text-primary"><HighlightText text={lead.whatsapp_number} highlight={highlightQuery} /></p>
                                        </div>
                                    </div>
                                )}
                                {lead.personal_address && (
                                    <div className="flex items-center gap-3 md:col-span-2">
                                        <div className="size-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
                                            <span className="material-symbols-outlined text-slate-400 text-sm">home</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">Personal Address</p>
                                            <p className="text-sm font-bold text-primary"><HighlightText text={lead.personal_address} highlight={highlightQuery} /></p>
                                        </div>
                                    </div>
                                )}
                                {lead.office_address && (
                                    <div className="flex items-center gap-3 md:col-span-2">
                                        <div className="size-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
                                            <span className="material-symbols-outlined text-slate-400 text-sm">business</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">Office Address</p>
                                            <p className="text-sm font-bold text-primary"><HighlightText text={lead.office_address} highlight={highlightQuery} /></p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-3 mt-6">
                                <a href={`tel:${lead.phone}`} className="flex-1 h-10 bg-primary text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-primary-light transition-colors"><span className="material-symbols-outlined text-base">call</span> Call Lead</a>
                                <a href={toWhatsAppUrl(lead.whatsapp_number || lead.phone)} target="_blank" rel="noreferrer" className="flex-1 h-10 bg-green-600 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-green-500 transition-colors"><span className="material-symbols-outlined text-base">chat</span> Message</a>
                            </div>
                        </div>

                        {/* ── Vehicle Purchased Banner Card ── */}
                        {linkedSales.length > 0 && (
                            <div className="bg-gradient-to-br from-emerald-900 via-primary to-emerald-950 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden border border-emerald-500/30 animate-fadeIn">
                                <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
                                    <span className="material-symbols-outlined text-[180px]">verified</span>
                                </div>
                                <div className="flex items-center justify-between mb-4 flex-wrap gap-2 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <span className="py-1 px-3 bg-emerald-400/20 text-emerald-300 font-bold text-xs rounded-full border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                                            <span className="material-symbols-outlined text-sm">verified</span> Vehicle Purchased & Deal Closed
                                        </span>
                                        <span className="text-xs font-semibold text-emerald-200/80">
                                            Purchased on {new Date(linkedSales[0].sale_date || linkedSales[0].created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link to="/admin/sales" className="text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-1 transition-all">
                                            <span className="material-symbols-outlined text-sm">point_of_sale</span> View Sale Ledger
                                        </Link>
                                        <Link to="/admin/customers" className="text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 px-3 py-1.5 rounded-xl border border-emerald-400/30 flex items-center gap-1 transition-all">
                                            <span className="material-symbols-outlined text-sm">person</span> Customer 360 CRM
                                        </Link>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-3 gap-4 bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 relative z-10">
                                    {/* Vehicle Details */}
                                    <div className="md:col-span-2 flex items-start gap-4">
                                        {linkedSales[0].car?.thumbnail ? (
                                            <img src={linkedSales[0].car.thumbnail} alt="" className="size-20 rounded-xl object-cover border border-white/20 shrink-0 shadow-md" />
                                        ) : (
                                            <div className="size-20 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-white text-3xl">directions_car</span>
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <h3 className="text-lg font-black text-white font-display">
                                                {linkedSales[0].car?.year || ''} {linkedSales[0].car?.make} {linkedSales[0].car?.model} {linkedSales[0].car?.variant || ''}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-100">
                                                {linkedSales[0].car?.fuel_type && <span className="bg-white/10 px-2 py-0.5 rounded-md font-medium">{linkedSales[0].car.fuel_type}</span>}
                                                {linkedSales[0].car?.transmission && <span className="bg-white/10 px-2 py-0.5 rounded-md font-medium">{linkedSales[0].car.transmission}</span>}
                                                {linkedSales[0].car?.color && <span className="bg-white/10 px-2 py-0.5 rounded-md font-medium">{linkedSales[0].car.color}</span>}
                                                {linkedSales[0].car?.registration_no && (
                                                    <span className="bg-emerald-400/20 text-emerald-200 font-mono font-bold px-2 py-0.5 rounded-md border border-emerald-400/30">
                                                        Reg: {linkedSales[0].car.registration_no}
                                                    </span>
                                                )}
                                            </div>
                                            {linkedSales[0].notes && (
                                                <p className="text-[11px] text-emerald-200/80 italic mt-1 line-clamp-1">"{linkedSales[0].notes}"</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Financial Breakdown */}
                                    <div className="flex flex-col justify-center items-start md:items-end border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-4">
                                        <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">Final Sale Price</p>
                                        <p className="text-2xl font-black text-white font-display">
                                            ₹{((Number(linkedSales[0].sale_price ?? linkedSales[0].final_price) || 0) / 100000).toFixed(2)} Lakh
                                        </p>
                                        <span className="mt-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-400/30 text-emerald-200 uppercase tracking-wider border border-emerald-400/40 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-xs">check_circle</span> Payment: {linkedSales[0].payment_status || 'Paid'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Vehicle/Inquiry Info */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                            <h3 className="font-bold text-primary font-display mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-accent text-lg">info</span> 
                                {lead.type === 'sell_car' ? 'Vehicle Details' : 'Inquiry Context'}
                            </h3>
                            
                            {lead.type === 'sell_car' && lead.car_make ? (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Make</p>
                                        <p className="text-sm font-bold text-primary"><HighlightText text={lead.car_make} highlight={highlightQuery} /></p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Model</p>
                                        <p className="text-sm font-bold text-primary"><HighlightText text={lead.car_model} highlight={highlightQuery} /></p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Year</p>
                                        <p className="text-sm font-bold text-primary">{lead.car_year || '—'}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Km Driven</p>
                                        <p className="text-sm font-bold text-primary">{lead.car_mileage ? `${lead.car_mileage.toLocaleString()}` : '—'}</p>
                                    </div>
                                </div>
                            ) : null}

                            <div className="bg-slate-50 p-4 xl:p-5 rounded-xl border border-slate-100 space-y-4">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Inquiry Message</p>
                                    {lead.message ? (
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed"><HighlightText text={lead.message} highlight={highlightQuery} /></p>
                                    ) : (
                                        <p className="text-sm text-slate-400 italic">No message provided.</p>
                                    )}
                                </div>
                                {lead.notes && (
                                    <div className="border-t border-slate-200/60 pt-3">
                                        <p className="text-[10px] text-amber-600 font-bold uppercase mb-1">Customer Notes</p>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed"><HighlightText text={lead.notes} highlight={highlightQuery} /></p>
                                    </div>
                                )}
                                {lead.internal_notes && (
                                    <div className="border-t border-slate-200/60 pt-3">
                                        <p className="text-[10px] text-red-600 font-bold uppercase mb-1">Internal Notes</p>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed"><HighlightText text={lead.internal_notes} highlight={highlightQuery} /></p>
                                    </div>
                                )}
                            </div>

                            {/* Linked Vehicles from Catalog Cart */}
                            {linkedCars.length > 0 && (
                                <div className="mt-6 border-t border-slate-100 pt-6">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-sm text-primary">directions_car</span>
                                        Linked Vehicles ({linkedCars.length})
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {linkedCars.map(car => (
                                            <div key={car.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors">
                                                <div className="w-16 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                                                    {car.thumbnail ? (
                                                        <img src={car.thumbnail} alt={`${car.make} ${car.model}`} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-slate-100">
                                                            <span className="material-symbols-outlined text-slate-300 text-xl">directions_car</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <Link to={`/car/${car.id}`} target="_blank" className="text-xs sm:text-sm font-bold text-slate-800 hover:text-primary transition-colors truncate block">
                                                        {car.year} {car.make} {car.model}
                                                    </Link>
                                                    <p className="text-[10px] text-slate-400 font-semibold">{car.fuel_type} • {car.transmission} • {car.condition}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-xs font-black text-primary">₹ {formatPriceLakh(car.price)} L</p>
                                                    <p className="text-[9px] text-slate-400 mt-0.5">{car.status}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Linked Accessories from Catalog Quote */}
                            {linkedAccessories.length > 0 && (
                                <div className="mt-6 border-t border-slate-100 pt-6">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-sm text-primary">tune</span>
                                        Selected Accessories ({linkedAccessories.length})
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {linkedAccessories.map(acc => (
                                            <div key={acc.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors">
                                                <div className="w-10 h-10 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                                                    {acc.image_url ? (
                                                        <img src={acc.image_url} alt={acc.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-slate-100">
                                                            <span className="material-symbols-outlined text-slate-300 text-lg">tune</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-slate-800 truncate">{acc.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-semibold">{acc.category}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-xs font-black text-primary">₹ {Number(acc.price).toLocaleString('en-IN')}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* AI Smart Response Assistant Linkage */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)] space-y-4">
                            <h3 className="font-bold text-primary font-display flex items-center gap-2">
                                <span className="material-symbols-outlined text-purple-600 text-lg">smart_toy</span>
                                AI Smart Response Assistant
                            </h3>
                            
                            {!settings?.openrouter_settings?.is_enabled || !settings?.openrouter_settings?.api_key ? (
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col items-center text-center">
                                    <span className="material-symbols-outlined text-slate-300 text-3xl mb-2">lock</span>
                                    <p className="text-xs font-semibold text-slate-700">AI Response Drafting is Disabled</p>
                                    <p className="text-[11px] text-slate-400 mt-1 max-w-[280px]">
                                        To draft instant context-aware replies, configure your OpenRouter API key in settings.
                                    </p>
                                    <Link 
                                        to="/admin/settings#openrouter" 
                                        className="mt-3.5 h-8 px-4 bg-primary text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5 hover:bg-primary-light transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-xs">settings</span>
                                        Configure OpenRouter Settings
                                    </Link>
                                </div>
                            ) : !settings?.openrouter_settings?.features?.lead_response_suggestions ? (
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col items-center text-center">
                                    <span className="material-symbols-outlined text-slate-300 text-3xl mb-2">toggle_off</span>
                                    <p className="text-xs font-semibold text-slate-700">Smart Lead Responses Feature Off</p>
                                    <p className="text-[11px] text-slate-400 mt-1 max-w-[280px]">
                                        The smart responses feature is disabled in settings. Enable it to generate reply suggestions.
                                    </p>
                                    <Link 
                                        to="/admin/settings#openrouter" 
                                        className="mt-3.5 h-8 px-4 bg-primary text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5 hover:bg-primary-light transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-xs">settings</span>
                                        Enable Feature in Settings
                                    </Link>
                                </div>
                            ) : (
                                <AiResponseWidget lead={lead} linkedCars={linkedCars} openRouterSettings={settings.openrouter_settings} />
                            )}
                        </div>

                        {/* Timeline */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                            <h3 className="font-bold text-primary font-display mb-5 flex items-center gap-2"><span className="material-symbols-outlined text-accent text-lg">history</span> Activity Timeline</h3>
                            
                            {canEdit && (
                                <form onSubmit={handleAddActivity} className="mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-3 mb-3">
                                    <select value={noteType} onChange={(e) => setNoteType(e.target.value)} className="h-9 px-3 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 font-bold outline-none focus:border-primary/50 cursor-pointer">
                                        <option value="note">Internal Note</option>
                                        <option value="call">Logged Call</option>
                                        <option value="email">Sent Email</option>
                                        <option value="meeting">Meeting</option>
                                    </select>
                                </div>
                                <textarea required value={note} onChange={(e) => setNote(e.target.value)} placeholder="Type your notes or call summary..." rows={3} className="w-full text-sm p-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/10 mb-3 bg-white"></textarea>
                                <div className="flex justify-end">
                                    <button type="submit" className="h-9 px-5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-light transition-colors shadow-sm">Log Activity</button>
                                </div>
                                </form>
                            )}

                            <div className="space-y-6">
                                {fullTimeline.map((event, i) => (
                                    <div key={i} className="flex gap-4">
                                        <div className="flex flex-col items-center">
                                            <div className={`size-10 rounded-xl ${event.color} flex items-center justify-center shadow-inner shrink-0 px-1`}>
                                                <div className={`flex items-center justify-center ${event.icons.length > 1 ? '-space-x-1.5' : ''}`}>
                                                    {event.icons.slice(0, 3).map((ic: string, idx: number) => (
                                                        <span key={idx} className={`material-symbols-outlined text-white drop-shadow-sm ${event.icons.length > 1 ? 'text-[15px]' : 'text-[18px]'}`}>{ic}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            {i < fullTimeline.length - 1 && <div className="w-0.5 flex-1 bg-slate-100 mt-2" />}
                                        </div>
                                        <div className="pb-4">
                                            <h4 className="font-bold text-primary text-sm"><HighlightText text={event.title} highlight={highlightQuery} /></h4>
                                            <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap"><HighlightText text={event.desc} highlight={highlightQuery} /></p>
                                            <p className="text-[11px] text-slate-400 mt-1.5 font-bold uppercase">{event.time}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar */}
                    <div className="space-y-4">
                        {lead.status !== 'closed_won' && canEdit && (
                            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-green-600 text-lg">workspace_premium</span>
                                    <h4 className="font-bold text-green-800 text-sm font-display">Mark as Successful</h4>
                                </div>
                                <p className="text-xs text-green-700/80 mb-5 leading-relaxed">
                                    Did this lead purchase a vehicle? Convert them to a Customer and register their sale.
                                </p>
                                
                                {isConverting ? (
                                    <form onSubmit={handleConvert} className="space-y-4 bg-white/60 p-4 rounded-xl border border-green-100/50">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Select Vehicle Sold</label>
                                            {(() => {
                                                const normalizedSearch = convertCarSearch.toLowerCase().replace(/\s/g, '');
                                                const filteredCars = availableCars.filter((car: any) => {
                                                    if (!normalizedSearch) return true;
                                                    const nameMatch = `${car.year} ${car.make} ${car.model}`.toLowerCase().includes(convertCarSearch.toLowerCase());
                                                    const regMatch = (car.registration_no || '').toLowerCase().replace(/\s/g, '').includes(normalizedSearch);
                                                    return nameMatch || regMatch;
                                                });
                                                const selectedCar = availableCars.find((c: any) => c.id === convertForm.inventory_id);
                                                
                                                return (
                                                    <div className="relative">
                                                        <div className="relative">
                                                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">search</span>
                                                            <input 
                                                                type="text" 
                                                                value={convertCarSearch}
                                                                onChange={e => { 
                                                                    setConvertCarSearch(e.target.value); 
                                                                    setConvertCarSearchOpen(true); 
                                                                    if (convertForm.inventory_id) {
                                                                        setConvertForm(f => ({ ...f, inventory_id: '' })); 
                                                                    }
                                                                }}
                                                                onFocus={() => setConvertCarSearchOpen(true)}
                                                                onBlur={() => setTimeout(() => setConvertCarSearchOpen(false), 200)}
                                                                placeholder="Search car by name, model, reg no..."
                                                                className="w-full h-10 border border-slate-200 rounded-lg pl-8 pr-8 text-xs bg-white outline-none focus:border-green-400 transition shadow-sm" 
                                                            />
                                                            {convertCarSearch && (
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => { 
                                                                        setConvertCarSearch(''); 
                                                                        setConvertForm(f => ({ ...f, inventory_id: '' })); 
                                                                        setConvertCarSearchOpen(false); 
                                                                    }} 
                                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                                >
                                                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                        
                                                        {selectedCar && (
                                                            <div className="mt-2 flex items-center gap-2.5 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                                                                <span className="material-symbols-outlined text-green-600 text-[16px]">directions_car</span>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs font-bold text-green-800 truncate">
                                                                        {selectedCar.year} {selectedCar.make} {selectedCar.model}
                                                                    </p>
                                                                    <p className="text-[10px] text-green-600 font-mono">
                                                                        {selectedCar.registration_no || 'No Reg'} · ₹{Number(selectedCar.price).toLocaleString('en-IN')}
                                                                        {selectedCar.source === 'consignment' ? ' (Consignment)' : selectedCar.source === 'dealer' ? ' (Dealer)' : ' (Owned)'}
                                                                    </p>
                                                                </div>
                                                                <span className="text-[9px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded uppercase tracking-wider shrink-0">Selected</span>
                                                            </div>
                                                        )}
                                                        
                                                        {convertCarSearchOpen && (
                                                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                                                                {filteredCars.length === 0 ? (
                                                                    <div className="flex flex-col items-center py-6 text-slate-400">
                                                                        <span className="material-symbols-outlined text-2xl mb-1">search_off</span>
                                                                        <p className="text-xs font-medium">No available cars found</p>
                                                                    </div>
                                                                ) : (
                                                                    filteredCars.map((car: any) => {
                                                                        const isSelected = car.id === convertForm.inventory_id;
                                                                        return (
                                                                            <button 
                                                                                key={car.id} 
                                                                                type="button"
                                                                                onMouseDown={(e) => {
                                                                                    e.preventDefault();
                                                                                    setConvertForm(f => ({ ...f, inventory_id: car.id, final_price: String(car.price || '') })); 
                                                                                    setConvertCarSearch(`${car.year} ${car.make} ${car.model}`); 
                                                                                    setConvertCarSearchOpen(false);
                                                                                }}
                                                                                onClick={() => { 
                                                                                    setConvertForm(f => ({ ...f, inventory_id: car.id, final_price: String(car.price || '') })); 
                                                                                    setConvertCarSearch(`${car.year} ${car.make} ${car.model}`); 
                                                                                    setConvertCarSearchOpen(false); 
                                                                                }}
                                                                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-slate-50 last:border-0 hover:bg-slate-50 ${isSelected ? 'bg-green-50/50' : ''}`}
                                                                            >

                                                                                <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                                                    <span className="material-symbols-outlined text-slate-500 text-[15px]">directions_car</span>
                                                                                </div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <p className="text-xs font-bold text-slate-700 truncate">
                                                                                        {car.year} {car.make} {car.model}
                                                                                    </p>
                                                                                    <p className="text-[10px] text-slate-400 font-mono">
                                                                                        {car.registration_no || 'No Reg'} · {car.source === 'consignment' ? '🤝 Consignment' : car.source === 'dealer' ? '🏪 Dealer' : '🏠 Owned'}
                                                                                    </p>
                                                                                </div>
                                                                                <div className="text-right shrink-0">
                                                                                    <p className="text-xs font-bold text-primary">₹{(car.price / 100000).toFixed(2)}L</p>
                                                                                    <p className="text-[9px] text-slate-400 font-mono">₹{Number(car.price).toLocaleString('en-IN')}</p>
                                                                                </div>
                                                                            </button>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Final Sale Price (₹)</label>
                                            <input required type="number" placeholder="Eg: 550000" value={convertForm.final_price} onChange={e => setConvertForm({ ...convertForm, final_price: e.target.value })} className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm text-primary outline-none focus:border-green-400 bg-white shadow-sm" />
                                        </div>
                                        {convertForm.inventory_id && (() => {
                                            const car = availableCars.find((c: any) => c.id === convertForm.inventory_id);
                                            if (!car) return null;
                                            const price = Number(convertForm.final_price) || 0;
                                            let earningLabel = '';
                                            if (car.source === 'consignment') {
                                                const fee = car.consignment_fee_type === 'fixed'
                                                    ? car.consignment_fee_value || 0
                                                    : car.consignment_fee_type === 'percentage'
                                                        ? Math.round(price * (car.consignment_fee_value || 0) / 100)
                                                        : 0;
                                                earningLabel = `🤝 Consignment — Swami earns ₹${fee.toLocaleString('en-IN')} fee`;
                                            } else {
                                                const profit = price - (car.purchase_cost || 0);
                                                earningLabel = `💰 Est. profit: ₹${profit.toLocaleString('en-IN')}`;
                                            }
                                            return earningLabel ? (
                                                <div className="text-[11px] font-semibold text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                                                    {earningLabel}
                                                </div>
                                            ) : null;
                                        })()}
                                        <div className="flex gap-2 pt-2">
                                            <button type="button" onClick={() => { setIsConverting(false); setConvertForm({ inventory_id: '', final_price: '' }); setConvertCarSearch(''); setConvertCarSearchOpen(false); }} className="flex-1 bg-slate-200 text-slate-600 font-bold text-xs h-9 rounded-lg hover:bg-slate-300 transition">Cancel</button>
                                            <button type="submit" disabled={!convertForm.inventory_id || !convertForm.final_price} className="flex-1 bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs h-9 rounded-lg hover:bg-green-700 transition shadow-sm">Confirm Sale</button>
                                        </div>
                                    </form>
                                ) : (
                                    <button onClick={() => { setIsConverting(true); setConvertForm({ inventory_id: '', final_price: '' }); setConvertCarSearch(''); setConvertCarSearchOpen(false); }} className="w-full flex items-center justify-center gap-2 h-11 bg-green-600 text-white font-bold rounded-xl text-sm hover:bg-green-700 transition shadow-sm">
                                        Convert to Sale
                                    </button>
                                )}
                            </div>
                        )}

                        {lead.status !== 'closed_won' && canEdit && (
                            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-blue-600 text-lg font-bold">handshake</span>
                                    <h4 className="font-bold text-blue-800 text-sm font-display">Process Finance & Insurance</h4>
                                </div>
                                <p className="text-xs text-blue-700/80 mb-5 leading-relaxed">
                                    Convert this lead to an active loan application or insurance policy file.
                                </p>
                                
                                {isConvertingService ? (
                                    <form onSubmit={handleConvertService} className="space-y-4 bg-white/60 p-4 rounded-xl border border-blue-100/50">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Service Type</label>
                                            <select 
                                                value={serviceForm.type} 
                                                onChange={e => setServiceForm(f => ({ ...f, type: e.target.value as 'loan' | 'insurance' }))}
                                                className="w-full h-9 border border-slate-200 rounded-lg px-2 text-xs bg-white outline-none focus:border-blue-400"
                                            >
                                                <option value="loan">Car Loan</option>
                                                <option value="insurance">Car Insurance</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Provider / Company Name</label>
                                            <input 
                                                required 
                                                type="text" 
                                                placeholder={serviceForm.type === 'loan' ? 'e.g. HDFC Bank' : 'e.g. TATA AIG'} 
                                                value={serviceForm.provider_name} 
                                                onChange={e => setServiceForm(f => ({ ...f, provider_name: e.target.value }))} 
                                                className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs bg-white outline-none focus:border-blue-400 shadow-sm" 
                                            />
                                        </div>

                                        {serviceForm.type === 'loan' ? (
                                            <>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Loan Amount (₹)</label>
                                                    <input 
                                                        required 
                                                        type="number" 
                                                        placeholder="Principal Amount" 
                                                        value={serviceForm.amount} 
                                                        onChange={e => setServiceForm(f => ({ ...f, amount: e.target.value }))} 
                                                        className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs bg-white outline-none focus:border-blue-400 shadow-sm" 
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Tenure (Months)</label>
                                                        <input 
                                                            type="number" 
                                                            placeholder="e.g. 60" 
                                                            value={serviceForm.tenure_months} 
                                                            onChange={e => setServiceForm(f => ({ ...f, tenure_months: e.target.value }))} 
                                                            className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs bg-white outline-none focus:border-blue-400 shadow-sm" 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Rate (%)</label>
                                                        <input 
                                                            type="number" 
                                                            step="0.01" 
                                                            placeholder="e.g. 9.5" 
                                                            value={serviceForm.interest_rate} 
                                                            onChange={e => setServiceForm(f => ({ ...f, interest_rate: e.target.value }))} 
                                                            className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs bg-white outline-none focus:border-blue-400 shadow-sm" 
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Premium Amount (₹)</label>
                                                    <input 
                                                        required 
                                                        type="number" 
                                                        placeholder="Premium" 
                                                        value={serviceForm.premium_amount} 
                                                        onChange={e => setServiceForm(f => ({ ...f, premium_amount: e.target.value }))} 
                                                        className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs bg-white outline-none focus:border-blue-400 shadow-sm" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Policy Number</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="Optional policy code" 
                                                        value={serviceForm.policy_number} 
                                                        onChange={e => setServiceForm(f => ({ ...f, policy_number: e.target.value }))} 
                                                        className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs bg-white outline-none focus:border-blue-400 shadow-sm" 
                                                    />
                                                </div>
                                            </>
                                        )}

                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Commission Earned (₹)</label>
                                            <input 
                                                type="number" 
                                                placeholder="Expected agency payout" 
                                                value={serviceForm.commission_earned} 
                                                onChange={e => setServiceForm(f => ({ ...f, commission_earned: e.target.value }))} 
                                                className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs bg-white outline-none focus:border-blue-400 shadow-sm" 
                                            />
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <button 
                                                type="button" 
                                                onClick={() => { 
                                                    setIsConvertingService(false); 
                                                    setServiceForm(prev => ({
                                                        ...prev,
                                                        provider_name: '',
                                                        amount: '',
                                                        premium_amount: '',
                                                        policy_number: '',
                                                        tenure_months: '',
                                                        interest_rate: '',
                                                        commission_earned: '',
                                                        notes: ''
                                                    })); 
                                                }} 
                                                className="flex-1 bg-slate-200 text-slate-600 font-bold text-xs h-9 rounded-lg hover:bg-slate-300 transition"
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                type="submit" 
                                                disabled={serviceSaving}
                                                className="flex-1 bg-blue-600 text-white font-bold text-xs h-9 rounded-lg hover:bg-blue-700 transition shadow-sm flex items-center justify-center gap-1"
                                            >
                                                {serviceSaving ? <span className="size-3 animate-spin border border-white/30 border-t-white rounded-full" /> : 'Confirm File'}
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <button onClick={() => setIsConvertingService(true)} className="w-full flex items-center justify-center gap-2 h-11 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 transition shadow-sm">
                                        Convert to Service File
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Suggestion */}
                        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[var(--shadow-card)]">
                            <div className="flex items-center gap-2 mb-3"><span className="material-symbols-outlined text-accent text-lg">lightbulb</span><h4 className="font-bold text-primary text-sm">Suggested Next Step</h4></div>
                            <p className="text-sm text-slate-500 mb-4 leading-relaxed">Reach out via WhatsApp to follow up proactively. Fast follow-ups have a 4x higher conversion rate.</p>
                            <a href={toWhatsAppUrl(lead.whatsapp_number || lead.phone)} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-2 h-10 bg-slate-50 hover:bg-primary hover:text-white border border-slate-200 hover:border-primary text-primary font-bold rounded-xl text-sm transition-all shadow-sm">
                                <span className="material-symbols-outlined text-base">forum</span> Send WhatsApp
                            </a>
                        </div>

                        {/* ── Interested Cars Panel ────────────────────────── */}
                        <div className="bg-white border border-slate-100 rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                                <div className="flex items-center gap-2">
                                    <div className="size-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-blue-500 text-[18px]">directions_car</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-primary text-sm leading-none">Interested Cars</h4>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{carInterests.length} car{carInterests.length !== 1 ? 's' : ''} tracked</p>
                                    </div>
                                </div>
                                {canEdit && (
                                    <button
                                        onClick={() => setIsAddingCarInterest(v => !v)}
                                        className={`flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-bold transition-all ${
                                            isAddingCarInterest
                                                ? 'bg-slate-200 text-slate-600'
                                                : 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-sm">{isAddingCarInterest ? 'close' : 'add'}</span>
                                        {isAddingCarInterest ? 'Cancel' : 'Add Car'}
                                    </button>
                                )}
                            </div>

                            {isAddingCarInterest && (
                                <form onSubmit={handleAddCarInterest} className="p-4 border-b border-slate-100 bg-blue-50/30 space-y-3">
                                    {/* ── Mode tabs ── */}
                                    <div className="flex gap-1.5 p-1 bg-slate-100 rounded-lg">
                                        {(['stock', 'wishlist'] as const).map(mode => (
                                            <button key={mode} type="button"
                                                onClick={() => { setCarSelectorMode(mode); setCarSearch(''); setCarInterestForm(f => ({ ...f, inventory_id: '' })); }}
                                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                                    carSelectorMode === mode ? mode === 'stock' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                                                }`}>
                                                <span className="material-symbols-outlined text-[13px]">{mode === 'stock' ? 'inventory' : 'search'}</span>
                                                {mode === 'stock' ? 'In Stock' : 'Not In Stock'}
                                            </button>
                                        ))}
                                    </div>

                                    {carSelectorMode === 'stock' ? (
                                        <>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Select Car</label>
                                                {(() => {
                                                    const inventorySource = (inventory && inventory.length > 0) ? inventory : (FALLBACK_INVENTORY as any);
                                                    const availableCars = inventorySource.filter((c: any) => c.status === 'available');
                                                    const normalizedSearch = carSearch.toLowerCase().replace(/\s/g, '');
                                                    const filteredCars = availableCars.filter((car: any) => {
                                                        if (!normalizedSearch) return true;
                                                        const nameMatch = `${car.year} ${car.make} ${car.model}`.toLowerCase().includes(carSearch.toLowerCase());
                                                        const regMatch = (car.registration_no || '').toLowerCase().replace(/\s/g, '').includes(normalizedSearch);
                                                        return nameMatch || regMatch;
                                                    });
                                                    const selectedCar = availableCars.find((c: any) => c.id === carInterestForm.inventory_id);
                                                    return (
                                                        <div className="relative">
                                                            <div className="relative">
                                                                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">search</span>
                                                                <input type="text" value={carSearch}
                                                                    onChange={e => { setCarSearch(e.target.value); setCarSearchOpen(true); if (carInterestForm.inventory_id) setCarInterestForm(f => ({ ...f, inventory_id: '' })); }}
                                                                    onFocus={() => setCarSearchOpen(true)}
                                                                    onBlur={() => setTimeout(() => setCarSearchOpen(false), 150)}
                                                                    placeholder="Search by car name or registration no..."
                                                                    className="w-full h-9 border border-slate-200 rounded-lg pl-8 pr-8 text-xs bg-white outline-none focus:border-blue-400 transition" />
                                                                {carSearch && (<button type="button" onClick={() => { setCarSearch(''); setCarInterestForm(f => ({ ...f, inventory_id: '' })); setCarSearchOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined text-[15px]">close</span></button>)}
                                                            </div>
                                                            {selectedCar && (
                                                                <div className="mt-1.5 flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                                                                    <span className="material-symbols-outlined text-blue-500 text-[14px]">directions_car</span>
                                                                    <div className="flex-1 min-w-0"><p className="text-xs font-bold text-blue-700 truncate">{selectedCar.year} {selectedCar.make} {selectedCar.model}</p><p className="text-[10px] text-blue-500 font-mono">{selectedCar.registration_no || 'No Reg'} · ₹{Number(selectedCar.price).toLocaleString('en-IN')}</p></div>
                                                                    <span className="text-[10px] font-bold text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded">Selected</span>
                                                                </div>
                                                            )}
                                                            {carSearchOpen && (
                                                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                                                                    {filteredCars.length === 0 ? (
                                                                        <div className="flex flex-col items-center py-6 text-slate-400"><span className="material-symbols-outlined text-2xl mb-1">search_off</span><p className="text-xs font-medium">No cars match your search</p></div>
                                                                    ) : filteredCars.map((car: any) => {
                                                                        const isSelected = car.id === carInterestForm.inventory_id;
                                                                        const isAlreadyAdded = carInterests.some(i => i.inventory_id === car.id);
                                                                        return (
                                                                            <button key={car.id} type="button" disabled={isAlreadyAdded}
                                                                                onMouseDown={(e) => {
                                                                                    e.preventDefault();
                                                                                    setCarInterestForm(f => ({ ...f, inventory_id: car.id }));
                                                                                    setCarSearch(`${car.year} ${car.make} ${car.model}`);
                                                                                    setCarSearchOpen(false);
                                                                                }}
                                                                                onClick={() => { setCarInterestForm(f => ({ ...f, inventory_id: car.id })); setCarSearch(`${car.year} ${car.make} ${car.model}`); setCarSearchOpen(false); }}
                                                                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-slate-50 last:border-0 ${isAlreadyAdded ? 'opacity-40 cursor-not-allowed bg-slate-50' : isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                                                                                <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-slate-500 text-[15px]">directions_car</span></div>
                                                                                <div className="flex-1 min-w-0"><p className="text-xs font-bold text-slate-700 truncate">{car.year} {car.make} {car.model}</p><p className="text-[10px] text-slate-400 font-mono">{car.registration_no || 'No Reg'}</p></div>
                                                                                <div className="text-right shrink-0"><p className="text-xs font-bold text-primary">₹{Number(car.price).toLocaleString('en-IN')}</p>{isAlreadyAdded && <p className="text-[9px] text-slate-400">Added</p>}{isSelected && !isAlreadyAdded && <span className="material-symbols-outlined text-blue-500 text-[14px]">check_circle</span>}</div>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Interest Level</label>
                                                <div className="flex gap-1.5">
                                                    {(['hot', 'warm', 'cold'] as const).map(level => (
                                                        <button key={level} type="button" onClick={() => setCarInterestForm(f => ({ ...f, interest_level: level }))}
                                                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all capitalize ${carInterestForm.interest_level === level ? level === 'hot' ? 'bg-red-500 text-white border-red-500' : level === 'warm' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-500 text-white border-slate-500' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>
                                                            {level === 'hot' ? '🔥' : level === 'warm' ? '⭐' : '❄️'} {level}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Notes <span className="font-normal normal-case text-slate-400">(optional)</span></label>
                                                <textarea value={carInterestForm.notes} onChange={e => setCarInterestForm(f => ({ ...f, notes: e.target.value }))} placeholder="Budget, preferences, specific requirements..." rows={2} className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-white outline-none focus:border-blue-400 transition resize-none" />
                                            </div>
                                            <button type="submit" disabled={carInterestSaving || !carInterestForm.inventory_id}
                                                className="w-full h-9 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                                                {carInterestSaving ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Saving...</> : <><span className="material-symbols-outlined text-sm">save</span> Save Interest</>}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {/* Wishlist form */}
                                            <div className="rounded-lg bg-purple-50 border border-purple-100 px-3 py-2 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-purple-500 text-[15px]">info</span>
                                                <p className="text-[11px] text-purple-700">Car not in your inventory? Fill in the details — we'll track what the customer wants.</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Make <span className="text-red-400">*</span></label><input type="text" value={wishlistForm.make} onChange={e => setWishlistForm(f => ({ ...f, make: e.target.value }))} placeholder="e.g. Maruti, Honda" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs bg-white outline-none focus:ring-2 focus:ring-purple-200" /></div>
                                                <div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Model <span className="text-red-400">*</span></label><input type="text" value={wishlistForm.model} onChange={e => setWishlistForm(f => ({ ...f, model: e.target.value }))} placeholder="e.g. Swift, City" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs bg-white outline-none focus:ring-2 focus:ring-purple-200" /></div>
                                                <div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Year</label><input type="number" value={wishlistForm.year} onChange={e => setWishlistForm(f => ({ ...f, year: e.target.value }))} placeholder="e.g. 2020" min="1990" max="2030" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs bg-white outline-none focus:ring-2 focus:ring-purple-200" /></div>
                                                <div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Color</label><input type="text" value={wishlistForm.color} onChange={e => setWishlistForm(f => ({ ...f, color: e.target.value }))} placeholder="e.g. White" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs bg-white outline-none focus:ring-2 focus:ring-purple-200" /></div>
                                            </div>
                                            <input type="text" value={wishlistForm.variant} onChange={e => setWishlistForm(f => ({ ...f, variant: e.target.value }))} placeholder="Variant (optional) — e.g. VXI, ZXI+" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs bg-white outline-none focus:ring-2 focus:ring-purple-200" />
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Interest Level</label>
                                                <div className="flex gap-1.5">
                                                    {(['hot', 'warm', 'cold'] as const).map(level => (
                                                        <button key={level} type="button" onClick={() => setWishlistForm(f => ({ ...f, interest_level: level }))}
                                                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all capitalize ${wishlistForm.interest_level === level ? level === 'hot' ? 'bg-red-500 text-white border-red-500' : level === 'warm' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-500 text-white border-slate-500' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>
                                                            {level === 'hot' ? '🔥' : level === 'warm' ? '⭐' : '❄️'} {level}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <textarea value={wishlistForm.notes} onChange={e => setWishlistForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional) — budget, condition, etc." rows={2} className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-white outline-none focus:border-purple-400 transition resize-none" />
                                            <button type="submit" disabled={carInterestSaving || !wishlistForm.make.trim() || !wishlistForm.model.trim()}
                                                className="w-full h-9 bg-purple-500 text-white text-xs font-bold rounded-lg hover:bg-purple-600 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                                                {carInterestSaving ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Saving...</> : <><span className="material-symbols-outlined text-sm">bookmark_add</span> Add to Wishlist</>}
                                            </button>
                                        </>
                                    )}
                                </form>
                            )}

                            {/* Interests List */}
                            <div className="divide-y divide-slate-50 max-h-[320px] overflow-y-auto">
                                {carInterestsLoading ? (
                                    <div className="py-6 text-center text-xs text-slate-400">Loading...</div>
                                ) : carInterests.length === 0 ? (
                                    <div className="py-7 text-center">
                                        <span className="material-symbols-outlined text-3xl text-slate-200 block mb-1">garage</span>
                                        <p className="text-xs text-slate-400">No car interests tracked yet.</p>
                                        <p className="text-[10px] text-slate-300 mt-0.5">Click "Add Car" to record interest.</p>
                                    </div>
                                ) : carInterests.map(interest => {
                                    const isPurchased = linkedSales.some(s => s.inventory_id === interest.inventory_id || s.car_id === interest.inventory_id);
                                    return (
                                        <div key={interest.id} className={`px-4 py-3 flex items-start gap-3 transition-colors ${isPurchased ? 'bg-emerald-50/70 border-l-4 border-emerald-500' : 'hover:bg-slate-50/60'}`}>
                                            <div className={`size-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center ${interest.is_wishlist ? 'bg-purple-100' : 'bg-slate-100'}`}>
                                                {!interest.is_wishlist && interest.car?.thumbnail ? (
                                                    <img src={interest.car.thumbnail} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className={`material-symbols-outlined text-xl ${interest.is_wishlist ? 'text-purple-400' : 'text-slate-300'}`}>{interest.is_wishlist ? 'search' : 'directions_car'}</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                                    <p className="text-xs font-bold text-primary truncate">
                                                        {interest.is_wishlist
                                                            ? `${interest.custom_year ? interest.custom_year + ' ' : ''}${interest.custom_make} ${interest.custom_model}${interest.custom_variant ? ' ' + interest.custom_variant : ''}`
                                                            : `${interest.car?.year} ${interest.car?.make} ${interest.car?.model}`
                                                        }
                                                    </p>
                                                    {isPurchased ? (
                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-emerald-600 text-white border border-emerald-700 flex items-center gap-0.5 shadow-xs">
                                                            <span className="material-symbols-outlined text-[11px]">verified</span> 🎉 PURCHASED
                                                        </span>
                                                    ) : (
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                                            interest.interest_level === 'hot' ? 'bg-red-100 text-red-600' :
                                                            interest.interest_level === 'warm' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-slate-100 text-slate-500'
                                                        }`}>
                                                            {interest.interest_level === 'hot' ? '🔥' : interest.interest_level === 'warm' ? '⭐' : '❄️'} {interest.interest_level}
                                                        </span>
                                                    )}
                                                    {interest.is_wishlist && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600">🔍 Sourcing</span>}
                                                </div>
                                                {interest.is_wishlist ? (
                                                    <p className="text-[11px] text-purple-600 font-medium">{[interest.custom_color, 'Not in stock'].filter(Boolean).join(' · ')}</p>
                                                ) : (
                                                    <p className="text-[11px] font-semibold text-green-700">₹{interest.car?.price?.toLocaleString('en-IN')}</p>
                                                )}
                                                {interest.notes && (<p className="text-[10px] text-slate-500 mt-0.5 truncate">{interest.notes}</p>)}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {interest.is_wishlist && (
                                                    <Link
                                                        to={`/admin/inventory?makes=${encodeURIComponent(interest.custom_make || '')}&models=${encodeURIComponent(interest.custom_model || '')}`}
                                                        className="size-7 flex items-center justify-center rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700 transition-colors"
                                                        title="Find matches in current inventory"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">search</span>
                                                    </Link>
                                                )}
                                                {canEdit && (
                                                    <button onClick={() => handleRemoveCarInterest(interest.id)} title="Remove"
                                                        className="size-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-red-100 hover:text-red-500 text-slate-400 transition-colors">
                                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Follow-Up Panel ───────────────────────────────── */}
                        <div className="bg-white border border-slate-100 rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                                <div className="flex items-center gap-2">
                                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary text-[18px]">phone_callback</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-primary text-sm leading-none">Follow-Up Log</h4>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{followUps.length} contact attempt{followUps.length !== 1 ? 's' : ''}</p>
                                    </div>
                                </div>
                                {canEdit && (
                                    <button
                                        onClick={() => setIsLoggingFollowUp(v => !v)}
                                        className={`flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-bold transition-all ${
                                            isLoggingFollowUp
                                                ? 'bg-slate-200 text-slate-600'
                                                : 'bg-primary text-white hover:bg-primary-light shadow-sm'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-sm">{isLoggingFollowUp ? 'close' : 'add'}</span>
                                        {isLoggingFollowUp ? 'Cancel' : 'Log New'}
                                    </button>
                                )}
                            </div>

                            {/* Log New Form */}
                            {isLoggingFollowUp && (
                                <form onSubmit={handleLogFollowUp} className="p-4 border-b border-slate-100 bg-blue-50/30 space-y-3">
                                    {/* Via */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Contact Method</label>
                                        <div className="flex gap-1.5 flex-wrap">
                                            {(['call','whatsapp','email','visit','meeting'] as const).map(v => {
                                                const isSelected = followUpForm.contacted_via.includes(v);
                                                return (
                                                    <button
                                                        key={v}
                                                        type="button"
                                                        onClick={() => setFollowUpForm(f => ({
                                                            ...f,
                                                            contacted_via: isSelected
                                                                ? f.contacted_via.filter(m => m !== v)
                                                                : [...f.contacted_via, v]
                                                        }))}
                                                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                                                            isSelected
                                                                ? 'bg-primary text-white border-primary shadow-sm'
                                                                : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40'
                                                        }`}
                                                    >
                                                        <span className="material-symbols-outlined text-[13px]">{viaIcon(v)}</span>
                                                        {v.charAt(0).toUpperCase() + v.slice(1)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Outcome */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Outcome</label>
                                        <select
                                            value={followUpForm.outcome}
                                            onChange={e => setFollowUpForm(f => ({ ...f, outcome: e.target.value as any }))}
                                            className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs bg-white outline-none focus:border-primary/50 transition"
                                        >
                                            <option value="answered">✅ Answered</option>
                                            <option value="no_answer">📵 No Answer</option>
                                            <option value="callback_requested">🔄 Callback Requested</option>
                                            <option value="interested">🌟 Interested</option>
                                            <option value="not_interested">❌ Not Interested</option>
                                            <option value="converted">🏆 Converted</option>
                                        </select>
                                    </div>

                                    {/* Notes */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Notes <span className="font-normal normal-case text-slate-400">(optional)</span></label>
                                        <textarea
                                            value={followUpForm.notes}
                                            onChange={e => setFollowUpForm(f => ({ ...f, notes: e.target.value }))}
                                            placeholder="What was discussed..."
                                            rows={2}
                                            className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-white outline-none focus:border-primary/50 transition resize-none"
                                        />
                                    </div>

                                    {/* Next Follow-Up */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Next Follow-Up <span className="font-normal normal-case text-slate-400">(optional)</span></label>
                                        <input
                                            type="datetime-local"
                                            value={followUpForm.next_followup_date}
                                            onChange={e => setFollowUpForm(f => ({ ...f, next_followup_date: e.target.value }))}
                                            className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs bg-white outline-none focus:border-primary/50 transition"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={followUpSaving}
                                        className="w-full h-9 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-light transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                                    >
                                        {followUpSaving ? (
                                            <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Saving...</>
                                        ) : (
                                            <><span className="material-symbols-outlined text-sm">save</span> Save Follow-Up</>
                                        )}
                                    </button>
                                </form>
                            )}

                            {/* History List */}
                            <div className="divide-y divide-slate-50 max-h-[360px] overflow-y-auto">
                                {followUpsLoading ? (
                                    <div className="py-6 text-center text-xs text-slate-400">Loading...</div>
                                ) : followUps.length === 0 ? (
                                    <div className="py-8 text-center">
                                        <span className="material-symbols-outlined text-3xl text-slate-200 block mb-1">phone_missed</span>
                                        <p className="text-xs text-slate-400">No follow-ups logged yet.</p>
                                        <p className="text-[10px] text-slate-300 mt-0.5">Click "Log New" to record first contact.</p>
                                    </div>
                                ) : followUps.map(fu => (
                                    <div key={fu.id} className={`px-4 py-3 flex items-start gap-3 hover:bg-slate-50/60 transition-colors ${fu.is_done ? 'opacity-60' : ''}`}>
                                        <div className={`size-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                            fu.outcome === 'no_answer' ? 'bg-slate-100' :
                                            fu.outcome === 'converted' ? 'bg-emerald-100' :
                                            fu.outcome === 'interested' ? 'bg-green-100' :
                                            fu.outcome === 'not_interested' ? 'bg-red-50' :
                                            'bg-blue-50'
                                        }`}>
                                            {fu.contacted_via && fu.contacted_via.length > 0 ? (
                                                <div className="flex -space-x-1">
                                                    {fu.contacted_via.slice(0, 2).map((method: string, i: number) => (
                                                        <span key={i} className={`material-symbols-outlined text-[14px] bg-white rounded-full ${
                                                            fu.outcome === 'no_answer' ? 'text-slate-400' :
                                                            fu.outcome === 'converted' ? 'text-emerald-600' :
                                                            fu.outcome === 'interested' ? 'text-green-600' :
                                                            fu.outcome === 'not_interested' ? 'text-red-400' :
                                                            'text-blue-500'
                                                        }`}>{viaIcon(method)}</span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="material-symbols-outlined text-[16px] text-slate-400">phone</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <div className="flex gap-1">
                                                    {(fu.contacted_via || []).map((method: string, i: number) => (
                                                        <span key={i} className="text-xs font-bold text-primary capitalize">{method}{i < (fu.contacted_via?.length || 1) - 1 ? ',' : ''}</span>
                                                    ))}
                                                </div>
                                                {fu.outcome && (
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${outcomeColor(fu.outcome)}`}>
                                                        {outcomeLabel(fu.outcome)}
                                                    </span>
                                                )}
                                                {fu.is_done && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">Done</span>}
                                            </div>
                                            {fu.notes && <p className="text-[11px] text-slate-500 truncate">{fu.notes}</p>}
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-slate-400">
                                                    {new Date(fu.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {fu.next_followup_date && (
                                                    <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-0.5">
                                                        <span className="material-symbols-outlined text-[11px]">event</span>
                                                        Next: {new Date(fu.next_followup_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {!fu.is_done && (
                                            <button
                                                onClick={() => markFollowUpDone(fu.id)}
                                                title="Mark Done"
                                                className="size-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-green-100 hover:text-green-600 text-slate-400 transition-colors shrink-0"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">check</span>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Next follow-up summary bar */}
                            {followUps.some(fu => fu.next_followup_date && !fu.is_done) && (() => {
                                const next = followUps
                                    .filter(fu => fu.next_followup_date && !fu.is_done)
                                    .sort((a, b) => new Date(a.next_followup_date!).getTime() - new Date(b.next_followup_date!).getTime())[0];
                                const isOverdue = new Date(next.next_followup_date!) < new Date();
                                return (
                                    <div className={`px-4 py-2.5 flex items-center gap-2 border-t ${
                                        isOverdue ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
                                    }`}>
                                        <span className={`material-symbols-outlined text-[15px] ${
                                            isOverdue ? 'text-red-500' : 'text-amber-500'
                                        }`}>alarm</span>
                                        <p className={`text-[11px] font-semibold ${
                                            isOverdue ? 'text-red-600' : 'text-amber-700'
                                        }`}>
                                            {isOverdue ? 'Overdue: ' : 'Next follow-up: '}
                                            {new Date(next.next_followup_date!).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* ── Visits Log Panel ────────────────────────── */}
                        <div className="bg-white border border-slate-100 rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                                <div className="flex items-center gap-2">
                                    <div className="size-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-emerald-600 text-[18px]">directions_walk</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-primary text-sm leading-none">Customer Visits</h4>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{visits.length} visit{visits.length !== 1 ? 's' : ''} logged</p>
                                    </div>
                                </div>
                                {canEdit && (
                                    <button
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
                                )}
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
                                                    name="visit_outcome"
                                                    checked={visitForm.outcome === 'successful'}
                                                    onChange={() => setVisitForm({ ...visitForm, outcome: 'successful' })}
                                                    className="accent-emerald-600"
                                                />
                                                Successful (Requires Approval)
                                            </label>
                                            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="visit_outcome"
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
                            <div className="divide-y divide-slate-50 max-h-[360px] overflow-y-auto">
                                {visitsLoading ? (
                                    <div className="py-6 text-center text-xs text-slate-400">Loading...</div>
                                ) : visits.length === 0 ? (
                                    <div className="py-8 text-center">
                                        <span className="material-symbols-outlined text-3xl text-slate-200 block mb-1">directions_walk</span>
                                        <p className="text-xs text-slate-400">No visits logged yet.</p>
                                        <p className="text-[10px] text-slate-300 mt-0.5">Click "Log Visit" to record customer face-to-face interaction.</p>
                                    </div>
                                ) : visits.map(v => (
                                    <div key={v.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50/60 transition-colors">
                                        <div className={`size-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                            v.outcome === 'unsuccessful' ? 'bg-slate-100 text-slate-400' :
                                            v.status === 'approved' ? 'bg-green-100 text-green-600' :
                                            v.status === 'rejected' ? 'bg-red-100 text-red-600' :
                                            'bg-amber-100 text-amber-600'
                                        }`}>
                                            <span className="material-symbols-outlined text-[16px]">
                                                {v.outcome === 'unsuccessful' ? 'close' :
                                                 v.status === 'approved' ? 'check_circle' :
                                                 v.status === 'rejected' ? 'cancel' : 'pending'}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                                <span className="text-xs font-bold text-primary">{v.purpose}</span>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
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
                                            {v.notes && <p className="text-[11px] text-slate-500 mt-1">{v.notes}</p>}
                                            {v.admin_remarks && (
                                                <p className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded px-2 py-1 mt-1">
                                                    <span className="font-semibold text-primary">Admin: </span>{v.admin_remarks}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-slate-400">
                                                    By {v.staff?.full_name || 'Staff'} • {new Date(v.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Add Task Module (kept for reminders) */}
                        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[var(--shadow-card)]">
                            <div className="flex items-center gap-2 mb-3"><span className="material-symbols-outlined text-amber-500 text-lg">task</span><h4 className="font-bold text-primary text-sm">Schedule Reminder Task</h4></div>
                            
                            {isAddingTask ? (
                                <form onSubmit={handleAddTask} className="space-y-3">
                                    <input required type="text" placeholder="Task Title" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs outline-none focus:border-amber-400 bg-white" />
                                    <input required type="datetime-local" value={taskForm.due_date} onChange={e => setTaskForm({...taskForm, due_date: e.target.value})} className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs outline-none focus:border-amber-400 bg-white" />
                                    <select value={taskForm.priority} onChange={e => setTaskForm({...taskForm, priority: e.target.value})} className="w-full h-9 border border-slate-200 rounded-lg px-3 text-xs outline-none focus:border-amber-400 bg-white">
                                        <option value="Hot">High Priority</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Cold">Low</option>
                                    </select>
                                    <textarea placeholder="Description (Optional)" value={taskForm.description} onChange={e => setTaskForm({...taskForm, description: e.target.value})} rows={2} className="w-full border border-slate-200 rounded-lg p-3 text-xs outline-none focus:border-amber-400 bg-white"></textarea>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => setIsAddingTask(false)} className="flex-1 bg-slate-100 text-slate-500 h-8 rounded-lg text-xs font-bold hover:bg-slate-200 transition">Cancel</button>
                                        <button type="submit" className="flex-1 bg-amber-500 text-white h-8 rounded-lg text-xs font-bold hover:bg-amber-600 transition shadow-sm">Save Task</button>
                                    </div>
                                </form>
                            ) : canEdit ? (
                                <>
                                    <p className="text-sm text-slate-500 mb-4 leading-relaxed">Set a calendar reminder separate from follow-up calls.</p>
                                    <button onClick={() => setIsAddingTask(true)} className="w-full flex items-center justify-center gap-2 h-10 bg-amber-50 hover:bg-amber-500 hover:text-white border border-amber-200 hover:border-amber-500 text-amber-600 font-bold rounded-xl text-sm transition-all shadow-sm">
                                        <span className="material-symbols-outlined text-base">add_task</span> Add Reminder Task
                                    </button>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeadDetail;
