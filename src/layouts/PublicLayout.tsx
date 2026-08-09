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
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
                <div className="container-main">
                    <div className="flex items-center justify-between h-16 sm:h-[4.5rem] gap-2 lg:gap-6">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
                            <div className="size-9 sm:size-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
                                <span className="material-symbols-outlined text-xl">directions_car</span>
                            </div>
                            <div className="block min-w-0 flex-1">
                                <h1 className="text-primary text-sm sm:text-lg font-bold leading-tight tracking-tight font-display truncate">
                                    <span className="xs:hidden">NMM</span>
                                    <span className="hidden xs:inline">New Maharashtra Motors</span>
                                </h1>
                            </div>
                        </Link>

                        {/* Desktop Nav */}
                        <nav className="hidden lg:flex items-center gap-1">
                            {navLinks.map(link => (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive(link.path)
                                        ? 'text-primary bg-slate-100 font-semibold'
                                        : 'text-slate-600 hover:text-primary hover:bg-slate-50'
                                        }`}
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </nav>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 sm:gap-3">
                            <form 
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (searchVal.trim()) {
                                        navigate(`/inventory?search=${encodeURIComponent(searchVal.trim())}`);
                                    }
                                }}
                                className="hidden md:flex items-center gap-2 bg-slate-50 rounded-xl px-4 h-10 border border-slate-100 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all min-w-[10rem] lg:min-w-[12.5rem]"
                            >
                                <Search size={16} className="text-slate-400 shrink-0" />
                                <input
                                    value={searchVal}
                                    onChange={(e) => setSearchVal(e.target.value)}
                                    className="bg-transparent border-none text-sm text-primary placeholder:text-slate-400 w-full outline-none"
                                    placeholder="Search..."
                                />
                            </form>

                            <button className="hidden lg:flex size-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-primary transition-colors">
                                <Heart size={20} />
                            </button>
                            <Link to="/admin/login" className="hidden lg:flex h-10 px-4 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 hover:text-primary transition-colors">
                                <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                                Admin
                            </Link>
                            <Link to="/auth" className="hidden sm:flex h-10 px-5 items-center justify-center gap-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-light transition-colors shadow-sm">
                                <User size={16} />
                                Login
                            </Link>
                            
                            {/* Mobile Actions */}
                            <button 
                                onClick={() => {
                                    setMobileSearchOpen(!mobileSearchOpen);
                                    setMobileMenuOpen(false);
                                }}
                                className="sm:hidden flex size-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
                                aria-label="Search"
                            >
                                <Search size={18} />
                            </button>
                            <Link to="/auth" className="sm:hidden flex size-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">
                                <User size={18} />
                            </Link>

                            {/* Mobile menu button */}
                            <button
                                onClick={() => {
                                    setMobileMenuOpen(!mobileMenuOpen);
                                    setMobileSearchOpen(false);
                                }}
                                className="lg:hidden flex size-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
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
                                className="sm:hidden overflow-hidden bg-slate-50 border-t border-slate-100"
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
                                        className="flex items-center gap-2 bg-white rounded-xl px-4 h-10 border border-slate-200 shadow-sm"
                                    >
                                        <Search size={16} className="text-slate-400 shrink-0" />
                                        <input
                                            value={searchVal}
                                            onChange={(e) => setSearchVal(e.target.value)}
                                            autoFocus
                                            className="bg-transparent border-none text-sm text-primary placeholder:text-slate-400 w-full outline-none"
                                            placeholder="Search by model, make, year..."
                                        />
                                        {searchVal && (
                                            <button 
                                                type="button" 
                                                onClick={() => setSearchVal('')} 
                                                className="text-slate-400 hover:text-primary flex items-center"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </form>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Mobile Menu */}
                    <AnimatePresence>
                        {mobileMenuOpen && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="lg:hidden overflow-hidden fixed inset-x-0 top-16 bottom-0 z-[60] bg-white pt-4 pb-8 flex flex-col border-t border-slate-100"
                            >
                                <nav className="flex flex-col gap-1 px-4">
                                    {navLinks.map(link => (
                                        <Link
                                            key={link.path}
                                            to={link.path}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className={`px-4 py-3.5 rounded-xl text-sm font-semibold transition-colors ${isActive(link.path)
                                                ? 'text-primary bg-slate-50 border-l-4 border-accent'
                                                : 'text-slate-600 hover:text-primary hover:bg-slate-50'
                                                }`}
                                        >
                                            {link.name}
                                        </Link>
                                    ))}
                                </nav>
                                <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-3 px-6 pb-8">
                                    <Link to="/admin/login" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors">
                                        <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                                        Staff Login
                                    </Link>
                                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-white text-base font-bold hover:bg-primary-light transition-colors shadow-lg">
                                        <User size={18} />
                                        Sign In / Register
                                    </Link>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
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
