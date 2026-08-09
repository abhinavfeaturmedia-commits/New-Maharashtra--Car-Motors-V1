import React, { useState, useEffect, useRef } from 'react';
import { useAttendance } from '../../contexts/AttendanceContext';
import { useAuth } from '../../contexts/AuthContext';

// ─── Live clock display ───────────────────────────────────────────────────────

const useLiveClock = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    return time;
};

const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
};

// ─── Component ───────────────────────────────────────────────────────────────

const AttendanceClockWidget: React.FC = () => {
    const { isAdmin, isStaff } = useAuth();
    const {
        todayRecord, isClocked, isOnBreak, activeBreak,
        loading, clockIn, clockOut, startBreak, endBreak,
        todaySessionMinutes,
    } = useAttendance();

    const now = useLiveClock();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [showBreakMenu, setShowBreakMenu] = useState(false);
    const [showPanel, setShowPanel] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const breakMenuRef = useRef<HTMLDivElement>(null);

    // Live worked time counter
    const [workedMins, setWorkedMins] = useState(0);
    useEffect(() => {
        if (!todayRecord?.clock_in || todayRecord?.clock_out) return;
        const compute = () => {
            const ms = Date.now() - new Date(todayRecord.clock_in!).getTime();
            const breakMs = (todayRecord.break_minutes ?? 0) * 60000;
            setWorkedMins(Math.max(0, Math.floor((ms - breakMs) / 60000)));
        };
        compute();
        const id = setInterval(compute, 60000);
        return () => clearInterval(id);
    }, [todayRecord]);

    // Close panel on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setShowPanel(false);
            }
            if (breakMenuRef.current && !breakMenuRef.current.contains(e.target as Node)) {
                setShowBreakMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    if (!isAdmin && !isStaff) return null;
    // Show a minimal pill while auto clock-in is processing
    if (loading) return (
        <div className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold">
            <span className="size-2 rounded-full bg-slate-300 animate-pulse" />
            <span className="hidden lg:inline">Checking in…</span>
        </div>
    );

    const handleClockIn = async () => {
        setBusy(true); setError('');
        const { error: e } = await clockIn();
        if (e) setError(e);
        setBusy(false);
    };

    const handleClockOut = async () => {
        setBusy(true); setError('');
        const { error: e } = await clockOut();
        if (e) setError(e);
        setBusy(false);
        setShowPanel(false);
    };

    const handleBreak = async (type: 'lunch' | 'short' | 'personal') => {
        setShowBreakMenu(false);
        await startBreak(type);
    };

    const statusColor = !isClocked
        ? 'bg-slate-100 text-slate-500'
        : isOnBreak
        ? 'bg-amber-50 text-amber-600 border border-amber-200'
        : todayRecord?.is_late
        ? 'bg-orange-50 text-orange-600 border border-orange-200'
        : 'bg-green-50 text-green-600 border border-green-200';

    const statusDot = !isClocked
        ? 'bg-slate-400'
        : isOnBreak
        ? 'bg-amber-400 animate-pulse'
        : 'bg-green-500 animate-pulse';

    const statusLabel = loading
        ? 'Checking in…'
        : !isClocked
        ? 'Not In'
        : isOnBreak
        ? 'On Break'
        : todayRecord?.is_late
        ? 'Late'
        : 'Present';

    return (
        <div className="relative" ref={panelRef}>
            {/* ── Trigger Button ── */}
            <button
                onClick={() => setShowPanel(v => !v)}
                className={`hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl transition-colors text-xs font-bold ${statusColor}`}
                title="Attendance"
            >
                <span className={`size-2 rounded-full shrink-0 ${statusDot}`} />
                <span className="hidden lg:inline">{statusLabel}</span>
                {isClocked && !isOnBreak && (
                    <span className="font-mono text-[11px] opacity-70">
                        {formatTime(now)}
                    </span>
                )}
            </button>

            {/* ── Panel ── */}
            {showPanel && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">

                    {/* Header */}
                    <div className={`px-5 py-4 ${isClocked ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-slate-700 to-slate-800'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-white text-lg">
                                    schedule
                                </span>
                                <div>
                                    <p className="text-white font-bold text-sm">Attendance</p>
                                    <p className="text-white/60 text-[11px]">
                                        {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-white font-mono text-lg font-bold">{formatTime(now)}</p>
                                <p className="text-white/60 text-[11px]">Current Time</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 space-y-3">
                        {/* Status strip */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-slate-50 rounded-xl p-3 text-center">
                                <p className="text-xs font-black text-primary">
                                    {todayRecord?.clock_in
                                        ? new Date(todayRecord.clock_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                                        : '—'}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">Clock In</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3 text-center">
                                <p className="text-xs font-black text-primary">
                                    {isClocked && !todayRecord?.clock_out
                                        ? formatDuration(workedMins)
                                        : todayRecord?.total_hours_worked
                                        ? `${todayRecord.total_hours_worked}h`
                                        : '—'}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">Worked</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3 text-center">
                                <p className="text-xs font-black text-primary">
                                    {formatDuration(todaySessionMinutes)}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">System</p>
                            </div>
                        </div>

                        {/* Break info */}
                        {isOnBreak && activeBreak && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-amber-500 text-sm">coffee</span>
                                    <span className="text-xs font-semibold text-amber-700">
                                        On {activeBreak.break_type} break since {new Date(activeBreak.break_start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">error</span>
                                {error}
                            </div>
                        )}

                        {/* Clock In is now automatic on login — no manual button needed */}


                        {/* Auto clock-in info banner — only show the first time when auto-clocked */}
                        {isClocked && todayRecord?.clock_in && !todayRecord?.admin_note && (
                            <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 flex items-center gap-2">
                                <span className="material-symbols-outlined text-green-500 text-sm">auto_mode</span>
                                <span className="text-xs text-green-700 font-semibold">Auto checked-in on login</span>
                            </div>
                        )}

                        {isClocked && (
                            <div className="space-y-2">
                                {/* Break controls */}
                                {!isOnBreak ? (
                                    <div className="relative" ref={breakMenuRef}>
                                        <button
                                            onClick={() => setShowBreakMenu(v => !v)}
                                            className="w-full h-10 border border-amber-200 text-amber-600 bg-amber-50 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-amber-100 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-lg">coffee</span>
                                            Start Break
                                        </button>
                                        {showBreakMenu && (
                                            <div className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-10">
                                                {(['lunch', 'short', 'personal'] as const).map(type => (
                                                    <button key={type}
                                                        onClick={() => handleBreak(type)}
                                                        className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 capitalize font-medium transition-colors"
                                                    >
                                                        {type === 'lunch' ? '🍱' : type === 'short' ? '☕' : '🚶'} {type} break
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={endBreak}
                                        className="w-full h-10 border border-amber-300 text-amber-700 bg-amber-100 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-amber-200 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-base">play_arrow</span>
                                        Resume Work
                                    </button>
                                )}

                                {/* Clock Out */}
                                <button
                                    onClick={handleClockOut}
                                    disabled={busy}
                                    className="w-full h-11 bg-red-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-red-600 transition-colors shadow-sm disabled:opacity-60"
                                >
                                    {busy
                                        ? <><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Clocking out…</>
                                        : <><span className="material-symbols-outlined text-lg">logout</span> Clock Out</>
                                    }
                                </button>
                            </div>
                        )}

                        {/* Already clocked out today */}
                        {todayRecord?.clock_out && (
                            <div className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400 text-base">check_circle</span>
                                <span className="text-xs text-slate-500 font-medium">
                                    Clocked out at {new Date(todayRecord.clock_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} — {todayRecord.total_hours_worked}h worked
                                </span>
                            </div>
                        )}

                        {/* Footer link */}
                        <a
                            href="/admin/attendance"
                            className="flex items-center justify-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors py-1"
                            onClick={() => setShowPanel(false)}
                        >
                            View Full Attendance
                            <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceClockWidget;
