import React, { useState, useEffect, useMemo } from 'react';
import { 
    TrendingUp, 
    Calendar, 
    User, 
    Target, 
    CheckCircle, 
    Phone, 
    DollarSign, 
    Users, 
    Plus, 
    Minus,
    Edit3, 
    BarChart2, 
    ArrowRight,
    Search,
    ChevronDown,
    Award,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    HelpCircle,
    Lock,
    Unlock,
    Share2,
    Flame,
    Sparkles,
    Check
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';

interface Commitment {
    id: string;
    user_id: string;
    date: string;
    deal: number;
    calls: number;
    crm_lead: number;
    crm_car_post: number;
    olx_car_post: number;
    fb_marketplace: number;
    reel_creation: number;
    visits: number;
    add_new_dealer_list: number;
    add_new_club_member: number;
    actual_deal: number;
    actual_calls: number;
    actual_crm_lead: number;
    actual_crm_car_post: number;
    actual_olx_car_post: number;
    actual_fb_marketplace: number;
    actual_reel_creation: number;
    actual_visits: number;
    actual_add_new_dealer_list: number;
    actual_add_new_club_member: number;
    is_verified: boolean;
    verified_by: string | null;
    created_at: string;
}

interface DailyReport {
    id: string;
    user_id: string;
    date: string;
    calling: number;
    follow_up: number;
    walking: number;
    hot: number;
    total_success: number;
    is_verified: boolean;
    verified_by: string | null;
    created_at: string;
}

interface StaffMember {
    id: string;
    full_name: string | null;
    role: string;
    email: string | null;
}

const StaffAccountabilityDashboard: React.FC = () => {
    const { profile, isAdmin } = useAuth();
    const { leads, sales, visits, clubMembers, settings, refreshData } = useData();
    
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    
    // Admin state
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
    
    // Filtering & Sorting for Leaderboard
    const [leaderboardSearch, setLeaderboardSearch] = useState('');
    const [leaderboardRole, setLeaderboardRole] = useState<'all' | 'sales' | 'staff'>('all');
    const [sortBy, setSortBy] = useState<'overall' | 'deals' | 'calls' | 'followups'>('overall');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    
    // Core data
    const [commitments, setCommitments] = useState<Commitment[]>([]);
    const [reports, setReports] = useState<DailyReport[]>([]);
    
    // Modals for editing / logging directly from the dashboard
    const [showCommitmentModal, setShowCommitmentModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    
    // Celebration tracking (triggers burst effect on 100%)
    const [celebratedField, setCelebratedField] = useState<string | null>(null);
    
    // Form states
    const [commitmentForm, setCommitmentForm] = useState({
        deal: 0,
        calls: 0,
        crm_lead: 0,
        crm_car_post: 0,
        olx_car_post: 0,
        fb_marketplace: 0,
        reel_creation: 0,
        visits: 0,
        add_new_dealer_list: 0,
        add_new_club_member: 0,
    });
    
    const [reportForm, setReportForm] = useState({
        calling: 0,
        follow_up: 0,
        walking: 0,
        hot: 0,
        total_success: 0,
    });
    
    const [submitting, setSubmitting] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [verifyingId, setVerifyingId] = useState<string | null>(null);

    // Get date boundaries
    const dateRange = useMemo(() => {
        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        let from = todayStr;
        let to = todayStr;

        if (period === 'yesterday') {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            const yestStr = d.toLocaleDateString('en-CA');
            from = yestStr;
            to = yestStr;
        } else if (period === 'week') {
            const d = new Date();
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1); // start on Monday
            const startOfWeek = new Date(d.setDate(diff));
            from = startOfWeek.toLocaleDateString('en-CA');
            to = todayStr;
        } else if (period === 'month') {
            const d = new Date();
            const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
            from = startOfMonth.toLocaleDateString('en-CA');
            to = todayStr;
        } else if (period === 'custom') {
            from = dateFrom || todayStr;
            to = dateTo || todayStr;
        }

        return { from, to };
    }, [period, dateFrom, dateTo]);

    // Initial load: Fetch staff if admin
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                if (isAdmin) {
                    const { data } = await supabase
                        .from('profiles')
                        .select('id, full_name, role, email')
                        .in('role', ['admin', 'staff'])
                        .eq('is_active', true)
                        .order('full_name');
                    if (data) setStaffList(data);
                }
            } catch (err) {
                console.error('Error fetching staff profiles:', err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [isAdmin]);

    // Fetch commitments and reports when filters change
    const fetchData = async () => {
        setLoading(true);
        try {
            const staffId = isAdmin ? selectedStaffId : profile?.id;
            
            let commitmentQuery = supabase
                .from('staff_commitments')
                .select('*')
                .gte('date', dateRange.from)
                .lte('date', dateRange.to);
                
            let reportQuery = supabase
                .from('staff_daily_reports')
                .select('*')
                .gte('date', dateRange.from)
                .lte('date', dateRange.to);
                
            if (staffId && staffId !== 'all') {
                commitmentQuery = commitmentQuery.eq('user_id', staffId);
                reportQuery = reportQuery.eq('user_id', staffId);
            }
            
            const [commRes, repRes] = await Promise.all([
                commitmentQuery.order('date', { ascending: false }),
                reportQuery.order('date', { ascending: false })
            ]);
            
            if (commRes.data) setCommitments(commRes.data as Commitment[]);
            if (repRes.data) setReports(repRes.data as DailyReport[]);
        } catch (err) {
            console.error('Error fetching accountability records:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [dateRange, selectedStaffId, profile]);

    // Active target user
    const targetUserId = useMemo(() => {
        return (isAdmin && selectedStaffId !== 'all') ? selectedStaffId : profile?.id;
    }, [isAdmin, selectedStaffId, profile]);

    // Compute auto-synced counts from CRM database context in memory
    const getAutoSyncedValues = (userId: string, dateStr: string) => {
        const isSameDate = (isoStr: string) => {
            if (!isoStr) return false;
            const d = new Date(isoStr);
            return d.toLocaleDateString('en-CA') === dateStr;
        };

        const leadsToday = leads.filter(l => l.assigned_to === userId && isSameDate(l.created_at));
        const autoCrmLeads = leadsToday.length;

        // Deals Closed: Leads marked closed_won today OR logged in sales table today
        const wonLeadsToday = leads.filter(l => l.assigned_to === userId && l.status === 'closed_won' && isSameDate(l.updated_at));
        const salesToday = sales.filter(s => s.sold_by === userId && s.sale_date === dateStr);
        const autoDeals = Math.max(wonLeadsToday.length, salesToday.length);

        // Visits made today
        const visitsToday = visits.filter(v => v.staff_id === userId && isSameDate(v.created_at));
        const autoVisits = visitsToday.length;

        // Club members added today
        const clubMembersToday = clubMembers.filter(m => m.added_by === userId && isSameDate(m.created_at));
        const autoClubMembers = clubMembersToday.length;

        return {
            autoCrmLeads,
            autoDeals,
            autoVisits,
            autoClubMembers
        };
    };

    // Today's auto synced values for current target user
    const todayAutoValues = useMemo(() => {
        if (!targetUserId) return { autoCrmLeads: 0, autoDeals: 0, autoVisits: 0, autoClubMembers: 0 };
        const todayStr = new Date().toLocaleDateString('en-CA');
        return getAutoSyncedValues(targetUserId, todayStr);
    }, [targetUserId, leads, sales, visits, clubMembers]);

    // Active commitment for today (to display manual tracking)
    const todayLogs = useMemo(() => {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const commToday = commitments.find(c => c.date === todayStr && c.user_id === targetUserId);
        const repToday = reports.find(r => r.date === todayStr && r.user_id === targetUserId);
        return {
            commitment: commToday,
            report: repToday
        };
    }, [commitments, reports, targetUserId]);

    // Check compliance status for nudges
    const complianceAlert = useMemo(() => {
        if (isAdmin && selectedStaffId === 'all') return null;
        const currentHour = new Date().getHours();
        
        if (!todayLogs.commitment && currentHour >= 10) {
            return {
                type: 'commitment',
                message: '⏳ Morning Commitments target check-in is pending. Please click "Log Targets" to set goals.'
            };
        }
        
        if (todayLogs.commitment && !todayLogs.report && currentHour >= 18) {
            return {
                type: 'report',
                message: '⏳ Evening performance report is pending. Please log your daily actual closures.'
            };
        }
        
        return null;
    }, [todayLogs, isAdmin, selectedStaffId]);

    // Calculate active user consistency streak (consecutive days met targets)
    const activeUserStreak = useMemo(() => {
        if (!targetUserId) return 0;
        
        const sortedComms = [...commitments]
            .filter(c => c.user_id === targetUserId)
            .sort((a, b) => b.date.localeCompare(a.date));
            
        let streak = 0;
        const todayStr = new Date().toLocaleDateString('en-CA');
        let checkIndex = 0;
        
        if (sortedComms.length > 0 && sortedComms[0].date === todayStr) {
            const c = sortedComms[0];
            const rep = reports.find(r => r.date === c.date && r.user_id === targetUserId);
            const autos = getAutoSyncedValues(targetUserId, c.date);
            const actCalls = Math.max(c.actual_calls, rep?.calling || 0);
            const actDeals = Math.max(c.actual_deal, rep?.total_success || 0, autos.autoDeals);
            
            const isMet = (c.calls + c.deal > 0) && (actCalls + actDeals >= c.calls + c.deal);
            if (isMet) {
                streak++;
                checkIndex = 1;
            } else {
                checkIndex = 1;
            }
        }
        
        for (let i = checkIndex; i < sortedComms.length; i++) {
            const c = sortedComms[i];
            const rep = reports.find(r => r.date === c.date && r.user_id === targetUserId);
            const autos = getAutoSyncedValues(targetUserId, c.date);
            const actCalls = Math.max(c.actual_calls, rep?.calling || 0);
            const actDeals = Math.max(c.actual_deal, rep?.total_success || 0, autos.autoDeals);
            
            const isMet = (c.calls + c.deal > 0) && (actCalls + actDeals >= c.calls + c.deal);
            if (isMet) {
                streak++;
            } else {
                break;
            }
        }
        
        return streak;
    }, [commitments, reports, targetUserId, leads, sales]);

    // Optimistic actual metrics updater with auto-sync boundaries
    const handleIncrementActual = async (field: keyof Commitment, delta: number, targetVal: number, autoVal: number = 0) => {
        if (!todayLogs.commitment) return;
        
        // Block action if today's log is verified/locked by admin
        if (todayLogs.commitment.is_verified) {
            alert('This log is audited and locked by administrator. You cannot edit it.');
            return;
        }

        const currentDbVal = todayLogs.commitment[field] as number;
        const baseline = Math.max(currentDbVal, autoVal);
        const newVal = Math.max(0, baseline + delta);
        
        // Trigger star burst animation if hitting exactly 100% progress
        if (newVal >= targetVal && baseline < targetVal) {
            setCelebratedField(field);
            setTimeout(() => setCelebratedField(null), 2500); // end celebration
        }

        // Optimistic UI state update
        setCommitments(prev => prev.map(c => 
            c.id === todayLogs.commitment!.id 
                ? { ...c, [field]: newVal } 
                : c
        ));
        
        try {
            const { error } = await supabase
                .from('staff_commitments')
                .update({ [field]: newVal })
                .eq('id', todayLogs.commitment.id);
            if (error) throw error;
        } catch (err) {
            console.error('Error updating commitments actuals:', err);
            // Rollback on error
            setCommitments(prev => prev.map(c => 
                c.id === todayLogs.commitment!.id 
                    ? { ...c, [field]: currentDbVal } 
                    : c
            ));
        }
    };

    // CRM Auto-Sync trigger: Saves all auto-synced values to commitments table
    const handleSyncCRM = async () => {
        if (!todayLogs.commitment || !targetUserId) return;
        if (todayLogs.commitment.is_verified) {
            alert('This log is audited and locked by administrator.');
            return;
        }
        setSyncing(true);
        try {
            const { error } = await supabase
                .from('staff_commitments')
                .update({
                    actual_crm_lead: Math.max(todayLogs.commitment.actual_crm_lead, todayAutoValues.autoCrmLeads),
                    actual_deal: Math.max(todayLogs.commitment.actual_deal, todayAutoValues.autoDeals),
                    actual_visits: Math.max(todayLogs.commitment.actual_visits, todayAutoValues.autoVisits),
                    actual_add_new_club_member: Math.max(todayLogs.commitment.actual_add_new_club_member, todayAutoValues.autoClubMembers),
                })
                .eq('id', todayLogs.commitment.id);
            if (error) throw error;
            fetchData();
        } catch (err) {
            console.error('Sync failed:', err);
            alert('Failed to sync CRM activities: ' + err);
        } finally {
            setSyncing(false);
        }
    };

    // Admin Verification action
    const handleToggleVerification = async (dateStr: string, staffId: string, isCurrentlyVerified: boolean) => {
        setVerifyingId(`${staffId}-${dateStr}`);
        try {
            const newVerificationStatus = !isCurrentlyVerified;
            
            const commUpdate = supabase
                .from('staff_commitments')
                .update({
                    is_verified: newVerificationStatus,
                    verified_by: newVerificationStatus ? profile?.id : null
                })
                .eq('date', dateStr)
                .eq('user_id', staffId);

            const repUpdate = supabase
                .from('staff_daily_reports')
                .update({
                    is_verified: newVerificationStatus,
                    verified_by: newVerificationStatus ? profile?.id : null
                })
                .eq('date', dateStr)
                .eq('user_id', staffId);

            await Promise.all([commUpdate, repUpdate]);
            await fetchData();
        } catch (err) {
            console.error('Verification failed:', err);
            alert('Failed to verify accountability records.');
        } finally {
            setVerifyingId(null);
        }
    };

    // Consistency Calendar calculations (Mon-Sun of current week)
    const weeklyConsistency = useMemo(() => {
        if (!targetUserId) return [];
        const daysOfWeek = [];
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        const monday = new Date(d.setDate(diff));
        
        for (let i = 0; i < 7; i++) {
            const currentDay = new Date(monday);
            currentDay.setDate(monday.getDate() + i);
            const dateStr = currentDay.toLocaleDateString('en-CA');
            
            const comm = commitments.find(c => c.date === dateStr && c.user_id === targetUserId);
            const rep = reports.find(r => r.date === dateStr && r.user_id === targetUserId);
            
            let status: 'green' | 'amber' | 'red' | 'gray' = 'gray';
            let details = 'No targets scheduled';
            
            if (comm) {
                const totalTargets = comm.calls + comm.deal;
                const autos = getAutoSyncedValues(targetUserId, dateStr);
                const actualCalls = Math.max(comm.actual_calls, rep?.calling || 0);
                const actualDeals = Math.max(comm.actual_deal, rep?.total_success || 0, autos.autoDeals);
                
                const totalActuals = actualCalls + actualDeals;
                
                if (totalTargets > 0) {
                    const pct = Math.round((totalActuals / totalTargets) * 100);
                    if (pct >= 100) {
                        status = 'green';
                        details = `🏆 100%+ Completed (${totalActuals}/${totalTargets} Calls/Deals)`;
                    } else if (pct >= 50) {
                        status = 'amber';
                        details = `⚡ ${pct}% Progress (${totalActuals}/${totalTargets} Calls/Deals)`;
                    } else {
                        status = 'red';
                        details = `⏳ ${pct}% Completed (${totalActuals}/${totalTargets} Calls/Deals)`;
                    }
                } else {
                    status = 'green';
                    details = '✅ Checked in — no calls/deals targets set';
                }
            } else {
                const isPast = new Date(dateStr) < new Date(new Date().toLocaleDateString('en-CA'));
                if (isPast) {
                    status = 'red';
                    details = '⏳ Missed Logging targets';
                }
            }
            
            daysOfWeek.push({
                name: currentDay.toLocaleDateString('en-IN', { weekday: 'short' }),
                dateFormatted: currentDay.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                dateStr,
                status,
                details,
                isVerified: comm?.is_verified || false
            });
        }
        return daysOfWeek;
    }, [commitments, reports, targetUserId, leads, sales]);

    // Daily historical log grouping
    const dailyHistoryLog = useMemo(() => {
        const datesMap: Record<string, Record<string, { commitment?: Commitment; report?: DailyReport }>> = {};
        
        commitments.forEach(c => {
            if (!datesMap[c.date]) datesMap[c.date] = {};
            if (!datesMap[c.date][c.user_id]) datesMap[c.date][c.user_id] = {};
            datesMap[c.date][c.user_id].commitment = c;
        });
        
        reports.forEach(r => {
            if (!datesMap[r.date]) datesMap[r.date] = {};
            if (!datesMap[r.date][r.user_id]) datesMap[r.date][r.user_id] = {};
            datesMap[r.date][r.user_id].report = r;
        });
        
        const daysArray: { 
            date: string; 
            logs: { 
                staffId: string; 
                staffName: string; 
                commitment?: Commitment; 
                report?: DailyReport 
            }[] 
        }[] = [];
        
        Object.entries(datesMap).forEach(([date, userMap]) => {
            const logs = Object.entries(userMap).map(([userId, logData]) => {
                const staff = staffList.find(s => s.id === userId) || 
                              (userId === profile?.id ? { full_name: profile.full_name || 'Admin', role: 'admin' } : { full_name: 'Staff Member', role: 'staff' });
                return {
                    staffId: userId,
                    staffName: staff.full_name || 'Staff Member',
                    commitment: logData.commitment,
                    report: logData.report
                };
            });
            daysArray.push({ date, logs });
        });
        
        return daysArray.sort((a, b) => b.date.localeCompare(a.date));
    }, [commitments, reports, staffList, profile]);

    // Period aggregations
    const stats = useMemo(() => {
        const targetCalls = commitments.reduce((sum, c) => sum + c.calls, 0);
        const actualCalls = commitments.reduce((sum, c) => {
            const repVal = reports.find(r => r.date === c.date && r.user_id === c.user_id)?.calling || 0;
            return sum + Math.max(c.actual_calls, repVal);
        }, 0);
        
        const targetDeals = commitments.reduce((sum, c) => sum + c.deal, 0);
        const actualDeals = commitments.reduce((sum, c) => {
            const repVal = reports.find(r => r.date === c.date && r.user_id === c.user_id)?.total_success || 0;
            const autoVal = getAutoSyncedValues(c.user_id, c.date).autoDeals;
            return sum + Math.max(c.actual_deal, repVal, autoVal);
        }, 0);

        const actualFollowUps = reports.reduce((sum, r) => sum + r.follow_up, 0);
        const actualWalkins = reports.reduce((sum, r) => sum + r.walking, 0);
        const actualHots = reports.reduce((sum, r) => sum + r.hot, 0);

        const targetCrmLeads = commitments.reduce((sum, c) => sum + c.crm_lead, 0);
        const actualCrmLeads = commitments.reduce((sum, c) => {
            const autoVal = getAutoSyncedValues(c.user_id, c.date).autoCrmLeads;
            return sum + Math.max(c.actual_crm_lead, autoVal);
        }, 0);

        const targetCrmPosts = commitments.reduce((sum, c) => sum + c.crm_car_post, 0);
        const actualCrmPosts = commitments.reduce((sum, c) => sum + c.actual_crm_car_post, 0);

        const targetOlxPosts = commitments.reduce((sum, c) => sum + c.olx_car_post, 0);
        const actualOlxPosts = commitments.reduce((sum, c) => sum + c.actual_olx_car_post, 0);

        const targetFbPosts = commitments.reduce((sum, c) => sum + c.fb_marketplace, 0);
        const actualFbPosts = commitments.reduce((sum, c) => sum + c.actual_fb_marketplace, 0);

        const targetReels = commitments.reduce((sum, c) => sum + c.reel_creation, 0);
        const actualReels = commitments.reduce((sum, c) => sum + c.actual_reel_creation, 0);

        const targetVisits = commitments.reduce((sum, c) => sum + c.visits, 0);
        const actualVisits = commitments.reduce((sum, c) => {
            const autoVal = getAutoSyncedValues(c.user_id, c.date).autoVisits;
            return sum + Math.max(c.actual_visits, autoVal);
        }, 0);

        const targetDealers = commitments.reduce((sum, c) => sum + c.add_new_dealer_list, 0);
        const actualDealers = commitments.reduce((sum, c) => sum + c.actual_add_new_dealer_list, 0);

        const targetClubMembers = commitments.reduce((sum, c) => sum + c.add_new_club_member, 0);
        const actualClubMembers = commitments.reduce((sum, c) => {
            const autoVal = getAutoSyncedValues(c.user_id, c.date).autoClubMembers;
            return sum + Math.max(c.actual_add_new_club_member, autoVal);
        }, 0);

        return {
            targetCalls,
            actualCalls,
            callCompletion: targetCalls > 0 ? Math.round((actualCalls / targetCalls) * 100) : 0,
            
            targetDeals,
            actualDeals,
            dealCompletion: targetDeals > 0 ? Math.round((actualDeals / targetDeals) * 100) : 0,
            
            actualFollowUps,
            actualWalkins,
            actualHots,
            
            targetCrmLeads, actualCrmLeads,
            targetCrmPosts, actualCrmPosts,
            targetOlxPosts, actualOlxPosts,
            targetFbPosts, actualFbPosts,
            targetReels, actualReels,
            targetVisits, actualVisits,
            targetDealers, actualDealers,
            targetClubMembers, actualClubMembers
        };
    }, [commitments, reports, leads, sales, visits, clubMembers]);

    // Group stats by staff member (Leaderboard view)
    const staffStats = useMemo(() => {
        if (!isAdmin) return [];
        return staffList.map(s => {
            const memberComms = commitments.filter(c => c.user_id === s.id);
            const memberReps = reports.filter(r => r.user_id === s.id);
            
            const commCount = memberComms.length;
            const repCount = memberReps.length;
            
            const targetDeals = memberComms.reduce((sum, c) => sum + c.deal, 0);
            const actualDeals = memberComms.reduce((sum, c) => {
                const repVal = memberReps.find(r => r.date === c.date)?.total_success || 0;
                const autoVal = getAutoSyncedValues(s.id, c.date).autoDeals;
                return sum + Math.max(c.actual_deal, repVal, autoVal);
            }, 0);
            
            const targetCalls = memberComms.reduce((sum, c) => sum + c.calls, 0);
            const actualCalls = memberComms.reduce((sum, c) => {
                const repVal = memberReps.find(r => r.date === c.date)?.calling || 0;
                return sum + Math.max(c.actual_calls, repVal);
            }, 0);
            
            const followUps = memberReps.reduce((sum, r) => sum + r.follow_up, 0);
            const overallPct = (targetDeals + targetCalls) > 0 
                ? Math.round(((actualDeals + actualCalls) / (targetDeals + targetCalls)) * 100) 
                : 0;

            const isVerified = memberComms.some(c => c.is_verified) || memberReps.some(r => r.is_verified);

            return {
                ...s,
                commCount,
                repCount,
                targetDeals,
                actualDeals,
                targetCalls,
                actualCalls,
                followUps,
                overallPct,
                isVerified
            };
        });
    }, [isAdmin, staffList, commitments, reports, leads, sales]);

    // Leaderboard filtration and sorting
    const filteredLeaderboard = useMemo(() => {
        let list = [...staffStats];
        
        // 1. Text search
        if (leaderboardSearch.trim()) {
            const q = leaderboardSearch.toLowerCase().trim();
            list = list.filter(s => s.full_name?.toLowerCase().includes(q));
        }

        // 2. Role filter
        if (leaderboardRole !== 'all') {
            list = list.filter(s => s.role === leaderboardRole);
        }

        // 3. Sorting
        list.sort((a, b) => {
            let fieldA = 0;
            let fieldB = 0;
            if (sortBy === 'overall') {
                fieldA = a.overallPct;
                fieldB = b.overallPct;
            } else if (sortBy === 'deals') {
                fieldA = a.actualDeals;
                fieldB = b.actualDeals;
            } else if (sortBy === 'calls') {
                fieldA = a.actualCalls;
                fieldB = b.actualCalls;
            } else if (sortBy === 'followups') {
                fieldA = a.followUps;
                fieldB = b.followUps;
            }

            return sortDirection === 'desc' ? fieldB - fieldA : fieldA - fieldB;
        });

        return list;
    }, [staffStats, leaderboardSearch, leaderboardRole, sortBy, sortDirection]);

    // Copy formatted leaderboard summary to clipboard (WhatsApp/Slack)
    const handleExportLeaderboard = () => {
        let text = `📊 *SSM Staff Accountability Leaderboard* (${dateRange.from} to ${dateRange.to})\n`;
        text += `--------------------------------------------------\n\n`;
        
        filteredLeaderboard.forEach((s, idx) => {
            const statusEmoji = s.overallPct >= 100 ? '🏆' : s.overallPct >= 50 ? '⚡' : '⏳';
            text += `${idx + 1}. *${s.full_name}* (${s.role.toUpperCase()}) ${statusEmoji}\n`;
            text += `   • Commitment Met: *${s.overallPct}%*\n`;
            text += `   • Deals Closed: *${s.actualDeals}* / ${s.targetDeals}\n`;
            text += `   • Calling Actuals: *${s.actualCalls}* / ${s.targetCalls}\n`;
            text += `   • Follow-Ups: *${s.followUps}*\n\n`;
        });
        
        navigator.clipboard.writeText(text);
        alert('Leaderboard copied to clipboard! You can now paste it directly into WhatsApp or Slack.');
    };

    // CSS Milestone burst celebration component
    const MilestoneCelebration = () => {
        return (
            <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50 animate-in fade-in duration-200">
                <div className="bg-emerald-600 text-white rounded-3xl px-8 py-5 flex flex-col items-center justify-center shadow-2xl border border-emerald-400 space-y-2 animate-pop-milestone">
                    <div className="size-14 bg-white/20 rounded-full flex items-center justify-center text-white shrink-0">
                        <Sparkles size={28} className="animate-spin" />
                    </div>
                    <span className="text-sm font-bold uppercase tracking-wider">Milestone Reached!</span>
                    <span className="text-xl font-black">100% Commitment Hit! 🎉</span>
                </div>
            </div>
        );
    };

    // SVG Target vs Actual Trend Graph (Lightweight, responsive)
    const TrendGraph = () => {
        const chartData = useMemo(() => {
            return [...dailyHistoryLog].reverse(); // cronological order
        }, [dailyHistoryLog]);

        if (chartData.length < 2) {
            return (
                <div className="h-44 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center p-4 text-center">
                    <AlertCircle size={24} className="text-slate-400 mb-1" />
                    <span className="text-xs font-bold text-slate-400 uppercase">Trend charts need logs for at least 2 days to render.</span>
                </div>
            );
        }

        const maxVal = Math.max(
            ...chartData.map(d => {
                const activeLog = d.logs.find(l => l.staffId === targetUserId);
                const actCalls = Math.max(activeLog?.commitment?.actual_calls || 0, activeLog?.report?.calling || 0);
                return Math.max(activeLog?.commitment?.calls || 0, actCalls);
            }),
            10 // default min height scale
        );

        const width = 600;
        const height = 150;
        const padX = 40;
        const padY = 20;

        const points = chartData.map((d, index) => {
            const x = padX + (index / (chartData.length - 1)) * (width - padX * 2);
            
            const activeLog = d.logs.find(l => l.staffId === targetUserId);
            const tgtCalls = activeLog?.commitment?.calls || 0;
            const repCalls = activeLog?.report?.calling || 0;
            const actCalls = Math.max(activeLog?.commitment?.actual_calls || 0, repCalls);

            const yTgt = height - padY - (tgtCalls / maxVal) * (height - padY * 2);
            const yAct = height - padY - (actCalls / maxVal) * (height - padY * 2);

            return { x, yTgt, yAct, date: d.date };
        });

        const targetPath = points.map(p => `${p.x},${p.yTgt}`).join(' ');
        const actualPath = points.map(p => `${p.x},${p.yAct}`).join(' ');

        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500 uppercase tracking-wider">Calling Activity Trends</span>
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                            <span className="w-3 h-0.5 border-t-2 border-indigo-400 border-dashed"></span> Target
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-indigo-600 font-bold uppercase">
                            <span className="w-3 h-0.5 bg-indigo-600"></span> Actual
                        </span>
                    </div>
                </div>
                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4">
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                        {/* Grid lines */}
                        <line x1={padX} y1={padY} x2={width - padX} y2={padY} stroke="#f1f5f9" strokeWidth="1" />
                        <line x1={padX} y1={height / 2} x2={width - padX} y2={height / 2} stroke="#f1f5f9" strokeWidth="1" />
                        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="#e2e8f0" strokeWidth="1.5" />

                        {/* Y-axis labels */}
                        <text x={padX - 10} y={padY + 4} textAnchor="end" className="text-[10px] font-bold fill-slate-400">{Math.round(maxVal)}</text>
                        <text x={padX - 10} y={height / 2 + 4} textAnchor="end" className="text-[10px] font-bold fill-slate-400">{Math.round(maxVal / 2)}</text>
                        <text x={padX - 10} y={height - padY + 4} textAnchor="end" className="text-[10px] font-bold fill-slate-400">0</text>

                        {/* Dotted Target Line */}
                        <polyline fill="none" stroke="#a5b4fc" strokeWidth="2" strokeDasharray="5 5" points={targetPath} />
                        
                        {/* Solid Actual Line */}
                        <polyline fill="none" stroke="#4f46e5" strokeWidth="3" points={actualPath} />

                        {/* Interactive dots */}
                        {points.map((p, i) => (
                            <g key={i} className="group/dot cursor-pointer">
                                <circle cx={p.x} cy={p.yAct} r="4" fill="#4f46e5" stroke="#ffffff" strokeWidth="2" />
                                <circle cx={p.x} cy={p.yAct} r="10" fill="transparent" />
                                
                                {/* Hover details box */}
                                <g className="hidden group-hover/dot:block z-30">
                                    <rect x={p.x - 30} y={p.yAct - 28} width="60" height="20" rx="4" fill="#0f172a" />
                                    <text x={p.x} y={p.yAct - 15} textAnchor="middle" fill="#ffffff" className="text-[10px] font-black">
                                        {chartData[i].date.split('-').slice(1).reverse().join('/')}
                                    </text>
                                </g>
                            </g>
                        ))}
                    </svg>
                </div>
            </div>
        );
    };

    // Handle Commitment Submission
    const handleCommitmentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;
        setSubmitting(true);
        const todayStr = new Date().toLocaleDateString('en-CA');
        
        try {
            const actuals = todayLogs.commitment ? {
                actual_deal: todayLogs.commitment.actual_deal,
                actual_calls: todayLogs.commitment.actual_calls,
                actual_crm_lead: todayLogs.commitment.actual_crm_lead,
                actual_crm_car_post: todayLogs.commitment.actual_crm_car_post,
                actual_olx_car_post: todayLogs.commitment.actual_olx_car_post,
                actual_fb_marketplace: todayLogs.commitment.actual_fb_marketplace,
                actual_reel_creation: todayLogs.commitment.actual_reel_creation,
                actual_visits: todayLogs.commitment.actual_visits,
                actual_add_new_dealer_list: todayLogs.commitment.actual_add_new_dealer_list,
                actual_add_new_club_member: todayLogs.commitment.actual_add_new_club_member,
            } : {};

            const { error } = await supabase
                .from('staff_commitments')
                .upsert({
                    user_id: profile.id,
                    date: todayStr,
                    ...commitmentForm,
                    ...actuals
                }, { onConflict: 'user_id, date' });
                
            if (error) throw error;
            setShowCommitmentModal(false);
            fetchData();
        } catch (err) {
            console.error('Error saving commitment:', err);
            alert('Failed to save commitment. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Handle Report Submission
    const handleReportSubmit = async (e: React.FormEvent) => {
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
                    ...reportForm
                }, { onConflict: 'user_id, date' });
                
            if (error) throw error;
            setShowReportModal(false);
            fetchData();
        } catch (err) {
            console.error('Error saving daily report:', err);
            alert('Failed to save daily report. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const openCommitmentCreate = () => {
        if (todayLogs.commitment) {
            setCommitmentForm({
                deal: todayLogs.commitment.deal,
                calls: todayLogs.commitment.calls,
                crm_lead: todayLogs.commitment.crm_lead,
                crm_car_post: todayLogs.commitment.crm_car_post,
                olx_car_post: todayLogs.commitment.olx_car_post,
                fb_marketplace: todayLogs.commitment.fb_marketplace,
                reel_creation: todayLogs.commitment.reel_creation,
                visits: todayLogs.commitment.visits,
                add_new_dealer_list: todayLogs.commitment.add_new_dealer_list,
                add_new_club_member: todayLogs.commitment.add_new_club_member,
            });
        } else {
            setCommitmentForm({
                deal: 0,
                calls: 0,
                crm_lead: 0,
                crm_car_post: 0,
                olx_car_post: 0,
                fb_marketplace: 0,
                reel_creation: 0,
                visits: 0,
                add_new_dealer_list: 0,
                add_new_club_member: 0,
            });
        }
        setShowCommitmentModal(true);
    };

    const openReportCreate = () => {
        if (todayLogs.report) {
            setReportForm({
                calling: todayLogs.report.calling,
                follow_up: todayLogs.report.follow_up,
                walking: todayLogs.report.walking,
                hot: todayLogs.report.hot,
                total_success: todayLogs.report.total_success,
            });
        } else {
            const actCalls = Math.max(todayLogs.commitment?.actual_calls || 0);
            const actSuccess = Math.max(todayLogs.commitment?.actual_deal || 0, todayAutoValues.autoDeals);
            
            setReportForm({
                calling: actCalls,
                follow_up: 0,
                walking: todayLogs.commitment?.actual_visits || 0,
                hot: 0,
                total_success: actSuccess,
            });
        }
        setShowReportModal(true);
    };

    // Active fields list for live tracker
    const activeTrackerFields = useMemo(() => {
        if (!todayLogs.commitment) return [];
        
        const items = [
            { key: 'deal', actualKey: 'actual_deal', autoVal: todayAutoValues.autoDeals, label: 'Deals Closed', icon: 'handshake' },
            { key: 'calls', actualKey: 'actual_calls', autoVal: 0, label: 'Calls Made', icon: 'phone' },
            { key: 'crm_lead', actualKey: 'actual_crm_lead', autoVal: todayAutoValues.autoCrmLeads, label: 'CRM Leads Logged', icon: 'person_search' },
            { key: 'crm_car_post', actualKey: 'actual_crm_car_post', autoVal: 0, label: 'CRM Car Posts', icon: 'directions_car' },
            { key: 'olx_car_post', actualKey: 'actual_olx_car_post', autoVal: 0, label: 'OLX Car Posts', icon: 'upload' },
            { key: 'fb_marketplace', actualKey: 'actual_fb_marketplace', autoVal: 0, label: 'FB Marketplace Posts', icon: 'storefront' },
            { key: 'reel_creation', actualKey: 'actual_reel_creation', autoVal: 0, label: 'Reels Created', icon: 'video_library' },
            { key: 'visits', actualKey: 'actual_visits', autoVal: todayAutoValues.autoVisits, label: 'Dealer Visits Made', icon: 'explore' },
            { key: 'add_new_dealer_list', actualKey: 'actual_add_new_dealer_list', autoVal: 0, label: 'Dealer Lists Added', icon: 'contact_page' },
            { key: 'add_new_club_member', actualKey: 'actual_add_new_club_member', autoVal: todayAutoValues.autoClubMembers, label: 'Club Members Recruited', icon: 'badge' },
        ] as const;

        return items.filter(item => (todayLogs.commitment![item.key] as number) > 0);
    }, [todayLogs.commitment, todayAutoValues]);

    return (
        <div className="space-y-6">
            {/* Celebration modal */}
            {celebratedField && <MilestoneCelebration />}

            {/* Compliance Nudge Banner */}
            {complianceAlert && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-800 text-xs font-semibold shadow-sm animate-pulse">
                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>{complianceAlert.message}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display flex items-center gap-2">
                        Staff Accountability Command
                        {selectedStaffId !== 'all' && activeUserStreak > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-black text-orange-600 bg-orange-50 rounded-full animate-pulse-glow relative overflow-hidden">
                                <Flame size={14} className="fill-orange-500 text-orange-500 animate-bounce" />
                                {activeUserStreak}-Day Streak!
                            </span>
                        )}
                    </h1>
                    <p className="text-slate-500 text-sm">Align morning commitments with evening performance reporting and transparency.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-white border border-slate-200 rounded-xl px-2 py-1 flex items-center shadow-sm">
                        {(['today', 'yesterday', 'week', 'month', 'custom'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                                    period === p ? 'bg-primary text-white' : 'text-slate-500 hover:text-primary hover:bg-slate-50'
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    {isAdmin && (
                        <div className="relative">
                            <select
                                value={selectedStaffId}
                                onChange={e => setSelectedStaffId(e.target.value)}
                                className="h-10 bg-white border border-slate-200 rounded-xl px-4 pr-10 text-xs font-bold text-slate-600 outline-none appearance-none cursor-pointer shadow-sm"
                            >
                                <option value="all">👥 All Staff Members</option>
                                {staffList.map(s => (
                                    <option key={s.id} value={s.id}>
                                        👤 {s.full_name} ({s.role})
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Date Filters */}
            {period === 'custom' && (
                <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-wrap gap-4 items-center shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">From:</span>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary/10"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">To:</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary/10"
                        />
                    </div>
                </div>
            )}

            {/* Trend Graphs and Consistency Calendar */}
            {selectedStaffId !== 'all' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Consistency Calendar Widget */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4 lg:col-span-1">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                                    <Calendar size={15} className="text-primary" />
                                    Weekly consistency
                                </h3>
                                <p className="text-[10px] text-slate-400">Goals met over the last 7 days.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 lg:grid-cols-4 gap-2">
                            {weeklyConsistency.map(day => {
                                const statusStyles = {
                                    green: 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100/50',
                                    amber: 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100/50',
                                    red: 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100/50',
                                    gray: 'bg-slate-50 text-slate-400 border-slate-200'
                                };

                                const statusIcons = {
                                    green: <CheckCircle2 size={14} />,
                                    amber: <TrendingUp size={14} />,
                                    red: <AlertCircle size={14} />,
                                    gray: <HelpCircle size={14} />
                                };

                                return (
                                    <div 
                                        key={day.dateStr} 
                                        className={`border rounded-xl p-2.5 flex flex-col items-center justify-center text-center space-y-1 transition-all cursor-default relative group ${statusStyles[day.status]}`}
                                        title={day.details}
                                    >
                                        <span className="text-[9px] font-bold uppercase tracking-wider">{day.name}</span>
                                        <div className="shrink-0 flex items-center gap-0.5">
                                            {statusIcons[day.status]}
                                            {day.isVerified && <Lock size={9} className="text-indigo-600" />}
                                        </div>
                                        <span className="text-[10px] font-black">{day.dateFormatted.split(' ')[0]}</span>

                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white text-[10px] p-2.5 rounded-lg shadow-xl font-medium hidden group-hover:block z-20 pointer-events-none transition-all leading-normal">
                                            <p className="font-bold border-b border-white/10 pb-1 mb-1">{day.dateFormatted}</p>
                                            <p>{day.details}</p>
                                            {day.isVerified && <p className="text-indigo-300 font-bold mt-1">🔒 verified & locked</p>}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Trend Chart (SVG line chart) */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm lg:col-span-2">
                        <TrendGraph />
                    </div>
                </div>
            )}

            {/* User Log Operations (Non-admin actions or for own logged-in profile) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Commitment block */}
                <div className="bg-gradient-to-br from-indigo-50/50 to-blue-50/50 border border-blue-100/70 rounded-2xl p-5 flex items-center justify-between shadow-sm">
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Morning Commitments</p>
                        <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                            {todayLogs.commitment ? '✅ Logged for Today' : '⏳ Pending Commitment'}
                            {todayLogs.commitment?.is_verified && <Lock size={14} className="text-indigo-600" />}
                        </p>
                        <p className="text-xs text-slate-500">Log calls, deals, and marketing targets for today.</p>
                    </div>
                    <button
                        onClick={openCommitmentCreate}
                        disabled={todayLogs.commitment?.is_verified}
                        className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                        {todayLogs.commitment ? <Edit3 size={14} /> : <Plus size={14} />}
                        {todayLogs.commitment ? 'Edit Targets' : 'Log Targets'}
                    </button>
                </div>

                {/* Report block */}
                <div className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 border border-orange-100/70 rounded-2xl p-5 flex items-center justify-between shadow-sm">
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Evening Sales Report</p>
                        <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                            {todayLogs.report ? '✅ Logged for Today' : '⏳ Pending 6:00 PM Report'}
                            {todayLogs.report?.is_verified && <Lock size={14} className="text-indigo-600" />}
                        </p>
                        <p className="text-xs text-slate-500">Record calling achievements, hot leads, and successful closures.</p>
                    </div>
                    <button
                        onClick={openReportCreate}
                        disabled={todayLogs.report?.is_verified}
                        className="h-10 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                        {todayLogs.report ? <Edit3 size={14} /> : <Plus size={14} />}
                        {todayLogs.report ? 'Edit Report' : 'Log Sales Report'}
                    </button>
                </div>
            </div>

            {/* LIVE COMMITMENTS PROGRESS TRACKER (Manual inputs + CRM Auto-sync bounds) */}
            {todayLogs.commitment && (
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-0.5">
                            <h3 className="text-base font-black text-primary font-display flex items-center gap-2">
                                <Target className="text-indigo-600 animate-pulse" size={18} />
                                Today's Commitment Progress Tracker (Manual & Sync)
                                {todayLogs.commitment?.is_verified && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full uppercase tracking-wider animate-pulse">
                                        <Lock size={10} /> Audited & Locked
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-slate-400">Increment completed tasks. Tapping + will start from the highest of manual/auto-synced CRM values.</p>
                        </div>
                        
                        {/* Auto-Sync CRM Button */}
                        <button
                            onClick={handleSyncCRM}
                            disabled={syncing || todayLogs.commitment?.is_verified}
                            className="h-9 px-4 border border-indigo-100 hover:border-indigo-200 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95 disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                            {syncing ? 'Syncing...' : 'Sync CRM Actuals'}
                        </button>
                    </div>

                    {activeTrackerFields.length === 0 ? (
                        <div className="text-center p-8 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 text-xs">
                            No committed targets were set above zero for today.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                            {activeTrackerFields.map(field => {
                                const target = todayLogs.commitment![field.key] as number;
                                const manualActual = todayLogs.commitment![field.actualKey] as number;
                                const actual = Math.max(manualActual, field.autoVal);
                                const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
                                const isSynced = field.autoVal > 0 && field.autoVal >= manualActual;
                                
                                return (
                                    <div key={field.key} className="bg-slate-50/50 border border-slate-100/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0 space-y-1.5 w-full">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 truncate">
                                                    <span className="material-symbols-outlined text-sm text-indigo-500 shrink-0">{field.icon}</span>
                                                    {field.label}
                                                </span>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {isSynced && (
                                                        <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                                            ⚡ Synced: {field.autoVal}
                                                        </span>
                                                    )}
                                                    <span className="text-xs font-black text-primary">
                                                        {actual} <span className="text-slate-400 font-bold">/ {target}</span>
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {/* Progress bar */}
                                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden relative">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                        pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-indigo-500' : 'bg-slate-400'
                                                    }`}
                                                    style={{ width: `${Math.min(100, pct)}%` }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className={`text-[10px] font-bold flex items-center gap-0.5 ${pct >= 100 ? 'text-green-600' : 'text-slate-400'}`}>
                                                    {pct >= 100 && <Check size={10} className="stroke-[3px]" />}
                                                    {pct}% Complete
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action buttons (Tappable Pill Containers) */}
                                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shrink-0 h-11 shadow-sm w-fit self-end sm:self-auto">
                                            {todayLogs.commitment?.is_verified ? (
                                                <div className="px-3 flex items-center gap-1 text-[10px] font-black text-indigo-600 select-none">
                                                    <Lock size={12} /> LOCKED
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleIncrementActual(field.actualKey, -1, target, field.autoVal)}
                                                        className="size-9 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors active:scale-90"
                                                        title="Decrement"
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <div className="w-8 text-center text-xs font-bold text-primary">
                                                        {actual}
                                                    </div>
                                                    <button
                                                        onClick={() => handleIncrementActual(field.actualKey, 1, target, field.autoVal)}
                                                        className="size-9 rounded-lg hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors active:scale-90"
                                                        title="Increment"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Core Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-2">
                    <div className="size-9 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                        <Phone size={18} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Calling Progress</p>
                        <p className="text-2xl font-black text-primary font-display mt-0.5">
                            {stats.actualCalls} <span className="text-xs font-bold text-slate-400">/ {stats.targetCalls}</span>
                        </p>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                            className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, stats.callCompletion)}%` }} 
                        />
                    </div>
                    <p className="text-[10px] font-bold text-blue-600">{stats.callCompletion}% Completion</p>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-2">
                    <div className="size-9 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                        <CheckCircle size={18} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Deals Closed</p>
                        <p className="text-2xl font-black text-primary font-display mt-0.5">
                            {stats.actualDeals} <span className="text-xs font-bold text-slate-400">/ {stats.targetDeals}</span>
                        </p>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                            className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, stats.dealCompletion)}%` }} 
                        />
                    </div>
                    <p className="text-[10px] font-bold text-emerald-600">{stats.dealCompletion}% Success Rate</p>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-2">
                    <div className="size-9 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                        <Calendar size={18} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Follow-Ups Done</p>
                        <p className="text-2xl font-black text-primary font-display mt-0.5">{stats.actualFollowUps}</p>
                    </div>
                    <p className="text-[10px] font-bold text-purple-600">Period Total</p>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-2">
                    <div className="size-9 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
                        <Users size={18} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Walk-Ins (Walking)</p>
                        <p className="text-2xl font-black text-primary font-display mt-0.5">{stats.actualWalkins}</p>
                    </div>
                    <p className="text-[10px] font-bold text-orange-600">Period Total</p>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-2">
                    <div className="size-9 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                        <TrendingUp size={18} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Hot Lead Pipeline</p>
                        <p className="text-2xl font-black text-primary font-display mt-0.5">{stats.actualHots}</p>
                    </div>
                    <p className="text-[10px] font-bold text-red-600">Period Total</p>
                </div>
            </div>

            {/* Other morning commitments targets summary */}
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Target size={16} className="text-indigo-600" />
                    Other Activity Goals Accumulated (Actual / Target)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'CRM Leads Logged', act: stats.actualCrmLeads, tgt: stats.targetCrmLeads, icon: 'person_search' },
                        { label: 'CRM Car Posts', act: stats.actualCrmPosts, tgt: stats.targetCrmPosts, icon: 'directions_car' },
                        { label: 'OLX Posts', act: stats.actualOlxPosts, tgt: stats.targetOlxPosts, icon: 'upload' },
                        { label: 'FB Marketplace', act: stats.actualFbPosts, tgt: stats.targetFbPosts, icon: 'storefront' },
                        { label: 'Reel Creation', act: stats.actualReels, tgt: stats.targetReels, icon: 'video_library' },
                        { label: 'Dealer Visits', act: stats.actualVisits, tgt: stats.targetVisits, icon: 'explore' },
                        { label: 'New Dealers Added', act: stats.actualDealers, tgt: stats.targetDealers, icon: 'handshake' },
                        { label: 'New Club Members', act: stats.actualClubMembers, tgt: stats.targetClubMembers, icon: 'badge' },
                    ].map(item => (
                        <div key={item.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-sm">{item.icon}</span>
                            </div>
                            <div>
                                <p className="text-base font-bold text-primary leading-tight">
                                    {item.act} <span className="text-xs text-slate-400 font-bold">/ {item.tgt}</span>
                                </p>
                                <p className="text-[10px] text-slate-400 font-semibold">{item.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Admin Grid View of Staff Scorecards */}
            {isAdmin && selectedStaffId === 'all' && (
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100">
                        <div>
                            <h2 className="font-bold text-primary font-display text-lg">Staff Accountability Leaderboard</h2>
                            <p className="text-xs text-slate-400">Comparing relative target vs actual metrics for all active staff profiles.</p>
                        </div>
                        
                        {/* Leaderboard control actions */}
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Role Filter tabs */}
                            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                                {(['all', 'sales', 'staff'] as const).map(role => (
                                    <button
                                        key={role}
                                        onClick={() => setLeaderboardRole(role)}
                                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                                            leaderboardRole === role ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-primary'
                                        }`}
                                    >
                                        {role === 'all' ? 'All Roles' : role}
                                    </button>
                                ))}
                            </div>

                            {/* Search bar */}
                            <div className="relative">
                                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search staff name..."
                                    value={leaderboardSearch}
                                    onChange={e => setLeaderboardSearch(e.target.value)}
                                    className="h-8 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 text-xs font-medium text-slate-700 outline-none w-44 focus:bg-white focus:ring-2 focus:ring-primary/10"
                                />
                            </div>

                            {/* Clipboard Markdown exporter */}
                            <button
                                onClick={handleExportLeaderboard}
                                className="h-8 px-3 border border-indigo-100 hover:border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-600 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95"
                            >
                                <Share2 size={12} />
                                Share
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[750px]">
                            <thead>
                                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                                    <th className="text-left px-6 py-3 cursor-pointer select-none">Staff Profile</th>
                                    <th className="text-center px-6 py-3">Logged (Commits/Reps)</th>
                                    <th 
                                        onClick={() => {
                                            setSortBy('deals');
                                            setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
                                        }}
                                        className="text-center px-6 py-3 cursor-pointer hover:bg-slate-100/50 select-none"
                                    >
                                        Deals {sortBy === 'deals' && (sortDirection === 'desc' ? '▼' : '▲')}
                                    </th>
                                    <th 
                                        onClick={() => {
                                            setSortBy('calls');
                                            setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
                                        }}
                                        className="text-center px-6 py-3 cursor-pointer hover:bg-slate-100/50 select-none"
                                    >
                                        Calls {sortBy === 'calls' && (sortDirection === 'desc' ? '▼' : '▲')}
                                    </th>
                                    <th 
                                        onClick={() => {
                                            setSortBy('followups');
                                            setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
                                        }}
                                        className="text-center px-6 py-3 cursor-pointer hover:bg-slate-100/50 select-none"
                                    >
                                        Follow-Ups {sortBy === 'followups' && (sortDirection === 'desc' ? '▼' : '▲')}
                                    </th>
                                    <th 
                                        onClick={() => {
                                            setSortBy('overall');
                                            setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
                                        }}
                                        className="text-right px-6 py-3 cursor-pointer hover:bg-slate-100/50 select-none"
                                    >
                                        Commitment Met % {sortBy === 'overall' && (sortDirection === 'desc' ? '▼' : '▲')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredLeaderboard.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center p-8 text-slate-400">No staff members found matching filters.</td>
                                    </tr>
                                ) : filteredLeaderboard.map(s => (
                                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="size-8 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white text-[11px] font-bold">
                                                    {(s.full_name || 'S').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-primary">{s.full_name || 'Unnamed'}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">{s.role}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-xs font-semibold text-slate-600">
                                            {s.commCount} Commitments / {s.repCount} Reports
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-sm font-bold text-emerald-600">{s.actualDeals}</span>
                                            <span className="text-xs text-slate-400"> / {s.targetDeals}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-sm font-bold text-blue-600">{s.actualCalls}</span>
                                            <span className="text-xs text-slate-400"> / {s.targetCalls}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm font-semibold text-slate-700">
                                            {s.followUps}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="inline-flex items-center gap-2">
                                                <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full ${
                                                            s.overallPct >= 90 ? 'bg-green-500' : s.overallPct >= 70 ? 'bg-amber-400' : 'bg-red-500'
                                                        }`}
                                                        style={{ width: `${Math.min(100, s.overallPct)}%` }}
                                                    />
                                                </div>
                                                <span className={`text-xs font-black ${
                                                    s.overallPct >= 90 ? 'text-green-600' : s.overallPct >= 70 ? 'text-amber-500' : 'text-red-500'
                                                }`}>
                                                    {s.overallPct}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Daily logs history */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 pb-3 border-b border-slate-100">
                    <h2 className="font-bold text-primary font-display text-lg">Daily Performance Logs History</h2>
                    <p className="text-xs text-slate-400">Scroll through historical dates to verify metrics and apply audits.</p>
                </div>
                <div className="divide-y divide-slate-100">
                    {dailyHistoryLog.length === 0 ? (
                        <div className="text-center p-12 text-slate-400 flex flex-col items-center gap-2">
                            <span className="material-symbols-outlined text-4xl">calendar_today</span>
                            <p className="text-sm font-bold">No history available for the selected range.</p>
                        </div>
                    ) : dailyHistoryLog.map(day => {
                        const dateFormatted = new Date(day.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            weekday: 'short'
                        });
                        
                        return (
                            <div key={day.date} className="p-5 hover:bg-slate-50/30 transition-colors space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2">
                                    <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider w-fit">
                                        {dateFormatted}
                                    </span>
                                </div>

                                <div className="space-y-6">
                                    {day.logs.map(log => {
                                        const dateAutos = getAutoSyncedValues(log.staffId, day.date);
                                        const isVerified = log.commitment?.is_verified || log.report?.is_verified || false;
                                        
                                        return (
                                            <div key={log.staffId} className="border border-slate-100 rounded-2xl p-4 bg-white shadow-xs space-y-3">
                                                {/* Staff Info Line */}
                                                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-6 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-[10px] font-black text-white uppercase">
                                                            {log.staffName.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-bold text-primary">{log.staffName}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Admin Verification lock toggle */}
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => handleToggleVerification(day.date, log.staffId, isVerified)}
                                                            disabled={verifyingId === `${log.staffId}-${day.date}`}
                                                            className={`h-7 px-3 border rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${
                                                                isVerified 
                                                                    ? 'border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100/50' 
                                                                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                                            }`}
                                                        >
                                                            {isVerified ? <Lock size={10} /> : <Unlock size={10} />}
                                                            {verifyingId === `${log.staffId}-${day.date}` 
                                                                ? 'Updating...' 
                                                                : isVerified 
                                                                    ? 'Locked & Verified' 
                                                                    : 'Verify & Lock Logs'
                                                            }
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {/* Commitment detail card */}
                                                    <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                                                                <Target size={12} /> Target Commitment vs Actuals
                                                            </span>
                                                            {log.commitment ? (
                                                                <span className="text-[10px] text-slate-400 font-semibold">
                                                                    Logged {new Date(log.commitment.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-red-500 font-bold">⏳ Missed Morning Commit</span>
                                                            )}
                                                        </div>
                                                        {log.commitment ? (
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600">
                                                                <div className="flex justify-between border-b border-slate-100/50 pb-1">
                                                                    <span>Deals Closed:</span>
                                                                    <span className="font-bold text-primary">
                                                                        {Math.max(log.commitment.actual_deal, dateAutos.autoDeals)} / {log.commitment.deal}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-slate-100/50 pb-1">
                                                                    <span>Calls Target:</span>
                                                                    <span className="font-bold text-primary">
                                                                        {log.commitment.actual_calls} / {log.commitment.calls}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-slate-100/50 pb-1">
                                                                    <span>CRM Leads:</span>
                                                                    <span className="font-bold text-primary">
                                                                        {Math.max(log.commitment.actual_crm_lead, dateAutos.autoCrmLeads)} / {log.commitment.crm_lead}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-slate-100/50 pb-1">
                                                                    <span>CRM Car Posts:</span>
                                                                    <span className="font-bold text-primary">
                                                                        {log.commitment.actual_crm_car_post} / {log.commitment.crm_car_post}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-slate-100/50 pb-1">
                                                                    <span>OLX Posts:</span>
                                                                    <span className="font-bold text-primary">
                                                                        {log.commitment.actual_olx_car_post} / {log.commitment.olx_car_post}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-slate-100/50 pb-1">
                                                                    <span>FB Marketplace:</span>
                                                                    <span className="font-bold text-primary">
                                                                        {log.commitment.actual_fb_marketplace} / {log.commitment.fb_marketplace}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-slate-100/50 pb-1">
                                                                    <span>Reels Created:</span>
                                                                    <span className="font-bold text-primary">
                                                                        {log.commitment.actual_reel_creation} / {log.commitment.reel_creation}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-slate-100/50 pb-1">
                                                                    <span>Visits Planning:</span>
                                                                    <span className="font-bold text-primary">
                                                                        {Math.max(log.commitment.actual_visits, dateAutos.autoVisits)} / {log.commitment.visits}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-slate-400 italic">No targets were set for this day.</p>
                                                        )}
                                                    </div>

                                                    {/* Report detail card */}
                                                    <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold text-orange-700 uppercase tracking-wider flex items-center gap-1">
                                                                <BarChart2 size={12} /> Daily Performance Actuals
                                                            </span>
                                                            {log.report ? (
                                                                <span className="text-[10px] text-slate-400 font-semibold">
                                                                    Logged {new Date(log.report.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-amber-500 font-bold">⏳ Missed Sales Report</span>
                                                            )}
                                                        </div>
                                                        {log.report ? (
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600">
                                                                <div className="flex justify-between border-b border-slate-100/50 pb-1">
                                                                    <span>Calling Done:</span>
                                                                    <span className="font-bold text-primary">
                                                                        {log.report.calling}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-slate-100/50 pb-1">
                                                                    <span>Deals Closed:</span>
                                                                    <span className="font-bold text-emerald-600">
                                                                        {log.report.total_success}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-slate-100/50 pb-1">
                                                                    <span>Follow-Ups:</span>
                                                                    <span className="font-bold text-primary">{log.report.follow_up}</span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-slate-100/50 pb-1">
                                                                    <span>Walk-ins (Walking):</span>
                                                                    <span className="font-bold text-primary">{log.report.walking}</span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-slate-100/50 pb-1">
                                                                    <span>Hot Leads Met:</span>
                                                                    <span className="font-bold text-red-600">{log.report.hot}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-slate-400 italic">No report was logged for this day.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ══════════════════════════════════════════════
                ── Log Commitment Modal ──
            ══════════════════════════════════════════════ */}
            {showCommitmentModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
                                        <Target size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-white">Set Daily Commitments</h2>
                                        <p className="text-white/60 text-xs">Morning work commitments checklist.</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowCommitmentModal(false)}
                                    className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleCommitmentSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Deals Commitment</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={commitmentForm.deal}
                                        onChange={e => setCommitmentForm({ ...commitmentForm, deal: parseInt(e.target.value) || 0 })}
                                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Calls Target</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={commitmentForm.calls}
                                        onChange={e => setCommitmentForm({ ...commitmentForm, calls: parseInt(e.target.value) || 0 })}
                                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">CRM Lead Target</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={commitmentForm.crm_lead}
                                        onChange={e => setCommitmentForm({ ...commitmentForm, crm_lead: parseInt(e.target.value) || 0 })}
                                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">CRM Car Posts</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={commitmentForm.crm_car_post}
                                        onChange={e => setCommitmentForm({ ...commitmentForm, crm_car_post: parseInt(e.target.value) || 0 })}
                                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">OLX Car Posts</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={commitmentForm.olx_car_post}
                                        onChange={e => setCommitmentForm({ ...commitmentForm, olx_car_post: parseInt(e.target.value) || 0 })}
                                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">FB Marketplace Posts</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={commitmentForm.fb_marketplace}
                                        onChange={e => setCommitmentForm({ ...commitmentForm, fb_marketplace: parseInt(e.target.value) || 0 })}
                                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Reels Creation</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={commitmentForm.reel_creation}
                                        onChange={e => setCommitmentForm({ ...commitmentForm, reel_creation: parseInt(e.target.value) || 0 })}
                                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Visits Target</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={commitmentForm.visits}
                                        onChange={e => setCommitmentForm({ ...commitmentForm, visits: parseInt(e.target.value) || 0 })}
                                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Add Dealer List</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={commitmentForm.add_new_dealer_list}
                                        onChange={e => setCommitmentForm({ ...commitmentForm, add_new_dealer_list: parseInt(e.target.value) || 0 })}
                                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Add Club Member</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={commitmentForm.add_new_club_member}
                                        onChange={e => setCommitmentForm({ ...commitmentForm, add_new_club_member: parseInt(e.target.value) || 0 })}
                                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                    />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => setShowCommitmentModal(false)}
                                    className="h-10 px-4 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={submitting}
                                    className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                                >
                                    {submitting ? 'Saving Commitments...' : 'Confirm Targets'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                ── Log Daily Sales Report Modal ──
            ══════════════════════════════════════════════ */}
            {showReportModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 pt-5 pb-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
                                        <BarChart2 size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-white">Log Daily Sales Report</h2>
                                        <p className="text-white/60 text-xs">Record actuals and closures achieved today.</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowReportModal(false)}
                                    className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleReportSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Calling (Total Calls Made)</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={reportForm.calling}
                                        onChange={e => setReportForm({ ...reportForm, calling: parseInt(e.target.value) || 0 })}
                                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:ring-2 focus:ring-orange-500/20" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Follow Up Completed</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={reportForm.follow_up}
                                        onChange={e => setReportForm({ ...reportForm, follow_up: parseInt(e.target.value) || 0 })}
                                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:ring-2 focus:ring-orange-500/20" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Walking (Walk-ins Met)</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={reportForm.walking}
                                        onChange={e => setReportForm({ ...reportForm, walking: parseInt(e.target.value) || 0 })}
                                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:ring-2 focus:ring-orange-500/20" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Hot (Hot Leads Worked)</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={reportForm.hot}
                                        onChange={e => setReportForm({ ...reportForm, hot: parseInt(e.target.value) || 0 })}
                                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:ring-2 focus:ring-orange-500/20" 
                                    />
                                </div>
                                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                                    <label className="block text-xs font-bold text-emerald-800 mb-1">Total Success (Deals Closed/Won Today)</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={reportForm.total_success}
                                        onChange={e => setReportForm({ ...reportForm, total_success: parseInt(e.target.value) || 0 })}
                                        className="w-full h-10 bg-white border border-emerald-200 rounded-xl px-3 text-sm text-primary font-bold outline-none focus:ring-2 focus:ring-emerald-500/20" 
                                    />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => setShowReportModal(false)}
                                    className="h-10 px-4 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={submitting}
                                    className="h-10 px-5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                                >
                                    {submitting ? 'Saving Report...' : 'Log Daily Report'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffAccountabilityDashboard;
