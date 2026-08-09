import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

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

const PRIORITIES = [
  { value: 'normal', label: 'Normal', color: 'bg-slate-100 text-slate-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' },
  { value: 'celebration', label: 'Celebration 🎉', color: 'bg-yellow-100 text-yellow-700' },
];

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const typeInfo = (t: string) => TYPES.find(x => x.value === t) ?? TYPES[0];

interface Incentive {
  id: string; staff_id: string; amount: number; reason: string;
  incentive_type: string; month: string; notes: string | null; created_at: string;
  staff: { full_name: string | null; department: string | null } | null;
}
interface Announcement {
  id: string; title: string; body: string; priority: string;
  is_pinned: boolean; created_at: string; expires_at: string | null;
  creator: { full_name: string | null } | null;
}
interface Staff { id: string; full_name: string | null; department: string | null; }

const emptyInc = { staff_id: '', amount: '', reason: '', incentive_type: 'bonus', month: new Date().toISOString().slice(0,7), notes: '' };
const emptyAnn = { title: '', body: '', priority: 'normal', is_pinned: false, expires_at: '' };

export default function Incentives() {
  const { user, isAdmin } = useAuth();
  const { addNotification } = useNotifications();
  const [tab, setTab] = useState<'records'|'leaderboard'|'announcements'>('records');
  const [incentives, setIncentives] = useState<Incentive[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(0); // index into PERIODS
  const [showIncForm, setShowIncForm] = useState(false);
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [incForm, setIncForm] = useState(emptyInc);
  const [annForm, setAnnForm] = useState(emptyAnn);
  const [editingIncId, setEditingIncId] = useState<string|null>(null);
  const [editingAnnId, setEditingAnnId] = useState<string|null>(null);
  const [viewingInc, setViewingInc] = useState<Incentive|null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string|null>(null);
  const [notifSent, setNotifSent] = useState<string | null>(null);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashNotif = (msg: string) => {
    setNotifSent(msg);
    if (notifTimer.current) clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotifSent(null), 4000);
  };

  const openAddInc = () => { setEditingIncId(null); setIncForm(emptyInc); setShowIncForm(true); };
  const openEditInc = (inc: Incentive) => {
    setEditingIncId(inc.id);
    setIncForm({ staff_id: inc.staff_id, amount: String(inc.amount), reason: inc.reason, incentive_type: inc.incentive_type, month: inc.month, notes: inc.notes ?? '' });
    setShowIncForm(true);
  };
  const openAddAnn = () => { setEditingAnnId(null); setAnnForm(emptyAnn); setShowAnnForm(true); };
  const openEditAnn = (a: Announcement) => {
    setEditingAnnId(a.id);
    setAnnForm({ title: a.title, body: a.body, priority: a.priority, is_pinned: a.is_pinned, expires_at: a.expires_at ? a.expires_at.slice(0,10) : '' });
    setShowAnnForm(true);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: inc }, { data: ann }, { data: st }] = await Promise.all([
      supabase.from('staff_incentives').select('*, staff:profiles!staff_id(full_name,department)').order('created_at', { ascending: false }),
      supabase.from('staff_announcements').select('*, creator:profiles!created_by(full_name)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,full_name,department').in('role',['admin','staff']).order('full_name'),
    ]);
    setIncentives((inc as Incentive[]) ?? []);
    setAnnouncements((ann as Announcement[]) ?? []);
    setStaff((st as Staff[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Filtered incentives by period ────────────────────────────────────────
  const filteredInc = (() => {
    const days = PERIODS[period].days;
    if (!days) return incentives;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    return incentives.filter(i => new Date(i.created_at) >= cutoff);
  })();

  // ── Leaderboard computation ──────────────────────────────────────────────
  const leaderboard = (() => {
    const map: Record<string, { name: string; dept: string; total: number; count: number }> = {};
    filteredInc.forEach(i => {
      const name = i.staff?.full_name ?? 'Unknown';
      const dept = i.staff?.department ?? '—';
      if (!map[i.staff_id]) map[i.staff_id] = { name, dept, total: 0, count: 0 };
      map[i.staff_id].total += Number(i.amount);
      map[i.staff_id].count += 1;
    });
    return Object.values(map).sort((a,b) => b.total - a.total);
  })();

  // ── Save incentive (insert or update) ───────────────────────────────────
  const saveIncentive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incForm.staff_id || !incForm.amount || !incForm.reason) return;
    setSaving(true);

    if (editingIncId) {
      // ── UPDATE existing incentive ──
      const { error } = await supabase
        .from('staff_incentives')
        .update({
          staff_id: incForm.staff_id, amount: Number(incForm.amount),
          reason: incForm.reason, incentive_type: incForm.incentive_type,
          month: incForm.month, notes: incForm.notes || null,
        })
        .eq('id', editingIncId);

      if (!error) flashNotif('✏️ Incentive updated successfully ✓');
    } else {
      // ── INSERT new incentive ──
      const { data: inserted, error } = await supabase
        .from('staff_incentives')
        .insert({
          staff_id: incForm.staff_id, amount: Number(incForm.amount),
          reason: incForm.reason, incentive_type: incForm.incentive_type,
          month: incForm.month, notes: incForm.notes || null, awarded_by: user?.id,
        })
        .select()
        .single();

      if (!error && inserted) {
        const amountFmt = `₹${Number(inserted.amount).toLocaleString('en-IN')}`;
        const typeLabel = (inserted.incentive_type || 'incentive')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase());
        const dedupKey = `incentive_awarded_${inserted.id}`;

        await addNotification({
          type: 'incentive_awarded',
          category: 'staff',
          priority: 1,
          icon: 'workspace_premium',
          color: 'green',
          title: `🏆 You've Earned a ${typeLabel}!`,
          message: `${amountFmt} has been awarded to you. Reason: ${inserted.reason || 'See incentives page.'}`,
          action_url: '/admin/my-incentives',
          action_label: 'View My Incentives',
          related_entity_type: 'incentive',
          related_entity_id: inserted.id,
          assigned_to_user_id: inserted.staff_id,
          dedup_key: dedupKey,
          metadata: {
            amount: inserted.amount,
            incentive_type: inserted.incentive_type,
            reason: inserted.reason,
            month: inserted.month,
          },
          is_read: false,
          is_dismissed: false,
        });

        flashNotif('📨 Incentive saved — staff member has been notified ✓');
      }
    }

    setShowIncForm(false); setEditingIncId(null); setIncForm(emptyInc); setSaving(false); fetchAll();
  };

  // ── Delete incentive ─────────────────────────────────────────────────────
  const deleteIncentive = async (id: string) => {
    setDeleting(id);
    await supabase.from('staff_incentives').delete().eq('id', id);
    setDeleting(null); fetchAll();
  };

  // ── Save announcement (insert or update) ────────────────────────────────
  const saveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annForm.title || !annForm.body) return;
    setSaving(true);

    if (editingAnnId) {
      // ── UPDATE existing announcement ──
      const { error } = await supabase
        .from('staff_announcements')
        .update({
          title: annForm.title, body: annForm.body, priority: annForm.priority,
          is_pinned: annForm.is_pinned, expires_at: annForm.expires_at || null,
        })
        .eq('id', editingAnnId);

      if (!error) flashNotif('✏️ Announcement updated successfully ✓');
    } else {
      // ── INSERT new announcement ──
      const { data: inserted, error } = await supabase
        .from('staff_announcements')
        .insert({
          title: annForm.title, body: annForm.body, priority: annForm.priority,
          is_pinned: annForm.is_pinned, created_by: user?.id,
          expires_at: annForm.expires_at || null,
        })
        .select()
        .single();

      if (!error && inserted) {
        const dedupKey = `announcement_posted_${inserted.id}`;
        let priority: 1 | 2 | 3 | 4 = 3;
        let color: 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'orange' = 'amber';
        let titlePrefix = '📢';

        if (inserted.priority === 'urgent')           { priority = 1; color = 'red';    titlePrefix = '🚨'; }
        else if (inserted.priority === 'celebration') { priority = 2; color = 'purple'; titlePrefix = '🎉'; }

        await addNotification({
          type: `announcement_${inserted.priority ?? 'normal'}`,
          category: 'staff',
          priority,
          icon: 'campaign',
          color,
          title: `${titlePrefix} ${inserted.title}`,
          message: inserted.body
            ? inserted.body.slice(0, 120) + (inserted.body.length > 120 ? '…' : '')
            : 'A new announcement has been posted.',
          action_url: '/admin/my-incentives',
          action_label: 'View Announcements',
          related_entity_type: 'announcement',
          related_entity_id: inserted.id,
          assigned_to_user_id: null,
          dedup_key: dedupKey,
          metadata: {
            announcement_id: inserted.id,
            priority: inserted.priority,
            is_pinned: inserted.is_pinned,
          },
          is_read: false,
          is_dismissed: false,
        });

        flashNotif('📢 Announcement posted — all staff have been notified ✓');
      }
    }

    setShowAnnForm(false); setEditingAnnId(null); setAnnForm(emptyAnn); setSaving(false); fetchAll();
  };

  const deleteAnn = async (id: string) => {
    setDeleting(id);
    await supabase.from('staff_announcements').delete().eq('id', id);
    setDeleting(null); fetchAll();
  };

  if (!isAdmin) return <p className="p-8 text-slate-500">Admin access required.</p>;

  const medals = ['🥇','🥈','🥉'];

  return (
    <div className="space-y-6">

      {/* ── Notification sent success banner ── */}
      {notifSent && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 px-5 py-3.5 rounded-2xl shadow-sm animate-[fadeIn_0.3s_ease-out]">
          <span className="material-symbols-outlined text-green-600 text-xl shrink-0">mark_email_read</span>
          <p className="text-sm font-semibold flex-1">{notifSent}</p>
          <button onClick={() => setNotifSent(null)} className="p-1 hover:bg-green-100 rounded-lg transition-colors">
            <span className="material-symbols-outlined text-green-500 text-sm">close</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-primary font-display">Incentives & Announcements</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage staff incentives, rankings and daily announcements.</p>
        </div>
        <div className="flex gap-2">
          {tab === 'records' && (
            <button onClick={openAddInc}
              className="h-10 px-4 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary-light transition-colors shadow-sm">
              <span className="material-symbols-outlined text-lg">add</span>Add Incentive
            </button>
          )}
          {tab === 'announcements' && (
            <button onClick={openAddAnn}
              className="h-10 px-4 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary-light transition-colors shadow-sm">
              <span className="material-symbols-outlined text-lg">campaign</span>New Announcement
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['records','leaderboard','announcements'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${tab===t ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'records' ? '📋 Records' : t === 'leaderboard' ? '🏆 Leaderboard' : '📢 Announcements'}
          </button>
        ))}
      </div>

      {/* Period Filter (shown on records + leaderboard) */}
      {tab !== 'announcements' && (
        <div className="flex gap-2 flex-wrap">
          {PERIODS.map((p,i) => (
            <button key={p.label} onClick={() => setPeriod(i)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${period===i ? 'bg-primary text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:border-primary/30'}`}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <span className="size-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── RECORDS TAB ── */}
          {tab === 'records' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                      <th className="text-left px-5 py-3">Staff</th>
                      <th className="text-left px-5 py-3">Type</th>
                      <th className="text-left px-5 py-3">Reason</th>
                      <th className="text-left px-5 py-3">Month</th>
                      <th className="text-right px-5 py-3">Amount</th>
                      <th className="text-right px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInc.length === 0 ? (
                      <tr><td colSpan={6} className="py-16 text-center text-slate-400 text-sm">No incentive records found.</td></tr>
                    ) : filteredInc.map(inc => {
                      const ti = typeInfo(inc.incentive_type);
                      return (
                        <tr key={inc.id}
                          onClick={() => setViewingInc(inc)}
                          className="border-b border-slate-50 last:border-0 hover:bg-primary/5 transition-colors cursor-pointer group">
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-semibold text-primary">{inc.staff?.full_name ?? '—'}</p>
                            <p className="text-[10px] text-slate-400">{inc.staff?.department ?? '—'}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${ti.color}`}>{ti.label}</span>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600 max-w-[200px] truncate">{inc.reason}</td>
                          <td className="px-5 py-3.5 text-xs text-slate-500">{inc.month}</td>
                          <td className="px-5 py-3.5 text-right font-bold text-green-600">{fmt(inc.amount)}</td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                              <button onClick={() => openEditInc(inc)}
                                className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                <span className="material-symbols-outlined text-sm">edit</span>
                              </button>
                              <button onClick={() => deleteIncentive(inc.id)} disabled={deleting===inc.id}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Delete">
                                <span className="material-symbols-outlined text-sm">delete</span>
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

          {/* ── LEADERBOARD TAB ── */}
          {tab === 'leaderboard' && (
            <div className="space-y-3">
              {leaderboard.length === 0 ? (
                <div className="py-16 text-center text-slate-400">No data for this period.</div>
              ) : leaderboard.map((s, i) => (
                <div key={s.name}
                  className={`bg-white rounded-2xl border p-4 flex items-center gap-4 shadow-[var(--shadow-card)] ${i===0 ? 'border-yellow-200 bg-yellow-50/30' : i===1 ? 'border-slate-200' : i===2 ? 'border-orange-100' : 'border-slate-100'}`}>
                  <div className={`size-12 rounded-xl flex items-center justify-center text-2xl font-black ${i===0 ? 'bg-yellow-100' : i===1 ? 'bg-slate-100' : i===2 ? 'bg-orange-100' : 'bg-slate-50'}`}>
                    {medals[i] ?? `#${i+1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-primary">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.dept} · {s.count} incentive{s.count!==1?'s':''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-green-600">{fmt(s.total)}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total Earned</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ANNOUNCEMENTS TAB ── */}
          {tab === 'announcements' && (
            <div className="space-y-3">
              {announcements.length === 0 ? (
                <div className="py-16 text-center text-slate-400">No announcements yet.</div>
              ) : announcements.map(a => {
                const pr = PRIORITIES.find(p=>p.value===a.priority)??PRIORITIES[0];
                return (
                  <div key={a.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {a.is_pinned && <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase">📌 Pinned</span>}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${pr.color}`}>{pr.label}</span>
                        </div>
                        <h3 className="font-bold text-primary">{a.title}</h3>
                        <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{a.body}</p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                          <span>By {a.creator?.full_name ?? 'Admin'}</span>
                          <span>·</span>
                          <span>{new Date(a.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
                          {a.expires_at && <><span>·</span><span>Expires {new Date(a.expires_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEditAnn(a)}
                          className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button onClick={() => deleteAnn(a.id)} disabled={deleting===a.id}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Delete">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Incentive Detail View Modal ── */}
      {viewingInc && (() => {
        const ti = typeInfo(viewingInc.incentive_type);
        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewingInc(null)}>
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="bg-gradient-to-r from-primary to-primary-light px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-xl">workspace_premium</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">Incentive Details</h2>
                    <p className="text-white/70 text-xs">{new Date(viewingInc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
                <button onClick={() => setViewingInc(null)} className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-white text-lg">close</span>
                </button>
              </div>

              {/* Amount Hero */}
              <div className="bg-green-50 border-b border-green-100 px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-green-600 uppercase tracking-wide">Amount Awarded</p>
                  <p className="text-3xl font-black text-green-700 mt-0.5">{fmt(viewingInc.amount)}</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase ${ti.color}`}>{ti.label}</span>
              </div>

              {/* Fields */}
              <div className="p-6 space-y-4">
                {/* Staff */}
                <div className="flex items-start gap-3">
                  <div className="size-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-slate-500 text-base">person</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Staff Member</p>
                    <p className="text-sm font-semibold text-primary mt-0.5">{viewingInc.staff?.full_name ?? '—'}</p>
                    {viewingInc.staff?.department && <p className="text-xs text-slate-400">{viewingInc.staff.department}</p>}
                  </div>
                </div>

                {/* Reason */}
                <div className="flex items-start gap-3">
                  <div className="size-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-slate-500 text-base">description</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Reason</p>
                    <p className="text-sm text-slate-700 mt-0.5">{viewingInc.reason}</p>
                  </div>
                </div>

                {/* Month */}
                <div className="flex items-start gap-3">
                  <div className="size-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-slate-500 text-base">calendar_month</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">For Month</p>
                    <p className="text-sm text-slate-700 mt-0.5">{viewingInc.month}</p>
                  </div>
                </div>

                {/* Notes */}
                <div className="flex items-start gap-3">
                  <div className="size-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-slate-500 text-base">sticky_note_2</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Notes</p>
                    {viewingInc.notes
                      ? <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-line">{viewingInc.notes}</p>
                      : <p className="text-sm text-slate-400 italic mt-0.5">No notes added</p>
                    }
                  </div>
                </div>

                {/* Date */}
                <div className="flex items-start gap-3">
                  <div className="size-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-slate-500 text-base">schedule</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Date Awarded</p>
                    <p className="text-sm text-slate-700 mt-0.5">{new Date(viewingInc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => { setViewingInc(null); openEditInc(viewingInc); }}
                  className="flex-1 h-11 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors flex items-center justify-center gap-2 text-sm shadow-sm">
                  <span className="material-symbols-outlined text-base">edit</span>Edit Incentive
                </button>
                <button
                  onClick={() => { deleteIncentive(viewingInc.id); setViewingInc(null); }}
                  className="h-11 px-4 bg-red-50 text-red-500 font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 text-sm border border-red-100">
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Add Incentive Modal ── */}
      {showIncForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-primary-light px-6 py-5 flex items-center justify-between">
              <h2 className="text-lg font-black text-white">{editingIncId ? '✏️ Edit Incentive' : 'Add Incentive'}</h2>
              <button onClick={() => { setShowIncForm(false); setEditingIncId(null); }} className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-lg">close</span>
              </button>
            </div>
            <form onSubmit={saveIncentive} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Staff Member *</label>
                <select required value={incForm.staff_id} onChange={e=>setIncForm({...incForm,staff_id:e.target.value})}
                  className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                  <option value="">Select staff…</option>
                  {staff.map(s=><option key={s.id} value={s.id}>{s.full_name} {s.department?`(${s.department})`:''}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Type *</label>
                  <select value={incForm.incentive_type} onChange={e=>setIncForm({...incForm,incentive_type:e.target.value})}
                    className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                    {TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Month *</label>
                  <input type="month" required value={incForm.month} onChange={e=>setIncForm({...incForm,month:e.target.value})}
                    className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Amount (₹) *</label>
                <input type="number" required min="1" value={incForm.amount} onChange={e=>setIncForm({...incForm,amount:e.target.value})}
                  placeholder="e.g. 5000" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Reason *</label>
                <input type="text" required value={incForm.reason} onChange={e=>setIncForm({...incForm,reason:e.target.value})}
                  placeholder="e.g. Top Sales - April 2026" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Notes (optional)</label>
                <textarea value={incForm.notes} onChange={e=>setIncForm({...incForm,notes:e.target.value})} rows={2}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 resize-none" />
              </div>
              <button type="submit" disabled={saving}
                className="w-full h-12 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70">
                {saving ? <><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</> : editingIncId ? <><span className="material-symbols-outlined text-lg">save</span>Save Changes</> : <><span className="material-symbols-outlined text-lg">workspace_premium</span>Add Incentive</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── New Announcement Modal ── */}
      {showAnnForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 flex items-center justify-between">
              <h2 className="text-lg font-black text-white">{editingAnnId ? '✏️ Edit Announcement' : 'New Announcement'}</h2>
              <button onClick={() => { setShowAnnForm(false); setEditingAnnId(null); }} className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-lg">close</span>
              </button>
            </div>
            <form onSubmit={saveAnnouncement} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Title *</label>
                <input type="text" required value={annForm.title} onChange={e=>setAnnForm({...annForm,title:e.target.value})}
                  placeholder="Announcement headline…" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Message *</label>
                <textarea required value={annForm.body} onChange={e=>setAnnForm({...annForm,body:e.target.value})} rows={4}
                  placeholder="Write the full announcement…" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Priority</label>
                  <select value={annForm.priority} onChange={e=>setAnnForm({...annForm,priority:e.target.value})}
                    className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                    {PRIORITIES.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Expires On (optional)</label>
                  <input type="date" value={annForm.expires_at} onChange={e=>setAnnForm({...annForm,expires_at:e.target.value})}
                    className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className={`w-10 h-5 rounded-full transition-colors relative ${annForm.is_pinned?'bg-primary':'bg-slate-200'}`}
                  onClick={()=>setAnnForm({...annForm,is_pinned:!annForm.is_pinned})}>
                  <div className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${annForm.is_pinned?'translate-x-5':'translate-x-0.5'}`}/>
                </div>
                <span className="text-sm font-semibold text-slate-700">Pin this announcement</span>
              </label>
              <button type="submit" disabled={saving}
                className="w-full h-12 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70">
                {saving ? <><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</> : editingAnnId ? <><span className="material-symbols-outlined text-lg">save</span>Save Changes</> : <><span className="material-symbols-outlined text-lg">campaign</span>Post Announcement</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
