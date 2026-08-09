import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
    critical:  { label: 'Critical Alerts',     icon: 'emergency',             color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
    inventory: { label: 'Inventory Issues',    icon: 'inventory_2',           color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    workflow:  { label: 'Workflow Alerts',     icon: 'assignment_late',       color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
    insight:   { label: 'Business Insights',   icon: 'trending_up',           color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
    staff:     { label: 'Staff Notifications', icon: 'badge',                 color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
};

// ─── Login Briefing Pop-up ────────────────────────────────────────────────────
const LoginBriefing: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { notifications, unreadCount, criticalCount } = useNotifications();
    const [visible, setVisible] = useState(false);

    // Slide in on mount
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 80);
        return () => clearTimeout(t);
    }, []);

    // Auto-dismiss after 20 seconds
    useEffect(() => {
        const t = setTimeout(() => handleClose(), 20_000);
        return () => clearTimeout(t);
    }, []);

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 350);
    };

    // Group unread notifications by category
    const unread = notifications.filter(n => !n.is_read);
    const byCat: Record<string, number> = {};
    unread.forEach(n => {
        byCat[n.category] = (byCat[n.category] || 0) + 1;
    });

    // Ordered categories (only those with notifications)
    const activeCategories = ['critical', 'inventory', 'workflow', 'insight', 'staff'].filter(c => byCat[c] > 0);

    // Highest-priority single notification to highlight
    const topNotif = notifications.find(n => !n.is_read && n.priority === 1) || notifications.find(n => !n.is_read);

    return (
        <div
            className={`w-[340px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transition-all duration-350 ${
                visible ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-[110%] opacity-0 scale-95'
            }`}
            style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
            {/* Header */}
            <div className={`px-4 pt-4 pb-3 flex items-start justify-between gap-3 ${
                criticalCount > 0 ? 'bg-gradient-to-r from-red-500 to-rose-500' : 'bg-gradient-to-r from-primary to-primary-light'
            }`}>
                <div className="flex items-center gap-2.5">
                    <div className="size-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-white text-[20px]">
                            {criticalCount > 0 ? 'warning' : 'notifications'}
                        </span>
                    </div>
                    <div>
                        <p className="text-white font-black text-sm leading-tight">
                            {criticalCount > 0 ? '⚠️ Attention Required' : '📋 Notification Summary'}
                        </p>
                        <p className="text-white/80 text-[11px] mt-0.5">
                            {unreadCount === 0
                                ? 'You\'re all caught up!'
                                : `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''} since last login`}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleClose}
                    className="size-6 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0 mt-0.5"
                >
                    <span className="material-symbols-outlined text-white text-sm">close</span>
                </button>
            </div>

            {/* Category breakdown */}
            {activeCategories.length > 0 ? (
                <div className="px-4 py-3 space-y-2">
                    {activeCategories.map(cat => {
                        const cfg = CATEGORY_CONFIG[cat];
                        const count = byCat[cat];
                        return (
                            <div
                                key={cat}
                                className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${cfg.bg} ${cfg.border}`}
                            >
                                <div className={`size-7 rounded-lg bg-white/60 flex items-center justify-center shrink-0`}>
                                    <span className={`material-symbols-outlined text-[15px] ${cfg.color}`}>{cfg.icon}</span>
                                </div>
                                <span className={`text-xs font-semibold flex-1 ${cfg.color}`}>{cfg.label}</span>
                                <span className={`text-xs font-black px-2 py-0.5 rounded-full bg-white/80 ${cfg.color} border ${cfg.border}`}>
                                    {count}
                                </span>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="px-4 py-6 flex flex-col items-center gap-2 text-slate-300">
                    <span className="material-symbols-outlined text-4xl">verified</span>
                    <p className="text-xs font-semibold text-slate-400">All caught up — no new alerts!</p>
                </div>
            )}

            {/* Top item preview */}
            {topNotif && (
                <div className="mx-4 mb-3 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Top Priority</p>
                    <p className="text-xs font-bold text-slate-700 leading-snug line-clamp-1">{topNotif.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{topNotif.message}</p>
                </div>
            )}

            {/* Footer CTA */}
            <div className="px-4 pb-4 flex gap-2">
                <Link
                    to="/admin/notifications"
                    onClick={handleClose}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors"
                >
                    <span className="material-symbols-outlined text-[14px]">notifications</span>
                    View All ({unreadCount})
                </Link>
                <button
                    onClick={handleClose}
                    className="flex items-center justify-center h-9 px-4 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors"
                >
                    Dismiss
                </button>
            </div>
        </div>
    );
};

// ─── Engine ───────────────────────────────────────────────────────────────────
const SmartToastEngine: React.FC = () => {
    const { notifications, loading } = useNotifications();
    const [showBriefing, setShowBriefing] = useState(false);
    const hasShown = useRef(false);

    // Show the briefing exactly once per session, after notifications load
    useEffect(() => {
        if (loading || hasShown.current) return;
        if (notifications.length === 0) return; // wait until we have data

        hasShown.current = true;

        // Small delay so the page finishes rendering first
        const t = setTimeout(() => setShowBriefing(true), 1200);
        return () => clearTimeout(t);
    }, [loading, notifications]);

    if (!showBriefing) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-auto">
            <LoginBriefing onClose={() => setShowBriefing(false)} />
        </div>
    );
};

export default SmartToastEngine;
