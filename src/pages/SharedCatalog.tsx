import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatPriceLakh } from '../lib/utils';
import { Loader2, Phone, Mail, User, CheckCircle, Calendar, MessageSquare, ArrowLeft, X, ShoppingBag, Grid, Layers, Heart, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FeedPost, Car } from '../components/shared_catalog/FeedPost';
import DownloadPhotosModal from '../components/admin/DownloadPhotosModal';

interface Profile {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
}

interface CatalogData {
    customer_name: string;
    custom_message: string | null;
    created_at: string;
    salesperson: Profile | null;
    is_active: boolean;
    expires_at: string | null;
}

const SharedCatalog: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [catalog, setCatalog] = useState<CatalogData | null>(null);
    const [cars, setCars] = useState<Car[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Layout view toggle: 'feed' (Instagram feed) or 'grid' (classic grid list)
    const [viewMode, setViewMode] = useState<'feed' | 'grid'>('feed');

    // Local device states (persisted via localStorage per catalog)
    const [likedCarIds, setLikedCarIds] = useState<Record<string, boolean>>({});
    const [carComments, setCarComments] = useState<Record<string, string[]>>({});
    const [basketCarIds, setBasketCarIds] = useState<string[]>([]);

    // Inquiry Drawer State
    const [inquiryDrawerOpen, setInquiryDrawerOpen] = useState(false);
    const [inquiryTargetCars, setInquiryTargetCars] = useState<Car[]>([]);

    // Form inputs
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [clientMsg, setClientMsg] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [isExpired, setIsExpired] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [downloadCar, setDownloadCar] = useState<Car | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // 1. Fetch catalog metadata & cars
    useEffect(() => {
        const fetchCatalogData = async () => {
            if (!id) return;
            setLoading(true);
            setError(false);

            try {
                const { data: catData, error: catError } = await supabase
                    .from('shared_catalogs')
                    .select('*, salesperson:profiles!shared_catalogs_created_by_fkey(full_name, email, phone, avatar_url)')
                    .eq('id', id)
                    .single();

                if (catError) throw catError;

                setCatalog({
                    customer_name: catData.customer_name,
                    custom_message: catData.custom_message,
                    created_at: catData.created_at,
                    salesperson: catData.salesperson,
                    is_active: catData.is_active ?? true,
                    expires_at: catData.expires_at ?? null,
                });

                // Log catalog view with deduplication and admin exclusion
                const logCatalogView = async () => {
                    try {
                        const sessionKey = `viewed_catalog_${id}`;
                        // 1. Exclude if already viewed in this browser session
                        if (sessionStorage.getItem(sessionKey)) {
                            return;
                        }

                        // 2. Exclude if viewer is an authenticated admin/staff member
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session?.user) {
                            console.log('Skipping view count logging for authenticated admin/staff user.');
                            return;
                        }

                        // 3. Insert view record
                        const { error: viewError } = await supabase
                            .from('catalog_views')
                            .insert({
                                catalog_id: id,
                                user_agent: navigator.userAgent,
                            });

                        if (viewError) {
                            console.error('Failed to log catalog view:', viewError);
                        } else {
                            sessionStorage.setItem(sessionKey, 'true');
                        }
                    } catch (err) {
                        console.error('Error logging catalog view:', err);
                    }
                };

                logCatalogView();

                const expiredByDate = catData.expires_at && new Date(catData.expires_at) < new Date();
                if (!(catData.is_active ?? true) || expiredByDate) {
                    setIsExpired(true);
                }

                // Fetch catalog items
                const { data: itemData, error: itemsError } = await supabase
                    .from('shared_catalog_items')
                    .select('inventory_id, is_liked, comments')
                    .eq('catalog_id', id);

                if (itemsError) throw itemsError;

                const likesMap: Record<string, boolean> = {};
                const commentsMap: Record<string, string[]> = {};
                
                // Read from local storage first to initialize fallbacks
                const storedLikes = localStorage.getItem(`likes_${id}`);
                if (storedLikes) {
                    try { Object.assign(likesMap, JSON.parse(storedLikes)); } catch (e) {}
                }
                const storedComments = localStorage.getItem(`comments_${id}`);
                if (storedComments) {
                    try { Object.assign(commentsMap, JSON.parse(storedComments)); } catch (e) {}
                }

                // Override with database values (the source of truth)
                itemData.forEach(item => {
                    likesMap[item.inventory_id] = item.is_liked || false;
                    commentsMap[item.inventory_id] = item.comments || [];
                });
                setLikedCarIds(likesMap);
                setCarComments(commentsMap);

                // Also update local storage to keep them in sync
                localStorage.setItem(`likes_${id}`, JSON.stringify(likesMap));
                localStorage.setItem(`comments_${id}`, JSON.stringify(commentsMap));

                const carIds = itemData.map(item => item.inventory_id);

                if (carIds.length > 0) {
                    const { data: carList, error: carError } = await supabase
                        .from('inventory')
                        .select('*')
                        .in('id', carIds);

                    if (carError) throw carError;
                    setCars(carList || []);
                }
            } catch (err) {
                console.error('Failed to load shared catalog:', err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        fetchCatalogData();
    }, [id]);

    // Toggle like
    const handleLikeToggle = async (carId: string) => {
        const nextState = !likedCarIds[carId];
        const updated = { ...likedCarIds, [carId]: nextState };
        setLikedCarIds(updated);
        localStorage.setItem(`likes_${id}`, JSON.stringify(updated));

        // Save to Supabase
        await supabase
            .from('shared_catalog_items')
            .update({ is_liked: nextState })
            .eq('catalog_id', id)
            .eq('inventory_id', carId);
    };

    // Add comment
    const handleAddComment = async (carId: string, comment: string) => {
        const current = carComments[carId] || [];
        const nextComments = [...current, comment];
        const updated = { ...carComments, [carId]: nextComments };
        setCarComments(updated);
        localStorage.setItem(`comments_${id}`, JSON.stringify(updated));

        // Save to Supabase
        await supabase
            .from('shared_catalog_items')
            .update({ comments: nextComments })
            .eq('catalog_id', id)
            .eq('inventory_id', carId);
    };

    // Basket management
    const handleBasketToggle = (carId: string) => {
        if (basketCarIds.includes(carId)) {
            setBasketCarIds(prev => prev.filter(x => x !== carId));
        } else {
            setBasketCarIds(prev => [...prev, carId]);
        }
    };

    // Trigger Inquiry for either specific car or entire basket
    const triggerInquiry = (targetCars: Car[]) => {
        setInquiryTargetCars(targetCars);
        setInquiryDrawerOpen(true);
    };

    // Submitting Leads (can be multiple cars)
    const handleInquirySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (inquiryTargetCars.length === 0) return;

        setSubmitting(true);
        try {
            const carsText = inquiryTargetCars
                .map(c => `- ${c.year} ${c.make} ${c.model} (₹ ${formatPriceLakh(c.price)} Lakh)`)
                .join('\n');

            const commentsText = inquiryTargetCars
                .map(c => {
                    const list = carComments[c.id] || [];
                    return list.length > 0 ? `\nComments on ${c.make} ${c.model}:\n` + list.map(x => `  * ${x}`).join('\n') : '';
                })
                .filter(Boolean)
                .join('\n');

            const messagePayload = `Shared Catalog Bulk Inquiry (Catalog ID: ${id})\n\nInquired Cars:\n${carsText}\n${commentsText}\n\nCustomer remarks: ${clientMsg || 'No specific notes.'}`;

            // Insert single consolidated lead
            const { data: leadData, error: leadError } = await supabase
                .from('leads')
                .insert({
                    type: 'general',
                    full_name: clientName,
                    phone: clientPhone,
                    email: clientEmail || null,
                    message: messagePayload,
                    source: 'shared_catalog',
                    status: 'new'
                })
                .select('id')
                .single();

            if (leadError) throw leadError;

            // Link all inquired vehicles to the new lead
            if (leadData && inquiryTargetCars.length > 0) {
                const links = inquiryTargetCars.map(c => ({
                    lead_id: leadData.id,
                    inventory_id: c.id
                }));
                await supabase.from('lead_inventory_items').insert(links);
            }

            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setInquiryDrawerOpen(false);
                setClientMsg('');
                // If it was a basket inquiry, clear basket
                if (inquiryTargetCars.length > 1) {
                    setBasketCarIds([]);
                }
            }, 3000);
        } catch (error) {
            console.error('Failed to submit callback:', error);
            alert('Failed to submit inquiry. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const getWhatsAppUrl = (car: Car) => {
        const phoneNo = import.meta.env.VITE_BUSINESS_WHATSAPP || '919823237975';
        const formattedPhone = phoneNo.startsWith('91') ? phoneNo : `91${phoneNo}`;
        
        let text = `Hello,\n`;
        text += `I was looking at the custom catalog you shared for me (*${catalog?.customer_name}*).\n`;
        text += `I'm interested in the *${car.year} ${car.make} ${car.model}* priced at *₹ ${formatPriceLakh(car.price)} Lakh*.\n`;
        text += `Let's discuss this model.`;
        
        return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
    };

    const getDirectCarLink = (carId: string) => {
        const envPublicUrl = import.meta.env.VITE_PUBLIC_URL?.replace(/\/$/, '');
        const isLocal = window.location.hostname === 'localhost' || /^192\.168\./.test(window.location.hostname);
        const origin = (envPublicUrl && !isLocal) ? envPublicUrl : window.location.origin;
        return `${origin}/car/${carId}?catalogId=${id}`;
    };

    if (loading) {
        return (
            <div className="flex h-[80vh] w-full flex-col items-center justify-center text-slate-400">
                <Loader2 className="animate-spin text-primary mb-3" size={32} />
                <p className="font-semibold text-sm">Loading your custom catalog...</p>
            </div>
        );
    }

    if (isExpired && catalog) {
        const salespersonPhone = import.meta.env.VITE_BUSINESS_WHATSAPP || '919823237975';
        const formattedSalespersonPhone = salespersonPhone.startsWith('91') ? salespersonPhone : `91${salespersonPhone}`;
        return (
            <div className="bg-slate-50 min-h-screen py-24">
                <div className="container-main max-w-md mx-auto px-4 text-center space-y-6">
                    <div className="size-20 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto shadow-sm">
                        <span className="material-symbols-outlined text-amber-500 text-4xl">link_off</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">Catalog No Longer Active</h2>
                        <p className="mt-2 text-slate-500 text-sm leading-relaxed">
                            This personalized catalog is no longer available. It may have been deactivated or expired.
                            Please contact your advisor to get an updated selection.
                        </p>
                    </div>
                    {catalog.salesperson && (
                        <div className="bg-white border border-slate-100 rounded-2xl p-5 text-left space-y-4 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact Your Advisor</p>
                            <div className="flex items-center gap-3">
                                <div className="size-12 rounded-xl bg-primary/5 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary text-2xl">account_circle</span>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{catalog.salesperson.full_name || 'New Maharashtra Motors'}</p>
                                    <p className="text-xs text-slate-500 font-medium">SALES ADVISOR</p>
                                </div>
                            </div>
                            <a
                                href={`https://wa.me/${formattedSalespersonPhone}?text=${encodeURIComponent(`Hello, I had a shared catalog link from New Maharashtra Motors but it seems to have expired. Could you please share an updated catalog?`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full h-11 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors text-sm"
                            >
                                WhatsApp Chat
                            </a>
                        </div>
                    )}
                    <Link to="/" className="inline-flex h-11 items-center justify-center px-6 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors text-sm">
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    if (error || !catalog) {
        return (
            <div className="container-main max-w-xl mx-auto py-24 text-center space-y-6">
                <span className="material-symbols-outlined text-red-500 text-5xl">error</span>
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Catalog Not Found</h2>
                    <p className="mt-2 text-slate-500 text-sm">
                        This shared catalog link might have expired or does not exist. Please check the URL or contact New Maharashtra Motors support.
                    </p>
                </div>
                <Link to="/" className="inline-flex h-11 items-center justify-center px-6 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors text-sm">
                    Back to Home
                </Link>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-screen py-10 pb-24">
            <div className="container-main max-w-6xl mx-auto px-4">
                
                {/* Curator Header Panel */}
                <div className="relative bg-primary text-white rounded-3xl p-6 sm:p-8 overflow-hidden shadow-xl border border-white/5 mb-8">
                    <div className="absolute right-0 top-0 size-60 bg-accent rounded-full blur-[100px] opacity-10 pointer-events-none" />
                    <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-2">
                            <span className="bg-accent/20 text-accent text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 border border-accent/15">
                                <span className="material-symbols-outlined text-xs">verified</span> Handpicked For You
                            </span>
                            <h1 className="text-2xl sm:text-3xl font-extrabold font-display leading-tight">
                                Curated Selection for {catalog.customer_name}
                            </h1>
                            <p className="text-slate-300 text-xs sm:text-sm max-w-lg leading-relaxed">
                                Review our selected vehicles. Like your favorites, add comments or select multiple models to inquire at once.
                            </p>
                        </div>
                        
                        {/* Advisor info summary */}
                        {catalog.salesperson && (
                            <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-2xl shrink-0 backdrop-blur-md">
                                <div className="size-10 rounded-xl bg-white/10 overflow-hidden shrink-0">
                                    {catalog.salesperson.avatar_url ? (
                                        <img src={catalog.salesperson.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white">
                                            <span className="material-symbols-outlined text-xl">account_circle</span>
                                        </div>
                                    )}
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-black text-white">{catalog.salesperson.full_name}</p>
                                    <p className="text-[10px] text-slate-300">Sales Representative</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Feed / Grid Layout Switcher Toggle */}
                <div className="flex items-center justify-between mb-6">
                    <div className="text-xs text-slate-400 font-semibold">
                        Showing Curated Catalog ({cars.length} cars)
                    </div>
                    <div className="flex bg-slate-200/60 p-1 rounded-xl gap-1">
                        <button
                            onClick={() => setViewMode('feed')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'feed' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            <Layers size={13} />
                            Feed
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'grid' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            <Grid size={13} />
                            Grid
                        </button>
                    </div>
                </div>

                {/* Main Content Layout */}
                {viewMode === 'feed' ? (
                    /* Instagram Feed Layout */
                    <div className="space-y-6 max-w-xl mx-auto">
                        {cars.map(car => (
                            <FeedPost
                                key={car.id}
                                car={car}
                                advisor={catalog.salesperson}
                                customerName={catalog.customer_name}
                                isLiked={!!likedCarIds[car.id]}
                                onLikeToggle={() => handleLikeToggle(car.id)}
                                isInBasket={basketCarIds.includes(car.id)}
                                onBasketToggle={() => handleBasketToggle(car.id)}
                                whatsappUrl={getWhatsAppUrl(car)}
                                directLink={getDirectCarLink(car.id)}
                                onAddComment={handleAddComment}
                                comments={carComments[car.id] || []}
                                onShowToast={showToast}
                                onDownloadClick={() => setDownloadCar(car)}
                            />
                        ))}
                    </div>
                ) : (
                    /* Classic Grid Layout */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {cars.map(car => {
                            const isLiked = !!likedCarIds[car.id];
                            const isInBasket = basketCarIds.includes(car.id);
                            return (
                                <article key={car.id} className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-[var(--shadow-card)] hover:shadow-md transition-all flex flex-col justify-between p-4">
                                    <div className="relative aspect-[16/11] rounded-2xl overflow-hidden bg-slate-100">
                                        <Link to={`/car/${car.id}?catalogId=${id}`} className="w-full h-full block">
                                            <img 
                                                src={car.images?.[0]} 
                                                alt="" 
                                                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" 
                                            />
                                        </Link>
                                        
                                        {/* Badges on image */}
                                        <div className="absolute top-3 left-3 flex gap-1 pointer-events-none">
                                            {(car.status === 'sold' || car.status === 'archived') && (
                                                <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase">Sold</span>
                                            )}
                                        </div>

                                        <button 
                                            onClick={() => handleLikeToggle(car.id)}
                                            className="absolute top-3 right-3 size-8 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-slate-700 hover:text-rose-500 transition-colors shadow-xs z-10"
                                        >
                                            <Heart size={16} fill={isLiked ? '#f43f5e' : 'none'} className={isLiked ? 'text-rose-500' : ''} />
                                        </button>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                        <h3 className="font-extrabold text-slate-800 text-base leading-snug">
                                            <Link to={`/car/${car.id}?catalogId=${id}`} className="hover:underline hover:text-primary transition-all">
                                                {car.year} {car.make} {car.model}
                                            </Link>
                                        </h3>
                                        <p className="text-xs text-slate-400 font-semibold">{car.transmission} • {car.fuel_type} • {car.mileage?.toLocaleString('en-IN') || 0} km</p>
                                        <p className="text-lg font-black text-primary font-display pt-1">₹ {formatPriceLakh(car.price)} Lakh</p>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center gap-2">
                                        <button
                                            onClick={() => handleBasketToggle(car.id)}
                                            className={`flex-1 h-9 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                                                isInBasket 
                                                    ? 'bg-primary text-white border-primary' 
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            <ShoppingBag size={12} />
                                            {isInBasket ? 'Selected' : 'Select'}
                                        </button>
                                        <button
                                            onClick={() => triggerInquiry([car])}
                                            className="h-9 px-3 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold hover:bg-slate-200 transition-colors"
                                        >
                                            Inquire
                                        </button>
                                        <button
                                            onClick={() => setDownloadCar(car)}
                                            className="h-9 w-9 shrink-0 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
                                            title="Download Photos"
                                        >
                                            <Download size={14} />
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}

            </div>

            {/* Sticky Bottom Multi-Car Inquiry Basket Bar */}
            <AnimatePresence>
                {basketCarIds.length > 0 && (
                    <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        className="fixed bottom-4 inset-x-4 max-w-md mx-auto z-40 bg-primary/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl flex items-center justify-between border border-white/10"
                    >
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-xl bg-accent text-primary flex items-center justify-center font-black shadow-sm">
                                {basketCarIds.length}
                            </div>
                            <div>
                                <p className="text-white text-xs font-bold">Inquiry Selection Basket</p>
                                <p className="text-slate-300 text-[10px]">{basketCarIds.length} car{basketCarIds.length > 1 ? 's' : ''} selected for query</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                const selected = cars.filter(c => basketCarIds.includes(c.id));
                                triggerInquiry(selected);
                            }}
                            className="h-9 px-4 bg-accent hover:bg-accent-light text-primary text-xs font-black rounded-xl transition-all shadow-md active:scale-95"
                        >
                            Inquire Now
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Inquiry Drawer / Modal Popup */}
            <AnimatePresence>
                {inquiryDrawerOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setInquiryDrawerOpen(false)}
                            className="fixed inset-0 z-50 bg-black backdrop-blur-xs"
                        />
                        <motion.div
                            initial={{ y: '100%', opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25 }}
                            className="fixed inset-x-0 bottom-0 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:max-w-lg z-50 bg-white rounded-t-3xl md:rounded-3xl md:bottom-1/2 md:translate-y-1/2 shadow-2xl border border-slate-100 overflow-hidden"
                        >
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
                                <div>
                                    <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">Inquire Curated Vehicles</h3>
                                    <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Sending query for {inquiryTargetCars.length} car{inquiryTargetCars.length > 1 ? 's' : ''}</p>
                                </div>
                                <button onClick={() => setInquiryDrawerOpen(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Drawer Form */}
                            <div className="p-6 overflow-y-auto max-h-[70vh]">
                                {success ? (
                                    <div className="text-center py-8 space-y-4">
                                        <div className="bg-emerald-50 text-emerald-500 p-3 rounded-full inline-block">
                                            <CheckCircle size={32} />
                                        </div>
                                        <h4 className="font-bold text-slate-800">Inquiry Submitted Successfully!</h4>
                                        <p className="text-xs text-slate-500">We have registered your lead query details. Our representative will contact you shortly.</p>
                                    </div>
                                ) : (
                                    <form onSubmit={handleInquirySubmit} className="space-y-4">
                                        
                                        {/* Target Car list preview */}
                                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                                            {inquiryTargetCars.map((car, idx) => (
                                                <div key={car.id} className="text-[10px] font-bold text-slate-700 bg-white border border-slate-100 px-2.5 py-1 rounded-lg">
                                                    {car.year} {car.make} {car.model}
                                                </div>
                                            ))}
                                        </div>

                                        <div>
                                            <input
                                                type="text"
                                                required
                                                value={clientName}
                                                onChange={e => setClientName(e.target.value)}
                                                placeholder="Your Name *"
                                                className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                            />
                                        </div>

                                        <div>
                                            <input
                                                type="tel"
                                                required
                                                value={clientPhone}
                                                onChange={e => setClientPhone(e.target.value)}
                                                placeholder="Phone Number *"
                                                className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                            />
                                        </div>

                                        <div>
                                            <input
                                                type="email"
                                                value={clientEmail}
                                                onChange={e => setClientEmail(e.target.value)}
                                                placeholder="Email address (optional)"
                                                className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                            />
                                        </div>

                                        <div>
                                            <textarea
                                                value={clientMsg}
                                                onChange={e => setClientMsg(e.target.value)}
                                                rows={2}
                                                placeholder="Remarks or questions..."
                                                className="w-full p-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="w-full h-11 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors shadow-lg disabled:bg-slate-300 flex items-center justify-center text-xs sm:text-sm"
                                        >
                                            {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Send Inquiry Callback Request'}
                                        </button>
                                    </form>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Custom Premium Toast Alerts */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {toast.type === 'success' ? <CheckCircle size={18} /> : <X size={18} />}
                    {toast.msg}
                </div>
            )}

            {downloadCar && (
                <DownloadPhotosModal
                    car={{
                        id: downloadCar.id,
                        make: downloadCar.make,
                        model: downloadCar.model,
                        variant: downloadCar.condition || null,
                        year: downloadCar.year,
                        images: downloadCar.images,
                        thumbnail: downloadCar.images?.[0] || null
                    }}
                    isOpen={!!downloadCar}
                    onClose={() => setDownloadCar(null)}
                />
            )}
        </div>
    );
};

export default SharedCatalog;
