import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Car {
    id: string;
    make: string;
    model: string;
    variant: string | null;
    year: number;
    price: number;
    mileage: number | null;
    fuel_type: string | null;
    transmission: string | null;
    color: string | null;
    body_type: string | null;
    registration_no: string | null;
    ownership: number | null;
    description: string | null;
    features: string[] | null;
    images: string[] | null;
    thumbnail: string | null;
    status: string;
}

interface ExistingCustomer {
    id: string;
    full_name: string;
    phone: string | null;
}

interface Props {
    car: Car;
    onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatPrice = (price: number) => {
    const inLakh = price / 100000;
    return inLakh.toFixed(2) + 'L';
};

const ownershipLabel = (n: number | null) => {
    if (!n) return null;
    if (n === 1) return '1st Owner';
    if (n === 2) return '2nd Owner';
    if (n === 3) return '3rd Owner';
    return '4th+ Owner';
};

// ─── Component ───────────────────────────────────────────────────────────────
const ShareCarModal: React.FC<Props> = ({ car, onClose }) => {
    const { user, profile } = useAuth();

    const allImages = car.images ?? (car.thumbnail ? [car.thumbnail] : []);

    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [existingCustomers, setExistingCustomers] = useState<ExistingCustomer[]>([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [photosDownloaded, setPhotosDownloaded] = useState(false);
    const [photoIndex, setPhotoIndex] = useState(0);
    const [sendStep, setSendStep] = useState<'idle' | 'opening' | 'sharing'>('idle');
    const [canShareFiles, setCanShareFiles] = useState(false);
    const [prefetchedFiles, setPrefetchedFiles] = useState<File[]>([]);
    const [prefetching, setPrefetching] = useState(false);
    const [copyingPhoto, setCopyingPhoto] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const isIOSDevice = typeof navigator !== 'undefined' && (
        /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );

    // Fetch existing customers for quick-fill
    useEffect(() => {
        supabase
            .from('customers')
            .select('id, full_name, phone')
            .order('full_name')
            .then(({ data }) => {
                if (data) setExistingCustomers(data as ExistingCustomer[]);
            });
    }, []);

    // Utility to fetch image as a File object bypassing browser cache issues (CORS bug)
    const fetchImageAsFile = async (imageUrl: string, filename: string): Promise<File> => {
        const cacheBusterUrl = imageUrl.includes('?') 
            ? `${imageUrl}&cb=${Date.now()}` 
            : `${imageUrl}?cb=${Date.now()}`;
        
        const resp = await fetch(cacheBusterUrl, { cache: 'no-cache' });
        if (!resp.ok) {
            throw new Error(`Failed to fetch image: status ${resp.status}`);
        }
        
        const blob = await resp.blob();
        
        // Ensure a valid image MIME type is set
        let mimeType = blob.type;
        let ext = 'jpg';
        if (mimeType.includes('png')) {
            ext = 'png';
            mimeType = 'image/png';
        } else {
            mimeType = 'image/jpeg';
        }
        
        return new File([blob], `${filename}.${ext}`, { type: mimeType });
    };

    // Check share capability and prefetch images in background
    useEffect(() => {
        if (navigator.canShare) {
            const dummyFile = new File([''], 'test.png', { type: 'image/png' });
            try {
                setCanShareFiles(navigator.canShare({ files: [dummyFile] }));
            } catch (e) {
                console.warn('Browser does not support file sharing check:', e);
            }
        }

        const prefetch = async () => {
            if (allImages.length === 0) return;
            setPrefetching(true);
            const files: File[] = [];
            const carSlug = `${car.year}-${car.make}-${car.model}`.replace(/\s+/g, '-').toLowerCase();
            
            // Limit to first 3 images for native share to prevent large payloads and share timeouts
            const imagesToShare = allImages.slice(0, 3);
            
            for (let i = 0; i < imagesToShare.length; i++) {
                try {
                    const file = await fetchImageAsFile(imagesToShare[i], `${carSlug}-photo-${i + 1}`);
                    files.push(file);
                } catch (e) {
                    console.warn('Failed to prefetch image for web share:', imagesToShare[i], e);
                }
            }
            setPrefetchedFiles(files);
            setPrefetching(false);
        };

        prefetch();
    }, [car]);

    // Auto-fill when existing customer selected from dropdown
    const handleCustomerSelect = (cust: ExistingCustomer) => {
        setSelectedCustomerId(cust.id);
        setCustomerName(cust.full_name);
        setCustomerPhone(cust.phone?.replace(/^\+91/, '') || '');
        setCustomerSearch(cust.full_name);
        setShowDropdown(false);
    };

    // Filtered list for the searchable dropdown
    const filteredCustomers = existingCustomers.filter(c => {
        const q = customerSearch.toLowerCase();
        return (
            c.full_name.toLowerCase().includes(q) ||
            (c.phone ?? '').toLowerCase().includes(q)
        );
    });

    // Download all car images as files to the user's computer
    const downloadAllImages = async (silent = false) => {
        const images = car.images ?? (car.thumbnail ? [car.thumbnail] : []);
        if (images.length === 0) return;
        if (!silent) setDownloading(true);
        const carSlug = `${car.year}-${car.make}-${car.model}`.replace(/\s+/g, '-').toLowerCase();
        for (let i = 0; i < images.length; i++) {
            try {
                const file = await fetchImageAsFile(images[i], `${carSlug}-photo-${i + 1}`);
                const blobUrl = URL.createObjectURL(file);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = file.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
                // Small delay between downloads so browser doesn't block them
                await new Promise(r => setTimeout(r, 350));
            } catch (e) {
                console.warn('Failed to download image', images[i], e);
            }
        }
        if (!silent) {
            setDownloading(false);
            setPhotosDownloaded(true);
        }
    };

    // Car listing link — use VITE_PUBLIC_URL in production, fallback to current origin on local/LAN
    const getPublicBase = () => {
        const envPublicUrl = import.meta.env.VITE_PUBLIC_URL?.replace(/\/$/, '');
        const isLocal = window.location.hostname === 'localhost'
            || /^192\.168\./.test(window.location.hostname)
            || /^10\./.test(window.location.hostname)
            || /^172\.(1[6-9]|2\d|3[01])\./.test(window.location.hostname);
        return (envPublicUrl && !isLocal) ? envPublicUrl : window.location.origin;
    };
    const publicBase = getPublicBase();
    const carLink = `${publicBase}/car/${car.id}`;

    // Build the WhatsApp message — NO emojis (they render as ◆ diamonds in WhatsApp Web)
    // Uses only WhatsApp markdown: *bold*, _italic_
    const buildMessage = () => {
        const firstName = customerName ? customerName.split(' ')[0] : '';
        const greet = firstName ? `Hello ${firstName},` : 'Hello,';

        const carTitle = `${car.year} ${car.make} ${car.model}${car.variant ? ' ' + car.variant : ''}`;

        const specsLines = [
            `Fuel Type    : ${car.fuel_type ?? 'N/A'}`,
            `Transmission : ${car.transmission ?? 'N/A'}`,
            car.mileage   ? `Kms Driven   : ${car.mileage.toLocaleString('en-IN')} km` : null,
            car.color     ? `Colour       : ${car.color}` : null,
            car.ownership ? `Ownership    : ${ownershipLabel(car.ownership)}` : null,
            car.body_type ? `Body Type    : ${car.body_type}` : null,
        ].filter(Boolean).join('\n');

        const photoCount = (car.images ?? (car.thumbnail ? [car.thumbnail] : [])).length;

        const featuresLine = car.features && car.features.length > 0
            ? `\nKey Features : ${car.features.slice(0, 4).join(', ')}${car.features.length > 4 ? ` + ${car.features.length - 4} more` : ''}`
            : '';

        const photoNote = photoCount > 0
            ? `\n*Car Photos:* ${photoCount} photos shared separately in this chat.\n`
            : '';

        return `${greet}

This is *New Maharashtra Motors*, Kolhapur.

We have the perfect car for you:

*${carTitle}*
Price: *Rs. ${formatPrice(car.price)}* (Negotiable)

---
${specsLines}${featuresLine}
---
${photoNote}
View full details and *book a FREE Test Drive* here:
${carLink}

This car has been getting a lot of interest. We recommend booking your test drive soon.

We also offer:
- Easy bank loan & EMI options
- Full RC transfer assistance
- Thorough inspection report

*New Maharashtra Motors*
Kolhapur, Maharashtra

Feel free to call or WhatsApp us anytime.`;
    };

    // Deduplication: skip logging if the same car+phone was already logged in the last 60 seconds
    // This prevents duplicate entries when both handleSend and handleDeviceShare are triggered
    const checkRecentDuplicate = async (carId: string, phone: string): Promise<boolean> => {
        const sixtySecsAgo = new Date(Date.now() - 60000).toISOString();
        const { count } = await supabase
            .from('inventory_shares')
            .select('id', { count: 'exact', head: true })
            .eq('inventory_id', carId)
            .eq('customer_phone', phone.trim())
            .gte('shared_at', sixtySecsAgo);
        return (count ?? 0) > 0;
    };

    const handleSend = async () => {
        if (!customerPhone.trim()) {
            setError('Please enter customer phone number.');
            return;
        }
        if (!customerName.trim()) {
            setError('Please enter customer name.');
            return;
        }
        setError('');

        const phone = customerPhone.replace(/\D/g, '');
        const fullPhone = phone.startsWith('91') ? phone : `91${phone}`;
        const message = buildMessage();

        setSending(true);

        setSendStep('opening');

        // Log the share to Supabase — skip if same car+phone was logged in the last 60s
        const isDuplicateSend = await checkRecentDuplicate(car.id, customerPhone);
        if (!isDuplicateSend) {
            const { error: dbErr } = await supabase.from('inventory_shares').insert({
                inventory_id: car.id,
                shared_by: user?.id ?? null,
                customer_name: customerName.trim(),
                customer_phone: customerPhone.trim(),
                customer_id: selectedCustomerId || null,
                message_text: message,
            });
            if (dbErr) {
                console.error('Share log error:', dbErr);
            }
        }

        setSending(false);
        setSent(true);
        setSendStep('idle');

        // Open WhatsApp with text message
        const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');

        // Auto-close after a short delay
        setTimeout(onClose, 1500);
    };

    const handleCopyPhoto = async () => {
        if (!currentImage) return;
        setCopyingPhoto(true);
        try {
            // Fetch the image
            const response = await fetch(currentImage);
            const blob = await response.blob();
            
            // Draw to a canvas to convert it to a PNG (Clipboard API requires PNG in many browsers)
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = URL.createObjectURL(blob);
            
            await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Failed to get 2d context'));
                        return;
                    }
                    ctx.drawImage(img, 0, 0);
                    canvas.toBlob(async (pngBlob) => {
                        if (!pngBlob) {
                            reject(new Error('Failed to convert to PNG blob'));
                            return;
                        }
                        try {
                            const item = new ClipboardItem({ 'image/png': pngBlob });
                            await navigator.clipboard.write([item]);
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    }, 'image/png');
                };
                img.onerror = () => reject(new Error('Failed to load image for canvas drawing'));
            });
            
            showToast('Current photo copied! Press Ctrl+V in WhatsApp.', 'success');
        } catch (e: any) {
            console.error('Failed to copy photo:', e);
            setError('Could not copy photo: ' + (e.message || 'CORS or browser block.'));
        } finally {
            setCopyingPhoto(false);
        }
    };

    const handleDeviceShare = async () => {
        if (!customerPhone.trim()) {
            setError('Please enter customer phone number.');
            return;
        }
        if (!customerName.trim()) {
            setError('Please enter customer name.');
            return;
        }
        setError('');

        const message = buildMessage();

        setSending(true);
        setSendStep('sharing');

        // Log the share to Supabase — skip if same car+phone was logged in the last 60s
        const isDuplicateDeviceShare = await checkRecentDuplicate(car.id, customerPhone);
        if (!isDuplicateDeviceShare) {
            const { error: dbErr } = await supabase.from('inventory_shares').insert({
                inventory_id: car.id,
                shared_by: user?.id ?? null,
                customer_name: customerName.trim(),
                customer_phone: customerPhone.trim(),
                customer_id: selectedCustomerId || null,
                message_text: message,
            });
            if (dbErr) {
                console.error('Share log error:', dbErr);
            }
        }

        // On iOS, we must copy text to the clipboard so they can paste it as the caption.
        // On Android, the browser native share passes files + text successfully to WhatsApp.
        if (isIOSDevice) {
            try {
                await navigator.clipboard.writeText(message);
                showToast('Description copied! Paste it as caption in WhatsApp.', 'success');
            } catch (clipErr) {
                console.warn('Could not copy text to clipboard:', clipErr);
            }
        }

        setSending(false);
        setSent(true);
        setSendStep('idle');

        // Open native sharing sheet
        try {
            if (prefetchedFiles.length > 0) {
                if (isIOSDevice) {
                    // Share only files to prevent iOS WhatsApp discarding images
                    await navigator.share({
                        files: prefetchedFiles
                    });
                } else {
                    // Share files + text together (Android WhatsApp attaches photos and pre-fills caption)
                    await navigator.share({
                        files: prefetchedFiles,
                        text: message,
                        title: `${car.year} ${car.make} ${car.model}`
                    });
                }
            } else {
                await navigator.share({
                    text: message,
                    title: `${car.year} ${car.make} ${car.model}`
                });
            }
        } catch (e: any) {
            console.warn('Device share failed or cancelled:', e);
            if (e.name !== 'AbortError') {
                setError('Sharing failed: ' + (e.message || 'unknown error'));
            }
            setSent(false);
            return;
        }

        // Auto-close after a short delay to allow toast visual feedback
        setTimeout(onClose, 2500);
    };

    const currentImage = allImages[photoIndex] ?? null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    <span className="material-symbols-outlined text-lg">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
                    {toast.msg}
                </div>
            )}
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl z-10">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-green-500 flex items-center justify-center shadow-sm">
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-primary">Share via WhatsApp</p>
                            <p className="text-xs text-slate-400">New Maharashtra Motors</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <span className="material-symbols-outlined text-slate-400 text-xl">close</span>
                    </button>
                </div>

                <div className="p-6 space-y-6">

                    {/* ── Branded Car Preview Card ── */}
                    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        {/* Brand header */}
                        <div className="bg-gradient-to-r from-[#1a2744] to-[#243356] px-5 py-3 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">New Maharashtra Motors</p>
                                <p className="text-[10px] text-white/60 mt-0.5">Kolhapur · Trusted Pre-Owned Cars</p>
                            </div>
                            <div className="size-9 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center">
                                <span className="material-symbols-outlined text-amber-400 text-lg">directions_car</span>
                            </div>
                        </div>

                        {/* Car image carousel */}
                        {allImages.length > 0 && (
                            <div className="relative bg-slate-900 aspect-[16/9]">
                                <img
                                    src={currentImage!}
                                    alt={`${car.make} ${car.model}`}
                                    className="w-full h-full object-cover opacity-90"
                                    onError={e => { (e.target as HTMLImageElement).src = ''; }}
                                />
                                {/* Photo count */}
                                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                                    {photoIndex + 1} / {allImages.length}
                                </div>
                                {/* Nav arrows */}
                                {allImages.length > 1 && (
                                    <>
                                        <button
                                            onClick={() => setPhotoIndex(p => Math.max(0, p - 1))}
                                            disabled={photoIndex === 0}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 size-8 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm disabled:opacity-30 hover:bg-black/70 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-base">chevron_left</span>
                                        </button>
                                        <button
                                            onClick={() => setPhotoIndex(p => Math.min(allImages.length - 1, p + 1))}
                                            disabled={photoIndex === allImages.length - 1}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 size-8 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm disabled:opacity-30 hover:bg-black/70 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-base">chevron_right</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Car details */}
                        <div className="p-4 bg-white">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="text-base font-black text-primary">
                                        {car.year} {car.make} {car.model}
                                        {car.variant && <span className="font-semibold text-slate-500"> {car.variant}</span>}
                                    </h3>
                                    {car.registration_no && (
                                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{car.registration_no}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-black text-primary">₹{formatPrice(car.price)}</p>
                                    <p className="text-[10px] text-slate-400">Asking Price</p>
                                </div>
                            </div>

                            {/* Specs grid */}
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                {[
                                    { icon: 'local_gas_station', label: car.fuel_type ?? '—' },
                                    { icon: 'settings', label: car.transmission ?? '—' },
                                    { icon: 'speed', label: car.mileage ? `${car.mileage.toLocaleString('en-IN')} km` : '—' },
                                    { icon: 'palette', label: car.color ?? '—' },
                                    { icon: 'person', label: ownershipLabel(car.ownership ?? null) ?? '—' },
                                    { icon: 'directions_car', label: car.body_type ?? '—' },
                                ].map((spec, i) => (
                                    <div key={i} className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2.5 py-1.5">
                                        <span className="material-symbols-outlined text-slate-400 text-[14px]">{spec.icon}</span>
                                        <span className="text-[11px] font-medium text-slate-600 truncate">{spec.label}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Features */}
                            {car.features && car.features.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                    {car.features.slice(0, 5).map((f, i) => (
                                        <span key={i} className="text-[10px] bg-primary/5 text-primary px-2 py-0.5 rounded-full font-medium">{f}</span>
                                    ))}
                                    {car.features.length > 5 && (
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">+{car.features.length - 5} more</span>
                                    )}
                                </div>
                            )}

                            {/* CTA row */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                                <p className="text-[11px] text-slate-400">📍 Kolhapur · Book Test Drive Available</p>
                                <a
                                    href={carLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] font-bold text-green-600 hover:underline flex items-center gap-1"
                                >
                                    View Listing
                                    <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* ── Photo strip ── */}
                    {allImages.length > 0 && (
                        <div className="space-y-2">
                            {/* Step-by-step instruction banner */}
                            <div className="rounded-xl px-3 py-2.5 border transition-all bg-blue-50 border-blue-200">
                                <div className="flex items-start gap-2">
                                    <span className="material-symbols-outlined text-base mt-0.5 shrink-0 text-blue-500">
                                        info
                                    </span>
                                    <div className="text-xs leading-relaxed text-blue-800">
                                        {canShareFiles ? (
                                            isIOSDevice ? (
                                                <>
                                                    <p className="font-bold mb-0.5">iOS Mobile Sharing Workflow:</p>
                                                    <p><strong>Step 1:</strong> Click <strong>Share via Device</strong> below. Select WhatsApp and your contact.</p>
                                                    <p className="mt-0.5"><strong>Step 2:</strong> The car description is copied to your clipboard. In WhatsApp's photo caption editor, just **tap and select Paste**!</p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="font-bold mb-0.5">Android Mobile Sharing Workflow:</p>
                                                    <p><strong>Step 1:</strong> Click <strong>Share via Device</strong> below. Select WhatsApp and your contact.</p>
                                                    <p className="mt-0.5"><strong>Step 2:</strong> WhatsApp will open with the photos attached and the description pre-filled in the caption automatically!</p>
                                                </>
                                            )
                                        ) : (
                                            <>
                                                <p className="font-bold mb-0.5">Desktop/Web Sharing Workflow:</p>
                                                <p><strong>Step 1:</strong> Select a photo, then click <strong>Copy Photo</strong> to copy it directly to your clipboard.</p>
                                                <p className="mt-0.5"><strong>Step 2:</strong> Click <strong>Send on WhatsApp</strong>. In the WhatsApp chat box, press <strong>Ctrl+V</strong> (or Cmd+V) to paste the photo instantly!</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Thumbnails + manual download/copy buttons */}
                            <div className="flex items-center gap-2">
                                <div className="flex gap-2 overflow-x-auto pb-1 flex-1">
                                    {allImages.map((img, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setPhotoIndex(i)}
                                            className={`size-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${photoIndex === i ? 'border-green-500' : 'border-transparent'}`}
                                        >
                                            <img src={img} alt="" className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                    <button
                                        onClick={handleCopyPhoto}
                                        disabled={copyingPhoto}
                                        className="h-10 px-3 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                                        title="Copy active photo to clipboard (paste in WhatsApp with Ctrl+V)"
                                    >
                                        {copyingPhoto ? (
                                            <span className="size-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                        ) : (
                                            <span className="material-symbols-outlined text-base">content_copy</span>
                                        )}
                                        {copyingPhoto ? 'Copying…' : 'Copy Photo'}
                                    </button>
                                    <button
                                        onClick={() => downloadAllImages(false)}
                                        disabled={downloading}
                                        className={`h-10 px-3 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-60 ${
                                            photosDownloaded
                                                ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                                                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                        title="Download all photos to attach in WhatsApp"
                                    >
                                        {downloading
                                            ? <span className="size-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                            : <span className="material-symbols-outlined text-base">{photosDownloaded ? 'download_done' : 'download'}</span>
                                        }
                                        {downloading ? 'Downloading…' : photosDownloaded ? 'Re-download' : `Download All (${allImages.length})`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Customer Details ── */}
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
                        <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg text-green-600">person</span>
                            Customer Details
                        </h4>

                        {/* Searchable customer picker */}
                        <div className="relative">
                            <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                                Search Existing Customer — optional
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">search</span>
                                <input
                                    type="text"
                                    value={customerSearch}
                                    onChange={e => {
                                        setCustomerSearch(e.target.value);
                                        setShowDropdown(true);
                                        setSelectedCustomerId('');
                                    }}
                                    onFocus={() => setShowDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
                                    placeholder="Type name or phone number to search…"
                                    className="w-full h-10 border border-slate-200 rounded-xl pl-9 pr-4 text-sm bg-white outline-none focus:ring-2 focus:ring-green-200"
                                />
                                {selectedCustomerId && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-green-500 text-base">check_circle</span>
                                )}
                            </div>

                            {/* Dropdown results */}
                            {showDropdown && customerSearch.length > 0 && (
                                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                                    {filteredCustomers.length === 0 ? (
                                        <div className="px-4 py-3 text-xs text-slate-400 text-center">
                                            No customer found for "{customerSearch}"
                                        </div>
                                    ) : (
                                        filteredCustomers.map(c => (
                                            <button
                                                key={c.id}
                                                onMouseDown={() => handleCustomerSelect(c)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-green-50 transition-colors text-left"
                                            >
                                                <div className="size-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                    {c.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-primary truncate">{c.full_name}</p>
                                                    {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                                                </div>
                                                {selectedCustomerId === c.id && (
                                                    <span className="material-symbols-outlined text-green-500 text-base ml-auto shrink-0">check</span>
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                                    Customer Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    placeholder="e.g., Rahul Patil"
                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-green-200 bg-white"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                                    WhatsApp Phone <span className="text-red-400">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">+91</span>
                                    <input
                                        type="tel"
                                        value={customerPhone}
                                        onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        placeholder="9876543210"
                                        className="w-full h-10 border border-slate-200 rounded-xl pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-green-200 bg-white"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* Message preview */}
                    <div>
                        <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px]">chat</span>
                            Message Preview (sent to customer)
                        </p>
                        <div className="bg-[#e2ffc7] rounded-2xl rounded-tl-sm p-4 text-[12px] text-slate-700 font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto border border-green-100">
                            {buildMessage()}
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                            <span className="material-symbols-outlined text-lg">error</span>
                            {error}
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2.5">
                        {canShareFiles ? (
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="h-12 px-4 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeviceShare}
                                    disabled={sending || sent || prefetching}
                                    className={`flex-1 h-12 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                                        sent
                                            ? 'bg-green-100 text-green-700 border border-green-200'
                                            : 'bg-green-500 hover:bg-green-600 text-white'
                                    } disabled:opacity-80`}
                                >
                                    {sent ? (
                                        <>
                                            <span className="material-symbols-outlined text-lg">check_circle</span>
                                            Shared! Closing…
                                        </>
                                    ) : prefetching ? (
                                        <>
                                            <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Preparing Photos ({prefetchedFiles.length}/{allImages.length})…
                                        </>
                                    ) : sendStep === 'sharing' ? (
                                        <>
                                            <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Opening Share Sheet…
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-base">share</span>
                                            Share via Device (with Photos)
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : null}

                        <div className="flex gap-3">
                            {/* If canShareFiles is false, show Cancel button here */}
                            {!canShareFiles && (
                                <button
                                    onClick={onClose}
                                    className="flex-1 h-12 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                onClick={handleSend}
                                disabled={sending || sent}
                                className={`flex-1 h-12 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                                    canShareFiles 
                                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/60' 
                                        : sent
                                            ? 'bg-green-100 text-green-700 border border-green-200'
                                            : 'bg-green-500 hover:bg-green-600 text-white'
                                } disabled:opacity-80`}
                            >
                                {sent && !canShareFiles ? (
                                    <>
                                        <span className="material-symbols-outlined text-lg">check_circle</span>
                                        Sent! Closing…
                                    </>
                                ) : sendStep === 'opening' ? (
                                    <>
                                        <span className="size-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                        Opening WhatsApp…
                                    </>
                                ) : (
                                    <>
                                        <svg viewBox="0 0 24 24" className={`w-4 h-4 ${canShareFiles ? 'fill-slate-600' : 'fill-white'} shrink-0`}>
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                        </svg>
                                        {canShareFiles ? 'Send Web Link (Text only)' : 'Send on WhatsApp'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <p className="text-center text-[11px] text-slate-400">
                        This share will be logged for tracking purposes · Shared by: {profile?.full_name ?? 'Admin'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ShareCarModal;
