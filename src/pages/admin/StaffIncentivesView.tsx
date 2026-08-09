import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const TYPES = [
  { value: 'bonus', label: 'Bonus', color: 'bg-green-100 text-green-700' },
  { value: 'commission', label: 'Commission', color: 'bg-blue-100 text-blue-700' },
  { value: 'award', label: 'Award', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'milestone', label: 'Milestone', color: 'bg-purple-100 text-purple-700' },
  { value: 'festival_bonus', label: 'Festival Bonus', color: 'bg-orange-100 text-orange-700' },
  { value: 'target_achievement', label: 'Target Achievement', color: 'bg-red-100 text-red-700' },
  { value: 'customer_rating', label: 'Customer Rating', color: 'bg-pink-100 text-pink-700' },
  { value: 'attendance', label: 'Attendance', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'performance', label: 'Performance', color: 'bg-indigo-100 text-indigo-700' },
];

const PERIODS = [
  { label: 'This Month', days: 30 },
  { label: '90 Days', days: 90 },
  { label: '6 Months', days: 180 },
  { label: 'This Year', days: 365 },
  { label: 'All Time', days: 0 },
];

const PRIORITY_STYLES: Record<string, { bg: string; border: string; badge: string; icon: string }> = {
  normal:      { bg: 'bg-slate-50',    border: 'border-slate-200', badge: 'bg-slate-100 text-slate-600',   icon: 'info' },
  urgent:      { bg: 'bg-red-50',      border: 'border-red-200',   badge: 'bg-red-100 text-red-700',       icon: 'warning' },
  celebration: { bg: 'bg-yellow-50',   border: 'border-yellow-200',badge: 'bg-yellow-100 text-yellow-700', icon: 'celebration' },
};

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const typeInfo = (t: string) => TYPES.find(x => x.value === t) ?? TYPES[0];
const medals = ['🥇', '🥈', '🥉'];

interface Incentive {
  id: string; staff_id: string; amount: number; reason: string;
  incentive_type: string; month: string; notes: string | null; created_at: string;
  staff: { full_name: string | null } | null;
}
interface Announcement {
  id: string; title: string; body: string; priority: string;
  is_pinned: boolean; created_at: string; expires_at: string | null;
  creator: { full_name: string | null } | null;
}

export default function StaffIncentivesView() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'mine' | 'leaderboard'>('mine');
  const [incentives, setIncentives] = useState<Incentive[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(0);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: inc }, { data: ann }] = await Promise.all([
      supabase.from('staff_incentives')
        .select('*, staff:profiles!staff_id(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('staff_announcements')
        .select('*, creator:profiles!created_by(full_name)')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);
    setIncentives((inc as Incentive[]) ?? []);
    setAnnouncements((ann as Announcement[]) ?? []);
    setLoading(false);
  }, []);

  // ── New announcement flash badge state ─────────────────────────────────────────────
  const [newAnnFlash, setNewAnnFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerFlash = () => {
    setNewAnnFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setNewAnnFlash(false), 8000);
  };

  // Initial load
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Realtime: auto-refresh when incentives change ───────────────────────────────
  useEffect(() => {
    if (!user) return;

    const incChannel = supabase
      .channel('staff_incentives_view_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'staff_incentives',
      }, () => { fetchAll(); })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'staff_incentives',
      }, () => { fetchAll(); })
      .subscribe();

    return () => { supabase.removeChannel(incChannel); };
  }, [user, fetchAll]);

  // ── Realtime: auto-refresh when announcements change (+ flash badge) ───────────
  useEffect(() => {
    if (!user) return;

    const annChannel = supabase
      .channel('staff_announcements_view_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'staff_announcements',
      }, () => { fetchAll(); triggerFlash(); })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'staff_announcements',
      }, () => { fetchAll(); })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'staff_announcements',
      }, () => { fetchAll(); })
      .subscribe();

    return () => { supabase.removeChannel(annChannel); };
  }, [user, fetchAll]);

  // ── Period filter ────────────────────────────────────────────────────────
  const filtered = (() => {
    const days = PERIODS[period].days;
    if (!days) return incentives;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    return incentives.filter(i => new Date(i.created_at) >= cutoff);
  })();

  // ── My own incentives ────────────────────────────────────────────────────
  const myIncentives = filtered.filter(i => i.staff_id === user?.id);
  const myTotal = myIncentives.reduce((s, i) => s + Number(i.amount), 0);

  // ── Leaderboard ──────────────────────────────────────────────────────────
  const leaderboard = (() => {
    const map: Record<string, { name: string; total: number; count: number; isMe: boolean }> = {};
    filtered.forEach(i => {
      const name = i.staff?.full_name ?? 'Unknown';
      if (!map[i.staff_id]) map[i.staff_id] = { name, total: 0, count: 0, isMe: i.staff_id === user?.id };
      map[i.staff_id].total += Number(i.amount);
      map[i.staff_id].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  })();

  const myRank = leaderboard.findIndex(x => x.isMe) + 1;

  // ── Today's announcements ────────────────────────────────────────────────
  const today = new Date().toDateString();
  const todayAnn = announcements.filter(a => new Date(a.created_at).toDateString() === today);
  const pinnedAnn = announcements.filter(a => a.is_pinned);
  const visibleAnn = [...new Map([...pinnedAnn, ...todayAnn].map(a => [a.id, a])).values()];

  if (loading) return (
    <div className="py-20 flex items-center justify-center">
      <span className="size-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-primary font-display">My Incentives</h1>
            <p className="text-slate-500 text-sm mt-0.5">Your earnings, team leaderboard, and today's announcements.</p>
          </div>
          {/* Live new-announcement flash badge */}
          {newAnnFlash && (
            <button
              onClick={() => { setNewAnnFlash(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex items-center gap-2 bg-amber-500 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-lg animate-pulse hover:animate-none hover:bg-amber-600 transition-all"
            >
              <span className="material-symbols-outlined text-sm">campaign</span>
              🔔 New Announcement!
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Today's Announcements Banner */}
      {visibleAnn.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-amber-500">campaign</span>
            Today's Announcements
          </p>
          {visibleAnn.map(a => {
            const ps = PRIORITY_STYLES[a.priority] ?? PRIORITY_STYLES.normal;
            return (
              <div key={a.id} className={`${ps.bg} border ${ps.border} rounded-2xl p-4`}>
                <div className="flex items-start gap-3">
                  <div className={`size-9 rounded-xl flex items-center justify-center ${ps.badge} shrink-0`}>
                    <span className="material-symbols-outlined text-lg">{ps.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      {a.is_pinned && <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">📌 Pinned</span>}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ps.badge} uppercase`}>{a.priority}</span>
                    </div>
                    <p className="font-bold text-slate-800">{a.title}</p>
                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{a.body}</p>
                    <p className="text-[10px] text-slate-400 mt-2">
                      Posted by {a.creator?.full_name ?? 'Admin'} · {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* My Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-5">
          <div className="size-10 bg-green-50 rounded-xl flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-green-600">payments</span>
          </div>
          <p className="text-2xl font-black text-primary font-display">{fmt(myTotal)}</p>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Total Earned</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-5">
          <div className="size-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-blue-600">workspace_premium</span>
          </div>
          <p className="text-2xl font-black text-primary font-display">{myIncentives.length}</p>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Incentives Received</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-5">
          <div className="size-10 bg-purple-50 rounded-xl flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-purple-600">leaderboard</span>
          </div>
          <p className="text-2xl font-black text-primary font-display">{myRank > 0 ? `#${myRank}` : '—'}</p>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Team Ranking</p>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex gap-2 flex-wrap">
        {PERIODS.map((p, i) => (
          <button key={p.label} onClick={() => setPeriod(i)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${period === i ? 'bg-primary text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:border-primary/30'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('mine')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'mine' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          💰 My Incentives
        </button>
        <button onClick={() => setTab('leaderboard')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'leaderboard' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          🏆 Team Leaderboard
        </button>
      </div>

      {/* ── MY INCENTIVES ── */}
      {tab === 'mine' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
          {myIncentives.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="size-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl text-slate-300">workspace_premium</span>
              </div>
              <p className="text-slate-500 font-semibold">No incentives for this period</p>
              <p className="text-xs text-slate-400 mt-1">Keep up the great work!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                    <th className="text-left px-5 py-3">Type</th>
                    <th className="text-left px-5 py-3">Reason</th>
                    <th className="text-left px-5 py-3">Month</th>
                    <th className="text-right px-5 py-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {myIncentives.map(inc => {
                    const ti = typeInfo(inc.incentive_type);
                    return (
                      <tr key={inc.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${ti.color}`}>{ti.label}</span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-700">{inc.reason}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">{inc.month}</td>
                        <td className="px-5 py-3.5 text-right font-black text-green-600 text-base">{fmt(inc.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50">
                    <td colSpan={3} className="px-5 py-3 text-sm font-bold text-slate-600">Total</td>
                    <td className="px-5 py-3 text-right font-black text-green-700 text-lg">{fmt(myTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── LEADERBOARD ── */}
      {tab === 'leaderboard' && (
        <div className="space-y-3">
          {leaderboard.length === 0 ? (
            <div className="py-16 text-center text-slate-400">No data for this period.</div>
          ) : leaderboard.map((s, i) => (
            <div key={s.name}
              className={`rounded-2xl border p-4 flex items-center gap-4 shadow-[var(--shadow-card)] transition-all
                ${s.isMe ? 'border-primary bg-primary/5 ring-2 ring-primary/20' :
                  i === 0 ? 'bg-yellow-50/40 border-yellow-200' :
                  i === 1 ? 'bg-white border-slate-200' :
                  i === 2 ? 'bg-orange-50/30 border-orange-100' :
                  'bg-white border-slate-100'}`}>
              <div className={`size-12 rounded-xl flex items-center justify-center text-2xl font-black
                ${i === 0 ? 'bg-yellow-100' : i === 1 ? 'bg-slate-100' : i === 2 ? 'bg-orange-100' : 'bg-slate-50'}`}>
                {medals[i] ?? `#${i + 1}`}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-primary">{s.name}</p>
                  {s.isMe && <span className="text-[10px] bg-primary text-white font-bold px-2 py-0.5 rounded-full">You</span>}
                </div>
                <p className="text-xs text-slate-400">{s.count} incentive{s.count !== 1 ? 's' : ''} received</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-green-600">{fmt(s.total)}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total Earned</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
