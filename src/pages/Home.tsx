import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Heart, Sparkles, ChevronRight, Landmark } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getPrimaryImage, formatPriceLakh } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useInquiryCart } from '../contexts/InquiryCartContext';
import { FALLBACK_INVENTORY } from '../data/mockInventory';
import HappyCustomersCarousel from '../components/home/HappyCustomersCarousel';


const TRUST_BADGES = [
    { icon: 'verified_user', title: '200-Point Check', desc: 'Certified Quality Standards' },
    { icon: 'payments', title: 'Negotiable Price', desc: 'Best Value Deals' },
    { icon: 'thumb_up', title: '100% Satisfaction Guarantee', desc: 'Comprehensive Peace of Mind' },
];

const BODY_TYPE_FILTERS = [
    { label: 'All', value: '' },
    { label: 'SUV', value: 'SUV' },
    { label: 'Sedan', value: 'Sedan' },
    { label: 'Hatchback', value: 'Hatchback' },
    { label: 'MUV', value: 'MUV' },
    { label: 'Luxury', value: 'Luxury' },
    { label: 'Coupe', value: 'Coupe' },
];

const BRAND_LOGOS = [
    {
        name: 'Maruti Suzuki',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Maruti_Suzuki_logo.svg'
    },
    {
        name: 'Hyundai',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hyundai_Motor_Company_logo.svg'
    },
    {
        name: 'Toyota',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Toyota_EU.svg'
    },
    {
        name: 'Honda',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Honda_Logo.svg'
    },
    {
        name: 'Mahindra',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/1/16/Mahindra_Rise_New_Logo.svg'
    },
    {
        name: 'Tata',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Tata_logo.svg'
    },
    {
        name: 'Kia',
        logo: 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/kia.svg'
    },
    {
        name: 'BMW',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/4/44/BMW.svg'
    },
    {
        name: 'Mercedes',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/9/90/Mercedes-Logo.svg'
    }
];


interface Car {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
    original_price?: number;
    fuel_type: string;
    transmission: string;
    mileage: number;
    images: string[];
    condition: string;
    status: string;
    body_type?: string;
    deal_ends_at?: string | null;
    description?: string | null;
    created_at?: string;
}

const renderBodyTypeIcon = (name: string) => {
    const strokeColor = "currentColor";
    const strokeWidth = 1.5;

    switch (name) {
        case 'SUV':
            return (
                <svg viewBox="0 0 24 24" className="w-14 h-7" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="7" cy="17" r="2" />
                    <circle cx="17" cy="17" r="2" />
                    <path d="M2 13h3m10 4h-6m8 0h3M2 13V9.5C2 8.7 2.7 8 3.5 8h3L9 5h6.5c.6 0 1.1.4 1.3 1l1.2 4H21c.6 0 1 .4 1 1v3h-3" />
                </svg>
            );
        case 'Sedan':
            return (
                <svg viewBox="0 0 24 24" className="w-14 h-7" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="6.5" cy="17" r="2" />
                    <circle cx="17.5" cy="17" r="2" />
                    <path d="M2 14h2.5m11 3h-7m9 0h2.5M2 14c0-1.5 1-2.5 2.5-2.5h1.5l1.5-3.5c.2-.4.6-.7 1.1-.7h6.2c.5 0 .9.3 1.1.7l1.5 3.5h1.6c1.5 0 2.5 1 2.5 2.5v1.5H2V14z" />
                </svg>
            );
        case 'Hatchback':
            return (
                <svg viewBox="0 0 24 24" className="w-14 h-7" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="6.5" cy="17" r="2" />
                    <circle cx="17.5" cy="17" r="2" />
                    <path d="M2 14h2.5m11 3h-7M20 17h2M2 14c0-1.5 1-2.5 2.5-2.5h2l2.2-4c.2-.4.6-.7 1.1-.7h4.4c.5 0 .9.3 1.1.7l2.2 4h1.5c1.5 0 2.5 1 2.5 2.5v1.5H2V14z" />
                </svg>
            );
        case 'MUV':
            return (
                <svg viewBox="0 0 24 24" className="w-14 h-7" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="7" cy="17" r="2" />
                    <circle cx="17" cy="17" r="2" />
                    <path d="M2 13h3m10 4h-6m8 0h3M2 13V8.5C2 7.7 2.7 7 3.5 7H16c.6 0 1.1.4 1.3 1l1.2 4H21c.6 0 1 .4 1 1v3h-3" />
                </svg>
            );
        case 'Luxury':
            return (
                <svg viewBox="0 0 24 24" className="w-14 h-7" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="6.5" cy="17" r="2" />
                    <circle cx="17.5" cy="17" r="2" />
                    <path d="M2 15h2m11 2h-7m9 0h2M2 15c0-.8.4-1.5 1.1-1.8l3.7-1.6L9.8 9c.4-.3.8-.5 1.3-.5h2.8c.4 0 .9.1 1.2.4l4.1 2.9L21 13c.6.3 1 1 1 1.6v1.4H2V15z" />
                </svg>
            );
        case 'Coupe':
            return (
                <svg viewBox="0 0 24 24" className="w-14 h-7" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="6.5" cy="17" r="2" />
                    <circle cx="17.5" cy="17" r="2" />
                    <path d="M2 14.5h2m11 2.5h-7m9 0h2M2 14.5c0-1.2.8-2.2 2-2.4l2.4-.4 3.5-3.6c.3-.3.8-.5 1.2-.5H14c.3 0 .6.1.8.4l3.5 3.9h1.7c1 0 1.8.8 1.8 1.8v1.3H2v-1.1z" />
                </svg>
            );
        default:
            return (
                <svg viewBox="0 0 24 24" className="w-14 h-7" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="7" cy="17" r="2" />
                    <circle cx="17" cy="17" r="2" />
                    <path d="M2 14h20v2H2z" />
                </svg>
            );
    }
};

const Home = () => {
    const [cars, setCars] = useState<Car[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [brands, setBrands] = useState<string[]>([]);
    const [years, setYears] = useState<string[]>([]);
    const [selectedFilters, setSelectedFilters] = useState({ budget: '', brand: '', year: '' });
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addToCart, isInCart, removeFromCart } = useInquiryCart();

    // Wishlist state
    const [wishlist, setWishlist] = useState<string[]>([]);

    // Deal of the Week state
    const [dealCar, setDealCar] = useState<Car | null>(null);
    const [dealEndsAt, setDealEndsAt] = useState('');
    const [dealDiscount, setDealDiscount] = useState(0);
    const [dealTimer, setDealTimer] = useState('');
    const [showReserveModal, setShowReserveModal] = useState(false);
    const [reserveForm, setReserveForm] = useState({ full_name: '', phone: '', email: '' });
    const [reserveLoading, setReserveLoading] = useState(false);
    const [reserveSuccess, setReserveSuccess] = useState(false);
    const [reserveError, setReserveError] = useState('');

    // Quick Compare state
    const [compareInventory, setCompareInventory] = useState<Car[]>([]);
    const [carAId, setCarAId] = useState('');
    const [carBId, setCarBId] = useState('');

    useEffect(() => {
        // Load initial wishlist
        const loadWishlist = async () => {
            if (!user) {
                setWishlist([]);
                return;
            }
            const { data } = await supabase.from('user_wishlist').select('inventory_id').eq('user_id', user.id);
            setWishlist(data?.map(w => w.inventory_id) || []);
        };
        loadWishlist();

        const fetchRecentInventory = async () => {
            try {
                const { data, error: err } = await supabase
                    .from('inventory')
                    .select('*')
                    .in('status', ['available', 'reserved'])
                    .order('created_at', { ascending: false })
                    .limit(4);
                
                if (err || !data || data.length === 0) {
                    setCars(FALLBACK_INVENTORY.slice(0, 4) as any);
                    setError(false);
                } else {
                    setCars(data);
                    setError(false);
                }
            } catch {
                setCars(FALLBACK_INVENTORY.slice(0, 4) as any);
                setError(false);
            } finally {
                setLoading(false);
            }
        };

        const fetchFilterOptions = async () => {
            try {
                const { data } = await supabase.from('inventory').select('make, year').in('status', ['available', 'reserved']);
                const filterSource = (data && data.length > 0) ? data : FALLBACK_INVENTORY;
                const b = Array.from(new Set(filterSource.map(d => d.make))).filter(Boolean).sort();
                const y = Array.from(new Set(filterSource.map(d => String(d.year)))).filter(Boolean).sort().reverse();
                setBrands(b);
                setYears(y);
            } catch {
                const b = Array.from(new Set(FALLBACK_INVENTORY.map(d => d.make))).filter(Boolean).sort();
                const y = Array.from(new Set(FALLBACK_INVENTORY.map(d => String(d.year)))).filter(Boolean).sort().reverse();
                setBrands(b);
                setYears(y);
            }
        };


        // Fetch Deal of the Week
        const fetchDealOfTheWeek = async () => {
            try {
                const { data: settingsData } = await supabase
                    .from('dealership_settings')
                    .select('*')
                    .eq('setting_key', 'deal_of_the_week')
                    .maybeSingle();

                let configCarId = '';
                let configEndsAt = '';

                if (settingsData && settingsData.setting_value) {
                    configCarId = settingsData.setting_value.car_id || '';
                    configEndsAt = settingsData.setting_value.ends_at || '';
                }

                let carData: Car | null = null;
                if (configCarId) {
                    const { data } = await supabase
                        .from('inventory')
                        .select('*')
                        .eq('id', configCarId)
                        .eq('status', 'available')
                        .maybeSingle();
                    if (data) carData = data;
                }

                // Fallback A: Fetch car with a discount
                if (!carData) {
                    const { data } = await supabase
                        .from('inventory')
                        .select('*')
                        .eq('status', 'available')
                        .not('original_price', 'is', null)
                        .order('price', { ascending: true });
                    
                    if (data && data.length > 0) {
                        const sortedByDiscount = [...data].sort((a, b) => {
                            const discA = (Number(a.original_price) - Number(a.price)) / Number(a.original_price);
                            const discB = (Number(b.original_price) - Number(b.price)) / Number(b.original_price);
                            return discB - discA;
                        });
                        carData = sortedByDiscount[0];
                    }
                }

                // Fallback B: Pick newest available car
                if (!carData) {
                    const { data } = await supabase
                        .from('inventory')
                        .select('*')
                        .eq('status', 'available')
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    if (data) carData = data;
                }

                if (carData) {
                    setDealCar(carData);
                    if (configEndsAt) {
                        setDealEndsAt(configEndsAt);
                    } else {
                        const nextSunday = new Date();
                        nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()) % 7);
                        nextSunday.setHours(23, 59, 59, 999);
                        setDealEndsAt(nextSunday.toISOString());
                    }

                    if (carData.original_price && carData.original_price > carData.price) {
                        setDealDiscount(Number(carData.original_price) - Number(carData.price));
                    } else {
                        setDealDiscount(75000); // default mock save
                    }
                }
            } catch (err) {
                console.error('Error fetching deal of the week:', err);
            }
        };

        // Fetch Inventory list for Compare Dropdowns
        const fetchCompareInventory = async () => {
            const { data } = await supabase
                .from('inventory')
                .select('id, make, model, year, price, transmission, fuel_type, images, mileage, condition, status')
                .eq('status', 'available')
                .order('make', { ascending: true });
            if (data && data.length > 0) {
                setCompareInventory(data);
                setCarAId(data[0].id);
                if (data.length >= 2) {
                    setCarBId(data[1].id);
                } else {
                    setCarBId(data[0].id);
                }
            }
        };

        fetchRecentInventory();
        fetchFilterOptions();
        fetchDealOfTheWeek();
        fetchCompareInventory();
    }, [user]);


    // Countdown Timer Effect
    useEffect(() => {
        if (!dealEndsAt) return;
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const target = new Date(dealEndsAt).getTime();
            const diff = target - now;

            if (diff <= 0) {
                setDealTimer('Offer Expired');
                clearInterval(interval);
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            let timerStr = '';
            if (days > 0) timerStr += `${days}d `;
            timerStr += `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
            setDealTimer(timerStr);
        }, 1000);

        return () => clearInterval(interval);
    }, [dealEndsAt]);

    const toggleWishlist = async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!user) {
            alert('Please login to save cars to your wishlist.');
            return;
        }
        
        if (wishlist.includes(id)) {
            setWishlist(prev => prev.filter(wId => wId !== id));
            await supabase.from('user_wishlist').delete().match({ user_id: user.id, inventory_id: id });
        } else {
            setWishlist(prev => [...prev, id]);
            await supabase.from('user_wishlist').insert({ user_id: user.id, inventory_id: id });
        }
    };

    // Deal of the Week Reservation Submit
    const handleReservation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reserveForm.full_name || !reserveForm.phone) {
            setReserveError('Name and phone number are required.');
            return;
        }
        setReserveLoading(true);
        setReserveError('');

        try {
            const reserveMsg = `Reservation inquiry with ₹10,000 deposit intent for Deal of the Week: ${dealCar?.year} ${dealCar?.make} ${dealCar?.model}.`;

            const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_public_lead', {
                p_full_name: reserveForm.full_name.trim(),
                p_phone: reserveForm.phone.trim(),
                p_email: reserveForm.email?.trim() || null,
                p_message: reserveMsg,
                p_type: 'reservation',
                p_source: 'website_home_deal',
                p_car_make: dealCar?.make || null,
                p_car_model: dealCar?.model || null,
                p_car_year: dealCar?.year || null,
                p_inventory_id: dealCar?.id || null
            });

            if (rpcError) {
                console.warn('RPC submit_public_lead failed on Home page, using direct fallback:', rpcError);
                const { error: directError } = await supabase.from('leads').insert({
                    type: 'reservation',
                    full_name: reserveForm.full_name.trim(),
                    phone: reserveForm.phone.trim(),
                    email: reserveForm.email?.trim() || null,
                    car_make: dealCar?.make || null,
                    car_model: dealCar?.model || null,
                    car_year: dealCar?.year || null,
                    inventory_id: dealCar?.id || null,
                    message: reserveMsg,
                    source: 'website_home_deal',
                    status: 'new'
                });

                if (directError) throw directError;
            } else if (rpcResult && rpcResult.success === false) {
                throw new Error(rpcResult.error || 'Failed to submit reservation.');
            }

            setReserveSuccess(true);
        } catch (err: any) {
            console.error('Home reservation error:', err);
            setReserveError(err.message || 'Failed to submit reservation. Please try again.');
        } finally {
            setReserveLoading(false);
        }
    };

    const getMileageDisplay = (car: Car | null | undefined) => {
        if (!car) return '—';
        if (car.condition?.toLowerCase() === 'used' && !car.mileage) {
            return 'Not Available';
        }
        return `${(car.mileage || 0).toLocaleString('en-IN')} km`;
    };

    const getPriceDisplay = (car: Car | null | undefined) => {
        if (!car) return '—';
        if (!car.price || car.price <= 0) {
            return 'Price on Request';
        }
        return `₹ ${formatPriceLakh(car.price)} L`;
    };

    // Compare Car A & Car B selectors
    const carA = compareInventory.find(c => c.id === carAId);
    const carB = compareInventory.find(c => c.id === carBId);

    return (
        <div className="w-full flex flex-col">
            {/* Inline Styles for Brand Scrolling Marquee */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes marquee {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    display: flex;
                    width: max-content;
                    animation: marquee 25s linear infinite;
                }
                .animate-marquee:hover {
                    animation-play-state: paused;
                }
            `}} />

            {/* Hero Section — split layout */}
            <section className="relative overflow-hidden w-full bg-primary">
                {/* Premium Background image with gradient overlay */}
                <div className="absolute inset-0 z-0 select-none pointer-events-none">
                    <img
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1XK2L7EpsFR7K_eosnwu-nObzshJ1Ty2a8myYaJLGxNfVRumnjS7qbstQgmr0orhubbj2qWZONaSEPe_N7kcPM_1QfK25z_ISQyqhepk7R2dKxgZkvCaLxu1sknYBEuc8ql5XtjjvTxpkgGtcvcz9YskEEhJWegVcLP20ML2BowuulsKcxPJys4ux6Vi6vSqWwbUnsgtemZ2KMzcaeJsz8ZDBvA8U6qYDVmNQ5ksSaho1Svizzl2FUtSrad_4n_fgXjaKl4oo-CEH"
                        alt=""
                        className="w-full h-full object-cover opacity-20 sm:opacity-25"
                    />
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary via-primary/95 to-primary/80" />
                </div>

                <div className="relative z-10 container-main">
                    <div className="grid lg:grid-cols-2 gap-8 items-center min-h-[32.5rem] py-12 lg:py-20">
                        {/* Left — copy + search */}
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-[11px] font-bold uppercase tracking-widest mb-6">
                                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                Effortless Luxury Discovery
                            </div>

                            <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-black text-white leading-[1.08] tracking-tight font-display mb-5">
                                Discover Your<br />
                                <span className="font-serif-italic font-normal text-amber-400">Dream Ride,</span><br />
                                <span className="text-accent">Effortlessly.</span>
                            </h1>

                            <p className="text-base text-slate-400 max-w-md leading-relaxed mb-8">
                                Experience the freedom of the open road with our meticulously curated collection of premium certified vehicles. Your next adventure starts here.
                            </p>

                            {/* Search filters */}
                            <div className="bg-white rounded-2xl p-5 shadow-xl max-w-lg">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Budget Range</label>
                                        <select value={selectedFilters.budget} onChange={e => setSelectedFilters(p => ({...p, budget: e.target.value}))} className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary font-medium outline-none focus:ring-2 focus:ring-primary/10 appearance-none cursor-pointer">
                                            <option value="">Any Budget</option>
                                            <option value="under5">Under ₹5L</option>
                                            <option value="5to10">₹5L - ₹10L</option>
                                            <option value="10to20">₹10L - ₹20L</option>
                                            <option value="20plus">₹20L+</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Preferred Brand</label>
                                        <select value={selectedFilters.brand} onChange={e => setSelectedFilters(p => ({...p, brand: e.target.value}))} className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary font-medium outline-none focus:ring-2 focus:ring-primary/10 appearance-none cursor-pointer">
                                            <option value="">All Brands</option>
                                            {brands.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Model Year</label>
                                        <select value={selectedFilters.year} onChange={e => setSelectedFilters(p => ({...p, year: e.target.value}))} className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary font-medium outline-none focus:ring-2 focus:ring-primary/10 appearance-none cursor-pointer">
                                            <option value="">Any Year</option>
                                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                    <Link to="/inventory" className="text-xs font-semibold text-slate-500 hover:text-primary flex items-center gap-1 transition-colors">
                                        <span className="material-symbols-outlined text-sm">tune</span> Advanced Filters
                                    </Link>
                                    <button onClick={() => {
                                        const query = new URLSearchParams();
                                        if (selectedFilters.budget) query.append('budget', selectedFilters.budget);
                                        if (selectedFilters.brand) query.append('make', selectedFilters.brand);
                                        if (selectedFilters.year) query.append('year', selectedFilters.year);
                                        navigate(`/inventory?${query.toString()}`);
                                    }} className="inline-flex items-center justify-center gap-2 h-10 px-6 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary-light transition-all shadow-sm cursor-pointer border-none w-full sm:w-auto">
                                        <span className="material-symbols-outlined text-lg">search</span> Explore
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Right — car images */}
                        <div className="hidden lg:flex flex-col gap-4 items-end relative">
                            <div className="rounded-2xl overflow-hidden shadow-2xl w-full max-w-md aspect-[4/3]">
                                <img
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1XK2L7EpsFR7K_eosnwu-nObzshJ1Ty2a8myYaJLGxNfVRumnjS7qbstQgmr0orhubbj2qWZONaSEPe_N7kcPM_1QfK25z_ISQyqhepk7R2dKxgZkvCaLxu1sknYBEuc8ql5XtjjvTxpkgGtcvcz9YskEEhJWegVcLP20ML2BowuulsKcxPJys4ux6Vi6vSqWwbUnsgtemZ2KMzcaeJsz8ZDBvA8U6qYDVmNQ5ksSaho1Svizzl2FUtSrad_4n_fgXjaKl4oo-CEH"
                                    alt="Premium luxury car"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            {/* Secondary card below */}
                            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 w-full max-w-md">
                                <div className="size-20 rounded-xl overflow-hidden shrink-0">
                                    <img
                                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuAicROhp9Gf-xzl-F5bNh2DjhBvVjM0t7ucbZNljF7upz9rq-p_8ljMdlqSRXmjZxsHOjtv1vWKs0kT2eRkFpLeiVdeTU8gymd2DLYq1bpuInOt9hJ0FZS7-g-ezBysRMoUzjGsZGYiSggig69oaBm7r_EuJjqTACUVFkzJnfBp42eh4UhYn_xfstqiAmf_tJom5VsITEASM1Kk8hW62SLGl-qS58ebghm-p7UQV73CYWsT-4qFxseupM2iWsPL6uMYT34NG4TMH1-X"
                                        alt="Performance car"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Curated Arrivals</span>
                                    <h3 className="text-white font-bold font-display text-lg leading-tight mt-1">Drive Beyond Boundaries</h3>
                                    <p className="text-white/60 text-xs mt-1">Premium Performance Series</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trust Badges */}
            <section className="py-10 bg-white border-b border-slate-100 w-full">
                <div className="container-main">
                    <div className="flex sm:grid sm:grid-cols-3 gap-6 overflow-x-auto pb-4 sm:pb-0 scrollbar-none px-4 -mx-4 sm:px-0 sm:mx-0 snap-x snap-mandatory">
                        {TRUST_BADGES.map(f => (
                            <div key={f.title} className="flex flex-col items-center text-center gap-3 group cursor-default min-w-[75%] sm:min-w-0 snap-center bg-slate-50/50 sm:bg-transparent p-5 sm:p-0 rounded-2xl border border-slate-100 sm:border-0 shadow-sm sm:shadow-none">
                                <div className="size-14 rounded-2xl bg-white sm:bg-slate-50 flex items-center justify-center text-accent shadow-sm border border-slate-100 group-hover:bg-accent group-hover:text-primary transition-all duration-300">
                                    <span className="material-symbols-outlined text-2xl">{f.icon}</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-primary text-sm mb-0.5 font-display">{f.title}</h3>
                                    <p className="text-[11px] text-slate-400 font-medium">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Brand Logo Marquee Carousel */}
            <section className="py-6 bg-white border-b border-slate-100 overflow-hidden w-full select-none">
                <div className="relative w-full flex overflow-x-hidden">
                    <div className="animate-marquee whitespace-nowrap flex items-center gap-12 sm:gap-20">
                        {BRAND_LOGOS.map((brand, idx) => (
                            <div key={`brand-1-${idx}`} className="flex items-center gap-4 cursor-pointer group">
                                <div className="transition-transform duration-300 group-hover:scale-110 flex items-center justify-center h-10 w-16 shrink-0">
                                    {brand.name === 'Kia' ? (
                                        <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-9 w-full object-contain filter drop-shadow-sm fill-slate-400 group-hover:fill-primary transition-colors">
                                            <title>Kia</title>
                                            <path d="M13.923 14.175c0 .046.015.072.041.072a.123.123 0 0 0 .058-.024l7.48-4.854a.72.72 0 0 1 .432-.13h1.644c.252 0 .422.168.422.42v3.139c0 .38-.084.6-.42.801l-1.994 1.2a.137.137 0 0 1-.067.024c-.024 0-.048-.019-.048-.088v-3.663c0-.043-.012-.071-.041-.071a.113.113 0 0 0-.058.024l-5.466 3.551a.733.733 0 0 1-.42.127h-3.624c-.254 0-.422-.168-.422-.422V9.757c0-.033-.015-.064-.044-.064a.118.118 0 0 0-.057.024L7.732 11.88c-.036.024-.046.041-.046.058 0 .014.008.029.032.055l2.577 2.575c.034.034.058.06.058.089 0 .024-.039.043-.084.043H7.94c-.183 0-.324-.026-.423-.125l-1.562-1.56a.067.067 0 0 0-.048-.024.103.103 0 0 0-.048.015l-2.61 1.57a.72.72 0 0 1-.423.122H.425C.168 14.7 0 14.53 0 14.279v-3.08c0-.38.084-.6.422-.8L2.43 9.192a.103.103 0 0 1 .052-.016c.032 0 .048.03.048.1V13.4c0 .043.01.063.041.063a.144.144 0 0 0 .06-.024L9.407 9.36a.733.733 0 0 1 .446-.124h3.648c.252 0 .422.168.422.42l-.002 4.518z"/>
                                        </svg>
                                    ) : (
                                        <img 
                                            src={brand.logo} 
                                            alt={brand.name} 
                                            className="h-9 w-full object-contain filter drop-shadow-sm" 
                                            loading="lazy"
                                        />
                                    )}
                                </div>
                                <span className="text-[11.5px] font-bold font-display tracking-widest text-slate-500 group-hover:text-primary transition-colors uppercase">
                                    {brand.name}
                                </span>
                            </div>
                        ))}
                        {BRAND_LOGOS.map((brand, idx) => (
                            <div key={`brand-2-${idx}`} className="flex items-center gap-4 cursor-pointer group">
                                <div className="transition-transform duration-300 group-hover:scale-110 flex items-center justify-center h-10 w-16 shrink-0">
                                    {brand.name === 'Kia' ? (
                                        <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-9 w-full object-contain filter drop-shadow-sm fill-slate-400 group-hover:fill-primary transition-colors">
                                            <title>Kia</title>
                                            <path d="M13.923 14.175c0 .046.015.072.041.072a.123.123 0 0 0 .058-.024l7.48-4.854a.72.72 0 0 1 .432-.13h1.644c.252 0 .422.168.422.42v3.139c0 .38-.084.6-.42.801l-1.994 1.2a.137.137 0 0 1-.067.024c-.024 0-.048-.019-.048-.088v-3.663c0-.043-.012-.071-.041-.071a.113.113 0 0 0-.058.024l-5.466 3.551a.733.733 0 0 1-.42.127h-3.624c-.254 0-.422-.168-.422-.422V9.757c0-.033-.015-.064-.044-.064a.118.118 0 0 0-.057.024L7.732 11.88c-.036.024-.046.041-.046.058 0 .014.008.029.032.055l2.577 2.575c.034.034.058.06.058.089 0 .024-.039.043-.084.043H7.94c-.183 0-.324-.026-.423-.125l-1.562-1.56a.067.067 0 0 0-.048-.024.103.103 0 0 0-.048.015l-2.61 1.57a.72.72 0 0 1-.423.122H.425C.168 14.7 0 14.53 0 14.279v-3.08c0-.38.084-.6.422-.8L2.43 9.192a.103.103 0 0 1 .052-.016c.032 0 .048.03.048.1V13.4c0 .043.01.063.041.063a.144.144 0 0 0 .06-.024L9.407 9.36a.733.733 0 0 1 .446-.124h3.648c.252 0 .422.168.422.42l-.002 4.518z"/>
                                        </svg>
                                    ) : (
                                        <img 
                                            src={brand.logo} 
                                            alt={brand.name} 
                                            className="h-9 w-full object-contain filter drop-shadow-sm" 
                                            loading="lazy"
                                        />
                                    )}
                                </div>
                                <span className="text-[11.5px] font-bold font-display tracking-widest text-slate-500 group-hover:text-primary transition-colors uppercase">
                                    {brand.name}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>


            {/* Fresh Arrivals */}
            <section className="py-16 w-full bg-slate-50">
                <div className="container-main">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
                        <div>
                            <h2 className="text-3xl lg:text-4xl font-black text-primary font-display tracking-tight mb-2">Fresh <span className="font-serif-italic font-normal text-amber-600">Arrivals</span></h2>
                            <p className="text-slate-500 font-medium text-sm">Hand-picked luxury vehicles newly added to our showroom.</p>
                        </div>
                        <Link to="/inventory" className="group inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-accent transition-colors whitespace-nowrap">
                            Explore Entire Collection
                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>

                    <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-5 overflow-x-auto pb-6 sm:pb-0 scrollbar-none px-4 -mx-4 sm:px-0 sm:mx-0 snap-x snap-mandatory">
                        {loading ? (
                            <div className="col-span-1 sm:col-span-2 lg:col-span-4 text-center py-10 text-slate-400 w-full">Loading newest arrivals...</div>
                        ) : error ? (
                            <div className="col-span-1 sm:col-span-2 lg:col-span-4 text-center py-10 w-full">
                                <span className="material-symbols-outlined text-red-400 text-4xl mb-2">error</span>
                                <p className="text-slate-500 font-medium">Failed to load inventory.</p>
                                <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100">Try Again</button>
                            </div>
                        ) : cars.length === 0 ? (
                            <div className="col-span-1 sm:col-span-2 lg:col-span-4 text-center py-10 text-slate-400 w-full">No vehicles have been added recently.</div>
                        ) : cars.map((car) => {
                            const isSaved = wishlist.includes(car.id);
                            const inCart = isInCart(car.id);
                            return (
                                <article key={car.id} className="min-w-[85%] sm:min-w-0 snap-center bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all duration-300 group flex flex-col relative">
                                    <Link to={`/car/${car.id}`} className="flex flex-col flex-1">
                                        <div className="relative aspect-[16/11] overflow-hidden bg-slate-100">
                                            <img alt={`${car.make} ${car.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src={getPrimaryImage(car.images)} />
                                            {car.condition === 'Excellent' && (
                                                <div className="absolute top-3 left-3 bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-sm">
                                                    Certified
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 flex flex-col flex-1">
                                            <h3 className="text-sm font-bold text-primary font-display mb-2 truncate" title={`${car.year} ${car.make} ${car.model}`}>
                                                {car.year} {car.make} {car.model}
                                            </h3>

                                            {/* Specs row */}
                                            <div className="flex items-center gap-3 mb-2 text-[11px] text-slate-500">
                                                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">settings</span>{car.transmission}</span>
                                                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">local_gas_station</span>{car.fuel_type}</span>
                                            </div>

                                            {/* Secondary info */}
                                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-3">
                                                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">speed</span>{(car.mileage || 0).toLocaleString()} km</span>
                                            </div>
                                        </div>
                                    </Link>

                                    {/* Action buttons on image */}
                                    <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                                        <button 
                                            title={inCart ? "Remove from Cart" : "Add to Inquiry Cart"}
                                            className={`p-2 rounded-full transition-colors shadow-sm backdrop-blur-md active:scale-95 ${inCart ? 'bg-amber-500 text-white' : 'bg-white/90 text-slate-600 hover:text-amber-600'}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (inCart) {
                                                    removeFromCart(car.id);
                                                } else {
                                                    addToCart(car);
                                                }
                                            }}
                                        >
                                            <span className="material-symbols-outlined text-[16px] block">
                                                {inCart ? 'check' : 'add_shopping_cart'}
                                            </span>
                                        </button>

                                        <button 
                                            className={`p-2 bg-white/90 rounded-full transition-colors shadow-sm backdrop-blur-md active:scale-95 ${isSaved ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}
                                            onClick={(e) => toggleWishlist(e, car.id)}
                                            aria-label="Wishlist"
                                        >
                                            <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} />
                                        </button>
                                    </div>

                                    <div className="p-4 pt-0 mt-auto">
                                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                            <div>
                                                <span className="text-[9px] text-slate-400 font-bold uppercase">Price</span>
                                                <p className="text-lg font-black text-primary font-display tabular-nums">₹ {formatPriceLakh(car.price)} L</p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <a
                                                    href={`https://wa.me/919373721705?text=${encodeURIComponent(`Hi New Maharashtra Motors, I am interested in this car: ${car.year} ${car.make} ${car.model} (₹${formatPriceLakh(car.price)} Lakh)`)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="size-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-colors active:scale-95"
                                                    title="WhatsApp Inquiry"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">chat</span>
                                                </a>
                                                <Link to={`/car/${car.id}`} className="inline-flex items-center gap-1 bg-accent/10 hover:bg-accent text-accent hover:text-primary px-3 py-2 rounded-lg text-xs font-bold transition-all active:scale-95">
                                                    View <span className="material-symbols-outlined text-sm">arrow_outward</span>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Happy Customers / Car Delivery Celebrations Carousel */}
            <HappyCustomersCarousel />

            {/* Deal of the Week Spotlight */}
            {dealCar && (
                <section className="py-16 w-full bg-slate-900 text-white relative overflow-hidden">
                    {/* Background glows */}
                    <div className="absolute top-1/4 -right-1/4 size-[30rem] rounded-full bg-accent/5 blur-[100px] pointer-events-none" />
                    <div className="absolute bottom-1/4 -left-1/4 size-[30rem] rounded-full bg-white/5 blur-[100px] pointer-events-none" />

                    <div className="container-main relative z-10">
                        <div className="border border-white/10 rounded-3xl p-6 sm:p-10 lg:p-12 bg-white/[0.02] backdrop-blur-xl relative overflow-hidden shadow-2xl">
                            {/* Accent line */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-amber-400 to-accent" />
                            
                            <div className="grid lg:grid-cols-12 gap-8 items-center">
                                {/* Copy details */}
                                <div className="lg:col-span-5 flex flex-col items-start">
                                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent text-primary text-[10px] font-black uppercase tracking-wider mb-5">
                                        <Sparkles size={12} /> Deal of the Week
                                    </span>

                                    <h2 className="text-3xl sm:text-4xl font-black font-display tracking-tight text-white mb-2">
                                        {dealCar.year} {dealCar.make} <span className="font-serif-italic font-normal text-amber-400">{dealCar.model}</span>
                                    </h2>
                                    <p className="text-slate-400 text-xs sm:text-sm mb-6 uppercase tracking-wider font-bold">
                                        {dealCar.fuel_type} • {dealCar.transmission} • {(dealCar.mileage || 0).toLocaleString()} km
                                    </p>

                                    {/* Timer display */}
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 w-full mb-6">
                                        <span className="text-[10px] text-accent font-bold uppercase tracking-wider block mb-1">Time Remaining</span>
                                        <div className="font-display font-black text-2xl sm:text-3xl text-white tracking-wider font-mono tabular-nums">
                                            {dealTimer || 'Calculating...'}
                                        </div>
                                    </div>

                                    {/* Price and dynamic discount */}
                                    <div className="flex items-center gap-6 mb-8 w-full border-t border-b border-white/5 py-4">
                                        <div>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Special Price</span>
                                            <span className="text-3xl font-black text-accent font-display tabular-nums">₹ {formatPriceLakh(dealCar.price)} L</span>
                                        </div>
                                        {dealCar.original_price && dealCar.original_price > dealCar.price && (
                                            <div>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Original Price</span>
                                                <span className="text-lg text-slate-400 font-bold line-through">₹ {formatPriceLakh(dealCar.original_price)} L</span>
                                            </div>
                                        )}
                                        <div className="ml-auto bg-green-500/15 border border-green-500/30 text-green-400 text-[10px] sm:text-xs font-black uppercase px-3 py-1.5 rounded-lg">
                                            Save ₹{dealDiscount.toLocaleString('en-IN')}
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex flex-col sm:flex-row gap-3 w-full">
                                        <button 
                                            onClick={() => setShowReserveModal(true)}
                                            className="flex-1 h-12 bg-accent hover:bg-accent-hover text-primary font-black rounded-xl text-sm transition-all shadow-md shadow-accent/15 cursor-pointer flex items-center justify-center gap-2"
                                        >
                                            <Landmark size={16} /> Reserve for ₹10,000
                                        </button>
                                        <Link 
                                            to={`/book-test-drive?car=${dealCar.id}`}
                                            className="flex-1 h-12 border border-white/20 hover:bg-white/5 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                                        >
                                            Book Test Drive
                                        </Link>
                                    </div>
                                </div>

                                {/* Main graphic */}
                                <div className="lg:col-span-7 aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden bg-slate-800 border border-white/5 relative group">
                                    <img 
                                        src={getPrimaryImage(dealCar.images)} 
                                        alt={dealCar.model}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                                    />
                                    {/* Overlay details */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                                    <div className="absolute bottom-5 left-5 right-5 flex justify-between items-end">
                                        <div>
                                            <span className="text-[10px] text-accent font-bold uppercase tracking-wider block mb-1"> NMM Certified Pre-Owned</span>
                                            <h4 className="text-white text-lg font-black font-display leading-tight">{dealCar.make} {dealCar.model} {dealCar.condition}</h4>
                                        </div>
                                        <Link 
                                            to={`/car/${dealCar.id}`}
                                            className="size-10 bg-white/10 hover:bg-accent hover:text-primary rounded-xl flex items-center justify-center text-white transition-all backdrop-blur-md"
                                        >
                                            <ChevronRight size={20} />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Split Page Block: Matchmaker Quiz & Quick Compare */}
            <section className="py-16 bg-slate-50 border-t border-slate-100 w-full">
                <div className="container-main flex justify-center">
                    <div className="w-full max-w-2xl">
                        
                        {/* 2. Quick Specs Compare */}
                        <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-[var(--shadow-card)] flex flex-col">
                            <div className="mb-6">
                                <span className="inline-flex items-center gap-1 text-[10px] text-accent font-bold uppercase tracking-wider mb-2">
                                    <ChevronRight size={10} /> Quick Compare
                                </span>
                                <h3 className="text-xl font-bold text-primary font-display">Side-by-Side <span className="font-serif-italic font-normal text-amber-600">Specs</span></h3>
                                <p className="text-xs text-slate-400 mt-1">Select two cars to compare at a glance.</p>
                            </div>

                            {compareInventory.length < 2 ? (
                                <div className="flex-1 flex items-center justify-center text-slate-400 text-xs text-center py-10">
                                    Not enough cars in inventory to compare.
                                </div>
                            ) : (
                                <>
                                    {/* Thumbnail Image Previews */}
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner flex items-center justify-center relative">
                                            {carA ? (
                                                <img 
                                                    src={getPrimaryImage(carA.images)} 
                                                    alt={`${carA.make} ${carA.model}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-slate-400 text-xs font-semibold">No Image</span>
                                            )}
                                        </div>
                                        <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner flex items-center justify-center relative">
                                            {carB ? (
                                                <img 
                                                    src={getPrimaryImage(carB.images)} 
                                                    alt={`${carB.make} ${carB.model}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-slate-400 text-xs font-semibold">No Image</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Selectors */}
                                    <div className="grid grid-cols-2 gap-3 mb-5">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Car A</label>
                                            <select
                                                value={carAId}
                                                onChange={e => setCarAId(e.target.value)}
                                                className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-xs text-primary font-semibold outline-none focus:ring-2 focus:ring-primary/10 appearance-none cursor-pointer"
                                            >
                                                {compareInventory.map(c => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.year} {c.make} {c.model} - {c.price && c.price > 0 ? `₹${formatPriceLakh(c.price)} L` : 'Price on Request'}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Car B</label>
                                            <select
                                                value={carBId}
                                                onChange={e => setCarBId(e.target.value)}
                                                className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-xs text-primary font-semibold outline-none focus:ring-2 focus:ring-primary/10 appearance-none cursor-pointer"
                                            >
                                                {compareInventory.map(c => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.year} {c.make} {c.model} - {c.price && c.price > 0 ? `₹${formatPriceLakh(c.price)} L` : 'Price on Request'}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Comparison rows */}
                                    <div className="flex-1 mb-5 border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30 p-2">
                                        {[
                                            { 
                                                label: 'Transmission', 
                                                valA: carA?.transmission || '—', 
                                                valB: carB?.transmission || '—',
                                                isDifferent: carA && carB && carA.transmission !== carB.transmission,
                                                highlightA: false,
                                                highlightB: false
                                            },
                                            { 
                                                label: 'Fuel Type', 
                                                valA: carA?.fuel_type || '—', 
                                                valB: carB?.fuel_type || '—',
                                                isDifferent: carA && carB && carA.fuel_type !== carB.fuel_type,
                                                highlightA: false,
                                                highlightB: false
                                            },
                                            { 
                                                label: 'Mileage', 
                                                valA: getMileageDisplay(carA), 
                                                valB: getMileageDisplay(carB),
                                                isDifferent: carA && carB && carA.mileage !== carB.mileage,
                                                highlightA: carA && carB && (carA.mileage || 0) < (carB.mileage || 0) && (carA.mileage > 0 && carB.mileage > 0),
                                                highlightB: carA && carB && (carB.mileage || 0) < (carA.mileage || 0) && (carA.mileage > 0 && carB.mileage > 0)
                                            },
                                            { 
                                                label: 'Condition', 
                                                valA: carA?.condition || '—', 
                                                valB: carB?.condition || '—',
                                                isDifferent: carA && carB && carA.condition !== carB.condition,
                                                highlightA: false,
                                                highlightB: false
                                            },
                                            { 
                                                label: 'Price', 
                                                valA: getPriceDisplay(carA), 
                                                valB: getPriceDisplay(carB),
                                                isDifferent: carA && carB && carA.price !== carB.price,
                                                highlightA: carA && carB && (carA.price || 0) < (carB.price || 0) && (carA.price > 0 && carB.price > 0),
                                                highlightB: carA && carB && (carB.price || 0) < (carA.price || 0) && (carA.price > 0 && carB.price > 0)
                                            },
                                        ].map(row => (
                                            <div key={row.label} className="grid grid-cols-[2fr_1.2fr_2fr] gap-2 items-center text-xs py-3.5 px-3 border-b border-slate-100 last:border-b-0 w-full">
                                                <span className={`font-semibold text-right transition-all px-2 py-0.5 rounded-lg ${row.highlightA ? 'text-emerald-600 bg-emerald-50/50 border border-emerald-100/50 font-bold' : row.isDifferent ? 'text-amber-600 bg-amber-50/50 border border-amber-100/30' : 'text-slate-700'}`}>{row.valA}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase text-center px-1 shrink-0">{row.label}</span>
                                                <span className={`font-semibold text-left transition-all px-2 py-0.5 rounded-lg ${row.highlightB ? 'text-emerald-600 bg-emerald-50/50 border border-emerald-100/50 font-bold' : row.isDifferent ? 'text-amber-600 bg-amber-50/50 border border-amber-100/30' : 'text-slate-700'}`}>{row.valB}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Validation Warning */}
                                    {carAId === carBId && (
                                        <div className="mb-5 p-3 bg-amber-50 border border-amber-200/60 text-amber-800 text-xs font-semibold rounded-2xl flex items-center gap-2 justify-center">
                                            <span className="material-symbols-outlined text-base">warning</span>
                                            Please select two different cars to compare.
                                        </div>
                                    )}

                                    {/* CTA */}
                                    <button
                                        onClick={() => navigate(`/compare?carA=${carAId}&carB=${carBId}`)}
                                        disabled={!carAId || !carBId || carAId === carBId}
                                        className="w-full h-11 bg-primary hover:bg-primary-light disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer border-none"
                                    >
                                        Compare Detailed Specs <ArrowRight size={14} />
                                    </button>
                                </>
                            )}
                        </div>

                    </div>
                </div>
            </section>

            {/* Body Type Filter Scroll */}
            <section className="py-12 bg-white border-t border-slate-100 w-full">
                <div className="container-main">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-3">
                        <div>
                            <h2 className="text-2xl font-black text-primary font-display tracking-tight">Browse by <span className="font-serif-italic font-normal text-amber-600">Body Type</span></h2>
                            <p className="text-sm text-slate-500 mt-0.5">Find your perfect shape</p>
                        </div>
                        <Link to="/inventory" className="text-xs font-bold text-primary hover:text-accent transition-colors flex items-center gap-1">
                            View All <ArrowRight size={12} />
                        </Link>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none px-1 -mx-1 snap-x snap-mandatory">
                        {BODY_TYPE_FILTERS.filter(f => f.value !== '').map(f => (
                            <button
                                key={f.value}
                                onClick={() => navigate(`/inventory?body_type=${f.value}`)}
                                className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-accent/5 border border-slate-100 hover:border-accent/30 rounded-2xl transition-all group cursor-pointer shrink-0 min-w-[90px]"
                            >
                                <div className="text-slate-600 group-hover:text-accent transition-colors">
                                    {renderBodyTypeIcon(f.value)}
                                </div>
                                <span className="text-[11px] font-bold text-slate-600 group-hover:text-accent transition-colors">{f.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Deal of the Week Reservation Modal */}

            {showReserveModal && dealCar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowReserveModal(false)}>
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 flex flex-col gap-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-primary font-display">Hold this Vehicle</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Enter details to initiate your ₹10,000 reservation intent.</p>
                            </div>
                            <button onClick={() => setShowReserveModal(false)} className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors shrink-0">
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>

                        {reserveSuccess ? (
                            <div className="text-center py-6 flex flex-col items-center">
                                <div className="size-16 rounded-full bg-green-50 text-green-500 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-4xl">check_circle</span>
                                </div>
                                <h3 className="text-xl font-bold text-primary font-display mb-2">Reservation Initiated!</h3>
                                <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                                    Thank you, <strong className="text-primary">{reserveForm.full_name}</strong>. We have logged your request. One of our sales team managers will contact you at <strong className="text-primary">{reserveForm.phone}</strong> within 30 minutes to explain the ₹10,000 reservation hold and documentation transfer.
                                </p>
                                <button
                                    onClick={() => {
                                        setShowReserveModal(false);
                                        setReserveSuccess(false);
                                        setReserveForm({ full_name: '', phone: '', email: '' });
                                    }}
                                    className="mt-6 w-full h-11 bg-primary text-white font-bold rounded-xl text-xs hover:bg-primary-light transition-all cursor-pointer border-none"
                                >
                                    Done
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleReservation} className="flex flex-col gap-4">
                                {/* Vehicle Summary card */}
                                <div className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div className="size-14 rounded-lg overflow-hidden bg-slate-200 shrink-0">
                                        <img src={getPrimaryImage(dealCar.images)} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-primary font-display leading-tight">{dealCar.year} {dealCar.make} {dealCar.model}</h4>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{dealCar.transmission} • {dealCar.fuel_type}</p>
                                        <p className="text-xs font-black text-accent mt-0.5">₹ {formatPriceLakh(dealCar.price)} Lakh</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Full Name *</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={reserveForm.full_name}
                                            onChange={e => setReserveForm(p => ({...p, full_name: e.target.value}))}
                                            className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-accent/15"
                                            placeholder="Enter your name"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Phone Number *</label>
                                        <input 
                                            type="tel" 
                                            required
                                            value={reserveForm.phone}
                                            onChange={e => setReserveForm(p => ({...p, phone: e.target.value}))}
                                            className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-accent/15"
                                            placeholder="Enter 10-digit number"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Email Address (Optional)</label>
                                        <input 
                                            type="email" 
                                            value={reserveForm.email}
                                            onChange={e => setReserveForm(p => ({...p, email: e.target.value}))}
                                            className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-accent/15"
                                            placeholder="name@example.com"
                                        />
                                    </div>
                                </div>

                                {reserveError && (
                                    <div className="text-[10px] text-red-500 font-bold bg-red-50 p-2.5 rounded-lg">
                                        {reserveError}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={reserveLoading}
                                    className="w-full h-11 bg-primary disabled:bg-slate-200 text-white font-bold rounded-xl text-xs hover:bg-primary-light transition-all flex items-center justify-center cursor-pointer border-none shadow-sm"
                                >
                                    {reserveLoading ? 'Submitting request...' : 'Confirm Reservation Intent'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;
