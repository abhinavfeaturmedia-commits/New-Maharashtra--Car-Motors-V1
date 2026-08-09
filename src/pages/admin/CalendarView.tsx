import React, { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';

const typeColors: Record<string, { bg: string; dot: string }> = {
    'test-drive': { bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
    'delivery': { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500' },
    'follow-up': { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
    'service': { bg: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500' },
    'meeting': { bg: 'bg-slate-50 border-slate-200', dot: 'bg-slate-500' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const CalendarView = () => {
    const { tasks, bookings } = useData();

    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth());
    const [selectedDate, setSelectedDate] = useState<string | null>(new Date().toISOString().split('T')[0]);

    // Build dynamic events map from active database context
    const eventsMap = useMemo(() => {
        const map: Record<string, Array<{ title: string; time: string; type: string }>> = {};

        // 1. Process CRM Tasks
        tasks.forEach(t => {
            if (!t.due_date || t.status === 'completed') return;
            const dateObj = new Date(t.due_date);
            
            // Adjust to local date string to prevent timezone offset bugs in the calendar key
            const offset = dateObj.getTimezoneOffset();
            const dateStr = new Date(dateObj.getTime() - (offset*60*1000)).toISOString().split('T')[0];
            
            const timeStr = dateObj.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });

            if (!map[dateStr]) map[dateStr] = [];
            
            map[dateStr].push({ 
                title: t.title, 
                time: timeStr, 
                type: 'follow-up' 
            });
        });

        // 2. Process Bookings (Test Drives & Services)
        bookings.forEach(b => {
            if (!b.booking_date) return;
            const dateObj = new Date(b.booking_date);
            
            const offset = dateObj.getTimezoneOffset();
            const dateStr = new Date(dateObj.getTime() - (offset*60*1000)).toISOString().split('T')[0];
            const timeStr = dateObj.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });

            if (!map[dateStr]) map[dateStr] = [];
            
            const evtType = b.type === 'service' ? 'service' : 'test-drive';
            const customerName = b.lead?.full_name || 'Customer';
            const carName = b.car ? ` (${b.car.make})` : '';

            map[dateStr].push({ 
                title: `${evtType.replace('-', ' ').toUpperCase()}: ${customerName}${carName}`, 
                time: timeStr, 
                type: evtType 
            });
        });

        // Sort events chronologically within each day bin
        Object.keys(map).forEach(key => {
            map[key].sort((a, b) => {
                const timeA = new Date(`1970/01/01 ${a.time}`).getTime();
                const timeB = new Date(`1970/01/01 ${b.time}`).getTime();
                return timeA - timeB;
            });
        });

        return map;
    }, [tasks, bookings]);

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const getDateKey = (day: number) => {
        const y = year;
        const m = String(month + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };
    
    const selectedEvents = selectedDate ? (eventsMap[selectedDate] || []) : [];

    const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
    const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Calendar</h1>
                    <p className="text-slate-500 text-sm">Unified view of test drives, deliveries, services & follow-ups.</p>
                </div>
                <div className="flex gap-2 text-right">
                    <span className="h-10 py-2.5 px-4 text-xs font-bold uppercase text-green-600 bg-green-100 rounded-xl">SYNCED</span>
                </div>
            </div>

            {/* Legend */}
            <div className="flex gap-4">
                {Object.entries(typeColors).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <span className={`size-2.5 rounded-full ${val.dot}`} />
                        <span className="capitalize">{key.replace('-', ' ')}</span>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Calendar Grid */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-5">
                    <div className="flex items-center justify-between mb-5">
                        <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-xl"><span className="material-symbols-outlined">chevron_left</span></button>
                        <h2 className="font-bold text-primary font-display text-lg">{MONTH_NAMES[month]} {year}</h2>
                        <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-xl"><span className="material-symbols-outlined">chevron_right</span></button>
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {DAYS.map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase py-2">{d}</div>)}
                        {cells.map((day, i) => {
                            if (day === null) return <div key={`e${i}`} />;
                            const dateKey = getDateKey(day);
                            const events = eventsMap[dateKey] || [];
                            const isSelected = selectedDate === dateKey;
                            
                            const isToday = new Date().toISOString().split('T')[0] === dateKey;

                            return (
                                <button key={i} onClick={() => setSelectedDate(dateKey)} className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all text-sm ${isSelected ? 'bg-primary text-white' : events.length > 0 ? 'bg-slate-50 hover:bg-primary/5 font-medium' : isToday ? 'border border-primary text-primary' : 'hover:bg-slate-50'}`}>
                                    <span className={isSelected || isToday ? 'font-bold' : ''}>{day}</span>
                                    {events.length > 0 && (
                                        <div className="flex gap-0.5 mt-1">
                                            {events.slice(0, 3).map((e, j) => <span key={j} className={`size-1.5 rounded-full ${isSelected ? 'bg-accent' : typeColors[e.type]?.dot || 'bg-slate-400'}`} />)}
                                            {events.length > 3 && <span className={`size-1.5 rounded-full ${isSelected ? 'bg-accent/50' : 'bg-slate-300'}`} />}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Event Detail */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)] flex flex-col max-h-[600px] overflow-hidden">
                    <h2 className="font-bold text-primary font-display text-sm mb-4 shrink-0 border-b border-slate-100 pb-4">
                        {selectedDate ? new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Select a day'}
                    </h2>
                    
                    <div className="overflow-y-auto pr-2 space-y-3">
                        {selectedEvents.length > 0 ? (
                            selectedEvents.map((e, i) => {
                                const tc = typeColors[e.type];
                                return (
                                    <div key={i} className={`p-3 rounded-xl border ${tc?.bg || 'bg-slate-50 border-slate-200'}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`size-2 rounded-full ${tc?.dot || 'bg-slate-400'}`} />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{e.type.replace('-', ' ')}</span>
                                        </div>
                                        <p className="text-sm font-semibold text-primary">{e.title}</p>
                                        <p className="text-xs text-slate-500 mt-1 font-medium"><span className="material-symbols-outlined text-[13px] align-middle mr-1">schedule</span>{e.time}</p>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-12">
                                <span className="material-symbols-outlined text-3xl text-slate-200 mb-2">event_busy</span>
                                <p className="text-sm text-slate-400">No appointments scheduled.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarView;
