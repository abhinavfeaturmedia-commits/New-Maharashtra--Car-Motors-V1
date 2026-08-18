import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useAttendance } from '../../contexts/AttendanceContext';
import { 
    Clock, 
    Calendar as CalendarIcon, 
    CheckCircle2, 
    XCircle, 
    Coffee, 
    LogOut as LogOutIcon, 
    RefreshCw, 
    Plus, 
    Download, 
    Edit3, 
    Search, 
    AlertCircle, 
    Sparkles, 
    FileText, 
    Check, 
    X,
    TrendingUp,
    BarChart3
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffProfile { 
    id: string; 
    full_name: string | null; 
    email: string | null; 
    role: string; 
    department: string | null; 
    avatar_url: string | null;
}

interface AttendanceRecord {
    id: string; 
    user_id: string; 
    date: string;
    clock_in: string | null; 
    clock_out: string | null;
    status: 'present' | 'absent' | 'half_day' | 'late' | 'on_leave' | 'holiday' | 'weekend'; 
    total_hours_worked: number; 
    total_session_minutes: number;
    break_minutes: number; 
    overtime_minutes: number;
    is_late: boolean; 
    is_early_departure: boolean; 
    admin_note: string | null;
}

interface LeaveRequest {
    id: string; 
    user_id: string; 
    leave_type: 'casual' | 'sick' | 'earned' | 'unpaid' | 'comp_off'; 
    start_date: string; 
    end_date: string;
    days: number; 
    reason: string | null; 
    status: 'pending' | 'approved' | 'rejected' | 'cancelled'; 
    reviewed_by: string | null;
    admin_note: string | null; 
    created_at: string;
    profiles?: { full_name: string | null };
}

interface LeaveBalance { 
    id: string; 
    user_id: string; 
    year: number; 
    casual_total: number; 
    casual_used: number; 
    sick_total: number; 
    sick_used: number; 
    earned_total: number; 
    earned_used: number; 
}

interface ShiftConfig { 
    id: string; 
    name: string; 
    department: string | null; 
    start_time: string; 
    end_time: string; 
    late_threshold: number; 
    half_day_hours: number; 
    is_default: boolean; 
}

interface Holiday { 
    id: string; 
    name: string; 
    date: string; 
    type: string; 
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; icon: string }> = {
    present:  { label: 'Present',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', icon: 'check_circle' },
    late:     { label: 'Late',     color: 'bg-orange-50 text-orange-700 border-orange-200',   dot: 'bg-orange-500',  icon: 'schedule' },
    half_day: { label: 'Half Day', color: 'bg-yellow-50 text-yellow-700 border-yellow-200',   dot: 'bg-yellow-500',  icon: 'brightness_half' },
    absent:   { label: 'Absent',   color: 'bg-red-50 text-red-700 border-red-200',            dot: 'bg-red-500',     icon: 'cancel' },
    on_leave: { label: 'On Leave', color: 'bg-blue-50 text-blue-700 border-blue-200',         dot: 'bg-blue-500',    icon: 'beach_access' },
    holiday:  { label: 'Holiday',  color: 'bg-purple-50 text-purple-700 border-purple-200',   dot: 'bg-purple-500',  icon: 'celebration' },
    weekend:  { label: 'Weekend',  color: 'bg-slate-50 text-slate-500 border-slate-200',      dot: 'bg-slate-400',   icon: 'weekend' },
};

const fmtTime = (iso: string | null | undefined) => {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
        return iso;
    }
};

const fmtMins = (m: number | null | undefined) => {
    const total = m || 0;
    const h = Math.floor(total / 60);
    const min = total % 60;
    if (h > 0) return `${h}h ${min}m`;
    return `${min}m`;
};

const todayISO = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getInitials = (name: string | null) =>
    (name ?? 'User').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'roster' | 'my-attendance' | 'reports' | 'leaves' | 'settings';

// ─── Main Component ───────────────────────────────────────────────────────────

const Attendance: React.FC = () => {
    const { user, profile, isAdmin, isOwner } = useAuth();
    const isPrivileged = isAdmin || isOwner || profile?.role === 'admin' || profile?.role === 'owner';

    const { 
        todayRecord, 
        todayBreaks, 
        isClocked, 
        isOnBreak, 
        todaySessionMinutes, 
        clockIn, 
        clockOut, 
        startBreak, 
        endBreak, 
        refreshToday,
        shift 
    } = useAttendance();

    const [tab, setTab] = useState<Tab>(isPrivileged ? 'roster' : 'my-attendance');
    const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
    const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
    const [todaySessions, setTodaySessions] = useState<any[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [myBalance, setMyBalance] = useState<LeaveBalance | null>(null);
    const [shifts, setShifts] = useState<ShiftConfig[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [rosterSearch, setRosterSearch] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Report filters
    const [rptStaff, setRptStaff] = useState('all');
    const [rptFrom, setRptFrom] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [rptTo, setRptTo] = useState(todayISO());

    // Calendar (My Attendance)
    const [calMonth, setCalMonth] = useState(new Date().getMonth());
    const [calYear, setCalYear] = useState(new Date().getFullYear());
    const [myRecords, setMyRecords] = useState<AttendanceRecord[]>([]);

    // Leave application modal
    const [applyLeave, setApplyLeave] = useState(false);
    const [leaveForm, setLeaveForm] = useState({ 
        leave_type: 'casual' as LeaveRequest['leave_type'], 
        start_date: todayISO(), 
        end_date: todayISO(), 
        reason: '' 
    });
    const [leaveSaving, setLeaveSaving] = useState(false);
    const [leaveMsg, setLeaveMsg] = useState('');

    // Admin manual attendance override modal
    const [overrideModal, setOverrideModal] = useState<{ userId: string; name: string; date: string } | null>(null);
    const [overrideForm, setOverrideForm] = useState({ 
        status: 'present', 
        clock_in: '09:30', 
        clock_out: '18:30', 
        note: '' 
    });
    const [overrideSaving, setOverrideSaving] = useState(false);

    // Shift modal
    const [editShift, setEditShift] = useState<ShiftConfig | null>(null);
    const [shiftForm, setShiftForm] = useState({ 
        name: '', 
        start_time: '09:30', 
        end_time: '18:30', 
        late_threshold: 15, 
        half_day_hours: 4.5, 
        department: '',
        is_default: false 
    });
    const [shiftSaving, setShiftSaving] = useState(false);

    // Holiday modal
    const [holidayForm, setHolidayForm] = useState({ name: '', date: todayISO(), type: 'public' });
    const [holidaySaving, setHolidaySaving] = useState(false);

    // ─── Data Fetching ────────────────────────────────────────────────────────

    const fetchAll = useCallback(async () => {
        setLoadingData(true);
        try {
            const [profilesRes, shiftsRes, holidaysRes] = await Promise.all([
                supabase.from('profiles').select('id, full_name, email, role, department, avatar_url').in('role', ['admin', 'staff', 'owner']).order('full_name'),
                supabase.from('shift_config').select('*').order('is_default', { ascending: false }),
                supabase.from('attendance_holidays').select('*').order('date', { ascending: true }),
            ]);

            if (profilesRes.data) setStaffProfiles(profilesRes.data as StaffProfile[]);
            if (shiftsRes.data) setShifts(shiftsRes.data as ShiftConfig[]);
            if (holidaysRes.data) setHolidays(holidaysRes.data as Holiday[]);
        } catch (err) {
            console.error('Error in fetchAll:', err);
        } finally {
            setLoadingData(false);
        }
    }, []);

    const fetchTodayRoster = useCallback(async () => {
        const today = todayISO();
        try {
            const [recordsRes, sessionsRes] = await Promise.all([
                supabase.from('attendance_records').select('*').eq('date', today),
                supabase.from('attendance_sessions').select('*').eq('date', today).eq('is_active', true)
            ]);

            if (recordsRes.data) setAllRecords(recordsRes.data as AttendanceRecord[]);
            if (sessionsRes.data) setTodaySessions(sessionsRes.data);
        } catch (err) {
            console.error('Error fetching today roster:', err);
        }
    }, []);

    const fetchMyRecords = useCallback(async () => {
        if (!user) return;
        try {
            const from = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
            const to = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            const { data } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', from)
                .lte('date', to)
                .order('date', { ascending: true });

            if (data) setMyRecords(data as AttendanceRecord[]);
        } catch (err) {
            console.error('Error fetching my records:', err);
        }
    }, [user, calMonth, calYear]);

    const fetchLeaves = useCallback(async () => {
        try {
            let q = supabase
                .from('leave_requests')
                .select('*, profiles(full_name)')
                .order('created_at', { ascending: false });

            if (!isPrivileged && user) {
                q = q.eq('user_id', user.id);
            }

            const { data } = await q;
            if (data) setLeaveRequests(data as LeaveRequest[]);

            if (user) {
                const year = new Date().getFullYear();
                const { data: bal } = await supabase
                    .from('leave_balances')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('year', year)
                    .maybeSingle();

                if (bal) {
                    setMyBalance(bal as LeaveBalance);
                } else {
                    // Create default balance if none exists
                    const newBal = {
                        user_id: user.id,
                        year,
                        casual_total: 12,
                        casual_used: 0,
                        sick_total: 12,
                        sick_used: 0,
                        earned_total: 15,
                        earned_used: 0,
                    };
                    const { data: createdBal } = await supabase
                        .from('leave_balances')
                        .insert(newBal)
                        .select()
                        .maybeSingle();
                    if (createdBal) setMyBalance(createdBal as LeaveBalance);
                }
            }
        } catch (err) {
            console.error('Error fetching leaves:', err);
        }
    }, [user, isPrivileged]);

    const fetchReports = useCallback(async () => {
        try {
            let q = supabase
                .from('attendance_records')
                .select('*')
                .gte('date', rptFrom)
                .lte('date', rptTo)
                .order('date', { ascending: false });

            if (rptStaff !== 'all') {
                q = q.eq('user_id', rptStaff);
            }

            const { data } = await q;
            if (data) setAllRecords(data as AttendanceRecord[]);
        } catch (err) {
            console.error('Error fetching reports:', err);
        }
    }, [rptFrom, rptTo, rptStaff]);

    useEffect(() => { 
        fetchAll(); 
    }, [fetchAll]);

    useEffect(() => {
        if (tab === 'roster') {
            fetchTodayRoster();
            const id = setInterval(fetchTodayRoster, 20000);
            return () => clearInterval(id);
        }
    }, [tab, fetchTodayRoster]);

    useEffect(() => { 
        if (tab === 'my-attendance') fetchMyRecords(); 
    }, [tab, calMonth, calYear, fetchMyRecords]);

    useEffect(() => { 
        if (tab === 'leaves') fetchLeaves(); 
    }, [tab, fetchLeaves]);

    useEffect(() => { 
        if (tab === 'reports') fetchReports(); 
    }, [tab, rptFrom, rptTo, rptStaff, fetchReports]);

    // ─── Quick Admin Actions on Roster ────────────────────────────────────────

    const handleQuickMark = async (userId: string, targetStatus: AttendanceRecord['status']) => {
        setActionLoading(true);
        const today = todayISO();
        const now = new Date();

        try {
            const isPresent = targetStatus === 'present' || targetStatus === 'late';
            const defaultClockIn = isPresent ? `${today}T09:30:00+05:30` : null;
            const defaultClockOut = targetStatus === 'half_day' ? `${today}T14:00:00+05:30` : null;
            const totalHours = targetStatus === 'half_day' ? 4.5 : isPresent ? 9 : 0;

            await supabase
                .from('attendance_records')
                .upsert({
                    user_id: userId,
                    date: today,
                    status: targetStatus,
                    clock_in: defaultClockIn,
                    clock_out: defaultClockOut,
                    total_hours_worked: totalHours,
                    admin_note: `Marked ${targetStatus} by admin`,
                    override_by: user?.id,
                    override_at: now.toISOString(),
                    updated_at: now.toISOString()
                }, { onConflict: 'user_id,date' });

            await fetchTodayRoster();
        } catch (err) {
            console.error('Error marking attendance:', err);
        } finally {
            setActionLoading(false);
        }
    };

    // ─── Leave Application ────────────────────────────────────────────────────

    const submitLeave = async () => {
        if (!user) return;
        setLeaveSaving(true); 
        setLeaveMsg('');

        try {
            const start = new Date(leaveForm.start_date);
            const end = new Date(leaveForm.end_date);
            const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

            const { error } = await supabase.from('leave_requests').insert({
                user_id: user.id,
                leave_type: leaveForm.leave_type,
                start_date: leaveForm.start_date,
                end_date: leaveForm.end_date,
                days,
                reason: leaveForm.reason || null,
                status: 'pending',
                created_at: new Date().toISOString()
            });

            if (error) throw error;

            setLeaveMsg('Leave request submitted successfully!');
            setApplyLeave(false);
            setLeaveForm({ leave_type: 'casual', start_date: todayISO(), end_date: todayISO(), reason: '' });
            fetchLeaves();
        } catch (err: any) {
            setLeaveMsg('Error: ' + (err.message || 'Failed to submit leave request'));
        } finally {
            setLeaveSaving(false);
        }
    };

    // ─── Admin Review Leave (Approve / Reject) with Direct DB Sync ────────────

    const reviewLeave = async (request: LeaveRequest, newStatus: 'approved' | 'rejected', note = '') => {
        if (!user) return;
        setActionLoading(true);

        try {
            // 1. Update leave request record
            await supabase.from('leave_requests').update({
                status: newStatus,
                reviewed_by: user.id,
                admin_note: note || (newStatus === 'approved' ? 'Approved by admin' : 'Rejected'),
                updated_at: new Date().toISOString()
            }).eq('id', request.id);

            // 2. Synchronize to attendance_records
            if (newStatus === 'approved') {
                const start = new Date(request.start_date);
                const end = new Date(request.end_date);
                const cur = new Date(start);

                while (cur <= end) {
                    const dow = cur.getDay();
                    const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
                    const isHoliday = holidays.some(h => h.date === dateStr);

                    // Skip Sundays (0) and holidays
                    if (dow !== 0 && !isHoliday) {
                        await supabase.from('attendance_records').upsert({
                            user_id: request.user_id,
                            staff_id: request.user_id,
                            date: dateStr,
                            status: 'on_leave',
                            leave_request_id: request.id,
                            admin_note: `${request.leave_type.toUpperCase()} Leave: ${request.reason || 'Approved'}`
                        }, { onConflict: 'user_id,date' });
                    }
                    cur.setDate(cur.getDate() + 1);
                }

                // Deduct from leave_balances
                const year = new Date(request.start_date).getFullYear();
                const fieldUsed = request.leave_type === 'sick' ? 'sick_used' : request.leave_type === 'earned' ? 'earned_used' : 'casual_used';
                
                const { data: curBal } = await supabase
                    .from('leave_balances')
                    .select('*')
                    .eq('user_id', request.user_id)
                    .eq('year', year)
                    .maybeSingle();

                if (curBal) {
                    await supabase.from('leave_balances').update({
                        [fieldUsed]: (curBal[fieldUsed] || 0) + request.days,
                        updated_at: new Date().toISOString()
                    }).eq('id', curBal.id);
                }
            } else if (request.status === 'approved' && newStatus === 'rejected') {
                // If reversing an approved leave, remove the on_leave records
                await supabase.from('attendance_records').delete().eq('leave_request_id', request.id);
            }

            fetchLeaves();
            fetchTodayRoster();
        } catch (err) {
            console.error('Error reviewing leave:', err);
        } finally {
            setActionLoading(false);
        }
    };

    // ─── Save Manual Attendance Override ──────────────────────────────────────

    const saveOverride = async () => {
        if (!overrideModal || !user) return;
        setOverrideSaving(true);
        const today = overrideModal.date;

        try {
            const hasClockIn = Boolean(overrideForm.clock_in);
            const hasClockOut = Boolean(overrideForm.clock_out);

            const clockInISO = hasClockIn ? `${today}T${overrideForm.clock_in}:00+05:30` : null;
            const clockOutISO = hasClockOut ? `${today}T${overrideForm.clock_out}:00+05:30` : null;

            let totalHours = 0;
            if (clockInISO && clockOutISO) {
                const inMs = new Date(clockInISO).getTime();
                const outMs = new Date(clockOutISO).getTime();
                totalHours = Math.max(0, Math.round(((outMs - inMs) / 3600000) * 100) / 100);
            } else if (overrideForm.status === 'present') {
                totalHours = 9;
            } else if (overrideForm.status === 'half_day') {
                totalHours = 4.5;
            }

            await supabase.from('attendance_records').upsert({
                user_id: overrideModal.userId,
                staff_id: overrideModal.userId,
                date: today,
                status: overrideForm.status,
                clock_in: clockInISO,
                clock_out: clockOutISO,
                total_hours_worked: totalHours,
                admin_note: overrideForm.note || 'Manual override by admin',
                override_by: user.id,
                override_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,date' });

            setOverrideModal(null);
            await fetchTodayRoster();
        } catch (err) {
            console.error('Error saving override:', err);
        } finally {
            setOverrideSaving(false);
        }
    };

    // ─── Save Shift ───────────────────────────────────────────────────────────

    const saveShift = async () => {
        setShiftSaving(true);
        try {
            const payload = {
                name: shiftForm.name.trim(),
                start_time: `${shiftForm.start_time}:00`,
                end_time: `${shiftForm.end_time}:00`,
                late_threshold: Number(shiftForm.late_threshold) || 15,
                half_day_hours: Number(shiftForm.half_day_hours) || 4.5,
                department: shiftForm.department || null,
                is_default: Boolean(shiftForm.is_default),
                updated_at: new Date().toISOString()
            };

            if (editShift?.id) {
                await supabase.from('shift_config').update(payload).eq('id', editShift.id);
            } else {
                await supabase.from('shift_config').insert(payload);
            }

            setEditShift(null);
            fetchAll();
        } catch (err) {
            console.error('Error saving shift:', err);
        } finally {
            setShiftSaving(false);
        }
    };

    // ─── Add Holiday ──────────────────────────────────────────────────────────

    const addHoliday = async () => {
        if (!holidayForm.name.trim()) return;
        setHolidaySaving(true);
        try {
            await supabase.from('attendance_holidays').insert({
                name: holidayForm.name.trim(),
                date: holidayForm.date,
                type: holidayForm.type,
                created_at: new Date().toISOString()
            });
            setHolidayForm({ name: '', date: todayISO(), type: 'public' });
            fetchAll();
        } catch (err) {
            console.error('Error adding holiday:', err);
        } finally {
            setHolidaySaving(false);
        }
    };

    // ─── Filtered Roster ──────────────────────────────────────────────────────

    const filteredRoster = useMemo(() => {
        const q = rosterSearch.toLowerCase().trim();
        return staffProfiles.filter(sp => {
            if (!q) return true;
            return (
                (sp.full_name && sp.full_name.toLowerCase().includes(q)) ||
                (sp.department && sp.department.toLowerCase().includes(q)) ||
                (sp.role && sp.role.toLowerCase().includes(q))
            );
        });
    }, [staffProfiles, rosterSearch]);

    // ─── Report Summary ───────────────────────────────────────────────────────

    const reportSummary = useMemo(() => {
        const staffMap: Record<string, { name: string; department: string; present: number; late: number; absent: number; halfDay: number; leave: number; totalHrs: number; sessionMins: number; otMins: number }> = {};
        
        for (const p of staffProfiles) {
            staffMap[p.id] = { 
                name: p.full_name || 'Staff', 
                department: p.department || p.role,
                present: 0, 
                late: 0, 
                absent: 0, 
                halfDay: 0, 
                leave: 0, 
                totalHrs: 0, 
                sessionMins: 0, 
                otMins: 0 
            };
        }

        for (const r of allRecords) {
            if (!staffMap[r.user_id]) continue;
            const s = staffMap[r.user_id];
            if (r.status === 'present') s.present++;
            else if (r.status === 'late') { s.present++; s.late++; }
            else if (r.status === 'absent') s.absent++;
            else if (r.status === 'half_day') s.halfDay++;
            else if (r.status === 'on_leave') s.leave++;
            s.totalHrs += Number(r.total_hours_worked || 0);
            s.sessionMins += Number(r.total_session_minutes || 0);
            s.otMins += Number(r.overtime_minutes || 0);
        }

        return Object.entries(staffMap)
            .filter(([id]) => rptStaff === 'all' || id === rptStaff)
            .map(([id, v]) => ({ id, ...v }));
    }, [allRecords, staffProfiles, rptStaff]);

    // ─── Calendar Builder ─────────────────────────────────────────────────────

    const calendarDays = useMemo(() => {
        const firstDay = new Date(calYear, calMonth, 1).getDay();
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const cells: (null | { day: number; dateStr: string; record: AttendanceRecord | null; isToday: boolean; isWeekend: boolean; isHoliday: boolean; holidayName?: string })[] = [];
        
        for (let i = 0; i < firstDay; i++) cells.push(null);
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dow = new Date(calYear, calMonth, d).getDay();
            const record = myRecords.find(r => r.date === dateStr) || null;
            const holidayMatch = holidays.find(h => h.date === dateStr);

            cells.push({ 
                day: d, 
                dateStr, 
                record, 
                isToday: dateStr === todayISO(), 
                isWeekend: dow === 0 || dow === 6,
                isHoliday: Boolean(holidayMatch),
                holidayName: holidayMatch?.name
            });
        }
        return cells;
    }, [calYear, calMonth, myRecords, holidays]);

    // ─── Export CSV ───────────────────────────────────────────────────────────

    const exportCSV = () => {
        const headers = ['Staff Name', 'Date', 'Clock In', 'Clock Out', 'Status', 'Hours Worked', 'System (min)', 'Break (min)', 'Overtime (min)', 'Note'];
        const rows = allRecords.map(r => {
            const name = staffProfiles.find(p => p.id === r.user_id)?.full_name || r.user_id;
            return [
                `"${name}"`,
                r.date,
                fmtTime(r.clock_in),
                fmtTime(r.clock_out),
                r.status,
                r.total_hours_worked || 0,
                r.total_session_minutes || 0,
                r.break_minutes || 0,
                r.overtime_minutes || 0,
                `"${r.admin_note || ''}"`
            ];
        });
        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = `attendance_report_${rptFrom}_to_${rptTo}.csv`; 
        a.click();
        URL.revokeObjectURL(url);
    };

    // ─── Tabs List ────────────────────────────────────────────────────────────

    const tabs: { key: Tab; label: string; icon: any; adminOnly?: boolean }[] = [
        { key: 'roster',        label: "Today's Roster",  icon: Clock,          adminOnly: true },
        { key: 'my-attendance', label: 'My Attendance',   icon: CalendarIcon },
        { key: 'reports',       label: 'Reports',         icon: BarChart3,      adminOnly: true },
        { key: 'leaves',        label: 'Leaves',          icon: Coffee },
        { key: 'settings',      label: 'Settings',        icon: TrendingUp,     adminOnly: true },
    ];

    const visibleTabs = tabs.filter(t => !t.adminOnly || isPrivileged);

    return (
        <div className="space-y-6">
            {/* ── Page Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display flex items-center gap-2">
                        <span className="material-symbols-outlined text-accent text-3xl">fingerprint</span>
                        Staff Attendance & Roster
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        Track live presence, shifts, system activity, leave approvals and reports.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-xs">
                        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                </div>
            </div>

            {/* ── Personal Quick Action Banner (Always accessible on this page) ── */}
            <div className="bg-gradient-to-r from-primary via-slate-900 to-primary-light text-white rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 size-64 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`size-12 sm:size-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-md ${
                            isClocked ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/80'
                        }`}>
                            <span className="material-symbols-outlined text-2xl">
                                {isClocked ? 'badge' : 'schedule'}
                            </span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base sm:text-lg font-bold font-display">
                                    {profile?.full_name || 'Staff Member'}
                                </h3>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                    isClocked ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-white/10 text-slate-300'
                                }`}>
                                    {isClocked ? (isOnBreak ? 'On Break' : 'Clocked In') : 'Not In'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5">
                                {todayRecord?.clock_in
                                    ? `Clocked in at ${fmtTime(todayRecord.clock_in)} · Shift: ${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}`
                                    : `Standard Shift: ${shift.start_time.slice(0, 5)} to ${shift.end_time.slice(0, 5)}`}
                            </p>
                        </div>
                    </div>

                    {/* Quick Clock Actions */}
                    <div className="flex items-center gap-2.5 w-full md:w-auto">
                        {!isClocked ? (
                            <button
                                onClick={async () => {
                                    setActionLoading(true);
                                    await clockIn();
                                    await fetchTodayRoster();
                                    setActionLoading(false);
                                }}
                                disabled={actionLoading}
                                className="flex-1 md:flex-initial h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
                            >
                                <CheckCircle2 className="size-4" />
                                <span>Clock In for Today</span>
                            </button>
                        ) : (
                            <>
                                {!isOnBreak ? (
                                    <button
                                        onClick={() => startBreak('lunch')}
                                        className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <Coffee className="size-3.5 text-amber-400" />
                                        <span>Start Break</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={endBreak}
                                        className="h-10 px-4 bg-amber-500 hover:bg-amber-600 text-primary font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <span>Resume Work</span>
                                    </button>
                                )}
                                <button
                                    onClick={async () => {
                                        if (window.confirm('Clock out for today?')) {
                                            setActionLoading(true);
                                            await clockOut();
                                            await fetchTodayRoster();
                                            setActionLoading(false);
                                        }
                                    }}
                                    disabled={actionLoading}
                                    className="h-10 px-5 bg-red-500/90 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <LogOutIcon className="size-3.5" />
                                    <span>Clock Out</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Navigation Tabs ── */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                <div className="flex border-b border-slate-100 overflow-x-auto bg-slate-50/50 p-1.5 gap-1">
                    {visibleTabs.map(t => {
                        const Icon = t.icon;
                        const active = tab === t.key;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-2xl whitespace-nowrap transition-all cursor-pointer ${
                                    active
                                        ? 'bg-white text-primary shadow-xs'
                                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                                }`}
                            >
                                <Icon className={`size-4 ${active ? 'text-primary' : 'text-slate-400'}`} />
                                <span>{t.label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="p-5 sm:p-6">
                    {/* ════════════════════════════════════════════
                        TAB 1: TODAY'S ROSTER (Admin & Owners)
                    ════════════════════════════════════════════ */}
                    {tab === 'roster' && isPrivileged && (
                        <div className="space-y-5">
                            {/* Summary Metrics Strip */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                                    <p className="text-2xl font-black text-emerald-700 font-display">
                                        {allRecords.filter(r => ['present', 'late', 'half_day'].includes(r.status)).length}
                                    </p>
                                    <p className="text-xs font-bold text-emerald-600 mt-0.5">Present Today</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-orange-50 border border-orange-100">
                                    <p className="text-2xl font-black text-orange-700 font-display">
                                        {allRecords.filter(r => r.status === 'late').length}
                                    </p>
                                    <p className="text-xs font-bold text-orange-600 mt-0.5">Late Arrivals</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                                    <p className="text-2xl font-black text-blue-700 font-display">
                                        {allRecords.filter(r => r.status === 'on_leave').length}
                                    </p>
                                    <p className="text-xs font-bold text-blue-600 mt-0.5">On Leave</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-red-50 border border-red-100">
                                    <p className="text-2xl font-black text-red-700 font-display">
                                        {Math.max(0, staffProfiles.length - allRecords.filter(r => ['present', 'late', 'half_day', 'on_leave', 'holiday'].includes(r.status)).length)}
                                    </p>
                                    <p className="text-xs font-bold text-red-600 mt-0.5">Absent / Pending</p>
                                </div>
                            </div>

                            {/* Search & Refresh Controls */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 h-10 w-full sm:w-80">
                                    <Search className="size-4 text-slate-400 shrink-0" />
                                    <input
                                        value={rosterSearch}
                                        onChange={e => setRosterSearch(e.target.value)}
                                        placeholder="Search staff by name, dept, role…"
                                        className="bg-transparent text-xs text-primary outline-none w-full placeholder:text-slate-400"
                                    />
                                    {rosterSearch && (
                                        <button onClick={() => setRosterSearch('')} className="text-slate-400 hover:text-slate-600">
                                            <X className="size-4" />
                                        </button>
                                    )}
                                </div>

                                <button
                                    onClick={fetchTodayRoster}
                                    className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                                >
                                    <RefreshCw className="size-3.5" />
                                    <span>Refresh Live Status</span>
                                </button>
                            </div>

                            {/* Roster Table */}
                            <div className="overflow-x-auto rounded-2xl border border-slate-100">
                                <table className="w-full min-w-[700px]">
                                    <thead>
                                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                                            <th className="text-left px-5 py-3.5">Staff Member</th>
                                            <th className="text-left px-5 py-3.5">Status</th>
                                            <th className="text-left px-5 py-3.5">Clock In</th>
                                            <th className="text-left px-5 py-3.5">Clock Out</th>
                                            <th className="text-left px-5 py-3.5">Worked</th>
                                            <th className="text-left px-5 py-3.5">System Time</th>
                                            <th className="text-right px-5 py-3.5">Quick Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRoster.map(sp => {
                                            const rec = allRecords.find(r => r.user_id === sp.id);
                                            const isOnline = todaySessions.some(s => s.user_id === sp.id);

                                            // Status resolution
                                            let status = rec?.status || 'absent';
                                            const todayStr = todayISO();
                                            const isHoliday = holidays.some(h => h.date === todayStr);
                                            if (!rec && isHoliday) status = 'holiday';

                                            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['absent'];

                                            return (
                                                <tr key={sp.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition-colors">
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative">
                                                                <div className="size-9 rounded-full bg-gradient-to-br from-primary to-primary-light text-white text-xs font-bold flex items-center justify-center shrink-0">
                                                                    {getInitials(sp.full_name)}
                                                                </div>
                                                                {isOnline && (
                                                                    <span className="absolute -bottom-0.5 -right-0.5 size-2.5 bg-emerald-500 border-2 border-white rounded-full" title="Active on system" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-primary">
                                                                    {sp.full_name || 'Staff User'}
                                                                </p>
                                                                <p className="text-[11px] text-slate-400 capitalize">
                                                                    {sp.department || sp.role}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-3.5">
                                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${cfg.color}`}>
                                                            <span className={`size-1.5 rounded-full ${cfg.dot}`} />
                                                            {cfg.label}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-3.5 text-xs text-slate-600 font-medium">
                                                        {fmtTime(rec?.clock_in)}
                                                    </td>

                                                    <td className="px-5 py-3.5 text-xs text-slate-600 font-medium">
                                                        {fmtTime(rec?.clock_out)}
                                                    </td>

                                                    <td className="px-5 py-3.5 text-xs text-slate-800 font-bold">
                                                        {rec?.total_hours_worked ? `${rec.total_hours_worked}h` : '—'}
                                                    </td>

                                                    <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">
                                                        {fmtMins(rec?.total_session_minutes)}
                                                    </td>

                                                    <td className="px-5 py-3.5 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {status === 'absent' && (
                                                                <button
                                                                    onClick={() => handleQuickMark(sp.id, 'present')}
                                                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                                                                    title="Quick Mark Present"
                                                                >
                                                                    Mark Present
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    setOverrideModal({ userId: sp.id, name: sp.full_name || 'Staff', date: todayISO() });
                                                                    setOverrideForm({ 
                                                                        status, 
                                                                        clock_in: rec?.clock_in ? new Date(rec.clock_in).toLocaleTimeString('en-GB').slice(0, 5) : '09:30', 
                                                                        clock_out: rec?.clock_out ? new Date(rec.clock_out).toLocaleTimeString('en-GB').slice(0, 5) : '18:30', 
                                                                        note: rec?.admin_note || '' 
                                                                    });
                                                                }}
                                                                className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                                                title="Override / Edit Attendance"
                                                            >
                                                                <Edit3 className="size-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════
                        TAB 2: MY ATTENDANCE (Personal Calendar)
                    ════════════════════════════════════════════ */}
                    {tab === 'my-attendance' && (
                        <div className="space-y-6">
                            {/* Month Navigator */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => { 
                                            const d = new Date(calYear, calMonth - 1, 1); 
                                            setCalMonth(d.getMonth()); 
                                            setCalYear(d.getFullYear()); 
                                        }}
                                        className="size-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-base">chevron_left</span>
                                    </button>
                                    <p className="font-bold text-primary text-base sm:text-lg min-w-44 text-center font-display">
                                        {new Date(calYear, calMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                                    </p>
                                    <button 
                                        onClick={() => { 
                                            const d = new Date(calYear, calMonth + 1, 1); 
                                            setCalMonth(d.getMonth()); 
                                            setCalYear(d.getFullYear()); 
                                        }}
                                        className="size-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-base">chevron_right</span>
                                    </button>
                                </div>

                                {/* Monthly Stats Pills */}
                                <div className="flex gap-2 flex-wrap">
                                    {[
                                        { label: 'Present', count: myRecords.filter(r => ['present', 'late'].includes(r.status)).length, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                                        { label: 'Late', count: myRecords.filter(r => r.status === 'late').length, color: 'bg-orange-50 text-orange-700 border-orange-200' },
                                        { label: 'Half Day', count: myRecords.filter(r => r.status === 'half_day').length, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                                        { label: 'Leaves', count: myRecords.filter(r => r.status === 'on_leave').length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
                                    ].map(s => (
                                        <span key={s.label} className={`text-[11px] font-bold px-3 py-1 rounded-xl border ${s.color}`}>
                                            {s.count} {s.label}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Calendar Grid */}
                            <div className="rounded-3xl border border-slate-100 overflow-hidden shadow-xs">
                                <div className="grid grid-cols-7 bg-slate-50/80 border-b border-slate-100">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                        <div key={d} className="text-center py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            {d}
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 bg-white">
                                    {calendarDays.map((cell, i) => {
                                        if (!cell) {
                                            return <div key={`empty-${i}`} className="min-h-[85px] border-b border-r border-slate-50 last:border-r-0 bg-slate-50/30" />;
                                        }

                                        const cfg = cell.record
                                            ? STATUS_CONFIG[cell.record.status] || STATUS_CONFIG['absent']
                                            : cell.isHoliday
                                            ? STATUS_CONFIG['holiday']
                                            : null;

                                        return (
                                            <div 
                                                key={cell.day}
                                                className={`min-h-[85px] border-b border-r border-slate-100 last:border-r-0 p-2 flex flex-col justify-between transition-colors ${
                                                    cell.isToday ? 'bg-primary/5 ring-2 ring-primary/30 ring-inset' : cell.isWeekend ? 'bg-slate-50/40' : 'bg-white'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-xs font-bold ${cell.isToday ? 'text-primary' : 'text-slate-600'}`}>
                                                        {cell.day}
                                                    </span>
                                                    {cell.record?.total_hours_worked ? (
                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                            {cell.record.total_hours_worked}h
                                                        </span>
                                                    ) : null}
                                                </div>

                                                {cfg && (
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${cfg.color} self-start truncate max-w-full`}>
                                                        {cell.isHoliday && cell.holidayName ? cell.holidayName : cfg.label}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Today's Detailed Punch Card */}
                            {todayRecord && (
                                <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3.5">
                                        Today's Punch Summary ({todayRecord.date})
                                    </p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { label: 'Clock In Time', value: fmtTime(todayRecord.clock_in), color: 'text-emerald-600' },
                                            { label: 'Clock Out Time', value: fmtTime(todayRecord.clock_out), color: 'text-red-500' },
                                            { label: 'Worked Hours', value: todayRecord.total_hours_worked ? `${todayRecord.total_hours_worked} hrs` : (isClocked ? 'In Progress' : '—'), color: 'text-primary' },
                                            { label: 'System Active', value: fmtMins(todaySessionMinutes), color: 'text-blue-600' },
                                            { label: 'Break Total', value: fmtMins(todayRecord.break_minutes), color: 'text-amber-600' },
                                            { label: 'Overtime', value: todayRecord.overtime_minutes ? fmtMins(todayRecord.overtime_minutes) : '—', color: 'text-orange-600' },
                                            { label: 'Breaks Taken', value: `${todayBreaks.length} break(s)`, color: 'text-slate-600' },
                                            { label: 'Status', value: STATUS_CONFIG[todayRecord.status]?.label || todayRecord.status, color: 'text-primary' },
                                        ].map(item => (
                                            <div key={item.label} className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">{item.label}</p>
                                                <p className={`text-sm font-black mt-0.5 ${item.color}`}>{item.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════════════════════════════════════════════
                        TAB 3: REPORTS & ANALYTICS (Admin & Owners)
                    ════════════════════════════════════════════ */}
                    {tab === 'reports' && isPrivileged && (
                        <div className="space-y-5">
                            {/* Filter Bar */}
                            <div className="flex flex-wrap gap-3 items-end bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Staff Member</label>
                                    <select 
                                        value={rptStaff} 
                                        onChange={e => setRptStaff(e.target.value)}
                                        className="h-10 border border-slate-200 rounded-xl px-3 text-xs font-bold outline-none bg-white min-w-[170px]"
                                    >
                                        <option value="all">All Staff Members</option>
                                        {staffProfiles.map(p => (
                                            <option key={p.id} value={p.id}>{p.full_name || 'Staff'}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">From Date</label>
                                    <input 
                                        type="date" 
                                        value={rptFrom} 
                                        onChange={e => setRptFrom(e.target.value)}
                                        className="h-10 border border-slate-200 rounded-xl px-3 text-xs font-bold outline-none bg-white" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
                                    <input 
                                        type="date" 
                                        value={rptTo} 
                                        onChange={e => setRptTo(e.target.value)}
                                        className="h-10 border border-slate-200 rounded-xl px-3 text-xs font-bold outline-none bg-white" 
                                    />
                                </div>
                                <button 
                                    onClick={exportCSV}
                                    className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-sm cursor-pointer ml-auto"
                                >
                                    <Download className="size-4" />
                                    <span>Export CSV</span>
                                </button>
                            </div>

                            {/* Scorecards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {reportSummary.map(s => {
                                    const totalDays = s.present + s.late + s.absent + s.halfDay + s.leave;
                                    const pct = totalDays > 0 ? Math.round(((s.present + s.late + s.halfDay * 0.5) / totalDays) * 100) : 0;

                                    return (
                                        <div key={s.id} className="bg-white rounded-3xl border border-slate-100 p-5 shadow-[var(--shadow-card)] flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between gap-3 mb-3">
                                                    <div>
                                                        <p className="font-bold text-primary text-sm">{s.name}</p>
                                                        <p className="text-[11px] text-slate-400">{s.department}</p>
                                                    </div>
                                                    <span className={`text-xs font-black px-2.5 py-1 rounded-xl border ${
                                                        pct >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : pct >= 75 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'
                                                    }`}>
                                                        {pct}% Attendance
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2 text-center my-3">
                                                    <div className="bg-slate-50 rounded-xl p-2">
                                                        <p className="text-sm font-black text-emerald-600">{s.present}</p>
                                                        <p className="text-[9px] text-slate-400 font-bold">Present</p>
                                                    </div>
                                                    <div className="bg-slate-50 rounded-xl p-2">
                                                        <p className="text-sm font-black text-orange-600">{s.late}</p>
                                                        <p className="text-[9px] text-slate-400 font-bold">Late</p>
                                                    </div>
                                                    <div className="bg-slate-50 rounded-xl p-2">
                                                        <p className="text-sm font-black text-blue-600">{s.leave}</p>
                                                        <p className="text-[9px] text-slate-400 font-bold">Leaves</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                                                <span>Total: {Math.round(s.totalHrs * 10) / 10} hrs</span>
                                                <span>System: {fmtMins(s.sessionMins)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Detailed Records Log */}
                            <div className="overflow-x-auto rounded-2xl border border-slate-100">
                                <table className="w-full min-w-[750px]">
                                    <thead>
                                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                                            <th className="text-left px-4 py-3">Staff</th>
                                            <th className="text-left px-4 py-3">Date</th>
                                            <th className="text-left px-4 py-3">Clock In</th>
                                            <th className="text-left px-4 py-3">Clock Out</th>
                                            <th className="text-left px-4 py-3">Status</th>
                                            <th className="text-left px-4 py-3">Worked</th>
                                            <th className="text-left px-4 py-3">System Time</th>
                                            <th className="text-left px-4 py-3">Note</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allRecords.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="text-center py-10 text-slate-400 text-xs">
                                                    No attendance logs found for the selected date range.
                                                </td>
                                            </tr>
                                        ) : (
                                            allRecords.map(r => {
                                                const name = staffProfiles.find(p => p.id === r.user_id)?.full_name || 'Staff';
                                                const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG['absent'];
                                                return (
                                                    <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                                                        <td className="px-4 py-3 text-xs font-bold text-primary">{name}</td>
                                                        <td className="px-4 py-3 text-xs text-slate-600">{r.date}</td>
                                                        <td className="px-4 py-3 text-xs text-slate-600">{fmtTime(r.clock_in)}</td>
                                                        <td className="px-4 py-3 text-xs text-slate-600">{fmtTime(r.clock_out)}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${cfg.color}`}>
                                                                {cfg.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-slate-800 font-bold">
                                                            {r.total_hours_worked ? `${r.total_hours_worked}h` : '—'}
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                                                            {fmtMins(r.total_session_minutes)}
                                                        </td>
                                                        <td className="px-4 py-3 text-[11px] text-slate-400 truncate max-w-xs">
                                                            {r.admin_note || '—'}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════
                        TAB 4: LEAVES (Leave Balances & Requests)
                    ════════════════════════════════════════════ */}
                    {tab === 'leaves' && (
                        <div className="space-y-6">
                            {/* Leave Balances Strip */}
                            {myBalance && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {[
                                        { label: 'Casual Leave (CL)', used: myBalance.casual_used, total: myBalance.casual_total, color: 'bg-blue-500' },
                                        { label: 'Sick Leave (SL)', used: myBalance.sick_used, total: myBalance.sick_total, color: 'bg-red-400' },
                                        { label: 'Earned Leave (EL)', used: myBalance.earned_used, total: myBalance.earned_total, color: 'bg-emerald-500' },
                                    ].map(b => (
                                        <div key={b.label} className="bg-white rounded-3xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                                            <p className="text-xs font-bold text-slate-500">{b.label}</p>
                                            <p className="text-2xl font-black text-primary font-display mt-1">
                                                {Math.max(0, b.total - b.used)}{' '}
                                                <span className="text-xs text-slate-400 font-normal">days left</span>
                                            </p>
                                            <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${b.color}`} style={{ width: `${Math.min(100, (b.used / (b.total || 1)) * 100)}%` }} />
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-medium mt-1.5">
                                                {b.used} used of {b.total} allocated
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-700">
                                    {isPrivileged ? 'Staff Leave Requests' : 'My Leave Requests'}
                                </h3>
                                <button
                                    onClick={() => { setApplyLeave(true); setLeaveMsg(''); }}
                                    className="h-10 px-4 bg-primary hover:bg-primary-light text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                                >
                                    <Plus className="size-4" />
                                    <span>Apply for Leave</span>
                                </button>
                            </div>

                            {leaveMsg && (
                                <div className={`text-xs rounded-xl p-3 border flex items-center gap-2 ${leaveMsg.startsWith('Error') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                                    <AlertCircle className="size-4" />
                                    <span>{leaveMsg}</span>
                                </div>
                            )}

                            {/* Leave Requests List */}
                            <div className="space-y-3">
                                {leaveRequests.length === 0 ? (
                                    <div className="py-12 flex flex-col items-center text-center bg-slate-50 rounded-2xl border border-slate-100">
                                        <Coffee className="size-8 text-slate-300 mb-2" />
                                        <p className="text-xs font-bold text-slate-500">No leave requests found</p>
                                    </div>
                                ) : (
                                    leaveRequests.map(l => (
                                        <div key={l.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                                            <div>
                                                {isPrivileged && (
                                                    <p className="text-xs font-bold text-primary mb-0.5">
                                                        {l.profiles?.full_name || 'Staff Member'}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-800 capitalize">
                                                        {l.leave_type} Leave
                                                    </span>
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                                        l.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : l.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    }`}>
                                                        {l.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {l.start_date} to {l.end_date} ({l.days} day{l.days !== 1 ? 's' : ''})
                                                </p>
                                                {l.reason && <p className="text-xs text-slate-400 mt-0.5 italic">"{l.reason}"</p>}
                                            </div>

                                            {isPrivileged && l.status === 'pending' && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => reviewLeave(l, 'approved')}
                                                        className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => reviewLeave(l, 'rejected')}
                                                        className="h-8 px-3 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════
                        TAB 5: SETTINGS & SHIFT RULES (Admin Only)
                    ════════════════════════════════════════════ */}
                    {tab === 'settings' && isPrivileged && (
                        <div className="space-y-8">
                            {/* Shift Configuration */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="font-bold text-primary text-base">Work Shift Configurations</h3>
                                        <p className="text-xs text-slate-400">Define office shifts, start/end hours, grace periods and half-day rules.</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setEditShift(null);
                                            setShiftForm({ name: '', start_time: '09:30', end_time: '18:30', late_threshold: 15, half_day_hours: 4.5, department: '', is_default: false });
                                        }}
                                        className="h-9 px-4 bg-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-primary-light transition-colors cursor-pointer"
                                    >
                                        <Plus className="size-4" />
                                        <span>Add Shift</span>
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {shifts.map(s => (
                                        <div key={s.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xs">
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                    <Clock className="size-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-primary flex items-center gap-1.5">
                                                        {s.name}
                                                        {s.is_default && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Default</span>}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)} · Late threshold: {s.late_threshold} mins · Half-day: &lt; {s.half_day_hours} hrs
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setEditShift(s);
                                                    setShiftForm({
                                                        name: s.name,
                                                        start_time: s.start_time.slice(0, 5),
                                                        end_time: s.end_time.slice(0, 5),
                                                        late_threshold: s.late_threshold,
                                                        half_day_hours: s.half_day_hours,
                                                        department: s.department || '',
                                                        is_default: s.is_default
                                                    });
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                                                title="Edit Shift"
                                            >
                                                <Edit3 className="size-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Public & Company Holidays */}
                            <div className="pt-6 border-t border-slate-100">
                                <h3 className="font-bold text-primary text-base mb-1">Company Holidays</h3>
                                <p className="text-xs text-slate-400 mb-4">Official paid holidays automatically accounted for in attendance rosters and reports.</p>

                                <div className="flex gap-3 flex-wrap mb-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <input
                                        type="text"
                                        placeholder="Holiday Name (e.g. Diwali, Independence Day)"
                                        value={holidayForm.name}
                                        onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })}
                                        className="h-10 border border-slate-200 rounded-xl px-3 text-xs bg-white flex-1 min-w-[160px] outline-none"
                                    />
                                    <input
                                        type="date"
                                        value={holidayForm.date}
                                        onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })}
                                        className="h-10 border border-slate-200 rounded-xl px-3 text-xs bg-white outline-none"
                                    />
                                    <button
                                        onClick={addHoliday}
                                        disabled={!holidayForm.name.trim() || holidaySaving}
                                        className="h-10 px-5 bg-primary hover:bg-primary-light text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                                    >
                                        {holidaySaving ? 'Adding…' : 'Add Holiday'}
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {holidays.map(h => (
                                        <div key={h.id} className="flex items-center justify-between bg-purple-50/60 border border-purple-100 rounded-xl px-4 py-2.5">
                                            <div className="flex items-center gap-2.5">
                                                <span className="material-symbols-outlined text-purple-600 text-lg">celebration</span>
                                                <span className="text-xs font-bold text-purple-900">{h.name}</span>
                                                <span className="text-[11px] text-purple-600">({new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})</span>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                                                {h.type}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ════════════════════════════════════════════
                MODAL 1: Apply Leave
            ════════════════════════════════════════════ */}
            {applyLeave && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setApplyLeave(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold font-display">Apply for Leave</h2>
                                <p className="text-xs text-blue-100">Submit a leave request for admin approval.</p>
                            </div>
                            <button onClick={() => setApplyLeave(false)} className="size-7 rounded-full bg-white/20 flex items-center justify-center text-white cursor-pointer">
                                <X className="size-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Leave Type</label>
                                <select
                                    value={leaveForm.leave_type}
                                    onChange={e => setLeaveForm({ ...leaveForm, leave_type: e.target.value as any })}
                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs bg-white outline-none"
                                >
                                    <option value="casual">Casual Leave (CL)</option>
                                    <option value="sick">Sick Leave (SL)</option>
                                    <option value="earned">Earned Leave (EL)</option>
                                    <option value="unpaid">Unpaid Leave</option>
                                    <option value="comp_off">Compensatory Off</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={leaveForm.start_date}
                                        onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        value={leaveForm.end_date}
                                        onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                                        min={leaveForm.start_date}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Reason (Optional)</label>
                                <textarea
                                    rows={2}
                                    value={leaveForm.reason}
                                    onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                                    placeholder="e.g. Family function / Medical checkup"
                                    className="w-full border border-slate-200 rounded-xl p-3 text-xs outline-none resize-none"
                                />
                            </div>

                            <button
                                onClick={submitLeave}
                                disabled={leaveSaving}
                                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer shadow-md shadow-blue-600/20"
                            >
                                {leaveSaving ? 'Submitting…' : 'Submit Leave Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════
                MODAL 2: Admin Override
            ════════════════════════════════════════════ */}
            {overrideModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOverrideModal(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-primary to-primary-light text-white p-5 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold font-display">Override Attendance Record</h2>
                                <p className="text-xs text-slate-300">{overrideModal.name} · {overrideModal.date}</p>
                            </div>
                            <button onClick={() => setOverrideModal(null)} className="size-7 rounded-full bg-white/20 flex items-center justify-center text-white cursor-pointer">
                                <X className="size-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Attendance Status</label>
                                <select
                                    value={overrideForm.status}
                                    onChange={e => setOverrideForm({ ...overrideForm, status: e.target.value })}
                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs bg-white outline-none"
                                >
                                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                        <option key={k} value={k}>{v.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Clock In Time</label>
                                    <input
                                        type="time"
                                        value={overrideForm.clock_in}
                                        onChange={e => setOverrideForm({ ...overrideForm, clock_in: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Clock Out Time</label>
                                    <input
                                        type="time"
                                        value={overrideForm.clock_out}
                                        onChange={e => setOverrideForm({ ...overrideForm, clock_out: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Admin Reason / Note</label>
                                <input
                                    type="text"
                                    value={overrideForm.note}
                                    onChange={e => setOverrideForm({ ...overrideForm, note: e.target.value })}
                                    placeholder="e.g. Field visit / Biometric error"
                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setOverrideModal(null)}
                                    className="flex-1 h-10 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveOverride}
                                    disabled={overrideSaving}
                                    className="flex-1 h-10 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                    {overrideSaving ? 'Saving…' : 'Save Override'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════
                MODAL 3: Shift Edit / Add
            ════════════════════════════════════════════ */}
            {(editShift !== null || shiftForm.name !== '') && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setEditShift(null); setShiftForm({ name: '', start_time: '09:30', end_time: '18:30', late_threshold: 15, half_day_hours: 4.5, department: '', is_default: false }); }}>
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-primary to-primary-light text-white p-5 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold font-display">{editShift?.id ? 'Edit Shift' : 'New Shift'}</h2>
                                <p className="text-xs text-slate-300">Set work timings and late thresholds.</p>
                            </div>
                            <button onClick={() => { setEditShift(null); setShiftForm({ name: '', start_time: '09:30', end_time: '18:30', late_threshold: 15, half_day_hours: 4.5, department: '', is_default: false }); }} className="size-7 rounded-full bg-white/20 flex items-center justify-center text-white cursor-pointer">
                                <X className="size-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Shift Name</label>
                                <input
                                    type="text"
                                    value={shiftForm.name}
                                    onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })}
                                    placeholder="e.g. Sales Morning Shift"
                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Start Time</label>
                                    <input
                                        type="time"
                                        value={shiftForm.start_time}
                                        onChange={e => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">End Time</label>
                                    <input
                                        type="time"
                                        value={shiftForm.end_time}
                                        onChange={e => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Late Grace (mins)</label>
                                    <input
                                        type="number"
                                        value={shiftForm.late_threshold}
                                        onChange={e => setShiftForm({ ...shiftForm, late_threshold: Number(e.target.value) || 15 })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Half Day &lt; (hrs)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={shiftForm.half_day_hours}
                                        onChange={e => setShiftForm({ ...shiftForm, half_day_hours: Number(e.target.value) || 4.5 })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_default_shift"
                                    checked={shiftForm.is_default}
                                    onChange={e => setShiftForm({ ...shiftForm, is_default: e.target.checked })}
                                    className="size-4 accent-primary rounded cursor-pointer"
                                />
                                <label htmlFor="is_default_shift" className="text-xs font-bold text-slate-700 cursor-pointer">
                                    Set as default shift for all staff
                                </label>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => { setEditShift(null); setShiftForm({ name: '', start_time: '09:30', end_time: '18:30', late_threshold: 15, half_day_hours: 4.5, department: '', is_default: false }); }}
                                    className="flex-1 h-10 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveShift}
                                    disabled={!shiftForm.name.trim() || shiftSaving}
                                    className="flex-1 h-10 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                    {shiftSaving ? 'Saving…' : 'Save Shift'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Attendance;
