import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useNotifications } from '../../contexts/NotificationContext';
import { useData } from '../../contexts/DataContext';
import { 
    Plus, 
    Search, 
    Sparkles, 
    Upload, 
    Trash2, 
    Edit3, 
    CheckCircle2, 
    X, 
    Eye, 
    EyeOff, 
    Calendar, 
    Image as ImageIcon,
    LayoutGrid,
    Table as TableIcon,
    Maximize2,
    ArrowUpDown,
    Check
} from 'lucide-react';
import HighlightText from '../../components/ui/HighlightText';

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

const emptyDeliveryForm = {
    customer_id: '',
    inventory_id: '',
    customer_name: '',
    customer_city: 'Pune',
    car_title: '',
    registration_no: '',
    delivery_date: new Date().toISOString().slice(0, 10),
    photo_url: '',
    is_featured: true,
    display_order: 0,
};

const AdminHappyCustomers: React.FC = () => {
    const { addNotification } = useNotifications();
    const { customers, inventory } = useData();

    const [deliveries, setDeliveries] = useState<CustomerDelivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [filterTab, setFilterTab] = useState<'all' | 'featured' | 'hidden'>('all');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyDeliveryForm);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    // Fetch deliveries from Supabase
    const fetchDeliveries = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('customer_deliveries')
                .select('*')
                .order('display_order', { ascending: true })
                .order('delivery_date', { ascending: false });

            if (error) throw error;
            setDeliveries(data || []);
        } catch (err: any) {
            console.error('Failed to fetch deliveries:', err);
            addNotification({
                title: 'Error loading deliveries',
                message: err.message || 'Failed to load customer delivery photos.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeliveries();
    }, []);

    // Filtered list
    const filteredDeliveries = useMemo(() => {
        const q = search.toLowerCase().trim();
        return deliveries.filter(d => {
            if (filterTab === 'featured' && !d.is_featured) return false;
            if (filterTab === 'hidden' && d.is_featured) return false;
            if (!q) return true;

            return (
                (d.customer_name && d.customer_name.toLowerCase().includes(q)) ||
                (d.car_title && d.car_title.toLowerCase().includes(q)) ||
                (d.registration_no && d.registration_no.toLowerCase().includes(q)) ||
                (d.customer_city && d.customer_city.toLowerCase().includes(q))
            );
        });
    }, [deliveries, search, filterTab]);

    // Handle Image Selection with Canvas Compression
    const handleImageUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Please upload a valid image file (JPG, PNG, WebP).');
            return;
        }

        setUploadingImage(true);

        try {
            // Client-side compression using HTML Canvas (max 600 KB, max 1600px width/height)
            const compressedBlob = await new Promise<Blob>((resolve, reject) => {
                const img = new Image();
                img.src = URL.createObjectURL(file);
                img.onload = () => {
                    URL.revokeObjectURL(img.src);
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const maxDim = 1600;

                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Canvas context failure'));
                        return;
                    }

                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG with quality 0.85 (well within 600 KB)
                    canvas.toBlob(
                        (blob) => {
                            if (blob) resolve(blob);
                            else reject(new Error('Compression failure'));
                        },
                        'image/jpeg',
                        0.85
                    );
                };
                img.onerror = reject;
            });

            // Upload compressed blob to Supabase storage bucket 'car-images'
            const filename = `delivery_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
            const { error: uploadError } = await supabase.storage
                .from('car-images')
                .upload(filename, compressedBlob, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('car-images')
                .getPublicUrl(filename);

            if (urlData?.publicUrl) {
                setForm(prev => ({ ...prev, photo_url: urlData.publicUrl }));
                addNotification({
                    title: 'Delivery Photo Uploaded',
                    message: `Image compressed to ${(compressedBlob.size / 1024).toFixed(0)} KB and uploaded successfully.`,
                    type: 'success'
                });
            }
        } catch (err: any) {
            console.error('Image upload failed:', err);
            addNotification({
                title: 'Upload Failed',
                message: err.message || 'Could not upload delivery photo.',
                type: 'error'
            });
        } finally {
            setUploadingImage(false);
        }
    };

    // Quick Auto-complete Customer selection
    const handleSelectCustomer = (customerId: string) => {
        const cust = customers.find(c => c.id === customerId);
        if (cust) {
            setForm(prev => ({
                ...prev,
                customer_id: cust.id,
                customer_name: cust.full_name,
                customer_city: cust.city || prev.customer_city || 'Pune'
            }));
        }
    };

    // Quick Auto-complete Inventory vehicle selection
    const handleSelectInventory = (invId: string) => {
        const car = inventory.find(c => c.id === invId);
        if (car) {
            const carTitle = `${car.year || ''} ${car.make || ''} ${car.model || ''} ${car.variant || ''}`.trim();
            const regNo = car.registration_no || car.license_plate || '';
            const primaryImg = car.images && car.images.length > 0 ? (
                car.images[0].startsWith('http') 
                    ? car.images[0] 
                    : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/car-images/${car.images[0]}`
            ) : '';

            setForm(prev => ({
                ...prev,
                inventory_id: car.id,
                car_title: carTitle,
                registration_no: regNo,
                photo_url: prev.photo_url || primaryImg
            }));
        }
    };

    // Open Modal for Create or Edit
    const handleOpenModal = (item?: CustomerDelivery) => {
        if (item) {
            setEditingId(item.id);
            setForm({
                customer_id: item.customer_id || '',
                inventory_id: item.inventory_id || '',
                customer_name: item.customer_name || '',
                customer_city: item.customer_city || 'Pune',
                car_title: item.car_title || '',
                registration_no: item.registration_no || '',
                delivery_date: item.delivery_date || new Date().toISOString().slice(0, 10),
                photo_url: item.photo_url || '',
                is_featured: item.is_featured,
                display_order: item.display_order || 0,
            });
        } else {
            setEditingId(null);
            setForm(emptyDeliveryForm);
        }
        setIsModalOpen(true);
    };

    // Save Delivery Record
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.photo_url.trim()) {
            alert('Please upload or provide a celebration photo URL.');
            return;
        }

        setSaving(true);
        try {
            const customerName = form.customer_name.trim() || 'Happy Customer';
            const carTitle = form.car_title.trim() || 'Certified Delivery';

            const payload = {
                customer_id: form.customer_id || null,
                inventory_id: form.inventory_id || null,
                customer_name: customerName,
                customer_city: form.customer_city?.trim() || 'Pune',
                car_title: carTitle,
                registration_no: form.registration_no?.trim() || null,
                delivery_date: form.delivery_date || new Date().toISOString().slice(0, 10),
                photo_url: form.photo_url.trim(),
                is_featured: Boolean(form.is_featured),
                display_order: Number(form.display_order) || 0,
                rating: 5,
                updated_at: new Date().toISOString()
            };

            if (editingId) {
                const { error } = await supabase
                    .from('customer_deliveries')
                    .update(payload)
                    .eq('id', editingId);

                if (error) throw error;
                addNotification({
                    title: 'Delivery Photo Updated',
                    message: `Updated carousel photo for ${customerName}.`,
                    type: 'success'
                });
            } else {
                const { error } = await supabase
                    .from('customer_deliveries')
                    .insert(payload);

                if (error) throw error;
                addNotification({
                    title: 'Delivery Photo Added',
                    message: `Added new photo for homepage carousel.`,
                    type: 'success'
                });
            }

            setIsModalOpen(false);
            fetchDeliveries();
        } catch (err: any) {
            console.error('Failed to save delivery:', err);
            addNotification({
                title: 'Error Saving Photo',
                message: err.message || 'Could not save customer delivery record.',
                type: 'error'
            });
        } finally {
            setSaving(false);
        }
    };

    // Toggle Featured Status directly with 1 click
    const handleToggleFeatured = async (id: string, currentVal: boolean) => {
        try {
            const { error } = await supabase
                .from('customer_deliveries')
                .update({ is_featured: !currentVal, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            setDeliveries(prev => prev.map(d => d.id === id ? { ...d, is_featured: !currentVal } : d));
            addNotification({
                title: !currentVal ? 'Active on Carousel' : 'Hidden from Carousel',
                message: !currentVal ? 'Photo is now active on the homepage carousel.' : 'Photo hidden from homepage.',
                type: 'info'
            });
        } catch (err: any) {
            console.error('Failed to toggle featured status:', err);
        }
    };

    // Delete Delivery Record
    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this delivery photo?')) return;
        setDeletingId(id);
        try {
            const { error } = await supabase
                .from('customer_deliveries')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setDeliveries(prev => prev.filter(d => d.id !== id));
            addNotification({
                title: 'Photo Deleted',
                message: 'Delivery photo removed successfully.',
                type: 'success'
            });
        } catch (err: any) {
            console.error('Failed to delete photo:', err);
            addNotification({
                title: 'Delete Failed',
                message: err.message || 'Could not delete photo.',
                type: 'error'
            });
        } finally {
            setDeletingId(null);
        }
    };

    const totalFeatured = deliveries.filter(d => d.is_featured).length;

    return (
        <div className="space-y-6">
            {/* Header & Quick Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display flex items-center gap-2">
                        <span className="material-symbols-outlined text-accent text-3xl">celebration</span>
                        Happy Customers Carousel Photos
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        Manage handover celebration photos and posters displayed in the homepage carousel.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleOpenModal()}
                        className="h-10 px-4 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
                    >
                        <Plus className="size-4" />
                        <span>Upload Delivery Photo</span>
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-[var(--shadow-card)] flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <ImageIcon className="size-6 text-amber-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-primary font-display">{deliveries.length}</p>
                        <p className="text-xs text-slate-400 font-medium">Total Uploaded Photos</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-[var(--shadow-card)] flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        <Sparkles className="size-6 text-emerald-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-emerald-600 font-display">{totalFeatured}</p>
                        <p className="text-xs text-slate-400 font-medium">Active on Homepage Carousel</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-[var(--shadow-card)] flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center font-bold">
                        <EyeOff className="size-6 text-slate-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-600 font-display">{deliveries.length - totalFeatured}</p>
                        <p className="text-xs text-slate-400 font-medium">Hidden / Inactive Photos</p>
                    </div>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
                {/* Filter Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    {[
                        { id: 'all', label: 'All Photos', count: deliveries.length },
                        { id: 'featured', label: 'Active on Homepage', count: totalFeatured },
                        { id: 'hidden', label: 'Hidden', count: deliveries.length - totalFeatured },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setFilterTab(t.id as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                filterTab === t.id
                                    ? 'bg-white text-primary shadow-xs'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {t.label} ({t.count})
                        </button>
                    ))}
                </div>

                {/* Search & Layout toggle */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 h-10 w-full sm:w-72 focus-within:ring-2 focus-within:ring-primary/10">
                        <Search className="size-4 text-slate-400 shrink-0" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by customer, vehicle, city…"
                            className="bg-transparent text-xs text-primary outline-none w-full placeholder:text-slate-400"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="text-slate-300 hover:text-slate-500">
                                <X className="size-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center border border-slate-200 rounded-xl p-1 bg-slate-50">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white text-primary shadow-xs' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Grid View"
                        >
                            <LayoutGrid className="size-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white text-primary shadow-xs' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Table View"
                        >
                            <TableIcon className="size-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Gallery */}
            {loading ? (
                <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100">
                    <Sparkles className="size-6 text-accent animate-spin mx-auto mb-2" />
                    <p className="font-medium text-sm">Loading delivery photos...</p>
                </div>
            ) : filteredDeliveries.length === 0 ? (
                <div className="bg-white rounded-2xl p-16 text-center border border-slate-100 shadow-xs">
                    <span className="material-symbols-outlined text-5xl text-slate-200 mb-3 block">photo_library</span>
                    <h3 className="text-base font-bold text-slate-700">No delivery photos found</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Upload handover celebration photos or posters to showcase them in the homepage carousel.
                    </p>
                    <button
                        onClick={() => handleOpenModal()}
                        className="mt-4 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-light transition-colors cursor-pointer"
                    >
                        + Upload First Delivery Photo
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                /* Visual Photo Grid View */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {filteredDeliveries.map(item => (
                        <div
                            key={item.id}
                            className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col group"
                        >
                            {/* Photo Container */}
                            <div 
                                className="relative aspect-[3/4] overflow-hidden bg-slate-950 flex items-center justify-center p-2 cursor-pointer"
                                onClick={() => setLightboxUrl(item.photo_url)}
                            >
                                {/* Ambient backdrop */}
                                <img
                                    src={item.photo_url}
                                    alt=""
                                    className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-110 pointer-events-none"
                                    aria-hidden="true"
                                />
                                <div className="absolute inset-0 bg-black/20 pointer-events-none" />

                                {/* Main crisp photo */}
                                <img
                                    src={item.photo_url}
                                    alt={item.customer_name || 'Delivery photo'}
                                    className="relative z-10 w-auto h-full max-w-full object-contain rounded-lg group-hover:scale-105 transition-transform duration-500"
                                />

                                {/* Top Left: Status Toggle Pill */}
                                <div className="absolute top-2.5 left-2.5 z-20" onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => handleToggleFeatured(item.id, item.is_featured)}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider backdrop-blur-md transition-all flex items-center gap-1 shadow-md cursor-pointer ${
                                            item.is_featured
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-black/70 text-slate-300 hover:bg-black/90'
                                        }`}
                                        title={item.is_featured ? 'Click to hide from homepage' : 'Click to show on homepage'}
                                    >
                                        {item.is_featured ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                                        <span>{item.is_featured ? 'On Home' : 'Hidden'}</span>
                                    </button>
                                </div>

                                {/* Top Right: Display Order Badge */}
                                <div className="absolute top-2.5 right-2.5 z-20 bg-black/70 backdrop-blur-md text-amber-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border border-white/10">
                                    #{item.display_order || 0}
                                </div>

                                {/* Hover Zoom Indicator */}
                                <div className="absolute bottom-2.5 right-2.5 z-20 size-7 rounded-lg bg-black/60 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Maximize2 className="size-3.5" />
                                </div>
                            </div>

                            {/* Card Footer Info */}
                            <div className="p-3.5 flex flex-col flex-1 justify-between bg-white border-t border-slate-100 space-y-2">
                                <div>
                                    <h3 className="text-sm font-bold text-primary truncate leading-tight" title={item.customer_name}>
                                        <HighlightText text={item.customer_name || 'Happy Customer'} highlight={search} />
                                    </h3>
                                    {item.car_title && item.car_title !== 'Certified Delivery' && (
                                        <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5" title={item.car_title}>
                                            <HighlightText text={item.car_title} highlight={search} />
                                        </p>
                                    )}
                                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                                        <Calendar className="size-3" />
                                        <span>
                                            {item.delivery_date ? new Date(item.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                        </span>
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-[10px] font-mono text-slate-400">
                                        {item.registration_no || item.customer_city || ''}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleOpenModal(item)}
                                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                            title="Edit Details"
                                        >
                                            <Edit3 className="size-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            disabled={deletingId === item.id}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                            title="Delete Photo"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Table View */
                <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px]">
                            <thead>
                                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                    <th className="text-left px-5 py-3">Photo & Caption</th>
                                    <th className="text-left px-5 py-3">Vehicle / City</th>
                                    <th className="text-left px-5 py-3">Delivery Date</th>
                                    <th className="text-left px-5 py-3">Order</th>
                                    <th className="text-left px-5 py-3">Homepage Status</th>
                                    <th className="text-right px-5 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDeliveries.map(item => (
                                    <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={item.photo_url}
                                                    alt={item.customer_name}
                                                    onClick={() => setLightboxUrl(item.photo_url)}
                                                    className="size-14 rounded-xl object-contain bg-slate-900 border border-slate-200 shrink-0 cursor-pointer"
                                                />
                                                <div>
                                                    <p className="text-sm font-bold text-primary">
                                                        <HighlightText text={item.customer_name || 'Happy Customer'} highlight={search} />
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">
                                                        <HighlightText text={item.customer_city || 'Pune'} highlight={search} />
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <p className="text-xs font-bold text-slate-800">
                                                <HighlightText text={item.car_title || 'Certified Delivery'} highlight={search} />
                                            </p>
                                            {item.registration_no && (
                                                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                                    <HighlightText text={item.registration_no} highlight={search} />
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-xs text-slate-600 whitespace-nowrap">
                                            {item.delivery_date ? new Date(item.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                        </td>
                                        <td className="px-5 py-3 text-xs font-mono font-bold text-slate-700">
                                            #{item.display_order || 0}
                                        </td>
                                        <td className="px-5 py-3">
                                            <button
                                                onClick={() => handleToggleFeatured(item.id, item.is_featured)}
                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors inline-flex items-center gap-1 cursor-pointer ${
                                                    item.is_featured
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                }`}
                                            >
                                                {item.is_featured ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                                                <span>{item.is_featured ? 'Active on Home' : 'Hidden'}</span>
                                            </button>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleOpenModal(item)}
                                                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                                    title="Edit"
                                                >
                                                    <Edit3 className="size-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Create / Edit Modal ── */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="bg-gradient-to-r from-primary to-primary-light text-white p-5 rounded-t-3xl flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-black font-display">
                                    {editingId ? 'Edit Delivery Photo' : 'Upload Delivery Photo'}
                                </h2>
                                <p className="text-xs text-slate-300 mt-0.5">
                                    Add celebration photos and posters to show on the homepage carousel.
                                </p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="size-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSave} className="p-6 space-y-5">
                            {/* Delivery Photograph Upload */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">
                                    Celebration Photo / Poster *
                                </label>
                                <div className="flex flex-col gap-3">
                                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 hover:border-primary rounded-2xl cursor-pointer bg-slate-50 hover:bg-primary/5 transition-colors w-full">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) handleImageUpload(file);
                                            }}
                                        />
                                        {uploadingImage ? (
                                            <div className="flex items-center gap-2 text-primary font-bold text-xs">
                                                <span className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                                Compressing & Uploading…
                                            </div>
                                        ) : (
                                            <>
                                                <Upload className="size-7 text-slate-400 mb-1.5" />
                                                <span className="text-xs font-bold text-slate-700">Click to Upload Photo</span>
                                                <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP (Auto-compressed to &le; 600 KB)</span>
                                            </>
                                        )}
                                    </label>

                                    {form.photo_url && (
                                        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 flex items-center justify-center p-2 group">
                                            <img
                                                src={form.photo_url}
                                                alt="Preview"
                                                className="w-auto h-full max-w-full object-contain rounded-lg"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setForm(p => ({ ...p, photo_url: '' }))}
                                                className="absolute top-2 right-2 size-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md cursor-pointer transition-transform active:scale-95"
                                                title="Remove photo"
                                            >
                                                <X className="size-4" />
                                            </button>
                                        </div>
                                    )}

                                    <div>
                                        <input
                                            type="url"
                                            value={form.photo_url}
                                            onChange={e => setForm(p => ({ ...p, photo_url: e.target.value }))}
                                            placeholder="Or paste direct image URL (https://...)"
                                            className="w-full h-9 bg-white border border-slate-200 rounded-xl px-3 text-xs text-primary outline-none focus:ring-2 focus:ring-primary/10"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Customer & Vehicle Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Customer Name / Label</label>
                                    <input
                                        type="text"
                                        value={form.customer_name}
                                        onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))}
                                        placeholder="e.g. Abhishek Kulkarni"
                                        className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs text-primary font-medium outline-none focus:ring-2 focus:ring-primary/10"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Car Model / Title</label>
                                    <input
                                        type="text"
                                        value={form.car_title}
                                        onChange={e => setForm(p => ({ ...p, car_title: e.target.value }))}
                                        placeholder="e.g. 2021 Hyundai Creta"
                                        className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs text-primary font-medium outline-none focus:ring-2 focus:ring-primary/10"
                                    />
                                </div>
                            </div>

                            {/* Delivery Date & Quick Links */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Delivery Date</label>
                                    <input
                                        type="date"
                                        value={form.delivery_date}
                                        onChange={e => setForm(p => ({ ...p, delivery_date: e.target.value }))}
                                        className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs text-primary font-medium outline-none focus:ring-2 focus:ring-primary/10"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Customer City</label>
                                    <input
                                        type="text"
                                        value={form.customer_city}
                                        onChange={e => setForm(p => ({ ...p, customer_city: e.target.value }))}
                                        placeholder="e.g. Pune"
                                        className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs text-primary font-medium outline-none focus:ring-2 focus:ring-primary/10"
                                    />
                                </div>
                            </div>

                            {/* Optional quick selectors accordion/box */}
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Quick Auto-Fill from CRM / Inventory (Optional)
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <select
                                        value={form.customer_id}
                                        onChange={e => handleSelectCustomer(e.target.value)}
                                        className="w-full h-8 bg-white border border-slate-200 rounded-lg px-2 text-[11px] text-primary outline-none"
                                    >
                                        <option value="">-- Link Customer --</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.full_name} ({c.city || 'Pune'})
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={form.inventory_id}
                                        onChange={e => handleSelectInventory(e.target.value)}
                                        className="w-full h-8 bg-white border border-slate-200 rounded-lg px-2 text-[11px] text-primary outline-none"
                                    >
                                        <option value="">-- Link Vehicle --</option>
                                        {inventory.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.year} {c.make} {c.model}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Featured Switch & Display Order */}
                            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="featured_switch"
                                        checked={form.is_featured}
                                        onChange={e => setForm(p => ({ ...p, is_featured: e.target.checked }))}
                                        className="size-4 text-primary focus:ring-primary accent-primary rounded cursor-pointer"
                                    />
                                    <label htmlFor="featured_switch" className="cursor-pointer">
                                        <p className="text-xs font-bold text-slate-800">Show on Homepage Carousel</p>
                                        <p className="text-[10px] text-slate-400">Display this photo in the live public carousel</p>
                                    </label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-slate-500">Order:</span>
                                    <input
                                        type="number"
                                        value={form.display_order}
                                        onChange={e => setForm(p => ({ ...p, display_order: Number(e.target.value) || 0 }))}
                                        className="w-14 h-8 text-center bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                        title="Lower numbers appear first"
                                    />
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 h-10 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || uploadingImage}
                                    className="px-6 h-10 bg-primary hover:bg-primary-light text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center gap-2 disabled:opacity-60 cursor-pointer"
                                >
                                    {saving ? (
                                        <>
                                            <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Saving Photo…
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="size-4" />
                                            Save Photo
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Lightbox Modal */}
            {lightboxUrl && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
                    onClick={() => setLightboxUrl(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setLightboxUrl(null)}
                            className="absolute -top-12 right-0 size-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                            title="Close"
                        >
                            <X className="size-6" />
                        </button>
                        <img
                            src={lightboxUrl}
                            alt="Full resolution preview"
                            className="max-h-[80vh] max-w-full w-auto object-contain rounded-2xl shadow-2xl border border-white/20"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminHappyCustomers;
