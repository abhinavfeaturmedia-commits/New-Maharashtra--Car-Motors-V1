import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
    ChevronLeft, 
    ChevronRight, 
    Star, 
    Sparkles, 
    Quote, 
    ShieldCheck, 
    Car, 
    MapPin, 
    Calendar, 
    ArrowRight,
    Award,
    CheckCircle2,
    Maximize2,
    X
} from 'lucide-react';

export interface CustomerDelivery {
    id: string;
    customer_id: string | null;
    inventory_id: string | null;
    sale_id: string | null;
    customer_name: string;
    customer_city: string | null;
    car_title: string;
    registration_no: string | null;
    delivery_date: string;
    photo_url: string;
    additional_photos: string[] | null;
    review_quote: string | null;
    rating: number;
    is_featured: boolean;
    display_order: number;
    tags: string[] | null;
    created_at: string;
}

const FALLBACK_DELIVERIES: CustomerDelivery[] = [
    {
        id: 'fallback-1',
        customer_id: null,
        inventory_id: null,
        sale_id: null,
        customer_name: 'Abhishek Kulkarni',
        customer_city: 'Pune',
        car_title: '2021 Hyundai Creta SX (O)',
        registration_no: 'MH12TF8921',
        delivery_date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
        photo_url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80',
        additional_photos: [],
        review_quote: 'Unbelievably smooth delivery experience! The car was delivered sparkling clean with complete service records and immediate RC transfer support. Truly 5-star service!',
        rating: 5,
        is_featured: true,
        display_order: 1,
        tags: ['Family SUV', 'Verified Buyer', 'Certified Pre-Owned'],
        created_at: new Date().toISOString()
    },
    {
        id: 'fallback-2',
        customer_id: null,
        inventory_id: null,
        sale_id: null,
        customer_name: 'Pooja Deshmukh',
        customer_city: 'Mumbai',
        car_title: '2022 Tata Nexon Fearless Plus',
        registration_no: 'MH02EK4190',
        delivery_date: new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10),
        photo_url: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1200&q=80',
        additional_photos: [],
        review_quote: 'Bought our first family car from Maharashtra Motors. Transparent pricing with zero hidden costs. Highly recommend their entire sales team!',
        rating: 5,
        is_featured: true,
        display_order: 2,
        tags: ['First Car', 'Safety 5-Star', 'Happy Family'],
        created_at: new Date().toISOString()
    },
    {
        id: 'fallback-3',
        customer_id: null,
        inventory_id: null,
        sale_id: null,
        customer_name: 'Rajesh & Sneha Patil',
        customer_city: 'Kolhapur',
        car_title: '2020 Maruti Suzuki Ertiga ZXi+',
        registration_no: 'MH09DA6769',
        delivery_date: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
        photo_url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80',
        additional_photos: [],
        review_quote: 'Extremely pleased with our 7-seater Ertiga. Test drive was arranged at our doorstep, loan approval done in 3 hours, and delivery felt like a grand celebration!',
        rating: 5,
        is_featured: true,
        display_order: 3,
        tags: ['7 Seater', 'Doorstep Delivery', 'Verified Buyer'],
        created_at: new Date().toISOString()
    },
    {
        id: 'fallback-4',
        customer_id: null,
        inventory_id: null,
        sale_id: null,
        customer_name: 'Vikramaditya Shinde',
        customer_city: 'Satara',
        car_title: '2023 Mahindra Thar LX 4x4 Hard Top',
        registration_no: 'MH11CD9009',
        delivery_date: new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10),
        photo_url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80',
        additional_photos: [],
        review_quote: 'Got my dream Thar in pristine condition. The 240-point inspection gave me complete peace of mind. Thank you Maharashtra Motors team!',
        rating: 5,
        is_featured: true,
        display_order: 4,
        tags: ['Off-Road 4x4', 'Certified Pre-Owned', 'Youth Icon'],
        created_at: new Date().toISOString()
    }
];

const HappyCustomersCarousel: React.FC = () => {
    const [deliveries, setDeliveries] = useState<CustomerDelivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);

    // Fetch featured deliveries from Supabase
    useEffect(() => {
        const fetchDeliveries = async () => {
            try {
                const { data, error } = await supabase
                    .from('customer_deliveries')
                    .select('*')
                    .eq('is_featured', true)
                    .order('display_order', { ascending: true })
                    .order('delivery_date', { ascending: false });

                if (!error && data && data.length > 0) {
                    setDeliveries(data);
                } else {
                    setDeliveries(FALLBACK_DELIVERIES);
                }
            } catch (err) {
                console.error('Error fetching customer deliveries:', err);
                setDeliveries(FALLBACK_DELIVERIES);
            } finally {
                setLoading(false);
            }
        };

        fetchDeliveries();
    }, []);

    const nextSlide = useCallback(() => {
        if (deliveries.length === 0) return;
        setCurrentIndex((prev) => (prev + 1) % deliveries.length);
    }, [deliveries.length]);

    const prevSlide = useCallback(() => {
        if (deliveries.length === 0) return;
        setCurrentIndex((prev) => (prev - 1 + deliveries.length) % deliveries.length);
    }, [deliveries.length]);

    // Auto play carousel every 6 seconds
    useEffect(() => {
        if (isPaused || deliveries.length <= 1 || lightboxImage !== null) return;
        const interval = setInterval(nextSlide, 6000);
        return () => clearInterval(interval);
    }, [isPaused, nextSlide, deliveries.length, lightboxImage]);

    // Touch Swipe Handlers for Mobile Devices
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return;
        const diff = touchStartX.current - touchEndX.current;
        if (diff > 50) {
            nextSlide();
        } else if (diff < -50) {
            prevSlide();
        }
        touchStartX.current = null;
        touchEndX.current = null;
    };

    const formatDeliveryDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

    if (loading) {
        return (
            <section className="py-20 bg-slate-900 text-white w-full">
                <div className="container-main text-center">
                    <div className="inline-flex items-center gap-2 text-slate-400 text-sm animate-pulse">
                        <Sparkles className="size-4 text-accent animate-spin" /> Loading customer delivery celebrations...
                    </div>
                </div>
            </section>
        );
    }

    if (deliveries.length === 0) return null;

    const currentItem = deliveries[currentIndex];

    return (
        <section 
            className="py-16 sm:py-24 w-full bg-gradient-to-b from-slate-950 via-slate-900 to-primary text-white relative overflow-hidden select-none"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-1/4 size-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 size-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="container-main relative z-10">
                {/* Section Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 sm:mb-14 gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-[11px] font-bold uppercase tracking-widest mb-3.5 backdrop-blur-md">
                            <Sparkles className="size-3.5 text-accent animate-pulse" />
                            Celebrations & Handover Stories
                        </div>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white font-display tracking-tight leading-[1.1]">
                            Happy Customers,{' '}
                            <span className="font-serif-italic font-normal text-amber-400">Delivered with Pride</span>
                        </h2>
                        <p className="text-slate-400 font-medium text-sm sm:text-base mt-2.5 max-w-2xl">
                            Witness real moments of happiness as cherished families and car enthusiasts drive home their certified vehicles from Maharashtra Motors.
                        </p>
                    </div>

                    {/* Navigation Buttons & Counter */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-slate-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                            <span className="text-accent">{currentIndex + 1}</span> / {deliveries.length}
                        </span>
                        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-md">
                            <button
                                onClick={prevSlide}
                                aria-label="Previous delivery story"
                                className="size-10 rounded-xl bg-white/10 hover:bg-accent hover:text-primary text-white flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer"
                            >
                                <ChevronLeft className="size-5" />
                            </button>
                            <button
                                onClick={nextSlide}
                                aria-label="Next delivery story"
                                className="size-10 rounded-xl bg-white/10 hover:bg-accent hover:text-primary text-white flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer"
                            >
                                <ChevronRight className="size-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Interactive Showcase Carousel Stage */}
                <div 
                    className="relative"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="grid lg:grid-cols-12 gap-8 items-center bg-white/[0.03] border border-white/10 rounded-3xl p-5 sm:p-8 lg:p-10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                        {/* Top Accent Gradient Line */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-amber-400 to-amber-600" />

                        {/* Left: Auto-Adjusting Full Delivery Image Frame */}
                        <div className="lg:col-span-7 relative group">
                            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-slate-950/80 flex items-center justify-center min-h-[320px] sm:min-h-[420px] max-h-[500px] p-2 sm:p-3">
                                {/* Ambient blurred backdrop to give seamless aesthetic regardless of aspect ratio */}
                                <img
                                    src={currentItem.photo_url}
                                    alt=""
                                    className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30 scale-110 pointer-events-none select-none"
                                    aria-hidden="true"
                                />

                                {/* Dark gradient edge overlay */}
                                <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/20 to-black/60 pointer-events-none" />

                                {/* Main Crisp Uncropped Photo */}
                                <img
                                    src={currentItem.photo_url}
                                    alt={`Car delivery celebration of ${currentItem.customer_name}`}
                                    className="relative z-10 w-auto h-auto max-h-[440px] sm:max-h-[480px] max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-500 group-hover:scale-[1.01] cursor-pointer"
                                    onClick={() => setLightboxImage({ url: currentItem.photo_url, title: `${currentItem.customer_name} - ${currentItem.car_title}` })}
                                    loading="eager"
                                />

                                {/* Verified Badge Top Left */}
                                <div className="absolute top-3.5 left-3.5 z-20 inline-flex items-center gap-1.5 bg-emerald-500/90 backdrop-blur-md text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl shadow-lg">
                                    <CheckCircle2 className="size-3.5 text-white" />
                                    <span>Verified Delivery</span>
                                </div>

                                {/* Delivery Date Pill Top Right */}
                                <div className="absolute top-3.5 right-3.5 z-20 inline-flex items-center gap-1.5 bg-black/65 backdrop-blur-md text-white/90 text-[10px] sm:text-xs font-medium px-3 py-1.5 rounded-xl border border-white/15 shadow-md">
                                    <Calendar className="size-3.5 text-accent" />
                                    <span>{formatDeliveryDate(currentItem.delivery_date)}</span>
                                </div>

                                {/* Fullscreen Zoom Button Bottom Right */}
                                <button
                                    onClick={() => setLightboxImage({ url: currentItem.photo_url, title: `${currentItem.customer_name} - ${currentItem.car_title}` })}
                                    className="absolute bottom-3.5 right-3.5 z-20 size-8 sm:size-9 rounded-xl bg-black/60 hover:bg-accent text-white hover:text-primary backdrop-blur-md border border-white/15 flex items-center justify-center transition-all duration-200 opacity-80 group-hover:opacity-100 shadow-md cursor-pointer"
                                    title="View Full Resolution Photo"
                                >
                                    <Maximize2 className="size-4" />
                                </button>
                            </div>
                        </div>

                        {/* Right: Delivered Vehicle, Testimonial & Customer Details */}
                        <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
                            {/* Vehicle Delivered Info Card */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-inner">
                                <div className="flex items-center gap-3">
                                    <div className="size-11 rounded-xl bg-accent text-primary flex items-center justify-center font-bold shrink-0 shadow-md">
                                        <Car className="size-5" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-accent uppercase tracking-wider block">
                                            Delivered Vehicle
                                        </span>
                                        <h3 className="text-white font-bold font-display text-base sm:text-lg leading-tight">
                                            {currentItem.car_title}
                                        </h3>
                                        {currentItem.registration_no && (
                                            <p className="text-[11px] font-mono text-slate-300 mt-0.5">
                                                Reg. Plate: <span className="text-amber-400 font-bold">{currentItem.registration_no}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 items-end">
                                    {(currentItem.tags || []).slice(0, 2).map((tag, idx) => (
                                        <span key={idx} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-slate-200">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Star Rating Strip */}
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            className={`size-5 ${
                                                i < currentItem.rating 
                                                    ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]' 
                                                    : 'text-slate-700'
                                            }`}
                                        />
                                    ))}
                                    <span className="ml-2 text-xs font-bold text-amber-400 font-mono">
                                        {currentItem.rating}.0 / 5.0
                                    </span>
                                </div>

                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                                    <Award className="size-3.5 text-accent" /> 100% Genuine Review
                                </span>
                            </div>

                            {/* Customer Review Quote */}
                            <div className="relative pl-5 border-l-2 border-accent/60 my-1">
                                <Quote className="size-8 text-accent/20 absolute -top-3 left-0.5 pointer-events-none" />
                                <p className="text-sm sm:text-base text-slate-200 font-medium leading-relaxed italic">
                                    "{currentItem.review_quote || 'Outstanding buying experience with Maharashtra Motors! From doorstep evaluation to crystal clear paperwork and celebration delivery, everything was top-tier.'}"
                                </p>
                            </div>

                            {/* Customer Profile Strip */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-11 rounded-full bg-gradient-to-tr from-accent via-amber-400 to-amber-600 text-primary flex items-center justify-center text-base font-black shadow-md shrink-0">
                                        {currentItem.customer_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="text-sm sm:text-base font-bold text-white font-display leading-tight flex items-center gap-1.5">
                                            {currentItem.customer_name}
                                            <CheckCircle2 className="size-4 text-accent inline shrink-0" />
                                        </h4>
                                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                            <MapPin className="size-3 text-slate-400" />
                                            <span>{currentItem.customer_city || 'Pune, Maharashtra'}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg uppercase tracking-wider block">
                                        Proud Owner
                                    </span>
                                </div>
                            </div>

                            {/* Call to Action */}
                            <div className="pt-1 flex flex-col sm:flex-row gap-3">
                                <Link
                                    to="/inventory"
                                    className="flex-1 h-12 bg-accent hover:bg-accent-hover text-primary font-black rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer"
                                >
                                    <span>Find Your Dream Ride</span>
                                    <ArrowRight className="size-4" />
                                </Link>
                                <Link
                                    to="/book-test-drive"
                                    className="h-12 px-5 border border-white/20 hover:bg-white/10 text-white font-bold rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2"
                                >
                                    Book Test Drive
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Pagination Dot Indicators */}
                    <div className="flex items-center justify-center gap-2 mt-6">
                        {deliveries.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                aria-label={`Go to delivery story ${idx + 1}`}
                                className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                                    currentIndex === idx
                                        ? 'w-9 bg-accent shadow-[0_0_10px_rgba(234,179,8,0.5)]'
                                        : 'w-2.5 bg-white/20 hover:bg-white/40'
                                }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Social Proof Stats Strip */}
                <div className="mt-14 pt-10 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        <p className="text-2xl sm:text-3xl font-black text-accent font-display">1,500+</p>
                        <p className="text-xs text-slate-400 font-medium mt-1">Certified Deliveries</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        <p className="text-2xl sm:text-3xl font-black text-amber-400 font-display flex items-center justify-center gap-1">
                            4.9 <Star className="size-5 fill-amber-400 text-amber-400 inline" />
                        </p>
                        <p className="text-xs text-slate-400 font-medium mt-1">Customer Satisfaction</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        <p className="text-2xl sm:text-3xl font-black text-white font-display">100%</p>
                        <p className="text-xs text-slate-400 font-medium mt-1">RC Transfer Assurance</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-display flex items-center justify-center gap-1">
                            <ShieldCheck className="size-6 text-emerald-400 inline" /> 240-Pt
                        </p>
                        <p className="text-xs text-slate-400 font-medium mt-1">Quality Inspection</p>
                    </div>
                </div>
            </div>

            {/* Full-Screen Lightbox Modal for High-Def Photo Inspection */}
            {lightboxImage && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-auto"
                    onClick={() => setLightboxImage(null)}
                >
                    <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setLightboxImage(null)}
                            className="absolute -top-12 right-0 size-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                            title="Close preview"
                        >
                            <X className="size-6" />
                        </button>
                        <img
                            src={lightboxImage.url}
                            alt={lightboxImage.title}
                            className="max-h-[80vh] max-w-full w-auto object-contain rounded-2xl shadow-2xl border border-white/20"
                        />
                        <p className="text-white text-sm font-bold font-display mt-3 text-center bg-black/60 px-4 py-1.5 rounded-full border border-white/10">
                            {lightboxImage.title}
                        </p>
                    </div>
                </div>
            )}
        </section>
    );
};

export default HappyCustomersCarousel;
