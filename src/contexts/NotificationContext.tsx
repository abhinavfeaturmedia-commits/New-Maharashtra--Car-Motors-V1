import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useData } from './DataContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmartNotification {
    id: string;
    type: string;
    category: 'critical' | 'insight' | 'staff' | 'inventory' | 'workflow';
    title: string;
    message: string;
    icon: string;
    color: 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'orange';
    priority: 1 | 2 | 3 | 4;
    is_read: boolean;
    is_dismissed: boolean;
    action_url?: string;
    action_label?: string;
    related_entity_type?: string;
    related_entity_id?: string;
    assigned_to_user_id?: string | null;
    dedup_key?: string;
    metadata: Record<string, any>;
    created_at: string;
    expires_at?: string;
}

interface NotificationContextType {
    notifications: SmartNotification[];
    unreadCount: number;
    criticalCount: number;
    loading: boolean;
    markRead: (id: string) => Promise<void>;
    markAllRead: () => Promise<void>;
    dismiss: (id: string) => Promise<void>;
    dismissAll: () => Promise<void>;
    addNotification: (notif: Partial<SmartNotification>) => Promise<void>;
    toastQueue: SmartNotification[];
    clearToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hoursSince = (d: string) => (Date.now() - new Date(d).getTime()) / 3_600_000;
const daysSince  = (d: string) => hoursSince(d) / 24;
const todayKey   = () => new Date().toISOString().split('T')[0];

// ─── Provider ─────────────────────────────────────────────────────────────────

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isAdmin } = useAuth();
    const { leads, bookings, inventory, tasks, followUps, loading: dataLoading } = useData();

    const [notifications, setNotifications] = useState<SmartNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [toastQueue, setToastQueue] = useState<SmartNotification[]>([]);
    const shownToastIds = useRef<Set<string>>(new Set());
    const checksRan = useRef(false);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const { data } = await supabase
                .from('smart_notifications')
                .select('*')
                .eq('is_dismissed', false)
                .order('priority', { ascending: true })
                .order('created_at', { ascending: false })
                .limit(100);
            if (data) setNotifications(data as SmartNotification[]);
        } catch (e) {
            console.error('fetchNotifications error', e);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // ── Smart Check Engine (admin-only, runs once after data loads) ───────────
    const runSmartChecks = useCallback(async () => {
        if (!user || !isAdmin || dataLoading) return;

        const today = todayKey();

        // Fetch dedup keys from last 24h to avoid re-inserting
        const since24h = new Date(Date.now() - 86_400_000).toISOString();
        const { data: recentRaw } = await supabase
            .from('smart_notifications')
            .select('dedup_key')
            .gte('created_at', since24h)
            .not('dedup_key', 'is', null);

        const existing = new Set((recentRaw || []).map((n: any) => n.dedup_key as string));
        const toInsert: Partial<SmartNotification>[] = [];

        const maybe = (n: Partial<SmartNotification> & { dedup_key: string }) => {
            if (!existing.has(n.dedup_key)) {
                toInsert.push(n);
                existing.add(n.dedup_key);
            }
        };

        // ── 1. Hot Lead Alert (48h no update) ────────────────────────────────
        leads.forEach(lead => {
            if (['lost', 'converted', 'sold'].includes(lead.status)) return;
            const hrs = hoursSince(lead.updated_at || lead.created_at);
            if (hrs < 48) return;
            maybe({
                type: 'hot_lead', category: 'critical', priority: 1,
                icon: 'local_fire_department', color: 'red',
                title: '🔥 Hot Lead Needs Attention',
                message: `${lead.full_name || 'A lead'} hasn't been contacted in ${Math.floor(hrs)}h.`,
                action_url: `/admin/leads/${lead.id}`, action_label: 'View Lead',
                related_entity_type: 'lead', related_entity_id: lead.id,
                assigned_to_user_id: lead.assigned_to || null,
                dedup_key: `hot_lead_${lead.id}_${today}`,
                metadata: { lead_name: lead.full_name, hours: Math.floor(hrs) },
            });
        });

        // ── 2. Booking Expiry (due within 24h) ───────────────────────────────
        const now = Date.now();
        bookings.forEach(b => {
            if (b.status !== 'confirmed') return;
            const ms = new Date(b.booking_date).getTime() - now;
            if (ms < 0 || ms > 86_400_000) return;
            const hrs = Math.round(ms / 3_600_000);
            maybe({
                type: 'booking_expiry', category: 'critical', priority: 1,
                icon: 'event_busy', color: 'amber',
                title: '⏰ Booking Expiry Approaching',
                message: `Booking for ${b.lead?.full_name || 'a customer'} expires in ~${hrs}h.`,
                action_url: '/admin/bookings', action_label: 'View Bookings',
                related_entity_type: 'booking', related_entity_id: b.id,
                assigned_to_user_id: null,
                dedup_key: `booking_expiry_${b.id}`,
                metadata: { booking_id: b.id, hours_left: hrs },
            });
        });

        // ── 3. Low Inventory Warning (1 unit left per model) ─────────────────
        const availableCars = inventory.filter(c => c.status === 'available');
        const modelCounts: Record<string, number> = {};
        availableCars.forEach(c => {
            const key = `${c.make}_${c.model}`;
            modelCounts[key] = (modelCounts[key] || 0) + 1;
        });
        Object.entries(modelCounts).forEach(([model, count]) => {
            if (count > 1) return;
            const [make, mdl] = model.split('_');
            maybe({
                type: 'low_inventory', category: 'inventory', priority: 2,
                icon: 'inventory_2', color: 'orange',
                title: '📦 Low Stock Alert',
                message: `Only 1 unit of ${make} ${mdl} remaining in inventory.`,
                action_url: '/admin/inventory', action_label: 'View Inventory',
                related_entity_type: 'inventory',
                assigned_to_user_id: null,
                dedup_key: `low_inventory_${model}_${today}`,
                metadata: { make, model: mdl },
            });
        });

        // ── 4. Overdue Payment (booking pending > 3 days) ────────────────────
        bookings.forEach(b => {
            if (b.payment_status !== 'pending') return;
            const days = daysSince(b.booking_date || b.created_at);
            if (days < 3) return;
            maybe({
                type: 'overdue_payment', category: 'critical', priority: 1,
                icon: 'payments', color: 'red',
                title: '💰 Overdue Payment',
                message: `${b.lead?.full_name || 'Customer'}'s booking payment is ${Math.floor(days)} days overdue.`,
                action_url: '/admin/bookings', action_label: 'View Bookings',
                related_entity_type: 'booking', related_entity_id: b.id,
                assigned_to_user_id: null,
                dedup_key: `overdue_payment_${b.id}_${today}`,
                metadata: { days: Math.floor(days) },
            });
        });

        // ── 5. Lead Conversion Nudge (in 'Interested' > 7 days) ──────────────
        leads.forEach(lead => {
            if (lead.status !== 'interested') return;
            const days = daysSince(lead.updated_at || lead.created_at);
            if (days < 7) return;
            maybe({
                type: 'lead_nudge', category: 'insight', priority: 3,
                icon: 'trending_up', color: 'blue',
                title: '📈 Conversion Opportunity',
                message: `${lead.full_name || 'A lead'} has been "Interested" for ${Math.floor(days)} days — time to book!`,
                action_url: `/admin/leads/${lead.id}`, action_label: 'View Lead',
                related_entity_type: 'lead', related_entity_id: lead.id,
                assigned_to_user_id: lead.assigned_to || null,
                dedup_key: `lead_nudge_${lead.id}_${today}`,
                metadata: { lead_name: lead.full_name, days: Math.floor(days) },
            });
        });

        // ── 6. Stale Vehicle (available > 60 days) ───────────────────────────
        inventory.forEach(car => {
            if (car.status !== 'available') return;
            const days = daysSince(car.created_at);
            if (days < 60) return;
            maybe({
                type: 'stale_vehicle', category: 'inventory', priority: 3,
                icon: 'timer_off', color: 'amber',
                title: '🚗 Price Revision Suggested',
                message: `${car.year} ${car.make} ${car.model} has been listed for ${Math.floor(days)} days. Consider revising the price.`,
                action_url: `/admin/inventory/${car.id}/edit`, action_label: 'Edit Listing',
                related_entity_type: 'inventory', related_entity_id: car.id,
                assigned_to_user_id: null,
                dedup_key: `stale_vehicle_${car.id}_${today}`,
                metadata: { car_name: `${car.year} ${car.make} ${car.model}`, days: Math.floor(days) },
            });
        });

        // ── 7. Overdue Follow-up ──────────────────────────────────────────────
        followUps.forEach((fu: any) => {
            if (fu.status === 'completed') return;
            if (!fu.next_followup_date) return;
            const hrs = hoursSince(fu.next_followup_date);
            if (hrs < 0) return;
            maybe({
                type: 'overdue_followup', category: 'critical', priority: 2,
                icon: 'notification_important', color: 'red',
                title: '📞 Overdue Follow-Up',
                message: `Follow-up with ${fu.lead?.full_name || 'a lead'} was due ${Math.floor(hrs)}h ago.`,
                action_url: '/admin/follow-ups', action_label: 'View Follow-Ups',
                related_entity_type: 'lead', related_entity_id: fu.lead_id,
                assigned_to_user_id: fu.lead?.assigned_to || null,
                dedup_key: `overdue_followup_${fu.id}_${today}`,
                metadata: { lead_name: fu.lead?.full_name },
            });
        });

        // ── 8. Overdue Task ───────────────────────────────────────────────────
        tasks.forEach((t: any) => {
            if (t.status === 'completed') return;
            const hrs = hoursSince(t.due_date);
            if (hrs < 0) return;
            maybe({
                type: 'task_overdue', category: 'workflow', priority: 2,
                icon: 'assignment_late', color: 'red',
                title: '✅ Task Overdue',
                message: `"${t.title}" was due ${Math.floor(hrs)}h ago.`,
                action_url: t.lead_id ? `/admin/leads/${t.lead_id}` : '/admin/notifications',
                action_label: 'View Task',
                related_entity_type: 'task', related_entity_id: t.id,
                assigned_to_user_id: null,
                dedup_key: `task_overdue_${t.id}_${today}`,
                metadata: { task_title: t.title },
            });
        });

        // ── 9. Duplicate Lead Detection (same phone in last 24h) ──────────────
        const phoneMap: Record<string, any[]> = {};
        leads.forEach(l => {
            if (!l.phone) return;
            if (hoursSince(l.created_at) > 24) return;
            if (!phoneMap[l.phone]) phoneMap[l.phone] = [];
            phoneMap[l.phone].push(l);
        });
        Object.entries(phoneMap).forEach(([phone, group]) => {
            if (group.length < 2) return;
            maybe({
                type: 'duplicate_lead', category: 'workflow', priority: 2,
                icon: 'content_copy', color: 'amber',
                title: '⚠️ Duplicate Lead Detected',
                message: `${group.length} leads share the phone number ${phone}. Consider merging.`,
                action_url: '/admin/leads', action_label: 'View Leads',
                assigned_to_user_id: null,
                dedup_key: `duplicate_lead_${phone}_${today}`,
                metadata: { phone, count: group.length },
            });
        });

        // ── 10. Daily Briefing (once per day per admin) ───────────────────────
        const todayFollowUps = followUps.filter((fu: any) => {
            if (!fu.next_followup_date) return false;
            return new Date(fu.next_followup_date).toDateString() === new Date().toDateString();
        }).length;
        const todayTasks = tasks.filter((t: any) => {
            if (t.status === 'completed') return false;
            return new Date(t.due_date).toDateString() === new Date().toDateString();
        }).length;
        maybe({
            type: 'daily_briefing', category: 'insight', priority: 4,
            icon: 'wb_sunny', color: 'blue',
            title: '☀️ Good Morning — Daily Briefing',
            message: `Today: ${todayFollowUps} follow-up(s) and ${todayTasks} task(s) scheduled.`,
            action_url: '/admin/planner', action_label: 'View Planner',
            assigned_to_user_id: null,
            dedup_key: `daily_briefing_${user.id}_${today}`,
            metadata: { follow_ups: todayFollowUps, tasks: todayTasks },
        });

        // ── Insert all new notifications ──────────────────────────────────────
        if (toInsert.length > 0) {
            const { error } = await supabase.from('smart_notifications').insert(toInsert);
            if (!error) await fetchNotifications();
        }
    }, [user, isAdmin, dataLoading, leads, bookings, inventory, tasks, followUps, fetchNotifications]);

    // ── Real-time subscription (smart_notifications) ──────────────────────────
    useEffect(() => {
        if (!user) return;
        fetchNotifications();

        const channel = supabase
            .channel('smart_notifications_realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'smart_notifications',
            }, (payload) => {
                const newNotif = payload.new as SmartNotification;
                // Only surface notifications assigned to this user OR broadcast (null)
                const isForMe =
                    !newNotif.assigned_to_user_id ||
                    newNotif.assigned_to_user_id === user.id;
                if (!isForMe) return;
                setNotifications(prev => [newNotif, ...prev]);
                // Queue as toast if priority 1 or 2
                if (newNotif.priority <= 2 && !shownToastIds.current.has(newNotif.id)) {
                    shownToastIds.current.add(newNotif.id);
                    setToastQueue(prev => [...prev, newNotif]);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'smart_notifications',
            }, () => {
                fetchNotifications();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user, fetchNotifications]);

    // ── Realtime: staff_incentives INSERT → notify the awarded staff member ──
    useEffect(() => {
        if (!user) return;

        const incChannel = supabase
            .channel('incentive_notifications_realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'staff_incentives',
            }, async (payload) => {
                const row = payload.new as any;
                const dedupKey = `incentive_awarded_${row.id}`;

                // Check dedup — avoid inserting twice if already present
                const { data: existing } = await supabase
                    .from('smart_notifications')
                    .select('id')
                    .eq('dedup_key', dedupKey)
                    .limit(1);
                if (existing && existing.length > 0) return;

                const amountFmt = `₹${Number(row.amount).toLocaleString('en-IN')}`;
                const typeLabel = row.incentive_type
                    ? row.incentive_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                    : 'Incentive';

                await supabase.from('smart_notifications').insert({
                    type: 'incentive_awarded',
                    category: 'staff',
                    priority: 1,
                    icon: 'workspace_premium',
                    color: 'green',
                    title: `🏆 You've Earned a ${typeLabel}!`,
                    message: `${amountFmt} has been awarded to you. Reason: ${row.reason || 'See incentives page.'}`,
                    action_url: '/admin/my-incentives',
                    action_label: 'View My Incentives',
                    related_entity_type: 'incentive',
                    related_entity_id: row.id,
                    assigned_to_user_id: row.staff_id,
                    dedup_key: dedupKey,
                    metadata: {
                        amount: row.amount,
                        incentive_type: row.incentive_type,
                        reason: row.reason,
                        month: row.month,
                    },
                    is_read: false,
                    is_dismissed: false,
                });
            })
            .subscribe();

        return () => { supabase.removeChannel(incChannel); };
    }, [user]);

    // ── Realtime: staff_announcements INSERT → broadcast notification ─────────
    useEffect(() => {
        if (!user) return;

        const annChannel = supabase
            .channel('announcement_notifications_realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'staff_announcements',
            }, async (payload) => {
                const row = payload.new as any;
                const dedupKey = `announcement_posted_${row.id}`;

                // Dedup guard
                const { data: existing } = await supabase
                    .from('smart_notifications')
                    .select('id')
                    .eq('dedup_key', dedupKey)
                    .limit(1);
                if (existing && existing.length > 0) return;

                // Map priority / colour
                let priority: 1 | 2 | 3 | 4 = 3;
                let color: SmartNotification['color'] = 'amber';
                let titlePrefix = '📢';

                if (row.priority === 'urgent') {
                    priority = 1;
                    color = 'red';
                    titlePrefix = '🚨';
                } else if (row.priority === 'celebration') {
                    priority = 2;
                    color = 'purple';
                    titlePrefix = '🎉';
                }

                await supabase.from('smart_notifications').insert({
                    type: `announcement_${row.priority ?? 'normal'}`,
                    category: 'staff',
                    priority,
                    icon: 'campaign',
                    color,
                    title: `${titlePrefix} ${row.title}`,
                    message: row.body
                        ? row.body.slice(0, 120) + (row.body.length > 120 ? '…' : '')
                        : 'A new announcement has been posted.',
                    action_url: '/admin/my-incentives',
                    action_label: 'View Announcements',
                    related_entity_type: 'announcement',
                    related_entity_id: row.id,
                    assigned_to_user_id: null, // broadcast — visible to all
                    dedup_key: dedupKey,
                    metadata: {
                        announcement_id: row.id,
                        priority: row.priority,
                        is_pinned: row.is_pinned,
                    },
                    is_read: false,
                    is_dismissed: false,
                });
            })
            .subscribe();

        return () => { supabase.removeChannel(annChannel); };
    }, [user]);

    // ── Run smart checks once after data loads ────────────────────────────────
    useEffect(() => {
        if (dataLoading || checksRan.current) return;
        checksRan.current = true;
        runSmartChecks();

        // Also run every 5 minutes
        const interval = setInterval(() => {
            checksRan.current = false; // allow re-run
            runSmartChecks();
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [dataLoading, runSmartChecks]);

    // ── Actions ───────────────────────────────────────────────────────────────
    const markRead = useCallback(async (id: string) => {
        await supabase.from('smart_notifications').update({ is_read: true }).eq('id', id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    }, []);

    const markAllRead = useCallback(async () => {
        await supabase.from('smart_notifications').update({ is_read: true }).eq('is_dismissed', false);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }, []);

    const dismiss = useCallback(async (id: string) => {
        await supabase.from('smart_notifications').update({ is_dismissed: true, is_read: true }).eq('id', id);
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const dismissAll = useCallback(async () => {
        await supabase.from('smart_notifications').update({ is_dismissed: true, is_read: true }).eq('is_dismissed', false);
        setNotifications([]);
    }, []);

    const addNotification = useCallback(async (notif: Partial<SmartNotification>) => {
        const { error } = await supabase.from('smart_notifications').insert([notif]);
        if (!error) await fetchNotifications();
    }, [fetchNotifications]);

    const clearToast = useCallback((id: string) => {
        setToastQueue(prev => prev.filter(n => n.id !== id));
    }, []);

    const unreadCount = notifications.filter(n => !n.is_read).length;
    const criticalCount = notifications.filter(n => n.priority === 1 && !n.is_read).length;

    return (
        <NotificationContext.Provider value={{
            notifications, unreadCount, criticalCount, loading,
            markRead, markAllRead, dismiss, dismissAll, addNotification,
            toastQueue, clearToast,
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useNotifications = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
    return ctx;
};
