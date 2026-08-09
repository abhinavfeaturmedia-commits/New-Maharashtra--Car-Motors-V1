import React, { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';

const purposeColors: Record<string, string> = {
    'Test Drive': 'bg-blue-100 text-blue-700',
    'Valuation': 'bg-purple-100 text-purple-700',
    'Document Collection': 'bg-amber-100 text-amber-700',
    'Showroom': 'bg-pink-100 text-pink-700',
    'General': 'bg-slate-100 text-slate-700',
};

const Visits = () => {
    const { visits, refreshData } = useData();
    const { user, isAdmin } = useAuth();
    const { addNotification } = useNotifications();

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [staffFilter, setStaffFilter] = useState('All');

    // UI state
    const [remarksModal, setRemarksModal] = useState<{
        open: boolean;
        visitId: string;
        action: 'approve' | 'reject';
        remarks: string;
    }>({ open: false, visitId: '', action: 'approve', remarks: '' });

    const [viewingVisit, setViewingVisit] = useState<any | null>(null);
    const [submittingAction, setSubmittingAction] = useState(false);

    // List of staff who have logged visits
    const staffList = useMemo(() => {
        const unique: Record<string, string> = {};
        visits.forEach(v => {
            if (v.staff?.full_name && v.staff_id) {
                unique[v.staff_id] = v.staff.full_name;
            }
        });
        return Object.entries(unique).map(([id, name]) => ({ id, name }));
    }, [visits]);

    // Metrics & Statistics
    const metrics = useMemo(() => {
        // Filter based on logged-in user if they are staff
        const relevantVisits = isAdmin ? visits : visits.filter(v => v.staff_id === user?.id);

        const total = relevantVisits.length;
        const approved = relevantVisits.filter(v => v.outcome === 'successful' && v.status === 'approved').length;
        const pending = relevantVisits.filter(v => v.outcome === 'successful' && v.status === 'pending_approval').length;
        const unsuccessful = relevantVisits.filter(v => v.outcome === 'unsuccessful').length;
        const rejected = relevantVisits.filter(v => v.status === 'rejected').length;

        // Leaderboard (visible to all, but ranks everyone)
        const countsByStaff: Record<string, { name: string; total: number; successful: number; pending: number }> = {};
        visits.forEach(v => {
            const staffId = v.staff_id;
            const staffName = v.staff?.full_name || 'Unknown Staff';
            if (!countsByStaff[staffId]) {
                countsByStaff[staffId] = { name: staffName, total: 0, successful: 0, pending: 0 };
            }
            countsByStaff[staffId].total += 1;
            if (v.outcome === 'successful' && v.status === 'approved') {
                countsByStaff[staffId].successful += 1;
            } else if (v.outcome === 'successful' && v.status === 'pending_approval') {
                countsByStaff[staffId].pending += 1;
            }
        });

        const leaderboard = Object.values(countsByStaff).sort((a, b) => b.successful - a.successful);

        return {
            total,
            approved,
            pending,
            unsuccessful,
            rejected,
            leaderboard
        };
    }, [visits, user, isAdmin]);

    // Admin Approval Queue (visits that are successful and pending approval)
    const approvalQueue = useMemo(() => {
        return visits.filter(v => v.outcome === 'successful' && v.status === 'pending_approval');
    }, [visits]);

    // Filtered visits list for history table
    const filteredVisits = useMemo(() => {
        return visits.filter(v => {
            // Staff users can only see their own visits in the history list, or all if we want team-wide visibility
            // The prompt says "I want to see how many visits added by staff... only approved visits count as successful under that specific staff user"
            // Let's allow staff to see all visits so they can see their place on the leaderboard, but restrict updates.
            // If the user wants to filter history list for staff, let's keep it visible.
            const matchesStaff = isAdmin ? (staffFilter === 'All' ? true : v.staff_id === staffFilter) : v.staff_id === user?.id;
            const matchesStatus = statusFilter === 'All' ? true : v.status === statusFilter;
            
            const targetName = (v.lead?.full_name || v.customer?.full_name || '').toLowerCase();
            const staffName = (v.staff?.full_name || '').toLowerCase();
            const purpose = (v.purpose || '').toLowerCase();
            const notes = (v.notes || '').toLowerCase();
            
            const matchesSearch = !search ? true : (
                targetName.includes(search.toLowerCase()) ||
                staffName.includes(search.toLowerCase()) ||
                purpose.includes(search.toLowerCase()) ||
                notes.includes(search.toLowerCase())
            );

            return matchesStaff && matchesStatus && matchesSearch;
        });
    }, [visits, search, statusFilter, staffFilter, user, isAdmin]);

    const handleApprovalAction = async () => {
        if (!remarksModal.visitId) return;
        setSubmittingAction(true);
        const { visitId, action, remarks } = remarksModal;

        const newStatus = action === 'approve' ? 'approved' : 'rejected';
        
        try {
            // 1. Update visit in DB
            const { data: updatedVisit, error } = await supabase
                .from('visits')
                .update({
                    status: newStatus,
                    approved_by: user?.id,
                    approved_at: new Date().toISOString(),
                    admin_remarks: remarks || null
                })
                .eq('id', visitId)
                .select('*, staff:profiles!staff_id(full_name), lead:leads(*), customer:customers(*)')
                .single();

            if (error) throw error;

            // 2. Fetch target name
            const targetName = updatedVisit.lead?.full_name || updatedVisit.customer?.full_name || 'Client';

            // 3. Create activity timeline log
            const logMessage = `Visit on ${new Date(updatedVisit.visit_date).toLocaleDateString('en-IN')} was ${newStatus} by Admin.${remarks ? ` Remarks: ${remarks}` : ''}`;
            
            if (updatedVisit.lead_id) {
                await supabase.from('lead_activities').insert({
                    lead_id: updatedVisit.lead_id,
                    activity_type: 'note',
                    notes: logMessage,
                    created_by: user?.id
                });
            }

            // 4. Send smart notification to the staff member
            await addNotification({
                type: `visit_${newStatus}`,
                category: 'workflow',
                priority: 2,
                icon: action === 'approve' ? 'verified_user' : 'cancel',
                color: action === 'approve' ? 'green' : 'red',
                title: `Visit Log ${action === 'approve' ? 'Approved ✓' : 'Rejected ✗'}`,
                message: `Your visit log for ${targetName} (${updatedVisit.purpose}) has been ${newStatus} by admin.${remarks ? ` Reason: ${remarks}` : ''}`,
                action_url: `/admin/visits`,
                action_label: 'View Visits Logs',
                related_entity_type: 'visit',
                related_entity_id: visitId,
                assigned_to_user_id: updatedVisit.staff_id,
                dedup_key: `visit_approved_rejected_${visitId}_${newStatus}`,
                metadata: {
                    visit_id: visitId,
                    status: newStatus,
                    remarks: remarks || ''
                },
                is_read: false,
                is_dismissed: false
            });

            // 5. Refresh data & Close modal
            await refreshData();
            setRemarksModal({ open: false, visitId: '', action: 'approve', remarks: '' });
            
            // If viewing details, update it too
            if (viewingVisit && viewingVisit.id === visitId) {
                setViewingVisit(null);
            }
        } catch (err) {
            console.error('Failed to update visit status:', err);
            alert('Failed to process approval action. Please try again.');
        } finally {
            setSubmittingAction(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Staff Customer Visits</h1>
                    <p className="text-slate-500 text-sm">Log, approve, and track client visits. Successful visits count after Admin approval.</p>
                </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: isAdmin ? 'Total Logged Visits' : 'My Logged Visits', val: metrics.total, icon: 'directions_walk', color: 'bg-blue-500/10 text-blue-600' },
                    { label: 'Approved Successful Visits', val: metrics.approved, icon: 'check_circle', color: 'bg-green-500/10 text-green-600' },
                    { label: 'Awaiting Admin Approval', val: metrics.pending, icon: 'pending_actions', color: 'bg-amber-500/10 text-amber-600' },
                    { label: 'Unsuccessful Visits', val: metrics.unsuccessful, icon: 'cancel', color: 'bg-slate-500/10 text-slate-500' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[var(--shadow-card)]">
                        <div className={`size-9 rounded-xl flex items-center justify-center ${s.color} mb-2`}><span className="material-symbols-outlined text-lg">{s.icon}</span></div>
                        <p className="text-xl font-black text-primary font-display">{s.val}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Main content grid */}
            <div className="grid lg:grid-cols-3 gap-6">
                
                {/* Left/Middle Column: Approval Queue & History List */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Approval Queue (Admin Only) */}
                    {isAdmin && (
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-primary font-display flex items-center gap-2">
                                    <span className="material-symbols-outlined text-amber-500 text-lg">fact_check</span>
                                    Visits Approval Queue ({approvalQueue.length})
                                </h3>
                                <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Requires Admin Review</span>
                            </div>

                            {approvalQueue.length === 0 ? (
                                <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-100 border-dashed text-slate-400 text-sm">
                                    No pending successful visits awaiting approval.
                                </div>
                            ) : (
                                <div className="grid sm:grid-cols-2 gap-4">
                                    {approvalQueue.map(v => (
                                        <div key={v.id} className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start gap-2 mb-2">
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${purposeColors[v.purpose] || 'bg-slate-100 text-slate-700'}`}>
                                                        {v.purpose}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {new Date(v.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-primary text-sm mb-1">
                                                    {v.lead?.full_name || v.customer?.full_name || 'Client'}
                                                </h4>
                                                <p className="text-[10px] text-slate-400 mb-2">
                                                    Logged by: <strong className="text-slate-600">{v.staff?.full_name}</strong>
                                                </p>
                                                {v.location && (
                                                    <p className="text-xs text-slate-500 flex items-center gap-1 mb-2 bg-white px-2 py-1 rounded border border-slate-100">
                                                        <span className="material-symbols-outlined text-xs text-slate-400">location_on</span>
                                                        <span className="truncate">{v.location}</span>
                                                    </p>
                                                )}
                                                {v.notes && (
                                                    <p className="text-xs text-slate-500 italic bg-white p-2.5 rounded border border-slate-50 line-clamp-3 mb-3">
                                                        "{v.notes}"
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex gap-2 border-t border-slate-100 pt-3">
                                                <button
                                                    onClick={() => setRemarksModal({ open: true, visitId: v.id, action: 'approve', remarks: '' })}
                                                    className="flex-1 h-8 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                                                >
                                                    <span className="material-symbols-outlined text-sm">check</span>
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => setRemarksModal({ open: true, visitId: v.id, action: 'reject', remarks: '' })}
                                                    className="h-8 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-red-100"
                                                >
                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Visits History Log */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)] space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="font-bold text-primary font-display flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-lg">history</span>
                                    Visits Log History
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">List of all logged customer and lead visits.</p>
                            </div>
                            
                            {/* Search */}
                            <div className="relative w-full sm:w-60">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                                <input
                                    type="text"
                                    placeholder="Search client, staff, notes..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full h-9 border border-slate-200 rounded-xl pl-9 pr-4 text-xs outline-none focus:ring-2 focus:ring-primary/10 transition-shadow bg-slate-50"
                                />
                            </div>
                        </div>

                        {/* Search / Filters Row */}
                        <div className="flex flex-wrap gap-2">
                            {/* Status Filter */}
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="h-9 border border-slate-200 rounded-xl px-3 text-xs outline-none bg-white text-slate-600 font-semibold cursor-pointer"
                            >
                                <option value="All">All Statuses</option>
                                <option value="pending_approval">🕒 Pending Approval</option>
                                <option value="approved">✅ Approved</option>
                                <option value="rejected">❌ Rejected</option>
                            </select>

                            {/* Staff Filter (Admin Only) */}
                            {isAdmin && (
                                <select
                                    value={staffFilter}
                                    onChange={e => setStaffFilter(e.target.value)}
                                    className="h-9 border border-slate-200 rounded-xl px-3 text-xs outline-none bg-white text-slate-600 font-semibold cursor-pointer max-w-[150px]"
                                >
                                    <option value="All">All Staff</option>
                                    {staffList.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* History Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px]">
                                <thead>
                                    <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50/50">
                                        <th className="text-left px-4 py-2.5">Date</th>
                                        <th className="text-left px-4 py-2.5">Client</th>
                                        <th className="text-left px-4 py-2.5">Logged By</th>
                                        <th className="text-left px-4 py-2.5">Purpose / Location</th>
                                        <th className="text-left px-4 py-2.5">Outcome</th>
                                        <th className="text-left px-4 py-2.5">Status</th>
                                        <th className="text-right px-4 py-2.5">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredVisits.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                                                No visits match the current filter criteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredVisits.map(v => (
                                            <tr key={v.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-colors">
                                                <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap font-medium">
                                                    {new Date(v.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    {v.lead_id ? (
                                                        <Link to={`/admin/leads/${v.lead_id}`} className="text-xs font-bold text-primary hover:underline block truncate max-w-[120px]">
                                                            {v.lead?.full_name || 'Unknown Lead'}
                                                        </Link>
                                                    ) : (
                                                        <Link to={`/admin/customers`} className="text-xs font-bold text-emerald-700 hover:underline block truncate max-w-[120px]">
                                                            {v.customer?.full_name || 'Customer'}
                                                        </Link>
                                                    )}
                                                    <span className="text-[9px] text-slate-400 bg-slate-100 px-1 rounded uppercase tracking-widest">{v.lead_id ? 'Lead' : 'Customer'}</span>
                                                </td>
                                                <td className="px-4 py-3.5 text-xs text-slate-600 font-semibold">{v.staff?.full_name || '—'}</td>
                                                <td className="px-4 py-3.5">
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${purposeColors[v.purpose] || 'bg-slate-100 text-slate-700'}`}>
                                                        {v.purpose}
                                                    </span>
                                                    {v.location && <span className="text-[10px] text-slate-400 block truncate max-w-[160px] mt-0.5" title={v.location}>{v.location}</span>}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className={`text-[10px] font-bold inline-flex items-center gap-1 ${v.outcome === 'successful' ? 'text-green-600' : 'text-slate-500'}`}>
                                                        <span className="material-symbols-outlined text-[14px]">
                                                            {v.outcome === 'successful' ? 'check_circle' : 'cancel'}
                                                        </span>
                                                        {v.outcome === 'successful' ? 'Successful' : 'Unsuccessful'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    {v.outcome === 'unsuccessful' ? (
                                                        <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Completed</span>
                                                    ) : v.status === 'approved' ? (
                                                        <span className="text-[9px] font-black uppercase bg-green-100 text-green-700 px-2 py-0.5 rounded">Approved</span>
                                                    ) : v.status === 'rejected' ? (
                                                        <span className="text-[9px] font-black uppercase bg-red-100 text-red-600 px-2 py-0.5 rounded">Rejected</span>
                                                    ) : (
                                                        <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-600 px-2 py-0.5 rounded">Pending Approval</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-right">
                                                    <button
                                                        onClick={() => setViewingVisit(v)}
                                                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-primary transition-colors"
                                                        title="View Details"
                                                    >
                                                        <span className="material-symbols-outlined text-base">visibility</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar: Leaderboard & Stats */}
                <div className="space-y-6">
                    {/* Leaderboard panel */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                        <h3 className="font-bold text-primary font-display flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-amber-500">leaderboard</span>
                            Visits Leaderboard
                        </h3>

                        {metrics.leaderboard.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-xs italic">
                                No visits logged yet to compute rankings.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {metrics.leaderboard.map((row, index) => {
                                    const medals = ['🥇', '🥈', '🥉'];
                                    return (
                                        <div key={row.name} className="flex items-center justify-between p-3 rounded-xl border border-slate-50 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="size-8 rounded-lg bg-white flex items-center justify-center font-black text-sm border shadow-sm shrink-0">
                                                    {medals[index] || `#${index + 1}`}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-700 truncate">{row.name}</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">{row.total} visit{row.total !== 1 ? 's' : ''} logged</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-green-600">{row.successful}</p>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase">Approved</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    
                    {/* Info Card */}
                    <div className="bg-gradient-to-br from-primary to-primary-light rounded-3xl p-5 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4">
                            <span className="material-symbols-outlined text-[120px] font-thin">directions_walk</span>
                        </div>
                        <h4 className="font-bold text-base mb-2 font-display">Approval Workflow</h4>
                        <p className="text-xs text-white/80 leading-relaxed mb-3">
                            When logging a customer visit, selecting **Successful Visit** automatically flags it for admin review.
                        </p>
                        <p className="text-xs text-white/80 leading-relaxed">
                            Once an administrator approves the visit, it increments the successful metrics and reflects on the Leaderboard. Unsuccessful visits require no approval and are saved directly.
                        </p>
                    </div>
                </div>
            </div>

            {/* Remarks Modal for Admin Actions */}
            {remarksModal.open && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
                        <div className={`px-6 py-4 flex items-center justify-between text-white ${
                            remarksModal.action === 'approve' ? 'bg-green-600' : 'bg-red-600'
                        }`}>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined">
                                    {remarksModal.action === 'approve' ? 'verified_user' : 'cancel'}
                                </span>
                                <h3 className="font-bold font-display">
                                    {remarksModal.action === 'approve' ? 'Approve Successful Visit' : 'Reject Visit Log'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setRemarksModal({ open: false, visitId: '', action: 'approve', remarks: '' })}
                                className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <p className="text-xs text-slate-500 leading-relaxed">
                                {remarksModal.action === 'approve' 
                                    ? 'Confirm this visit happened successfully. This visit will be counted in the staff member\'s performance metrics.' 
                                    : 'Please specify the reason for rejecting this visit log. The staff member will be notified.'}
                            </p>
                            
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                    {remarksModal.action === 'approve' ? 'Admin Remarks (Optional)' : 'Rejection Reason (Required)'}
                                </label>
                                <textarea
                                    value={remarksModal.remarks}
                                    onChange={e => setRemarksModal(prev => ({ ...prev, remarks: e.target.value }))}
                                    placeholder={remarksModal.action === 'approve' ? 'e.g. Approved. Good follow-up.' : 'e.g. Address could not be verified.'}
                                    rows={3}
                                    required={remarksModal.action === 'reject'}
                                    className="w-full border border-slate-200 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary/10 transition-shadow bg-slate-50"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setRemarksModal({ open: false, visitId: '', action: 'approve', remarks: '' })}
                                    className="flex-1 h-10 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={submittingAction || (remarksModal.action === 'reject' && !remarksModal.remarks.trim())}
                                    onClick={handleApprovalAction}
                                    className={`flex-1 h-10 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm disabled:opacity-50 ${
                                        remarksModal.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                                    }`}
                                >
                                    {submittingAction ? (
                                        <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Processing...</>
                                    ) : (
                                        <>{remarksModal.action === 'approve' ? 'Confirm Approval' : 'Confirm Reject'}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Visit Details Modal */}
            {viewingVisit && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewingVisit(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        
                        {/* Header */}
                        <div className="bg-gradient-to-r from-primary to-primary-light px-6 py-5 flex items-center justify-between text-white">
                            <div className="flex items-center gap-3">
                                <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-xl">directions_walk</span>
                                </div>
                                <div>
                                    <h3 className="font-bold font-display">Visit Log Details</h3>
                                    <p className="text-white/70 text-xs">
                                        {new Date(viewingVisit.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setViewingVisit(null)} className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined text-white text-lg">close</span>
                            </button>
                        </div>

                        {/* Status bar */}
                        <div className={`px-6 py-3 border-b flex items-center justify-between ${
                            viewingVisit.outcome === 'unsuccessful' ? 'bg-slate-50 border-slate-100 text-slate-700' :
                            viewingVisit.status === 'approved' ? 'bg-green-50 border-green-100 text-green-700' :
                            viewingVisit.status === 'rejected' ? 'bg-red-50 border-red-100 text-red-700' :
                            'bg-amber-50 border-amber-100 text-amber-700'
                        }`}>
                            <span className="text-xs font-bold uppercase tracking-wider">Status Outcome</span>
                            <span className="text-xs font-black uppercase">
                                {viewingVisit.outcome === 'unsuccessful' ? 'Unsuccessful Visit' :
                                 viewingVisit.status === 'approved' ? 'Approved (Successful)' :
                                 viewingVisit.status === 'rejected' ? 'Rejected' :
                                 'Awaiting Approval'}
                            </span>
                        </div>

                        {/* Fields */}
                        <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">
                            
                            {/* Client */}
                            <div className="flex items-start gap-3">
                                <div className="size-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-slate-500 text-base">person</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Client / Lead</p>
                                    <p className="text-sm font-bold text-primary mt-0.5">
                                        {viewingVisit.lead?.full_name || viewingVisit.customer?.full_name || 'Client'}
                                    </p>
                                    <span className="text-[9px] text-slate-400 bg-slate-100 px-1 rounded uppercase tracking-wider font-mono">
                                        {viewingVisit.lead_id ? 'Lead Profile' : 'Registered Customer'}
                                    </span>
                                </div>
                            </div>

                            {/* Staff Member */}
                            <div className="flex items-start gap-3">
                                <div className="size-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-slate-500 text-base">badge</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Logged By Staff</p>
                                    <p className="text-sm font-semibold text-slate-700 mt-0.5">
                                        {viewingVisit.staff?.full_name || '—'}
                                    </p>
                                </div>
                            </div>

                            {/* Purpose & Location */}
                            <div className="flex items-start gap-3">
                                <div className="size-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-slate-500 text-base">near_me</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Purpose & Location</p>
                                    <p className="text-xs font-semibold text-slate-700 mt-0.5">
                                        Purpose: {viewingVisit.purpose}
                                    </p>
                                    {viewingVisit.location && (
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Location: {viewingVisit.location}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="flex items-start gap-3">
                                <div className="size-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-slate-500 text-base">description</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Staff Visit Notes</p>
                                    <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap bg-slate-50 p-2.5 rounded border border-slate-100">
                                        {viewingVisit.notes || <span className="italic text-slate-400">No notes provided</span>}
                                    </p>
                                </div>
                            </div>

                            {/* Admin Remarks */}
                            {viewingVisit.outcome === 'successful' && (viewingVisit.admin_remarks || viewingVisit.approved_at) && (
                                <div className="flex items-start gap-3 border-t border-slate-100 pt-3">
                                    <div className="size-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-slate-500 text-base">rate_review</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Admin Review Remarks</p>
                                        <p className="text-xs text-slate-700 mt-0.5 font-medium whitespace-pre-wrap bg-slate-50 p-2.5 rounded border border-slate-100">
                                            {viewingVisit.admin_remarks || <span className="italic text-slate-400">Approved without remarks</span>}
                                        </p>
                                        {viewingVisit.approved_at && (
                                            <p className="text-[9px] text-slate-400 mt-1">
                                                Reviewed on: {new Date(viewingVisit.approved_at).toLocaleString('en-IN')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer / Quick approvals if pending (Admin Only) */}
                        {isAdmin && viewingVisit.outcome === 'successful' && viewingVisit.status === 'pending_approval' ? (
                            <div className="p-6 border-t border-slate-100 flex gap-2">
                                <button
                                    onClick={() => { setViewingVisit(null); setRemarksModal({ open: true, visitId: viewingVisit.id, action: 'approve', remarks: '' }); }}
                                    className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                                >
                                    <span className="material-symbols-outlined text-sm">check</span>
                                    Approve Visit
                                </button>
                                <button
                                    onClick={() => { setViewingVisit(null); setRemarksModal({ open: true, visitId: viewingVisit.id, action: 'reject', remarks: '' }); }}
                                    className="h-10 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition border border-red-100"
                                >
                                    <span className="material-symbols-outlined text-sm">close</span>
                                    Reject
                                </button>
                            </div>
                        ) : (
                            <div className="p-6 border-t border-slate-100">
                                <button
                                    onClick={() => setViewingVisit(null)}
                                    className="w-full h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs transition"
                                >
                                    Close Details
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Visits;
