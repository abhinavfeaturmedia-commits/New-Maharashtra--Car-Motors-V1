import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const actionColors: Record<string, string> = { 
    'Notes Updated': 'text-blue-600', 
    'Status Changed': 'text-purple-600', 
    'Task Added': 'text-emerald-600', 
    'Lead Created': 'text-green-600',
    'Email Sent': 'text-teal-600',
    'Follow up': 'text-amber-600'
};

const CATEGORIES = ['All Activity', 'Status Changed', 'Notes Updated', 'Task Added', 'Lead Created', 'Email Sent'];

const AuditLogs = () => {
    const [category, setCategory] = useState('All Activity');
    const [search, setSearch] = useState('');
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchActivities = async () => {
            setLoading(true);
            try {
                // Fetch real audit logs joined with the profiles table
                const auditPromise = supabase
                    .from('audit_logs')
                    .select('id, action, target_type, target_name, details, created_at, profiles:user_id(full_name)')
                    .order('created_at', { ascending: false })
                    .limit(200);

                // Fetch lead activities
                const leadPromise = supabase
                    .from('lead_activities')
                    .select('id, activity_type, notes, created_at, created_by, lead:leads(full_name)')
                    .order('created_at', { ascending: false })
                    .limit(200);

                const [auditRes, leadRes] = await Promise.all([auditPromise, leadPromise]);

                let combinedLogs: any[] = [];

                if (!auditRes.error && auditRes.data) {
                    const mappedAudits = auditRes.data.map((d: any) => ({
                        id: 'a_' + d.id,
                        user: d.profiles?.full_name || 'System User',
                        avatar: (d.profiles?.full_name || 'System User').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase(),
                        action: d.action,
                        target: `${d.target_type}: ${d.target_name}`,
                        element: d.details || 'CRM',
                        category: d.action,
                        timestamp: new Date(d.created_at).getTime(),
                        time: new Date(d.created_at).toLocaleString('en-IN')
                    }));
                    combinedLogs = [...combinedLogs, ...mappedAudits];
                }

                if (!leadRes.error && leadRes.data) {
                    const mappedLeads = leadRes.data.map((d: any) => {
                        let actionLabel = 'Notes Updated';
                        if (d.activity_type === 'status_change') actionLabel = 'Status Changed';
                        else if (d.activity_type === 'email') actionLabel = 'Email Sent';
                        else if (d.activity_type === 'call') actionLabel = 'Call Logged';
                        else if (d.activity_type === 'meeting') actionLabel = 'Meeting Set';

                        return {
                            id: 'l_' + d.id,
                            user: d.created_by || 'System User',
                            avatar: (d.created_by || 'System User').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase(),
                            action: actionLabel,
                            target: `Lead: ${d.lead?.full_name || 'Deleted'}`,
                            element: d.notes || 'Activity logged',
                            category: actionLabel,
                            timestamp: new Date(d.created_at).getTime(),
                            time: new Date(d.created_at).toLocaleString('en-IN')
                        };
                    });
                    combinedLogs = [...combinedLogs, ...mappedLeads];
                }

                combinedLogs.sort((a, b) => b.timestamp - a.timestamp);
                setLogs(combinedLogs);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchActivities();
    }, []);

    const filtered = logs
        .filter(l => category === 'All Activity' || l.action === category)
        .filter(l => l.target.toLowerCase().includes(search.toLowerCase()) || l.user.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">System Audit Logs</h1>
                    <p className="text-slate-500 text-sm">Review verifiable read-only activity traces across the CRM framework.</p>
                </div>
                <div className="flex gap-2">
                    <span className="py-2 px-3 text-[10px] font-bold tracking-wider uppercase text-blue-600 bg-blue-100 rounded-lg shadow-sm">LIVE FEED</span>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                    {CATEGORIES.map(c => (
                        <button key={c} onClick={() => setCategory(c)} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all uppercase ${category === c ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-200 hover:border-primary'}`}>{c}</button>
                    ))}
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-9 w-56">
                    <span className="material-symbols-outlined text-slate-400 text-sm">search</span>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="bg-transparent text-xs text-primary outline-none w-full" />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-x-auto">
                <table className="w-full min-w-[800px]">
                    <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                            <th className="text-left px-5 py-3">Logged By</th>
                            <th className="text-left px-5 py-3">Audit Action</th>
                            <th className="text-left px-5 py-3">Trace Target</th>
                            <th className="text-left px-5 py-3">System Element</th>
                            <th className="text-left px-5 py-3">Secure Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">Loading secure log feeds...</td></tr>}
                        {!loading && filtered.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">No matching activities found on the database.</td></tr>}
                        {!loading && filtered.map(l => (
                            <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                <td className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="size-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[9px] font-bold">{l.avatar}</div>
                                        <span className="text-sm font-medium text-slate-700">{l.user}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-3"><span className={`text-xs font-bold ${actionColors[l.action] || 'text-slate-600'}`}>{l.action}</span></td>
                                <td className="px-5 py-3 text-sm text-slate-600">{l.target}</td>
                                <td className="px-5 py-3"><span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 uppercase w-max">{l.element}</span></td>
                                <td className="px-5 py-3 text-xs text-slate-400 font-mono tracking-tighter">{l.time}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AuditLogs;
