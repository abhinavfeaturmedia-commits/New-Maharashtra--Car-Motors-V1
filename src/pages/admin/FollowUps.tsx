import React, { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';

const priorityColors: Record<string, string> = { 
    Hot: 'bg-red-100 text-red-700', 
    Warm: 'bg-amber-100 text-amber-700', 
    Cold: 'bg-blue-100 text-blue-700',
    Medium: 'bg-amber-100 text-amber-700'
};
const typeIcons: Record<string, string> = { Call: 'call', WhatsApp: 'chat', Email: 'mail', Visit: 'directions_walk', Task: 'task' };
const TABS = ['All Follow-Ups', 'Pending Follow-Ups', 'Overdue Follow-Ups', 'Completed', 'Global Tasks'];

const FollowUps = () => {
    const { tasks, followUps, refreshData } = useData();
    const [tab, setTab] = useState('All Follow-Ups');
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [taskForm, setTaskForm] = useState({ title: '', due_date: '', priority: 'Medium', description: '' });

    // Process live follow-ups
    const now = new Date();
    const processedFollowUps = followUps.map(fu => {
        const nextDate = fu.next_followup_date ? new Date(fu.next_followup_date) : null;
        const overdue = !fu.is_done && nextDate && nextDate < now;
        return {
            ...fu,
            isOverdue: overdue,
            derivedStatus: fu.is_done ? 'completed' : (overdue ? 'overdue' : 'todo')
        };
    });

    const pendingCount = processedFollowUps.filter(f => !f.is_done && !f.isOverdue).length;
    const overdueCount = processedFollowUps.filter(f => f.isOverdue).length;
    const completedCount = processedFollowUps.filter(f => f.is_done).length;
    const globalTasksCount = tasks.filter(t => !t.lead_id && t.status !== 'completed').length;

    let filteredItems: any[] = [];
    if (tab === 'All Follow-Ups') filteredItems = processedFollowUps;
    else if (tab === 'Pending Follow-Ups') filteredItems = processedFollowUps.filter(f => f.derivedStatus === 'todo');
    else if (tab === 'Overdue Follow-Ups') filteredItems = processedFollowUps.filter(f => f.isOverdue);
    else if (tab === 'Completed') filteredItems = processedFollowUps.filter(f => f.is_done);
    else if (tab === 'Global Tasks') filteredItems = tasks.filter(t => !t.lead_id);

    const handleMarkCompleteFU = async (id: string) => {
        await supabase.from('follow_ups').update({ is_done: true }).eq('id', id);
        refreshData();
    };

    const handleMarkCompleteTask = async (id: string) => {
        await supabase.from('tasks').update({ status: 'completed' }).eq('id', id);
        refreshData();
    };

    const handleCreateGlobalTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!taskForm.title || !taskForm.due_date) return;

        const { error } = await supabase.from('tasks').insert({
            title: taskForm.title,
            description: taskForm.description || null,
            due_date: new Date(taskForm.due_date).toISOString(),
            priority: taskForm.priority,
            status: 'todo',
            lead_id: null // Explicitly global/unattached
        });

        if (!error) {
            setTaskForm({ title: '', due_date: '', priority: 'Medium', description: '' });
            setIsCreatingTask(false);
            refreshData();
        } else {
            console.error(error);
            alert("Failed to create global task");
        }
    };

    const getCountForTab = (t: string) => {
        if (t === 'All Follow-Ups') return processedFollowUps.length;
        if (t === 'Pending Follow-Ups') return pendingCount;
        if (t === 'Overdue Follow-Ups') return overdueCount;
        if (t === 'Completed') return completedCount;
        if (t === 'Global Tasks') return tasks.filter(task => !task.lead_id).length;
        return 0;
    };

    const viaIcon = (via: string) => {
        const map: Record<string, string> = {
            call: 'call', whatsapp: 'chat', email: 'mail', visit: 'directions_walk', meeting: 'groups',
        };
        return map[via] || 'phone';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Follow-Up Manager</h1>
                    <p className="text-slate-500 text-sm">Lead Follow-Ups · {pendingCount} pending · {overdueCount} overdue</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setIsCreatingTask(true)} className="h-10 px-5 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary-light transition-colors shadow-sm">
                        <span className="material-symbols-outlined text-lg">add_task</span> Add Global Task
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'Total Follow-Ups', val: processedFollowUps.length, icon: 'contact_phone', color: 'bg-blue-500/10 text-blue-600' },
                    { label: 'Pending', val: pendingCount, icon: 'pending_actions', color: 'bg-amber-500/10 text-amber-600' },
                    { label: 'Completed', val: completedCount, icon: 'check_circle', color: 'bg-green-500/10 text-green-600' },
                    { label: 'Overdue', val: overdueCount, icon: 'warning', color: 'bg-red-500/10 text-red-600' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)]">
                        <div className={`size-9 rounded-xl flex items-center justify-center ${s.color} mb-2`}><span className="material-symbols-outlined text-lg">{s.icon}</span></div>
                        <p className="text-xl font-black text-primary font-display">{s.val}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200 overflow-x-auto pb-px">
                {TABS.map(t => (
                    <button key={t} onClick={() => setTab(t)} className={`px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${tab === t ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>
                        {t} <span className="text-xs text-slate-400 ml-1">
                            ({getCountForTab(t)})
                        </span>
                    </button>
                ))}
            </div>

            {/* Follow-up Cards */}
            <div className="space-y-3">
                {filteredItems.length === 0 && (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200 border-dashed text-slate-500">
                        No items found in this category.
                    </div>
                )}
                {tab === 'Global Tasks' ? (
                    filteredItems.map(t => (
                        <div key={t.id} className={`bg-white rounded-2xl border p-4 shadow-[var(--shadow-card)] flex items-center gap-4 ${t.status !== 'completed' && new Date(t.due_date) < now ? 'border-red-200 bg-red-50/30' : 'border-slate-100'}`}>
                             <div className="size-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-xl">task</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-bold text-slate-700">Global Task</span>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${priorityColors[t.priority] || 'bg-slate-100 text-slate-600'}`}>{t.priority || 'Normal'}</span>
                                    {t.status !== 'completed' && new Date(t.due_date) < now && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">OVERDUE</span>}
                                    {t.status === 'completed' && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-600">DONE</span>}
                                </div>
                                <p className="text-xs text-slate-600 font-medium">{t.title}</p>
                                {t.description && <p className="text-xs text-slate-400 truncate mt-0.5">{t.description}</p>}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
                                <span>Due: {new Date(t.due_date).toLocaleString('en-IN', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div className="flex gap-1 shrink-0 ml-4">
                                {t.status !== 'completed' && (
                                    <button onClick={() => handleMarkCompleteTask(t.id)} className="p-2 hover:bg-green-50 rounded-xl transition-colors group" title="Mark Done">
                                        <span className="material-symbols-outlined text-green-500 group-hover:text-green-600">check_circle</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    filteredItems.map(f => (
                        <div key={f.id} className={`bg-white rounded-2xl border p-4 shadow-[var(--shadow-card)] flex items-center gap-4 ${f.isOverdue ? 'border-red-200 bg-red-50/30' : 'border-slate-100'}`}>
                            <div className="size-10 rounded-full bg-gradient-to-br from-primary to-primary-light text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                                {f.lead?.full_name?.charAt(0).toUpperCase() || 'L'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <Link to={`/admin/leads/${f.lead_id}`} className="text-sm font-bold text-primary hover:underline">{f.lead?.full_name || 'Unknown Lead'}</Link>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${f.outcome === 'interested' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'} capitalize`}>{f.outcome || (f.contacted_via && f.contacted_via.length ? f.contacted_via.join(', ') : 'unknown')}</span>
                                    {f.isOverdue && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">OVERDUE</span>}
                                    {f.is_done && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">DONE</span>}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <div className="flex -space-x-1">
                                        {(f.contacted_via || []).slice(0, 2).map((method: string, i: number) => (
                                            <span key={i} className="material-symbols-outlined text-[14px] text-slate-400 bg-white rounded-full">{viaIcon(method)}</span>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium capitalize">{(f.contacted_via || []).join(', ')} Follow-Up</p>
                                </div>
                                {f.notes && <p className="text-xs text-slate-400 truncate mt-0.5">{f.notes}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-1 text-xs text-slate-500 shrink-0">
                                {f.next_followup_date ? (
                                    <div className="flex items-center gap-1">
                                        <span className={`material-symbols-outlined text-base ${f.isOverdue ? 'text-red-500' : 'text-amber-500'}`}>alarm</span>
                                        <span className={f.isOverdue ? 'text-red-600 font-semibold' : 'text-amber-700 font-semibold'}>Next: {new Date(f.next_followup_date).toLocaleString('en-IN', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-slate-400">
                                        <span className="material-symbols-outlined text-base">history</span>
                                        <span>Logged: {new Date(f.created_at).toLocaleDateString('en-IN', {day:'numeric', month:'short'})}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-1 shrink-0 ml-4">
                                {!f.is_done && (
                                    <button onClick={() => handleMarkCompleteFU(f.id)} className="p-2 hover:bg-green-50 rounded-xl transition-colors group" title="Mark Done">
                                        <span className="material-symbols-outlined text-green-500 group-hover:text-green-600 text-xl">check_circle</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Global Task Modal */}
            {isCreatingTask && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-primary font-display">New Global Task</h2>
                                <p className="text-xs text-slate-500">Create an operational task not tied to a specific lead.</p>
                            </div>
                            <button onClick={() => setIsCreatingTask(false)} className="size-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300 transition-colors">
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreateGlobalTask} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Task Title <span className="text-red-400">*</span></label>
                                <input required type="text" placeholder="e.g. Call Bank for Auto Loan Updates" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 transition-shadow" />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Due Date <span className="text-red-400">*</span></label>
                                    <input required type="datetime-local" value={taskForm.due_date} onChange={e => setTaskForm({...taskForm, due_date: e.target.value})} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 transition-shadow" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Priority</label>
                                    <select value={taskForm.priority} onChange={e => setTaskForm({...taskForm, priority: e.target.value})} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 transition-shadow bg-white">
                                        <option value="Hot">High / Urgent</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Cold">Low / Planning</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Description <span className="text-xs text-slate-400 font-normal">(optional)</span></label>
                                <textarea placeholder="Add any details, instructions, or notes..." value={taskForm.description} onChange={e => setTaskForm({...taskForm, description: e.target.value})} rows={3} className="w-full border border-slate-200 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 transition-shadow"></textarea>
                            </div>
                            
                            <div className="pt-2">
                                <button type="submit" className="w-full h-12 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors shadow-sm flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-lg">add_task</span> Save Global Task
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FollowUps;
