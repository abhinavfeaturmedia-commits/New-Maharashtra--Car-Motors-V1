import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { Search, X, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import HighlightText from '../ui/HighlightText';

type SearchCategory = 'All' | 'Leads' | 'Customers' | 'Inventory' | 'Bookings' | 'Sales' | 'Tasks' | 'Notes';

interface SearchResult {
    id: string;
    type: string;
    title: string;
    subtitle: string;
    url: string;
    icon: string;
    color: string;
    matchedNote?: string;
}

const GlobalSearch = () => {
    const { leads, customers, inventory, bookings, sales, tasks, activities, followUps } = useData();
    const navigate = useNavigate();
    
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<SearchCategory>('All');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Handle Keyboard Shortcuts (Cmd/Ctrl + K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 100);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Handle arrow keys inside dropdown
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

    const handleSelect = (item: SearchResult) => {
        setIsOpen(false);
        setQuery('');
        navigate(item.url);
    };

    // Main Search Logic
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setSelectedIndex(-1);
            return;
        }

        const q = query.toLowerCase();
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
                        title: item.full_name || 'Unknown Lead',
                        subtitle: `${item.phone || 'No Phone'} • ${item.status || 'New'}`,
                        url: `/admin/leads/${item.id}?search=${encodeURIComponent(query)}`,
                        icon: 'person',
                        color: 'bg-blue-100 text-blue-600',
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
                        title: item.full_name || 'Unknown Customer',
                        subtitle: `${item.phone || 'No Phone'}`,
                        url: `/admin/customers/${item.id}`,
                        icon: 'contacts',
                        color: 'bg-emerald-100 text-emerald-600'
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
                        type: 'Inventory',
                        title: `${item.make} ${item.model} ${item.variant || ''}`.trim(),
                        subtitle: `${item.year || ''} • ${item.registration_number || 'Unregistered'} • ${item.status}`,
                        url: `/admin/inventory/${item.id}`,
                        icon: 'directions_car',
                        color: 'bg-indigo-100 text-indigo-600'
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
                        title: `${leadName} booked ${carName}`,
                        subtitle: `Status: ${item.booking_status} • Amt: ₹${item.amount}`,
                        url: `/admin/bookings/${item.id}`,
                        icon: 'event',
                        color: 'bg-purple-100 text-purple-600',
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
                        title: `${carName} sold to ${custName}`,
                        subtitle: `Status: ${item.sale_status} • Total: ₹${item.total_amount}`,
                        url: `/admin/sales/${item.id}`,
                        icon: 'point_of_sale',
                        color: 'bg-green-100 text-green-600',
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
                        title: item.title,
                        subtitle: `Due: ${new Date(item.due_date).toLocaleDateString()} • Priority: ${item.priority}`,
                        url: item.lead_id ? `/admin/leads/${item.lead_id}` : '/admin/follow-ups',
                        icon: 'task',
                        color: 'bg-amber-100 text-amber-600',
                        matchedNote: isMatch(item.description) ? item.description : undefined
                    });
                }
            });
            followUps.forEach(item => {
                if (isMatch(item.notes) || isMatch(item.outcome)) {
                    const leadName = item.lead ? item.lead.full_name : 'Lead Follow-Up';
                    matches.push({
                        id: item.id,
                        type: 'Follow-Up',
                        title: `${leadName} - ${item.contacted_via}`,
                        subtitle: `Outcome: ${item.outcome || 'Pending'}`,
                        url: `/admin/leads/${item.lead_id}`,
                        icon: 'phone_callback',
                        color: 'bg-orange-100 text-orange-600',
                        matchedNote: isMatch(item.notes) ? item.notes : undefined
                    });
                }
            });
        }

        // 7. DEEP NOTES SEARCH (Activities, general notes everywhere)
        if (category === 'All' || category === 'Notes') {
            // Already searched notes in leads, bookings, sales, tasks, followups above.
            // Let's add lead activities specifically if user specifically wants "Notes" or deep search
            activities.forEach(item => {
                if (isMatch(item.notes)) {
                    matches.push({
                        id: item.id,
                        type: 'Activity Log',
                        title: `Activity on Lead`,
                        subtitle: new Date(item.created_at).toLocaleDateString(),
                        url: `/admin/leads/${item.lead_id}`,
                        icon: 'history',
                        color: 'bg-slate-100 text-slate-600',
                        matchedNote: item.notes
                    });
                }
            });
        }

        // De-duplicate by ID (in case a lead matches name AND we also caught its activity, although activity has its own ID)
        // Sort matches: Exact name matches first, then sort by type
        matches.sort((a, b) => {
            const aTitleMatch = a.title.toLowerCase().includes(q) ? 1 : 0;
            const bTitleMatch = b.title.toLowerCase().includes(q) ? 1 : 0;
            if (aTitleMatch !== bTitleMatch) return bTitleMatch - aTitleMatch;
            return a.type.localeCompare(b.type);
        });

        // Limit results to keep UI snappy
        setResults(matches.slice(0, 15));
        setSelectedIndex(-1);

    }, [query, category, leads, customers, inventory, bookings, sales, tasks, activities, followUps]);

    return (
        <div ref={wrapperRef} className="relative flex-1 max-w-2xl">
            {/* Search Input Box */}
            <div 
                className={clsx(
                    "flex items-center gap-2 bg-slate-50 border transition-all h-10 px-4",
                    isOpen ? "rounded-t-2xl border-primary ring-2 ring-primary/10 bg-white" : "rounded-2xl border-slate-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 focus-within:bg-white hover:border-slate-300"
                )}
            >
                <Search size={18} className={isOpen ? "text-primary" : "text-slate-400"} />
                <input 
                    ref={inputRef}
                    type="text" 
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    className="bg-transparent border-none text-sm text-slate-800 placeholder:text-slate-400 w-full outline-none font-medium" 
                    placeholder="Search leads, inventory, customers, notes... (Cmd+K)" 
                />
                {query && (
                    <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Dropdown Popover */}
            {isOpen && (
                <div className="absolute top-full left-0 w-full bg-white border border-t-0 border-slate-200 rounded-b-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[500px]">
                    
                    {/* Categories Filter */}
                    <div className="flex gap-1 p-2 bg-slate-50 border-b border-slate-100 overflow-x-auto shrink-0 scrollbar-none">
                        {(['All', 'Leads', 'Customers', 'Inventory', 'Bookings', 'Sales', 'Tasks', 'Notes'] as SearchCategory[]).map(cat => (
                            <button
                                key={cat}
                                onClick={() => { setCategory(cat); inputRef.current?.focus(); }}
                                className={clsx(
                                    "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap",
                                    category === cat ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:bg-slate-200"
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Results Area */}
                    <div className="overflow-y-auto flex-1 p-2 space-y-1">
                        {!query.trim() ? (
                            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                <Search size={32} className="mb-3 opacity-20" />
                                <p className="text-sm font-medium text-slate-500">Start typing to search globally</p>
                                <p className="text-xs mt-1">Try a name, phone number, VIN, or note.</p>
                            </div>
                        ) : results.length === 0 ? (
                            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-3 opacity-20">search_off</span>
                                <p className="text-sm font-medium text-slate-500">No results found for "{query}"</p>
                                {category !== 'All' && (
                                    <button 
                                        onClick={() => setCategory('All')}
                                        className="mt-3 text-xs font-bold text-primary hover:underline"
                                    >
                                        Search in All Categories
                                    </button>
                                )}
                            </div>
                        ) : (
                            results.map((item, idx) => (
                                <button
                                    key={`${item.id}-${idx}`}
                                    onClick={() => handleSelect(item)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    className={clsx(
                                        "w-full text-left p-3 rounded-xl flex items-start gap-3 transition-colors duration-150",
                                        selectedIndex === idx ? "bg-slate-50 border-primary/20" : "bg-transparent border-transparent hover:bg-slate-50"
                                    )}
                                >
                                    <div className={clsx("size-10 rounded-xl flex items-center justify-center shrink-0", item.color)}>
                                        <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <p className="text-sm font-bold text-slate-800 truncate">
                                                <HighlightText text={item.title} highlight={query} />
                                            </p>
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 shrink-0 ml-2">{item.type}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 truncate">
                                            <HighlightText text={item.subtitle} highlight={query} />
                                        </p>
                                        
                                        {/* Highlight Matched Note Snippet if applicable */}
                                        {item.matchedNote && (
                                            <div className="mt-1.5 p-1.5 bg-yellow-50/50 border border-yellow-100 rounded-md">
                                                <p className="text-[10px] text-slate-600 line-clamp-1">
                                                    <span className="font-semibold text-yellow-700">Matched Context: </span> 
                                                    "..." <HighlightText text={item.matchedNote.substring(Math.max(0, item.matchedNote.toLowerCase().indexOf(query.toLowerCase()) - 20), item.matchedNote.toLowerCase().indexOf(query.toLowerCase()) + 60)} highlight={query} /> "..."
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                    
                    {/* Footer */}
                    <div className="bg-slate-50 border-t border-slate-100 p-2 flex items-center justify-between px-4 shrink-0">
                        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400">
                            <span className="flex items-center gap-1"><kbd className="bg-white border rounded px-1 text-slate-500 font-sans shadow-sm">↑</kbd><kbd className="bg-white border rounded px-1 text-slate-500 font-sans shadow-sm">↓</kbd> to navigate</span>
                            <span className="flex items-center gap-1"><kbd className="bg-white border rounded px-1 text-slate-500 font-sans shadow-sm">↵</kbd> to select</span>
                            <span className="flex items-center gap-1"><kbd className="bg-white border rounded px-1 text-slate-500 font-sans shadow-sm">esc</kbd> to close</span>
                        </div>
                        {results.length > 0 && (
                            <span className="text-[10px] font-bold text-slate-400">{results.length} result{results.length !== 1 ? 's' : ''}</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;
