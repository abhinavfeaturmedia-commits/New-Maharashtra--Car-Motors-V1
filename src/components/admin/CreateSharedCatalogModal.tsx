import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Loader2, Link as LinkIcon, Search, User, Phone, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CreateSharedCatalogModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCarIds: string[];
    onSuccess: () => void;
}

interface ContactSearchResult {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    type: 'lead' | 'customer';
}

const CreateSharedCatalogModal: React.FC<CreateSharedCatalogModalProps> = ({
    isOpen,
    onClose,
    selectedCarIds,
    onSuccess
}) => {
    const { user } = useAuth();
    
    // Search states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ContactSearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    
    // Selected contact states
    const [selectedContact, setSelectedContact] = useState<ContactSearchResult | null>(null);
    const [isOutsider, setIsOutsider] = useState(false);
    
    // Outsider inputs
    const [outsiderName, setOutsiderName] = useState('');
    const [outsiderPhone, setOutsiderPhone] = useState('');
    
    // General form states
    const [customMessage, setCustomMessage] = useState('');
    const [expiryDays, setExpiryDays] = useState<string>('7');
    const [loading, setLoading] = useState(false);
    const [generatedLink, setGeneratedLink] = useState('');
    const [generatedPhone, setGeneratedPhone] = useState('');
    const [copied, setCopied] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close search dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!isOpen) return null;

    const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchQuery(val);
        
        if (!val || val.trim().length < 2) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }

        setSearchLoading(true);
        setShowDropdown(true);
        try {
            const queryText = val.trim();
            
            // 1. Search leads
            const { data: leadsData } = await supabase
                .from('leads')
                .select('id, full_name, phone, email')
                .or(`full_name.ilike.%${queryText}%,phone.ilike.%${queryText}%`)
                .limit(5);

            // 2. Search customers
            const { data: custData } = await supabase
                .from('customers')
                .select('id, full_name, phone, email')
                .or(`full_name.ilike.%${queryText}%,phone.ilike.%${queryText}%`)
                .limit(5);

            const mergedResults: ContactSearchResult[] = [
                ...(leadsData || []).map(l => ({ ...l, type: 'lead' as const })),
                ...(custData || []).map(c => ({ ...c, type: 'customer' as const }))
            ];
            
            setSearchResults(mergedResults);
        } catch (err) {
            console.error('Failed to search contacts:', err);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleSelectContact = (contact: ContactSearchResult) => {
        setSelectedContact(contact);
        setIsOutsider(false);
        setSearchQuery('');
        setSearchResults([]);
        setShowDropdown(false);
    };

    const handleSelectOutsider = () => {
        setSelectedContact(null);
        setIsOutsider(true);
        setOutsiderName(searchQuery);
        setSearchQuery('');
        setSearchResults([]);
        setShowDropdown(false);
    };

    const handleClearSelection = () => {
        setSelectedContact(null);
        setIsOutsider(false);
        setOutsiderName('');
        setOutsiderPhone('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedCarIds.length === 0) return;
        if (!selectedContact && !isOutsider) {
            setErrorMsg('Please select a contact or add a new outsider.');
            return;
        }
        if (isOutsider && (!outsiderName.trim() || !outsiderPhone.trim())) {
            setErrorMsg('Outsider name and phone number are required.');
            return;
        }
        if (isOutsider) {
            const cleaned = outsiderPhone.replace(/\D/g, '');
            const indianMobileRegex = /^[6-9]\d{9}$/;
            if (!indianMobileRegex.test(cleaned)) {
                setErrorMsg('Please enter a valid 10-digit Indian mobile number (e.g. 9823237975).');
                return;
            }
        }

        setLoading(true);
        setErrorMsg('');

        try {
            let finalLeadId: string | null = null;
            let finalCustomerId: string | null = null;
            let finalPhone = '';
            let finalName = '';

            if (selectedContact) {
                finalName = selectedContact.full_name;
                finalPhone = selectedContact.phone || '';
                if (selectedContact.type === 'lead') {
                    finalLeadId = selectedContact.id;
                } else {
                    finalCustomerId = selectedContact.id;
                }
            } else {
                // It's an outsider. Create a new lead automatically in the database
                finalName = outsiderName.trim();
                finalPhone = outsiderPhone.trim();
                
                const { data: newLead, error: leadErr } = await supabase
                    .from('leads')
                    .insert({
                        type: 'general',
                        full_name: finalName,
                        phone: finalPhone,
                        source: 'shared_catalog',
                        message: `Lead automatically registered during custom catalog generation.\nPersonal message: ${customMessage || 'None'}`,
                        status: 'new'
                    })
                    .select()
                    .single();

                if (leadErr) throw leadErr;
                finalLeadId = newLead.id;
            }

            let expiresAt: string | null = null;
            if (expiryDays !== 'never') {
                const days = parseInt(expiryDays);
                const date = new Date();
                date.setDate(date.getDate() + days);
                expiresAt = date.toISOString();
            }

            // 1. Insert into shared_catalogs
            const { data: catalog, error: catError } = await supabase
                .from('shared_catalogs')
                .insert({
                    customer_name: finalName,
                    custom_message: customMessage || null,
                    created_by: user?.id || null,
                    lead_id: finalLeadId,
                    customer_id: finalCustomerId,
                    customer_phone: finalPhone || null,
                    expires_at: expiresAt
                })
                .select()
                .single();

            if (catError) throw catError;

            // 2. Insert items into shared_catalog_items
            const linkItems = selectedCarIds.map(carId => ({
                catalog_id: catalog.id,
                inventory_id: carId
            }));

            const { error: itemsError } = await supabase
                .from('shared_catalog_items')
                .insert(linkItems);

            if (itemsError) throw itemsError;

            // 3. Generate Link
            // Use VITE_PUBLIC_URL only when it matches the current host context.
            // On local/LAN (http://192.168.x.x or localhost), always use window.location.origin
            // so the link is immediately testable without needing Netlify deployment.
            const envPublicUrl = import.meta.env.VITE_PUBLIC_URL?.replace(/\/$/, '');
            const isLocal = window.location.hostname === 'localhost'
                || /^192\.168\./.test(window.location.hostname)
                || /^10\./.test(window.location.hostname)
                || /^172\.(1[6-9]|2\d|3[01])\./.test(window.location.hostname);
            const origin = (envPublicUrl && !isLocal) ? envPublicUrl : window.location.origin;
            const link = `${origin}/shared-catalog/${catalog.id}`;
            
            setGeneratedLink(link);
            setGeneratedPhone(finalPhone);
            onSuccess();
        } catch (error: any) {
            console.error('Error generating shared catalog:', error);
            setErrorMsg(error.message || 'Failed to generate custom catalog. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Universal clipboard copy — works on HTTP (LAN IP) and HTTPS
    // navigator.clipboard requires secure context (HTTPS/localhost); falls back to execCommand
    const handleCopy = async () => {
        let success = false;

        // Method 1: Modern Clipboard API (HTTPS / localhost only)
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(generatedLink);
                success = true;
            } catch {
                // fall through to method 2
            }
        }

        // Method 2: Legacy execCommand fallback (works on HTTP, LAN IP, older browsers)
        if (!success) {
            try {
                const el = document.createElement('textarea');
                el.value = generatedLink;
                el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
                document.body.appendChild(el);
                el.focus();
                el.select();
                success = document.execCommand('copy');
                document.body.removeChild(el);
            } catch {
                success = false;
            }
        }

        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } else {
            // Last resort: select all text in the input so user can Ctrl+C manually
            const inp = document.querySelector<HTMLInputElement>('#catalog-link-input');
            inp?.select();
            alert('Auto-copy failed (HTTP context). The link is selected — press Ctrl+C to copy it.');
        }
    };

    const handleClose = () => {
        setSearchQuery('');
        setSearchResults([]);
        setSelectedContact(null);
        setIsOutsider(false);
        setOutsiderName('');
        setOutsiderPhone('');
        setCustomMessage('');
        setExpiryDays('7');
        setGeneratedLink('');
        setGeneratedPhone('');
        setCopied(false);
        setErrorMsg('');
        onClose();
    };

    const activeCustomerName = selectedContact ? selectedContact.full_name : outsiderName;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-slate-100 shadow-2xl">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary/5 text-primary p-2 rounded-xl">
                            <span className="material-symbols-outlined text-xl">share</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-base">Share Custom Catalog</h3>
                            <p className="text-xs text-slate-500">{selectedCarIds.length} cars selected</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {generatedLink ? (
                        <div className="text-center space-y-6">
                            <div className="bg-emerald-50 text-emerald-500 p-4 rounded-full inline-block">
                                <Check size={36} />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-slate-800">Catalog Link Generated!</h4>
                                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                                    Copy and share this personalized page link with <strong>{activeCustomerName}</strong> via WhatsApp, SMS, or Email.
                                </p>
                            </div>

                            {/* Link Box */}
                            <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                <LinkIcon size={16} className="text-slate-400 shrink-0 ml-1" />
                                <input
                                    id="catalog-link-input"
                                    type="text"
                                    readOnly
                                    value={generatedLink}
                                    onFocus={e => e.target.select()}
                                    className="bg-transparent border-none text-xs text-slate-600 font-mono w-full outline-none select-all cursor-text"
                                />
                                <button
                                    onClick={handleCopy}
                                    className={`shrink-0 flex items-center justify-center gap-1 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                        copied ? 'bg-emerald-500 text-white' : 'bg-primary text-white hover:bg-primary-light'
                                    }`}
                                >
                                    {copied ? <Check size={12} /> : <Copy size={12} />}
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>

                            {/* Fallback: open link in new tab for manual copy from address bar */}
                            <a
                                href={generatedLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1.5 text-[11px] text-primary hover:underline font-semibold"
                            >
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                Open link in new tab to verify
                            </a>

                            {/* WhatsApp Direct Share Button */}
                            {generatedPhone && (() => {
                                const p = generatedPhone.replace(/\D/g, '');
                                const formattedPhone = p.startsWith('91') ? p : `91${p}`;
                                const waText = `Hello ${activeCustomerName}, here is your personalized car catalog from *New Maharashtra Motors*, Kolhapur:\n\n${generatedLink}\n\nFeel free to browse the selected vehicles and reach out if you'd like a test drive or have any questions!`;
                                return (
                                    <a
                                        href={`https://wa.me/${formattedPhone}?text=${encodeURIComponent(waText)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full h-11 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
                                    >
                                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                        Share Catalog via WhatsApp
                                    </a>
                                );
                            })()}

                            <button
                                onClick={handleClose}
                                className="w-full h-11 border border-slate-200 rounded-xl text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                            >
                                Close Modal
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            
                            {/* Contact Search / Selector */}
                            {!selectedContact && !isOutsider ? (
                                <div className="relative" ref={dropdownRef}>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Search Contact (Name or Phone) *</label>
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={handleSearchChange}
                                            placeholder="Type name or phone number..."
                                            className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                        />
                                        {searchLoading && (
                                            <Loader2 size={16} className="animate-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        )}
                                    </div>

                                    {/* Dropdown results */}
                                    {showDropdown && (
                                        <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-100 rounded-2xl shadow-xl z-20">
                                            {/* Results */}
                                            {searchResults.map(contact => (
                                                <button
                                                    key={`${contact.type}-${contact.id}`}
                                                    type="button"
                                                    onClick={() => handleSelectContact(contact)}
                                                    className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 text-left transition-colors"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-bold text-slate-800 truncate">{contact.full_name}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1.5">
                                                            {contact.phone && <span className="flex items-center gap-0.5"><Phone size={10} />{contact.phone}</span>}
                                                        </p>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${contact.type === 'lead' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                                                        {contact.type}
                                                    </span>
                                                </button>
                                            ))}
                                            
                                            {/* Add Outsider link option */}
                                            <button
                                                type="button"
                                                onClick={handleSelectOutsider}
                                                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 text-left text-xs font-bold text-primary border-t border-slate-100 bg-slate-50/30"
                                            >
                                                <Plus size={14} />
                                                <span>Add Outsider: "{searchQuery || 'New Contact'}"</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Selected Contact Panel */
                                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-primary/5 text-primary p-2.5 rounded-xl shrink-0">
                                            <User size={18} />
                                        </div>
                                        <div>
                                            <h4 className="font-extrabold text-slate-800 text-sm">
                                                {selectedContact ? selectedContact.full_name : outsiderName}
                                            </h4>
                                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                                                {selectedContact ? `${selectedContact.type} • ${selectedContact.phone || 'No Phone'}` : `New Outsider • ${outsiderPhone || 'Pending Number'}`}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleClearSelection}
                                        className="text-xs font-bold text-red-500 hover:text-red-700"
                                    >
                                        Change
                                    </button>
                                </div>
                            )}

                            {/* Additional Outsider Inputs */}
                            {isOutsider && (
                                <div className="space-y-4 p-4 border border-slate-100 bg-slate-50/20 rounded-2xl animate-fade-in">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Outsider Details</h4>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={outsiderName}
                                            onChange={e => setOutsiderName(e.target.value)}
                                            className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                                            placeholder="e.g. Mr. Rajesh Patil"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Phone Number *</label>
                                        <input
                                            type="tel"
                                            required
                                            value={outsiderPhone}
                                            onChange={e => setOutsiderPhone(e.target.value)}
                                            className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                                            placeholder="e.g. 9823237975"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Expiry Duration *</label>
                                <select
                                    value={expiryDays}
                                    onChange={e => setExpiryDays(e.target.value)}
                                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none bg-white mb-4"
                                >
                                    <option value="1">24 Hours (1 day)</option>
                                    <option value="7">7 Days</option>
                                    <option value="30">30 Days</option>
                                    <option value="90">90 Days</option>
                                    <option value="never">No Expiry</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Personal Message / Remarks (Optional)</label>
                                <textarea
                                    value={customMessage}
                                    onChange={e => setCustomMessage(e.target.value)}
                                    rows={3}
                                    placeholder="e.g. Here are the top SUVs you inquired about. They are well-maintained first-owner vehicles in excellent condition."
                                    className="w-full p-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                                />
                            </div>

                            {errorMsg && (
                                <div className="p-3 text-xs text-red-500 bg-red-50 rounded-lg">
                                    {errorMsg}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || (!selectedContact && !isOutsider)}
                                className="w-full h-12 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors shadow-lg disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none flex items-center justify-center"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : (
                                    `Generate Shareable Catalog`
                                )}
                            </button>
                        </form>
                    )}
                </div>

            </div>
        </div>
    );
};

export default CreateSharedCatalogModal;
