import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { X, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getPrimaryImage, formatPriceLakh } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useInquiryCart } from '../contexts/InquiryCartContext';
import { motion, AnimatePresence } from 'framer-motion';

interface Car {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
    fuel_type: string;
    transmission: string;
    mileage: number;
    images: string[];
    status: string;
    created_at: string;
    condition: string;
    body_type?: string;
}

const Inventory = () => {
    const [searchParams] = useSearchParams();
    const { addToCart, isInCart, setIsCartOpen } = useInquiryCart();
    
    const [cars, setCars] = useState<Car[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const { user } = useAuth();

    const [sortBy, setSortBy] = useState('newest');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showFilters, setShowFilters] = useState(false);
    
    // Filters
    const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
    const [selectedYears, setSelectedYears] = useState<string[]>([]);
    const [selectedBudget, setSelectedBudget] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBodyTypes, setSelectedBodyTypes] = useState<string[]>([]);
    const [selectedTransmissions, setSelectedTransmissions] = useState<string[]>([]);

    // Wishlist state
    const [wishlist, setWishlist] = useState<string[]>([]);

    useEffect(() => {
        // Load wishlist
        const loadWishlist = async () => {
            if (!user) {
                setWishlist([]);
                return;
            }
            const { data } = await supabase.from('user_wishlist').select('inventory_id').eq('user_id', user.id);
            setWishlist(data?.map(w => w.inventory_id) || []);
        };
        loadWishlist();

        const fetchInventory = async () => {
            setLoading(true);
            setError(false);
            const { data, error: err } = await supabase
                .from('inventory')
                .select('*')
                .in('status', ['available', 'reserved'])
                .order('created_at', { ascending: false });
                
            if (err) {
                setError(true);
            } else if (data) {
                setCars(data);
            }
            setLoading(false);
        };
        fetchInventory();
    }, [user]);

    // Synchronize URL search parameters with component state
    useEffect(() => {
        const searchVal = searchParams.get('search') || '';
        setSearchQuery(searchVal);
        
        const budgetVal = searchParams.get('budget') || '';
        setSelectedBudget(budgetVal);
        
        const makeVal = searchParams.get('make');
        setSelectedBrands(makeVal ? [makeVal] : []);
        
        const yearVal = searchParams.get('year');
        setSelectedYears(yearVal ? [yearVal] : []);

        const bodyTypeVal = searchParams.get('body_type');
        setSelectedBodyTypes(bodyTypeVal ? bodyTypeVal.split(',') : []);

        const transmissionVal = searchParams.get('transmission');
        setSelectedTransmissions(transmissionVal ? transmissionVal.split(',') : []);
    }, [searchParams]);

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

    const toggleBrand = (brand: string) => {
        setSelectedBrands(prev => prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]);
    };

    const toggleYear = (year: string) => {
        setSelectedYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);
    };

    // Calculate dynamic brands array based on fetched inventory
    const brandCounts = useMemo(() => {
        const counts = cars.reduce((acc, car) => {
            acc[car.make] = (acc[car.make] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count);
    }, [cars]);

    // Calculate dynamic years based on inventory
    const availableYears = useMemo(() => {
        return Array.from(new Set(cars.map(c => String(c.year)))).sort().reverse();
    }, [cars]);

    // Apply filtering and sorting
    let displayCars = cars.filter(car => {
        // Keyword text search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesMake = car.make?.toLowerCase().includes(query);
            const matchesModel = car.model?.toLowerCase().includes(query);
            const matchesYear = String(car.year).includes(query);
            const matchesFuel = car.fuel_type?.toLowerCase().includes(query);
            const matchesTrans = car.transmission?.toLowerCase().includes(query);
            if (!matchesMake && !matchesModel && !matchesYear && !matchesFuel && !matchesTrans) {
                return false;
            }
        }

        // Brand filter
        if (selectedBrands.length > 0 && !selectedBrands.includes(car.make)) return false;
        
        // Year filter
        if (selectedYears.length > 0 && !selectedYears.includes(String(car.year))) return false;
        
        // Budget filter
        if (selectedBudget) {
            if (selectedBudget === 'under5' && car.price > 500000) return false;
            if (selectedBudget === '5to10' && (car.price < 500000 || car.price > 1000000)) return false;
            if (selectedBudget === '10to20' && (car.price < 1000000 || car.price > 2000000)) return false;
            if (selectedBudget === '20plus' && car.price < 2000000) return false;
        }

        // Body Type filter
        if (selectedBodyTypes.length > 0 && !selectedBodyTypes.some(bt => (car.body_type || '').toLowerCase() === bt.toLowerCase())) {
            return false;
        }

        // Transmission filter
        if (selectedTransmissions.length > 0 && !selectedTransmissions.some(t => (car.transmission || '').toLowerCase() === t.toLowerCase())) {
            return false;
        }

        return true;
    });
    
    if (sortBy === 'price-low') {
        displayCars.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
        displayCars.sort((a, b) => b.price - a.price);
    } else {
        displayCars.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    const renderFiltersContent = () => (
        <>
            {/* Budget Range */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                <h4 className="font-semibold text-primary text-sm mb-3">
                    Budget Range
                </h4>
                <div className="space-y-2.5 text-sm text-slate-700">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="radio" name="budget" checked={selectedBudget === ''} onChange={() => setSelectedBudget('')} className="accent-primary" /> Any Budget
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="radio" name="budget" checked={selectedBudget === 'under5'} onChange={() => setSelectedBudget('under5')} className="accent-primary" /> Under ₹5 Lakh
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="radio" name="budget" checked={selectedBudget === '5to10'} onChange={() => setSelectedBudget('5to10')} className="accent-primary" /> ₹5 Lakh - ₹10 Lakh
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="radio" name="budget" checked={selectedBudget === '10to20'} onChange={() => setSelectedBudget('10to20')} className="accent-primary" /> ₹10 Lakh - ₹20 Lakh
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="radio" name="budget" checked={selectedBudget === '20plus'} onChange={() => setSelectedBudget('20plus')} className="accent-primary" /> ₹20 Lakh+
                    </label>
                </div>
            </div>

            {/* Make & Model */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                <h4 className="font-semibold text-primary text-sm mb-3 flex items-center justify-between">
                    Make & Model
                </h4>
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-2">
                    {brandCounts.length === 0 && <p className="text-sm text-slate-400">Loading brands...</p>}
                    {brandCounts.map(b => (
                        <label key={b.name} className="flex items-center gap-3 cursor-pointer group">
                            <div className={`size-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${selectedBrands.includes(b.name) ? 'bg-primary border-primary' : 'border-slate-300 group-hover:border-primary'}`}>
                                {selectedBrands.includes(b.name) && <span className="material-symbols-outlined text-white text-sm">check</span>}
                            </div>
                            <span className="text-sm text-slate-700 flex-1 truncate">{b.name} <span className="text-xs text-slate-400 ml-1">({b.count})</span></span>
                            <input type="checkbox" className="hidden" checked={selectedBrands.includes(b.name)} onChange={() => toggleBrand(b.name)} />
                        </label>
                    ))}
                </div>
            </div>

            {/* Year */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                <h4 className="font-semibold text-primary text-sm mb-3 flex items-center justify-between">
                    Model Year
                </h4>
                <div className="space-y-2.5 max-h-40 overflow-y-auto pr-2">
                    {availableYears.map(year => (
                        <label key={year} className="flex items-center gap-3 cursor-pointer group">
                            <div className={`size-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${selectedYears.includes(year) ? 'bg-primary border-primary' : 'border-slate-300 group-hover:border-primary'}`}>
                                {selectedYears.includes(year) && <span className="material-symbols-outlined text-white text-sm">check</span>}
                            </div>
                            <span className="text-sm text-slate-700 flex-1">{year}</span>
                            <input type="checkbox" className="hidden" checked={selectedYears.includes(year)} onChange={() => toggleYear(year)} />
                        </label>
                    ))}
                </div>
            </div>
        </>
    );

    return (
        <div className="container-main py-4 sm:py-8">
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                {/* Mobile Filter Toggle */}
                <div className="lg:hidden flex items-center justify-between bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-2">
                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 text-sm font-bold text-primary"
                    >
                        <span className="material-symbols-outlined">filter_list</span>
                        {showFilters ? 'Hide Filters' : 'Show Filters'}
                    </button>
                    <span className="text-xs text-slate-400 font-medium">{displayCars.length} Cars Found</span>
                </div>

                {/* Desktop Filters Sidebar */}
                <aside className="hidden lg:block lg:w-[16.25rem] shrink-0">
                    <div className="lg:sticky lg:top-[5.5rem] space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-primary font-display text-lg">Filters</h3>
                            <button onClick={() => { setSelectedBrands([]); setSelectedYears([]); setSelectedBudget(''); setSelectedBodyTypes([]); setSelectedTransmissions([]); }} className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors">Clear All</button>
                        </div>
                        {renderFiltersContent()}
                    </div>
                </aside>

                {/* Mobile Filters Slide-up Drawer Overlay */}
                <AnimatePresence>
                    {showFilters && (
                        <>
                            {/* Backdrop overlay */}
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.5 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowFilters(false)}
                                className="lg:hidden fixed inset-0 bg-black z-[60]"
                            />
                            {/* Bottom sheet */}
                            <motion.div 
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                                className="lg:hidden fixed inset-x-0 bottom-0 top-[15%] z-[70] bg-white rounded-t-3xl p-6 overflow-y-auto shadow-2xl flex flex-col"
                            >
                                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                                    <h3 className="font-bold text-primary font-display text-lg">Filters</h3>
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => { setSelectedBrands([]); setSelectedYears([]); setSelectedBudget(''); setSelectedBodyTypes([]); setSelectedTransmissions([]); }} className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors">Clear All</button>
                                        <button onClick={() => setShowFilters(false)} className="p-1.5 bg-slate-50 text-slate-400 hover:text-primary rounded-full flex items-center justify-center">
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-5 flex-1 pb-16">
                                    {renderFiltersContent()}
                                </div>
                                <div className="sticky bottom-0 bg-white pt-4 pb-2 border-t border-slate-100 mt-auto">
                                    <button onClick={() => setShowFilters(false)} className="w-full h-12 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all shadow-md text-sm">
                                        Apply & View {displayCars.length} Results
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-primary font-display mb-1.5 leading-tight uppercase tracking-tight">Used Car Inventory</h1>
                            <p className="text-xs sm:text-sm text-slate-500 max-w-lg">Certified pre-owned vehicles in Kolhapur with 120+ points check.</p>
                        </div>

                        {/* Search Input Bar */}
                        <div className="relative flex-1 max-w-md w-full">
                            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    const params = new URLSearchParams(window.location.search);
                                    if (e.target.value) {
                                        params.set('search', e.target.value);
                                    } else {
                                        params.delete('search');
                                    }
                                    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                                }}
                                className="w-full h-11 bg-white border border-slate-200 rounded-2xl pl-11 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 shadow-sm transition-all"
                                placeholder="Search by model, brand, transmission..."
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => {
                                        setSearchQuery('');
                                        const params = new URLSearchParams(window.location.search);
                                        params.delete('search');
                                        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                                    }}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary flex items-center"
                                    aria-label="Clear Search"
                                >
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Active Filters Pills */}
                    {(selectedBrands.length > 0 || selectedYears.length > 0 || selectedBudget || searchQuery || selectedBodyTypes.length > 0 || selectedTransmissions.length > 0) && (
                        <div className="flex flex-wrap gap-2 mb-6 items-center">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">Active Filters:</span>
                            
                            {selectedBodyTypes.map(bt => (
                                <span key={bt} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-slate-200">
                                    Type: {bt}
                                    <button onClick={() => setSelectedBodyTypes(prev => prev.filter(x => x !== bt))} className="hover:bg-slate-200 rounded p-0.5">
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}

                            {selectedTransmissions.map(t => (
                                <span key={t} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-slate-200">
                                    Transmission: {t}
                                    <button onClick={() => setSelectedTransmissions(prev => prev.filter(x => x !== t))} className="hover:bg-slate-200 rounded p-0.5">
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}
                            
                            {searchQuery && (
                                <span className="inline-flex items-center gap-1.5 bg-primary text-white text-[11px] font-semibold px-3 py-1.5 rounded-xl shadow-sm">
                                    Search: "{searchQuery}"
                                    <button 
                                        onClick={() => {
                                            setSearchQuery('');
                                            const params = new URLSearchParams(window.location.search);
                                            params.delete('search');
                                            window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
                                        }}
                                        className="hover:bg-white/20 rounded p-0.5"
                                    >
                                        <X size={10} />
                                    </button>
                                </span>
                            )}
                            
                            {selectedBudget && (
                                <span className="inline-flex items-center gap-1.5 bg-accent/25 text-primary text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-accent/20">
                                    Budget: {selectedBudget === 'under5' ? 'Under ₹5L' : selectedBudget === '5to10' ? '₹5L - ₹10L' : selectedBudget === '10to20' ? '₹10L - ₹20L' : '₹20L+'}
                                    <button onClick={() => setSelectedBudget('')} className="hover:bg-black/10 rounded p-0.5">
                                        <X size={10} />
                                    </button>
                                </span>
                            )}
                            
                            {selectedBrands.map(b => (
                                <span key={b} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-slate-200">
                                    {b}
                                    <button onClick={() => toggleBrand(b)} className="hover:bg-slate-200 rounded p-0.5">
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}
                            
                            {selectedYears.map(y => (
                                <span key={y} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-slate-200">
                                    {y}
                                    <button onClick={() => toggleYear(y)} className="hover:bg-slate-200 rounded p-0.5">
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}
                            
                            <button 
                                onClick={() => {
                                    setSelectedBrands([]);
                                    setSelectedYears([]);
                                    setSelectedBudget('');
                                    setSearchQuery('');
                                    setSelectedBodyTypes([]);
                                    setSelectedTransmissions([]);
                                    const params = new URLSearchParams(window.location.search);
                                    params.delete('search');
                                    params.delete('make');
                                    params.delete('budget');
                                    params.delete('year');
                                    params.delete('body_type');
                                    params.delete('transmission');
                                    window.history.replaceState({}, '', window.location.pathname);
                                }}
                                className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline px-2 py-1"
                            >
                                Clear All
                            </button>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-6 gap-3 sm:gap-4">
                        <div className="flex items-center justify-between sm:justify-start gap-4 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-xs sm:text-sm text-slate-500">
                                Showing <strong className="text-primary font-black">{displayCars.length}</strong> <span className="hidden xs:inline">Cars</span>
                            </p>
                            <div className="sm:hidden h-4 w-px bg-slate-200" />
                            <div className="flex items-center gap-1 sm:hidden">
                                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg ${viewMode === 'grid' ? 'text-primary' : 'text-slate-300'}`}>
                                    <span className="material-symbols-outlined text-lg">grid_view</span>
                                </button>
                                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg ${viewMode === 'list' ? 'text-primary' : 'text-slate-300'}`}>
                                    <span className="material-symbols-outlined text-lg">view_list</span>
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 h-10 flex-1 sm:flex-initial shadow-sm">
                                <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase whitespace-nowrap">Sort:</span>
                                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-transparent border-none text-[11px] sm:text-sm font-black text-primary outline-none flex-1">
                                    <option value="newest">Newest</option>
                                    <option value="price-low">Lowest Price</option>
                                    <option value="price-high">Highest Price</option>
                                </select>
                            </div>
                            <div className="hidden sm:flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-10">
                                <button onClick={() => setViewMode('grid')} className={`px-3 ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-slate-400 hover:text-primary'}`}>
                                    <span className="material-symbols-outlined text-lg">grid_view</span>
                                </button>
                                <button onClick={() => setViewMode('list')} className={`px-3 ${viewMode === 'list' ? 'bg-primary text-white' : 'text-slate-400 hover:text-primary'}`}>
                                    <span className="material-symbols-outlined text-lg">view_list</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Car Grid */}
                    {loading ? (
                        <div className="py-20 text-center text-slate-400 font-medium">Fetching live inventory...</div>
                    ) : error ? (
                        <div className="py-20 text-center">
                            <span className="material-symbols-outlined text-red-400 text-4xl mb-2">error</span>
                            <p className="text-slate-500 font-medium">Failed to load inventory.</p>
                            <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100">Try Again</button>
                        </div>
                    ) : displayCars.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 font-medium">No cars found matching your criteria.</div>
                    ) : (
                        <div className={`grid gap-4 sm:gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                            {displayCars.map(car => {
                                const isSaved = wishlist.includes(car.id);
                                return (
                                    <article key={car.id} className={`bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all duration-300 group relative ${viewMode === 'list' ? 'flex flex-col sm:flex-row' : 'flex flex-col'}`}>
                                        <Link to={`/car/${car.id}`} className={`flex flex-col flex-1 ${viewMode === 'list' ? 'sm:flex-row' : ''}`}>
                                            <div className={`relative overflow-hidden bg-slate-100 ${viewMode === 'list' ? 'w-full sm:w-1/3 aspect-[16/11] sm:aspect-auto sm:h-full' : 'aspect-[16/11]'}`}>
                                                <img alt={`${car.year} ${car.make} ${car.model}`} src={getPrimaryImage(car.images)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                <div className="absolute top-3 left-3 flex gap-2">
                                                    {car.condition === 'Excellent' && (
                                                        <span className="text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider text-white bg-green-600">
                                                            <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-xs">verified</span>Certified</span>
                                                        </span>
                                                    )}
                                                    {car.status === 'reserved' && (
                                                        <span className="text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider text-white bg-amber-600">
                                                            Reserved
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="absolute bottom-3 left-3 bg-black/60 text-white text-[10px] font-medium px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-xs">photo_library</span> {car.images?.length || 0} Photos
                                                </div>
                                            </div>

                                            <div className="p-5 flex flex-col flex-1">
                                                <h3 className="text-base font-bold text-primary font-display line-clamp-1" title={`${car.year} ${car.make} ${car.model}`}>
                                                    {car.year} {car.make} {car.model}
                                                </h3>
                                                <p className="text-xs text-slate-500 mb-3 line-clamp-1">{car.fuel_type} • {car.transmission}</p>
                                                
                                                <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">speed</span>{(car.mileage || 0).toLocaleString()} km</span>
                                                    <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
                                                    <span>{car.fuel_type}</span>
                                                    <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
                                                    <span>{car.transmission}</span>
                                                </div>
                                            </div>
                                        </Link>

                                        <button 
                                            className={`absolute top-3 right-3 p-2 bg-white/90 rounded-full transition-colors shadow-sm backdrop-blur-sm z-10 ${isSaved ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}
                                            onClick={(e) => toggleWishlist(e, car.id)}
                                        >
                                            <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} />
                                        </button>
                                        
                                        <div className={`px-5 pb-5 mt-auto ${viewMode === 'list' ? 'sm:w-1/3 sm:border-l sm:border-slate-100 sm:flex sm:flex-col sm:justify-center' : ''}`}>
                                            <div className="flex items-baseline gap-2 mb-4">
                                                <span className="text-xl font-black text-primary font-display">₹ {formatPriceLakh(car.price)} Lakh</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <Link to={`/book-test-drive?car=${car.id}`} className="flex-1 h-10 flex items-center justify-center text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                                                    Test Drive
                                                </Link>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (isInCart(car.id)) {
                                                            setIsCartOpen(true);
                                                        } else {
                                                            addToCart(car);
                                                        }
                                                    }}
                                                    className={`flex-1 h-10 flex items-center justify-center text-xs font-semibold rounded-xl transition-all duration-200 gap-1.5 ${isInCart(car.id) ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100/70' : 'bg-primary text-white hover:bg-primary-light'}`}
                                                >
                                                    <span className="material-symbols-outlined text-sm">{isInCart(car.id) ? 'done' : 'folder_special'}</span>
                                                    {isInCart(car.id) ? 'In Inquiry' : 'Add to Inquiry'}
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Inventory;
