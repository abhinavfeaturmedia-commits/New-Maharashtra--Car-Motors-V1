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

interface AttendanceContextValue {
    todayRecord: AttendanceRecord | null;
    todayBreaks: AttendanceBreak[];
    activeBreak: AttendanceBreak | null;
    sessionId: string | null;
    isClocked: boolean;
    isOnBreak: boolean;
    shift: ShiftConfig | null;
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
    shift: null,
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
    const [h, m] = t.split(':').map(Number);
    return { hours: h, minutes: m };
};

/** Returns current date's ISO without time */
const nowISO = () => new Date().toISOString();

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, profile, isAdmin, isStaff } = useAuth();

    const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
    const [todayBreaks, setTodayBreaks] = useState<AttendanceBreak[]>([]);
    const [activeBreak, setActiveBreak] = useState<AttendanceBreak | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [shift, setShift] = useState<ShiftConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [todaySessionMinutes, setTodaySessionMinutes] = useState(0);
    const [dbSessionMinutes, setDbSessionMinutes] = useState(0);
    const [isOnLeaveToday, setIsOnLeaveToday] = useState(false);

    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const sessionStartRef = useRef<Date | null>(null);
    const sessionIdRef = useRef<string | null>(null); // Always-fresh sessionId ref

    // ─── KEY FIX: Refs that always hold the LATEST values ─────────────────────
    // These are updated in sync with state changes, so async callbacks always
    // read fresh data without depending on useCallback closure staleness.
    const userRef = useRef(user);
    const profileRef = useRef(profile);
    const shiftRef = useRef<ShiftConfig | null>(null);
    const todayRecordRef = useRef<AttendanceRecord | null>(null);
    const activeBreakRef = useRef<AttendanceBreak | null>(null);

    // Keep refs in sync with state / props on every render
    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { profileRef.current = profile; }, [profile]);
    useEffect(() => { activeBreakRef.current = activeBreak; }, [activeBreak]);

    // Guard: init runs exactly once per user session
    const initDoneRef = useRef(false);

    const isEligible = isAdmin || isStaff;

    // ─── Core async helpers (no useCallback — they read from refs) ────────────

    /**
     * Fetches the applicable shift using the CURRENT profile ref.
     * Returns the shift directly so callers don't need to wait for state.
     */
    const doFetchShift = async (): Promise<ShiftConfig | null> => {
        const prof = profileRef.current;
        if (!prof) return null;

        try {
            const orConditions = [`user_id.eq.${prof.id}`, `is_default.eq.true`];
            if (prof.department) {
                orConditions.push(`department.eq.${prof.department}`);
            }

            const { data, error } = await supabase
                .from('shift_config')
                .select('*')
                .or(orConditions.join(','));

            if (error) {
                console.error('doFetchShift error:', error);
                return null;
            }

            if (data && data.length > 0) {
                const sorted = [...data].sort((a, b) => {
                    if (a.user_id === prof.id) return -1;
                    if (b.user_id === prof.id) return 1;
                    if (prof.department && a.department === prof.department) return -1;
                    if (prof.department && b.department === prof.department) return 1;
                    return a.is_default ? 1 : -1;
                });
                const resolved = sorted[0] as ShiftConfig;
                setShift(resolved);
                shiftRef.current = resolved;
                return resolved;
            }
            return null;
        } catch (err) {
            console.error('Exception in doFetchShift:', err);
            return null;
        }
    };

    /**
     * Fetches today's record using the CURRENT user ref.
     * Returns { record, isOnLeave } directly.
     */
    const doRefreshToday = async (): Promise<{ record: AttendanceRecord | null; isOnLeave: boolean }> => {
        const uid = userRef.current?.id;
        if (!uid) { setLoading(false); return { record: null, isOnLeave: false }; }

        try {
            const today = todayDate();

            // Fetch today's attendance record
            const { data: record, error: recError } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('user_id', uid)
                .eq('date', today)
                .maybeSingle();

            if (recError) console.error('doRefreshToday record error:', recError);

            const resolvedRecord = record as AttendanceRecord | null;
            setTodayRecord(resolvedRecord);
            todayRecordRef.current = resolvedRecord;

            // Fetch breaks if record exists
            if (resolvedRecord) {
                const { data: breaks, error: breakError } = await supabase
                    .from('attendance_breaks')
                    .select('*')
                    .eq('record_id', resolvedRecord.id)
                    .order('break_start', { ascending: true });

                if (breakError) console.error('doRefreshToday breaks error:', breakError);

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

            // Check approved leave for today
            let isOnLeave = false;
            const { data: leaves, error: leaveError } = await supabase
                .from('leave_requests')
                .select('id')
                .eq('user_id', uid)
                .eq('status', 'approved')
                .lte('start_date', today)
                .gte('end_date', today)
                .limit(1);

            if (leaveError) console.error('doRefreshToday leave error:', leaveError);
            if (leaves && leaves.length > 0) isOnLeave = true;
            setIsOnLeaveToday(isOnLeave);

            // Fetch session totals
            const { data: sessions, error: sessionError } = await supabase
                .from('attendance_sessions')
                .select('id, duration_minutes')
                .eq('user_id', uid)
                .eq('date', today);

            if (sessionError) console.error('doRefreshToday sessions error:', sessionError);

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
     * Performs the clock-in DB write with freshly-supplied data.
     * Uses shiftCfg and existingRecord passed directly — no stale closures.
     */
    const doClockIn = async (
        shiftCfg: ShiftConfig,
        existingRecord: AttendanceRecord | null
    ): Promise<{ error?: string }> => {
        const uid = userRef.current?.id;
        if (!uid) return { error: 'Not authenticated.' };
        // Idempotent: already clocked in
        if (existingRecord?.clock_in) return {};

        try {
            const now = new Date();
            const today = todayDate();

            const { hours: sh, minutes: sm } = parseTime(shiftCfg.start_time);
            const shiftStartMs = sh * 60 + sm;
            const nowMs = now.getHours() * 60 + now.getMinutes();
            const isLate = nowMs > shiftStartMs + shiftCfg.late_threshold;
            const status: AttendanceRecord['status'] = isLate ? 'late' : 'present';

            const { data, error } = await supabase
                .from('attendance_records')
                .upsert({
                    user_id: uid,
                    date: today,
                    clock_in: now.toISOString(),
                    status,
                    is_late: isLate,
                    shift_id: shiftCfg.id,
                }, { onConflict: 'user_id,date' })
                .select()
                .single();

            if (error) {
                console.error('doClockIn DB error:', error);
                return { error: error.message };
            }

            const newRecord = data as AttendanceRecord;
            setTodayRecord(newRecord);
            todayRecordRef.current = newRecord;

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
    // These use refs so they always have fresh data, regardless of render cycle.

    const refreshToday = useCallback(
        () => doRefreshToday(),
        [] // eslint-disable-line react-hooks/exhaustive-deps
    );

    const clockIn = useCallback(async (): Promise<{ error?: string }> => {
        const currentShift = shiftRef.current;
        const currentRecord = todayRecordRef.current;
        if (!userRef.current || !currentShift) {
            return { error: 'Not authenticated or shift not loaded.' };
        }
        return doClockIn(currentShift, currentRecord);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const clockOut = useCallback(async (): Promise<{ error?: string }> => {
        const uid = userRef.current?.id;
        const rec = todayRecordRef.current;
        const currentShift = shiftRef.current;

        if (!uid || !rec) return { error: 'No clock-in record found.' };
        if (rec.clock_out) return { error: 'Already clocked out today.' };
        if (!currentShift) return { error: 'Shift configuration not loaded.' };

        try {
            const now = new Date();
            const clockInTime = new Date(rec.clock_in!);
            const totalMs = now.getTime() - clockInTime.getTime();
            const breakMs = (rec.break_minutes ?? 0) * 60000;
            const workedMs = Math.max(0, totalMs - breakMs);
            const hoursWorked = workedMs / 3600000;

            const { hours: eh, minutes: em } = parseTime(currentShift.end_time);
            const shiftEnd = new Date(clockInTime);
            shiftEnd.setHours(eh, em, 0, 0);
            if (shiftEnd < clockInTime) shiftEnd.setDate(shiftEnd.getDate() + 1);

            const overtimeMins = Math.floor(Math.max(0, now.getTime() - shiftEnd.getTime()) / 60000);
            const isEarlyDeparture = now.getTime() < (shiftEnd.getTime() - 15 * 60 * 1000);

            let status: AttendanceRecord['status'] = rec.status;
            if (hoursWorked < currentShift.half_day_hours) status = 'half_day';

            // Final cumulative session minutes
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
                    total_hours_worked: Math.round(hoursWorked * 100) / 100,
                    overtime_minutes: overtimeMins,
                    is_early_departure: isEarlyDeparture,
                    status,
                    total_session_minutes: finalSessionMinutes,
                })
                .eq('id', rec.id);

            if (error) return { error: error.message };

            // Close any open break
            if (activeBreakRef.current) await endBreak();

            // End session
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
                    details: `Clocked out at ${now.toLocaleTimeString('en-IN')} — ${hoursWorked.toFixed(2)}h worked`,
                });
            } catch { /* non-critical */ }

            return {};
        } catch (err: any) {
            console.error('Exception in clockOut:', err);
            return { error: err.message || 'An unexpected error occurred during clock-out.' };
        }
    }, [todaySessionMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

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
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const endBreak = useCallback(async () => {
        const ab = activeBreakRef.current;
        const rec = todayRecordRef.current;
        if (!ab) return;

        const now = new Date();
        const start = new Date(ab.break_start);
        const durationMins = Math.round((now.getTime() - start.getTime()) / 60000);

        await supabase
            .from('attendance_breaks')
            .update({ break_end: now.toISOString(), duration_minutes: durationMins })
            .eq('id', ab.id);

        if (rec) {
            const newBreakTotal = (rec.break_minutes ?? 0) + durationMins;
            await supabase
                .from('attendance_records')
                .update({ break_minutes: newBreakTotal })
                .eq('id', rec.id);
        }

        setActiveBreak(null);
        activeBreakRef.current = null;
        await doRefreshToday();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const startSession = async (uid: string): Promise<string | null> => {
        sessionStartRef.current = new Date();
        const today = todayDate();
        try {
            const { data, error } = await supabase
                .from('attendance_sessions')
                .insert({ user_id: uid, date: today })
                .select()
                .single();

            if (error) {
                console.error('startSession insert error:', error);
                return null;
            }
            if (data) {
                sessionIdRef.current = data.id;
                setSessionId(data.id);
                return data.id;
            }
        } catch (err) {
            console.error('Exception in startSession:', err);
        }
        return null;
    };

    // ─── Lifecycle: ONE effect, runs once per user login ─────────────────────
    // The key insight: we read profile/user from REFS inside the async init()
    // so there is zero stale-closure risk, regardless of React render timing.

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        // Prevent double-fire (StrictMode, re-renders, etc.)
        if (initDoneRef.current) return;

        // Wait until profile is actually loaded (isAdmin/isStaff come from profile)
        // If profile is null but user is set, this effect will re-run when profile loads
        if (!isAdmin && !isStaff) {
            setLoading(false);
            return;
        }

        initDoneRef.current = true;

        const init = async () => {
            try {
                // Step 1: fetch shift — reads profileRef.current (always fresh)
                const resolvedShift = await doFetchShift();

                // Step 2: fetch today's record — reads userRef.current (always fresh)
                const { record: resolvedRecord, isOnLeave } = await doRefreshToday();

                // Step 3: auto clock-in with freshly-fetched data
                if (resolvedShift && !isOnLeave && !resolvedRecord?.clock_in) {
                    const result = await doClockIn(resolvedShift, resolvedRecord);
                    if (result.error) {
                        console.warn('Auto clock-in failed:', result.error);
                    }
                }

                // Step 4: start system-time session
                await startSession(userRef.current!.id);
            } catch (err) {
                console.error('Error in attendance init:', err);
                setLoading(false);
            }
        };

        init();

        // Heartbeat every 5 minutes
        heartbeatRef.current = setInterval(sendHeartbeat, 5 * 60 * 1000);

        const handleUnload = () => {
            const sid = sessionIdRef.current;
            if (!sid || !sessionStartRef.current) return;
            const duration = Math.floor((Date.now() - sessionStartRef.current.getTime()) / 60000);
            // Use sendBeacon for reliability on page close
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
    }, [user, isAdmin, isStaff]); // Re-runs when profile loads (isAdmin/isStaff change)

    // Reset initDoneRef when user changes (logout → login as different user)
    useEffect(() => {
        if (!user) {
            initDoneRef.current = false;
            sessionIdRef.current = null;
            sessionStartRef.current = null;
            shiftRef.current = null;
            todayRecordRef.current = null;
            activeBreakRef.current = null;
        }
    }, [user]);

    // Live update of todaySessionMinutes every 10s
    useEffect(() => {
        const updateLiveMins = () => {
            const liveMins = sessionStartRef.current
                ? Math.floor((Date.now() - sessionStartRef.current.getTime()) / 60000)
                : 0;
            setTodaySessionMinutes(prev => {
                const base = dbSessionMinutes;
                return base + liveMins;
            });
        };

        updateLiveMins();
        const id = setInterval(updateLiveMins, 10000);
        return () => clearInterval(id);
    }, [dbSessionMinutes]);

    // Re-register heartbeat when sessionId updates
    useEffect(() => {
        const sid = sessionId;
        if (!sid) return;
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(sendHeartbeat, 5 * 60 * 1000);
        return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
    }, [sessionId, sendHeartbeat]);

    // ─── Derived ──────────────────────────────────────────────────────────────

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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAttendance = () => useContext(AttendanceContext);
