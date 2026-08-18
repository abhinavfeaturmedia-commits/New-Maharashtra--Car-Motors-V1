import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, MessageSquare, MapPin, X } from 'lucide-react';
import { useInquiryCart } from '../../contexts/InquiryCartContext';

export const PublicMobileBottomNav: React.FC = () => {
    const location = useLocation();
    const { cartItems, setIsCartOpen } = useInquiryCart();
    const [showContactSheet, setShowContactSheet] = useState(false);

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    // On Car Details page, the vehicle-specific action bar takes precedence
    if (location.pathname.startsWith('/car/')) {
        return null;
    }

    const phoneNumber = '+919373721705';
    const whatsappNumber = '919373721705';

    return (
        <>
            {/* Quick Contact Action Sheet Modal on Mobile */}
            <AnimatePresence>
                {showContactSheet && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.6 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowContactSheet(false)}
                            className="lg:hidden fixed inset-0 bg-slate-900 z-50 backdrop-blur-xs"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-100 pb-8"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="size-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-xl">support_agent</span>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900 font-display">Contact Showroom</h3>
                                        <p className="text-[11px] text-slate-400">Kasarwadi, Pune • Instant Response</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowContactSheet(false)}
                                    className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="space-y-2.5">
                                <a
                                    href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hello New Maharashtra Motors! I am browsing your website and would like assistance.')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setShowContactSheet(false)}
                                    className="flex items-center gap-3.5 w-full p-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-98 transition-all"
                                >
                                    <div className="size-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                        <MessageSquare size={18} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="leading-tight">Chat on WhatsApp</p>
                                        <p className="text-[11px] text-emerald-100 font-normal">Direct message with sales team</p>
                                    </div>
                                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                                </a>

                                <a
                                    href={`tel:${phoneNumber}`}
                                    onClick={() => setShowContactSheet(false)}
                                    className="flex items-center gap-3.5 w-full p-3.5 rounded-2xl bg-[#0F1729] hover:bg-slate-800 text-white font-bold text-sm shadow-md active:scale-98 transition-all"
                                >
                                    <div className="size-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-amber-400">
                                        <Phone size={18} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="leading-tight">Call Showroom Now</p>
                                        <p className="text-[11px] text-slate-300 font-normal">+91 93737 21705 / +91 98232 37975</p>
                                    </div>
                                    <span className="material-symbols-outlined text-lg">call</span>
                                </a>

                                <a
                                    href="https://maps.google.com/?q=Sr.no+515/1,+near+Shankar+mandir,+Kasarwadi,+Pimpri-Chinchwad,+Maharashtra+411034"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setShowContactSheet(false)}
                                    className="flex items-center gap-3.5 w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-700 font-semibold text-sm hover:bg-slate-100 active:scale-98 transition-all"
                                >
                                    <div className="size-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 text-amber-600">
                                        <MapPin size={18} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="font-bold text-slate-900 leading-tight">Get Google Maps Directions</p>
                                        <p className="text-[11px] text-slate-500">Kasarwadi, Pune, MH 411034</p>
                                    </div>
                                    <span className="material-symbols-outlined text-lg text-slate-400">navigation</span>
                                </a>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Mobile Bottom Docked Navigation Bar */}
            <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-6px_25px_rgba(0,0,0,0.08)] pb-safe">
                <nav className="flex items-center justify-around px-2 py-1.5 max-w-lg mx-auto">
                    {/* 1. Home */}
                    <Link
                        to="/"
                        className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 relative ${
                            isActive('/') && location.pathname === '/'
                                ? 'text-amber-600 font-black'
                                : 'text-slate-500 hover:text-slate-900 font-medium'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[22px] transition-transform active:scale-90">
                            home
                        </span>
                        <span className="text-[10px] tracking-tight mt-0.5">Home</span>
                        {isActive('/') && location.pathname === '/' && (
                            <motion.div
                                layoutId="bottomNavDot"
                                className="absolute -bottom-1 size-1 rounded-full bg-amber-600"
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                        )}
                    </Link>

                    {/* 2. Inventory */}
                    <Link
                        to="/inventory"
                        className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 relative ${
                            isActive('/inventory')
                                ? 'text-amber-600 font-black'
                                : 'text-slate-500 hover:text-slate-900 font-medium'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[22px] transition-transform active:scale-90">
                            directions_car
                        </span>
                        <span className="text-[10px] tracking-tight mt-0.5">Cars</span>
                        {isActive('/inventory') && (
                            <motion.div
                                layoutId="bottomNavDot"
                                className="absolute -bottom-1 size-1 rounded-full bg-amber-600"
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                        )}
                    </Link>

                    {/* 3. Sell Car (Accent Button) */}
                    <Link
                        to="/sell"
                        className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 relative ${
                            isActive('/sell')
                                ? 'text-amber-600 font-black'
                                : 'text-slate-500 hover:text-slate-900 font-medium'
                        }`}
                    >
                        <div className="relative">
                            <span className="material-symbols-outlined text-[22px] transition-transform active:scale-90">
                                payments
                            </span>
                        </div>
                        <span className="text-[10px] tracking-tight mt-0.5">Sell Car</span>
                        {isActive('/sell') && (
                            <motion.div
                                layoutId="bottomNavDot"
                                className="absolute -bottom-1 size-1 rounded-full bg-amber-600"
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                        )}
                    </Link>

                    {/* 4. Inquiry Cart (with live badge) */}
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="flex flex-col items-center justify-center py-1 px-3 rounded-2xl text-slate-500 hover:text-slate-900 font-medium relative cursor-pointer"
                    >
                        <div className="relative">
                            <span className="material-symbols-outlined text-[22px]">
                                folder_special
                            </span>
                            {cartItems.length > 0 && (
                                <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-amber-600 text-white text-[9px] font-black flex items-center justify-center animate-pulse shadow-xs">
                                    {cartItems.length}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] tracking-tight mt-0.5">Cart</span>
                    </button>

                    {/* 5. Contact / Instant WhatsApp Action */}
                    <button
                        onClick={() => setShowContactSheet(true)}
                        className="flex flex-col items-center justify-center py-1 px-3 rounded-2xl text-slate-500 hover:text-slate-900 font-medium relative cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[22px] text-emerald-600">
                            chat
                        </span>
                        <span className="text-[10px] tracking-tight mt-0.5 text-emerald-700 font-bold">Contact</span>
                    </button>
                </nav>
            </div>
        </>
    );
};
