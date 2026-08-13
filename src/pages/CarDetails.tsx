import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Maximize2, X, ZoomIn, ZoomOut, Heart, Download, Send, MessageSquare, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import DownloadPhotosModal from '../components/admin/DownloadPhotosModal';
import { getPrimaryImage, formatPriceLakh } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useInquiryCart } from '../contexts/InquiryCartContext';
import VideoPlayer from '../components/ui/VideoPlayer';
import { FALLBACK_INVENTORY } from '../data/mockInventory';


const SPECS = [
    { icon: 'speed', label: 'Odometer', key: 'mileage', suffix: ' km' },
    { icon: 'person', label: 'Ownership', key: 'ownership', default: '1st Owner' },
    { icon: 'local_gas_station', label: 'Fuel', key: 'fuel_type' },
    { icon: 'engineering', label: 'Engine', key: 'engine', default: 'N/A' },
    { icon: 'tune', label: 'Transmission', key: 'transmission' },
    { icon: 'calendar_month', label: 'Year', key: 'year' },
    { icon: 'directions_car', label: 'Condition', key: 'condition' },
    { icon: 'verified_user', label: 'Insurance', key: 'insurance', default: 'Valid' },
];

const INSPECTION = [
    { label: 'Engine Sound is Smooth', pass: true },
    { label: 'No Oil Leakage', pass: true },
    { label: 'AC Cooling is Effective', pass: true },
    { label: 'All Electricals Working', pass: true },
];

interface CarData {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
    original_price?: number;
    fuel_type: string;
    transmission: string;
    mileage: number;
    condition: string;
    images: string[];
    features: string;
    status: string;
    source?: string;
    body_type?: string;
    insurance?: string;
    ownership?: string; // Optional field for vehicle details
    engine?: string;    // Optional field for engine specification
    video_url?: string;
    dealer?: {
        dealer_code: string;
    } | null;
}

const CarDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [car, setCar] = useState<CarData | null>(null);
    const { addToCart, isInCart, setIsCartOpen } = useInquiryCart();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const [searchParams] = useSearchParams();
    const catalogId = searchParams.get('catalogId');
    const [catalogData, setCatalogData] = useState<any | null>(null);
    const [catalogLiked, setCatalogLiked] = useState<boolean>(false);
    const [catalogComments, setCatalogComments] = useState<string[]>([]);
    const [commentInput, setCommentInput] = useState('');
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };
    
    const { user, profile, isAdmin, isStaff, hasPermission } = useAuth();
    const isStaffOrAdmin = isAdmin || isStaff;
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [downloadingSingle, setDownloadingSingle] = useState(false);

    const downloadSinglePhoto = async (img: string, index: number) => {
        if (!img || !car || downloadingSingle) return;
        setDownloadingSingle(true);
        try {
            const isFullUrl = img.startsWith('http');
            const imgUrl = isFullUrl ? img : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/car-images/${img}`;
            const fileExt = imgUrl.split('.').pop()?.split('?')[0] || 'jpg';
            const fileName = `${car.make}_${car.model}_photo_${index + 1}.${fileExt}`.replace(/\s+/g, '_');

            let blob: Blob;
            if (!isFullUrl) {
                const { data, error } = await supabase.storage.from('car-images').download(img);
                if (error) throw error;
                if (!data) throw new Error('No data');
                blob = data;
            } else {
                const resp = await fetch(imgUrl);
                if (!resp.ok) throw new Error('Fetch failed');
                blob = await resp.blob();
            }

            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Error downloading image:', error);
            const imgUrl = img.startsWith('http') ? img : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/car-images/${img}`;
            window.open(imgUrl, '_blank');
        } finally {
            setDownloadingSingle(false);
        }
    };

    const getFeaturesList = (): string[] => {
        if (!car) return [];
        const list: string[] = [];
        
        // 1. Add specifications as features
        if (car.year) list.push(`Model Year: ${car.year}`);
        if (car.fuel_type) list.push(`Fuel Type: ${car.fuel_type}`);
        if (car.transmission) list.push(`Transmission: ${car.transmission}`);
        if (car.mileage) list.push(`Odometer: ${car.mileage.toLocaleString('en-IN')} km`);
        if (car.ownership) {
            const ownershipStr = typeof car.ownership === 'number' 
                ? `${car.ownership} Owner` 
                : car.ownership;
            list.push(`Ownership: ${ownershipStr}`);
        }
        if (car.condition) list.push(`Condition: ${car.condition}`);
        if (car.insurance) list.push(`Insurance: ${car.insurance}`);
        
        // 2. Add explicit features from the database
        if (car.features) {
            const explicit = car.features
                .split(/[,\n]+/)
                .map(f => f.trim())
                .filter(Boolean);
            list.push(...explicit);
        }
        
        return Array.from(new Set(list));
    };

    const [similarCars, setSimilarCars] = useState<CarData[]>([]);
    const [wishlist, setWishlist] = useState<string[]>([]);
    
    // Gallery States & Refs
    const [selectedImg, setSelectedImg] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxZoom, setLightboxZoom] = useState(false);
    const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({ transformOrigin: 'center' });
    const [isHovered, setIsHovered] = useState(false);
    const [mobileTab, setMobileTab] = useState<'overview' | 'features' | 'inspection' | 'video' | 'comments'>('overview');
    const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // Lightbox Swipe State
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    // Hover Zoom Handlers
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - left) / width) * 100;
        const y = ((e.clientY - top) / height) * 100;
        setZoomStyle({
            transformOrigin: `${x}% ${y}%`,
            transform: 'scale(1.8)',
        });
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        setZoomStyle({
            transformOrigin: 'center',
            transform: 'scale(1)',
        });
    };

    const handleMouseEnter = () => {
        setIsHovered(true);
    };

    // Navigation controls
    const nextImage = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        if (!car || !car.images) return;
        setSelectedImg(prev => (prev + 1) % car.images.length);
    };

    const prevImage = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        if (!car || !car.images) return;
        setSelectedImg(prev => (prev - 1 + car.images.length) % car.images.length);
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isLightboxOpen) {
                if (e.key === 'ArrowRight') nextImage();
                if (e.key === 'ArrowLeft') prevImage();
                if (e.key === 'Escape') {
                    setIsLightboxOpen(false);
                    setLightboxZoom(false);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLightboxOpen, car]);

    // Active Thumbnail Auto-scroll
    useEffect(() => {
        if (thumbnailRefs.current[selectedImg]) {
            thumbnailRefs.current[selectedImg]?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center',
            });
        }
    }, [selectedImg]);

    // Lightbox Swipe Handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        if (lightboxZoom) return; // Disable swipe when zoomed in
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (lightboxZoom) return;
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (lightboxZoom || !touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isSwipeLeft = distance > 50;
        const isSwipeRight = distance < -50;
        if (isSwipeLeft) nextImage();
        if (isSwipeRight) prevImage();
        setTouchStart(null);
        setTouchEnd(null);
    };

    // Scroll to top when vehicle ID changes
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [id]);

    // Load wishlist
    useEffect(() => {
        const loadWishlist = async () => {
            if (!user) {
                setWishlist([]);
                return;
            }
            const { data } = await supabase
                .from('user_wishlist')
                .select('inventory_id')
                .eq('user_id', user.id);
            setWishlist(data?.map(w => w.inventory_id) || []);
        };
        loadWishlist();
    }, [user]);

    const toggleWishlist = async (e: React.MouseEvent, carId: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!user) {
            alert('Please login to save cars to your wishlist.');
            return;
        }
        
        if (wishlist.includes(carId)) {
            setWishlist(prev => prev.filter(wId => wId !== carId));
            await supabase.from('user_wishlist').delete().match({ user_id: user.id, inventory_id: carId });
        } else {
            setWishlist(prev => [...prev, carId]);
            await supabase.from('user_wishlist').insert({ user_id: user.id, inventory_id: carId });
        }
    };

    const fetchSimilarCars = async (currentCar: CarData) => {
        try {
            const { data, error: err } = await supabase
                .from('inventory')
                .select('*, dealer:dealers(dealer_code)')
                .in('status', ['available', 'reserved'])
                .neq('id', currentCar.id);

            if (err || !data) return;

            const scored = data.map((other: any) => {
                let score = 0;
                if (other.make?.toLowerCase() === currentCar.make?.toLowerCase()) {
                    score += 5;
                }
                if (other.body_type && currentCar.body_type && other.body_type.toLowerCase() === currentCar.body_type.toLowerCase()) {
                    score += 4;
                }
                if (other.fuel_type?.toLowerCase() === currentCar.fuel_type?.toLowerCase()) {
                    score += 2;
                }
                if (other.transmission?.toLowerCase() === currentCar.transmission?.toLowerCase()) {
                    score += 2;
                }
                if (currentCar.price > 0) {
                    const priceDiffRatio = Math.abs(other.price - currentCar.price) / currentCar.price;
                    const priceScore = Math.max(0, 5 * (1 - priceDiffRatio));
                    score += priceScore;
                }
                return { car: other as CarData, score };
            });

            const sorted = scored
                .sort((a, b) => b.score - a.score)
                .map(item => item.car)
                .slice(0, 4);

            setSimilarCars(sorted);
        } catch (error) {
            console.error('Error fetching similar cars:', error);
        }
    };

    useEffect(() => {
        const fetchCar = async () => {
            if (!id) return;
            try {
                const { data, error: err } = await supabase
                    .from('inventory')
                    .select('*, dealer:dealers(dealer_code)')
                    .eq('id', id)
                    .single();
                if (err || !data) {
                    const fallbackMatch = FALLBACK_INVENTORY.find(item => item.id === id);
                    if (fallbackMatch) {
                        setCar(fallbackMatch as unknown as CarData);
                    } else {
                        setError(true);
                    }
                } else {
                    const currentCar = data as unknown as CarData;
                    setCar(currentCar);
                    fetchSimilarCars(currentCar);
                }
            } catch {
                const fallbackMatch = FALLBACK_INVENTORY.find(item => item.id === id);
                if (fallbackMatch) {
                    setCar(fallbackMatch as unknown as CarData);
                } else {
                    setError(true);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchCar();
    }, [id]);


    useEffect(() => {
        const fetchCatalogContext = async () => {
            if (!catalogId || !id) return;
            try {
                // Fetch catalog metadata
                const { data: catData, error: catError } = await supabase
                    .from('shared_catalogs')
                    .select('*, salesperson:profiles!shared_catalogs_created_by_fkey(full_name, email, phone, avatar_url)')
                    .eq('id', catalogId)
                    .single();

                if (!catError && catData) {
                    setCatalogData(catData);
                }

                // Fetch catalog item state (likes and comments)
                const { data: itemData, error: itemError } = await supabase
                    .from('shared_catalog_items')
                    .select('is_liked, comments')
                    .eq('catalog_id', catalogId)
                    .eq('inventory_id', id)
                    .single();

                if (!itemError && itemData) {
                    setCatalogLiked(itemData.is_liked || false);
                    setCatalogComments(itemData.comments || []);
                } else {
                    // Fallback to local storage
                    const storedLikes = localStorage.getItem(`likes_${catalogId}`);
                    if (storedLikes) {
                        try {
                            const likesMap = JSON.parse(storedLikes);
                            setCatalogLiked(likesMap[id] || false);
                        } catch (e) {}
                    }
                    const storedComments = localStorage.getItem(`comments_${catalogId}`);
                    if (storedComments) {
                        try {
                            const commentsMap = JSON.parse(storedComments);
                            setCatalogComments(commentsMap[id] || []);
                        } catch (e) {}
                    }
                }
            } catch (err) {
                console.error('Error fetching catalog context details:', err);
            }
        };

        fetchCatalogContext();
    }, [id, catalogId]);

    const handleCatalogLikeToggle = async () => {
        if (!catalogId || !car) return;
        const nextState = !catalogLiked;
        setCatalogLiked(nextState);

        // Update local storage
        try {
            const storedLikes = localStorage.getItem(`likes_${catalogId}`);
            const likesMap = storedLikes ? JSON.parse(storedLikes) : {};
            likesMap[car.id] = nextState;
            localStorage.setItem(`likes_${catalogId}`, JSON.stringify(likesMap));
        } catch (e) {
            console.warn('Local storage write failed:', e);
        }

        // Save to Supabase
        const { error } = await supabase
            .from('shared_catalog_items')
            .update({ is_liked: nextState })
            .eq('catalog_id', catalogId)
            .eq('inventory_id', car.id);

        if (error) {
            console.error('Failed to sync like to Supabase:', error);
            showToast('Failed to save like state.', 'error');
        } else {
            showToast(nextState ? 'Added to favorites!' : 'Removed from favorites!', 'success');
        }
    };

    const handleCatalogAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!catalogId || !car || !commentInput.trim()) return;
        const nextComments = [...catalogComments, commentInput.trim()];
        setCatalogComments(nextComments);
        setCommentInput('');

        // Update local storage
        try {
            const storedComments = localStorage.getItem(`comments_${catalogId}`);
            const commentsMap = storedComments ? JSON.parse(storedComments) : {};
            commentsMap[car.id] = nextComments;
            localStorage.setItem(`comments_${catalogId}`, JSON.stringify(commentsMap));
        } catch (e) {
            console.warn('Local storage write failed:', e);
        }

        // Save to Supabase
        const { error } = await supabase
            .from('shared_catalog_items')
            .update({ comments: nextComments })
            .eq('catalog_id', catalogId)
            .eq('inventory_id', car.id);

        if (error) {
            console.error('Failed to sync comment to Supabase:', error);
            showToast('Failed to save comment.', 'error');
        } else {
            showToast('Comment posted successfully!', 'success');
        }
    };

    if (loading) {
        return <div className="container-main py-20 text-center text-slate-400 font-medium">Loading vehicle details...</div>;
    }

    if (error || !car) {
        return (
            <div className="container-main py-20 text-center">
                <span className="material-symbols-outlined text-red-400 text-4xl mb-2">error</span>
                <p className="text-slate-500 font-medium mb-4">Vehicle not found or an error occurred.</p>
                <Link to="/inventory" className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors">
                    Back to Inventory
                </Link>
            </div>
        );
    }

    const mainImage = car.images && car.images.length > 0 ? getPrimaryImage([car.images[selectedImg] || car.images[0]]) : getPrimaryImage([]);
    const thumbnails = car.images && car.images.length > 0 ? car.images : [];

    return (
        <div className="container-main py-6 pb-24 lg:pb-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
                <Link to="/" className="hover:text-primary transition-colors">Home</Link>
                <span className="material-symbols-outlined text-xs">chevron_right</span>
                <Link to="/inventory" className="hover:text-primary transition-colors">Used Cars</Link>
                <span className="material-symbols-outlined text-xs">chevron_right</span>
                <span className="text-primary font-medium">{car.make}: {car.model}</span>
            </nav>

            {/* Curator Banner */}
            {catalogId && catalogData && (
                <div className="bg-gradient-to-r from-primary to-slate-800 text-white rounded-3xl p-5 sm:p-6 shadow-xl mb-8 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-2xl bg-white/10 overflow-hidden shrink-0 flex items-center justify-center border border-white/15">
                            {catalogData.salesperson?.avatar_url ? (
                                <img src={catalogData.salesperson.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <span className="material-symbols-outlined text-white text-2xl">account_circle</span>
                            )}
                        </div>
                        <div>
                            <span className="bg-accent/20 text-accent text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1 border border-accent/15">
                                <span className="material-symbols-outlined text-[10px]">verified</span> Curated For You
                            </span>
                            <h3 className="font-extrabold text-sm sm:text-base mt-1">
                                Curated Selection for {catalogData.customer_name}
                            </h3>
                            {catalogData.custom_message && (
                                <p className="text-xs text-slate-300 italic mt-0.5 max-w-md">
                                    "{catalogData.custom_message}"
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => navigate(`/shared-catalog/${catalogId}`)}
                        className="inline-flex h-10 items-center justify-center gap-1.5 px-5 bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold rounded-xl border border-white/15 transition-all shrink-0"
                    >
                        <ChevronLeft size={16} />
                        Back to Catalog
                    </button>
                </div>
            )}

            {/* Desktop Layout */}
            <div className="hidden lg:grid grid-cols-3 gap-8">
                {/* Left: Images */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Main Image Container */}
                    <div 
                        className="relative rounded-2xl overflow-hidden bg-slate-100 aspect-[16/10] cursor-zoom-in group/main"
                        onMouseMove={handleMouseMove}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => setIsLightboxOpen(true)}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        {/* AnimatePresence for transitions */}
                        <div className="w-full h-full overflow-hidden select-none">
                            <AnimatePresence mode="wait">
                                <motion.img
                                    key={selectedImg}
                                    src={mainImage}
                                    alt={`${car.year} ${car.make} ${car.model}`}
                                    style={isHovered ? zoomStyle : undefined}
                                    className="w-full h-full object-cover transition-transform duration-100"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                />
                            </AnimatePresence>
                        </div>

                        {/* Top Badges */}
                        <div className="absolute top-4 left-4 flex gap-2 z-10 pointer-events-none">
                            {car.condition === 'Excellent' && (
                                <span className="bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider backdrop-blur-md">Certified</span>
                            )}
                            {car.status === 'reserved' && (
                                <span className="bg-amber-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider backdrop-blur-md">Reserved</span>
                            )}
                        </div>

                        {/* Hover Overlay Zoom Indicator */}
                        <div className="absolute top-4 right-4 bg-black/60 text-white p-2 rounded-xl backdrop-blur-sm opacity-0 group-hover/main:opacity-100 transition-opacity z-10 hover:bg-black/80 flex items-center gap-1.5 text-xs font-bold shadow-md">
                            <Maximize2 size={14} />
                            <span>Zoom</span>
                        </div>

                        {/* Floating Navigation Chevrons */}
                        {thumbnails.length > 1 && (
                            <>
                                <button 
                                    onClick={prevImage}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/95 text-primary hover:bg-white hover:scale-105 active:scale-95 transition-all p-2.5 rounded-full shadow-lg z-10 opacity-0 group-hover/main:opacity-100 sm:opacity-100 flex items-center justify-center border border-slate-100"
                                    aria-label="Previous image"
                                >
                                    <ChevronLeft size={20} strokeWidth={2.5} />
                                </button>
                                <button 
                                    onClick={nextImage}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/95 text-primary hover:bg-white hover:scale-105 active:scale-95 transition-all p-2.5 rounded-full shadow-lg z-10 opacity-0 group-hover/main:opacity-100 sm:opacity-100 flex items-center justify-center border border-slate-100"
                                    aria-label="Next image"
                                >
                                    <ChevronRight size={20} strokeWidth={2.5} />
                                </button>
                            </>
                        )}

                        {/* Current Image Index Badge */}
                        <div className="absolute bottom-4 right-4 bg-black/60 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm z-10 select-none tracking-wide">
                            {selectedImg + 1} / {thumbnails.length}
                        </div>
                    </div>

                    {/* Thumbnails */}
                    {thumbnails.length > 1 && (
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                            {thumbnails.map((img, i) => (
                                <button 
                                    key={i} 
                                    ref={el => { thumbnailRefs.current[i] = el; }}
                                    onClick={() => setSelectedImg(i)} 
                                    className={`shrink-0 w-24 h-16 sm:w-28 sm:h-20 rounded-xl overflow-hidden border-2 transition-all duration-300 ${i === selectedImg ? 'border-accent shadow-md scale-[0.98]' : 'border-slate-200 opacity-60 hover:opacity-100'}`}
                                >
                                    <img src={getPrimaryImage([img])} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Title */}
                    <div className="flex justify-between items-start gap-4">
                        <div>
                            <h1 className="text-2xl lg:text-3xl font-black text-primary font-display">{car.year} {car.make} {car.model}</h1>
                            <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-slate-500">
                                <span>{car.fuel_type}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                <span>{car.transmission}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                <span>Pune</span>
                                {car.source === 'dealer' && car.dealer?.dealer_code && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-lg border border-amber-200 text-xs">
                                            <span className="material-symbols-outlined text-[14px]">store</span>
                                            {car.dealer.dealer_code}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <button 
                            className={`p-3 rounded-full border transition-all ${
                                wishlist.includes(car.id) 
                                    ? 'bg-red-50 border-red-200 text-red-500 shadow-sm scale-100 hover:scale-105 active:scale-95' 
                                    : 'bg-white border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm scale-100 hover:scale-105 active:scale-95'
                            }`}
                            onClick={(e) => toggleWishlist(e, car.id)}
                            title={wishlist.includes(car.id) ? "Remove from Wishlist" : "Add to Wishlist"}
                        >
                            <Heart size={20} fill={wishlist.includes(car.id) ? 'currentColor' : 'none'} />
                        </button>
                    </div>

                    {/* Specifications */}
                    <div>
                        <h2 className="text-xl font-bold text-primary font-display mb-5">Car Specifications</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                            {SPECS.map(spec => {
                                let val = (car as any)[spec.key];
                                if (val === undefined || val === null || val === '') val = spec.default;
                                if (spec.key === 'mileage' && val) val = val.toLocaleString();
                                return (
                                    <div key={spec.key} className="bg-white border border-slate-100 rounded-2xl p-3.5 sm:p-4 shadow-[var(--shadow-card)]">
                                        <span className="material-symbols-outlined text-xl text-accent mb-2 block">{spec.icon}</span>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{spec.label}</p>
                                        <p className="text-sm font-bold text-primary">{String(val)}{spec.suffix || ''}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Features List */}
                    {(() => {
                        const feats = getFeaturesList();
                        if (feats.length === 0) return null;
                        return (
                            <div>
                                <h2 className="text-xl font-bold text-primary font-display mb-5">Key Features & <span className="font-serif-italic font-normal text-amber-600">Specifications</span></h2>
                                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[var(--shadow-card)] flex flex-wrap gap-2.5">
                                    {feats.map((feat, idx) => (
                                        <span key={idx} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
                                            <span className="material-symbols-outlined text-green-500 text-base font-bold">check</span>
                                            {feat}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Video Walkthrough */}
                    {car.video_url && (
                        <div>
                            <h2 className="text-xl font-bold text-primary font-display mb-5 flex items-center gap-2">
                                <span className="material-symbols-outlined text-accent text-2xl">play_circle</span>
                                Video Tour
                            </h2>
                            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[var(--shadow-card)]">
                                <VideoPlayer url={car.video_url} />
                            </div>
                        </div>
                    )}

                    {/* Inspection Report */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[var(--shadow-card)]">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="size-10 bg-success-light rounded-xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-success">verified</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-primary font-display">Inspection Report</h3>
                                <p className="text-xs text-slate-500">150-Point Check Passed</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {INSPECTION.map(item => (
                                <div key={item.label} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                    <div className="size-6 rounded-full bg-success-light flex items-center justify-center">
                                        <Check size={14} className="text-success" />
                                    </div>
                                    <span className="text-sm text-slate-700">{item.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Catalog Feedback/Comments Section (Desktop only) */}
                    {catalogId && (
                        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[var(--shadow-card)] space-y-6">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center">
                                        <Heart size={20} fill={catalogLiked ? '#f43f5e' : 'none'} className={catalogLiked ? 'text-rose-500' : ''} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-primary font-display">Personalized Feedback</h3>
                                        <p className="text-xs text-slate-500">Likes & Comments on this vehicle</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleCatalogLikeToggle}
                                    className={`h-9 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                        catalogLiked 
                                            ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' 
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <Heart size={14} fill={catalogLiked ? 'currentColor' : 'none'} />
                                    {catalogLiked ? 'Liked' : 'Like vehicle'}
                                </button>
                            </div>

                            {/* Comments List */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comments Feed</h4>
                                {catalogComments.length === 0 ? (
                                    <p className="text-slate-400 text-xs py-2">No comments left on this car yet. Add one below!</p>
                                ) : (
                                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                        {catalogComments.map((cmt, idx) => (
                                            <div key={idx} className="bg-slate-50 p-3 rounded-2xl border border-slate-100/60 flex items-start gap-2.5">
                                                <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                                    {(catalogData?.customer_name || 'C').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-800">{catalogData?.customer_name || 'Customer'}</p>
                                                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{cmt}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add Comment Form */}
                                <form onSubmit={handleCatalogAddComment} className="flex gap-2 items-center pt-2">
                                    <input 
                                        type="text"
                                        value={commentInput}
                                        onChange={(e) => setCommentInput(e.target.value)}
                                        placeholder="Add a comment or question for your representative..."
                                        className="w-full text-xs text-slate-600 bg-slate-50 h-10 px-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/10"
                                    />
                                    <button 
                                        type="submit"
                                        disabled={!commentInput.trim()}
                                        className="h-10 px-4 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-light disabled:opacity-30 disabled:bg-slate-200 transition-all flex items-center justify-center gap-1"
                                    >
                                        <Send size={12} />
                                        <span>Post</span>
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Sidebar */}
                <div className="space-y-4">
                    {/* Price Card */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[var(--shadow-card)] sticky top-[5.5rem]">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <p className="text-xs text-slate-500 font-medium mb-1">Total Price</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-3xl font-black text-primary font-display">₹ {formatPriceLakh(car.price)}</p>
                                    <p className="text-xl font-black text-primary font-display">Lakh</p>
                                </div>
                                {car.original_price && (
                                    <p className="text-sm font-medium text-slate-400 line-through mt-1">₹ {formatPriceLakh(car.original_price)} Lakh</p>
                                )}
                            </div>
                            <span className="bg-accent-light text-accent text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase">Negotiable</span>
                        </div>
                        <Link to={`/finance?price=${car.price}`} className="text-sm font-semibold text-accent hover:underline flex items-center gap-1 mb-6">
                            Calculate EMI Options <span className="material-symbols-outlined text-sm">open_in_new</span>
                        </Link>
                        <div className="space-y-3 mb-4">
                            <Link to={`/book-test-drive?car=${car.id}`} className="w-full h-12 flex items-center justify-center gap-2 bg-accent text-primary font-bold rounded-xl hover:bg-accent-hover transition-all shadow-sm text-sm">
                                <span className="material-symbols-outlined text-lg">directions_car</span> Book Test Drive
                            </Link>
                            <button
                                onClick={() => {
                                    if (isInCart(car.id)) {
                                        setIsCartOpen(true);
                                    } else {
                                        addToCart({
                                            id: car.id,
                                            make: car.make,
                                            model: car.model,
                                            year: car.year,
                                            price: car.price,
                                            fuel_type: car.fuel_type,
                                            transmission: car.transmission,
                                            mileage: car.mileage,
                                            images: car.images,
                                            status: car.status,
                                            created_at: car.source || new Date().toISOString(),
                                            condition: car.condition
                                        });
                                    }
                                }}
                                className={`w-full h-12 flex items-center justify-center gap-2 font-bold rounded-xl transition-all text-sm border ${isInCart(car.id) ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100/70' : 'bg-primary text-white border-primary hover:bg-primary-light'}`}
                            >
                                <span className="material-symbols-outlined text-lg">{isInCart(car.id) ? 'done' : 'folder_special'}</span>
                                {isInCart(car.id) ? 'In Inquiry Cart' : 'Add to Inquiry Cart'}
                            </button>
                            <a href={`https://wa.me/919823237975?text=I'm interested in the ${car.year} ${car.make} ${car.model} (ID: ${car.id})`} target="_blank" rel="noreferrer" className="w-full h-12 flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#20bd5a] transition-colors text-sm">
                                <span className="material-symbols-outlined text-lg">forum</span> WhatsApp Inquiry
                            </a>
                            <button 
                                onClick={async () => {
                                    const shareUrl = catalogId 
                                        ? `${window.location.origin}/car/${car.id}?catalogId=${catalogId}`
                                        : `${window.location.origin}/car/${car.id}`;
                                    const shareData = {
                                        title: `${car.year} ${car.make} ${car.model}`,
                                        text: `Check out this ${car.year} ${car.make} ${car.model} at New Maharashtra Motors!`,
                                        url: shareUrl,
                                    };
                                    
                                    const fallbackCopy = () => {
                                        try {
                                            const el = document.createElement('textarea');
                                            el.value = shareUrl;
                                            el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
                                            document.body.appendChild(el);
                                            el.focus();
                                            el.select();
                                            const success = document.execCommand('copy');
                                            document.body.removeChild(el);
                                            if (success) {
                                                showToast("Car link copied to clipboard!", "success");
                                            } else {
                                                showToast("Failed to copy link.", "error");
                                            }
                                        } catch (err) {
                                            showToast("Failed to copy link.", "error");
                                        }
                                    };

                                    if (navigator.share) {
                                        try { 
                                            await navigator.share(shareData); 
                                        } catch (err) { 
                                            console.log('Share canceled or failed', err); 
                                        }
                                    } else {
                                        if (navigator.clipboard && window.isSecureContext) {
                                            navigator.clipboard.writeText(shareUrl).then(() => {
                                                showToast("Car link copied to clipboard!", "success");
                                            }).catch(() => {
                                                fallbackCopy();
                                            });
                                        } else {
                                            fallbackCopy();
                                        }
                                    }
                                }}
                                className="w-full h-10 flex items-center justify-center gap-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors text-sm mt-2"
                            >
                                <span className="material-symbols-outlined text-lg">share</span> Share Car
                            </button>
                            {catalogId && (
                                <button
                                    onClick={() => setIsDownloadModalOpen(true)}
                                    className="w-full h-10 flex items-center justify-center gap-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors text-sm mt-2 shadow-sm cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-lg">download</span> Download High-Res Photos
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
                            <span className="material-symbols-outlined text-sm text-success">verified</span>
                            100% Satisfaction Guarantee
                        </div>

                        {isStaffOrAdmin && (
                            <div className="border-t border-slate-100 mt-4 pt-4">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm text-accent">admin_panel_settings</span>
                                    Staff Options
                                </p>
                                <div className="space-y-2">
                                    <button 
                                        onClick={() => setIsDownloadModalOpen(true)}
                                        className="w-full h-10 flex items-center justify-center gap-2 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors text-xs shadow-sm cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-base">download</span>
                                        Download Photos (ZIP / Single)
                                    </button>
                                    {hasPermission('inventory', 'manage') && (
                                        <Link 
                                            to={`/admin/inventory/${car.id}/edit`}
                                            className="w-full h-10 flex items-center justify-center gap-2 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors text-xs"
                                        >
                                            <span className="material-symbols-outlined text-base">edit</span>
                                            Edit Vehicle Inventory
                                        </Link>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Dealer Card */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[var(--shadow-card)]">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="size-10 bg-primary rounded-xl flex items-center justify-center text-white shrink-0">
                                <span className="material-symbols-outlined text-lg">storefront</span>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-primary">New Maharashtra Motors</p>
                                <p className="text-xs text-slate-500 flex items-start gap-1 mt-0.5">
                                    <span className="material-symbols-outlined text-xs text-accent shrink-0 mt-0.5">location_on</span>
                                    <span>Sr.no 515/1, Kasarwadi, Pimpri-Chinchwad, Maharashtra 411034</span>
                                </p>
                            </div>
                        </div>
                        {car.source === 'dealer' && car.dealer?.dealer_code && (
                            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end items-center text-xs">
                                <span className="font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">{car.dealer.dealer_code}</span>
                            </div>
                        )}
                    </div>

                    {/* Need Help */}
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="material-symbols-outlined text-accent text-xl shrink-0">support_agent</span>
                            <p className="text-sm font-bold text-primary">Need help?</p>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">Talk to our car experts to get more details about this car.</p>
                        <a href="tel:+919823237975" className="text-sm font-bold text-accent hover:underline flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">call</span> Call +91 98232 37975
                        </a>
                    </div>
                </div>
            </div>

            {/* Mobile Layout */}
            <div className="lg:hidden flex flex-col space-y-6">
                {/* Mobile Image Gallery (Swipeable) */}
                <div 
                    className="relative overflow-hidden bg-slate-100 aspect-[16/10] sm:rounded-2xl shadow-md -mx-4 sm:mx-0"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onClick={() => setIsLightboxOpen(true)}
                >
                    <div className="w-full h-full overflow-hidden select-none">
                        <AnimatePresence mode="wait">
                            <motion.img
                                key={selectedImg}
                                src={mainImage}
                                alt={`${car.year} ${car.make} ${car.model}`}
                                className="w-full h-full object-cover"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            />
                        </AnimatePresence>
                    </div>

                    {/* Floating Top Badges */}
                    <div className="absolute top-4 left-4 flex gap-1.5 pointer-events-none">
                        {car.condition === 'Excellent' && (
                            <span className="bg-primary text-white text-[9px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider backdrop-blur-md shadow-sm">Certified</span>
                        )}
                        {car.status === 'reserved' && (
                            <span className="bg-amber-500 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider backdrop-blur-md shadow-sm">Reserved</span>
                        )}
                    </div>

                    {/* Floating Image Count Pill */}
                    <div className="absolute bottom-4 right-4 bg-black/60 text-white text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md shadow-sm tracking-wider">
                        {selectedImg + 1} / {thumbnails.length}
                    </div>
                </div>

                {/* Mobile Thumbnails Track */}
                {thumbnails.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 px-4 -mx-4 scrollbar-none snap-x snap-mandatory">
                        {thumbnails.map((img, i) => (
                            <button 
                                key={`mob-thumb-${i}`} 
                                onClick={() => setSelectedImg(i)} 
                                className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all duration-200 snap-start ${i === selectedImg ? 'border-accent shadow-sm scale-[0.98]' : 'border-slate-200 opacity-60'}`}
                            >
                                <img src={getPrimaryImage([img])} alt="" className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                )}

                {/* Floating Header Card */}
                <div className={`bg-white rounded-3xl border border-slate-100/60 p-5 shadow-lg mx-4 relative z-10 ${thumbnails.length > 1 ? 'mt-4' : '-mt-12'}`}>
                    <div className="flex justify-between items-start gap-3">
                        <div>
                            <h1 className="text-xl font-black text-primary font-display tracking-tight leading-tight">{car.year} {car.make} {car.model}</h1>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                <span>{car.fuel_type}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                <span>{car.transmission}</span>
                                {car.source === 'dealer' && car.dealer?.dealer_code && (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                        <span className="font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">
                                            {car.dealer.dealer_code}
                                        </span>
                                    </>
                                )}
                            </p>
                        </div>
                        
                        {/* Wishlist button */}
                        <button 
                            className={`p-2.5 rounded-full border transition-all ${
                                wishlist.includes(car.id) 
                                    ? 'bg-red-50 border-red-200 text-red-500 shadow-sm scale-100 active:scale-95' 
                                    : 'bg-slate-50 border-slate-200 text-slate-400 active:scale-95'
                            }`}
                            onClick={(e) => toggleWishlist(e, car.id)}
                        >
                            <Heart size={16} fill={wishlist.includes(car.id) ? 'currentColor' : 'none'} />
                        </button>
                    </div>
                    
                    <div className="flex items-baseline justify-between mt-4 pt-4 border-t border-slate-50">
                        <div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Total Price</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-primary font-display">₹ {formatPriceLakh(car.price)}</span>
                                <span className="text-sm font-black text-primary font-display">Lakh</span>
                            </div>
                        </div>
                        
                        <span className="bg-accent-light text-accent text-[9px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider">Negotiable</span>
                    </div>

                    {catalogId && (
                        <div className="mt-4 pt-3 border-t border-slate-100">
                            <button
                                onClick={() => setIsDownloadModalOpen(true)}
                                className="w-full h-10 flex items-center justify-center gap-1.5 bg-slate-900 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-base">download</span>
                                Download High-Res Photos
                            </button>
                        </div>
                    )}
                </div>

                {/* Mobile Staff Controls */}
                {isStaffOrAdmin && (
                    <div className="bg-white border border-slate-100/60 rounded-3xl p-5 shadow-lg mx-4">
                        <h3 className="text-xs font-bold text-primary font-display pb-2 border-b border-slate-50 mb-3 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-accent">admin_panel_settings</span>
                            Staff Options
                        </h3>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setIsDownloadModalOpen(true)}
                                className="flex-1 h-11 flex items-center justify-center gap-1.5 bg-primary text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-base">download</span>
                                Download Photos
                            </button>
                            {hasPermission('inventory', 'manage') && (
                                <Link 
                                    to={`/admin/inventory/${car.id}/edit`}
                                    className="flex-1 h-11 flex items-center justify-center gap-1.5 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                                >
                                    <span className="material-symbols-outlined text-base">edit</span>
                                    Edit Car
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                {/* Horizontal Specs Track */}
                <div className="flex overflow-x-auto gap-3 pb-2 px-4 -mx-4 scrollbar-none snap-x snap-mandatory">
                    {[
                        { icon: 'speed', label: 'Odometer', val: `${car.mileage.toLocaleString()} km` },
                        { icon: 'local_gas_station', label: 'Fuel Type', val: car.fuel_type },
                        { icon: 'tune', label: 'Transmission', val: car.transmission },
                        { icon: 'calendar_month', label: 'Model Year', val: String(car.year) },
                    ].map((spec, i) => (
                        <div key={i} className="min-w-[45%] bg-white border border-slate-100 rounded-2xl p-4 shadow-sm snap-start flex items-center gap-3">
                            <div className="size-9 bg-slate-50 rounded-xl flex items-center justify-center text-accent shrink-0">
                                <span className="material-symbols-outlined text-lg">{spec.icon}</span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{spec.label}</p>
                                <p className="text-xs font-bold text-primary truncate max-w-[6rem]">{spec.val}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Tab Selector */}
                <div className="px-4">
                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
                        {(catalogId 
                            ? (['overview', 'features', 'inspection', 'video', 'comments'] as const) 
                            : (['overview', 'features', 'inspection', 'video'] as const)
                        ).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setMobileTab(tab)}
                                className={`flex-1 py-2.5 text-[11px] font-extrabold rounded-xl capitalize transition-all ${
                                    mobileTab === tab 
                                        ? 'bg-white text-primary shadow-sm font-black' 
                                        : 'text-slate-500 hover:text-primary'
                                }`}
                            >
                                {tab === 'video' ? 'Video Tour' : tab === 'comments' ? 'Feedback' : tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content Panes */}
                <div className="space-y-4">
                    {mobileTab === 'overview' && (
                        <div className="px-4 space-y-4">
                            {/* Sub Specs List */}
                            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
                                <h3 className="text-sm font-bold text-primary font-display pb-3 border-b border-slate-50">Overview & Details</h3>
                                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs">
                                    {[
                                        { icon: 'person', label: 'Ownership', val: car.ownership || '1st Owner' },
                                        { icon: 'engineering', label: 'Engine', val: car.engine || 'N/A' },
                                        { icon: 'verified_user', label: 'Insurance', val: car.insurance || 'Valid' },
                                        { icon: 'directions_car', label: 'Condition', val: car.condition || 'Good' },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-2.5">
                                            <span className="material-symbols-outlined text-slate-400 text-lg">{item.icon}</span>
                                            <div>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase">{item.label}</p>
                                                <p className="font-bold text-primary">{item.val}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Dealer Card */}
                            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
                                <div className="size-11 bg-primary rounded-xl flex items-center justify-center text-white shrink-0">
                                    <span className="material-symbols-outlined text-lg">storefront</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-primary">New Maharashtra Motors</p>
                                    <p className="text-[10px] text-slate-400 flex items-start gap-1 mt-0.5">
                                        <span className="material-symbols-outlined text-xs text-accent shrink-0 mt-0.5">location_on</span>
                                        <span className="truncate">Kasarwadi, Pimpri-Chinchwad, Maharashtra 411034</span>
                                    </p>
                                </div>
                            </div>

                            {/* Support Widget */}
                            <div className="bg-slate-50 border border-slate-100/60 rounded-3xl p-5 flex items-start gap-4">
                                <div className="size-10 bg-accent-light rounded-xl flex items-center justify-center text-accent shrink-0">
                                    <span className="material-symbols-outlined text-xl">support_agent</span>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-primary">Need Expert Advice?</p>
                                    <p className="text-[10px] text-slate-500 mt-1 mb-3">Talk to our car experts to get more details about this car.</p>
                                    <a href="tel:+919823237975" className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline">
                                        <span className="material-symbols-outlined text-sm">call</span> Call +91 98232 37975
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {mobileTab === 'features' && (() => {
                        const feats = getFeaturesList();
                        return (
                            <div className="px-4">
                                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
                                    <h3 className="text-sm font-bold text-primary font-display pb-3 border-b border-slate-50">Equipped Features & Specs</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {feats.map((feat, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl shadow-sm hover:scale-[1.01] transition-all">
                                                <span className="material-symbols-outlined text-green-500 text-sm font-bold">check</span>
                                                {feat}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {mobileTab === 'inspection' && (
                        <div className="px-4">
                            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                                    <h3 className="text-sm font-bold text-primary font-display">150-Point Inspection</h3>
                                    <span className="text-[10px] bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-lg font-bold">Passed</span>
                                </div>
                                <div className="space-y-2.5">
                                    {INSPECTION.map(item => (
                                        <div key={item.label} className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-2xl">
                                            <div className="size-6 rounded-full bg-success-light flex items-center justify-center text-success shrink-0 font-bold">
                                                <Check size={12} strokeWidth={3} />
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {mobileTab === 'video' && (
                        <div className="px-4">
                            {car.video_url ? (
                                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
                                    <h3 className="text-sm font-bold text-primary font-display pb-3 border-b border-slate-50">Video Walkthrough</h3>
                                    <VideoPlayer url={car.video_url} />
                                </div>
                            ) : (
                                <div className="bg-white border border-slate-100 rounded-3xl p-8 text-center text-slate-400 text-xs shadow-sm flex flex-col items-center">
                                    <span className="material-symbols-outlined text-3xl text-slate-300 mb-2">play_circle</span>
                                    <p>No video tour uploaded for this vehicle.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {catalogId && mobileTab === 'comments' && (
                        <div className="px-4">
                            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                                    <h3 className="text-sm font-bold text-primary font-display">Personalized Feedback</h3>
                                    <button
                                        onClick={handleCatalogLikeToggle}
                                        className={`size-8 rounded-full border transition-all flex items-center justify-center ${
                                            catalogLiked 
                                                ? 'bg-rose-50 border-rose-200 text-rose-600' 
                                                : 'bg-slate-50 border-slate-200 text-slate-400'
                                        }`}
                                    >
                                        <Heart size={14} fill={catalogLiked ? 'currentColor' : 'none'} />
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    {catalogComments.length === 0 ? (
                                        <p className="text-slate-400 text-xs py-2 text-center">No comments left yet.</p>
                                    ) : (
                                        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                                            {catalogComments.map((cmt, idx) => (
                                                <div key={idx} className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100/50 flex items-start gap-2.5">
                                                    <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                                                        {(catalogData?.customer_name || 'C').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold text-slate-800">{catalogData?.customer_name || 'Customer'}</p>
                                                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{cmt}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <form onSubmit={handleCatalogAddComment} className="flex gap-2 items-center pt-2">
                                        <input 
                                            type="text"
                                            value={commentInput}
                                            onChange={(e) => setCommentInput(e.target.value)}
                                            placeholder="Write comment..."
                                            className="w-full text-xs text-slate-600 bg-slate-50 h-9 px-3 rounded-xl border border-slate-200 outline-none focus:ring-1 focus:ring-primary/10"
                                        />
                                        <button 
                                            type="submit"
                                            disabled={!commentInput.trim()}
                                            className="h-9 px-3 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-light disabled:opacity-30 disabled:bg-slate-200 transition-all flex items-center justify-center"
                                        >
                                            <Send size={12} />
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Similar Cars Section */}
            {similarCars.length > 0 && (
                <section className="mt-16 pt-12 border-t border-slate-100">
                    <h2 className="text-2xl font-black text-primary font-display mb-2">Similar Vehicles</h2>
                    <p className="text-slate-500 mb-8">You might also be interested in these vehicles in our live inventory.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {similarCars.map((sCar) => {
                            const isSaved = wishlist.includes(sCar.id);
                            return (
                                <article key={sCar.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all duration-300 group flex flex-col relative">
                                    <Link to={`/car/${sCar.id}`} className="flex flex-col flex-1">
                                        <div className="relative aspect-[16/11] overflow-hidden bg-slate-100">
                                            <img alt={`${sCar.make} ${sCar.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src={getPrimaryImage(sCar.images)} />
                                            {sCar.condition === 'Excellent' && (
                                                <div className="absolute top-3 left-3 bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                                    Certified
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 flex flex-col flex-1">
                                            <h3 className="text-sm font-bold text-primary font-display mb-2 truncate" title={`${sCar.year} ${sCar.make} ${sCar.model}`}>
                                                {sCar.year} {sCar.make} {sCar.model}
                                            </h3>

                                            {/* Specs row */}
                                            <div className="flex items-center gap-3 mb-2 text-[11px] text-slate-500">
                                                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">settings</span>{sCar.transmission}</span>
                                                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">local_gas_station</span>{sCar.fuel_type}</span>
                                            </div>

                                            {/* Secondary info */}
                                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-3">
                                                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">speed</span>{(sCar.mileage || 0).toLocaleString()} km</span>
                                            </div>
                                        </div>
                                    </Link>

                                    <button 
                                        className={`absolute top-3 right-3 p-2 bg-white/90 rounded-full transition-colors shadow-sm backdrop-blur-sm z-10 ${isSaved ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}
                                        onClick={(e) => toggleWishlist(e, sCar.id)}
                                        title={isSaved ? "Remove from Wishlist" : "Add to Wishlist"}
                                    >
                                        <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} />
                                    </button>

                                    <div className="p-4 pt-0 mt-auto">
                                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                            <div>
                                                <span className="text-[9px] text-slate-400 font-bold uppercase">Price</span>
                                                <p className="text-lg font-black text-primary font-display">₹ {formatPriceLakh(sCar.price)} L</p>
                                            </div>
                                            <Link to={`/car/${sCar.id}`} className="inline-flex items-center gap-1 bg-accent/10 hover:bg-accent text-accent hover:text-primary px-3.5 py-2 rounded-lg text-xs font-bold transition-all">
                                                View <span className="material-symbols-outlined text-sm">arrow_outward</span>
                                            </Link>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Lightbox Modal Portal */}
            <AnimatePresence>
                {isLightboxOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/95 z-[100] flex flex-col justify-between p-4 md:p-6"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        {/* Lightbox Header */}
                        <div className="flex items-center justify-between text-white z-10 w-full">
                            <span className="text-sm font-semibold tracking-wide select-none">
                                {car.year} {car.make} {car.model} &bull; {selectedImg + 1} / {thumbnails.length}
                            </span>
                            <div className="flex items-center gap-4">
                                {isStaffOrAdmin && (
                                    <button 
                                        onClick={() => downloadSinglePhoto(thumbnails[selectedImg], selectedImg)}
                                        className="p-2 bg-white/10 hover:bg-white/20 transition-colors rounded-full flex items-center justify-center"
                                        disabled={downloadingSingle}
                                        title="Download Photo"
                                    >
                                        <Download size={20} />
                                    </button>
                                )}
                                <button 
                                    onClick={() => setLightboxZoom(p => !p)} 
                                    className="p-2 bg-white/10 hover:bg-white/20 transition-colors rounded-full"
                                    title={lightboxZoom ? "Zoom Out" : "Zoom In"}
                                >
                                    {lightboxZoom ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
                                </button>
                                <button 
                                    onClick={() => { setIsLightboxOpen(false); setLightboxZoom(false); }} 
                                    className="p-2 bg-white/10 hover:bg-white/20 transition-colors rounded-full"
                                    title="Close Lightbox"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Lightbox Main Image */}
                        <div className="flex-1 flex items-center justify-center relative overflow-hidden my-4 max-h-[75vh]">
                            {/* Chevrons inside lightbox (only shown if not zoomed in) */}
                            {!lightboxZoom && thumbnails.length > 1 && (
                                <>
                                    <button 
                                        onClick={prevImage}
                                        className="absolute left-2 md:left-6 bg-white/10 hover:bg-white/20 text-white transition-all p-3 rounded-full z-10 flex items-center justify-center border border-white/5 active:scale-95"
                                    >
                                        <ChevronLeft size={24} strokeWidth={2.5} />
                                    </button>
                                    <button 
                                        onClick={nextImage}
                                        className="absolute right-2 md:right-6 bg-white/10 hover:bg-white/20 text-white transition-all p-3 rounded-full z-10 flex items-center justify-center border border-white/5 active:scale-95"
                                    >
                                        <ChevronRight size={24} strokeWidth={2.5} />
                                    </button>
                                </>
                            )}

                            <AnimatePresence mode="wait">
                                <motion.img
                                    key={selectedImg}
                                    src={mainImage}
                                    alt=""
                                    initial={{ scale: 0.95, opacity: 0 }}
                                    animate={{ scale: lightboxZoom ? 2.0 : 1, opacity: 1 }}
                                    exit={{ scale: 0.95, opacity: 0 }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 200, duration: 0.2 }}
                                    onClick={() => setLightboxZoom(p => !p)}
                                    className={`max-w-full max-h-full object-contain transition-all duration-300 ${
                                        lightboxZoom ? 'cursor-zoom-out' : 'cursor-zoom-in'
                                    }`}
                                />
                            </AnimatePresence>
                        </div>

                        {/* Lightbox Thumbnails */}
                        {thumbnails.length > 1 && (
                            <div className="flex gap-2.5 overflow-x-auto justify-center py-2 max-w-4xl mx-auto z-10 select-none scrollbar-thin">
                                {thumbnails.map((img, i) => (
                                    <button 
                                        key={`light-${i}`} 
                                        onClick={() => setSelectedImg(i)} 
                                        className={`shrink-0 w-16 h-12 md:w-20 md:h-14 rounded-lg overflow-hidden border-2 transition-all ${
                                            i === selectedImg ? 'border-accent shadow-lg scale-[0.98]' : 'border-white/20 opacity-50 hover:opacity-100'
                                        }`}
                                    >
                                        <img src={getPrimaryImage([img])} alt="" className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sticky Bottom CTA Bar for Mobile */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-white/20 shadow-[0_-10px_30px_rgba(15,23,41,0.08)] px-4 py-3 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-1">Total Price</span>
                    <div className="flex items-baseline gap-0.5">
                        <span className="text-xl font-black text-primary font-display">₹ {formatPriceLakh(car.price)}</span>
                        <span className="text-xs font-black text-primary font-display">L</span>
                    </div>
                </div>
                <div className="flex gap-2 flex-1 max-w-[72%] justify-end">
                    <Link 
                        to={`/book-test-drive?car=${car.id}`} 
                        className="flex-1 h-11 flex items-center justify-center gap-1.5 bg-accent text-primary font-black rounded-xl text-[11px] shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-[15px] font-bold">directions_car</span>
                        Book Drive
                    </Link>
                    <a 
                        href={`https://wa.me/919823237975?text=I'm interested in the ${car.year} ${car.make} ${car.model} (ID: ${car.id})`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="flex-1 h-11 flex items-center justify-center gap-1.5 bg-[#25D366] text-white font-black rounded-xl text-[11px] shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-[15px] font-bold">forum</span>
                        WhatsApp
                    </a>
                </div>
            </div>

            {/* Download Photos Modal */}
            {isDownloadModalOpen && (
                <DownloadPhotosModal
                    car={{
                        id: car.id,
                        make: car.make,
                        model: car.model,
                        variant: car.ownership || null,
                        year: car.year,
                        images: car.images,
                        thumbnail: car.images?.[0] || null
                    }}
                    isOpen={isDownloadModalOpen}
                    onClose={() => setIsDownloadModalOpen(false)}
                />
            )}

            {/* Custom Premium Toast Alerts */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {toast.type === 'success' ? <CheckCircle size={18} /> : <X size={18} />}
                    {toast.msg}
                </div>
            )}
        </div>
    );
};

export default CarDetails;
