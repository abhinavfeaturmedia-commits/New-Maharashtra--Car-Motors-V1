import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
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
    const { isAdmin, isStaff, isOwner, profile } = useAuth();
    const {
        todayRecord, isClocked, isOnBreak, activeBreak,
        loading, clockIn, clockOut, startBreak, endBreak,
        todaySessionMinutes, shift
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
        const id = setInterval(compute, 30000);
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

    const role = profile?.role;
    const isEligible = isAdmin || isStaff || isOwner || role === 'admin' || role === 'staff' || role === 'owner';
    if (!isEligible) return null;

    if (loading) {
        return (
            <div className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold">
                <span className="size-2 rounded-full bg-slate-300 animate-pulse" />
                <span className="hidden lg:inline">Attendance…</span>
            </div>
        );
    }

    const handleClockIn = async () => {
        setBusy(true); 
        setError('');
        const { error: e } = await clockIn();
        if (e) {
            setError(e);
        } else {
            setShowPanel(false);
        }
        setBusy(false);
    };

    const handleClockOut = async () => {
        if (!window.confirm('Are you sure you want to clock out for today?')) return;
        setBusy(true); 
        setError('');
        const { error: e } = await clockOut();
        if (e) {
            setError(e);
        } else {
            setShowPanel(false);
        }
        setBusy(false);
    };

    const handleBreak = async (type: 'lunch' | 'short' | 'personal') => {
        setShowBreakMenu(false);
        await startBreak(type);
    };

    // Status formatting
    const statusColor = !isClocked
        ? todayRecord?.clock_out
            ? 'bg-slate-100 text-slate-600 border border-slate-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
        : isOnBreak
        ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
        : todayRecord?.is_late
        ? 'bg-orange-50 text-orange-700 border border-orange-200'
        : 'bg-green-50 text-green-700 border border-green-200';

    const statusDot = !isClocked
        ? todayRecord?.clock_out ? 'bg-slate-400' : 'bg-amber-500 animate-pulse'
        : isOnBreak
        ? 'bg-yellow-500 animate-pulse'
        : 'bg-green-500 animate-pulse';

    const statusLabel = !isClocked
        ? todayRecord?.clock_out ? 'Clocked Out' : 'Clock In'
        : isOnBreak
        ? 'On Break'
        : todayRecord?.is_late
        ? 'Late'
        : 'Present';

    return (
        <div className="relative" ref={panelRef}>
            {/* ── Trigger Button in Header ── */}
            <button
                onClick={() => setShowPanel(v => !v)}
                className={`hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl transition-all text-xs font-bold shadow-xs cursor-pointer ${statusColor}`}
                title="Click to manage attendance"
            >
                <span className={`size-2 rounded-full shrink-0 ${statusDot}`} />
                <span className="hidden lg:inline">{statusLabel}</span>
                {isClocked && !isOnBreak && todayRecord?.clock_in && (
                    <span className="font-mono text-[11px] opacity-75">
                        {new Date(todayRecord.clock_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                )}
            </button>

            {/* ── Dropdown Panel ── */}
            {showPanel && (
                <div className="absolute right-0 top-full mt-2 w-84 bg-white rounded-3xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
                    {/* Header Banner */}
                    <div className={`px-5 py-4 ${isClocked ? 'bg-gradient-to-r from-emerald-600 to-green-600' : 'bg-gradient-to-r from-slate-800 to-slate-900'} text-white`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="size-9 rounded-xl bg-white/20 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white text-lg">schedule</span>
                                </div>
                                <div>
                                    <p className="font-bold text-sm">Attendance</p>
                                    <p className="text-white/70 text-[11px]">
                                        {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-mono text-base font-black">{formatTime(now)}</p>
                                <p className="text-white/70 text-[10px]">
                                    Shift: {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 space-y-3.5">
                        {/* Status Strip Metrics */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
                                <p className="text-xs font-black text-primary truncate">
                                    {todayRecord?.clock_in
                                        ? new Date(todayRecord.clock_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                                        : '—'}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Clock In</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
                                <p className="text-xs font-black text-emerald-600 truncate">
                                    {isClocked && !todayRecord?.clock_out
                                        ? formatDuration(workedMins)
                                        : todayRecord?.total_hours_worked
                                        ? `${todayRecord.total_hours_worked}h`
                                        : '—'}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Worked</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
                                <p className="text-xs font-black text-blue-600 truncate">
                                    {formatDuration(todaySessionMinutes)}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">System</p>
                            </div>
                        </div>

                        {/* Error Notification */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm shrink-0">error</span>
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Break Info Banner */}
                        {isOnBreak && activeBreak && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-amber-500 text-base">coffee</span>
                                    <span className="text-xs font-bold text-amber-800 capitalize">
                                        {activeBreak.break_type} break in progress
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* ── NOT CLOCKED IN STATE: Show Clock In Button ── */}
                        {!isClocked && !todayRecord?.clock_out && (
                            <div className="space-y-2">
                                <button
                                    onClick={handleClockIn}
                                    disabled={busy}
                                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-60 cursor-pointer"
                                >
                                    {busy ? (
                                        <>
                                            <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Clocking In…
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-lg">login</span>
                                            Clock In for Today
                                        </>
                                    )}
                                </button>
                                <p className="text-[11px] text-slate-400 text-center font-medium">
                                    Standard shift: {shift.start_time.slice(0, 5)} to {shift.end_time.slice(0, 5)}
                                </p>
                            </div>
                        )}

                        {/* ── CLOCKED IN STATE: Show Break and Clock Out controls ── */}
                        {isClocked && (
                            <div className="space-y-2">
                                {/* Break controls */}
                                {!isOnBreak ? (
                                    <div className="relative" ref={breakMenuRef}>
                                        <button
                                            onClick={() => setShowBreakMenu(v => !v)}
                                            className="w-full h-10 border border-amber-200 text-amber-700 bg-amber-50 font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-amber-100 transition-colors cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-base">coffee</span>
                                            Start Break
                                        </button>
                                        {showBreakMenu && (
                                            <div className="absolute bottom-full mb-1.5 left-0 right-0 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-10 p-1">
                                                {(['lunch', 'short', 'personal'] as const).map(type => (
                                                    <button 
                                                        key={type}
                                                        onClick={() => handleBreak(type)}
                                                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 capitalize font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <span>{type === 'lunch' ? '🍱' : type === 'short' ? '☕' : '🚶'}</span>
                                                        <span>{type} Break</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={endBreak}
                                        className="w-full h-10 border border-amber-300 text-amber-800 bg-amber-100 font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-amber-200 transition-colors cursor-pointer shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-base">play_arrow</span>
                                        Resume Work
                                    </button>
                                )}

                                {/* Clock Out Button */}
                                <button
                                    onClick={handleClockOut}
                                    disabled={busy}
                                    className="w-full h-10 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
                                >
                                    {busy ? (
                                        <>
                                            <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Clocking out…
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-base">logout</span>
                                            Clock Out
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* ── ALREADY CLOCKED OUT STATE ── */}
                        {todayRecord?.clock_out && (
                            <div className="space-y-2">
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-emerald-600 text-base shrink-0">check_circle</span>
                                    <span className="text-xs text-slate-600 font-medium">
                                        Clocked out at {new Date(todayRecord.clock_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} ({todayRecord.total_hours_worked}h worked)
                                    </span>
                                </div>
                                <button
                                    onClick={handleClockIn}
                                    disabled={busy}
                                    className="w-full h-9 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                    Clock In Again
                                </button>
                            </div>
                        )}

                        {/* Footer link to Full Attendance Page */}
                        <div className="pt-2 border-t border-slate-100">
                            <Link
                                to="/admin/attendance"
                                onClick={() => setShowPanel(false)}
                                className="flex items-center justify-center gap-1.5 text-xs font-bold text-primary hover:text-primary-light transition-colors py-1"
                            >
                                <span>Open Full Attendance Roster</span>
                                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceClockWidget;
