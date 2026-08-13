import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { generateOpenRouterCompletion } from '../lib/openrouter';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
    id: string;
    sender: 'user' | 'bot';
    text: string;
    timestamp: Date;
}

interface AvailableCar {
    make: string;
    model: string;
    year: number;
    price: number;
    transmission: string;
    fuel_type: string;
    mileage: number;
}

export const Chatbot: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            sender: 'bot',
            text: 'Hello! I am your New Maharashtra Motors AI Assistant. How can I help you today? You can ask me about our available cars, test drive bookings, service packages, or request a call back.',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [availableCars, setAvailableCars] = useState<AvailableCar[]>([]);
    const [settings, setSettings] = useState<any>(null);
    
    // Lead Form overlay state
    const [showLeadForm, setShowLeadForm] = useState(false);
    const [leadForm, setLeadForm] = useState({ name: '', phone: '', email: '', message: '' });
    const [submittingLead, setSubmittingLead] = useState(false);
    const [leadSubmitted, setLeadSubmitted] = useState(false);

    const messageEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of messages
    useEffect(() => {
        if (messageEndRef.current) {
            messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isTyping, showLeadForm]);

    // Fetch dynamic context on mount
    useEffect(() => {
        const fetchContext = async () => {
            try {
                // Fetch available cars
                const { data: cars } = await supabase
                    .from('inventory')
                    .select('make, model, year, price, transmission, fuel_type, mileage')
                    .eq('status', 'available')
                    .order('created_at', { ascending: false })
                    .limit(20);
                
                if (cars) {
                    setAvailableCars(cars as AvailableCar[]);
                }

                // Fetch dealership settings
                const { data: settingsData } = await supabase
                    .from('dealership_settings')
                    .select('*');
                
                if (settingsData && settingsData.length > 0) {
                    const map: Record<string, any> = {};
                    settingsData.forEach((s: any) => {
                        const k = s.setting_key ?? s.key;
                        const v = s.setting_value ?? s.value;
                        if (k !== undefined) map[k] = v;
                    });
                    setSettings(map);
                }
            } catch (err) {
                console.error('Error fetching chatbot context:', err);
            }
        };

        fetchContext();
    }, []);

    const orSettings = settings?.openrouter_settings;
    const isAiOnline = !!(orSettings?.is_enabled && orSettings?.api_key);

    const formatCurrencyLakh = (price: number): string => {
        return `₹${(price / 100000).toFixed(2)} Lakh`;
    };

    const handleSendMessage = async (textToSend: string) => {
        if (!textToSend.trim()) return;

        const userMsg: Message = {
            id: Math.random().toString(),
            sender: 'user',
            text: textToSend,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        // Simulate AI thinking delay
        setTimeout(async () => {
            try {
                if (isAiOnline) {
                    // ─── AI MODE (OpenRouter) ───
                    const carsContext = availableCars.length > 0
                        ? availableCars.map(c => `- ${c.year} ${c.make} ${c.model} (${c.transmission}, ${c.fuel_type}, Price: ${formatCurrencyLakh(c.price)}, Mileage: ${c.mileage.toLocaleString()} km)`).join('\n')
                        : 'No specific cars are in stock at the moment, but customers can enquire for ordering.';

                    const profile = settings?.business_profile || {};
                    const hours = settings?.working_hours || {};
                    const hoursText = Object.entries(hours).map(([day, val]: [string, any]) => 
                        `${day}: ${val.status} ${val.status !== 'Closed' ? `(${val.start} - ${val.end})` : ''}`
                    ).join('\n');

                    const systemPrompt = `You are a friendly, professional AI chatbot assistant for "New Maharashtra Motors", a premier automotive dealership and service provider in Pune, Maharashtra, India.
Your goals:
1. Greet visitors warmly and resolve queries regarding our available cars, services, pricing, timings, and location.
2. If they are interested in buying, selling, booking a test drive, or request a callback, offer to have a representative call them. Ask them to click the "Request Callback" button in the chat or provide their Name and Phone number.
3. Keep responses helpful, concise, and structured (use bullet points or emojis where helpful). Do NOT write introductory conversational fillers.

Dealership Details:
- Name: New Maharashtra Motors
- Showroom Location: ${profile.address || 'Sr.no 515/1, near Shankar mandir, Kasarwadi, Pimpri-Chinchwad, Maharashtra 411034'}
- City: ${profile.city || 'Pune'}
- Phone: ${profile.phone || '+91 93737 21705'}
- Email: ${profile.email || 'sales@newmaharashtramotors.com'}
- GST: ${profile.gst_number || 'N/A'}
- Timings:\n${hoursText || 'Monday-Saturday (9:30 AM - 7:30 PM), Sunday Closed'}

Available Inventory in Stock:
${carsContext}

Services Offered:
- Pre-owned Certified Car Sales (200-point quality check)
- Car Insurance assistance
- Showroom Test Drives (free of charge)
- Vehicle Service Booking (routine maintenance, repairs, detailing)
- Sell Your Car (instant quote, spot payment, hassle-free transfer)
- Consignment Sales (sell through our showroom for a small fee)

Conversation Guideline:
- Keep answers brief and optimized for a small chat widget screen.
- If a customer shares contact details (Name and Phone), acknowledge it politely and state that a representative will call them shortly.`;

                    const apiKey = orSettings.api_key;
                    const model = orSettings.default_model === 'custom' 
                        ? orSettings.custom_model 
                        : orSettings.default_model;

                    const userPrompt = textToSend;
                    
                    // Call OpenRouter
                    const aiText = await generateOpenRouterCompletion({
                        apiKey,
                        model,
                        systemPrompt,
                        userPrompt
                    });

                    const botMsg: Message = {
                        id: Math.random().toString(),
                        sender: 'bot',
                        text: aiText,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, botMsg]);
                } else {
                    // ─── OFFLINE RULE-BASED FALLBACK MODE ───
                    let reply = '';
                    const lowerText = textToSend.toLowerCase();

                    if (lowerText.includes('car') || lowerText.includes('stock') || lowerText.includes('inventory') || lowerText.includes('buy')) {
                        reply = `We have several certified premium pre-owned cars available! Here are a few recent arrivals in our showroom:\n\n` +
                            availableCars.slice(0, 3).map(c => `🚗 *${c.year} ${c.make} ${c.model}* (${c.transmission}, ${c.fuel_type}) - *${formatCurrencyLakh(c.price)}*`).join('\n') +
                            `\n\nWould you like our sales team to contact you with our complete catalog, photos, and best deals? Click *Request Callback* below to leave your details!`;
                    } else if (lowerText.includes('location') || lowerText.includes('address') || lowerText.includes('where')) {
                        const addr = settings?.business_profile?.address || 'Sr.no 515/1, near Shankar mandir, Kasarwadi, Pimpri-Chinchwad, Maharashtra 411034';
                        reply = `📍 *Showroom Address:*\n${addr}\n\nWe are situated in Pune. You are welcome to visit us to inspect any vehicle or take a test drive!`;
                    } else if (lowerText.includes('timing') || lowerText.includes('hour') || lowerText.includes('open') || lowerText.includes('sunday')) {
                        reply = `⏰ *Operating Hours:*\n- Monday to Friday: 9:30 AM - 7:30 PM\n- Saturday: 9:30 AM - 2:00 PM\n- Sunday: Closed`;
                    } else if (lowerText.includes('sell')) {
                        reply = `💰 *Sell Your Car with Us:*\nWe offer instant evaluation, spot payments, and fully managed RC transfers. You can list it as a consignment or sell it directly to us.\n\nWould you like an evaluation quote? Click *Request Callback* to let our procurement team reach out to you.`;
                    } else if (lowerText.includes('service') || lowerText.includes('repair') || lowerText.includes('detail')) {
                        reply = `🔧 *Car Services offered:*\n- Scheduled routine maintenance\n- Detailing & ceramic coating\n- Bodywork and repairs\n- Insurance renewals\n\nClick *Request Callback* to arrange a service booking slot!`;
                    } else {
                        reply = `I am currently operating in offline mode. I can help you with available cars, location, hours, or logging a callback request.\n\nTo speak directly to our representative, you can call us at *+91 98232 37975* or click *Request Callback* below to leave your details.`;
                    }

                    const botMsg: Message = {
                        id: Math.random().toString(),
                        sender: 'bot',
                        text: reply,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, botMsg]);
                }
            } catch (err: any) {
                console.error('Chatbot API error:', err);
                const errorMsg: Message = {
                    id: Math.random().toString(),
                    sender: 'bot',
                    text: 'Sorry, I encountered an issue connecting to the AI helper. Please contact us directly at +91 98232 37975 or click Request Callback to submit your enquiry.',
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, errorMsg]);
            } finally {
                setIsTyping(false);
            }
        }, 1000);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!leadForm.name || !leadForm.phone) return;
        setSubmittingLead(true);
        try {
            const { error } = await supabase.from('leads').insert({
                type: 'contact',
                full_name: leadForm.name,
                phone: leadForm.phone,
                email: leadForm.email || null,
                message: `Captured via Website Chatbot: "${leadForm.message || 'Customer requested a callback via AI Chatbot'}"`,
                source: 'chatbot',
                status: 'new'
            });

            if (error) throw error;

            setLeadSubmitted(true);
            const userMsgText = `Requesting callback: ${leadForm.name} (${leadForm.phone}) ${leadForm.message ? `- "${leadForm.message}"` : ''}`;
            const userMsg: Message = {
                id: Math.random().toString(),
                sender: 'user',
                text: userMsgText,
                timestamp: new Date()
            };

            const botMsg: Message = {
                id: Math.random().toString(),
                sender: 'bot',
                text: `Thank you, ${leadForm.name}! Your callback request has been logged in our CRM. One of our sales experts will reach out to you shortly at ${leadForm.phone}.`,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, userMsg, botMsg]);
            setLeadForm({ name: '', phone: '', email: '', message: '' });
            setTimeout(() => {
                setShowLeadForm(false);
                setLeadSubmitted(false);
            }, 3000);
        } catch (err: any) {
            console.error('Failed to submit chatbot lead:', err);
            alert('Failed to submit callback request. Please try again or call us.');
        } finally {
            setSubmittingLead(false);
        }
    };

    const handleSuggestedChip = (text: string) => {
        handleSendMessage(text);
    };

    return (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 flex flex-col items-end">
            {/* Chat Window Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="w-[92vw] sm:w-[380px] h-[500px] bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden mb-4"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-primary to-primary-light p-4 text-white flex items-center justify-between shrink-0 shadow-md">
                            <div className="flex items-center gap-3">
                                <div className="size-9 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
                                    <span className="material-symbols-outlined text-accent text-lg">smart_toy</span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold font-display leading-tight">SS Motors Assistant</h3>
                                    <p className="text-[10px] text-green-300 flex items-center gap-1 mt-0.5">
                                        <span className="inline-block size-1.5 rounded-full bg-green-400 animate-ping" />
                                        {isAiOnline ? 'Online (AI Active)' : 'Online (Direct Assist)'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>

                        {/* Message Box / Chat Body */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40 relative">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm leading-relaxed ${
                                            msg.sender === 'user'
                                                ? 'bg-primary text-white rounded-tr-none font-medium'
                                                : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none whitespace-pre-line'
                                        }`}
                                    >
                                        {msg.text}
                                        <span className={`block text-[9px] mt-1.5 text-right opacity-60 ${msg.sender === 'user' ? 'text-white/80' : 'text-slate-400'}`}>
                                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex gap-1 items-center h-8 shrink-0">
                                        <span className="size-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="size-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="size-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            )}

                            {/* Lead Form Overlay inside Chat window */}
                            {showLeadForm && (
                                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end p-4 animate-fadeIn">
                                    <div className="bg-white w-full rounded-2xl p-4 shadow-xl border border-slate-100 space-y-3.5 animate-slideUp">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-xs font-black text-primary uppercase tracking-wide flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-sm text-accent">phone_in_talk</span>
                                                Request Callback
                                            </h4>
                                            <button
                                                type="button"
                                                onClick={() => setShowLeadForm(false)}
                                                className="text-slate-400 hover:text-slate-600"
                                            >
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        </div>
                                        
                                        {leadSubmitted ? (
                                            <div className="text-center py-6 text-green-600 space-y-2">
                                                <span className="material-symbols-outlined text-3xl">check_circle</span>
                                                <p className="text-xs font-bold">Details Logged Successfully!</p>
                                            </div>
                                        ) : (
                                            <form onSubmit={handleFormSubmit} className="space-y-2.5">
                                                <input
                                                    required
                                                    type="text"
                                                    placeholder="Full Name *"
                                                    value={leadForm.name}
                                                    onChange={e => setLeadForm({ ...leadForm, name: e.target.value })}
                                                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs outline-none focus:bg-white"
                                                />
                                                <input
                                                    required
                                                    type="tel"
                                                    placeholder="Phone Number *"
                                                    value={leadForm.phone}
                                                    onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })}
                                                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs outline-none focus:bg-white"
                                                />
                                                <input
                                                    type="email"
                                                    placeholder="Email (Optional)"
                                                    value={leadForm.email}
                                                    onChange={e => setLeadForm({ ...leadForm, email: e.target.value })}
                                                    className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs outline-none focus:bg-white"
                                                />
                                                <textarea
                                                    placeholder="Message / Requirements (Optional)"
                                                    value={leadForm.message}
                                                    onChange={e => setLeadForm({ ...leadForm, message: e.target.value })}
                                                    rows={2}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:bg-white resize-none"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={submittingLead}
                                                    className="w-full h-9 bg-primary hover:bg-primary-light text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                                                >
                                                    {submittingLead ? 'Submitting...' : 'Submit Call Request'}
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div ref={messageEndRef} />
                        </div>

                        {/* Interactive Chips / Suggestions */}
                        {!showLeadForm && (
                            <div className="px-4 py-2 border-t border-slate-100 flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-hide bg-white shrink-0">
                                <button
                                    onClick={() => handleSuggestedChip('🚗 Browse Available Cars')}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-primary hover:text-white rounded-full text-[10px] font-semibold text-slate-600 transition-colors shadow-sm"
                                >
                                    Browse Cars
                                </button>
                                <button
                                    onClick={() => handleSuggestedChip('📍 Showroom Location & Timing')}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-primary hover:text-white rounded-full text-[10px] font-semibold text-slate-600 transition-colors shadow-sm"
                                >
                                    Hours & Location
                                </button>
                                <button
                                    onClick={() => handleSuggestedChip('💰 Sell My Car')}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-primary hover:text-white rounded-full text-[10px] font-semibold text-slate-600 transition-colors shadow-sm"
                                >
                                    Sell Car
                                </button>
                                <button
                                    onClick={() => setShowLeadForm(true)}
                                    className="px-3 py-1.5 bg-accent text-primary hover:bg-primary hover:text-white rounded-full text-[10px] font-black transition-colors shadow-sm flex items-center gap-1"
                                >
                                    <span className="material-symbols-outlined text-[12px] font-bold">phone_in_talk</span>
                                    Request Callback
                                </button>
                            </div>
                        )}

                        {/* Footer Input Form */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSendMessage(input);
                            }}
                            className="p-3 border-t border-slate-100 bg-white flex gap-2 items-center shrink-0"
                        >
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                disabled={showLeadForm}
                                placeholder="Type your message here..."
                                className="flex-1 h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-primary outline-none focus:border-primary/40 focus:bg-white transition-all disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || showLeadForm}
                                className="size-9 bg-primary hover:bg-primary-light text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 shadow-sm"
                            >
                                <span className="material-symbols-outlined text-[18px]">send</span>
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Float Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`size-14 rounded-full flex items-center justify-center text-white shadow-2xl border border-white/10 transition-colors cursor-pointer ${
                    isOpen ? 'bg-primary-light' : 'bg-primary'
                }`}
                aria-label="Toggle AI Assistant"
            >
                <span className="material-symbols-outlined text-2xl font-bold">
                    {isOpen ? 'chat_bubble_outline' : 'smart_toy'}
                </span>
            </motion.button>
        </div>
    );
};
