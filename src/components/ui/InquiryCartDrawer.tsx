import React, { useState } from 'react';
import { X, Trash2, Loader2, CheckCircle, MessageSquare } from 'lucide-react';
import { useInquiryCart } from '../../contexts/InquiryCartContext';
import { supabase } from '../../lib/supabase';
import { getPrimaryImage, formatPriceLakh } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export const InquiryCartDrawer: React.FC = () => {
    const { cartItems, removeFromCart, clearCart, isCartOpen, setIsCartOpen } = useInquiryCart();
    
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (cartItems.length === 0) return;
        
        setLoading(true);
        setErrorMsg('');

        try {
            // 1. Format the vehicle list details for the lead message
            const vehicleListText = cartItems
                .map((car, idx) => `${idx + 1}. ${car.year} ${car.make} ${car.model} (Price: Rs. ${formatPriceLakh(car.price)} Lakh, Mileage: ${(car.mileage || 0).toLocaleString('en-IN')} km)`)
                .join('\n');

            const fullMessage = `Customer Inquired Catalog Cart containing:\n${vehicleListText}\n\nAdditional message:\n${message || 'No additional remarks.'}`;
            const carIds = cartItems.map(c => c.id);

            // 2. Call atomic RPC function submit_cart_inquiry to avoid RLS RETURNING policy issues
            const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_cart_inquiry', {
                p_full_name: name,
                p_phone: phone,
                p_email: email || null,
                p_message: fullMessage,
                p_type: 'general',
                p_source: 'catalog_cart',
                p_inventory_ids: carIds
            });

            if (rpcError) {
                console.warn('RPC submit_cart_inquiry failed, attempting direct insert fallback:', rpcError);
                
                // Fallback: Direct insert into leads table without .select() (prevents RLS RETURNING error)
                const { error: directError } = await supabase
                    .from('leads')
                    .insert({
                        type: 'general',
                        full_name: name,
                        phone: phone,
                        email: email || null,
                        message: fullMessage,
                        source: 'catalog_cart',
                        status: 'new'
                    });

                if (directError) throw directError;
            } else if (rpcResult && rpcResult.success === false) {
                throw new Error(rpcResult.error || 'Failed to submit inquiry.');
            } else if (rpcResult && rpcResult.lead_id) {
                setCreatedLeadId(rpcResult.lead_id);
            }

            // Success state
            setSubmitted(true);
            clearCart();
        } catch (error: any) {
            console.error('Inquiry Submission Error:', error);
            setErrorMsg(error.message || 'Failed to submit inquiry. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getWhatsAppUrl = () => {
        const adminNumber = '919373721705'; // New Maharashtra Motors main business contact
        let text = `Hello New Maharashtra Motors, I just submitted an inquiry on your website under the name *${name}* (${phone}).\n\n`;
        text += `I am interested in these vehicles:\n`;
        
        cartItems.forEach((car, index) => {
            text += `- *${car.year} ${car.make} ${car.model}* (Rs. ${formatPriceLakh(car.price)} Lakh)\n`;
        });
        
        if (message) {
            text += `\n*Note:* ${message}`;
        }
        
        return `https://wa.me/${adminNumber}?text=${encodeURIComponent(text)}`;
    };

    const handleClose = () => {
        setIsCartOpen(false);
        // Reset form if submitted
        if (submitted) {
            setName('');
            setPhone('');
            setEmail('');
            setMessage('');
            setSubmitted(false);
        }
    };

    return (
        <AnimatePresence>
            {isCartOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.4 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 z-50 bg-black backdrop-blur-sm"
                    />

                    {/* Drawer container */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl border-l border-slate-100"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                            <div className="flex items-center gap-2">
                                <div className="bg-primary/5 text-primary p-2 rounded-xl">
                                    <span className="material-symbols-outlined text-xl">folder_special</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">Inquiry Cart</h3>
                                    <p className="text-xs text-slate-500">{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} selected</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {submitted ? (
                                <div className="flex h-full flex-col items-center justify-center text-center space-y-6">
                                    <div className="bg-emerald-50 text-emerald-500 p-4 rounded-full animate-bounce">
                                        <CheckCircle size={48} />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-slate-800">Inquiry Received!</h4>
                                        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                                            Thank you, <strong>{name}</strong>. Our team has received your catalog request and will contact you shortly.
                                        </p>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="w-full space-y-3 pt-4">
                                        <a
                                            href={getWhatsAppUrl()}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors shadow-md"
                                        >
                                            <MessageSquare size={18} />
                                            Message on WhatsApp
                                        </a>
                                        <button
                                            onClick={handleClose}
                                            className="w-full h-12 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                                        >
                                            Close Drawer
                                        </button>
                                    </div>
                                </div>
                            ) : cartItems.length === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center text-center space-y-4">
                                    <span className="material-symbols-outlined text-5xl text-slate-300">shopping_cart_off</span>
                                    <div>
                                        <h4 className="font-bold text-slate-700">Your Inquiry Cart is empty</h4>
                                        <p className="mt-1 text-sm text-slate-400 max-w-xs">
                                            Browse our inventory and click "Add to Inquiry" on cars you are interested in.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Cart Items list */}
                                    <div className="space-y-3">
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Selected Vehicles</span>
                                        {cartItems.map(car => (
                                            <div
                                                key={car.id}
                                                className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors group relative"
                                            >
                                                <img
                                                    src={getPrimaryImage(car.images)}
                                                    alt={`${car.make} ${car.model}`}
                                                    className="w-16 h-12 object-cover rounded-lg bg-slate-200"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <h5 className="font-bold text-slate-800 text-sm truncate">
                                                        {car.year} {car.make} {car.model}
                                                    </h5>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {car.fuel_type} • {car.transmission}
                                                    </p>
                                                    <p className="text-sm font-semibold text-primary mt-1">
                                                        ₹{formatPriceLakh(car.price)} Lakh
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => removeFromCart(car.id)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Remove vehicle"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Inquiry Form */}
                                    <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-slate-100">
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Request Information</span>
                                        
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">Your Name *</label>
                                            <input
                                                type="text"
                                                required
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                                placeholder="e.g. Abhinav Sharma"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">Phone Number *</label>
                                            <input
                                                type="tel"
                                                required
                                                value={phone}
                                                onChange={e => setPhone(e.target.value)}
                                                className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                                placeholder="e.g. 9823237975"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">Email Address (Optional)</label>
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                                placeholder="e.g. abhinav@example.com"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">Remarks or Questions (Optional)</label>
                                            <textarea
                                                value={message}
                                                onChange={e => setMessage(e.target.value)}
                                                rows={3}
                                                className="w-full p-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                                                placeholder="Ask about financing, test drives, or general condition..."
                                            />
                                        </div>

                                        {errorMsg && (
                                            <div className="p-3 text-xs text-red-500 bg-red-50 rounded-lg">
                                                {errorMsg}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex items-center justify-center w-full h-12 rounded-xl bg-primary text-white font-bold hover:bg-primary-light transition-colors shadow-lg disabled:bg-slate-300"
                                        >
                                            {loading ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                `Submit Inquiry for ${cartItems.length} ${cartItems.length === 1 ? 'Car' : 'Cars'}`
                                            )}
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
