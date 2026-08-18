import React, {
    createContext, useContext, useEffect, useRef,
    useState, useCallback
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttendanceRecord {
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

export interface AttendanceBreak {
    id: string;
    record_id: string;
    break_start: string;
    break_end: string | null;
    duration_minutes: number | null;
    break_type: 'lunch' | 'short' | 'personal';
}

export interface ShiftConfig {
    id: string;
    name: string;
    department: string | null;
    user_id: string | null;
    start_time: string;    // "09:30:00"
    end_time: string;      // "18:30:00"
    late_threshold: number; // minutes
    half_day_hours: number;
    is_default: boolean;
}

const DEFAULT_SHIFT: ShiftConfig = {
    id: 'default-standard-shift',
    name: 'Standard Shift',
    department: null,
    user_id: null,
    start_time: '09:30:00',
    end_time: '18:30:00',
    late_threshold: 15,
    half_day_hours: 4.5,
    is_default: true,
};

interface AttendanceContextValue {
    todayRecord: AttendanceRecord | null;
    todayBreaks: AttendanceBreak[];
    activeBreak: AttendanceBreak | null;
    sessionId: string | null;
    isClocked: boolean;
    isOnBreak: boolean;
    shift: ShiftConfig;
    loading: boolean;
    clockIn: () => Promise<{ error?: string }>;
    clockOut: () => Promise<{ error?: string }>;
    startBreak: (type: AttendanceBreak['break_type']) => Promise<void>;
    endBreak: () => Promise<void>;
    refreshToday: () => Promise<{ record: AttendanceRecord | null; isOnLeave: boolean }>;
    /** Total active session minutes accumulated today */
    todaySessionMinutes: number;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AttendanceContext = createContext<AttendanceContextValue>({
    todayRecord: null,
    todayBreaks: [],
    activeBreak: null,
    sessionId: null,
    isClocked: false,
    isOnBreak: false,
    shift: DEFAULT_SHIFT,
    loading: true,
    clockIn: async () => ({}),
    clockOut: async () => ({}),
    startBreak: async () => {},
    endBreak: async () => {},
    refreshToday: async () => ({ record: null, isOnLeave: false }),
    todaySessionMinutes: 0,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/** Parse "HH:MM:SS" time string into { hours, minutes } */
const parseTime = (t: string) => {
    const [h, m] = (t || '09:30:00').split(':').map(Number);
    return { hours: Number.isFinite(h) ? h : 9, minutes: Number.isFinite(m) ? m : 30 };
};

/** Returns current date's ISO without time */
const nowISO = () => new Date().toISOString();

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, profile, isAdmin, isStaff, isOwner } = useAuth();

    const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
    const [todayBreaks, setTodayBreaks] = useState<AttendanceBreak[]>([]);
    const [activeBreak, setActiveBreak] = useState<AttendanceBreak | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [shift, setShift] = useState<ShiftConfig>(DEFAULT_SHIFT);
    const [loading, setLoading] = useState(true);
    const [todaySessionMinutes, setTodaySessionMinutes] = useState(0);
    const [dbSessionMinutes, setDbSessionMinutes] = useState(0);
    const [, setIsOnLeaveToday] = useState(false);

    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const sessionStartRef = useRef<Date | null>(null);
    const sessionIdRef = useRef<string | null>(null);

    // Refs for fresh access in async callbacks
    const userRef = useRef(user);
    const profileRef = useRef(profile);
    const shiftRef = useRef<ShiftConfig>(DEFAULT_SHIFT);
    const todayRecordRef = useRef<AttendanceRecord | null>(null);
    const activeBreakRef = useRef<AttendanceBreak | null>(null);

    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { profileRef.current = profile; }, [profile]);
    useEffect(() => { activeBreakRef.current = activeBreak; }, [activeBreak]);

    // Guard: init runs once per user session
    const initDoneRef = useRef(false);

    // ─── Core async helpers ───────────────────────────────────────────────────

    /**
     * Fetches the applicable shift from DB or falls back to DEFAULT_SHIFT.
     */
    const doFetchShift = async (): Promise<ShiftConfig> => {
        const prof = profileRef.current;
        if (!prof) {
            setShift(DEFAULT_SHIFT);
            shiftRef.current = DEFAULT_SHIFT;
            return DEFAULT_SHIFT;
        }

        try {
            const orConditions = [`user_id.eq.${prof.id}`, `is_default.eq.true`];
            if (prof.department) {
                orConditions.push(`department.eq.${prof.department}`);
            }

            const { data, error } = await supabase
                .from('shift_config')
                .select('*')
                .or(orConditions.join(','));

            if (!error && data && data.length > 0) {
                const sorted = [...data].sort((a, b) => {
                    if (a.user_id === prof.id) return -1;
                    if (b.user_id === prof.id) return 1;
                    if (prof.department && a.department === prof.department) return -1;
                    if (prof.department && b.department === prof.department) return 1;
                    return a.is_default ? -1 : 1;
                });
                const resolved = (sorted[0] || DEFAULT_SHIFT) as ShiftConfig;
                setShift(resolved);
                shiftRef.current = resolved;
                return resolved;
            }
        } catch (err) {
            console.error('Exception in doFetchShift:', err);
        }

        setShift(DEFAULT_SHIFT);
        shiftRef.current = DEFAULT_SHIFT;
        return DEFAULT_SHIFT;
    };

    /**
     * Fetches today's record and active breaks.
     */
    const doRefreshToday = async (): Promise<{ record: AttendanceRecord | null; isOnLeave: boolean }> => {
        const uid = userRef.current?.id;
        if (!uid) { 
            setLoading(false); 
            return { record: null, isOnLeave: false }; 
        }

        try {
            const today = todayDate();

            // 1. Fetch today's attendance record
            const { data: record, error: recError } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('user_id', uid)
                .eq('date', today)
                .maybeSingle();

            if (recError) console.error('doRefreshToday record error:', recError);

            const resolvedRecord = (record || null) as AttendanceRecord | null;
            setTodayRecord(resolvedRecord);
            todayRecordRef.current = resolvedRecord;

            // 2. Fetch breaks if record exists
            if (resolvedRecord?.id) {
                const { data: breaks } = await supabase
                    .from('attendance_breaks')
                    .select('*')
                    .eq('record_id', resolvedRecord.id)
                    .order('break_start', { ascending: true });

                const breakList = (breaks ?? []) as AttendanceBreak[];
                setTodayBreaks(breakList);
                const openBreak = breakList.find(b => !b.break_end);
                setActiveBreak(openBreak ?? null);
                activeBreakRef.current = openBreak ?? null;
            } else {
                setTodayBreaks([]);
                setActiveBreak(null);
                activeBreakRef.current = null;
            }

            // 3. Check approved leave for today
            let isOnLeave = false;
            const { data: leaves } = await supabase
                .from('leave_requests')
                .select('id')
                .eq('user_id', uid)
                .eq('status', 'approved')
                .lte('start_date', today)
                .gte('end_date', today)
                .limit(1);

            if (leaves && leaves.length > 0) isOnLeave = true;
            setIsOnLeaveToday(isOnLeave);

            // 4. Fetch session totals
            const { data: sessions } = await supabase
                .from('attendance_sessions')
                .select('id, duration_minutes')
                .eq('user_id', uid)
                .eq('date', today);

            const completedDB = (sessions ?? [])
                .filter(s => s.id !== sessionIdRef.current)
                .reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
            setDbSessionMinutes(completedDB);

            const liveMins = sessionStartRef.current
                ? Math.floor((Date.now() - sessionStartRef.current.getTime()) / 60000)
                : 0;
            setTodaySessionMinutes(completedDB + liveMins);

            return { record: resolvedRecord, isOnLeave };
        } catch (err) {
            console.error('Exception in doRefreshToday:', err);
            return { record: null, isOnLeave: false };
        } finally {
            setLoading(false);
        }
    };

    /**
     * Performs clock-in DB write with shift config.
     */
    const doClockIn = async (
        shiftCfg: ShiftConfig,
        existingRecord: AttendanceRecord | null
    ): Promise<{ error?: string }> => {
        const uid = userRef.current?.id;
        if (!uid) return { error: 'Not authenticated.' };
        if (existingRecord?.clock_in && !existingRecord?.clock_out) return {}; // Already clocked in

        try {
            const now = new Date();
            const today = todayDate();

            const { hours: sh, minutes: sm } = parseTime(shiftCfg.start_time);
            const shiftStartMins = sh * 60 + sm;
            const nowMins = now.getHours() * 60 + now.getMinutes();
            const isLate = nowMins > shiftStartMins + (shiftCfg.late_threshold || 15);
            const status: AttendanceRecord['status'] = isLate ? 'late' : 'present';

            // Clean shift ID if it's a UUID
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shiftCfg.id);

            const payload: any = {
                user_id: uid,
                staff_id: uid,
                date: today,
                clock_in: now.toISOString(),
                clock_out: null,
                status,
                is_late: isLate,
                total_hours_worked: 0,
                updated_at: now.toISOString(),
            };

            if (isUUID) {
                payload.shift_id = shiftCfg.id;
            }

            let newRecord: AttendanceRecord | null = null;

            if (existingRecord?.id) {
                const { data, error } = await supabase
                    .from('attendance_records')
                    .update(payload)
                    .eq('id', existingRecord.id)
                    .select()
                    .single();

                if (error) {
                    console.error('doClockIn update DB error:', error);
                    return { error: error.message };
                }
                newRecord = data as AttendanceRecord;
            } else {
                const { data, error } = await supabase
                    .from('attendance_records')
                    .upsert(payload, { onConflict: 'user_id,date' })
                    .select()
                    .single();

                if (error) {
                    // Fallback to insert if upsert had conflict specification issue
                    const { data: insertData, error: insertError } = await supabase
                        .from('attendance_records')
                        .insert(payload)
                        .select()
                        .single();

                    if (insertError) {
                        console.error('doClockIn insert DB error:', error, insertError);
                        return { error: error.message || insertError.message };
                    }
                    newRecord = insertData as AttendanceRecord;
                } else {
                    newRecord = data as AttendanceRecord;
                }
            }

            if (newRecord) {
                setTodayRecord(newRecord);
                todayRecordRef.current = newRecord;
            }

            // Audit log (non-critical)
            try {
                await supabase.from('audit_logs').insert({
                    user_id: uid,
                    action: 'Clock In',
                    target_type: 'Attendance',
                    target_name: today,
                    details: `Clocked in at ${now.toLocaleTimeString('en-IN')}${isLate ? ' (Late)' : ''}`,
                });
            } catch { /* non-critical */ }

            return {};
        } catch (err: any) {
            console.error('Exception in doClockIn:', err);
            return { error: err.message || 'Unexpected error during clock-in.' };
        }
    };

    // ─── Public API callbacks ─────────────────────────────────────────────────

    const refreshToday = useCallback(
        () => doRefreshToday(),
        []
    );

    const clockIn = useCallback(async (): Promise<{ error?: string }> => {
        const currentShift = shiftRef.current || DEFAULT_SHIFT;
        const currentRecord = todayRecordRef.current;
        if (!userRef.current) {
            return { error: 'Not authenticated.' };
        }
        return doClockIn(currentShift, currentRecord);
    }, []);

    const clockOut = useCallback(async (): Promise<{ error?: string }> => {
        const uid = userRef.current?.id;
        const rec = todayRecordRef.current;
        const currentShift = shiftRef.current || DEFAULT_SHIFT;

        if (!uid || !rec) return { error: 'No clock-in record found for today.' };
        if (rec.clock_out) return { error: 'Already clocked out today.' };

        try {
            const now = new Date();
            const clockInTime = rec.clock_in ? new Date(rec.clock_in) : now;
            const totalMs = Math.max(0, now.getTime() - clockInTime.getTime());
            const breakMs = (rec.break_minutes ?? 0) * 60000;
            const workedMs = Math.max(0, totalMs - breakMs);
            const hoursWorked = Math.round((workedMs / 3600000) * 100) / 100;

            const { hours: eh, minutes: em } = parseTime(currentShift.end_time);
            const shiftEnd = new Date(clockInTime);
            shiftEnd.setHours(eh, em, 0, 0);
            if (shiftEnd < clockInTime) shiftEnd.setDate(shiftEnd.getDate() + 1);

            const overtimeMins = Math.floor(Math.max(0, now.getTime() - shiftEnd.getTime()) / 60000);
            const isEarlyDeparture = now.getTime() < (shiftEnd.getTime() - 15 * 60 * 1000);

            let status: AttendanceRecord['status'] = rec.status;
            if (hoursWorked < (currentShift.half_day_hours || 4.5)) {
                status = 'half_day';
            }

            // Calculate total system session minutes
            let finalSessionMinutes = todaySessionMinutes;
            if (sessionStartRef.current) {
                const finalLiveSession = Math.floor((Date.now() - sessionStartRef.current.getTime()) / 60000);
                const { data: dbSessions } = await supabase
                    .from('attendance_sessions')
                    .select('id, duration_minutes')
                    .eq('user_id', uid)
                    .eq('date', todayDate());

                finalSessionMinutes = (dbSessions ?? []).reduce((sum, s) => {
                    if (s.id === sessionIdRef.current) return sum + finalLiveSession;
                    return sum + (s.duration_minutes ?? 0);
                }, 0);
            }

            const { error } = await supabase
                .from('attendance_records')
                .update({
                    clock_out: now.toISOString(),
                    total_hours_worked: hoursWorked,
                    overtime_minutes: overtimeMins,
                    is_early_departure: isEarlyDeparture,
                    status,
                    total_session_minutes: finalSessionMinutes,
                    updated_at: now.toISOString(),
                })
                .eq('id', rec.id);

            if (error) return { error: error.message };

            // Close any open break
            if (activeBreakRef.current) await endBreak();

            // End active system session
            if (sessionIdRef.current && sessionStartRef.current) {
                const duration = Math.floor((Date.now() - sessionStartRef.current.getTime()) / 60000);
                await supabase
                    .from('attendance_sessions')
                    .update({ session_end: nowISO(), duration_minutes: duration, is_active: false })
                    .eq('id', sessionIdRef.current);
            }

            await doRefreshToday();

            try {
                await supabase.from('audit_logs').insert({
                    user_id: uid,
                    action: 'Clock Out',
                    target_type: 'Attendance',
                    target_name: todayDate(),
                    details: `Clocked out at ${now.toLocaleTimeString('en-IN')} — ${hoursWorked}h worked`,
                });
            } catch { /* non-critical */ }

            return {};
        } catch (err: any) {
            console.error('Exception in clockOut:', err);
            return { error: err.message || 'An unexpected error occurred during clock-out.' };
        }
    }, [todaySessionMinutes]);

    // ─── Break Management ─────────────────────────────────────────────────────

    const startBreak = useCallback(async (type: AttendanceBreak['break_type']) => {
        const rec = todayRecordRef.current;
        const uid = userRef.current?.id;
        if (!rec || activeBreakRef.current || !uid) return;

        const { data } = await supabase
            .from('attendance_breaks')
            .insert({ record_id: rec.id, user_id: uid, break_type: type })
            .select()
            .single();

        if (data) {
            setActiveBreak(data as AttendanceBreak);
            activeBreakRef.current = data as AttendanceBreak;
            setTodayBreaks(prev => [...prev, data as AttendanceBreak]);
        }
    }, []);

    const endBreak = useCallback(async () => {
        const ab = activeBreakRef.current;
        const rec = todayRecordRef.current;
        if (!ab) return;

        const now = new Date();
        const start = new Date(ab.break_start);
        const durationMins = Math.max(1, Math.round((now.getTime() - start.getTime()) / 60000));

        await supabase
            .from('attendance_breaks')
            .update({ break_end: now.toISOString(), duration_minutes: durationMins })
            .eq('id', ab.id);

        if (rec) {
            const newBreakTotal = (rec.break_minutes ?? 0) + durationMins;
            await supabase
                .from('attendance_records')
                .update({ break_minutes: newBreakTotal, updated_at: now.toISOString() })
                .eq('id', rec.id);
        }

        setActiveBreak(null);
        activeBreakRef.current = null;
        await doRefreshToday();
    }, []);

    // ─── Heartbeat & Session Helpers ──────────────────────────────────────────

    const sendHeartbeat = useCallback(async () => {
        const sid = sessionIdRef.current;
        const uid = userRef.current?.id;
        const rec = todayRecordRef.current;
        if (!sid || !sessionStartRef.current || !uid) return;

        try {
            const duration = Math.floor((Date.now() - sessionStartRef.current.getTime()) / 60000);

            await supabase
                .from('attendance_sessions')
                .update({ last_seen: nowISO(), duration_minutes: duration })
                .eq('id', sid);

            const { data: sessions } = await supabase
                .from('attendance_sessions')
                .select('id, duration_minutes')
                .eq('user_id', uid)
                .eq('date', todayDate());

            const completedDB = (sessions ?? [])
                .filter(s => s.id !== sid)
                .reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
            setDbSessionMinutes(completedDB);
            setTodaySessionMinutes(completedDB + duration);

            if (rec) {
                await supabase
                    .from('attendance_records')
                    .update({ total_session_minutes: completedDB + duration })
                    .eq('id', rec.id);
            }
        } catch (err) {
            console.error('Exception in sendHeartbeat:', err);
        }
    }, []);

    const startSession = async (uid: string): Promise<string | null> => {
        sessionStartRef.current = new Date();
        const today = todayDate();
        try {
            const { data, error } = await supabase
                .from('attendance_sessions')
                .insert({ user_id: uid, date: today })
                .select()
                .single();

            if (!error && data) {
                sessionIdRef.current = data.id;
                setSessionId(data.id);
                return data.id;
            }
        } catch (err) {
            console.error('Exception in startSession:', err);
        }
        return null;
    };

    // ─── Lifecycle Init ───────────────────────────────────────────────────────

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        if (initDoneRef.current) return;

        // Verify that user is staff/admin/owner
        const role = profile?.role;
        const isEligible = isAdmin || isStaff || isOwner || role === 'admin' || role === 'staff' || role === 'owner';
        
        if (!isEligible && profile) {
            setLoading(false);
            return;
        }

        initDoneRef.current = true;

        const init = async () => {
            try {
                // Step 1: fetch shift
                const resolvedShift = await doFetchShift();

                // Step 2: fetch today's attendance record
                const { record: resolvedRecord, isOnLeave } = await doRefreshToday();

                // Step 3: auto clock-in on login if not on leave and not yet clocked in
                if (resolvedShift && !isOnLeave && !resolvedRecord?.clock_in) {
                    const result = await doClockIn(resolvedShift, resolvedRecord);
                    if (result.error) {
                        console.warn('Auto clock-in notice:', result.error);
                    }
                }

                // Step 4: start active system session
                await startSession(userRef.current!.id);
            } catch (err) {
                console.error('Error in attendance init:', err);
            } finally {
                setLoading(false);
            }
        };

        init();

        // Heartbeat every 3 minutes
        heartbeatRef.current = setInterval(sendHeartbeat, 3 * 60 * 1000);

        const handleUnload = () => {
            const sid = sessionIdRef.current;
            if (!sid || !sessionStartRef.current) return;
            const duration = Math.floor((Date.now() - sessionStartRef.current.getTime()) / 60000);
            supabase
                .from('attendance_sessions')
                .update({ session_end: nowISO(), duration_minutes: duration, is_active: false })
                .eq('id', sid);
        };
        window.addEventListener('beforeunload', handleUnload);

        return () => {
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            window.removeEventListener('beforeunload', handleUnload);
        };
    }, [user, profile, isAdmin, isStaff, isOwner]);

    // Reset when user logs out
    useEffect(() => {
        if (!user) {
            initDoneRef.current = false;
            sessionIdRef.current = null;
            sessionStartRef.current = null;
            shiftRef.current = DEFAULT_SHIFT;
            todayRecordRef.current = null;
            activeBreakRef.current = null;
        }
    }, [user]);

    // Live update of session minutes every 10s
    useEffect(() => {
        const updateLiveMins = () => {
            const liveMins = sessionStartRef.current
                ? Math.floor((Date.now() - sessionStartRef.current.getTime()) / 60000)
                : 0;
            setTodaySessionMinutes(dbSessionMinutes + liveMins);
        };

        updateLiveMins();
        const id = setInterval(updateLiveMins, 10000);
        return () => clearInterval(id);
    }, [dbSessionMinutes]);

    const isClocked = !!todayRecord?.clock_in && !todayRecord?.clock_out;
    const isOnBreak = !!activeBreak;

    return (
        <AttendanceContext.Provider value={{
            todayRecord,
            todayBreaks,
            activeBreak,
            sessionId,
            isClocked,
            isOnBreak,
            shift,
            loading,
            clockIn,
            clockOut,
            startBreak,
            endBreak,
            refreshToday,
            todaySessionMinutes,
        }}>
            {children}
        </AttendanceContext.Provider>
    );
};

export const useAttendance = () => useContext(AttendanceContext);
