import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useAttendance } from '../../contexts/AttendanceContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffProfile { id: string; full_name: string | null; email: string | null; role: string; department: string | null; }
interface AttendanceRecord {
    id: string; user_id: string; date: string;
    clock_in: string | null; clock_out: string | null;
    status: string; total_hours_worked: number; total_session_minutes: number;
    break_minutes: number; overtime_minutes: number;
    is_late: boolean; is_early_departure: boolean; admin_note: string | null;
}
interface LeaveRequest {
    id: string; user_id: string; leave_type: string; start_date: string; end_date: string;
    days: number; reason: string | null; status: string; reviewed_by: string | null;
    admin_note: string | null; created_at: string;
    profiles?: { full_name: string | null };
}
interface LeaveBalance { id: string; user_id: string; year: number; casual_total: number; casual_used: number; sick_total: number; sick_used: number; earned_total: number; earned_used: number; }
interface ShiftConfig { id: string; name: string; department: string | null; start_time: string; end_time: string; late_threshold: number; half_day_hours: number; is_default: boolean; }
interface Holiday { id: string; name: string; date: string; type: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; icon: string }> = {
    present:  { label: 'Present',  color: 'bg-green-50 text-green-700 border-green-200',    dot: 'bg-green-500',  icon: 'check_circle' },
    late:     { label: 'Late',     color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-400', icon: 'schedule' },
    half_day: { label: 'Half Day', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400', icon: 'brightness_half' },
    absent:   { label: 'Absent',   color: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-400',    icon: 'cancel' },
    on_leave: { label: 'On Leave', color: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-400',   icon: 'beach_access' },
    holiday:  { label: 'Holiday',  color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-400', icon: 'celebration' },
    weekend:  { label: 'Weekend',  color: 'bg-slate-50 text-slate-400 border-slate-200',    dot: 'bg-slate-300',  icon: 'weekend' },
};

const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

const fmtMins = (m: number) => {
    const h = Math.floor(m / 60); const min = m % 60;
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
};

const todayISO = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getInitials = (name: string | null) =>
    (name ?? 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'roster' | 'my-attendance' | 'reports' | 'leaves' | 'settings';

// ─── Main Component ───────────────────────────────────────────────────────────

const Attendance: React.FC = () => {
    const { user, profile, isAdmin } = useAuth();
    const { todayRecord, todayBreaks, isClocked, isOnBreak, todaySessionMinutes, refreshToday } = useAttendance();

    const [tab, setTab] = useState<Tab>(isAdmin ? 'roster' : 'my-attendance');
    const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
    const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [myBalance, setMyBalance] = useState<LeaveBalance | null>(null);
    const [shifts, setShifts] = useState<ShiftConfig[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Report filters
    const [rptStaff, setRptStaff] = useState('all');
    const [rptFrom, setRptFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
    const [rptTo, setRptTo] = useState(todayISO());

    // Calendar (My Attendance)
    const [calMonth, setCalMonth] = useState(new Date().getMonth());
    const [calYear, setCalYear] = useState(new Date().getFullYear());
    const [myRecords, setMyRecords] = useState<AttendanceRecord[]>([]);

    // Leave application
    const [applyLeave, setApplyLeave] = useState(false);
    const [leaveForm, setLeaveForm] = useState({ leave_type: 'casual', start_date: todayISO(), end_date: todayISO(), reason: '' });
    const [leaveSaving, setLeaveSaving] = useState(false);
    const [leaveMsg, setLeaveMsg] = useState('');

    // Admin manual attendance override
    const [overrideModal, setOverrideModal] = useState<{ userId: string; name: string; date: string } | null>(null);
    const [overrideForm, setOverrideForm] = useState({ status: 'present', clock_in: '09:30', clock_out: '18:30', note: '' });
    const [overrideSaving, setOverrideSaving] = useState(false);

    // Shift form
    const [editShift, setEditShift] = useState<ShiftConfig | null>(null);
    const [shiftForm, setShiftForm] = useState({ name: '', start_time: '09:30', end_time: '18:30', late_threshold: 15, half_day_hours: 4.5, department: '' });
    const [shiftSaving, setShiftSaving] = useState(false);

    // Holiday form
    const [holidayForm, setHolidayForm] = useState({ name: '', date: todayISO(), type: 'public' });
    const [holidaySaving, setHolidaySaving] = useState(false);

    // ─── Fetch ────────────────────────────────────────────────────────────────

    const fetchAll = useCallback(async () => {
        setLoadingData(true);
        const [profilesRes, shiftsRes, holidaysRes] = await Promise.all([
            supabase.from('profiles').select('id, full_name, email, role, department').in('role', ['admin', 'staff']).order('full_name'),
            supabase.from('shift_config').select('*').order('is_default', { ascending: false }),
            supabase.from('attendance_holidays').select('*').order('date'),
        ]);
        if (profilesRes.data) setStaffProfiles(profilesRes.data as StaffProfile[]);
        if (shiftsRes.data) setShifts(shiftsRes.data as ShiftConfig[]);
        if (holidaysRes.data) setHolidays(holidaysRes.data as Holiday[]);
        setLoadingData(false);
    }, []);

    const fetchTodayRoster = useCallback(async () => {
        const today = todayISO();
        const { data } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('date', today);
        if (data) setAllRecords(data as AttendanceRecord[]);
    }, []);

    const fetchMyRecords = useCallback(async () => {
        if (!user) return;
        const from = new Date(calYear, calMonth, 1).toISOString().split('T')[0];
        const to   = new Date(calYear, calMonth + 1, 0).toISOString().split('T')[0];
        const { data } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', from)
            .lte('date', to);
        if (data) setMyRecords(data as AttendanceRecord[]);
    }, [user, calMonth, calYear]);

    const fetchLeaves = useCallback(async () => {
        let q = supabase.from('leave_requests').select('*, profiles(full_name)').order('created_at', { ascending: false });
        if (!isAdmin && user) q = q.eq('user_id', user.id);
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
            setMyBalance(bal as LeaveBalance | null);
        }
    }, [user, isAdmin]);

    const fetchReports = useCallback(async () => {
        let q = supabase
            .from('attendance_records')
            .select('*')
            .gte('date', rptFrom)
            .lte('date', rptTo);
        if (rptStaff !== 'all') q = q.eq('user_id', rptStaff);
        const { data } = await q;
        if (data) setAllRecords(data as AttendanceRecord[]);
    }, [rptFrom, rptTo, rptStaff]);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    useEffect(() => {
        if (tab !== 'roster') return;
        fetchTodayRoster();
        const id = setInterval(fetchTodayRoster, 30000); // refresh every 30 seconds
        return () => clearInterval(id);
    }, [tab, fetchTodayRoster]);
    useEffect(() => { if (tab === 'my-attendance') fetchMyRecords(); }, [tab, calMonth, calYear, fetchMyRecords]);
    useEffect(() => { if (tab === 'leaves') fetchLeaves(); }, [tab, fetchLeaves]);
    useEffect(() => { if (tab === 'reports') fetchReports(); }, [tab, rptFrom, rptTo, rptStaff, fetchReports]);

    // ─── Leave Application ────────────────────────────────────────────────────

    const submitLeave = async () => {
        if (!user) return;
        setLeaveSaving(true); setLeaveMsg('');
        const days = Math.max(1, Math.round((new Date(leaveForm.end_date).getTime() - new Date(leaveForm.start_date).getTime()) / 86400000) + 1);
        const { error } = await supabase.from('leave_requests').insert({
            user_id: user.id, ...leaveForm, days,
        });
        setLeaveSaving(false);
        if (error) { setLeaveMsg('Error: ' + error.message); return; }
        setLeaveMsg('Leave applied successfully!');
        setApplyLeave(false);
        fetchLeaves();
    };

    // ─── Admin: Approve / Reject Leave ───────────────────────────────────────

    const reviewLeave = async (id: string, status: 'approved' | 'rejected', note = '') => {
        await supabase.from('leave_requests').update({
            status, reviewed_by: user!.id, reviewed_at: new Date().toISOString(), admin_note: note,
        }).eq('id', id);
        fetchLeaves();
        try {
            await supabase.from('audit_logs').insert({
                user_id: user!.id, action: `Leave ${status}`, target_type: 'Leave Request',
                target_name: id, details: `Leave request ${status} by admin`,
            });
        } catch { /* non-critical */ }
    };

    // ─── Staff: Cancel Own Pending Leave ─────────────────────────────────────

    const cancelLeave = async (id: string) => {
        await supabase.from('leave_requests').update({ status: 'cancelled' }).eq('id', id);
        fetchLeaves();
    };

    // ─── Admin: Manual Override ───────────────────────────────────────────────

    const saveOverride = async () => {
        if (!overrideModal || !user) return;
        setOverrideSaving(true);
        const today = overrideModal.date;
        const baseDate = today + 'T';
        await supabase.from('attendance_records').upsert({
            user_id: overrideModal.userId,
            date: today,
            status: overrideForm.status,
            clock_in: overrideForm.clock_in ? baseDate + overrideForm.clock_in + ':00+05:30' : null,
            clock_out: overrideForm.clock_out ? baseDate + overrideForm.clock_out + ':00+05:30' : null,
            admin_note: overrideForm.note,
            override_by: user.id,
            override_at: new Date().toISOString(),
        }, { onConflict: 'user_id,date' });
        setOverrideSaving(false);
        setOverrideModal(null);
        fetchTodayRoster();
        try {
            await supabase.from('audit_logs').insert({
                user_id: user.id, action: 'Attendance Override', target_type: 'Attendance',
                target_name: `${overrideModal.name} — ${today}`, details: overrideForm.note || 'Manual override',
            });
        } catch { /* non-critical */ }
    };

    // ─── Shift Save ───────────────────────────────────────────────────────────

    const saveShift = async () => {
        setShiftSaving(true);
        const payload = { ...shiftForm, department: shiftForm.department || null };
        if (editShift) {
            await supabase.from('shift_config').update(payload).eq('id', editShift.id);
        } else {
            await supabase.from('shift_config').insert(payload);
        }
        setShiftSaving(false);
        setEditShift(null);
        fetchAll();
    };

    // ─── Holiday Save ─────────────────────────────────────────────────────────

    const addHoliday = async () => {
        setHolidaySaving(true);
        await supabase.from('attendance_holidays').insert(holidayForm);
        setHolidaySaving(false);
        setHolidayForm({ name: '', date: todayISO(), type: 'public' });
        fetchAll();
    };

    // ─── Calendar Builder ─────────────────────────────────────────────────────

    const calendarDays = useMemo(() => {
        const firstDay = new Date(calYear, calMonth, 1).getDay();
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const cells: (null | { day: number; record: AttendanceRecord | null; isToday: boolean; isWeekend: boolean })[] = [];
        for (let i = 0; i < firstDay; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dow = new Date(calYear, calMonth, d).getDay();
            const record = myRecords.find(r => r.date === dateStr) ?? null;
            cells.push({ day: d, record, isToday: dateStr === todayISO(), isWeekend: dow === 0 || dow === 6 });
        }
        return cells;
    }, [calYear, calMonth, myRecords]);

    // ─── Report Summary ───────────────────────────────────────────────────────

    const reportSummary = useMemo(() => {
        const staffMap: Record<string, { name: string; present: number; late: number; absent: number; halfDay: number; leave: number; totalHrs: number; sessionMins: number; otMins: number }> = {};
        for (const p of staffProfiles) {
            staffMap[p.id] = { name: p.full_name ?? '—', present: 0, late: 0, absent: 0, halfDay: 0, leave: 0, totalHrs: 0, sessionMins: 0, otMins: 0 };
        }
        for (const r of allRecords) {
            if (!staffMap[r.user_id]) continue;
            const s = staffMap[r.user_id];
            if (r.status === 'present') s.present++;
            else if (r.status === 'late') { s.present++; s.late++; }
            else if (r.status === 'absent') s.absent++;
            else if (r.status === 'half_day') s.halfDay++;
            else if (r.status === 'on_leave') s.leave++;
            s.totalHrs += Number(r.total_hours_worked ?? 0);
            s.sessionMins += Number(r.total_session_minutes ?? 0);
            s.otMins += Number(r.overtime_minutes ?? 0);
        }
        return Object.entries(staffMap)
            .filter(([, v]) => rptStaff === 'all' || staffProfiles.find(p => p.id === rptStaff && p.id === Object.keys(staffMap).find(k => staffMap[k] === v)))
            .map(([id, v]) => ({ id, ...v }));
    }, [allRecords, staffProfiles, rptStaff]);

    // ─── Export CSV ───────────────────────────────────────────────────────────

    const exportCSV = () => {
        const headers = ['Staff', 'Date', 'Clock In', 'Clock Out', 'Status', 'Hours', 'Session (min)', 'Overtime (min)', 'Late', 'Note'];
        const rows = allRecords.map(r => {
            const name = staffProfiles.find(p => p.id === r.user_id)?.full_name ?? r.user_id;
            return [name, r.date, fmtTime(r.clock_in), fmtTime(r.clock_out), r.status, r.total_hours_worked, r.total_session_minutes, r.overtime_minutes, r.is_late ? 'Yes' : 'No', r.admin_note ?? ''];
        });
        const csv = [headers, ...rows].map(row => row.map(String).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `attendance_${rptFrom}_${rptTo}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    const tabs: { key: Tab; label: string; icon: string; adminOnly?: boolean }[] = [
        { key: 'roster',       label: 'Today\'s Roster',  icon: 'groups',          adminOnly: true },
        { key: 'my-attendance', label: 'My Attendance',   icon: 'calendar_month' },
        { key: 'reports',      label: 'Reports',           icon: 'bar_chart',       adminOnly: true },
        { key: 'leaves',       label: 'Leaves',            icon: 'beach_access' },
        { key: 'settings',     label: 'Settings',          icon: 'tune',            adminOnly: true },
    ];

    const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin);

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Attendance</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Track presence, time-on-system, leaves and shifts.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                </div>
            </div>

            {/* ── Today's Personal Card (for current user) ── */}
            {todayRecord && (
                <div className={`rounded-2xl border px-5 py-4 flex flex-wrap items-center gap-4 ${
                    isClocked ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'bg-white border-slate-100'
                }`}>
                    <div className={`size-12 rounded-2xl flex items-center justify-center text-xl ${
                        isClocked ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                        <span className="material-symbols-outlined">{isClocked ? 'work' : 'work_off'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-primary">{profile?.full_name ?? 'You'} — Today</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {todayRecord.clock_in ? `Clocked in at ${fmtTime(todayRecord.clock_in)}` : 'Not clocked in'}
                            {todayRecord.clock_out ? ` · Out at ${fmtTime(todayRecord.clock_out)}` : ''}
                            {isOnBreak ? ' · 🟡 On break' : ''}
                        </p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        {[
                            { label: 'Status', value: STATUS_CONFIG[todayRecord.status]?.label ?? todayRecord.status, color: STATUS_CONFIG[todayRecord.status]?.color ?? '' },
                        ].map(s => (
                            <span key={s.label} className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${s.color}`}>{s.value}</span>
                        ))}
                        <div className="text-center">
                            <p className="text-sm font-black text-primary">{fmtMins(todaySessionMinutes)}</p>
                            <p className="text-[10px] text-slate-400">System Time</p>
                        </div>
                        {isClocked && (
                            <div className="text-center">
                                <p className="text-sm font-black text-green-600">{todayBreaks.length}</p>
                                <p className="text-[10px] text-slate-400">Breaks</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Tab Bar ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                <div className="flex border-b border-slate-100 overflow-x-auto">
                    {visibleTabs.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                                tab === t.key
                                    ? 'border-primary text-primary bg-primary/5'
                                    : 'border-transparent text-slate-500 hover:text-primary hover:bg-slate-50'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="p-5">
                    {/* ════════════════════════════════════════════
                        TAB: TODAY'S ROSTER (Admin only)
                    ════════════════════════════════════════════ */}
                    {tab === 'roster' && isAdmin && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <p className="text-sm font-bold text-slate-600">
                                    Live roster for {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                                </p>
                                <button onClick={fetchTodayRoster}
                                    className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors">
                                    <span className="material-symbols-outlined text-sm">refresh</span>Refresh
                                </button>
                            </div>

                            {/* Summary stats */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: 'Present', count: allRecords.filter(r => ['present', 'late'].includes(r.status)).length, color: 'text-green-600 bg-green-50' },
                                    { label: 'Late',    count: allRecords.filter(r => r.status === 'late').length,     color: 'text-orange-600 bg-orange-50' },
                                    { label: 'Absent',  count: staffProfiles.length - allRecords.filter(r => ['present', 'late', 'half_day', 'on_leave'].includes(r.status)).length, color: 'text-red-600 bg-red-50' },
                                    { label: 'On Leave', count: allRecords.filter(r => r.status === 'on_leave').length, color: 'text-blue-600 bg-blue-50' },
                                ].map(s => (
                                    <div key={s.label} className={`rounded-xl px-4 py-3 ${s.color}`}>
                                        <p className="text-2xl font-black">{s.count}</p>
                                        <p className="text-xs font-semibold opacity-70">{s.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Roster table */}
                            <div className="overflow-x-auto rounded-xl border border-slate-100">
                                <table className="w-full min-w-[650px]">
                                    <thead>
                                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 border-b border-slate-100">
                                            <th className="text-left px-4 py-3">Staff</th>
                                            <th className="text-left px-4 py-3">Status</th>
                                            <th className="text-left px-4 py-3">Clock In</th>
                                            <th className="text-left px-4 py-3">Clock Out</th>
                                            <th className="text-left px-4 py-3">System Time</th>
                                            <th className="text-left px-4 py-3">OT</th>
                                            <th className="text-left px-4 py-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staffProfiles.map(sp => {
                                            const rec = allRecords.find(r => r.user_id === sp.id);
                                            
                                            // Determine default status if no record exists
                                            let defaultStatus = 'absent';
                                            const today = new Date();
                                            
                                            // Check if today is a holiday
                                            const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                                            const isHoliday = holidays.some(h => h.date === todayStr);
                                            
                                            if (isHoliday) {
                                                defaultStatus = 'holiday';
                                            }
                                            
                                            const status = rec?.status ?? defaultStatus;
                                            const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['absent'];
                                            return (
                                                <tr key={sp.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="size-8 rounded-full bg-gradient-to-br from-primary to-primary-light text-white text-xs font-bold flex items-center justify-center shrink-0">
                                                                {getInitials(sp.full_name)}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-semibold text-primary">{sp.full_name ?? '—'}</p>
                                                                <p className="text-[10px] text-slate-400">{sp.department ?? sp.role}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border ${cfg.color}`}>
                                                            <span className={`size-1.5 rounded-full ${cfg.dot}`} />
                                                            {cfg.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-600">{fmtTime(rec?.clock_in ?? null)}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-600">{fmtTime(rec?.clock_out ?? null)}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-600">{fmtMins(rec?.total_session_minutes ?? 0)}</td>
                                                    <td className="px-4 py-3 text-sm text-orange-600 font-medium">{rec?.overtime_minutes ? fmtMins(rec.overtime_minutes) : '—'}</td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            onClick={() => {
                                                                setOverrideModal({ userId: sp.id, name: sp.full_name ?? '—', date: todayISO() });
                                                                setOverrideForm({ status: status, clock_in: '09:30', clock_out: '18:30', note: '' });
                                                            }}
                                                            className="text-xs font-semibold text-slate-500 hover:text-primary flex items-center gap-1 transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">edit</span> Override
                                                        </button>
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
                        TAB: MY ATTENDANCE (Calendar)
                    ════════════════════════════════════════════ */}
                    {tab === 'my-attendance' && (
                        <div className="space-y-5">
                            {/* Month nav */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => { const d = new Date(calYear, calMonth - 1, 1); setCalMonth(d.getMonth()); setCalYear(d.getFullYear()); }}
                                        className="size-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-500 transition-colors">
                                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                                    </button>
                                    <p className="font-bold text-primary w-36 text-center">
                                        {new Date(calYear, calMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                                    </p>
                                    <button onClick={() => { const d = new Date(calYear, calMonth + 1, 1); setCalMonth(d.getMonth()); setCalYear(d.getFullYear()); }}
                                        className="size-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-500 transition-colors">
                                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                                    </button>
                                </div>
                                {/* Monthly stats pills */}
                                <div className="flex gap-2 flex-wrap">
                                    {[
                                        { label: 'Present', count: myRecords.filter(r => ['present', 'late'].includes(r.status)).length, color: 'bg-green-100 text-green-700' },
                                        { label: 'Absent',  count: myRecords.filter(r => r.status === 'absent').length,   color: 'bg-red-100 text-red-700' },
                                        { label: 'Late',    count: myRecords.filter(r => r.status === 'late').length,     color: 'bg-orange-100 text-orange-700' },
                                        { label: 'Leave',   count: myRecords.filter(r => r.status === 'on_leave').length, color: 'bg-blue-100 text-blue-700' },
                                    ].map(s => (
                                        <span key={s.label} className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${s.color}`}>
                                            {s.count} {s.label}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Calendar grid */}
                            <div className="rounded-2xl border border-slate-100 overflow-hidden">
                                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                        <div key={d} className="text-center py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7">
                                    {calendarDays.map((cell, i) => {
                                        if (!cell) return <div key={`empty-${i}`} className="min-h-[72px] border-b border-r border-slate-50 last:border-r-0" />;
                                        const cfg = cell.record
                                            ? STATUS_CONFIG[cell.record.status] ?? STATUS_CONFIG['absent']
                                            : null;
                                        return (
                                            <div key={cell.day}
                                                className={`min-h-[72px] border-b border-r border-slate-50 last:border-r-0 p-2 flex flex-col ${
                                                    cell.isToday ? 'bg-primary/5 ring-1 ring-primary/20 ring-inset' : ''
                                                }`}>
                                                <span className={`text-xs font-bold ${cell.isToday ? 'text-primary' : 'text-slate-600'}`}>
                                                    {cell.day}
                                                </span>
                                                {cfg && (
                                                    <span className={`mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${cfg.color} self-start`}>
                                                        {cfg.label}
                                                    </span>
                                                )}
                                                {cell.record?.total_hours_worked && cell.record.total_hours_worked > 0 && (
                                                    <span className="text-[9px] text-slate-400 mt-0.5">{cell.record.total_hours_worked}h</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Today's punch card */}
                            {todayRecord && (
                                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Today's Punch Card</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { label: 'Clock In',     value: fmtTime(todayRecord.clock_in),   icon: 'login',      color: 'text-green-600' },
                                            { label: 'Clock Out',    value: fmtTime(todayRecord.clock_out),  icon: 'logout',     color: 'text-red-500' },
                                            { label: 'Worked',       value: todayRecord.total_hours_worked ? `${todayRecord.total_hours_worked}h` : (isClocked ? 'Live' : '—'), icon: 'timer', color: 'text-primary' },
                                            { label: 'System Time',  value: fmtMins(todaySessionMinutes),   icon: 'computer',   color: 'text-blue-600' },
                                            { label: 'Break Time',   value: fmtMins(todayRecord.break_minutes ?? 0), icon: 'coffee', color: 'text-amber-600' },
                                            { label: 'Overtime',     value: todayRecord.overtime_minutes ? fmtMins(todayRecord.overtime_minutes) : '—', icon: 'more_time', color: 'text-orange-600' },
                                            { label: 'Breaks Taken', value: String(todayBreaks.length),     icon: 'pause_circle', color: 'text-slate-600' },
                                            { label: 'Status',       value: STATUS_CONFIG[todayRecord.status]?.label ?? todayRecord.status, icon: 'info', color: 'text-primary' },
                                        ].map(item => (
                                            <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`material-symbols-outlined text-base ${item.color}`}>{item.icon}</span>
                                                    <p className="text-[10px] text-slate-400 font-medium">{item.label}</p>
                                                </div>
                                                <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Break entries */}
                                    {todayBreaks.length > 0 && (
                                        <div className="mt-4">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Break Log</p>
                                            <div className="space-y-1.5">
                                                {todayBreaks.map(b => (
                                                    <div key={b.id} className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                                                        <span className="material-symbols-outlined text-amber-500 text-sm">coffee</span>
                                                        <span className="text-xs font-semibold text-amber-700 capitalize">{b.break_type}</span>
                                                        <span className="text-xs text-slate-500">
                                                            {fmtTime(b.break_start)} → {b.break_end ? fmtTime(b.break_end) : 'Ongoing'}
                                                        </span>
                                                        {b.duration_minutes && (
                                                            <span className="text-xs text-slate-400 ml-auto">{b.duration_minutes}m</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!todayRecord && (
                                <div className="bg-slate-50 rounded-2xl border border-slate-100 py-12 flex flex-col items-center text-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-3">schedule</span>
                                    <p className="font-semibold text-slate-500">No attendance record for today</p>
                                    <p className="text-xs text-slate-400 mt-1">Use the clock widget in the header to check in.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════════════════════════════════════════════
                        TAB: REPORTS (Admin only)
                    ════════════════════════════════════════════ */}
                    {tab === 'reports' && isAdmin && (
                        <div className="space-y-4">
                            {/* Filters */}
                            <div className="flex flex-wrap gap-3 items-end">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Staff</label>
                                    <select value={rptStaff} onChange={e => setRptStaff(e.target.value)}
                                        className="h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white min-w-[160px]">
                                        <option value="all">All Staff</option>
                                        {staffProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">From</label>
                                    <input type="date" value={rptFrom} onChange={e => setRptFrom(e.target.value)}
                                        className="h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">To</label>
                                    <input type="date" value={rptTo} onChange={e => setRptTo(e.target.value)}
                                        className="h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                                <button onClick={exportCSV}
                                    className="h-10 px-4 bg-green-600 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-green-700 transition-colors shadow-sm">
                                    <span className="material-symbols-outlined text-base">download</span>
                                    Export CSV
                                </button>
                            </div>

                            {/* Summary cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {reportSummary.map(s => {
                                    const totalDays = s.present + s.late + s.absent + s.halfDay + s.leave;
                                    const pct = totalDays > 0 ? Math.round(((s.present + s.late + s.halfDay * 0.5) / totalDays) * 100) : 0;
                                    return (
                                        <div key={s.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="size-9 rounded-full bg-gradient-to-br from-primary to-primary-light text-white text-sm font-bold flex items-center justify-center">
                                                    {getInitials(s.name)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-primary text-sm">{s.name}</p>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full ${pct >= 90 ? 'bg-green-500' : pct >= 75 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <span className="text-[10px] text-slate-500 font-bold">{pct}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                {[
                                                    { v: s.present, l: 'Present',  c: 'text-green-600' },
                                                    { v: s.late,    l: 'Late',     c: 'text-orange-500' },
                                                    { v: s.absent,  l: 'Absent',   c: 'text-red-500' },
                                                    { v: s.halfDay, l: 'Half Day', c: 'text-yellow-600' },
                                                    { v: s.leave,   l: 'Leave',    c: 'text-blue-500' },
                                                    { v: Math.round(s.totalHrs * 10) / 10, l: 'Hrs Total', c: 'text-primary' },
                                                ].map(item => (
                                                    <div key={item.l} className="bg-slate-50 rounded-lg p-2">
                                                        <p className={`text-base font-black ${item.c}`}>{item.v}</p>
                                                        <p className="text-[9px] text-slate-400">{item.l}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-50 pt-2">
                                                <span>System: {fmtMins(s.sessionMins)}</span>
                                                <span>OT: {fmtMins(s.otMins)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Detailed records table */}
                            <div className="overflow-x-auto rounded-xl border border-slate-100">
                                <table className="w-full min-w-[800px]">
                                    <thead>
                                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 border-b border-slate-100">
                                            {['Staff', 'Date', 'Clock In', 'Clock Out', 'Status', 'Worked', 'System', 'Break', 'OT', 'Late'].map(h => (
                                                <th key={h} className="text-left px-4 py-2.5">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allRecords.length === 0 && (
                                            <tr><td colSpan={10} className="text-center py-10 text-slate-400 text-sm">No records found for the selected period.</td></tr>
                                        )}
                                        {allRecords.map(r => {
                                            const name = staffProfiles.find(p => p.id === r.user_id)?.full_name ?? '—';
                                            const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG['absent'];
                                            return (
                                                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                                                    <td className="px-4 py-2.5 text-sm font-medium text-primary">{name}</td>
                                                    <td className="px-4 py-2.5 text-sm text-slate-600">{r.date}</td>
                                                    <td className="px-4 py-2.5 text-sm text-slate-600">{fmtTime(r.clock_in)}</td>
                                                    <td className="px-4 py-2.5 text-sm text-slate-600">{fmtTime(r.clock_out)}</td>
                                                    <td className="px-4 py-2.5">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${cfg.color}`}>{cfg.label}</span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-sm text-slate-600">{r.total_hours_worked ? `${r.total_hours_worked}h` : '—'}</td>
                                                    <td className="px-4 py-2.5 text-sm text-slate-600">{fmtMins(r.total_session_minutes ?? 0)}</td>
                                                    <td className="px-4 py-2.5 text-sm text-slate-600">{fmtMins(r.break_minutes ?? 0)}</td>
                                                    <td className="px-4 py-2.5 text-sm text-orange-600">{r.overtime_minutes ? fmtMins(r.overtime_minutes) : '—'}</td>
                                                    <td className="px-4 py-2.5">
                                                        {r.is_late && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg">Late</span>}
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
                        TAB: LEAVES
                    ════════════════════════════════════════════ */}
                    {tab === 'leaves' && (
                        <div className="space-y-5">
                            {/* Leave balance */}
                            {myBalance && (
                                <div className="grid grid-cols-3 gap-4">
                                    {[
                                        { label: 'Casual Leave',  used: myBalance.casual_used,  total: myBalance.casual_total,  color: 'bg-blue-500' },
                                        { label: 'Sick Leave',    used: myBalance.sick_used,    total: myBalance.sick_total,    color: 'bg-red-400' },
                                        { label: 'Earned Leave',  used: myBalance.earned_used,  total: myBalance.earned_total,  color: 'bg-green-500' },
                                    ].map(b => (
                                        <div key={b.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)]">
                                            <p className="text-xs font-bold text-slate-500 mb-2">{b.label}</p>
                                            <p className="text-2xl font-black text-primary">{b.total - b.used} <span className="text-sm text-slate-400 font-normal">remaining</span></p>
                                            <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${b.color}`} style={{ width: `${Math.min(100, (b.used / b.total) * 100)}%` }} />
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-1">{b.used} used of {b.total}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-slate-600">{isAdmin ? 'All Leave Requests' : 'My Leave Requests'}</p>
                                <button
                                    onClick={() => { setApplyLeave(true); setLeaveMsg(''); }}
                                    className="h-9 px-4 bg-primary text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-primary-light transition-colors shadow-sm"
                                >
                                    <span className="material-symbols-outlined text-base">add</span>
                                    Apply Leave
                                </button>
                            </div>

                            {/* Leave calendar (team overview for admin) */}
                            {isAdmin && (
                                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                                    <p className="text-xs font-bold text-blue-700 mb-2">Upcoming Approved Leaves</p>
                                    <div className="flex flex-wrap gap-2">
                                        {leaveRequests.filter(l => l.status === 'approved' && l.end_date >= todayISO()).slice(0, 8).map(l => (
                                            <span key={l.id} className="bg-white border border-blue-200 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-lg">
                                                {l.profiles?.full_name ?? '—'} · {l.start_date} – {l.end_date} ({l.days}d)
                                            </span>
                                        ))}
                                        {leaveRequests.filter(l => l.status === 'approved' && l.end_date >= todayISO()).length === 0 && (
                                            <span className="text-xs text-blue-500">No upcoming approved leaves.</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {leaveMsg && (
                                <div className={`text-xs rounded-xl px-4 py-3 flex items-center gap-2 border ${leaveMsg.startsWith('Error') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                                    <span className="material-symbols-outlined text-sm">{leaveMsg.startsWith('Error') ? 'error' : 'check_circle'}</span>
                                    {leaveMsg}
                                </div>
                            )}

                            {/* Leave request list */}
                            <div className="space-y-3">
                                {leaveRequests.length === 0 && (
                                    <div className="py-12 flex flex-col items-center text-center">
                                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">beach_access</span>
                                        <p className="text-slate-500 font-semibold">No leave requests</p>
                                    </div>
                                )}
                                {leaveRequests.map(l => {
                                    const statusColor = l.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200'
                                        : l.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200'
                                        : l.status === 'cancelled' ? 'bg-slate-50 text-slate-400 border-slate-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200';
                                    return (
                                        <div key={l.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-wrap gap-3 items-start">
                                            <div className="flex-1 min-w-0">
                                                {isAdmin && (
                                                    <p className="text-xs font-bold text-primary mb-0.5">{l.profiles?.full_name ?? '—'}</p>
                                                )}
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="capitalize text-sm font-semibold text-slate-700">{l.leave_type} Leave</span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border capitalize ${statusColor}`}>{l.status}</span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {l.start_date} → {l.end_date} · {l.days} day{l.days !== 1 ? 's' : ''}
                                                </p>
                                                {l.reason && <p className="text-xs text-slate-400 mt-0.5">"{l.reason}"</p>}
                                                {l.admin_note && <p className="text-xs text-slate-400 mt-0.5">Admin: {l.admin_note}</p>}
                                            </div>
                                            {isAdmin && l.status === 'pending' && (
                                                <div className="flex gap-2 shrink-0">
                                                    <button onClick={() => reviewLeave(l.id, 'approved')}
                                                        className="h-8 px-3 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 transition-colors">
                                                        Approve
                                                    </button>
                                                    <button onClick={() => reviewLeave(l.id, 'rejected')}
                                                        className="h-8 px-3 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors">
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                            {!isAdmin && l.status === 'pending' && (
                                                <button onClick={() => cancelLeave(l.id)}
                                                    className="h-8 px-3 border border-slate-200 text-slate-500 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shrink-0">
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════
                        TAB: SETTINGS (Admin only)
                    ════════════════════════════════════════════ */}
                    {tab === 'settings' && isAdmin && (
                        <div className="space-y-8">
                            {/* ── Shift Configuration ── */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="font-bold text-primary">Shift Configuration</p>
                                        <p className="text-xs text-slate-400">Define working hours, late thresholds, and half-day rules.</p>
                                    </div>
                                    <button onClick={() => { setEditShift({ id: '', name: '', department: null, user_id: null, start_time: '09:30:00', end_time: '18:30:00', late_threshold: 15, half_day_hours: 4.5, is_default: false } as any); setShiftForm({ name: '', start_time: '09:30', end_time: '18:30', late_threshold: 15, half_day_hours: 4.5, department: '' }); }}
                                        className="h-9 px-4 bg-primary text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-primary-light transition-colors">
                                        <span className="material-symbols-outlined text-base">add</span> Add Shift
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {shifts.map(s => (
                                        <div key={s.id} className="bg-white border border-slate-100 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-primary text-base">schedule</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-primary">{s.name} {s.is_default && <span className="text-[10px] text-primary/60">(Default)</span>}</p>
                                                    <p className="text-xs text-slate-400">{s.start_time.slice(0,5)} – {s.end_time.slice(0,5)} · Late after {s.late_threshold}min · Half day &lt; {s.half_day_hours}h</p>
                                                </div>
                                            </div>
                                            <button onClick={() => { setEditShift(s); setShiftForm({ name: s.name, start_time: s.start_time.slice(0,5), end_time: s.end_time.slice(0,5), late_threshold: s.late_threshold, half_day_hours: s.half_day_hours, department: s.department ?? '' }); }}
                                                className="text-xs font-semibold text-slate-500 hover:text-primary flex items-center gap-1 transition-colors">
                                                <span className="material-symbols-outlined text-sm">edit</span> Edit
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Holidays ── */}
                            <div>
                                <p className="font-bold text-primary mb-1">Holidays</p>
                                <p className="text-xs text-slate-400 mb-4">Days automatically marked as paid off for all staff.</p>
                                <div className="flex gap-3 flex-wrap mb-4">
                                    <input type="text" placeholder="Holiday name" value={holidayForm.name} onChange={e => setHolidayForm({...holidayForm, name: e.target.value})}
                                        className="h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 flex-1 min-w-[140px]" />
                                    <input type="date" value={holidayForm.date} onChange={e => setHolidayForm({...holidayForm, date: e.target.value})}
                                        className="h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                    <select value={holidayForm.type} onChange={e => setHolidayForm({...holidayForm, type: e.target.value})}
                                        className="h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                        <option value="public">Public</option>
                                        <option value="company">Company</option>
                                        <option value="optional">Optional</option>
                                    </select>
                                    <button onClick={addHoliday} disabled={!holidayForm.name || holidaySaving}
                                        className="h-10 px-4 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-light transition-colors disabled:opacity-60">
                                        {holidaySaving ? 'Adding…' : 'Add Holiday'}
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {holidays.filter(h => h.date >= todayISO()).map(h => (
                                        <div key={h.id} className="flex items-center gap-3 bg-purple-50 border border-purple-100 rounded-xl px-4 py-2.5">
                                            <span className="material-symbols-outlined text-purple-500 text-base">celebration</span>
                                            <p className="text-sm font-semibold text-purple-700">{h.name}</p>
                                            <p className="text-xs text-purple-500">{new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                            <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-lg capitalize ml-auto">{h.type}</span>
                                        </div>
                                    ))}
                                    {holidays.filter(h => h.date >= todayISO()).length === 0 && (
                                        <p className="text-sm text-slate-400 py-3 text-center">No upcoming holidays defined.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ════════════════════════════════════════════
                MODAL: Apply Leave
            ════════════════════════════════════════════ */}
            {applyLeave && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 pt-6 pb-7">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white text-xl">beach_access</span>
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-white">Apply for Leave</h2>
                                        <p className="text-white/60 text-xs">Submit your leave request.</p>
                                    </div>
                                </div>
                                <button onClick={() => setApplyLeave(false)}
                                    className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                                    <span className="material-symbols-outlined text-white text-lg">close</span>
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Leave Type</label>
                                <select value={leaveForm.leave_type} onChange={e => setLeaveForm({...leaveForm, leave_type: e.target.value})}
                                    className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                    <option value="casual">Casual Leave</option>
                                    <option value="sick">Sick Leave</option>
                                    <option value="earned">Earned Leave</option>
                                    <option value="unpaid">Unpaid Leave</option>
                                    <option value="comp_off">Compensatory Off</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">From</label>
                                    <input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm({...leaveForm, start_date: e.target.value})}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">To</label>
                                    <input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm({...leaveForm, end_date: e.target.value})}
                                        min={leaveForm.start_date}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Reason <span className="text-slate-400 font-normal">(optional)</span></label>
                                <textarea value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})}
                                    rows={3} placeholder="Brief reason for leave…"
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 resize-none" />
                            </div>
                            <button onClick={submitLeave} disabled={leaveSaving}
                                className="w-full h-12 bg-blue-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-60">
                                {leaveSaving
                                    ? <><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
                                    : <><span className="material-symbols-outlined text-lg">send</span> Submit Request</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════
                MODAL: Admin Override
            ════════════════════════════════════════════ */}
            {overrideModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 pt-6 pb-7">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-white">Override Attendance</h2>
                                    <p className="text-white/60 text-xs">{overrideModal.name} · {overrideModal.date}</p>
                                </div>
                                <button onClick={() => setOverrideModal(null)}
                                    className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                                    <span className="material-symbols-outlined text-white text-lg">close</span>
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Status</label>
                                <select value={overrideForm.status} onChange={e => setOverrideForm({...overrideForm, status: e.target.value})}
                                    className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                        <option key={k} value={k}>{v.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Clock In</label>
                                    <input type="time" value={overrideForm.clock_in} onChange={e => setOverrideForm({...overrideForm, clock_in: e.target.value})}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Clock Out</label>
                                    <input type="time" value={overrideForm.clock_out} onChange={e => setOverrideForm({...overrideForm, clock_out: e.target.value})}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Admin Note</label>
                                <input type="text" value={overrideForm.note} onChange={e => setOverrideForm({...overrideForm, note: e.target.value})}
                                    placeholder="Reason for override…"
                                    className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setOverrideModal(null)}
                                    className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button onClick={saveOverride} disabled={overrideSaving}
                                    className="flex-1 h-11 bg-primary text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-primary-light transition-colors disabled:opacity-60">
                                    {overrideSaving ? <><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : <>Save Override</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════
                MODAL: Shift Edit
            ════════════════════════════════════════════ */}
            {editShift !== null && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-primary to-primary-light px-6 pt-6 pb-7">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-white">{editShift.id ? 'Edit Shift' : 'New Shift'}</h2>
                                    <p className="text-white/60 text-xs">Configure shift timings and thresholds.</p>
                                </div>
                                <button onClick={() => setEditShift(null)}
                                    className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                                    <span className="material-symbols-outlined text-white text-lg">close</span>
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Shift Name</label>
                                <input type="text" value={shiftForm.name} onChange={e => setShiftForm({...shiftForm, name: e.target.value})}
                                    placeholder="e.g. Morning Shift"
                                    className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Start Time</label>
                                    <input type="time" value={shiftForm.start_time} onChange={e => setShiftForm({...shiftForm, start_time: e.target.value})}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">End Time</label>
                                    <input type="time" value={shiftForm.end_time} onChange={e => setShiftForm({...shiftForm, end_time: e.target.value})}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Late Threshold (min)</label>
                                    <input type="number" value={shiftForm.late_threshold} onChange={e => setShiftForm({...shiftForm, late_threshold: Number(e.target.value)})}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Half Day Threshold (hrs)</label>
                                    <input type="number" step="0.5" value={shiftForm.half_day_hours} onChange={e => setShiftForm({...shiftForm, half_day_hours: Number(e.target.value)})}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Department <span className="text-slate-400 font-normal">(leave blank for all)</span></label>
                                <select value={shiftForm.department} onChange={e => setShiftForm({...shiftForm, department: e.target.value})}
                                    className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                    <option value="">All Departments</option>
                                    {['Sales', 'Operations', 'Finance', 'CRM', 'Management', 'IT', 'Other'].map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => setEditShift(null)}
                                    className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button onClick={saveShift} disabled={shiftSaving || !shiftForm.name}
                                    className="flex-1 h-11 bg-primary text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-primary-light transition-colors disabled:opacity-60">
                                    {shiftSaving ? <><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : <>Save Shift</>}
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
