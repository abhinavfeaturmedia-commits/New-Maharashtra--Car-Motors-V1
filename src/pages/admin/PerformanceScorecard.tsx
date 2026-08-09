import React, { useState, useMemo, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';

const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
};

const PerformanceScorecard: React.FC = () => {
    const { leads, sales, visits } = useData();
    const [period, setPeriod] = useState('Lifetime (Global)');
    const [profiles, setProfiles] = useState<any[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
    const [holidays, setHolidays] = useState<string[]>([]);
    
    // Accountability states
    const [commitments, setCommitments] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);

    useEffect(() => {
        const fetchProfiles = async () => {
            const { data } = await supabase.from('profiles').select('*');
            if (data) setProfiles(data);
        };
        fetchProfiles();
    }, []);

    useEffect(() => {
        const fetchAttendance = async () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const to   = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            
            const [holidaysRes, attendanceRes] = await Promise.all([
                supabase.from('attendance_holidays').select('date').gte('date', from).lte('date', to),
                supabase.from('attendance_records')
                    .select('user_id, status, date')
                    .gte('date', from)
                    .lte('date', to)
                    .in('status', ['present', 'late', 'half_day', 'on_leave', 'absent'])
            ]);
            
            if (holidaysRes.data) setHolidays(holidaysRes.data.map((h: any) => h.date));
            if (attendanceRes.data) setAttendanceRecords(attendanceRes.data);
        };
        fetchAttendance();
    }, []);

    // Fetch commitments and daily reports on mount
    useEffect(() => {
        const fetchAccountability = async () => {
            const [commRes, repRes] = await Promise.all([
                supabase.from('staff_commitments').select('*'),
                supabase.from('staff_daily_reports').select('*')
            ]);
            if (commRes.data) setCommitments(commRes.data);
            if (repRes.data) setReports(repRes.data);
        };
        fetchAccountability();
    }, []);

    const kpis = useMemo(() => {
        const totalLeads = leads.length;
        const totalSalesVolume = sales.reduce((sum, s) => sum + Number(s.final_price), 0);
        const totalConversions = sales.length;
        const globalApprovedVisits = visits.filter(v => v.status === 'approved').length;

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const fromDateObj = new Date(year, month, 1);
        const toDateObj = now;

        const getWorkingDaysCount = (start: Date, end: Date, holidayList: string[]) => {
            let count = 0;
            const cur = new Date(start);
            cur.setHours(0, 0, 0, 0);
            const endLimit = new Date(end);
            endLimit.setHours(0, 0, 0, 0);
            const holidaySet = new Set(holidayList);

            while (cur <= endLimit) {
                const dateStr = cur.getFullYear() + '-' +
                                String(cur.getMonth() + 1).padStart(2, '0') + '-' +
                                String(cur.getDate()).padStart(2, '0');
                if (!holidaySet.has(dateStr)) {
                    count++;
                }
                cur.setDate(cur.getDate() + 1);
            }
            return count;
        };

        let rankedTeam = profiles.map(m => {
            // Find leads assigned to this user
            const memberLeads = leads.filter(l => l.assigned_to === m.id || l.user_id === m.id);
            const memberConversions = memberLeads.filter(l => l.status === 'closed_won').length;
            const memberRevenue = sales.filter(s => s.sold_by === m.id).reduce((sum, s) => sum + Number(s.final_price), 0);

            // Visits metrics
            const memberVisits = visits.filter(v => v.staff_id === m.id);
            const memberApprovedVisits = memberVisits.filter(v => v.status === 'approved').length;

            // Attendance stats for this member
            const memberAttendance = attendanceRecords.filter(a => a.user_id === m.id);
            const presentDays = memberAttendance.filter(a => ['present', 'late', 'on_leave'].includes(a.status)).length
                + memberAttendance.filter(a => a.status === 'half_day').length * 0.5;

            // Determine user start date based on account creation date
            let userStart = new Date(fromDateObj);
            if (m.created_at) {
                const createdDate = new Date(m.created_at);
                if (createdDate > userStart) {
                    userStart = createdDate;
                }
            }

            const workingDays = getWorkingDaysCount(userStart, toDateObj, holidays);
            const attendancePct = workingDays > 0 ? Math.min(100, Math.round((presentDays / workingDays) * 100)) : 100;

            // Accountability metrics calculation
            const memberComms = commitments.filter(c => c.user_id === m.id);
            const memberReps = reports.filter(r => r.user_id === m.id);

            const commCount = memberComms.length;
            const verifiedCount = memberComms.filter(c => c.is_verified).length;

            const targetDeals = memberComms.reduce((sum, c) => sum + c.deal, 0);
            const actualDeals = memberComms.reduce((sum, c) => {
                const repVal = memberReps.find(r => r.date === c.date)?.total_success || 0;
                
                // Fetch auto synced count
                const wonLeadsToday = leads.filter(l => l.assigned_to === m.id && l.status === 'closed_won' && l.updated_at.startsWith(c.date)).length;
                const salesToday = sales.filter(s => s.sold_by === m.id && s.sale_date === c.date).length;
                const autoDeals = Math.max(wonLeadsToday, salesToday);

                return sum + Math.max(c.actual_deal, repVal, autoDeals);
            }, 0);

            const targetCalls = memberComms.reduce((sum, c) => sum + c.calls, 0);
            const actualCalls = memberComms.reduce((sum, c) => {
                const repVal = memberReps.find(r => r.date === c.date)?.calling || 0;
                return sum + Math.max(c.actual_calls, repVal);
            }, 0);

            const overallCommMet = (targetDeals + targetCalls) > 0
                ? Math.round(((actualDeals + actualCalls) / (targetDeals + targetCalls)) * 100)
                : 100;

            // Streak calculation
            const sortedComms = [...memberComms].sort((a, b) => b.date.localeCompare(a.date));
            let streak = 0;
            const todayStr = new Date().toLocaleDateString('en-CA');
            let checkIndex = 0;

            if (sortedComms.length > 0 && sortedComms[0].date === todayStr) {
                const c = sortedComms[0];
                const rep = memberReps.find(r => r.date === c.date);
                const wonToday = leads.filter(l => l.assigned_to === m.id && l.status === 'closed_won' && l.updated_at.startsWith(c.date)).length;
                const salesToday = sales.filter(s => s.sold_by === m.id && s.sale_date === c.date).length;
                const autoDeals = Math.max(wonToday, salesToday);

                const actCalls = Math.max(c.actual_calls, rep?.calling || 0);
                const actDeals = Math.max(c.actual_deal, rep?.total_success || 0, autoDeals);
                
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
                const rep = memberReps.find(r => r.date === c.date);
                const wonToday = leads.filter(l => l.assigned_to === m.id && l.status === 'closed_won' && l.updated_at.startsWith(c.date)).length;
                const salesToday = sales.filter(s => s.sold_by === m.id && s.sale_date === c.date).length;
                const autoDeals = Math.max(wonToday, salesToday);

                const actCalls = Math.max(c.actual_calls, rep?.calling || 0);
                const actDeals = Math.max(c.actual_deal, rep?.total_success || 0, autoDeals);
                
                const isMet = (c.calls + c.deal > 0) && (actCalls + actDeals >= c.calls + c.deal);
                if (isMet) {
                    streak++;
                } else {
                    break;
                }
            }

            return {
                id: m.id,
                name: m.full_name || 'Unnamed Team Member',
                role: m.role || 'Sales',
                avatar: (m.full_name || 'U').substring(0, 2).toUpperCase(),
                leads: memberLeads.length,
                conversions: memberConversions,
                approvedVisits: memberApprovedVisits,
                totalVisits: memberVisits.length,
                revenueStr: formatCurrency(memberRevenue),
                convRate: memberLeads.length > 0 ? Math.round((memberConversions / memberLeads.length) * 100) : 0,
                rating: 0,
                trend: `0%`,
                attendancePct,
                // accountability properties
                streak,
                overallCommMet: commCount > 0 ? overallCommMet : 0,
                commCount,
                verifiedCount,
            };
        });

        // Filter out profiles that are generic customers unless they have leads, meaning they act as a team member here.
        rankedTeam = rankedTeam.filter(m => m.leads > 0 || m.role === 'admin' || m.totalVisits > 0 || m.commCount > 0);

        // Ensure real leaderboard sorting by conversions capability
        rankedTeam = rankedTeam.sort((a, b) => b.conversions - a.conversions);

        // Calculate average team commitment met rate
        const activeCommMembers = rankedTeam.filter(m => m.commCount > 0);
        const avgCommitmentMet = activeCommMembers.length > 0
            ? Math.round(activeCommMembers.reduce((sum, m) => sum + m.overallCommMet, 0) / activeCommMembers.length)
            : 0;

        return {
            team: rankedTeam.map((t, idx) => ({ ...t, rank: idx + 1 })),
            globalTotalLeads: totalLeads,
            globalTotalConversions: totalConversions,
            globalTotalRevenue: formatCurrency(totalSalesVolume),
            globalApprovedVisits,
            avgCommitmentMet
        };
    }, [leads, sales, visits, period, profiles, attendanceRecords, holidays, commitments, reports]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Global Performance Scorecard</h1>
                    <p className="text-slate-500 text-sm">Track actual global branch capability scaled against team profiles.</p>
                </div>
                <div className="flex items-center gap-3">
                     <span className="py-2 px-3 text-[10px] font-bold tracking-wider uppercase text-blue-600 bg-blue-100 rounded-lg shadow-sm">DYNAMIC POOL</span>
                     <select value={period} onChange={e => setPeriod(e.target.value)} className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none">
                        <option>Lifetime (Global)</option>
                    </select>
                </div>
            </div>

            {/* Team Summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { label: 'Active Team Size', value: kpis.team.length, icon: 'groups', color: 'bg-blue-500/10 text-blue-600' },
                    { label: 'Global Leads', value: kpis.globalTotalLeads, icon: 'person_search', color: 'bg-purple-500/10 text-purple-600' },
                    { label: 'Global Conversions', value: kpis.globalTotalConversions, icon: 'handshake', color: 'bg-green-500/10 text-green-600' },
                    { label: 'Global Revenue', value: kpis.globalTotalRevenue, icon: 'currency_rupee', color: 'bg-amber-500/10 text-amber-600' },
                    { label: 'Approved Visits', value: kpis.globalApprovedVisits, icon: 'directions_walk', color: 'bg-emerald-500/10 text-emerald-600' },
                    { label: 'Avg Commitment Met', value: `${kpis.avgCommitmentMet}%`, icon: 'fact_check', color: 'bg-indigo-500/10 text-indigo-600' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                        <div className={`size-10 rounded-xl flex items-center justify-center ${s.color} mb-3`}><span className="material-symbols-outlined text-lg">{s.icon}</span></div>
                        <p className="text-2xl font-black text-primary font-display">{s.value}</p>
                        <p className="text-xs text-slate-400 font-medium">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Leaderboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {kpis.team.map(m => (
                    <div key={m.name} className={`bg-white rounded-2xl border p-5 shadow-[var(--shadow-card)] text-center relative overflow-hidden ${m.rank === 1 ? 'border-accent ring-1 ring-accent/20' : 'border-slate-100'}`}>
                        {m.rank === 1 && <div className="absolute top-0 right-0 bg-accent text-primary text-[9px] font-black px-3 py-1 rounded-bl-xl">🏆 TOP</div>}
                        
                        {/* Streak Badge */}
                        {m.streak > 0 && (
                            <div className="absolute top-3 left-3 flex items-center gap-0.5 text-[9px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full shadow-xs animate-pulse-glow">
                                <span className="material-symbols-outlined text-xs text-orange-500 fill-orange-500">local_fire_department</span>
                                {m.streak}d Streak
                            </div>
                        )}

                        {m.rank <= 3 ? (
                            <div className="relative size-16 mx-auto mb-3 flex items-center justify-center rounded-full overflow-hidden p-0.5 shadow-sm">
                                <div className={`absolute inset-0 animate-rotate-gradient bg-gradient-to-r ${
                                    m.rank === 1 ? 'from-amber-400 via-yellow-200 to-amber-500' :
                                    m.rank === 2 ? 'from-slate-300 via-slate-100 to-slate-400' :
                                    'from-orange-400 via-orange-200 to-orange-500'
                                }`} />
                                <div className="relative size-full rounded-full bg-gradient-to-br from-primary to-primary-light text-white flex items-center justify-center text-sm font-bold border border-white/50">{m.avatar}</div>
                            </div>
                        ) : (
                            <div className="size-14 rounded-full bg-gradient-to-br from-primary to-primary-light text-white flex items-center justify-center text-lg font-bold mx-auto mb-3">{m.avatar}</div>
                        )}
                        <p className="text-sm font-bold text-primary font-display">{m.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium mb-3">{m.role}</p>
                        <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="bg-slate-50 rounded-lg p-2">
                                <p className="text-lg font-black text-primary">{m.conversions}</p>
                                <p className="text-[9px] text-slate-400 font-medium">Sales</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-2">
                                <p className="text-lg font-black text-primary">{m.leads}</p>
                                <p className="text-[9px] text-slate-400 font-medium">Leads</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-2 col-span-2 flex items-center justify-between px-3">
                                <span className="text-[9px] text-slate-400 font-medium">Approved Visits</span>
                                <span className="text-xs font-bold text-emerald-600">{m.approvedVisits} / {m.totalVisits}</span>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-2 col-span-2 flex items-center justify-between px-3">
                                <span className="text-[9px] text-slate-400 font-medium">Attendance</span>
                                <span className={`text-xs font-bold ${m.attendancePct >= 90 ? 'text-green-600' : m.attendancePct >= 75 ? 'text-amber-500' : 'text-red-500'}`}>{m.attendancePct}%</span>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-2 col-span-2 flex items-center justify-between px-3">
                                <span className="text-[9px] text-slate-400 font-medium">Commitments Met</span>
                                <span className={`text-xs font-bold ${m.overallCommMet >= 90 ? 'text-green-600' : m.overallCommMet >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                                    {m.commCount > 0 ? `${m.overallCommMet}%` : '-'}
                                </span>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-1 text-green-600">
                            <TrendingUp size={12} /><span className="text-xs font-bold">{m.trend}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                <div className="p-5 pb-0">
                    <h2 className="font-bold text-primary font-display text-lg">Performance Drilldown (Projected Metric Slice)</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full mt-3 min-w-[1000px]">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                                <th className="text-left px-5 py-2.5 rounded-tl-xl">Rank</th>
                                <th className="text-left px-5 py-2.5">Team Member</th>
                                <th className="text-left px-5 py-2.5">Lead Alloc.</th>
                                <th className="text-left px-5 py-2.5">Approved Visits</th>
                                <th className="text-left px-5 py-2.5">Closed Value</th>
                                <th className="text-left px-5 py-2.5">Conv. Win Rate</th>
                                <th className="text-left px-5 py-2.5">Streak</th>
                                <th className="text-left px-5 py-2.5">Commitment Met %</th>
                                <th className="text-left px-5 py-2.5">Revenue Slice</th>
                                <th className="text-left px-5 py-2.5">Attendance %</th>
                                <th className="text-left px-5 py-2.5">Quality Rating</th>
                                <th className="text-left px-5 py-2.5">Velocity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {kpis.team.length === 0 && <tr><td colSpan={12} className="text-center p-8 text-slate-400">No active leads or sales.</td></tr>}
                            {kpis.team.map(m => (
                                <tr key={m.name} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-3.5 border-r border-slate-50">
                                        <span className={`text-sm font-black ${m.rank <= 3 ? 'text-accent' : 'text-slate-400'}`}>#{m.rank}</span>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-2">
                                            <div className="size-7 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white text-[10px] font-bold">{m.avatar}</div>
                                            <div><p className="text-sm font-medium text-primary">{m.name}</p><p className="text-[10px] text-slate-400">{m.role}</p></div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 text-sm font-semibold text-primary">{m.leads}</td>
                                    <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600 bg-emerald-50/20">{m.approvedVisits} / {m.totalVisits}</td>
                                    <td className="px-5 py-3.5 text-sm font-semibold text-primary">{m.conversions} Deals</td>
                                    <td className="px-5 py-3.5 text-sm text-slate-600 bg-blue-50/30">{m.convRate}%</td>
                                    
                                    {/* Streak Column */}
                                    <td className="px-5 py-3.5">
                                        {m.streak > 0 ? (
                                            <span className="inline-flex items-center gap-0.5 text-xs font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full shadow-xs animate-pulse-glow">
                                                <span className="material-symbols-outlined text-[14px] text-orange-500 fill-orange-500">local_fire_department</span>
                                                {m.streak} Days
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-xs">-</span>
                                        )}
                                    </td>

                                    {/* Commitment Met Column */}
                                    <td className="px-5 py-3.5">
                                        {m.commCount > 0 ? (
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-14 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${m.overallCommMet >= 90 ? 'bg-green-500' : m.overallCommMet >= 70 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${Math.min(100, m.overallCommMet)}%` }} />
                                                </div>
                                                <span className={`text-xs font-bold ${m.overallCommMet >= 90 ? 'text-green-600' : m.overallCommMet >= 70 ? 'text-amber-500' : 'text-red-500'}`}>{m.overallCommMet}%</span>
                                                {m.commCount > 0 && m.verifiedCount === m.commCount && (
                                                    <span className="material-symbols-outlined text-xs text-indigo-500" title="All logs audited & verified">lock</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-xs">-</span>
                                        )}
                                    </td>

                                    <td className="px-5 py-3.5 text-sm font-bold text-green-700 bg-green-50/30">{m.revenueStr}</td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-14 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${m.attendancePct >= 90 ? 'bg-green-500' : m.attendancePct >= 75 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${m.attendancePct}%` }} />
                                            </div>
                                            <span className={`text-xs font-bold ${m.attendancePct >= 90 ? 'text-green-600' : m.attendancePct >= 75 ? 'text-amber-500' : 'text-red-500'}`}>{m.attendancePct}%</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-amber-400 text-sm">star</span>
                                            <span className="text-sm font-semibold text-primary">{m.rating}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5"><span className="text-xs font-bold text-green-600 flex items-center gap-0.5"><TrendingUp size={12} />{m.trend}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PerformanceScorecard;
