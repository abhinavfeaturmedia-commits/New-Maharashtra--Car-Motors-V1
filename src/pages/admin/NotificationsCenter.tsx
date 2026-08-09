import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications, SmartNotification } from '../../contexts/NotificationContext';

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_TABS = [
    { key: 'all',       label: 'All',       icon: 'notifications' },
    { key: 'critical',  label: 'Critical',  icon: 'warning' },
    { key: 'insight',   label: 'Insights',  icon: 'insights' },
    { key: 'inventory', label: 'Inventory', icon: 'inventory_2' },
    { key: 'staff',     label: 'Staff',     icon: 'groups' },
    { key: 'workflow',  label: 'Workflow',  icon: 'account_tree' },
] as const;

const COLOR_CONFIG: Record<string, { bar: string; icon: string; bg: string; badge: string; text: string }> = {
    red:    { bar: 'border-red-500',    icon: 'bg-red-50 text-red-600',    bg: 'bg-red-50/60',    badge: 'bg-red-100 text-red-700',    text: 'text-red-700' },
    amber:  { bar: 'border-amber-400',  icon: 'bg-amber-50 text-amber-600', bg: 'bg-amber-50/60',  badge: 'bg-amber-100 text-amber-700', text: 'text-amber-700' },
    green:  { bar: 'border-green-500',  icon: 'bg-green-50 text-green-600', bg: 'bg-green-50/20',  badge: 'bg-green-100 text-green-700', text: 'text-green-700' },
    blue:   { bar: 'border-blue-500',   icon: 'bg-blue-50 text-blue-600',   bg: 'bg-blue-50/20',   badge: 'bg-blue-100 text-blue-700',   text: 'text-blue-700' },
    orange: { bar: 'border-orange-500', icon: 'bg-orange-50 text-orange-600', bg: 'bg-orange-50/30', badge: 'bg-orange-100 text-orange-700', text: 'text-orange-700' },
    purple: { bar: 'border-purple-500', icon: 'bg-purple-50 text-purple-600', bg: 'bg-purple-50/20', badge: 'bg-purple-100 text-purple-700', text: 'text-purple-700' },
};

const PRIORITY_LABEL: Record<number, { label: string; cls: string }> = {
    1: { label: 'Critical', cls: 'bg-red-100 text-red-700' },
    2: { label: 'High',     cls: 'bg-amber-100 text-amber-700' },
    3: { label: 'Medium',   cls: 'bg-blue-100 text-blue-700' },
    4: { label: 'Low',      cls: 'bg-slate-100 text-slate-500' },
};

const timeAgo = (d: string) => {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

// ─── Notification Card ────────────────────────────────────────────────────────

const NotifCard: React.FC<{
    n: SmartNotification;
    onRead: () => void;
    onDismiss: () => void;
}> = ({ n, onRead, onDismiss }) => {
    const c = COLOR_CONFIG[n.color] || COLOR_CONFIG.blue;
    const p = PRIORITY_LABEL[n.priority] || PRIORITY_LABEL[3];

    return (
        <div
            className={`relative flex items-start gap-4 p-4 rounded-2xl border-l-4 border border-slate-100 transition-all duration-200 group ${c.bar} ${
                !n.is_read ? 'bg-white shadow-sm' : 'bg-slate-50/50 opacity-75'
            }`}
        >
            {/* Unread dot */}
            {!n.is_read && (
                <span className="absolute top-4 right-4 size-2 rounded-full bg-primary animate-pulse" />
            )}

            {/* Icon */}
            <div className={`size-11 rounded-2xl flex items-center justify-center shrink-0 ${c.icon}`}>
                <span className="material-symbols-outlined text-[22px]">{n.icon}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${p.cls}`}>
                        {p.label}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider capitalize">
                        {n.category}
                    </span>
                </div>
                <p className={`text-sm font-bold mb-1 ${!n.is_read ? 'text-slate-800' : 'text-slate-500'}`}>
                    {n.title}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed mb-2">{n.message}</p>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">schedule</span>
                        {timeAgo(n.created_at)}
                    </span>
                    {n.action_url && (
                        <Link
                            to={n.action_url}
                            onClick={onRead}
                            className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${c.badge} hover:opacity-80`}
                        >
                            {n.action_label || 'View'}
                            <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                        </Link>
                    )}
                    {!n.is_read && (
                        <button
                            onClick={onRead}
                            className="text-xs font-semibold text-slate-400 hover:text-primary transition-colors"
                        >
                            Mark read
                        </button>
                    )}
                </div>
            </div>

            {/* Dismiss */}
            <button
                onClick={onDismiss}
                className="size-8 shrink-0 flex items-center justify-center text-slate-200 hover:text-red-400 hover:bg-red-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                title="Dismiss"
            >
                <span className="material-symbols-outlined text-[18px]">delete_outline</span>
            </button>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const NotificationsCenter = () => {
    const { notifications, unreadCount, criticalCount, loading, markRead, markAllRead, dismiss, dismissAll } = useNotifications();
    const [activeTab, setActiveTab] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const filtered = notifications.filter(n => {
        if (activeTab !== 'all' && n.category !== activeTab) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
        }
        return true;
    });

    const todayCount = notifications.filter(n => {
        const d = new Date(n.created_at);
        return d.toDateString() === new Date().toDateString();
    }).length;

    const tabCount = (key: string) =>
        key === 'all' ? notifications.length : notifications.filter(n => n.category === key).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Notification Center</h1>
                    <p className="text-slate-500 text-sm mt-0.5">All smart alerts, insights, and workflow nudges in one place.</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="py-1.5 px-3 text-[10px] font-bold tracking-wider uppercase text-green-700 bg-green-100 rounded-lg flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                        Live Feed
                    </span>
                    <button
                        onClick={markAllRead}
                        className="text-xs font-semibold text-slate-500 hover:text-primary bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        Mark all read
                    </button>
                    <button
                        onClick={dismissAll}
                        className="text-xs font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        Clear all
                    </button>
                </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total', value: notifications.length, icon: 'notifications', color: 'text-slate-600 bg-slate-50 border-slate-100' },
                    { label: 'Unread', value: unreadCount, icon: 'mark_email_unread', color: 'text-blue-600 bg-blue-50 border-blue-100' },
                    { label: 'Critical', value: criticalCount, icon: 'warning', color: 'text-red-600 bg-red-50 border-red-100' },
                    { label: "Today's", value: todayCount, icon: 'today', color: 'text-green-600 bg-green-50 border-green-100' },
                ].map(stat => (
                    <div key={stat.label} className={`flex items-center gap-3 p-4 rounded-2xl border ${stat.color}`}>
                        <span className="material-symbols-outlined text-xl">{stat.icon}</span>
                        <div>
                            <p className="text-xl font-black">{stat.value}</p>
                            <p className="text-[11px] font-semibold opacity-70">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter tabs + search */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-4 px-4 pt-4 pb-2 border-b border-slate-100 flex-wrap">
                    {/* Tabs */}
                    <div className="flex items-center gap-1 flex-wrap">
                        {CATEGORY_TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    activeTab === tab.key
                                        ? 'bg-primary text-white shadow-sm'
                                        : 'text-slate-500 hover:bg-slate-100'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
                                {tab.label}
                                {tabCount(tab.key) > 0 && (
                                    <span className={`text-[10px] font-black px-1 rounded-full ${
                                        activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                        {tabCount(tab.key)}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                    {/* Search */}
                    <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-300 text-sm">search</span>
                        <input
                            type="text"
                            placeholder="Search notifications..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-48"
                        />
                    </div>
                </div>

                {/* Notifications list */}
                <div className="p-4 space-y-3">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center gap-3 text-slate-300">
                            <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
                            <p className="text-sm font-medium">Loading notifications...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 flex flex-col items-center gap-3 text-slate-300">
                            <span className="material-symbols-outlined text-5xl">notifications_paused</span>
                            <p className="text-sm font-semibold">
                                {searchQuery ? 'No notifications match your search.' : "You're all caught up!"}
                            </p>
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="text-xs font-bold text-primary hover:underline"
                                >
                                    Clear search
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Critical section first */}
                            {activeTab === 'all' && filtered.some(n => n.priority === 1) && (
                                <div className="space-y-2 mb-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-1.5 px-1">
                                        <span className="material-symbols-outlined text-sm">warning</span>
                                        Requires Immediate Attention
                                    </p>
                                    {filtered.filter(n => n.priority === 1).map(n => (
                                        <NotifCard
                                            key={n.id}
                                            n={n}
                                            onRead={() => markRead(n.id)}
                                            onDismiss={() => dismiss(n.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Other notifications */}
                            {(activeTab !== 'all'
                                ? filtered
                                : filtered.filter(n => n.priority !== 1)
                            ).length > 0 && (
                                <div className="space-y-2">
                                    {activeTab === 'all' && (
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 px-1 mb-2">
                                            <span className="material-symbols-outlined text-sm">list</span>
                                            Other Notifications
                                        </p>
                                    )}
                                    {(activeTab !== 'all'
                                        ? filtered
                                        : filtered.filter(n => n.priority !== 1)
                                    ).map(n => (
                                        <NotifCard
                                            key={n.id}
                                            n={n}
                                            onRead={() => markRead(n.id)}
                                            onDismiss={() => dismiss(n.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationsCenter;
