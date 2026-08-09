import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, CheckSquare, Square, Download, FileArchive, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface Car {
    id: string;
    make: string;
    model: string;
    variant: string | null;
    year: number;
    images: string[] | null;
    thumbnail: string | null;
}

interface Props {
    car: Car;
    isOpen: boolean;
    onClose: () => void;
}

const DownloadPhotosModal: React.FC<Props> = ({ car, isOpen, onClose }) => {
    const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
    const [downloadingSingle, setDownloadingSingle] = useState<Record<number, boolean>>({});
    const [zippingProgress, setZippingProgress] = useState<{
        status: 'idle' | 'fetching' | 'compressing' | 'saving' | 'error';
        current: number;
        total: number;
        message: string;
    }>({ status: 'idle', current: 0, total: 0, message: '' });

    const allImages = car.images && car.images.length > 0 
        ? car.images 
        : (car.thumbnail ? [car.thumbnail] : []);

    // Initialize all photos as selected
    useEffect(() => {
        if (isOpen) {
            setSelectedIndexes(allImages.map((_, i) => i));
            setZippingProgress({ status: 'idle', current: 0, total: 0, message: '' });
        }
    }, [isOpen, car, allImages.length]);

    if (!isOpen) return null;

    // Helper to get image full URL
    const getImageUrl = (img: string) => {
        if (img.startsWith('http')) return img;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
        return `${supabaseUrl}/storage/v1/object/public/car-images/${img}`;
    };

    // Helper to download single photo
    const downloadSingle = async (index: number) => {
        const img = allImages[index];
        if (!img) return;

        setDownloadingSingle(prev => ({ ...prev, [index]: true }));
        try {
            const imgUrl = getImageUrl(img);
            const isFullUrl = img.startsWith('http');
            const fileExt = imgUrl.split('.').pop()?.split('?')[0] || 'jpg';
            const fileName = `${car.make}_${car.model}_photo_${index + 1}.${fileExt}`.replace(/\s+/g, '_');

            let blob: Blob;
            if (!isFullUrl) {
                // If it's a Supabase path, download via client SDK
                const { data, error } = await supabase.storage.from('car-images').download(img);
                if (error) throw error;
                if (!data) throw new Error('Failed to retrieve image data');
                blob = data;
            } else {
                // Fetch external URL
                const response = await fetch(imgUrl);
                if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
                blob = await response.blob();
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
            console.error('Error downloading photo:', error);
            // Fallback: Open in new tab
            window.open(getImageUrl(img), '_blank');
        } finally {
            setDownloadingSingle(prev => ({ ...prev, [index]: false }));
        }
    };

    // Helper to download selected photos as ZIP
    const downloadSelectedAsZip = async () => {
        if (selectedIndexes.length === 0) return;

        // Dynamically import JSZip so it doesn't block bundle load
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        setZippingProgress({
            status: 'fetching',
            current: 0,
            total: selectedIndexes.length,
            message: `Starting download of ${selectedIndexes.length} photos...`
        });

        try {
            const carSlug = `${car.year}_${car.make}_${car.model}`.replace(/\s+/g, '_').toLowerCase();
            
            for (let i = 0; i < selectedIndexes.length; i++) {
                const imgIndex = selectedIndexes[i];
                const img = allImages[imgIndex];
                if (!img) continue;

                setZippingProgress(prev => ({
                    ...prev,
                    current: i + 1,
                    message: `Downloading photo ${i + 1} of ${selectedIndexes.length}...`
                }));

                const imgUrl = getImageUrl(img);
                const isFullUrl = img.startsWith('http');
                const fileExt = imgUrl.split('.').pop()?.split('?')[0] || 'jpg';
                const fileName = `${carSlug}_photo_${imgIndex + 1}.${fileExt}`;

                let blob: Blob;
                if (!isFullUrl) {
                    const { data, error } = await supabase.storage.from('car-images').download(img);
                    if (error) throw error;
                    if (!data) throw new Error(`Failed to retrieve image data for index ${imgIndex}`);
                    blob = data;
                } else {
                    const response = await fetch(imgUrl);
                    if (!response.ok) throw new Error(`Fetch failed for URL ${imgUrl}`);
                    blob = await response.blob();
                }

                zip.file(fileName, blob);
            }

            setZippingProgress(prev => ({
                ...prev,
                status: 'compressing',
                message: 'Compressing photos into ZIP archive...'
            }));

            const zipBlob = await zip.generateAsync({ type: 'blob' });

            setZippingProgress(prev => ({
                ...prev,
                status: 'saving',
                message: 'Saving ZIP archive...'
            }));

            const blobUrl = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `${carSlug}_photos.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            setZippingProgress(prev => ({
                ...prev,
                status: 'idle',
                message: 'ZIP downloaded successfully!'
            }));

            setTimeout(() => {
                onClose();
            }, 1000);

        } catch (error) {
            console.error('Error generating ZIP:', error);
            setZippingProgress(prev => ({
                ...prev,
                status: 'error',
                message: 'Failed to generate ZIP. Please download photos individually.'
            }));
        }
    };

    const toggleSelectAll = () => {
        if (selectedIndexes.length === allImages.length) {
            setSelectedIndexes([]);
        } else {
            setSelectedIndexes(allImages.map((_, i) => i));
        }
    };

    const toggleSelectPhoto = (index: number) => {
        setSelectedIndexes(prev => 
            prev.includes(index) 
                ? prev.filter(i => i !== index) 
                : [...prev, index]
        );
    };

    const isBusy = zippingProgress.status !== 'idle' && zippingProgress.status !== 'error';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={() => !isBusy && onClose()}
            />

            {/* Modal Card */}
            <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[85vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-primary font-display flex items-center gap-2">
                            <span className="material-symbols-outlined text-accent text-[22px]">download</span>
                            Download Vehicle Photos
                        </h3>
                        <p className="text-slate-500 text-xs mt-1">
                            {car.year} {car.make} {car.model} {car.variant ? `· ${car.variant}` : ''}
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        disabled={isBusy}
                        className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Progress Overlay */}
                <AnimatePresence>
                    {isBusy && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center p-8 text-center"
                        >
                            <Loader2 className="size-10 text-accent animate-spin mb-4" />
                            <h4 className="font-bold text-primary font-display text-base">Generating Photos ZIP</h4>
                            <p className="text-slate-500 text-xs mt-1 max-w-sm">{zippingProgress.message}</p>
                            
                            {zippingProgress.status === 'fetching' && zippingProgress.total > 0 && (
                                <div className="w-64 bg-slate-100 h-2 rounded-full overflow-hidden mt-4">
                                    <div 
                                        className="bg-accent h-full transition-all duration-300 rounded-full"
                                        style={{ width: `${(zippingProgress.current / zippingProgress.total) * 100}%` }}
                                    />
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Selection Toolbar */}
                {allImages.length > 0 && (
                    <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-b border-slate-100 shrink-0 text-xs font-semibold">
                        <button 
                            onClick={toggleSelectAll}
                            disabled={isBusy}
                            className="flex items-center gap-2 text-slate-600 hover:text-primary transition-colors disabled:opacity-50"
                        >
                            {selectedIndexes.length === allImages.length ? (
                                <CheckSquare size={16} className="text-accent" />
                            ) : (
                                <Square size={16} className="text-slate-400" />
                            )}
                            {selectedIndexes.length === allImages.length ? 'Deselect All' : 'Select All'}
                        </button>
                        <span className="text-slate-500">
                            {selectedIndexes.length} of {allImages.length} selected
                        </span>
                    </div>
                )}

                {/* Image Grid Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {allImages.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-sm">
                            <span className="material-symbols-outlined text-4xl mb-2 block">image_not_supported</span>
                            No photos available for this vehicle.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {allImages.map((img, i) => {
                                const isSelected = selectedIndexes.includes(i);
                                const isSingleDownloading = downloadingSingle[i];
                                
                                return (
                                    <div 
                                        key={i} 
                                        className={`group relative aspect-[4/3] rounded-2xl overflow-hidden border-2 bg-slate-50 transition-all ${
                                            isSelected ? 'border-accent shadow-md' : 'border-slate-100'
                                        }`}
                                    >
                                        {/* Image */}
                                        <img 
                                            src={getImageUrl(img)} 
                                            alt="" 
                                            className={`w-full h-full object-cover select-none transition-transform duration-300 group-hover:scale-105 ${
                                                isSelected ? 'opacity-100' : 'opacity-60'
                                            }`} 
                                        />

                                        {/* Checkbox Overlay */}
                                        <button
                                            onClick={() => toggleSelectPhoto(i)}
                                            disabled={isBusy}
                                            className="absolute top-2.5 left-2.5 size-6 rounded-lg flex items-center justify-center bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors cursor-pointer text-white"
                                        >
                                            {isSelected ? (
                                                <CheckSquare size={16} className="text-accent" />
                                            ) : (
                                                <Square size={16} />
                                            )}
                                        </button>

                                        {/* Hover Single Download button */}
                                        <button
                                            onClick={() => downloadSingle(i)}
                                            disabled={isBusy || isSingleDownloading}
                                            className="absolute bottom-2.5 right-2.5 size-8 rounded-xl flex items-center justify-center bg-white/95 text-primary hover:bg-white shadow-lg hover:scale-105 active:scale-95 transition-all opacity-0 group-hover:opacity-100 md:opacity-0 focus:opacity-100"
                                            title="Download this photo"
                                        >
                                            {isSingleDownloading ? (
                                                <Loader2 size={16} className="animate-spin text-accent" />
                                            ) : (
                                                <Download size={16} />
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {zippingProgress.status === 'error' && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl text-center">
                            {zippingProgress.message}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 shrink-0 bg-slate-50 flex items-center justify-end gap-3">
                    <button 
                        onClick={onClose}
                        disabled={isBusy}
                        className="px-5 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-white transition-colors disabled:opacity-50"
                    >
                        Close
                    </button>
                    <button 
                        onClick={downloadSelectedAsZip}
                        disabled={selectedIndexes.length === 0 || isBusy}
                        className="px-5 py-2.5 bg-accent text-primary font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    >
                        <FileArchive size={16} />
                        Download Selected as ZIP ({selectedIndexes.length})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DownloadPhotosModal;
