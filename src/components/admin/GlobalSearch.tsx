import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { 
    Search, 
    X, 
    ArrowLeft, 
    User, 
    Users, 
    Car, 
    Calendar, 
    Receipt, 
    CheckSquare, 
    FileText, 
    History, 
    PhoneCall, 
    ChevronRight,
    CornerDownLeft,
    Sparkles,
    SlidersHorizontal
} from 'lucide-react';
import clsx from 'clsx';
import HighlightText from '../ui/HighlightText';

type SearchCategory = 'All' | 'Leads' | 'Customers' | 'Inventory' | 'Bookings' | 'Sales' | 'Tasks' | 'Notes';

interface SearchResult {
    id: string;
    type: string;
    category: SearchCategory;
    title: string;
    subtitle: string;
    url: string;
    icon: string;
    color: string;
    badgeColor: string;
    matchedNote?: string;
}

const CATEGORIES: { label: SearchCategory; icon: string }[] = [
    { label: 'All', icon: 'apps' },
    { label: 'Leads', icon: 'person' },
    { label: 'Customers', icon: 'contacts' },
    { label: 'Inventory', icon: 'directions_car' },
    { label: 'Bookings', icon: 'event' },
    { label: 'Sales', icon: 'point_of_sale' },
    { label: 'Tasks', icon: 'task' },
    { label: 'Notes', icon: 'description' },
];

const GlobalSearch: React.FC = () => {
    const { leads = [], customers = [], inventory = [], bookings = [], sales = [], tasks = [], activities = [], followUps = [] } = useData();
    const navigate = useNavigate();
    
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<SearchCategory>('All');
    const [selectedIndex, setSelectedIndex] = useState(-1);
    
    const desktopInputRef = useRef<HTMLInputElement>(null);
    const mobileInputRef = useRef<HTMLInputElement>(null);
    const modalInputRef = useRef<HTMLInputElement>(null);
    const resultsContainerRef = useRef<HTMLDivElement>(null);

    // Prevent body scroll when search modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Handle Keyboard Shortcuts (Cmd/Ctrl + K and Escape)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape' && isOpen) {
                e.preventDefault();
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Auto-focus input on open
    useEffect(() => {
        if (isOpen) {
            // Small timeout to allow render in DOM
            const timer = setTimeout(() => {
                modalInputRef.current?.focus();
                mobileInputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Main Search Logic (Memoized for optimal performance)
    const results = useMemo<SearchResult[]>(() => {
        if (!query.trim()) return [];

        const q = query.toLowerCase().trim();
        let matches: SearchResult[] = [];
        const isMatch = (str: any) => String(str || '').toLowerCase().includes(q);

        // 1. LEADS
        if (category === 'All' || category === 'Leads') {
            leads.forEach(item => {
                if (
                    isMatch(item.full_name) ||
                    isMatch(item.phone) ||
                    isMatch(item.email) ||
                    isMatch(item.notes) ||
                    isMatch(item.internal_notes) ||
                    isMatch(item.message) ||
                    isMatch(item.car_make) ||
                    isMatch(item.car_model)
                ) {
                    let matchedNote = undefined;
                    if (isMatch(item.notes)) {
                        matchedNote = item.notes;
                    } else if (isMatch(item.internal_notes)) {
                        matchedNote = item.internal_notes;
                    } else if (isMatch(item.message)) {
                        matchedNote = item.message;
                    } else if (isMatch(item.car_make) || isMatch(item.car_model)) {
                        matchedNote = `${item.car_make || ''} ${item.car_model || ''}`;
                    }

                    matches.push({
                        id: item.id,
                        type: 'Lead',
                        category: 'Leads',
                        title: item.full_name || 'Unknown Lead',
                        subtitle: `${item.phone || 'No Phone'} • ${item.status || 'New'}`,
                        url: `/admin/leads/${item.id}?search=${encodeURIComponent(query)}`,
                        icon: 'person',
                        color: 'bg-blue-50 text-blue-600 border border-blue-200/60',
                        badgeColor: 'bg-blue-100/80 text-blue-700',
                        matchedNote: matchedNote
                    });
                }
            });
        }

        // 2. CUSTOMERS
        if (category === 'All' || category === 'Customers') {
            customers.forEach(item => {
                if (isMatch(item.full_name) || isMatch(item.phone) || isMatch(item.email) || isMatch(item.address)) {
                    matches.push({
                        id: item.id,
                        type: 'Customer',
                        category: 'Customers',
                        title: item.full_name || 'Unknown Customer',
                        subtitle: `${item.phone || 'No Phone'}${item.address ? ` • ${item.address}` : ''}`,
                        url: `/admin/customers/${item.id}`,
                        icon: 'contacts',
                        color: 'bg-emerald-50 text-emerald-600 border border-emerald-200/60',
                        badgeColor: 'bg-emerald-100/80 text-emerald-700'
                    });
                }
            });
        }

        // 3. INVENTORY
        if (category === 'All' || category === 'Inventory') {
            inventory.forEach(item => {
                if (isMatch(item.make) || isMatch(item.model) || isMatch(item.variant) || isMatch(item.registration_number) || isMatch(item.vin)) {
                    matches.push({
                        id: item.id,
                        type: 'Car',
                        category: 'Inventory',
                        title: `${item.make} ${item.model} ${item.variant || ''}`.trim(),
                        subtitle: `${item.year || ''} • ${item.registration_number || 'Unregistered'} • ${item.status || 'Available'}`,
                        url: `/admin/inventory/${item.id}`,
                        icon: 'directions_car',
                        color: 'bg-indigo-50 text-indigo-600 border border-indigo-200/60',
                        badgeColor: 'bg-indigo-100/80 text-indigo-700'
                    });
                }
            });
        }

        // 4. BOOKINGS
        if (category === 'All' || category === 'Bookings') {
            bookings.forEach(item => {
                if (isMatch(item.booking_status) || isMatch(item.notes) || isMatch(item.amount)) {
                    const carName = item.car ? `${item.car.make} ${item.car.model}` : 'Unknown Car';
                    const leadName = item.lead ? item.lead.full_name : 'Unknown Lead';
                    matches.push({
                        id: item.id,
                        type: 'Booking',
                        category: 'Bookings',
                        title: `${leadName} booked ${carName}`,
                        subtitle: `Status: ${item.booking_status || 'Pending'} • Amt: ₹${Number(item.amount || 0).toLocaleString('en-IN')}`,
                        url: `/admin/bookings/${item.id}`,
                        icon: 'event',
                        color: 'bg-purple-50 text-purple-600 border border-purple-200/60',
                        badgeColor: 'bg-purple-100/80 text-purple-700',
                        matchedNote: isMatch(item.notes) ? item.notes : undefined
                    });
                }
            });
        }

        // 5. SALES
        if (category === 'All' || category === 'Sales') {
            sales.forEach(item => {
                if (isMatch(item.sale_status) || isMatch(item.total_amount) || isMatch(item.notes)) {
                    const carName = item.car ? `${item.car.make} ${item.car.model}` : 'Unknown Car';
                    const custName = item.customer ? item.customer.full_name : 'Unknown Customer';
                    matches.push({
                        id: item.id,
                        type: 'Sale',
                        category: 'Sales',
                        title: `${carName} sold to ${custName}`,
                        subtitle: `Status: ${item.sale_status || 'Completed'} • Total: ₹${Number(item.total_amount || 0).toLocaleString('en-IN')}`,
                        url: `/admin/sales/${item.id}`,
                        icon: 'point_of_sale',
                        color: 'bg-green-50 text-green-600 border border-green-200/60',
                        badgeColor: 'bg-green-100/80 text-green-700',
                        matchedNote: isMatch(item.notes) ? item.notes : undefined
                    });
                }
            });
        }

        // 6. TASKS / FOLLOW-UPS
        if (category === 'All' || category === 'Tasks') {
            tasks.forEach(item => {
                if (isMatch(item.title) || isMatch(item.description)) {
                    matches.push({
                        id: item.id,
                        type: 'Task',
                        category: 'Tasks',
                        title: item.title || 'Untitled Task',
                        subtitle: `Due: ${item.due_date ? new Date(item.due_date).toLocaleDateString() : 'No date'} • Priority: ${item.priority || 'Normal'}`,
                        url: item.lead_id ? `/admin/leads/${item.lead_id}` : '/admin/follow-ups',
                        icon: 'task',
                        color: 'bg-amber-50 text-amber-600 border border-amber-200/60',
                        badgeColor: 'bg-amber-100/80 text-amber-700',
                        matchedNote: isMatch(item.description) ? item.description : undefined
                    });
                }
            });
            followUps.forEach(item => {
                if (isMatch(item.notes) || isMatch(item.outcome) || isMatch(item.contacted_via)) {
                    const leadName = item.lead ? item.lead.full_name : 'Lead Follow-Up';
                    matches.push({
                        id: item.id,
                        type: 'Follow-Up',
                        category: 'Tasks',
                        title: `${leadName} - ${item.contacted_via || 'Call'}`,
                        subtitle: `Outcome: ${item.outcome || 'Pending'}`,
                        url: `/admin/leads/${item.lead_id}`,
                        icon: 'phone_callback',
                        color: 'bg-orange-50 text-orange-600 border border-orange-200/60',
                        badgeColor: 'bg-orange-100/80 text-orange-700',
                        matchedNote: isMatch(item.notes) ? item.notes : undefined
                    });
                }
            });
        }

        // 7. NOTES / ACTIVITY LOGS
        if (category === 'All' || category === 'Notes') {
            activities.forEach(item => {
                if (isMatch(item.notes)) {
                    matches.push({
                        id: item.id,
                        type: 'Activity Log',
                        category: 'Notes',
                        title: `Activity on Lead`,
                        subtitle: new Date(item.created_at).toLocaleDateString(),
                        url: `/admin/leads/${item.lead_id}`,
                        icon: 'history',
                        color: 'bg-slate-100 text-slate-600 border border-slate-200',
                        badgeColor: 'bg-slate-200 text-slate-700',
                        matchedNote: item.notes
                    });
                }
            });
        }

        // Sort: exact title match first, then alphabetically by type
        matches.sort((a, b) => {
            const aTitleMatch = a.title.toLowerCase().includes(q) ? 1 : 0;
            const bTitleMatch = b.title.toLowerCase().includes(q) ? 1 : 0;
            if (aTitleMatch !== bTitleMatch) return bTitleMatch - aTitleMatch;
            return a.type.localeCompare(b.type);
        });

        return matches.slice(0, 20);
    }, [query, category, leads, customers, inventory, bookings, sales, tasks, activities, followUps]);

    // Handle keyboard arrow navigation inside results
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen || results.length === 0) return;
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < results.length) {
                    handleSelect(results[selectedIndex]);
                } else if (results.length > 0) {
                    handleSelect(results[0]);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, results, selectedIndex]);

    // Scroll active item into view
    useEffect(() => {
        if (selectedIndex >= 0 && resultsContainerRef.current) {
            const activeEl = resultsContainerRef.current.children[selectedIndex] as HTMLElement;
            if (activeEl) {
                activeEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    const handleSelect = (item: SearchResult) => {
        setIsOpen(false);
        setQuery('');
        navigate(item.url);
    };

    const handleClear = () => {
        setQuery('');
        modalInputRef.current?.focus();
        mobileInputRef.current?.focus();
    };

    // Quick Stats / Suggestions for empty state
    const quickCategories = [
        { name: 'Leads', count: leads.length, cat: 'Leads' as SearchCategory, color: 'text-blue-600 bg-blue-50 border-blue-200' },
        { name: 'Inventory', count: inventory.length, cat: 'Inventory' as SearchCategory, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
        { name: 'Customers', count: customers.length, cat: 'Customers' as SearchCategory, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
        { name: 'Sales', count: sales.length, cat: 'Sales' as SearchCategory, color: 'text-green-600 bg-green-50 border-green-200' },
        { name: 'Tasks', count: tasks.length, cat: 'Tasks' as SearchCategory, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    ];

    return (
        <>
            {/* ─── Inline Header Trigger (Mobile & Desktop) ────────────────── */}
            <div className="relative w-full max-w-2xl">
                {/* Desktop Trigger Input */}
                <div 
                    onClick={() => setIsOpen(true)}
                    className="hidden sm:flex items-center gap-2.5 bg-slate-50/80 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-xl h-10 px-3.5 cursor-text transition-all group shadow-sm"
                >
                    <Search size={16} className="text-slate-400 group-hover:text-primary transition-colors shrink-0" />
                    <span className="text-sm text-slate-400 font-medium truncate flex-1 select-none">
                        Search leads, inventory, customers, notes...
                    </span>
                    <kbd className="hidden md:inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-400 bg-white border border-slate-200 rounded-md px-1.5 py-0.5 shadow-xs">
                        <span className="text-xs">⌘</span>K
                    </kbd>
                </div>

                {/* Mobile Compact Trigger Button */}
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="flex sm:hidden items-center gap-2 bg-slate-100/90 hover:bg-slate-200/80 text-slate-600 rounded-xl h-9 px-3 w-full transition-all active:scale-[0.98]"
                >
                    <Search size={15} className="text-slate-500 shrink-0" />
                    <span className="text-xs text-slate-500 font-medium truncate flex-1 text-left">
                        Search everything...
                    </span>
                </button>
            </div>

            {/* ─── Search Overlay Modal (Responsive Mobile Fullscreen + Desktop Command Palette) ─── */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex flex-col md:items-center md:justify-start md:pt-16 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
                    
                    {/* Backdrop click to dismiss on desktop */}
                    <div 
                        className="hidden md:block absolute inset-0 -z-10" 
                        onClick={() => setIsOpen(false)} 
                    />

                    {/* Main Dialog Container */}
                    <div className="w-full h-[100dvh] md:h-auto md:max-h-[85vh] md:max-w-2xl bg-white md:rounded-2xl shadow-2xl flex flex-col overflow-hidden border-0 md:border border-slate-200/80">
                        
                        {/* ── 1. Top Search Header ── */}
                        <div className="flex items-center gap-2 p-3 sm:p-4 border-b border-slate-100 bg-white shrink-0">
                            {/* Mobile Back Button */}
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="sm:hidden size-9 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
                                aria-label="Close search"
                            >
                                <ArrowLeft size={20} />
                            </button>

                            {/* Search Icon on desktop */}
                            <div className="hidden sm:flex size-9 rounded-xl items-center justify-center text-slate-400 shrink-0">
                                <Search size={20} />
                            </div>

                            {/* Search Input Box */}
                            <div className="flex-1 relative flex items-center">
                                <input
                                    ref={modalInputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => {
                                        setQuery(e.target.value);
                                        setSelectedIndex(-1);
                                    }}
                                    placeholder="Search leads, cars, customers, notes..."
                                    className="w-full text-base sm:text-lg font-medium text-slate-900 placeholder:text-slate-400 bg-transparent border-0 outline-none pr-8"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    spellCheck="false"
                                />
                                {query && (
                                    <button
                                        type="button"
                                        onClick={handleClear}
                                        className="absolute right-0 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Desktop Escape / Close Badge */}
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="hidden sm:flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg px-2 py-1 transition-colors"
                            >
                                <kbd className="text-[10px]">ESC</kbd>
                            </button>
                        </div>

                        {/* ── 2. Horizontal Scrollable Category Filter Pills ── */}
                        <div className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-50/90 border-b border-slate-100 overflow-x-auto no-scrollbar shrink-0">
                            {CATEGORIES.map((cat) => {
                                const isActive = category === cat.label;
                                return (
                                    <button
                                        key={cat.label}
                                        type="button"
                                        onClick={() => {
                                            setCategory(cat.label);
                                            modalInputRef.current?.focus();
                                        }}
                                        className={clsx(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0",
                                            isActive
                                                ? "bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/10"
                                                : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100 hover:text-slate-900"
                                        )}
                                    >
                                        <span className="material-symbols-outlined text-[15px] opacity-80">{cat.icon}</span>
                                        <span>{cat.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* ── 3. Results & Content Area ── */}
                        <div 
                            ref={resultsContainerRef}
                            className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-1.5 divide-y-0 overscroll-contain"
                        >
                            {!query.trim() ? (
                                /* Empty / Initial Prompt State */
                                <div className="py-8 sm:py-12 px-4 flex flex-col items-center justify-center text-center">
                                    <div className="size-14 sm:size-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                                        <Search size={28} className="opacity-50" />
                                    </div>
                                    <h3 className="text-sm sm:text-base font-bold text-slate-800">
                                        Search Everything in Command Center
                                    </h3>
                                    <p className="text-xs sm:text-sm text-slate-500 max-w-sm mt-1 mb-5">
                                        Find leads, customer profiles, cars by VIN or number plate, bookings, invoices, and notes.
                                    </p>

                                    {/* Quick Category Shortcuts */}
                                    <div className="w-full max-w-md">
                                        <div className="flex items-center gap-2 mb-2.5 justify-center">
                                            <Sparkles size={13} className="text-amber-500" />
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                Jump directly to category
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {quickCategories.map((item) => (
                                                <button
                                                    key={item.name}
                                                    type="button"
                                                    onClick={() => {
                                                        setCategory(item.cat);
                                                        modalInputRef.current?.focus();
                                                    }}
                                                    className={clsx(
                                                        "flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]",
                                                        item.color
                                                    )}
                                                >
                                                    <span>{item.name}</span>
                                                    <span className="text-[11px] font-bold opacity-80 bg-white/60 px-1.5 py-0.5 rounded-md">
                                                        {item.count}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : results.length === 0 ? (
                                /* No Matches State */
                                <div className="py-12 px-4 flex flex-col items-center justify-center text-center text-slate-400">
                                    <div className="size-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                                        <span className="material-symbols-outlined text-3xl opacity-40">search_off</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700">No results found for &ldquo;{query}&rdquo;</p>
                                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                                        Check for spelling errors or try switching to another filter category.
                                    </p>
                                    {category !== 'All' && (
                                        <button
                                            type="button"
                                            onClick={() => setCategory('All')}
                                            className="mt-4 px-4 py-2 text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                        >
                                            Search in All Categories
                                        </button>
                                    )}
                                </div>
                            ) : (
                                /* Search Results List */
                                results.map((item, idx) => {
                                    const isSelected = selectedIndex === idx;
                                    return (
                                        <button
                                            key={`${item.id}-${idx}`}
                                            type="button"
                                            onClick={() => handleSelect(item)}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                            className={clsx(
                                                "w-full text-left p-3 rounded-xl flex items-start gap-3 transition-all duration-100 group border active:scale-[0.99]",
                                                isSelected
                                                    ? "bg-slate-100/90 border-slate-300/80 shadow-xs"
                                                    : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200"
                                            )}
                                        >
                                            {/* Type Icon */}
                                            <div className={clsx("size-10 rounded-xl flex items-center justify-center shrink-0", item.color)}>
                                                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                                    <p className="text-sm font-bold text-slate-900 truncate">
                                                        <HighlightText text={item.title} highlight={query} />
                                                    </p>
                                                    <span className={clsx(
                                                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0",
                                                        item.badgeColor
                                                    )}>
                                                        {item.type}
                                                    </span>
                                                </div>

                                                <p className="text-xs text-slate-500 truncate">
                                                    <HighlightText text={item.subtitle} highlight={query} />
                                                </p>

                                                {/* Matched Note / Message Context Snippet */}
                                                {item.matchedNote && (
                                                    <div className="mt-1.5 p-2 bg-amber-50/70 border border-amber-200/60 rounded-lg">
                                                        <p className="text-[11px] text-slate-700 line-clamp-1">
                                                            <span className="font-semibold text-amber-800">Match in notes: </span>
                                                            &ldquo;<HighlightText 
                                                                text={
                                                                    item.matchedNote.length > 80 
                                                                        ? `${item.matchedNote.substring(Math.max(0, item.matchedNote.toLowerCase().indexOf(query.toLowerCase()) - 20), item.matchedNote.toLowerCase().indexOf(query.toLowerCase()) + 60)}...`
                                                                        : item.matchedNote
                                                                } 
                                                                highlight={query} 
                                                            />&rdquo;
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Chevron indicator on hover / touch */}
                                            <div className="self-center hidden sm:block text-slate-300 group-hover:text-slate-600 transition-colors">
                                                <ChevronRight size={16} />
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* ── 4. Footer Bar ── */}
                        <div className="bg-slate-50 border-t border-slate-100 p-2.5 sm:p-3 flex items-center justify-between px-4 shrink-0">
                            {/* Desktop Keyboard Hints */}
                            <div className="hidden sm:flex items-center gap-4 text-[11px] font-medium text-slate-500">
                                <span className="flex items-center gap-1">
                                    <kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 font-sans shadow-2xs">↑</kbd>
                                    <kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 font-sans shadow-2xs">↓</kbd>
                                    <span>to navigate</span>
                                </span>
                                <span className="flex items-center gap-1">
                                    <kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 font-sans shadow-2xs">↵</kbd>
                                    <span>to select</span>
                                </span>
                                <span className="flex items-center gap-1">
                                    <kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 font-sans shadow-2xs">esc</kbd>
                                    <span>to close</span>
                                </span>
                            </div>

                            {/* Mobile Touch Footer Summary */}
                            <div className="sm:hidden flex items-center justify-between w-full text-xs text-slate-500 font-medium">
                                <span>
                                    {results.length > 0 
                                        ? `${results.length} match${results.length !== 1 ? 'es' : ''} found` 
                                        : 'Tap anywhere outside or back to dismiss'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-xs"
                                >
                                    Done
                                </button>
                            </div>

                            {/* Desktop Result Count */}
                            {results.length > 0 && (
                                <span className="hidden sm:inline-block text-xs font-bold text-slate-500">
                                    {results.length} result{results.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </>
    );
};

export default GlobalSearch;

