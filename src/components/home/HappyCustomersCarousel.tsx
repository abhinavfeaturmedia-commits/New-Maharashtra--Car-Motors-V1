import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { 
    ChevronLeft, 
    ChevronRight, 
    Sparkles, 
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
        review_quote: null,
        rating: 5,
        is_featured: true,
        display_order: 1,
        tags: [],
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
        review_quote: null,
        rating: 5,
        is_featured: true,
        display_order: 2,
        tags: [],
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
        review_quote: null,
        rating: 5,
        is_featured: true,
        display_order: 3,
        tags: [],
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
        review_quote: null,
        rating: 5,
        is_featured: true,
        display_order: 4,
        tags: [],
        created_at: new Date().toISOString()
    }
];

const HappyCustomersCarousel: React.FC = () => {
    const [deliveries, setDeliveries] = useState<CustomerDelivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(3);
    const [isPaused, setIsPaused] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);

    // Responsive items per page
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 640) {
                setItemsPerPage(1);
            } else if (window.innerWidth < 1024) {
                setItemsPerPage(2);
            } else {
                setItemsPerPage(3);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

    const maxIndex = Math.max(0, deliveries.length - itemsPerPage);

    // Reset currentIndex if it exceeds maxIndex on resize/data change
    useEffect(() => {
        if (currentIndex > maxIndex) {
            setCurrentIndex(maxIndex);
        }
    }, [maxIndex, currentIndex]);

    const nextSlide = useCallback(() => {
        if (deliveries.length === 0) return;
        setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, [deliveries.length, maxIndex]);

    const prevSlide = useCallback(() => {
        if (deliveries.length === 0) return;
        setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
    }, [deliveries.length, maxIndex]);

    // Auto play carousel every 4.5 seconds
    useEffect(() => {
        if (isPaused || deliveries.length <= itemsPerPage || lightboxImage !== null) return;
        const interval = setInterval(nextSlide, 4500);
        return () => clearInterval(interval);
    }, [isPaused, nextSlide, deliveries.length, itemsPerPage, lightboxImage]);

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

    if (loading) {
        return (
            <section className="py-16 bg-slate-950 text-white w-full">
                <div className="container-main text-center">
                    <div className="inline-flex items-center gap-2 text-slate-400 text-sm animate-pulse">
                        <Sparkles className="size-4 text-accent animate-spin" /> Loading customer delivery photos...
                    </div>
                </div>
            </section>
        );
    }

    if (deliveries.length === 0) return null;

    return (
        <section 
            className="py-16 sm:py-20 w-full bg-gradient-to-b from-slate-950 via-slate-900 to-primary text-white relative overflow-hidden select-none"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-1/4 size-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 size-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="container-main relative z-10">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 sm:mb-12 gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-[11px] font-bold uppercase tracking-widest mb-3 backdrop-blur-md">
                            <Sparkles className="size-3.5 text-accent animate-pulse" />
                            Celebrations & Handover Stories
                        </div>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white font-display tracking-tight leading-[1.1]">
                            Happy Customers,{' '}
                            <span className="font-serif-italic font-normal text-amber-400">Delivered with Pride</span>
                        </h2>
                    </div>

                    {/* Navigation Buttons & Counter */}
                    {deliveries.length > itemsPerPage && (
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold text-slate-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                                <span className="text-accent">{currentIndex + 1}</span> / {maxIndex + 1}
                            </span>
                            <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-md">
                                <button
                                    onClick={prevSlide}
                                    aria-label="Previous customer photos"
                                    className="size-10 rounded-xl bg-white/10 hover:bg-accent hover:text-primary text-white flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer"
                                >
                                    <ChevronLeft className="size-5" />
                                </button>
                                <button
                                    onClick={nextSlide}
                                    aria-label="Next customer photos"
                                    className="size-10 rounded-xl bg-white/10 hover:bg-accent hover:text-primary text-white flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer"
                                >
                                    <ChevronRight className="size-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Carousel Track (Images Only) */}
                <div 
                    className="relative"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="overflow-hidden rounded-3xl p-1 -m-1">
                        <div 
                            className="flex transition-transform duration-500 ease-out"
                            style={{ transform: `translateX(-${currentIndex * (100 / itemsPerPage)}%)` }}
                        >
                            {deliveries.map((item, idx) => (
                                <div 
                                    key={item.id || idx}
                                    style={{ width: `${100 / itemsPerPage}%` }}
                                    className="shrink-0 p-2 sm:p-3"
                                >
                                    <div 
                                        className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-slate-950/80 aspect-[4/5] sm:aspect-[3/4] flex items-center justify-center p-2 group cursor-pointer hover:border-accent/40 transition-all duration-300"
                                        onClick={() => setLightboxImage(item.photo_url)}
                                        title="Click to view full photo"
                                    >
                                        {/* Ambient blurred backdrop so any aspect ratio looks seamless */}
                                        <img
                                            src={item.photo_url}
                                            alt=""
                                            className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110 pointer-events-none select-none transition-transform duration-500 group-hover:scale-125"
                                            aria-hidden="true"
                                        />

                                        {/* Subtle Dark Gradient Overlay */}
                                        <div className="absolute inset-0 bg-black/25 pointer-events-none group-hover:bg-black/10 transition-colors duration-300" />

                                        {/* Main Crisp Image (Uncropped, Fits Naturally) */}
                                        <img
                                            src={item.photo_url}
                                            alt={`Happy Customer Delivery`}
                                            className="relative z-10 w-full h-full object-contain rounded-xl shadow-lg transition-transform duration-500 group-hover:scale-[1.03]"
                                            loading="lazy"
                                        />

                                        {/* Floating Zoom Icon on Hover */}
                                        <div className="absolute bottom-3 right-3 z-20 size-8 sm:size-9 rounded-xl bg-black/60 hover:bg-accent text-white hover:text-primary backdrop-blur-md border border-white/15 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 shadow-md">
                                            <Maximize2 className="size-4" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Left & Right floating arrows for larger screens */}
                    {deliveries.length > itemsPerPage && (
                        <>
                            <button
                                onClick={prevSlide}
                                aria-label="Previous slide"
                                className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 size-11 rounded-full bg-slate-900/90 hover:bg-accent text-white hover:text-primary items-center justify-center border border-white/20 shadow-2xl backdrop-blur-md transition-all active:scale-95 cursor-pointer"
                            >
                                <ChevronLeft className="size-6" />
                            </button>
                            <button
                                onClick={nextSlide}
                                aria-label="Next slide"
                                className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 size-11 rounded-full bg-slate-900/90 hover:bg-accent text-white hover:text-primary items-center justify-center border border-white/20 shadow-2xl backdrop-blur-md transition-all active:scale-95 cursor-pointer"
                            >
                                <ChevronRight className="size-6" />
                            </button>
                        </>
                    )}

                    {/* Pagination Dots */}
                    {deliveries.length > itemsPerPage && (
                        <div className="flex items-center justify-center gap-2 mt-6">
                            {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentIndex(idx)}
                                    aria-label={`Go to slide ${idx + 1}`}
                                    className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                                        currentIndex === idx
                                            ? 'w-8 bg-accent shadow-[0_0_10px_rgba(234,179,8,0.5)]'
                                            : 'w-2.5 bg-white/20 hover:bg-white/40'
                                    }`}
                                />
                            ))}
                        </div>
                    )}
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
                            src={lightboxImage}
                            alt="Happy Customer Delivery"
                            className="max-h-[80vh] max-w-full w-auto object-contain rounded-2xl shadow-2xl border border-white/20"
                        />
                    </div>
                </div>
            )}
        </section>
    );
};

export default HappyCustomersCarousel;
