import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
    Search, Menu, X, Phone, Mail, MapPin, 
    Facebook, Instagram, Twitter, Youtube, 
    MessageSquare, ChevronDown, Wrench, Sparkles, 
    Calculator, ArrowRight, ShieldCheck, HelpCircle,
    Layers, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInquiryCart } from '../contexts/InquiryCartContext';
import { InquiryCartDrawer } from '../components/ui/InquiryCartDrawer';
import { PublicMobileBottomNav } from '../components/ui/PublicMobileBottomNav';
import { Chatbot } from '../components/Chatbot';

const PublicLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
    const [searchVal, setSearchVal] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { cartItems, setIsCartOpen } = useInquiryCart();

    // Close dropdown and mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
        setServicesDropdownOpen(false);
    }, [location.pathname]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setServicesDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const serviceLinks = [
        { 
            name: 'Workshop & Services', 
            desc: 'Scheduled servicing, 120-pt check & repairs', 
            path: '/services', 
            icon: <Wrench size={16} className="text-amber-500" /> 
        },
        { 
            name: 'Genuine Accessories', 
            desc: 'Car seat covers, electronics & styling parts', 
            path: '/accessories', 
            icon: <Sparkles size={16} className="text-blue-500" /> 
        },
        { 
            name: 'EMI & Loan Calculator', 
            desc: 'Calculate monthly EMIs & financing rates', 
            path: '/finance', 
            icon: <Calculator size={16} className="text-emerald-500" /> 
        },
        { 
            name: 'Compare Vehicles', 
            desc: 'Side-by-side specs, price & mileage comparison', 
            path: '/compare', 
            icon: <Layers size={16} className="text-purple-500" /> 
        },
        { 
            name: 'Car Insurance', 
            desc: 'Paperless renewal & comprehensive coverage', 
            path: '/insurance', 
            icon: <ShieldCheck size={16} className="text-rose-500" /> 
        },
    ];

    const isServicesActive = serviceLinks.some(s => location.pathname.startsWith(s.path));

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <div className="min-h-screen flex flex-col w-full bg-background-light font-body antialiased selection:bg-amber-500 selection:text-white">
            {/* Header — Floating Capsule Navbar */}
            <header className="sticky top-2 sm:top-4 z-50 w-full px-2.5 sm:px-6 max-w-7xl mx-auto transition-all duration-300">
                <div className="bg-white/95 backdrop-blur-xl rounded-full border border-slate-200/90 shadow-[0_8px_30px_rgba(0,0,0,0.08)] px-3.5 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-4">
                    
                    {/* Left: Brand Identity */}
                    <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
                        <div className="size-9 sm:size-10 rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center text-amber-400 shadow-md group-hover:scale-105 transition-transform shrink-0 border border-slate-700/60">
                            <span className="material-symbols-outlined text-lg sm:text-xl font-black">directions_car</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs sm:text-sm font-black text-slate-900 font-display tracking-tight whitespace-nowrap leading-tight">
                                New Maharashtra Motors
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase hidden sm:block">
                                Pune's Trusted Showroom
                            </span>
                        </div>
                    </Link>

                    {/* Center: Streamlined Desktop Navigation */}
                    <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5">
                        <Link
                            to="/"
                            className={`px-3.5 py-1.5 rounded-full text-xs xl:text-sm font-bold transition-all duration-200 ${
                                isActive('/') && location.pathname === '/' 
                                    ? 'bg-slate-900 text-white shadow-xs' 
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                            }`}
                        >
                            Home
                        </Link>

                        <Link
                            to="/inventory"
                            className={`px-3.5 py-1.5 rounded-full text-xs xl:text-sm font-bold transition-all duration-200 flex items-center gap-1.5 ${
                                isActive('/inventory') 
                                    ? 'bg-slate-900 text-white shadow-xs' 
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                            }`}
                        >
                            <span>Browse Cars</span>
                        </Link>

                        <Link
                            to="/sell"
                            className={`px-3.5 py-1.5 rounded-full text-xs xl:text-sm font-bold transition-all duration-200 ${
                                isActive('/sell') 
                                    ? 'bg-slate-900 text-white shadow-xs' 
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                            }`}
                        >
                            Sell Car
                        </Link>

                        {/* Services & Tools Interactive Dropdown */}
                        <div 
                            ref={dropdownRef}
                            className="relative"
                            onMouseEnter={() => setServicesDropdownOpen(true)}
                            onMouseLeave={() => setServicesDropdownOpen(false)}
                        >
                            <button
                                onClick={() => setServicesDropdownOpen(!servicesDropdownOpen)}
                                className={`px-3.5 py-1.5 rounded-full text-xs xl:text-sm font-bold transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                                    isServicesActive
                                        ? 'bg-slate-900 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                                }`}
                            >
                                <span>Services &amp; Tools</span>
                                <ChevronDown 
                                    size={14} 
                                    className={`transition-transform duration-200 ${servicesDropdownOpen ? 'rotate-180' : ''}`} 
                                />
                            </button>

                            <AnimatePresence>
                                {servicesDropdownOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 bg-white/98 backdrop-blur-2xl rounded-2xl p-2 border border-slate-200/90 shadow-2xl shadow-slate-900/15 z-50 space-y-1"
                                    >
                                        <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            Dealership Services &amp; Tools
                                        </div>
                                        {serviceLinks.map(s => {
                                            const active = location.pathname.startsWith(s.path);
                                            return (
                                                <Link
                                                    key={s.path}
                                                    to={s.path}
                                                    className={`flex items-start gap-3 p-2.5 rounded-xl transition-all ${
                                                        active ? 'bg-amber-50/80 text-primary' : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900'
                                                    }`}
                                                >
                                                    <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                                                        {s.icon}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold leading-tight">{s.name}</p>
                                                        <p className="text-[11px] text-slate-400 font-normal leading-snug mt-0.5 truncate">{s.desc}</p>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <Link
                            to="/about"
                            className={`px-3.5 py-1.5 rounded-full text-xs xl:text-sm font-bold transition-all duration-200 ${
                                isActive('/about') 
                                    ? 'bg-slate-900 text-white shadow-xs' 
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                            }`}
                        >
                            About
                        </Link>

                        <Link
                            to="/contact"
                            className={`px-3.5 py-1.5 rounded-full text-xs xl:text-sm font-bold transition-all duration-200 ${
                                isActive('/contact') 
                                    ? 'bg-slate-900 text-white shadow-xs' 
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                            }`}
                        >
                            Contact
                        </Link>
                    </nav>

                    {/* Right: Actions, Quick Call & CTA */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                        {/* 1-Tap Direct Call on Mobile */}
                        <a
                            href="tel:+919373721705"
                            className="sm:hidden flex size-9 items-center justify-center rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors border border-amber-200/60 shadow-2xs"
                            aria-label="Call Dealership"
                        >
                            <Phone size={15} />
                        </a>

                        {/* Subtle Staff Portal Link for Employees */}
                        <Link 
                            to="/admin/login" 
                            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all whitespace-nowrap"
                            title="Staff &amp; Admin Portal"
                        >
                            <Lock size={13} className="text-slate-400" />
                            <span>Staff</span>
                        </Link>

                        {/* Primary High-Conversion CTA */}
                        <Link
                            to="/contact"
                            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-4 sm:px-5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs sm:text-sm font-black tracking-wide shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30 transition-all hover:scale-105 active:scale-95 whitespace-nowrap cursor-pointer shrink-0"
                        >
                            <span>Get Quote</span>
                            <ArrowRight size={14} className="stroke-[3]" />
                        </Link>

                        {/* Mobile Menu Toggle Button (Strictly Hidden on Desktop lg:) */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="lg:hidden flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors shrink-0 active:scale-95"
                            aria-label="Toggle navigation menu"
                        >
                            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu Backdrop & Drawer */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setMobileMenuOpen(false)}
                                className="lg:hidden fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50"
                            />

                            {/* Mobile Drawer */}
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="lg:hidden fixed inset-x-3 top-16 z-[60] bg-white rounded-3xl p-5 flex flex-col border border-slate-200/90 shadow-2xl text-slate-900 max-h-[82vh] overflow-y-auto space-y-4"
                            >
                                {/* Quick Search Bar */}
                                <form 
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        if (searchVal.trim()) {
                                            navigate(`/inventory?search=${encodeURIComponent(searchVal.trim())}`);
                                            setMobileMenuOpen(false);
                                        }
                                    }}
                                    className="flex items-center gap-2 bg-slate-100 rounded-2xl px-3.5 h-11 border border-slate-200/80 shadow-inner"
                                >
                                    <Search size={16} className="text-slate-400 shrink-0" />
                                    <input
                                        value={searchVal}
                                        onChange={(e) => setSearchVal(e.target.value)}
                                        className="bg-transparent border-none text-xs text-slate-800 placeholder:text-slate-400 w-full outline-none"
                                        placeholder="Search cars by make, model, year..."
                                    />
                                    <button type="submit" className="text-xs font-bold text-amber-700 px-2.5 py-1 bg-amber-100/80 rounded-lg hover:bg-amber-200 transition-colors">
                                        Search
                                    </button>
                                </form>

                                {/* Buy & Sell Links */}
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Buy &amp; Sell</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Link
                                            to="/inventory"
                                            onClick={() => setMobileMenuOpen(false)}
                                            className={`flex items-center gap-2.5 p-3 rounded-2xl text-xs font-bold border transition-all ${
                                                isActive('/inventory') 
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                                                    : 'bg-slate-50 text-slate-800 border-slate-200/70 hover:bg-slate-100'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-base text-amber-500">directions_car</span>
                                            <span>Browse Cars</span>
                                        </Link>

                                        <Link
                                            to="/sell"
                                            onClick={() => setMobileMenuOpen(false)}
                                            className={`flex items-center gap-2.5 p-3 rounded-2xl text-xs font-bold border transition-all ${
                                                isActive('/sell') 
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                                                    : 'bg-slate-50 text-slate-800 border-slate-200/70 hover:bg-slate-100'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-base text-green-500">payments</span>
                                            <span>Sell Your Car</span>
                                        </Link>
                                    </div>
                                </div>

                                {/* Services & Tools Grid */}
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Services &amp; Tools</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {serviceLinks.map(link => (
                                            <Link
                                                key={link.path}
                                                to={link.path}
                                                onClick={() => setMobileMenuOpen(false)}
                                                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold border transition-all ${
                                                    isActive(link.path)
                                                        ? 'bg-amber-50 text-amber-900 border-amber-200 font-bold'
                                                        : 'bg-white text-slate-700 border-slate-100 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className="size-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                                                    {link.icon}
                                                </div>
                                                <span className="truncate">{link.name}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>

                                {/* Dealership Information */}
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Dealership</p>
                                    <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                                        <Link
                                            to="/"
                                            onClick={() => setMobileMenuOpen(false)}
                                            className={`p-2.5 rounded-xl border ${isActive('/') && location.pathname === '/' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-700 border-slate-200/60'}`}
                                        >
                                            Home
                                        </Link>
                                        <Link
                                            to="/about"
                                            onClick={() => setMobileMenuOpen(false)}
                                            className={`p-2.5 rounded-xl border ${isActive('/about') ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-700 border-slate-200/60'}`}
                                        >
                                            About Us
                                        </Link>
                                        <Link
                                            to="/contact"
                                            onClick={() => setMobileMenuOpen(false)}
                                            className={`p-2.5 rounded-xl border ${isActive('/contact') ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-700 border-slate-200/60'}`}
                                        >
                                            Contact
                                        </Link>
                                    </div>
                                </div>

                                {/* Direct Quick Communication Actions */}
                                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                                    <div className="grid grid-cols-2 gap-2">
                                        <a
                                            href="https://wa.me/919373721705?text=Hello%20New%20Maharashtra%20Motors"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-1.5 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold active:scale-95 transition-all shadow-2xs"
                                        >
                                            <MessageSquare size={15} />
                                            WhatsApp
                                        </a>
                                        <a
                                            href="tel:+919373721705"
                                            className="flex items-center justify-center gap-1.5 h-11 rounded-xl bg-slate-900 text-white text-xs font-bold active:scale-95 transition-all shadow-sm"
                                        >
                                            <Phone size={15} className="text-amber-400" />
                                            Call Showroom
                                        </a>
                                    </div>

                                    <div className="flex items-center justify-between pt-1 px-1">
                                        <Link 
                                            to="/admin/login" 
                                            onClick={() => setMobileMenuOpen(false)} 
                                            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
                                        >
                                            <Lock size={12} />
                                            <span>Staff Portal</span>
                                        </Link>

                                        <Link 
                                            to="/faq" 
                                            onClick={() => setMobileMenuOpen(false)} 
                                            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900"
                                        >
                                            <HelpCircle size={12} />
                                            <span>Help &amp; FAQ</span>
                                        </Link>
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </header>

            {/* Main Content with Mobile Bottom Safe Margin */}
            <main className="flex-1 w-full flex flex-col pb-20 lg:pb-0">
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
                                    <span>Sr.no 515/1, near Shankar mandir, Kasarwadi, Pimpri-Chinchwad, Maharashtra 411034, India</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Phone size={16} className="text-accent shrink-0" />
                                    <span>+91 93737 21705 / +91 98232 37975</span>
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

            {/* Floating Inquiry Cart Badge - Desktop only */}
            <AnimatePresence>
                {cartItems.length > 0 && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0, opacity: 0, y: 50 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsCartOpen(true)}
                        className="hidden lg:flex fixed bottom-6 right-[5.5rem] z-40 items-center justify-center gap-3 h-14 px-6 rounded-full bg-primary text-white shadow-2xl hover:bg-primary-light transition-colors border border-white/10"
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
            <PublicMobileBottomNav />
            <InquiryCartDrawer />
        </div>
    );
};

export default PublicLayout;
