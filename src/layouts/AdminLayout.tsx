import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { Menu, X, Bell, Plus, ChevronDown, LogOut, Home, Target, Phone, TrendingUp, BarChart2, Users, Car } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { DataProvider, useData } from '../contexts/DataContext';
import { NotificationProvider, useNotifications } from '../contexts/NotificationContext';
import { AttendanceProvider } from '../contexts/AttendanceContext';
import { supabase } from '../lib/supabase';
import GlobalSearch from '../components/admin/GlobalSearch';
import SmartToastEngine from '../components/admin/SmartToastEngine';
import AttendanceClockWidget from '../components/admin/AttendanceClockWidget';

interface NavItem {
    name: string;
    href: string;
    icon: string;
    module: string; // maps to user_permissions.module
    adminOnly?: boolean;  // only visible to admins
    staffOnly?: boolean;  // only visible to staff
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
    {
        label: 'Main',
        items: [
            { name: 'Dashboard', href: '/admin', icon: 'dashboard', module: 'dashboard' },
            { name: 'Inventory', href: '/admin/inventory', icon: 'directions_car', module: 'inventory' },
            { name: 'Park & Sell', href: '/admin/consignments', icon: 'handshake', module: 'inventory' },
            { name: 'Leads', href: '/admin/leads', icon: 'people', module: 'leads' },
            { name: 'Sales', href: '/admin/sales', icon: 'point_of_sale', module: 'sales' },
            { name: 'Bookings', href: '/admin/bookings', icon: 'event', module: 'bookings' },
            { name: 'Incentives', href: '/admin/incentives', icon: 'workspace_premium', module: 'incentives', adminOnly: true },
            { name: 'My Incentives', href: '/admin/my-incentives', icon: 'workspace_premium', module: 'incentives', staffOnly: true },
        ],
    },
    {
        label: 'Analytics',
        items: [
            { name: 'Analytics', href: '/admin/analytics', icon: 'analytics', module: 'analytics' },
            { name: 'Reports', href: '/admin/reports', icon: 'description', module: 'analytics' },
            { name: 'Performance', href: '/admin/performance', icon: 'leaderboard', module: 'analytics' },
            { name: 'Accountability', href: '/admin/accountability', icon: 'fact_check', module: 'analytics' },
        ],
    },
    {
        label: 'CRM',
        items: [
            { name: 'Customers', href: '/admin/customers', icon: 'contacts', module: 'crm' },
            { name: 'Happy Customers', href: '/admin/happy-customers', icon: 'celebration', module: 'crm' },
            { name: 'Customer Alerts', href: '/admin/customer-alerts', icon: 'notification_important', module: 'crm', adminOnly: true },
            { name: 'Follow-Ups', href: '/admin/follow-ups', icon: 'notifications_active', module: 'crm' },
            { name: 'Lead Sources', href: '/admin/lead-sources', icon: 'hub', module: 'crm' },
        ],
    },
    {
        label: 'Operations',
        items: [
            { name: 'Expenses', href: '/admin/expenses', icon: 'receipt_long', module: 'operations' },
            { name: 'Share Logs', href: '/admin/share-logs', icon: 'share', module: 'operations' },
            { name: 'Shared Catalogs', href: '/admin/shared-catalogs', icon: 'folder_shared', module: 'operations' },
        ],
    },
    {
        label: 'Finance',
        items: [
            { name: 'Accounts', href: '/admin/accounts', icon: 'account_balance', module: 'finance' },
            { name: 'Commissions', href: '/admin/commissions', icon: 'payments', module: 'finance' },
            { name: 'Tax & GST', href: '/admin/tax', icon: 'receipt', module: 'finance' },
            { name: 'Services Manager', href: '/admin/finance-services', icon: 'handshake', module: 'finance' },
        ],
    },
    {
        label: 'Schedule',
        items: [
            { name: 'Calendar', href: '/admin/calendar', icon: 'calendar_month', module: 'schedule' },
            { name: 'Notifications', href: '/admin/notifications', icon: 'notifications', module: 'schedule' },
            { name: 'Templates', href: '/admin/templates', icon: 'chat', module: 'schedule' },
        ],
    },
    {
        label: 'Partners',
        items: [
            { name: 'Dealer Management', href: '/admin/dealers', icon: 'store', module: 'dealers' },
        ],
    },
    {
        label: 'Admin',
        items: [
            { name: 'Users', href: '/admin/users', icon: 'manage_accounts', module: 'users', adminOnly: true },
            { name: 'Attendance', href: '/admin/attendance', icon: 'fingerprint', module: 'attendance' },
            { name: 'Audit Logs', href: '/admin/audit-logs', icon: 'history', module: 'audit_logs', adminOnly: true },
            { name: 'Settings', href: '/admin/settings', icon: 'settings', module: 'settings', adminOnly: true },
        ],
    },
];

// ─── Owner Mode: Simplified 5-item flat nav ──────────────────────────────────
interface OwnerNavItem {
    name: string;
    href: string;
    icon: string;
    desc: string;
}
const OWNER_NAV: OwnerNavItem[] = [
    { name: 'Home',           href: '/admin',           icon: 'home',           desc: 'Overview of your business' },
    { name: 'My Cars',        href: '/admin/inventory', icon: 'directions_car', desc: 'Add & manage vehicles' },
    { name: 'My Customers',   href: '/admin/people',    icon: 'people',         desc: 'Buyers, sellers & history' },
    { name: 'Sales & Income', href: '/admin/sales',     icon: 'payments',       desc: 'Deals closed & earnings' },
    { name: 'Settings',       href: '/admin/settings',  icon: 'settings',       desc: 'Preferences & account' },
];

// ─── Notification Bell Dropdown ──────────────────────────────────────────────
const COLOR_DOT: Record<string, string> = {
    red: 'bg-red-500', amber: 'bg-amber-400', green: 'bg-green-500',
    blue: 'bg-blue-500', orange: 'bg-orange-500', purple: 'bg-purple-500',
};
const COLOR_ICON: Record<string, string> = {
    red: 'bg-red-50 text-red-600', amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600', blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600', purple: 'bg-purple-50 text-purple-600',
};

const timeAgo = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

const NotificationBell = () => {
    const { notifications, unreadCount, criticalCount, markRead, dismiss, markAllRead } = useNotifications();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const recent = notifications.slice(0, 10);

    return (
        <div ref={ref} className="relative">
            {/* Bell button */}
            <button
                onClick={() => setOpen(v => !v)}
                className="relative p-2.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-xl transition-colors"
                aria-label="Notifications"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className={`absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-black text-white ring-2 ring-white ${
                        criticalCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-primary'
                    }`}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full mt-2 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="font-black text-primary text-sm">Notifications</span>
                            {unreadCount > 0 && (
                                <span className="text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full">{unreadCount} new</span>
                            )}
                        </div>
                        <button
                            onClick={markAllRead}
                            className="text-[11px] font-semibold text-slate-400 hover:text-primary transition-colors"
                        >
                            Mark all read
                        </button>
                    </div>

                    {/* List */}
                    <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-50">
                        {recent.length === 0 ? (
                            <div className="py-12 flex flex-col items-center gap-2 text-slate-300">
                                <span className="material-symbols-outlined text-4xl">notifications_paused</span>
                                <p className="text-xs font-medium">All caught up!</p>
                            </div>
                        ) : recent.map(n => (
                            <div
                                key={n.id}
                                className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-default ${
                                    !n.is_read ? 'bg-blue-50/40' : ''
                                }`}
                                onClick={() => !n.is_read && markRead(n.id)}
                            >
                                {/* Color dot + icon */}
                                <div className="relative shrink-0 mt-0.5">
                                    <div className={`size-9 rounded-xl flex items-center justify-center ${COLOR_ICON[n.color] || COLOR_ICON.blue}`}>
                                        <span className="material-symbols-outlined text-[16px]">{n.icon}</span>
                                    </div>
                                    {!n.is_read && (
                                        <span className={`absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-white ${COLOR_DOT[n.color] || 'bg-blue-500'}`} />
                                    )}
                                </div>
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs leading-snug mb-0.5 ${!n.is_read ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>
                                        {n.title}
                                    </p>
                                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{n.message}</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-[10px] text-slate-300">{timeAgo(n.created_at)}</span>
                                        {n.action_url && (
                                            <Link
                                                to={n.action_url}
                                                onClick={() => { markRead(n.id); setOpen(false); }}
                                                className="text-[10px] font-bold text-primary hover:underline"
                                            >
                                                {n.action_label || 'View →'}
                                            </Link>
                                        )}
                                    </div>
                                </div>
                                {/* Dismiss */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                                    className="size-6 shrink-0 flex items-center justify-center text-slate-200 hover:text-slate-400 hover:bg-slate-100 rounded-lg transition-colors mt-0.5"
                                    title="Dismiss"
                                >
                                    <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-slate-100 px-4 py-2.5">
                        <Link
                            to="/admin/notifications"
                            onClick={() => setOpen(false)}
                            className="flex items-center justify-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors py-1"
                        >
                            View all notifications
                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Announcement Banner Component ─────────────────────────────────────────
const AnnouncementBanner = () => {
    const [announcements, setAnnouncements] = React.useState<any[]>([]);
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        supabase
            .from('staff_announcements')
            .select('*')
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false })
            .then(({ data }) => {
                if (data) {
                    const today = new Date().toDateString();
                    const visible = data.filter(a =>
                        a.is_pinned || new Date(a.created_at).toDateString() === today
                    );
                    setAnnouncements(visible);
                }
            });
    }, []);

    if (announcements.length === 0) return null;

    const urgentCount = announcements.filter(a => a.priority === 'urgent').length;
    const bgClass = urgentCount > 0 ? 'bg-red-500' : 'bg-amber-500';

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className={`hidden sm:flex items-center gap-2 h-9 px-3 ${bgClass} text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity shrink-0`}
            >
                <span className="material-symbols-outlined text-sm">campaign</span>
                <span>{announcements.length} Announcement{announcements.length !== 1 ? 's' : ''}</span>
                {urgentCount > 0 && <span className="bg-white text-red-600 text-[10px] font-black px-1.5 py-0.5 rounded-full">{urgentCount}</span>}
            </button>
            {open && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-white">campaign</span>
                                <h2 className="font-black text-white">Announcements</h2>
                            </div>
                            <button onClick={() => setOpen(false)} className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-lg">close</span>
                            </button>
                        </div>
                        <div className="overflow-y-auto p-4 space-y-3">
                            {announcements.map(a => {
                                const colors = a.priority === 'urgent' ? 'bg-red-50 border-red-200' : a.priority === 'celebration' ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-200';
                                return (
                                    <div key={a.id} className={`${colors} border rounded-xl p-4`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            {a.is_pinned && <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">📌 Pinned</span>}
                                            <span className="text-[10px] font-bold uppercase text-slate-500">{a.priority}</span>
                                        </div>
                                        <p className="font-bold text-slate-800">{a.title}</p>
                                        <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{a.body}</p>
                                        <p className="text-[10px] text-slate-400 mt-2">{new Date(a.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const AdminLayout: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const location = useLocation();
    const navigate = useNavigate();
    const { profile, signOut, isAdmin, isOwner, hasPermission } = useAuth();

    // Filter nav groups based on permissions for staff users
    const visibleNavGroups = NAV_GROUPS.map(group => ({
        ...group,
        items: group.items.filter(item => {
            // Hide admin-only items from staff
            if (item.adminOnly && !isAdmin) return false;
            // Hide staff-only items from admins
            if (item.staffOnly && isAdmin) return false;
            // Check module permission
            return isAdmin || hasPermission(item.module, 'view');
        }),
    })).filter(group => group.items.length > 0);

    const handleLogout = async () => {
        await signOut();
        navigate('/admin/login');
    };

    const isNavActive = (href: string) => {
        if (href === '/admin') return location.pathname === '/admin';
        return location.pathname.startsWith(href);
    };

    const toggleGroup = (label: string) => setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));

    // Auto-expand group containing active route
    const activeGroup = NAV_GROUPS.find(g => g.items.some(i => isNavActive(i.href)));

    return (
        <DataProvider>
            <NotificationProvider>
            <AttendanceProvider>
            <div className="min-h-screen w-full bg-slate-50 flex font-body">
            {/* Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-primary/20 backdrop-blur-sm lg:hidden transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={clsx(
                    "fixed top-0 left-0 z-40 h-screen transition-transform duration-300 ease-in-out bg-white border-r border-slate-100 flex flex-col",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
                    "w-64"
                )}
            >
                {/* Header */}
                <div className="h-[4.5rem] flex items-center justify-between px-5 border-b border-slate-100 shrink-0">
                    <Link to="/admin" className="flex items-center gap-3">
                        <div className="size-9 bg-primary rounded-xl flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-lg">directions_car</span>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-primary font-display">Maharashtra Motors <span className="font-serif-italic font-normal text-amber-600">{isOwner ? 'Owner' : 'Admin'}</span></p>
                            <p className="text-[10px] text-slate-400">{isOwner ? 'Business Dashboard' : 'Pune Hub'}</p>
                        </div>
                    </Link>
                    <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-3 px-3 overflow-y-auto flex flex-col min-h-0">
                    <div className="flex-1">
                        {isOwner ? (
                            /* ── OWNER MODE: flat, large, plain-language nav ── */
                            <div className="space-y-1 pt-2">
                                {OWNER_NAV.map(item => {
                                    const active = item.href === '/admin'
                                        ? location.pathname === '/admin'
                                        : location.pathname.startsWith(item.href);
                                    return (
                                        <Link
                                            key={item.href}
                                            to={item.href}
                                            onClick={() => setSidebarOpen(false)}
                                            className={clsx(
                                                'flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200',
                                                active
                                                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                                                    : 'text-slate-600 hover:bg-slate-50 hover:text-primary'
                                            )}
                                        >
                                            <div className={clsx(
                                                'size-9 rounded-xl flex items-center justify-center shrink-0',
                                                active ? 'bg-white/20' : 'bg-slate-100'
                                            )}>
                                                <span className={clsx('material-symbols-outlined text-[20px]', active ? 'text-white' : 'text-slate-500')}>{item.icon}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className={clsx('text-sm font-bold', active ? 'text-white' : 'text-primary')}>{item.name}</p>
                                                <p className={clsx('text-[10px] truncate', active ? 'text-white/70' : 'text-slate-400')}>{item.desc}</p>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            /* ── STAFF/ADMIN MODE: grouped nav ── */
                            visibleNavGroups.map(group => {
                                const isOpen = !collapsed[group.label] || (activeGroup?.label === group.label);
                                const hasActive = group.items.some(i => isNavActive(i.href));

                                return (
                                    <div key={group.label} className="mb-1">
                                        <button
                                            onClick={() => toggleGroup(group.label)}
                                            className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
                                        >
                                            <span className={hasActive ? 'text-primary' : ''}>{group.label}</span>
                                            <ChevronDown size={12} className={clsx('transition-transform', isOpen ? '' : '-rotate-90')} />
                                        </button>

                                        {isOpen && (
                                            <div className="space-y-0.5">
                                                {group.items.map(item => {
                                                    const active = isNavActive(item.href);
                                                    return (
                                                        <Link
                                                            key={item.href}
                                                            to={item.href}
                                                            onClick={() => setSidebarOpen(false)}
                                                            className={clsx(
                                                                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200",
                                                                active
                                                                    ? "bg-primary text-white shadow-sm shadow-primary/20"
                                                                    : "text-slate-600 hover:bg-slate-50 hover:text-primary"
                                                            )}
                                                        >
                                                            <span className={clsx("material-symbols-outlined text-[18px]", active ? "text-white" : "text-slate-400")}>{item.icon}</span>
                                                            {item.name}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-auto px-1 pb-4 shrink-0 space-y-2 border-t border-slate-100 pt-5">
                        {isOwner ? (
                            <>
                                <Link
                                    to="/admin/inventory/new"
                                    className="flex items-center justify-center gap-2 w-full h-11 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors shadow-sm"
                                >
                                    <span className="material-symbols-outlined text-lg">add</span> Add a Car
                                </Link>
                                <Link
                                    to="/admin/people"
                                    className="flex items-center justify-center gap-2 w-full h-10 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-sm font-semibold hover:bg-amber-100 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-base">person_add</span> Add Customer
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/admin/inventory/new"
                                    className="flex items-center justify-center gap-2 w-full h-10 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors shadow-sm"
                                >
                                    <Plus size={16} /> New Listing
                                </Link>
                                <Link
                                    to="/"
                                    className="flex items-center justify-center gap-2 w-full h-10 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-100 hover:text-primary transition-colors"
                                >
                                    <Home size={15} /> View Website
                                </Link>
                            </>
                        )}
                        <button
                            onClick={handleLogout}
                            className="flex items-center justify-center gap-2 w-full h-10 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 hover:text-red-700 transition-colors"
                        >
                            <LogOut size={15} /> Logout
                        </button>
                    </div>
                </nav>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden lg:pl-64">
                {/* Header */}
                <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 sm:px-8 shrink-0">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 -ml-2 text-slate-400 hover:text-primary lg:hidden"
                        >
                            <Menu size={22} />
                        </button>
                        <h2 className="hidden lg:block text-lg font-bold text-primary font-display">Admin Command Center</h2>
                        <div className="hidden sm:flex items-center gap-2 flex-1 max-w-2xl ml-4">
                            <GlobalSearch />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <AnnouncementBanner />
                        <AttendanceClockWidget />
                        <Link
                            to="/"
                            title="Go to Website"
                            className="hidden sm:flex items-center gap-1.5 h-9 px-3 text-slate-500 bg-slate-50 border border-slate-200 hover:text-primary hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium"
                        >
                            <Home size={15} />
                            <span className="hidden lg:inline">Website</span>
                        </Link>
                        <NotificationBell />
                        <div className="flex items-center gap-3 pl-3 border-l border-slate-100">
                            <div className="size-9 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'A'}
                            </div>
                            <div className="hidden md:block">
                                <p className="text-sm font-semibold text-primary">{profile?.full_name ?? 'Admin'}</p>
                                <p className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">{isOwner ? 'Business Owner' : 'Administrator'}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            title="Logout"
                            className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto relative">
                    <div className="max-w-7xl mx-auto w-full">
                        <Outlet />
                    </div>
                    {/* Smart Toast Engine */}
                    <SmartToastEngine />
                    {/* Staff Accountability Popups */}
                    <StaffAccountabilityModals />
                </main>
            </div>
            </div>
            </AttendanceProvider>
            </NotificationProvider>
        </DataProvider>
    );
};

// ─── Staff Accountability Modals ───────────────────────────────────────────
const StaffAccountabilityModals: React.FC = () => {
    const { profile } = useAuth();
    const [showCommitmentModal, setShowCommitmentModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    
    // commitment states
    const [commForm, setCommForm] = useState({
        deal: 0,
        calls: 0,
        crm_lead: 0,
        crm_car_post: 0,
        olx_car_post: 0,
        fb_marketplace: 0,
        reel_creation: 0,
        visits: 0,
        add_new_dealer_list: 0,
        add_new_club_member: 0
    });
    
    // report states
    const [repForm, setRepForm] = useState({
        calling: 0,
        follow_up: 0,
        walking: 0,
        hot: 0,
        total_success: 0
    });

    const checkLogs = async () => {
        if (!profile || !['admin', 'staff'].includes(profile.role)) return;
        const todayStr = new Date().toLocaleDateString('en-CA');
        
        try {
            // Check commitment first
            const { data: commData } = await supabase
                .from('staff_commitments')
                .select('id')
                .eq('user_id', profile.id)
                .eq('date', todayStr)
                .maybeSingle();
                
            if (!commData) {
                setShowCommitmentModal(true);
                setShowReportModal(false);
                return;
            }
            
            setShowCommitmentModal(false);
            
            // If commitment is logged, check report (after 6 PM)
            const currentHour = new Date().getHours();
            if (currentHour >= 18) {
                const { data: repData } = await supabase
                    .from('staff_daily_reports')
                    .select('id')
                    .eq('user_id', profile.id)
                    .eq('date', todayStr)
                    .maybeSingle();
                    
                if (!repData) {
                    // Fetch today's commitments to pre-fill actuals
                    const { data: commToday } = await supabase
                        .from('staff_commitments')
                        .select('actual_calls, actual_deal, actual_visits')
                        .eq('user_id', profile.id)
                        .eq('date', todayStr)
                        .maybeSingle();

                    setRepForm({
                        calling: commToday?.actual_calls || 0,
                        follow_up: 0,
                        walking: commToday?.actual_visits || 0,
                        hot: 0,
                        total_success: commToday?.actual_deal || 0
                    });
                    setShowReportModal(true);
                } else {
                    setShowReportModal(false);
                }
            } else {
                setShowReportModal(false);
            }
        } catch (err) {
            console.error("Error in checkLogs:", err);
        }
    };

    useEffect(() => {
        checkLogs();
        // check every minute
        const interval = setInterval(checkLogs, 60000);
        return () => clearInterval(interval);
    }, [profile]);

    const handleCommSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;
        setSubmitting(true);
        const todayStr = new Date().toLocaleDateString('en-CA');
        try {
            const { error } = await supabase
                .from('staff_commitments')
                .upsert({
                    user_id: profile.id,
                    date: todayStr,
                    ...commForm
                }, { onConflict: 'user_id,date' });
            if (error) throw error;
            setShowCommitmentModal(false);
            // Re-trigger checks to see if report is needed (e.g. if logged in after 6pm)
            checkLogs();
        } catch (err: any) {
            console.error("Error submitting commitments:", err);
            alert(`Failed to submit commitments: ${err.message || 'Please try again.'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRepSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;
        setSubmitting(true);
        const todayStr = new Date().toLocaleDateString('en-CA');
        try {
            const { error } = await supabase
                .from('staff_daily_reports')
                .upsert({
                    user_id: profile.id,
                    date: todayStr,
                    ...repForm
                }, { onConflict: 'user_id,date' });
            if (error) throw error;
            setShowReportModal(false);
        } catch (err: any) {
            console.error("Error submitting daily report:", err);
            alert(`Failed to submit daily report: ${err.message || 'Please try again.'}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (showCommitmentModal) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-5 flex items-center gap-3">
                        <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center text-white shrink-0">
                            <Target size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white">Daily Morning Commitments</h2>
                            <p className="text-white/60 text-xs">Please set your commitments and targets before starting work today.</p>
                        </div>
                    </div>
                    
                    <form onSubmit={handleCommSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
                            {[
                                { key: 'deal', label: 'Deals Commitment', icon: 'handshake' },
                                { key: 'calls', label: 'Calls Target', icon: 'phone' },
                                { key: 'crm_lead', label: 'CRM Leads Target', icon: 'person_search' },
                                { key: 'crm_car_post', label: 'CRM Car Posts', icon: 'directions_car' },
                                { key: 'olx_car_post', label: 'OLX Car Posts', icon: 'upload' },
                                { key: 'fb_marketplace', label: 'FB Marketplace Posts', icon: 'storefront' },
                                { key: 'reel_creation', label: 'Reel Creation', icon: 'video_library' },
                                { key: 'visits', label: 'Visits Target', icon: 'explore' },
                                { key: 'add_new_dealer_list', label: 'Add Dealer List', icon: 'contact_page' },
                                { key: 'add_new_club_member', label: 'Add Club Member', icon: 'badge' },
                            ].map(item => (
                                <div key={item.key} className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                                        <span className="material-symbols-outlined text-sm text-indigo-500">{item.icon}</span>
                                        {item.label}
                                    </label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        value={commForm[item.key as keyof typeof commForm]}
                                        onChange={e => setCommForm({
                                            ...commForm,
                                            [item.key]: parseInt(e.target.value) || 0
                                        })}
                                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-indigo-600/10 flex items-center justify-center"
                            >
                                {submitting ? 'Submitting Targets...' : 'Submit Commitment & Start Day'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    if (showReportModal) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-5 flex items-center gap-3">
                        <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center text-white shrink-0">
                            <BarChart2 size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white">Evening Sales Report</h2>
                            <p className="text-white/60 text-xs">It is after 6:00 PM. Please log your performance statistics achieved today.</p>
                        </div>
                    </div>
                    
                    <form onSubmit={handleRepSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        <div className="space-y-3.5">
                            {[
                                { key: 'calling', label: 'Calling (Total Calls Made)', icon: 'phone' },
                                { key: 'follow_up', label: 'Follow Up (Follow-Ups Completed)', icon: 'event_repeat' },
                                { key: 'walking', label: 'Walking (Walk-ins Met)', icon: 'directions_walk' },
                                { key: 'hot', label: 'Hot (Hot Leads Worked)', icon: 'local_fire_department' },
                            ].map(item => (
                                <div key={item.key} className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                                        <span className="material-symbols-outlined text-sm text-amber-500">{item.icon}</span>
                                        {item.label}
                                    </label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        value={repForm[item.key as keyof typeof repForm]}
                                        onChange={e => setRepForm({
                                            ...repForm,
                                            [item.key]: parseInt(e.target.value) || 0
                                        })}
                                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary font-bold outline-none focus:ring-2 focus:ring-orange-500/20"
                                    />
                                </div>
                            ))}
                            
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-1">
                                <label className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 uppercase tracking-wider">
                                    <span className="material-symbols-outlined text-sm text-emerald-600">done_all</span>
                                    Total Success (Deals Closed/Won Today)
                                </label>
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    value={repForm.total_success}
                                    onChange={e => setRepForm({
                                        ...repForm,
                                        total_success: parseInt(e.target.value) || 0
                                    })}
                                    className="w-full h-11 bg-white border border-emerald-200 rounded-xl px-4 text-sm text-primary font-black outline-none focus:ring-2 focus:ring-emerald-500/20 text-center"
                                />
                            </div>
                        </div>
                        
                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="h-11 px-6 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-orange-600/10 flex items-center justify-center"
                            >
                                {submitting ? 'Submitting Report...' : 'Submit Sales Report & Complete Day'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return null;
};

export default AdminLayout;
