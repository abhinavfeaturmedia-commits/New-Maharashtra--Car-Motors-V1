import React, { useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';

const statusColors: Record<string, string> = { Paid: 'bg-green-100 text-green-700', Partial: 'bg-amber-100 text-amber-700', Unpaid: 'bg-red-100 text-red-700' };

const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;

const Commissions = () => {
    const { sales } = useData();

    const [profiles, setProfiles] = React.useState<any[]>([]);

    React.useEffect(() => {
        // Fetch real team members from profiles
        const fetchProfiles = async () => {
            const { data } = await supabase.from('profiles').select('id, full_name, role, avatar_url, created_at').eq('is_active', true);
            if (data) setProfiles(data);
        };
        fetchProfiles();
    }, []);

    const [attendanceMap, setAttendanceMap] = React.useState<Record<string, number>>({});

    React.useEffect(() => {
        const fetchAttendance = async () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const fromDateObj = new Date(year, month, 1);
            const toDateObj = now;

            const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const to   = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            // Fetch holidays and attendance records in parallel
            const [holidaysRes, attendanceRes] = await Promise.all([
                supabase.from('attendance_holidays').select('date').gte('date', from).lte('date', to),
                supabase.from('attendance_records').select('user_id, status, date').gte('date', from).lte('date', to)
            ]);

            const holidayDates = (holidaysRes.data ?? []).map((h: any) => h.date);
            const attendanceData = attendanceRes.data ?? [];

            // Helper to count working days (including weekends) excluding holidays between two Date objects
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

            // Map each user_id to their total present days
            const userPresentMap: Record<string, number> = {};
            attendanceData.forEach((r: any) => {
                if (!userPresentMap[r.user_id]) userPresentMap[r.user_id] = 0;
                if (['present', 'late', 'on_leave'].includes(r.status)) {
                    userPresentMap[r.user_id] += 1;
                } else if (r.status === 'half_day') {
                    userPresentMap[r.user_id] += 0.5;
                }
            });

            // Calculate attendance percentage using actual working days for each user
            const pctMap: Record<string, number> = {};
            profiles.forEach((profile: any) => {
                let userStart = new Date(fromDateObj);
                if (profile.created_at) {
                    const profileCreated = new Date(profile.created_at);
                    if (profileCreated > userStart) {
                        userStart = profileCreated;
                    }
                }

                const workingDays = getWorkingDaysCount(userStart, toDateObj, holidayDates);
                const present = userPresentMap[profile.id] ?? 0;

                pctMap[profile.id] = workingDays > 0 ? Math.min(100, Math.round((present / workingDays) * 100)) : 100;
            });

            setAttendanceMap(pctMap);
        };

        if (profiles.length > 0) {
            fetchAttendance();
        }
    }, [profiles]);

    const commissionData = useMemo(() => {
        const baseRate = 0.015; // 1.5% fixed standard commission in V1

        let totalSalesVolume = 0;
        let totalEarnedPool = 0;
        
        // Use live profiles from the database
        const table = profiles.map(member => {
            // Find sales belonging to this user
            const memberSales = sales.filter(s => s.sold_by === member.id);
            const deals = memberSales.length;
            
            // Calculate real gross volume for this specific user
            const memberVolume = memberSales.reduce((acc, curr) => acc + Number(curr.final_price || 0), 0);
            
            const earned = memberVolume * baseRate;
            
            // Assume logic for disbursements (to be built out in the future)
            // Currently rendering based on calculated gross to simulate real math
            const paid = 0; // For now, all is pending unless we have a disbursement system
            const pending = earned - paid;
            
            // Add to totals
            totalSalesVolume += memberVolume;
            totalEarnedPool += earned;

            return {
                id: member.id,
                name: member.full_name || 'Unknown',
                avatar: member.avatar_url ? 'P' : member.full_name?.charAt(0).toUpperCase(),
                role: member.role === 'admin' ? 'Administrator' : 'Sales Executive',
                deals: deals,
                rate: '1.5%', // All default to 1.5% for now
                earnedStr: formatCurrency(Math.round(earned)),
                paidStr: formatCurrency(Math.round(paid)),
                pendingStr: formatCurrency(Math.round(pending)),
                status: pending > 0 ? 'Partial' : 'Paid',
                attendancePct: attendanceMap[member.id] ?? null,
            };
        });

        // Filter out people with 0 deals from table or leave them so everyone shows up?
        // Let's keep them so the manager sees the whole staff list.

        return {
            table,
            totalEarnedStr: formatCurrency(Math.round(totalEarnedPool)),
            totalPaidStr: formatCurrency(0), 
            totalPendingStr: formatCurrency(Math.round(totalEarnedPool))
        };
    }, [sales, profiles, attendanceMap]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Sales Commissions</h1>
                    <p className="text-slate-500 text-sm">Automated commission pools based on validated CRM sales volumes.</p>
                </div>
                <div className="flex gap-2 text-right">
                    <span className="py-2 px-3 text-[10px] font-bold tracking-wider uppercase text-green-600 bg-green-100 rounded-lg">SYNCED POOL</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                    <div className="size-10 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-600 mb-3"><span className="material-symbols-outlined text-lg">payments</span></div>
                    <p className="text-2xl font-black text-primary font-display">{commissionData.totalEarnedStr}</p>
                    <p className="text-xs text-slate-400 font-medium">Global Expected Payout</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                    <div className="size-10 rounded-xl flex items-center justify-center bg-green-500/10 text-green-600 mb-3"><span className="material-symbols-outlined text-lg">check_circle</span></div>
                    <p className="text-2xl font-black text-green-600 font-display">{commissionData.totalPaidStr}</p>
                    <p className="text-xs text-slate-400 font-medium">Total Paid Out</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                    <div className="size-10 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-600 mb-3"><span className="material-symbols-outlined text-lg">pending</span></div>
                    <p className="text-2xl font-black text-amber-600 font-display">{commissionData.totalPendingStr}</p>
                    <p className="text-xs text-slate-400 font-medium">Liability Remaining</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-x-auto">
                <table className="w-full min-w-[800px]">
                    <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                            <th className="text-left px-5 py-3">Team Member</th>
                            <th className="text-left px-5 py-3">Closing Share</th>
                            <th className="text-left px-5 py-3">Slab Rate</th>
                            <th className="text-left px-5 py-3">Gross Earned</th>
                            <th className="text-left px-5 py-3">Disbursed</th>
                            <th className="text-left px-5 py-3">Pending</th>
                            <th className="text-left px-5 py-3">Attendance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {commissionData.table.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">No active sales recorded to calculate pools.</td></tr>}
                        {commissionData.table.map(c => (
                            <tr key={c.name} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-2">
                                        <div className="size-8 rounded-full bg-gradient-to-br from-primary to-primary-light text-white flex items-center justify-center text-[10px] font-bold">{c.avatar}</div>
                                        <div><p className="text-sm font-medium text-primary">{c.name}</p><p className="text-[10px] text-slate-400">{c.role}</p></div>
                                    </div>
                                </td>
                                <td className="px-5 py-3.5 text-sm font-bold text-primary">~ {c.deals} Deals</td>
                                <td className="px-5 py-3.5 text-sm text-slate-600">{c.rate}</td>
                                <td className="px-5 py-3.5 text-sm font-bold text-primary">{c.earnedStr}</td>
                                <td className="px-5 py-3.5 text-sm text-green-600">{c.paidStr}</td>
                                <td className="px-5 py-3.5 text-sm text-amber-600 font-medium">{c.pendingStr}</td>
                                <td className="px-5 py-3.5">
                                    {c.attendancePct !== null && (
                                        c.attendancePct < 75
                                            ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg">
                                                <span className="material-symbols-outlined text-xs">warning</span>
                                                {c.attendancePct}% Att. — Not Eligible
                                              </span>
                                            : <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-lg">{c.attendancePct}% ✓</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Commissions;
