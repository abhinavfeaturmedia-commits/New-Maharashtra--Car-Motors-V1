import React, { useMemo } from 'react';
import { useData } from '../../contexts/DataContext';

const colorPalette = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-pink-500', 'bg-amber-500', 'bg-red-500', 'bg-teal-500', 'bg-indigo-500'];

const LeadSources = () => {
    const { leads } = useData();
    
    // Compute dynamic sources from leads context
    const sourcesData = useMemo(() => {
        if (!leads.length) return [];
        
        const sourceMap: Record<string, { leads: number, conversions: number }> = {};
        
        leads.forEach(lead => {
            const src = lead.source || 'Direct / Walk-in';
            if (!sourceMap[src]) sourceMap[src] = { leads: 0, conversions: 0 };
            sourceMap[src].leads++;
            if (lead.status === 'closed_won') {
                sourceMap[src].conversions++;
            }
        });
        
        const totalLeads = leads.length;
        
        const computed = Object.keys(sourceMap).map((src, idx) => {
            const data = sourceMap[src];
            const pct = Math.round((data.leads / totalLeads) * 100);
            const rate = data.leads > 0 ? Math.round((data.conversions / data.leads) * 100) : 0;
            return {
                name: src,
                leads: data.leads,
                conversions: data.conversions,
                rate: `${rate}%`,
                cost: '—', // This would ideally link to a marketing spend table
                color: colorPalette[idx % colorPalette.length],
                pct
            };
        });
        
        // Sort by most leads
        return computed.sort((a, b) => b.leads - a.leads);
        
    }, [leads]);

    const totalLeads = leads.length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Lead Source Tracker</h1>
                    <p className="text-slate-500 text-sm">Understand where your leads come from and their ROI.</p>
                </div>
                <div className="flex gap-2">
                    <span className="py-2 px-3 text-[10px] font-bold tracking-wider uppercase text-green-600 bg-green-100 rounded-lg">LIVE DATA</span>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Donut Chart Visual */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                    <h2 className="font-bold text-primary font-display text-lg mb-5">Source Distribution</h2>
                    
                    {totalLeads === 0 ? (
                        <div className="h-48 flex items-center justify-center text-slate-400">No data available</div>
                    ) : (
                        <>
                            <div className="relative size-48 mx-auto mb-6">
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                    {sourcesData.reduce<{ offset: number; elements: React.ReactNode[] }>((acc, s, i) => {
                                        const dash = (s.pct / 100) * 283;
                                        const elem = <circle key={i} cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10" strokeDasharray={`${dash} ${283 - dash}`} strokeDashoffset={-acc.offset} className={s.color.replace('bg-', 'text-')} />;
                                        acc.elements.push(elem);
                                        acc.offset += dash;
                                        return acc;
                                    }, { offset: 0, elements: [] }).elements}
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <p className="text-2xl font-black text-primary font-display">{totalLeads}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">Total Leads</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {sourcesData.map(s => (
                                    <div key={s.name} className="flex items-center gap-2">
                                        <span className={`size-2.5 rounded-full ${s.color}`} />
                                        <span className="text-xs text-slate-600 flex-1">{s.name}</span>
                                        <span className="text-xs font-bold text-primary">{s.pct}%</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Table */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                    <div className="p-5 pb-0">
                        <h2 className="font-bold text-primary font-display text-lg">Source Performance</h2>
                    </div>
                    <div className="overflow-x-auto relative">
                        <table className="w-full mt-3 min-w-[600px]">
                            <thead>
                                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                    <th className="text-left px-5 py-2.5">Source</th>
                                    <th className="text-left px-5 py-2.5">Leads</th>
                                    <th className="text-left px-5 py-2.5">Conversions</th>
                                    <th className="text-left px-5 py-2.5">Conv. Rate</th>
                                    <th className="text-left px-5 py-2.5">Share</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sourcesData.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-10 text-slate-400">No leads found in database.</td>
                                    </tr>
                                )}
                                {sourcesData.map(s => (
                                    <tr key={s.name} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`size-3 rounded-full ${s.color}`} />
                                                <span className="text-sm font-semibold text-primary">{s.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm font-bold text-primary">{s.leads}</td>
                                        <td className="px-5 py-3.5 text-sm text-slate-600">{s.conversions}</td>
                                        <td className="px-5 py-3.5">
                                            <span className={`text-xs font-bold ${parseInt(s.rate) >= 30 ? 'text-green-600' : parseInt(s.rate) >= 20 ? 'text-amber-600' : 'text-red-500'}`}>{s.rate}</span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.pct}%` }} />
                                                </div>
                                                <span className="text-xs text-slate-500">{s.pct}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeadSources;
