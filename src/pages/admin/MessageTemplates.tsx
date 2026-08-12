import React, { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Search, Edit2, Trash2, Copy, MessageSquare, Mail, Phone } from 'lucide-react';

// ─── Types & Config ───────────────────────────────────────────────────────────

type TemplateCategory = 'whatsapp' | 'sms' | 'email';

const CATEGORIES: { key: TemplateCategory; label: string; icon: string; color: string; bgColor: string }[] = [
    { key: 'whatsapp', label: 'WhatsApp', icon: 'chat',  color: 'text-green-600',  bgColor: 'bg-green-50 border-green-200' },
    { key: 'sms',      label: 'SMS',      icon: 'sms',   color: 'text-blue-600',   bgColor: 'bg-blue-50 border-blue-200' },
    { key: 'email',    label: 'Email',    icon: 'mail',  color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200' },
];

const VARIABLES = ['{customer_name}', '{car_model}', '{car_year}', '{car_make}', '{price}', '{followup_date}', '{dealership_name}', '{staff_name}', '{phone}'];

const EXAMPLE_TEMPLATES = [
    { name: 'Lead Welcome', category: 'whatsapp' as TemplateCategory, body: 'Hi {customer_name}! 👋 Thank you for your enquiry about the {car_year} {car_make} {car_model}. We\'d love to schedule a test drive. Our team will call you shortly. — {dealership_name}', variables: ['{customer_name}', '{car_year}', '{car_make}', '{car_model}', '{dealership_name}'] },
    { name: 'Follow-up Reminder', category: 'whatsapp' as TemplateCategory, body: 'Hi {customer_name}, this is a friendly reminder from {dealership_name}. We have a great deal on the {car_model} you were interested in! 🚗 Want to come in for a look? Call us anytime!', variables: ['{customer_name}', '{dealership_name}', '{car_model}'] },
    { name: 'Price Drop Alert', category: 'sms' as TemplateCategory, body: 'GREAT NEWS {customer_name}! The {car_year} {car_make} {car_model} you liked is now priced at {price}. Limited time offer! Call {phone} to book. -{dealership_name}', variables: ['{customer_name}', '{car_year}', '{car_make}', '{car_model}', '{price}', '{phone}', '{dealership_name}'] },
    { name: 'Test Drive Confirmation', category: 'email' as TemplateCategory, subject: 'Your Test Drive is Confirmed!', body: 'Dear {customer_name},\n\nYour test drive for the {car_year} {car_make} {car_model} is confirmed for {followup_date}.\n\nPlease bring a valid driving license. We look forward to seeing you!\n\nBest regards,\n{staff_name}\n{dealership_name}', variables: ['{customer_name}', '{car_year}', '{car_make}', '{car_model}', '{followup_date}', '{staff_name}', '{dealership_name}'] },
];

const emptyForm = { name: '', category: 'whatsapp' as TemplateCategory, subject: '', body: '', variables: [] as string[] };

// ─── Component ────────────────────────────────────────────────────────────────

const MessageTemplates = () => {
    const { messageTemplates, refreshData } = useData();
    const { user } = useAuth();

    const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'all'>('all');
    const [search, setSearch] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);
    const [isSeeding, setIsSeeding] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // ─── Filter ───────────────────────────────────────────────────────────────

    const filtered = useMemo(() => {
        let list = messageTemplates;
        if (activeCategory !== 'all') list = list.filter(t => t.category === activeCategory);
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(t =>
                t.name?.toLowerCase().includes(q) ||
                t.body?.toLowerCase().includes(q) ||
                t.subject?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [messageTemplates, activeCategory, search]);

    // ─── Variable Detection ───────────────────────────────────────────────────

    const detectVariables = (body: string) => {
        const found = VARIABLES.filter(v => body.includes(v));
        return found;
    };

    const handleBodyChange = (body: string) => {
        setForm(f => ({ ...f, body, variables: detectVariables(body) }));
    };

    // ─── CRUD ─────────────────────────────────────────────────────────────────

    const openAdd = () => {
        setEditId(null);
        setForm(emptyForm);
        setIsFormOpen(true);
    };

    const openEdit = (t: any) => {
        setEditId(t.id);
        setForm({ name: t.name, category: t.category, subject: t.subject || '', body: t.body, variables: t.variables || [] });
        setIsFormOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.body.trim()) return;
        setIsSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                category: form.category,
                subject: form.category === 'email' ? form.subject.trim() : null,
                body: form.body.trim(),
                variables: detectVariables(form.body),
                created_by: user?.id ?? null,
            };
            if (editId) {
                const { error } = await supabase.from('message_templates').update(payload).eq('id', editId);
                if (error) throw error;
                showToast('Template updated!');
            } else {
                const { error } = await supabase.from('message_templates').insert(payload);
                if (error) throw error;
                showToast('Template created!');
            }
            setIsFormOpen(false);
            setEditId(null);
            setForm(emptyForm);
            refreshData();
        } catch (err: any) {
            showToast(err.message || 'Failed to save template', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this template? This cannot be undone.')) return;
        setIsDeletingId(id);
        try {
            const { error } = await supabase.from('message_templates').delete().eq('id', id);
            if (error) throw error;
            showToast('Template deleted');
            refreshData();
        } catch (err: any) {
            showToast(err.message || 'Failed to delete', 'error');
        } finally {
            setIsDeletingId(null);
        }
    };

    const handleCopy = (t: any) => {
        navigator.clipboard.writeText(t.body);
        setCopiedId(t.id);
        setTimeout(() => setCopiedId(null), 2000);
        showToast('Copied to clipboard!');
    };

    const handleToggleActive = async (t: any) => {
        await supabase.from('message_templates').update({ is_active: !t.is_active }).eq('id', t.id);
        refreshData();
    };

    // ─── Seed Example Templates ───────────────────────────────────────────────

    const seedExamples = async () => {
        if (!confirm('Add example templates to your library?')) return;
        setIsSeeding(true);
        try {
            const payload = EXAMPLE_TEMPLATES.map(t => ({
                ...t,
                is_active: true,
                created_by: user?.id ?? null,
            }));
            const { error } = await supabase.from('message_templates').insert(payload);
            if (error) throw error;
            showToast(`${payload.length} example templates added!`);
            refreshData();
        } catch (err: any) {
            showToast(err.message || 'Failed to seed examples', 'error');
        } finally {
            setIsSeeding(false);
        }
    };

    const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.key === cat) ?? CATEGORIES[0];

    return (
        <div className="space-y-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-5 right-5 z-[999] px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2 transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    <span className="material-symbols-outlined text-base">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Message Templates</h1>
                    <p className="text-slate-500 text-sm">Manage WhatsApp, SMS & Email communication templates.</p>
                </div>
                <div className="flex gap-2">
                    {messageTemplates.length === 0 && (
                        <button onClick={seedExamples} disabled={isSeeding} className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm flex items-center gap-2 transition-colors">
                            <span className="material-symbols-outlined text-lg">add_circle</span>
                            {isSeeding ? 'Adding…' : 'Add Examples'}
                        </button>
                    )}
                    <button onClick={openAdd} className="h-10 px-5 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-md shadow-primary/20">
                        <Plus size={16} /> New Template
                    </button>
                </div>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
                <button onClick={() => setActiveCategory('all')} className={`h-9 px-4 rounded-xl font-bold text-sm transition-colors border ${activeCategory === 'all' ? 'bg-primary text-white border-primary' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    All ({messageTemplates.length})
                </button>
                {CATEGORIES.map(cat => {
                    const count = messageTemplates.filter(t => t.category === cat.key).length;
                    return (
                        <button key={cat.key} onClick={() => setActiveCategory(cat.key)} className={`h-9 px-4 rounded-xl font-bold text-sm transition-colors border flex items-center gap-1.5 ${activeCategory === cat.key ? cat.bgColor + ' ' + cat.color + ' border-current' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                            <span className="material-symbols-outlined text-base">{cat.icon}</span>
                            {cat.label} ({count})
                        </button>
                    );
                })}
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10 max-w-sm">
                <Search size={16} className="text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…" className="bg-transparent text-sm text-primary outline-none w-full" />
                {search && <button onClick={() => setSearch('')} className="material-symbols-outlined text-slate-300 text-base hover:text-slate-500">close</button>}
            </div>

            {/* Empty State */}
            {filtered.length === 0 && !isFormOpen && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-16 flex flex-col items-center text-center">
                    <div className="size-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-5">
                        <span className="material-symbols-outlined text-4xl">chat_bubble</span>
                    </div>
                    <h2 className="text-xl font-black text-primary font-display mb-2">No Templates Yet</h2>
                    <p className="text-slate-500 text-sm max-w-sm mb-6">Create reusable message templates for WhatsApp, SMS and Email to speed up customer communication.</p>
                    <div className="flex gap-3">
                        <button onClick={seedExamples} className="h-10 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm">Add Example Templates</button>
                        <button onClick={openAdd} className="h-10 px-5 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors">
                            <Plus size={14} /> Create First Template
                        </button>
                    </div>
                </div>
            )}

            {/* Templates Grid */}
            {filtered.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(t => {
                        const catInfo = getCategoryInfo(t.category);
                        return (
                            <div key={t.id} className={`bg-white rounded-2xl border shadow-[var(--shadow-card)] overflow-hidden flex flex-col transition-all ${t.is_active ? 'border-slate-100' : 'border-slate-200 opacity-60'}`}>
                                {/* Card Header */}
                                <div className={`px-4 py-3 flex items-center justify-between border-b ${catInfo.bgColor}`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`material-symbols-outlined text-base ${catInfo.color}`}>{catInfo.icon}</span>
                                        <span className={`text-xs font-bold uppercase tracking-wide ${catInfo.color}`}>{catInfo.label}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleToggleActive(t)} title={t.is_active ? 'Deactivate' : 'Activate'} className={`size-6 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                                            <span className="material-symbols-outlined text-sm">{t.is_active ? 'visibility' : 'visibility_off'}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div className="p-4 flex-1 space-y-2">
                                    <p className="font-bold text-sm text-primary">{t.name}</p>
                                    {t.subject && <p className="text-xs text-slate-500 italic">Subject: {t.subject}</p>}
                                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-4 whitespace-pre-line">{t.body}</p>

                                    {/* Variables */}
                                    {t.variables && t.variables.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-1">
                                            {t.variables.map((v: string) => (
                                                <span key={v} className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded">{v}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Card Actions */}
                                <div className="px-4 pb-4 flex items-center gap-2 border-t border-slate-50 pt-3">
                                    <button onClick={() => setPreviewTemplate(t)} className="flex-1 h-8 text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors">Preview</button>
                                    <button onClick={() => handleCopy(t)} className={`size-8 flex items-center justify-center rounded-lg transition-colors ${copiedId === t.id ? 'bg-green-100 text-green-600' : 'bg-slate-50 hover:bg-slate-100 text-slate-500'}`}>
                                        <Copy size={14} />
                                    </button>
                                    <button onClick={() => openEdit(t)} className="size-8 flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors">
                                        <Edit2 size={14} />
                                    </button>
                                    <button onClick={() => handleDelete(t.id)} disabled={isDeletingId === t.id} className="size-8 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ─── Create / Edit Modal ─── */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                            <h2 className="text-lg font-black text-primary">{editId ? 'Edit Template' : 'New Template'}</h2>
                            <button onClick={() => { setIsFormOpen(false); setEditId(null); setForm(emptyForm); }} className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                                <span className="material-symbols-outlined text-slate-500 text-lg">close</span>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSave} className="overflow-y-auto p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Template Name *</label>
                                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Welcome Message" className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors" />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Channel *</label>
                                <div className="flex gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button type="button" key={cat.key} onClick={() => setForm(f => ({ ...f, category: cat.key }))} className={`flex-1 h-10 rounded-xl text-sm font-bold border transition-colors flex items-center justify-center gap-1.5 ${form.category === cat.key ? cat.bgColor + ' ' + cat.color + ' border-current' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                            <span className="material-symbols-outlined text-base">{cat.icon}</span>
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {form.category === 'email' && (
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Email Subject</label>
                                    <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Your enquiry at Maharashtra Motors" className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors" />
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Message Body *</label>
                                <textarea value={form.body} onChange={e => handleBodyChange(e.target.value)} required rows={6} placeholder="Write your message here. Use variables like {customer_name}, {car_model}…" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors resize-none" />
                            </div>

                            {/* Variable Palette */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Insert Variables</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {VARIABLES.map(v => (
                                        <button type="button" key={v} onClick={() => handleBodyChange(form.body + v)} className="text-xs font-mono px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg transition-colors">
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Detected variables */}
                            {form.variables.length > 0 && (
                                <div className="p-3 bg-blue-50 rounded-xl">
                                    <p className="text-xs font-bold text-blue-700 mb-1.5">Detected variables in body:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {form.variables.map(v => (
                                            <span key={v} className="text-[10px] font-mono px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">{v}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </form>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                            <button type="button" onClick={() => { setIsFormOpen(false); setEditId(null); setForm(emptyForm); }} className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors">
                                Cancel
                            </button>
                            <button type="submit" form="tmplForm" onClick={handleSave} disabled={isSaving || !form.name.trim() || !form.body.trim()} className="flex-1 h-10 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
                                {isSaving ? 'Saving…' : (editId ? 'Update Template' : 'Create Template')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Preview Modal ─── */}
            {previewTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setPreviewTemplate(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className={`px-6 py-4 flex items-center justify-between border-b ${getCategoryInfo(previewTemplate.category).bgColor}`}>
                            <div className="flex items-center gap-2">
                                <span className={`material-symbols-outlined text-base ${getCategoryInfo(previewTemplate.category).color}`}>{getCategoryInfo(previewTemplate.category).icon}</span>
                                <p className={`font-bold text-sm ${getCategoryInfo(previewTemplate.category).color}`}>{previewTemplate.name}</p>
                            </div>
                            <button onClick={() => setPreviewTemplate(null)} className="size-7 rounded-full bg-black/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-3">
                            {previewTemplate.subject && (
                                <div className="bg-slate-50 rounded-xl px-4 py-2">
                                    <p className="text-xs text-slate-400 uppercase font-bold mb-0.5">Subject</p>
                                    <p className="text-sm font-semibold text-primary">{previewTemplate.subject}</p>
                                </div>
                            )}
                            <div className="bg-slate-50 rounded-xl px-4 py-3">
                                <p className="text-xs text-slate-400 uppercase font-bold mb-1.5">Message Body</p>
                                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{previewTemplate.body}</p>
                            </div>
                            {previewTemplate.variables?.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    <span className="text-xs text-slate-400 font-medium mr-1 mt-0.5">Variables:</span>
                                    {previewTemplate.variables.map((v: string) => (
                                        <span key={v} className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded">{v}</span>
                                    ))}
                                </div>
                            )}
                            <button onClick={() => handleCopy(previewTemplate)} className={`w-full h-10 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors ${copiedId === previewTemplate.id ? 'bg-green-100 text-green-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                                <Copy size={14} /> {copiedId === previewTemplate.id ? 'Copied!' : 'Copy to Clipboard'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MessageTemplates;
