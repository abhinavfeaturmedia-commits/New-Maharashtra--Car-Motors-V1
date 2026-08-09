import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getPrimaryImage, formatPriceLakh, formatDate } from '../lib/utils';

interface Booking {
    id: string;
    type: string;
    message: string | null;
    status: string;
    created_at: string;
    full_name: string;
    car_make: string | null;
    car_model: string | null;
    car_year: number | null;
}

interface WishlistCar {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
    images: string[];
    fuel_type: string;
    transmission: string;
}

const STATUS_COLORS: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-amber-100 text-amber-700',
    negotiation: 'bg-purple-100 text-purple-700',
    closed_won: 'bg-green-100 text-green-700',
    closed_lost: 'bg-slate-100 text-slate-500',
};

const UserDashboard = () => {
    const { user, profile, signOut } = useAuth();
    const [activeTab, setActiveTab] = useState('bookings');

    // ─── Bookings from leads table ────────────────────────────────────────────
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [bookingsLoading, setBookingsLoading] = useState(true);

    // ─── Wishlist from localStorage ───────────────────────────────────────────
    const [wishlistCars, setWishlistCars] = useState<WishlistCar[]>([]);
    const [wishlistLoading, setWishlistLoading] = useState(false);

    // ─── Finance Services State ────────────────────────────────────────────────
    const [myServices, setMyServices] = useState<any[]>([]);
    const [servicesLoading, setServicesLoading] = useState(false);

    const tabs = [
        { id: 'bookings', label: 'My Bookings', icon: 'event_note' },
        { id: 'services', label: 'Financial Services', icon: 'handshake' },
        { id: 'shortlisted', label: 'Shortlisted Cars', icon: 'favorite' },
        { id: 'settings', label: 'Profile', icon: 'person' },
    ];

    // ─── Fetch bookings ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!profile?.phone && !profile?.email) {
            setBookingsLoading(false);
            return;
        }

        const fetchBookings = async () => {
            setBookingsLoading(true);
            // Match leads by phone or email (depending on what the user submitted)
            let query = supabase
                .from('leads')
                .select('id, type, message, status, created_at, full_name, car_make, car_model, car_year')
                .order('created_at', { ascending: false });

            if (profile.phone) {
                query = query.eq('phone', profile.phone);
            } else if (profile.email) {
                query = query.eq('email', profile.email);
            }

            const { data } = await query;
            setBookings(data || []);
            setBookingsLoading(false);
        };

        fetchBookings();
    }, [profile]);

    // ─── Fetch financial services ─────────────────────────────────────────────
    useEffect(() => {
        const fetchServices = async () => {
            if (!profile?.phone && !profile?.email) {
                setServicesLoading(false);
                return;
            }
            setServicesLoading(true);
            let query = supabase
                .from('finance_services')
                .select('*, car:inventory(*)')
                .order('created_at', { ascending: false });

            if (profile.phone) {
                query = query.eq('phone', profile.phone);
            } else if (profile.email) {
                query = query.eq('email', profile.email);
            }

            const { data } = await query;
            setMyServices(data || []);
            setServicesLoading(false);
        };

        if (activeTab === 'services') {
            fetchServices();
        }
    }, [activeTab, profile]);

    // ─── Load wishlist from Supabase ─────────────────────────────────────
    useEffect(() => {
        const loadWishlist = async () => {
            if (!user) {
                setWishlistCars([]);
                return;
            }
            setWishlistLoading(true);

            const { data: wishlistData } = await supabase
                .from('user_wishlist')
                .select('inventory_id')
                .eq('user_id', user.id);

            const savedIds = wishlistData?.map(w => w.inventory_id) || [];

            if (savedIds.length === 0) {
                setWishlistCars([]);
                setWishlistLoading(false);
                return;
            }

            const { data } = await supabase
                .from('inventory')
                .select('id, make, model, year, price, images, fuel_type, transmission')
                .in('id', savedIds)
                .in('status', ['available', 'reserved']);

            setWishlistCars(data || []);
            setWishlistLoading(false);
        };

        loadWishlist();
        // Refresh when tab switches to wishlist
    }, [activeTab, user]);

    const removeFromWishlist = async (id: string) => {
        if (!user) return;
        setWishlistCars(prev => prev.filter(c => c.id !== id));
        await supabase.from('user_wishlist').delete().match({ user_id: user.id, inventory_id: id });
    };

    const getLeadTypeLabel = (type: string) => {
        const map: Record<string, string> = {
            test_drive: 'Test Drive',
            contact: 'General Inquiry',
            sell_car: 'Sell My Car',
            insurance: 'Insurance',
            service: 'Service Booking',
            finance: 'Finance Inquiry',
            car_service: 'Car Services',
        };
        return map[type] || type;
    };

    return (
        <div className="container-main py-8">
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar */}
                <aside className="lg:w-[15rem] shrink-0">
                    <div className="sticky top-[5.5rem] space-y-1">
                        {/* User info */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4 shadow-[var(--shadow-card)]">
                            <div className="size-12 rounded-full bg-primary flex items-center justify-center text-white text-lg font-bold mb-3">
                                {profile?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <p className="font-bold text-primary text-sm truncate">{profile?.full_name || 'Customer'}</p>
                            <p className="text-xs text-slate-400 truncate">{profile?.phone || profile?.email || user?.email || ''}</p>
                        </div>

                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 px-3">Account Menu</p>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}

                        <button
                            onClick={signOut}
                            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all mt-2"
                        >
                            <span className="material-symbols-outlined text-lg">logout</span>
                            Sign Out
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-black text-primary font-display">My Dashboard</h1>
                            <p className="text-slate-500 text-sm">Manage your bookings and saved vehicles.</p>
                        </div>
                        <Link to="/inventory" className="hidden sm:flex items-center gap-2 h-10 px-5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors">
                            <span className="material-symbols-outlined text-lg">add</span> Browse Cars
                        </Link>
                    </div>

                    {/* My Bookings Tab */}
                    {activeTab === 'bookings' && (
                        <section className="mb-10">
                            <h2 className="text-lg font-bold text-primary font-display flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-accent">event_note</span> My Bookings & Enquiries
                            </h2>

                            {bookingsLoading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse h-20" />
                                    ))}
                                </div>
                            ) : bookings.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-slate-100 p-10 shadow-[var(--shadow-card)] flex flex-col items-center justify-center text-center">
                                    <div className="size-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                                        <span className="material-symbols-outlined text-3xl text-slate-300">event_note</span>
                                    </div>
                                    <h3 className="font-bold text-primary font-display text-lg mb-1">No bookings yet</h3>
                                    <p className="text-sm text-slate-400 max-w-xs mb-5">Your test drive bookings and enquiries will appear here.</p>
                                    <Link to="/book-test-drive" className="inline-flex items-center gap-2 h-10 px-6 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors">
                                        <span className="material-symbols-outlined text-lg">directions_car</span> Book a Test Drive
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {bookings.map(b => (
                                        <div key={b.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                        <span className="material-symbols-outlined text-lg">
                                                            {b.type === 'test_drive' ? 'directions_car'
                                                                : b.type === 'sell_car' ? 'sell'
                                                                : b.type === 'insurance' ? 'shield'
                                                                : b.type === 'finance' ? 'account_balance'
                                                                : b.type === 'car_service' ? 'build'
                                                                : 'chat'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-primary text-sm">{getLeadTypeLabel(b.type)}</p>
                                                        {(b.car_make || b.car_model) && (
                                                            <p className="text-xs text-slate-500">{b.car_year} {b.car_make} {b.car_model}</p>
                                                        )}
                                                        {b.message && (
                                                            <p className="text-xs text-slate-400 mt-1 line-clamp-1">{b.message}</p>
                                                        )}
                                                        <p className="text-xs text-slate-400 mt-1">{formatDate(b.created_at)}</p>
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase shrink-0 ${STATUS_COLORS[b.status] || 'bg-slate-100 text-slate-500'}`}>
                                                    {b.status?.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {/* Financial Services Tab */}
                    {activeTab === 'services' && (
                        <section className="mb-10 animate-in fade-in duration-200">
                            <h2 className="text-lg font-bold text-primary font-display flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-accent">handshake</span> My Loans & Insurance Policies
                            </h2>

                            {servicesLoading ? (
                                <div className="space-y-3">
                                    {[1, 2].map(i => (
                                        <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse h-20" />
                                    ))}
                                </div>
                            ) : myServices.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-slate-100 p-10 shadow-[var(--shadow-card)] flex flex-col items-center justify-center text-center">
                                    <div className="size-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                                        <span className="material-symbols-outlined text-3xl text-slate-300">handshake</span>
                                    </div>
                                    <h3 className="font-bold text-primary font-display text-lg mb-1 font-medium">No active services</h3>
                                    <p className="text-sm text-slate-400 max-w-xs mb-5">
                                        You don't have any active loan files or insurance policies registered with us.
                                    </p>
                                    <div className="flex gap-2 justify-center">
                                        <Link to="/finance" className="inline-flex items-center gap-2 h-10 px-5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors">
                                            <span className="material-symbols-outlined text-base">calculate</span> EMI Calculator
                                        </Link>
                                        <Link to="/insurance" className="inline-flex items-center gap-2 h-10 px-5 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors">
                                            <span className="material-symbols-outlined text-base">shield</span> Insurance Quote
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {myServices.map(s => {
                                        const statusColors: Record<string, string> = {
                                            pending: 'bg-amber-100 text-amber-700 border-amber-200',
                                            docs_submitted: 'bg-blue-100 text-blue-700 border-blue-200',
                                            bank_processing: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                                            quote_sent: 'bg-blue-100 text-blue-700 border-blue-200',
                                            payment_pending: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                                            approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                            disbursed: 'bg-green-100 text-green-700 border-green-200',
                                            policy_issued: 'bg-green-100 text-green-700 border-green-200',
                                            rejected: 'bg-red-100 text-red-700 border-red-200',
                                            cancelled: 'bg-slate-100 text-slate-500 border-slate-200'
                                        };
                                        return (
                                            <div key={s.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="size-12 rounded-xl bg-slate-50 border border-slate-100 text-primary flex items-center justify-center shrink-0">
                                                        <span className="material-symbols-outlined text-xl">
                                                            {s.type === 'loan' ? 'account_balance' : 'shield'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="font-bold text-primary text-sm capitalize">
                                                                {s.type === 'loan' ? 'Car Loan File' : 'Car Insurance Contract'}
                                                            </p>
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${statusColors[s.status] || 'bg-slate-100 text-slate-500'}`}>
                                                                {s.status.replace('_', ' ')}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-400 mt-1">
                                                            Registered name: <span className="font-semibold text-slate-600">{s.full_name}</span>
                                                        </p>
                                                        {s.provider_name && (
                                                            <p className="text-xs text-slate-500 mt-0.5">
                                                                Provider: <span className="font-semibold">{s.provider_name}</span>
                                                                {s.policy_number && ` • Policy: ${s.policy_number}`}
                                                            </p>
                                                        )}
                                                        {s.car && (
                                                            <p className="text-xs text-slate-500 mt-0.5">
                                                                Vehicle: <span className="font-semibold">{s.car.year} {s.car.make} {s.car.model}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div className="text-left md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                                                    {s.type === 'loan' ? (
                                                        <>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Requested Loan</p>
                                                            <p className="text-lg font-black text-primary font-display">₹{Number(s.amount || 0).toLocaleString('en-IN')}</p>
                                                            {s.interest_rate && (
                                                                <p className="text-xs text-slate-400 mt-0.5">
                                                                    Rate: {s.interest_rate}% • Tenure: {s.tenure_months}M
                                                                </p>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Insurance Premium</p>
                                                            <p className="text-lg font-black text-primary font-display">{s.premium_amount ? `₹${Number(s.premium_amount).toLocaleString('en-IN')}` : '—'}</p>
                                                            {s.amount && (
                                                                <p className="text-xs text-slate-400 mt-0.5">IDV Cover: ₹{Number(s.amount).toLocaleString('en-IN')}</p>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    )}

                    {/* Shortlisted Cars Tab */}
                    {activeTab === 'shortlisted' && (
                        <section>
                            <h2 className="text-lg font-bold text-primary font-display flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-red-400">favorite</span> Shortlisted Cars
                            </h2>

                            {wishlistLoading ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {[1, 2].map(i => <div key={i} className="bg-white rounded-2xl h-48 animate-pulse border border-slate-100" />)}
                                </div>
                            ) : wishlistCars.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-slate-100 p-10 shadow-[var(--shadow-card)] flex flex-col items-center justify-center text-center">
                                    <div className="size-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                                        <span className="material-symbols-outlined text-3xl text-slate-300">favorite</span>
                                    </div>
                                    <h3 className="font-bold text-primary font-display text-lg mb-1">No saved cars</h3>
                                    <p className="text-sm text-slate-400 max-w-xs mb-5">Browse inventory and tap the ♥ button to save cars here.</p>
                                    <Link to="/inventory" className="inline-flex items-center gap-2 h-10 px-6 bg-accent/10 text-accent rounded-xl text-sm font-semibold hover:bg-accent hover:text-primary transition-all">
                                        <span className="material-symbols-outlined text-lg">search</span> Explore Inventory
                                    </Link>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {wishlistCars.map(car => (
                                        <div key={car.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-[var(--shadow-card)] group">
                                            <Link to={`/car/${car.id}`} className="block">
                                                <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                                                    <img src={getPrimaryImage(car.images)} alt={`${car.year} ${car.make} ${car.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                </div>
                                            </Link>
                                            <div className="p-4">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <h3 className="font-bold text-primary">{car.year} {car.make} {car.model}</h3>
                                                        <p className="text-xs text-slate-500">{car.fuel_type} • {car.transmission}</p>
                                                        <p className="text-base font-black text-primary mt-1">₹{formatPriceLakh(car.price)} Lakh</p>
                                                    </div>
                                                    <button
                                                        onClick={() => removeFromWishlist(car.id)}
                                                        className="p-1.5 hover:bg-red-50 rounded-full text-red-400 transition-colors"
                                                        title="Remove from wishlist"
                                                    >
                                                        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                                                    </button>
                                                </div>
                                                <Link to={`/car/${car.id}`} className="mt-3 w-full h-9 flex items-center justify-center gap-1 text-sm font-semibold text-primary border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                                                    View Details
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {/* Profile Tab */}
                    {activeTab === 'settings' && (
                        <section>
                            <h2 className="text-lg font-bold text-primary font-display flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-accent">person</span> My Profile
                            </h2>
                            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)] space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Full Name</p>
                                        <p className="text-sm font-semibold text-primary">{profile?.full_name || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Email</p>
                                        <p className="text-sm font-semibold text-primary">{user?.email || profile?.email || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Phone</p>
                                        <p className="text-sm font-semibold text-primary">{profile?.phone || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Account Type</p>
                                        <p className="text-sm font-semibold text-primary capitalize">{profile?.role || 'Customer'}</p>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-100">
                                    <p className="text-xs text-slate-400">To update your profile details, please <Link to="/contact" className="text-accent font-semibold hover:underline">contact us</Link>.</p>
                                </div>
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;
