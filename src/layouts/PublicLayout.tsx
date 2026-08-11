import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Heart, User, Menu, X, Phone, Mail, MapPin, Facebook, Instagram, Twitter, Youtube } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInquiryCart } from '../contexts/InquiryCartContext';
import { InquiryCartDrawer } from '../components/ui/InquiryCartDrawer';
import { Chatbot } from '../components/Chatbot';

const PublicLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [searchVal, setSearchVal] = useState('');
    const { cartItems, setIsCartOpen } = useInquiryCart();

    const navLinks = [
        { name: 'Home', path: '/' },
        { name: 'Inventory', path: '/inventory' },
        { name: 'Accessories', path: '/accessories' },
        { name: 'Sell Car', path: '/sell' },
        { name: 'Services', path: '/services' },
        { name: 'Finance', path: '/finance' },
        { name: 'About', path: '/about' },
        { name: 'Contact', path: '/contact' },
    ];

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <div className="min-h-screen flex flex-col w-full bg-background-light font-body antialiased">
            {/* Header — Floating White Capsule Navbar without search bar, 100% contained */}
            <header className="sticky top-4 z-50 w-full px-3 sm:px-6 max-w-7xl mx-auto transition-all duration-300">
                <div className="bg-white/95 backdrop-blur-xl rounded-full border border-slate-200/90 shadow-[0_12px_40px_rgba(0,0,0,0.18)] px-4 sm:px-5 py-2 flex items-center justify-between gap-2 overflow-hidden">
                    {/* Left: Logo & Brand Badge */}
                    <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
                        <div className="size-9 rounded-full bg-[#0B0F1A] flex items-center justify-center text-amber-400 shadow-md group-hover:scale-105 transition-transform shrink-0">
                            <span className="material-symbols-outlined text-lg font-black">directions_car</span>
                        </div>
                        <span className="hidden md:inline text-xs sm:text-sm font-black text-slate-900 font-display tracking-tight whitespace-nowrap">
                            New Maharashtra Motors
                        </span>
                    </Link>

                    {/* Center: Desktop Navigation with Dark Active Pill */}
                    <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1">
                        {navLinks.map(link => {
                            const active = isActive(link.path);
                            return (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    className={`relative px-2.5 xl:px-3.5 py-1.5 rounded-full text-xs xl:text-sm font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                                        active ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {active && (
                                        <motion.div
                                            layoutId="perfectActivePill"
                                            className="absolute inset-0 bg-[#0F1729] rounded-full shadow-md"
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                    <span className="relative z-10">{link.name}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Right: Actions & Orange Get Quote Pill Button */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <Link 
                            to="/inventory"
                            className="hidden lg:flex size-8 rounded-full bg-slate-100 border border-slate-200 text-slate-600 hover:text-primary items-center justify-center transition-all"
                            title="Wishlist"
                        >
                            <Heart size={15} />
                        </Link>

                        <Link 
                            to="/admin/login" 
                            className="hidden md:flex size-8 rounded-full bg-slate-100 border border-slate-200 text-slate-600 hover:text-primary items-center justify-center transition-all"
                            title="Staff Login"
                        >
                            <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                        </Link>

                        <Link
                            to="/contact"
                            className="hidden sm:flex items-center justify-center h-9 px-5 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-black tracking-wide shadow-lg shadow-amber-600/30 transition-all hover:scale-105 active:scale-95 whitespace-nowrap cursor-pointer shrink-0"
                        >
                            Get Quote
                        </Link>
                        
                        {/* Mobile Actions */}
                        <Link to="/contact" className="sm:hidden flex h-8 px-3.5 items-center justify-center rounded-full bg-amber-600 text-white text-xs font-bold shadow-md whitespace-nowrap">
                            Get Quote
                        </Link>

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="lg:hidden flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors shrink-0"
                        >
                            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Search Bar Drawer */}
                <AnimatePresence>
                    {mobileSearchOpen && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="sm:hidden overflow-hidden bg-white/95 backdrop-blur-md rounded-2xl mt-2 border border-slate-200 shadow-xl"
                        >
                            <div className="px-4 py-3">
                                <form 
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        if (searchVal.trim()) {
                                            navigate(`/inventory?search=${encodeURIComponent(searchVal.trim())}`);
                                            setMobileSearchOpen(false);
                                        }
                                    }}
                                    className="flex items-center gap-2 bg-slate-100 rounded-full px-4 h-10 border border-slate-200 shadow-inner text-slate-800"
                                >
                                    <Search size={16} className="text-slate-400 shrink-0" />
                                    <input
                                        value={searchVal}
                                        onChange={(e) => setSearchVal(e.target.value)}
                                        autoFocus
                                        className="bg-transparent border-none text-sm text-slate-800 placeholder:text-slate-400 w-full outline-none"
                                        placeholder="Search by model, make, year..."
                                    />
                                    {searchVal && (
                                        <button 
                                            type="button" 
                                            onClick={() => setSearchVal('')} 
                                            className="text-slate-400 hover:text-slate-700 flex items-center"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </form>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mobile Menu Drawer */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="lg:hidden overflow-hidden fixed inset-x-4 top-20 z-[60] bg-white/95 backdrop-blur-2xl rounded-3xl p-6 flex flex-col border border-slate-200/90 shadow-2xl text-slate-900 max-h-[80vh] overflow-y-auto"
                        >
                            <nav className="flex flex-col gap-1.5">
                                {navLinks.map(link => (
                                    <Link
                                        key={link.path}
                                        to={link.path}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`px-4 py-3 rounded-full text-sm font-bold transition-all ${isActive(link.path)
                                            ? 'text-white bg-[#0B0F1A] shadow-md'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                            }`}
                                    >
                                        {link.name}
                                    </Link>
                                ))}
                            </nav>
                            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-3">
                                <Link to="/admin/login" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2 text-sm font-semibold text-slate-600 hover:text-primary transition-colors">
                                    <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                                    Staff Portal Login
                                </Link>
                                <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-2 h-12 rounded-full bg-amber-600 text-white text-base font-black tracking-wide hover:bg-amber-700 transition-colors shadow-lg">
                                    Get Quote
                                </Link>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full flex flex-col">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="bg-primary text-white pt-12 sm:pt-16 pb-8 border-t border-primary-light/10">
                <div className="container-main">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-12">
                        {/* Brand */}
                        <div className="space-y-4 sm:space-y-6">
                            <Link to="/" className="flex items-center gap-3">
                                <div className="size-10 bg-accent rounded-xl flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined font-bold">directions_car</span>
                                </div>
                                <h2 className="text-lg font-bold font-display leading-tight">New Maharashtra Motors</h2>
                            </Link>
                            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                                Your trusted destination for quality vehicles, genuine spare parts, and vehicle services in Pune.
                            </p>
                            <div className="flex items-center gap-3">
                                {[
                                    { id: 'facebook', icon: <Facebook size={18} /> },
                                    { id: 'instagram', icon: <Instagram size={18} /> },
                                    { id: 'twitter', icon: <Twitter size={18} /> },
                                    { id: 'youtube', icon: <Youtube size={18} /> }
                                ].map(social => (
                                    <a key={social.id} href="#" className="flex-none size-9 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:bg-accent hover:text-primary transition-all duration-300">
                                        {social.icon}
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* Explore */}
                        <div>
                            <h4 className="font-bold font-display text-base mb-5">Explore</h4>
                            <ul className="space-y-3 text-sm text-slate-400">
                                {[
                                    { name: 'Current Inventory', path: '/inventory' },
                                    { name: 'Sell Your Car', path: '/sell' },
                                    { name: 'Financing Options', path: '/finance' },
                                    { name: 'Compare Models', path: '/compare' },
                                    { name: 'About Us', path: '/about' },
                                    { name: 'FAQ', path: '/faq' },
                                ].map(link => (
                                    <li key={link.path}>
                                        <Link to={link.path} className="hover:text-accent transition-colors">{link.name}</Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Our Services */}
                        <div>
                            <h4 className="font-bold font-display text-base mb-5">Our Services</h4>
                            <ul className="space-y-3 text-sm text-slate-400">
                                {[
                                    { name: 'Car Insurance', path: '/insurance' },
                                    { name: 'Book a Test Drive', path: '/book-test-drive' },
                                    { name: 'Vehicle Service', path: '/services' },
                                    { name: 'Extended Warranty', path: '/faq' },
                                    { name: 'Car Detailing', path: '/services' },
                                ].map((link, i) => (
                                    <li key={i}>
                                        <Link to={link.path} className="hover:text-accent transition-colors">{link.name}</Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Visit Us */}
                        <div>
                            <h4 className="font-bold font-display text-base mb-5">Visit Us</h4>
                            <ul className="space-y-4 text-sm text-slate-400">
                                <li className="flex items-start gap-3">
                                    <MapPin size={16} className="text-accent shrink-0 mt-0.5" />
                                    <span>Chatrapati Shivaji Nagar, Behind Mahadik Bungalow, Shiroli (P), Pune, Maharashtra</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Phone size={16} className="text-accent shrink-0" />
                                    <span>+91 93737 21705</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Mail size={16} className="text-accent shrink-0" />
                                    <a href="mailto:sales@newmaharashtramotors.com" className="hover:text-accent transition-colors">sales@newmaharashtramotors.com</a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Copyright */}
                <div className="border-t border-white/10">
                    <div className="container-main py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <p className="text-xs text-slate-500">
                            © {new Date().getFullYear()} New Maharashtra Motors. Effortless Discovery Since 2001.
                        </p>
                        <div className="flex gap-6 text-xs text-slate-500">
                            <Link to="/about" className="hover:text-accent transition-colors">About</Link>
                            <Link to="/contact" className="hover:text-accent transition-colors">Contact</Link>
                            <Link to="/faq" className="hover:text-accent transition-colors">FAQ</Link>
                            <Link to="/admin/login" className="hover:text-accent transition-colors">Admin</Link>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Floating Inquiry Cart Badge */}
            <AnimatePresence>
                {cartItems.length > 0 && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0, opacity: 0, y: 50 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsCartOpen(true)}
                        className="fixed bottom-6 right-[5.5rem] z-40 flex items-center justify-center gap-3 h-14 px-6 rounded-full bg-primary text-white shadow-2xl hover:bg-primary-light transition-colors border border-white/10"
                    >
                        <span className="material-symbols-outlined text-2xl">folder_special</span>
                        <span className="text-sm font-bold tracking-wide">Inquiry Cart</span>
                        <span className="flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-accent text-primary text-xs font-black shadow-inner">
                            {cartItems.length}
                        </span>
                    </motion.button>
                )}
            </AnimatePresence>

            <Chatbot />
            <InquiryCartDrawer />
        </div>
    );
};

export default PublicLayout;
