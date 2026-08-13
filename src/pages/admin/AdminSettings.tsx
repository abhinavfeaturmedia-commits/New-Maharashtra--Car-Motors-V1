import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { validateOpenRouterKey } from '../../lib/openrouter';

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_HOURS: Record<string, { start: string; end: string; status: string }> = {
    Monday:    { start: '09:30', end: '19:30', status: 'Open' },
    Tuesday:   { start: '09:30', end: '19:30', status: 'Open' },
    Wednesday: { start: '09:30', end: '19:30', status: 'Open' },
    Thursday:  { start: '09:30', end: '19:30', status: 'Open' },
    Friday:    { start: '09:30', end: '19:30', status: 'Open' },
    Saturday:  { start: '09:30', end: '14:00', status: 'Half Day' },
    Sunday:    { start: '',      end: '',       status: 'Closed' },
};

const DEFAULT_BUSINESS = { name: '', address: '', phone: '', email: '', gst_number: '', city: '' };

const DEFAULT_NOTIFICATIONS = {
    newLead:     true,
    booking:     true,
    followUp:    true,
    stockAlert:  true,
    dailyReport: true,
};

const DEFAULT_OPERATIONS = {
    stockLowThreshold: 3,
    leadAutoAssign:    false,
    requireInspection: true,
    allowSelfAssign:   false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Upsert a single setting key to Supabase (v2 schema: setting_key / setting_value) */
const upsertSetting = (key: string, value: any) =>
    supabase
        .from('dealership_settings')
        .upsert({ setting_key: key, setting_value: value }, { onConflict: 'setting_key' });

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionCard: React.FC<{ icon: string; title: string; subtitle: string; children: React.ReactNode }> = ({
    icon, title, subtitle, children,
}) => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-[18px]">{icon}</span>
            </div>
            <div>
                <h2 className="font-bold text-primary font-display text-sm">{title}</h2>
                <p className="text-[11px] text-slate-400">{subtitle}</p>
            </div>
        </div>
        <div className="p-6">{children}</div>
    </div>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">{children}</label>
);

const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input
        {...props}
        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:border-primary/40 focus:bg-white transition-colors"
    />
);

const Toggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
    <button
        type="button"
        onClick={onChange}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-primary' : 'bg-slate-300'}`}
    >
        <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
);

const SkeletonLine: React.FC<{ w?: string }> = ({ w = 'w-full' }) => (
    <div className={`h-10 ${w} bg-slate-100 animate-pulse rounded-xl`} />
);

// ─── Main Component ───────────────────────────────────────────────────────────

const AdminSettings: React.FC = () => {
    const { settings, loading: globalLoading, refreshData } = useData();
    const location = useLocation();

    // Local state — all empty/default until DB resolves
    const [businessProfile, setBusinessProfile]   = useState({ ...DEFAULT_BUSINESS });
    const [workingHours,    setWorkingHours]       = useState<Record<string, { start: string; end: string; status: string }>>({});
    const [notifications,   setNotifications]      = useState({ ...DEFAULT_NOTIFICATIONS });
    const [operations,      setOperations]         = useState({ ...DEFAULT_OPERATIONS });

    // ── OpenRouter integration state ──────────────────────────────────────────
    const [openRouterEnabled,     setOpenRouterEnabled]     = useState(false);
    const [openRouterApiKey,      setOpenRouterApiKey]      = useState('');
    const [openRouterModel,       setOpenRouterModel]       = useState('google/gemini-2.5-flash');
    const [openRouterCustomModel, setOpenRouterCustomModel] = useState('');
    const [openRouterFeatures,    setOpenRouterFeatures]    = useState<Record<string, boolean>>({
        lead_response_suggestions: true,
        car_description_generator: true,
        sentiment_analysis: true,
    });
    const [showApiKey,            setShowApiKey]            = useState(false);
    
    // Key validation states
    const [isValidatingKey,       setIsValidatingKey]       = useState(false);
    const [validationResult,      setValidationResult]      = useState<{
        success: boolean;
        label?: string;
        limit?: number;
        limit_remaining?: number;
        is_free_tier?: boolean;
        error?: string;
    } | null>(null);

    const [saving, setSaving] = useState(false);
    const [saved,  setSaved]  = useState(false);
    const [error,  setError]  = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false); // prevents flash of defaults

    // Scroll to OpenRouter section if hash exists
    useEffect(() => {
        if (loaded && location.hash === '#openrouter') {
            const el = document.getElementById('openrouter-section');
            if (el) {
                setTimeout(() => {
                    el.scrollIntoView({ behavior: 'smooth' });
                    el.classList.add('ring-4', 'ring-primary/20', 'border-primary');
                    setTimeout(() => {
                        el.classList.remove('ring-4', 'ring-primary/20', 'border-primary');
                    }, 3000);
                }, 100);
            }
        }
    }, [location.hash, loaded]);

    // ── Deal of the Week state ────────────────────────────────────────────────
    const [dealInventory, setDealInventory] = useState<{ id: string; make: string; model: string; year: number }[]>([]);
    const [dealCarId,     setDealCarId]     = useState('');
    const [dealEndsAt,    setDealEndsAt]    = useState('');
    const [dealSaving,    setDealSaving]    = useState(false);
    const [dealSaved,     setDealSaved]     = useState(false);
    const [dealError,     setDealError]     = useState<string | null>(null);

    // ── Sync from DB once settings are fetched ────────────────────────────────
    useEffect(() => {
        if (globalLoading) return; // wait for DataContext to finish
        setLoaded(true);

        if (settings.business_profile) {
            setBusinessProfile({ ...DEFAULT_BUSINESS, ...settings.business_profile });
        }
        if (settings.working_hours && Object.keys(settings.working_hours).length > 0) {
            setWorkingHours(settings.working_hours);
        } else {
            setWorkingHours({ ...DEFAULT_HOURS });
        }
        if (settings.notifications) {
            setNotifications({ ...DEFAULT_NOTIFICATIONS, ...settings.notifications });
        }
        if (settings.operations) {
            setOperations({ ...DEFAULT_OPERATIONS, ...settings.operations });
        }
        if (settings.openrouter_settings) {
            const or = settings.openrouter_settings;
            setOpenRouterEnabled(!!or.is_enabled);
            setOpenRouterApiKey(or.api_key || '');
            setOpenRouterModel(or.default_model || 'google/gemini-2.5-flash');
            setOpenRouterCustomModel(or.custom_model || '');
            if (or.features) {
                setOpenRouterFeatures({
                    lead_response_suggestions: !!or.features.lead_response_suggestions,
                    car_description_generator: !!or.features.car_description_generator,
                    sentiment_analysis: !!or.features.sentiment_analysis,
                });
            }
        }
    }, [globalLoading, settings]);

    // ── Deal of the Week: load inventory + current config on mount ────────────
    useEffect(() => {
        supabase
            .from('inventory')
            .select('id, make, model, year')
            .eq('status', 'available')
            .order('created_at', { ascending: false })
            .limit(50)
            .then(({ data }) => { if (data) setDealInventory(data); });

        supabase
            .from('dealership_settings')
            .select('setting_value')
            .eq('setting_key', 'deal_of_the_week')
            .maybeSingle()
            .then(({ data }) => {
                if (data?.setting_value) {
                    setDealCarId(data.setting_value.car_id || '');
                    const raw = data.setting_value.ends_at || '';
                    if (raw) {
                        const d = new Date(raw);
                        const pad = (n: number) => String(n).padStart(2, '0');
                        setDealEndsAt(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                    }
                }
            });
    }, []);

    const handleSaveDeal = async () => {
        if (!dealCarId) { setDealError('Please select a car.'); return; }
        setDealSaving(true); setDealError(null);
        const { error: err } = await supabase
            .from('dealership_settings')
            .upsert(
                { setting_key: 'deal_of_the_week', setting_value: { car_id: dealCarId, ends_at: dealEndsAt ? new Date(dealEndsAt).toISOString() : null } },
                { onConflict: 'setting_key' }
            );
        setDealSaving(false);
        if (err) { setDealError(err.message); }
        else { setDealSaved(true); setTimeout(() => setDealSaved(false), 3000); }
    };

    const handleTestConnection = async () => {
        if (!openRouterApiKey) {
            setValidationResult({ success: false, error: 'Please enter an API key to test.' });
            return;
        }
        setIsValidatingKey(true);
        setValidationResult(null);
        try {
            const result = await validateOpenRouterKey(openRouterApiKey);
            setValidationResult(result);
        } catch (err: any) {
            setValidationResult({ success: false, error: err.message || 'Validation failed.' });
        } finally {
            setIsValidatingKey(false);
        }
    };

    // ── Save all sections to Supabase ─────────────────────────────────────────

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const results = await Promise.all([
                upsertSetting('business_profile', businessProfile),
                upsertSetting('working_hours',    workingHours),
                upsertSetting('notifications',    notifications),
                upsertSetting('operations',       operations),
                upsertSetting('openrouter_settings', {
                    is_enabled: openRouterEnabled,
                    api_key: openRouterApiKey,
                    default_model: openRouterModel,
                    custom_model: openRouterCustomModel,
                    features: openRouterFeatures,
                }),
            ]);

            const firstError = results.find(r => r.error);
            if (firstError?.error) throw new Error(firstError.error.message);

            await refreshData();
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to save settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const patchProfile    = (k: string, v: string)  => setBusinessProfile(p => ({ ...p, [k]: v }));
    const patchHour       = (day: string, k: string, v: string) =>
        setWorkingHours(p => ({ ...p, [day]: { ...DEFAULT_HOURS[day], ...p[day], [k]: v } }));
    const patchNotif      = (k: string) => setNotifications(p => ({ ...p, [k]: !p[k as keyof typeof p] }));
    const patchOps        = (k: string, v: any) => setOperations(p => ({ ...p, [k]: v }));

    const isLoading = globalLoading || !loaded;

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Settings</h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        Global configuration synced across the entire system.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {saved && (
                        <div className="flex items-center gap-1.5 text-green-600 text-sm font-semibold">
                            <span className="material-symbols-outlined text-base">check_circle</span>
                            Saved to database
                        </div>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving || isLoading}
                        className="h-10 px-6 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
                    >
                        <span className={`material-symbols-outlined text-base ${saving ? 'animate-spin' : ''}`}>
                            {saved ? 'check' : saving ? 'sync' : 'cloud_upload'}
                        </span>
                        {saved ? 'Synced!' : saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
                    <span className="material-symbols-outlined text-red-500 shrink-0">error</span>
                    <p className="text-sm text-red-700 font-medium">{error}</p>
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
                        <span className="material-symbols-outlined text-base">close</span>
                    </button>
                </div>
            )}

            {/* ── 1. Business Profile ─────────────────────────────────────── */}
            <SectionCard icon="store" title="Business Profile" subtitle="Dealership identity shown on invoices, reports, and the customer portal">
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[...Array(6)].map((_, i) => <SkeletonLine key={i} />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <FieldLabel>Business Name *</FieldLabel>
                            <TextInput
                                value={businessProfile.name}
                                onChange={e => patchProfile('name', e.target.value)}
                                placeholder="e.g. New Maharashtra Motors"
                            />
                        </div>
                        <div>
                            <FieldLabel>City</FieldLabel>
                            <TextInput
                                value={businessProfile.city}
                                onChange={e => patchProfile('city', e.target.value)}
                                placeholder="e.g. Pune"
                            />
                        </div>
                        <div>
                            <FieldLabel>Contact Phone</FieldLabel>
                            <TextInput
                                value={businessProfile.phone}
                                onChange={e => patchProfile('phone', e.target.value)}
                                placeholder="e.g. +91 98232 37975"
                                type="tel"
                            />
                        </div>
                        <div>
                            <FieldLabel>Contact Email</FieldLabel>
                            <TextInput
                                value={businessProfile.email}
                                onChange={e => patchProfile('email', e.target.value)}
                                placeholder="e.g. contact@sssmotors.com"
                                type="email"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <FieldLabel>Full Address</FieldLabel>
                            <TextInput
                                value={businessProfile.address}
                                onChange={e => patchProfile('address', e.target.value)}
                                placeholder="e.g. Sr.no 515/1, near Shankar mandir, Kasarwadi, Pimpri-Chinchwad, Maharashtra 411034"
                            />
                        </div>
                        <div>
                            <FieldLabel>GST Number</FieldLabel>
                            <TextInput
                                value={businessProfile.gst_number}
                                onChange={e => patchProfile('gst_number', e.target.value.toUpperCase())}
                                placeholder="e.g. 27AABCU9603R1ZX"
                                maxLength={15}
                            />
                        </div>
                    </div>
                )}
            </SectionCard>

            {/* ── 2. Working Hours ────────────────────────────────────────── */}
            <SectionCard icon="schedule" title="Operating Hours" subtitle="Shown on the customer portal and used for booking availability checks">
                {isLoading ? (
                    <div className="space-y-3">{[...Array(7)].map((_, i) => <SkeletonLine key={i} />)}</div>
                ) : (
                    <div className="space-y-3 overflow-x-auto pb-1">
                        {WEEKDAYS.map(day => {
                            const d = workingHours[day] || { ...DEFAULT_HOURS[day] };
                            const isClosed  = d.status === 'Closed';
                            return (
                                <div key={day} className="flex items-center gap-3 min-w-[520px]">
                                    <span className="text-sm font-semibold text-slate-700 w-24 shrink-0">{day}</span>

                                    <select
                                        value={d.status}
                                        onChange={e => patchHour(day, 'status', e.target.value)}
                                        className={`h-9 shrink-0 border border-transparent rounded-lg px-2 text-xs font-bold outline-none cursor-pointer w-28 ${
                                            d.status === 'Half Day' ? 'bg-amber-100 text-amber-700' :
                                            d.status === 'Closed'   ? 'bg-red-100 text-red-700' :
                                                                       'bg-green-100 text-green-700'
                                        }`}
                                    >
                                        <option value="Open">Open</option>
                                        <option value="Half Day">Half Day</option>
                                        <option value="Closed">Closed</option>
                                    </select>

                                    {!isClosed ? (
                                        <>
                                            <input
                                                type="time"
                                                value={d.start}
                                                onChange={e => patchHour(day, 'start', e.target.value)}
                                                className="h-9 w-[110px] shrink-0 bg-slate-50 border border-slate-200 rounded-lg px-2 text-sm text-primary outline-none focus:border-primary/40 transition-colors"
                                            />
                                            <span className="text-xs text-slate-400 shrink-0">to</span>
                                            <input
                                                type="time"
                                                value={d.end}
                                                onChange={e => patchHour(day, 'end', e.target.value)}
                                                className="h-9 w-[110px] shrink-0 bg-slate-50 border border-slate-200 rounded-lg px-2 text-sm text-primary outline-none focus:border-primary/40 transition-colors"
                                            />
                                        </>
                                    ) : (
                                        <span className="text-xs text-slate-400 italic ml-2">Dealership closed</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </SectionCard>

            {/* ── 3. Notification Preferences ─────────────────────────────── */}
            <SectionCard icon="notifications" title="Notification Preferences" subtitle="Control which system-wide alert types are active for admin staff">
                {isLoading ? (
                    <div className="space-y-4">{[...Array(5)].map((_, i) => <SkeletonLine key={i} />)}</div>
                ) : (
                    <div className="space-y-4">
                        {([
                            { key: 'newLead',     label: 'New Lead Alerts',       desc: 'Notify when a new customer enquiry arrives' },
                            { key: 'booking',     label: 'Booking Notifications', desc: 'Alerts for new test drives and service bookings' },
                            { key: 'followUp',    label: 'Follow-Up Reminders',   desc: 'Reminders for scheduled follow-ups and tasks' },
                            { key: 'stockAlert',  label: 'Low Stock Alerts',      desc: 'Notify when inventory drops below threshold' },
                            { key: 'dailyReport', label: 'Daily Briefing',        desc: 'Morning summary of tasks and follow-ups for the day' },
                        ] as { key: keyof typeof notifications; label: string; desc: string }[]).map(n => (
                            <div key={n.key} className="flex items-center justify-between py-1">
                                <div>
                                    <p className="text-sm font-semibold text-primary">{n.label}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{n.desc}</p>
                                </div>
                                <Toggle
                                    checked={notifications[n.key]}
                                    onChange={() => patchNotif(n.key)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            {/* ── 4. Operational Rules ────────────────────────────────────── */}
            <SectionCard icon="tune" title="Operational Rules" subtitle="Business logic that affects workflows across CRM, inventory, and bookings">
                {isLoading ? (
                    <div className="space-y-4">{[...Array(4)].map((_, i) => <SkeletonLine key={i} />)}</div>
                ) : (
                    <div className="space-y-5">
                        {/* Stock low threshold */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-primary">Low Stock Threshold</p>
                                <p className="text-xs text-slate-400 mt-0.5">Trigger stock alert when a model has ≤ N units available</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => patchOps('stockLowThreshold', Math.max(1, operations.stockLowThreshold - 1))}
                                    className="size-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold transition-colors"
                                >−</button>
                                <span className="w-10 text-center font-black text-primary text-lg font-display">
                                    {operations.stockLowThreshold}
                                </span>
                                <button
                                    onClick={() => patchOps('stockLowThreshold', Math.min(20, operations.stockLowThreshold + 1))}
                                    className="size-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold transition-colors"
                                >+</button>
                            </div>
                        </div>

                        <hr className="border-slate-100" />

                        {([
                            { key: 'requireInspection', label: 'Require Inspection Before Listing',  desc: 'Block inventory listings until an inspection is filed for that vehicle' },
                            { key: 'leadAutoAssign',    label: 'Auto-Assign Leads to Staff',         desc: 'Automatically assign new leads in round-robin to available staff members' },
                            { key: 'allowSelfAssign',   label: 'Allow Staff to Self-Assign Leads',   desc: 'Staff members can claim unassigned leads from the CRM queue' },
                        ] as { key: keyof typeof operations; label: string; desc: string }[]).map((r, i, arr) => (
                            <React.Fragment key={r.key}>
                                <div className="flex items-center justify-between py-1">
                                    <div>
                                        <p className="text-sm font-semibold text-primary">{r.label}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{r.desc}</p>
                                    </div>
                                    <Toggle
                                        checked={!!operations[r.key]}
                                        onChange={() => patchOps(r.key, !operations[r.key])}
                                    />
                                </div>
                                {i < arr.length - 1 && <hr className="border-slate-100" />}
                            </React.Fragment>
                        ))}
                    </div>
                )}
            </SectionCard>

            {/* ── 5. Deal of the Week ──────────────────────────────────── */}
            <SectionCard icon="local_offer" title="Deal of the Week" subtitle="Select a car to spotlight on the homepage with a special offer countdown timer">
                <div className="space-y-5">
                    <div>
                        <FieldLabel>Featured Car</FieldLabel>
                        <select
                            value={dealCarId}
                            onChange={e => setDealCarId(e.target.value)}
                            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:border-primary/40 focus:bg-white transition-colors appearance-none cursor-pointer"
                        >
                            <option value="">— Select a car from inventory —</option>
                            {dealInventory.map(c => (
                                <option key={c.id} value={c.id}>{c.year} {c.make} {c.model}</option>
                            ))}
                        </select>
                        <p className="text-[11px] text-slate-400 mt-1.5">Only available cars are listed. This car will be featured on the public homepage.</p>
                    </div>

                    <div>
                        <FieldLabel>Deal Expires At</FieldLabel>
                        <TextInput
                            type="datetime-local"
                            value={dealEndsAt}
                            onChange={e => setDealEndsAt(e.target.value)}
                        />
                        <p className="text-[11px] text-slate-400 mt-1.5">A live countdown timer will display on the homepage. Leave blank to hide the timer.</p>
                    </div>

                    {dealError && (
                        <p className="text-xs text-red-600 font-semibold flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">error</span> {dealError}
                        </p>
                    )}

                    <button
                        onClick={handleSaveDeal}
                        disabled={dealSaving}
                        className="h-10 px-6 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
                    >
                        <span className={`material-symbols-outlined text-base ${dealSaving ? 'animate-spin' : ''}`}>
                            {dealSaved ? 'check' : dealSaving ? 'sync' : 'local_offer'}
                        </span>
                        {dealSaved ? 'Deal Saved!' : dealSaving ? 'Saving…' : 'Save Deal of the Week'}
                    </button>
                </div>
            </SectionCard>

            {/* ── 6. OpenRouter AI Integration ────────────────────────────── */}
            <div id="openrouter-section" className="transition-all duration-300 rounded-2xl">
                <SectionCard icon="smart_toy" title="OpenRouter AI Integration" subtitle="Configure AI features like smart follow-up suggestions and automated vehicle descriptions">
                    {isLoading ? (
                        <div className="space-y-4">{[...Array(4)].map((_, i) => <SkeletonLine key={i} />)}</div>
                    ) : (
                        <div className="space-y-5">
                            {/* Enable/Disable Toggle */}
                            <div className="flex items-center justify-between py-1">
                                <div>
                                    <p className="text-sm font-semibold text-primary">Enable AI Features</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Activate OpenRouter-powered features across inventory and lead management</p>
                                </div>
                                <Toggle
                                    checked={openRouterEnabled}
                                    onChange={() => setOpenRouterEnabled(!openRouterEnabled)}
                                />
                            </div>

                            {openRouterEnabled && (
                                <>
                                    <hr className="border-slate-100" />
                                    
                                    {/* API Key */}
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <FieldLabel>OpenRouter API Key</FieldLabel>
                                            <a 
                                                href="https://openrouter.ai/keys" 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                className="text-[10px] text-primary hover:underline font-bold"
                                            >
                                                Get API Key ↗
                                            </a>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type={showApiKey ? 'text' : 'password'}
                                                    value={openRouterApiKey}
                                                    onChange={e => setOpenRouterApiKey(e.target.value)}
                                                    placeholder="sk-or-v1-..."
                                                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-10 text-sm text-primary outline-none focus:border-primary/40 focus:bg-white transition-colors"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowApiKey(!showApiKey)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 flex items-center justify-center"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">
                                                        {showApiKey ? 'visibility_off' : 'visibility'}
                                                    </span>
                                                </button>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleTestConnection}
                                                disabled={isValidatingKey || !openRouterApiKey}
                                                className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                                            >
                                                {isValidatingKey && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                                                {isValidatingKey ? 'Testing...' : 'Test Connection'}
                                            </button>
                                        </div>
                                        
                                        {/* Connection Validation Result */}
                                        {validationResult && (
                                            <div className={`mt-3 p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                                                validationResult.success 
                                                    ? 'bg-green-50 border-green-200 text-green-800' 
                                                    : 'bg-red-50 border-red-200 text-red-800'
                                            }`}>
                                                <span className="material-symbols-outlined text-base shrink-0 mt-0.5">
                                                    {validationResult.success ? 'check_circle' : 'error'}
                                                </span>
                                                <div>
                                                    <p className="font-bold">{validationResult.success ? 'Connected successfully!' : 'Connection failed'}</p>
                                                    {validationResult.success ? (
                                                        <div className="mt-1 space-y-0.5 opacity-90">
                                                            <p><strong>Key Label:</strong> {validationResult.label}</p>
                                                            <p><strong>Limit:</strong> {validationResult.limit !== null && validationResult.limit !== undefined ? `$${validationResult.limit}` : 'No limit'}</p>
                                                            <p><strong>Remaining:</strong> {validationResult.limit_remaining !== null && validationResult.limit_remaining !== undefined ? `$${validationResult.limit_remaining}` : 'Unlimited'}</p>
                                                            <p><strong>Free Tier:</strong> {validationResult.is_free_tier ? 'Yes' : 'No'}</p>
                                                        </div>
                                                    ) : (
                                                        <p className="mt-0.5">{validationResult.error}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Default Model */}
                                    <div>
                                        <FieldLabel>Default AI Model</FieldLabel>
                                        <select
                                            value={openRouterModel}
                                            onChange={e => setOpenRouterModel(e.target.value)}
                                            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:border-primary/40 focus:bg-white transition-colors appearance-none cursor-pointer"
                                        >
                                            <option value="google/gemini-2.5-flash">Gemini 2.5 Flash (Recommended - fast & precise)</option>
                                            <option value="google/gemini-2.5-pro">Gemini 2.5 Pro (Highly intelligent & analytical)</option>
                                            <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B Instruct (Free - powerful)</option>
                                            <option value="meta-llama/llama-3-8b-instruct:free">Llama 3 8B Instruct (Free - fast & basic)</option>
                                            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (Advanced reasoning & coding)</option>
                                            <option value="deepseek/deepseek-chat">DeepSeek V3 (Efficient & responsive)</option>
                                            <option value="custom">— Use Custom Model ID —</option>
                                        </select>
                                    </div>

                                    {/* Custom Model Input */}
                                    {openRouterModel === 'custom' && (
                                        <div className="animate-fadeIn">
                                            <FieldLabel>Custom OpenRouter Model ID</FieldLabel>
                                            <input
                                                type="text"
                                                value={openRouterCustomModel}
                                                onChange={e => setOpenRouterCustomModel(e.target.value)}
                                                placeholder="e.g. mistralai/mistral-7b-instruct:free"
                                                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:border-primary/40 focus:bg-white transition-colors"
                                            />
                                            <p className="text-[10px] text-slate-400 mt-1">Provide any valid model identifier from the OpenRouter model catalog.</p>
                                        </div>
                                    )}

                                    <hr className="border-slate-100" />

                                    {/* Specific Enabled Features */}
                                    <div>
                                        <FieldLabel>Enabled AI Features</FieldLabel>
                                        <div className="space-y-3.5 mt-2">
                                            {[
                                                { 
                                                    key: 'lead_response_suggestions', 
                                                    label: 'Smart Lead Responses', 
                                                    desc: 'Enable automated drafting of context-aware WhatsApp/email responses on Lead Details' 
                                                },
                                                { 
                                                    key: 'car_description_generator', 
                                                    label: 'Automated Vehicle Descriptions', 
                                                    desc: 'Enable AI copy generation based on vehicle specs inside the Inventory Listing Form' 
                                                },
                                                { 
                                                    key: 'sentiment_analysis', 
                                                    label: 'Lead Sentiment & Quality Scoring', 
                                                    desc: 'Analyze customer inquiry text to gauge sentiment and score lead quality automatically' 
                                                },
                                            ].map(feature => (
                                                <label key={feature.key} className="flex items-start gap-3 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!openRouterFeatures[feature.key]}
                                                        onChange={() => setOpenRouterFeatures(prev => ({
                                                            ...prev,
                                                            [feature.key]: !prev[feature.key]
                                                        }))}
                                                        className="mt-1 rounded border-slate-300 text-primary focus:ring-primary size-4 shrink-0"
                                                    />
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-700 group-hover:text-primary transition-colors">{feature.label}</p>
                                                        <p className="text-xs text-slate-400 mt-0.5 leading-normal">{feature.desc}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* ── 7. System Info ──────────────────────────────────────────── */}
            <SectionCard icon="info" title="System Information" subtitle="Read-only metadata about this deployment">

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                        { label: 'Application',   value: 'New Maharashtra Motors Admin Panel' },
                        { label: 'Version',        value: 'v2.4.0' },
                        { label: 'Database',       value: 'Supabase (PostgreSQL)' },
                        { label: 'Last Sync',      value: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) },
                    ].map(item => (
                        <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{item.label}</p>
                            <p className="text-sm font-semibold text-primary">{item.value}</p>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* ── Sticky Save Bar ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between pt-2 pb-4">
                {error ? (
                    <p className="text-sm text-red-600 font-medium flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-base">error</span>
                        {error}
                    </p>
                ) : saved ? (
                    <p className="text-sm text-green-600 font-semibold flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        All settings saved to database successfully.
                    </p>
                ) : (
                    <p className="text-xs text-slate-400">Changes are written directly to Supabase and apply globally.</p>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving || isLoading}
                    className="h-10 px-8 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm ml-4 shrink-0"
                >
                    <span className={`material-symbols-outlined text-base ${saving ? 'animate-spin' : ''}`}>
                        {saved ? 'check' : saving ? 'sync' : 'cloud_upload'}
                    </span>
                    {saved ? 'Synced!' : saving ? 'Saving…' : 'Save All Changes'}
                </button>
            </div>
        </div>
    );
};

export default AdminSettings;
