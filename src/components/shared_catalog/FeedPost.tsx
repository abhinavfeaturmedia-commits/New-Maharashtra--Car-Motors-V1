import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2, ChevronLeft, ChevronRight, Check, Copy, ShoppingBag, Send, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPrimaryImage, formatPriceLakh } from '../../lib/utils';

export interface Car {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
    fuel_type: string;
    transmission: string;
    mileage: number;
    images: string[];
    condition: string;
    status: string;
}

interface Profile {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
}

interface FeedPostProps {
    car: Car;
    advisor: Profile | null;
    customerName: string;
    isLiked: boolean;
    onLikeToggle: () => void;
    isInBasket: boolean;
    onBasketToggle: () => void;
    whatsappUrl: string;
    directLink: string;
    onAddComment: (carId: string, comment: string) => void;
    comments: string[];
    onShowToast?: (msg: string, type: 'success' | 'error') => void;
    onDownloadClick?: () => void;
}

export const FeedPost: React.FC<FeedPostProps> = ({
    car,
    advisor,
    customerName,
    isLiked,
    onLikeToggle,
    isInBasket,
    onBasketToggle,
    whatsappUrl,
    directLink,
    onAddComment,
    comments,
    onShowToast,
    onDownloadClick
}) => {
    const [currentImgIndex, setCurrentImgIndex] = useState(0);
    const [copied, setCopied] = useState(false);
    const [showHeartPop, setShowHeartPop] = useState(false);
    const [commentInput, setCommentInput] = useState('');
    const [likeCountSim, setLikeCountSim] = useState(Math.floor(Math.random() * 15) + 3);
    const lastTap = useRef<number>(0);

    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchEndX, setTouchEndX] = useState<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStartX(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEndX(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (touchStartX === null || touchEndX === null) return;
        const distance = touchStartX - touchEndX;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;
        if (isLeftSwipe) {
            if (car.images.length > 0) {
                setCurrentImgIndex((prev) => (prev + 1) % car.images.length);
            }
        } else if (isRightSwipe) {
            if (car.images.length > 0) {
                setCurrentImgIndex((prev) => (prev - 1 + car.images.length) % car.images.length);
            }
        }
        setTouchStartX(null);
        setTouchEndX(null);
    };

    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (car.images.length > 0) {
            setCurrentImgIndex((prev) => (prev + 1) % car.images.length);
        }
    };

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (car.images.length > 0) {
            setCurrentImgIndex((prev) => (prev - 1 + car.images.length) % car.images.length);
        }
    };

    // Double tap/click to like (similar to Instagram)
    const handleImageTap = () => {
        const now = Date.now();
        const DOUBLE_PRESS_DELAY = 300;
        if (now - lastTap.current < DOUBLE_PRESS_DELAY) {
            if (!isLiked) {
                onLikeToggle();
            }
            setShowHeartPop(true);
            setTimeout(() => setShowHeartPop(false), 800);
        }
        lastTap.current = now;
    };

    const handleCopyLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        let success = false;
        
        const fallbackCopy = () => {
            try {
                const el = document.createElement('textarea');
                el.value = directLink;
                el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
                document.body.appendChild(el);
                el.focus();
                el.select();
                success = document.execCommand('copy');
                document.body.removeChild(el);
                if (success) {
                    setCopied(true);
                    if (onShowToast) onShowToast('Car link copied to clipboard!', 'success');
                    setTimeout(() => setCopied(false), 2000);
                } else {
                    if (onShowToast) onShowToast('Failed to copy link. Please manually copy the URL.', 'error');
                }
            } catch (err) {
                if (onShowToast) onShowToast('Failed to copy link.', 'error');
            }
        };

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(directLink).then(() => {
                setCopied(true);
                if (onShowToast) onShowToast('Car link copied to clipboard!', 'success');
                setTimeout(() => setCopied(false), 2000);
            }).catch(() => {
                fallbackCopy();
            });
        } else {
            fallbackCopy();
        }
    };

    const handleCommentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentInput.trim()) return;
        onAddComment(car.id, commentInput.trim());
        setCommentInput('');
    };

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden max-w-xl mx-auto mb-8 font-sans">
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-slate-100 overflow-hidden border border-slate-100 shrink-0">
                        {advisor?.avatar_url ? (
                            <img src={advisor.avatar_url} alt="Advisor" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary">
                                <span className="material-symbols-outlined text-xl">account_circle</span>
                            </div>
                        )}
                    </div>
                    <div>
                        <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm leading-tight flex items-center gap-1.5">
                            {advisor?.full_name || 'New Maharashtra Motors'}
                            <span className="material-symbols-outlined text-blue-500 text-sm" title="Verified Advisor">verified</span>
                        </h4>
                        <p className="text-[10px] sm:text-xs text-slate-400 font-medium">Kolhapur, Maharashtra</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-500 uppercase">
                        {car.condition}
                    </span>
                    {(car.status === 'sold' || car.status === 'archived') && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-red-100 text-red-700 uppercase">
                            Sold
                        </span>
                    )}
                </div>
            </div>

            {/* Media Area (Double Tap to Like & Swipe) */}
            <div 
                className="relative aspect-[4/3] bg-slate-50 select-none cursor-pointer"
                onClick={handleImageTap}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {car.images && car.images.length > 0 ? (
                    <img 
                        src={car.images[currentImgIndex]} 
                        alt={`${car.year} ${car.make} ${car.model}`}
                        className="w-full h-full object-cover"
                        draggable={false}
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                        <span className="material-symbols-outlined text-6xl">directions_car</span>
                        <p className="text-xs font-semibold mt-2">No Images Available</p>
                    </div>
                )}

                {/* Left/Right Carousel Controls */}
                {car.images && car.images.length > 1 && (
                    <>
                        <button 
                            onClick={prevImage}
                            className="absolute left-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 active:scale-95 transition-all"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button 
                            onClick={nextImage}
                            className="absolute right-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 active:scale-95 transition-all"
                        >
                            <ChevronRight size={20} />
                        </button>
                        
                        {/* Dot indicator */}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/30 px-2 py-1 rounded-full backdrop-blur-xs">
                            {car.images.map((_, idx) => (
                                <div 
                                    key={idx} 
                                    className={`size-1.5 rounded-full transition-all ${idx === currentImgIndex ? 'bg-white scale-110' : 'bg-white/40'}`}
                                />
                            ))}
                        </div>
                    </>
                )}

                {/* Double Tap Heart Animation Popup */}
                <AnimatePresence>
                    {showHeartPop && (
                        <motion.div 
                            initial={{ scale: 0.3, opacity: 0 }}
                            animate={{ scale: [0.3, 1.2, 1], opacity: [0, 1, 1] }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ duration: 0.4 }}
                            className="absolute inset-0 flex items-center justify-center text-white pointer-events-none drop-shadow-lg"
                        >
                            <Heart size={80} fill="#f43f5e" className="text-rose-500" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-4">
                    {/* Like heart */}
                    <button 
                        onClick={onLikeToggle}
                        className="text-slate-700 hover:text-rose-500 active:scale-75 transition-all"
                        title="Like this car"
                    >
                        {isLiked ? (
                            <Heart size={24} fill="#f43f5e" className="text-rose-500" />
                        ) : (
                            <Heart size={24} />
                        )}
                    </button>

                    {/* Inquiry bag selector */}
                    <button 
                        onClick={onBasketToggle}
                        className={`active:scale-75 transition-all ${isInBasket ? 'text-primary' : 'text-slate-700 hover:text-primary'}`}
                        title={isInBasket ? 'Remove from inquiry' : 'Select for inquiry'}
                    >
                        <ShoppingBag size={24} fill={isInBasket ? 'var(--color-primary, #0f172a)' : 'none'} />
                    </button>

                    {/* Copy/Share action */}
                    <button 
                        onClick={handleCopyLink}
                        className="text-slate-700 hover:text-blue-500 active:scale-75 transition-all relative"
                        title="Copy direct car link"
                    >
                        {copied ? (
                            <Check size={22} className="text-green-500" />
                        ) : (
                            <Share2 size={22} />
                        )}
                    </button>

                    {/* Download photos action */}
                    {onDownloadClick && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onDownloadClick();
                            }}
                            className="text-slate-700 hover:text-blue-500 active:scale-75 transition-all"
                            title="Download Photos"
                        >
                            <Download size={22} />
                        </button>
                    )}
                </div>

                {/* WhatsApp Chat button */}
                <a 
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                    <span>Chat</span>
                </a>
            </div>

            {/* Simulated social section */}
            <div className="px-5 pb-5 pt-1 space-y-2 select-text">
                {/* Simulated Like count */}
                <p className="text-xs font-extrabold text-slate-800">
                    Liked by {isLiked ? 'you' : customerName || 'Rajesh'} and {isLiked ? likeCountSim : likeCountSim} others
                </p>

                {/* Caption description */}
                <div>
                    <Link to={directLink} className="font-extrabold text-slate-800 text-sm mr-2 hover:text-primary hover:underline transition-all">
                        {car.year} {car.make} {car.model}
                    </Link>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 inline-block mr-1.5">
                        ₹ {formatPriceLakh(car.price)} Lakh
                    </span>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1">
                        {car.transmission} • {car.fuel_type} • {car.mileage?.toLocaleString('en-IN') || 0} km • {car.condition} condition. Handpicked by New Maharashtra Motors team.
                    </p>
                </div>

                {/* Comments List */}
                {comments && comments.length > 0 && (
                    <div className="pt-2 border-t border-slate-50 space-y-1.5">
                        {comments.map((cmt, idx) => (
                            <p key={idx} className="text-xs text-slate-700">
                                <span className="font-bold text-slate-800 mr-2">{customerName || 'Customer'}</span>
                                {cmt}
                            </p>
                        ))}
                    </div>
                )}

                {/* Add a comment form */}
                <form onSubmit={handleCommentSubmit} className="flex gap-2 items-center pt-2.5 border-t border-slate-50">
                    <input 
                        type="text"
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="Add a comment or ask a question..."
                        className="w-full text-xs text-slate-600 bg-slate-50 h-8 px-3 rounded-full border border-slate-100 outline-none focus:ring-1 focus:ring-primary/15"
                    />
                    <button 
                        type="submit"
                        disabled={!commentInput.trim()}
                        className="text-primary hover:text-primary-light p-1.5 disabled:opacity-30 transition-opacity"
                    >
                        <Send size={14} />
                    </button>
                </form>
            </div>
        </div>
    );
};
