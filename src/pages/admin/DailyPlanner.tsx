import React from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';

const SHORTCUTS = [
    { icon: 'person_add', label: 'New Lead', path: '/admin/leads' },
    { icon: 'request_quote', label: 'Send Quote', path: '/admin/leads' },
    { icon: 'directions_car', label: 'Book Test Drive', path: '/admin/bookings' },
    { icon: 'account_balance_wallet', label: 'Sales Ledger', path: '/admin/sales' },
];

const priorityColors: Record<string, string> = { 'High': 'text-red-600 bg-red-50', 'Medium': 'text-amber-600 bg-amber-50', 'Low': 'text-green-600 bg-green-50' };

const DailyPlanner = () => {
    const { tasks, sales, bookings } = useData();

    // Live Tasks Processing
    const todoTasks = tasks.filter(t => t.status === 'todo');
    const progressTasks = tasks.filter(t => t.status === 'in_progress');

    // Live Schedule (Bookings for Today)
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysBookings = bookings.filter(b => b.booking_date.startsWith(todayStr));

    // Live Monthly Target (from Sales table)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const thisMonthSales = sales.filter(s => {
        const d = new Date(s.sale_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const targetCars = 40; // Target could be fetched from dealership_settings later
    const achievedCars = thisMonthSales.length;
    const progressPct = Math.min(100, Math.round((achievedCars / targetCars) * 100));
    
    const revenueAchieved = thisMonthSales.reduce((sum, s) => sum + Number(s.final_price), 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Good Afternoon 👋</h1>
                    <p className="text-slate-500 text-sm">Here's your live daily overview. Stay on track and close those deals!</p>
                </div>
                <div className="text-right flex items-center gap-4">
                    <span className="py-1.5 px-3 text-[10px] font-bold tracking-wider uppercase text-green-600 bg-green-100 rounded-lg">LIVE DATA</span>
                    <div>
                        <p className="text-sm font-bold text-primary">{new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        <p className="text-xs text-slate-400">Main Branch</p>
                    </div>
                </div>
            </div>

            {/* Quick Shortcuts */}
            <div className="grid grid-cols-4 gap-4">
                {SHORTCUTS.map(s => (
                    <Link key={s.label} to={s.path} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)] text-center hover:shadow-[var(--shadow-card-hover)] transition-all group">
                        <div className="size-12 rounded-xl bg-primary/5 mx-auto flex items-center justify-center mb-3 group-hover:bg-accent/10 transition-colors">
                            <span className="material-symbols-outlined text-xl text-primary group-hover:text-accent transition-colors">{s.icon}</span>
                        </div>
                        <p className="text-sm font-semibold text-primary">{s.label}</p>
                    </Link>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Tasks */}
                <div className="lg:col-span-2 space-y-6">
                    {/* To Do */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="font-bold text-primary font-display flex items-center gap-2"><span className="material-symbols-outlined text-accent">checklist</span> To Do ({todoTasks.length})</h2>
                            <Link to="/admin/follow-ups" className="text-sm font-semibold text-accent hover:underline">Manage All</Link>
                        </div>
                        {todoTasks.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No pending tasks. Great job!</p>
                        ) : (
                            <div className="space-y-3">
                                {todoTasks.slice(0, 5).map(task => (
                                    <div key={task.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100/50 transition-colors group">
                                        <div className="size-5 rounded-md border-2 border-slate-300 flex items-center justify-center cursor-pointer group-hover:border-primary transition-colors" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-primary">{task.title}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${priorityColors[task.priority] || 'bg-slate-100 text-slate-500'}`}>{task.priority || 'Normal'}</span>
                                            </div>
                                        </div>
                                        <span className="text-xs text-slate-400 font-medium">{new Date(task.due_date).toLocaleDateString()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* In Progress */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                        <h2 className="font-bold text-primary font-display mb-5 flex items-center gap-2"><span className="material-symbols-outlined text-blue-500">pending</span> In Progress ({progressTasks.length})</h2>
                        {progressTasks.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No tasks currently in progress.</p>
                        ) : (
                            <div className="space-y-3">
                                {progressTasks.map(task => (
                                    <div key={task.id} className="flex items-center gap-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                        <div className="size-5 rounded-md bg-blue-500 flex items-center justify-center"><span className="material-symbols-outlined text-white text-sm">remove</span></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-primary">{task.title}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${priorityColors[task.priority] || 'bg-slate-100 text-slate-500'}`}>{task.priority || 'Normal'}</span>
                                            </div>
                                        </div>
                                        <span className="text-xs text-slate-400 font-medium">{new Date(task.due_date).toLocaleDateString()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Sidebar */}
                <div className="space-y-4">
                    {/* Today's Schedule */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                        <h3 className="font-bold text-primary font-display mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-accent">schedule</span> Today's Bookings</h3>
                        {todaysBookings.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No bookings scheduled for today.</p>
                        ) : (
                            <div className="space-y-3">
                                {todaysBookings.map(b => (
                                    <div key={b.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border-l-3 border-l-primary">
                                        <span className="text-xs font-bold text-slate-400 w-10">
                                            {new Date(b.booking_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-primary">{b.type.replace('_', ' ').toUpperCase()}</p>
                                            <p className="text-xs text-slate-500">{b.lead?.full_name || 'Guest'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Link to="/admin/bookings" className="block text-center text-xs font-bold text-primary mt-4 hover:underline">View All Schedule →</Link>
                    </div>

                    {/* Monthly Target */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                        <h3 className="font-bold text-primary font-display mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-accent">flag</span> Monthly Target Progression</h3>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-slate-600">{achievedCars} / {targetCars} Cars</span><span className="text-sm font-bold text-primary">{progressPct}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000" style={{ width: `${progressPct}%` }} /></div>
                        <p className="text-xs text-slate-500 mt-3 flex items-center gap-1 font-bold">
                            <span className="material-symbols-outlined text-green-500 text-sm">trending_up</span>
                            ₹{(revenueAchieved / 100000).toFixed(2)}L revenue achieved
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DailyPlanner;
