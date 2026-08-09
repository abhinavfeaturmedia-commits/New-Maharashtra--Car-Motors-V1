import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffUser {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    role: 'admin' | 'staff';
    department: string | null;
    is_active: boolean;
    created_at: string;
}

interface PermissionMap {
    [module: string]: { can_view: boolean; can_manage: boolean };
}

// ─── Module Definitions ───────────────────────────────────────────────────────

const MODULES = [
    { key: 'dashboard',  label: 'Dashboard',          icon: 'dashboard',           desc: 'Main overview & KPIs' },
    { key: 'inventory',  label: 'Inventory',           icon: 'directions_car',      desc: 'Vehicle listings & stock' },
    { key: 'leads',      label: 'Leads',               icon: 'people',              desc: 'Lead management & pipeline' },
    { key: 'sales',      label: 'Sales',               icon: 'point_of_sale',       desc: 'Sales records & conversions' },
    { key: 'bookings',   label: 'Bookings & Planner',  icon: 'event',               desc: 'Test drives & appointments' },
    { key: 'analytics',  label: 'Analytics & Reports', icon: 'analytics',           desc: 'Reports, charts & performance' },
    { key: 'crm',        label: 'CRM',                 icon: 'contacts',            desc: 'Customers, follow-ups & sources' },
    { key: 'operations', label: 'Operations',          icon: 'checklist',           desc: 'Inspections, docs, expenses' },
    { key: 'finance',    label: 'Finance',             icon: 'account_balance',     desc: 'Accounts, commissions & tax' },
    { key: 'schedule',   label: 'Schedule',            icon: 'calendar_month',      desc: 'Calendar, notifications & templates' },
    { key: 'dealers',    label: 'Dealers',             icon: 'store',               desc: 'Dealer partner management' },
    { key: 'audit_logs', label: 'Audit Logs',          icon: 'history',             desc: 'Activity & security logs' },
    { key: 'settings',   label: 'Settings',            icon: 'settings',            desc: 'Dealership configuration & feedback' },
    { key: 'incentives',  label: 'Incentives & Rankings', icon: 'workspace_premium', desc: 'View incentives, leaderboard & announcements' },
    { key: 'attendance',  label: 'Attendance',            icon: 'fingerprint',       desc: 'View own attendance, apply for leave' },
];

const DEPARTMENTS = ['Sales', 'Operations', 'Finance', 'CRM', 'Management', 'IT', 'Other'];

const emptyForm = {
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'staff' as 'admin' | 'staff',
    department: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

const UserManagement = () => {
    const { isAdmin, user: currentUser } = useAuth();

    if (!isAdmin) {
        return <Navigate to="/admin" replace />;
    }

    const [users, setUsers] = useState<StaffUser[]>([]);
    const [loading, setLoading] = useState(true);

    // Create modal
    const [isCreating, setIsCreating] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [createError, setCreateError] = useState('');
    const [createSuccess, setCreateSuccess] = useState('');

    // Permission editor modal
    const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
    const [perms, setPerms] = useState<PermissionMap>({});
    const [permLoading, setPermLoading] = useState(false);
    const [permSaving, setPermSaving] = useState(false);
    const [permSuccess, setPermSuccess] = useState(false);

    // Status toggle state
    const [statusTogglingId, setStatusTogglingId] = useState<string | null>(null);

    // ─── Fetch users ─────────────────────────────────────────────────────────

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, phone, role, department, is_active, created_at')
            .in('role', ['admin', 'staff'])
            .order('created_at', { ascending: true });

        if (!error && data) setUsers(data as StaffUser[]);
        setLoading(false);
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    // ─── Create user ─────────────────────────────────────────────────────────

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError('');
        setCreateSuccess('');
        if (!form.full_name || !form.email || !form.password) return;
        if (form.password.length < 8) {
            setCreateError('Password must be at least 8 characters.');
            return;
        }
        setSaving(true);

        try {
            // Always get a fresh session token directly from Supabase client
            const { data: { session: freshSession } } = await supabase.auth.getSession();
            if (!freshSession?.access_token) {
                setCreateError('Session expired. Please refresh and try again.');
                setSaving(false);
                return;
            }

            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-staff-user`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                        Authorization: `Bearer ${freshSession.access_token}`,
                    },
                    body: JSON.stringify({
                        email: form.email,
                        password: form.password,
                        full_name: form.full_name,
                        phone: form.phone,
                        role: form.role,
                        department: form.department,
                    }),
                }
            );

            const result = await res.json();
            if (!res.ok || result.error) {
                setCreateError(result.error || 'Failed to create user.');
            } else {
                setCreateSuccess(`✓ ${form.full_name} created successfully! Share the credentials with them.`);
                setForm(emptyForm);
                fetchUsers();
                
                // Audit log
                if (currentUser) {
                    try {
                        await supabase.from('audit_logs').insert({
                            user_id: currentUser.id,
                            action: 'User Created',
                            target_type: 'Staff Account',
                            target_name: form.full_name,
                            details: `Created new ${form.role} account`
                        });
                    } catch (e) {
                        console.error('Audit log failed', e);
                    }
                }
            }
        } catch {
            setCreateError('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    };



    // ─── Load permissions for edit modal ─────────────────────────────────────

    const openPermissionEditor = async (user: StaffUser) => {
        setEditingUser(user);
        setPermSuccess(false);
        setPermLoading(true);

        const { data } = await supabase
            .from('user_permissions')
            .select('module, can_view, can_manage')
            .eq('user_id', user.id);

        const map: PermissionMap = {};
        MODULES.forEach(m => { map[m.key] = { can_view: false, can_manage: false }; });
        if (data) {
            data.forEach((p: { module: string; can_view: boolean; can_manage: boolean }) => {
                map[p.module] = { can_view: p.can_view, can_manage: p.can_manage };
            });
        }
        setPerms(map);
        setPermLoading(false);
    };

    // Toggle helpers
    const toggleView = (moduleKey: string) => {
        setPerms(prev => {
            const current = prev[moduleKey] || { can_view: false, can_manage: false };
            const newView = !current.can_view;
            return {
                ...prev,
                [moduleKey]: {
                    can_view: newView,
                    can_manage: newView ? current.can_manage : false, // revoke manage if view revoked
                },
            };
        });
    };

    const toggleManage = (moduleKey: string) => {
        setPerms(prev => {
            const current = prev[moduleKey] || { can_view: false, can_manage: false };
            const newManage = !current.can_manage;
            return {
                ...prev,
                [moduleKey]: {
                    can_view: newManage ? true : current.can_view, // auto-grant view if manage enabled
                    can_manage: newManage,
                },
            };
        });
    };

    // ─── Save permissions ─────────────────────────────────────────────────────

    const savePermissions = async () => {
        if (!editingUser) return;
        setPermSaving(true);
        setPermSuccess(false);

        const rows = MODULES.map(m => ({
            user_id: editingUser.id,
            module: m.key,
            can_view: perms[m.key]?.can_view ?? false,
            can_manage: perms[m.key]?.can_manage ?? false,
            updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
            .from('user_permissions')
            .upsert(rows, { onConflict: 'user_id,module' });

        setPermSaving(false);
        if (!error) {
            setPermSuccess(true);
            
            // Audit log
            if (currentUser) {
                try {
                    await supabase.from('audit_logs').insert({
                        user_id: currentUser.id,
                        action: 'Permissions Updated',
                        target_type: 'Staff Account',
                        target_name: editingUser.full_name,
                        details: 'Modified module access permissions'
                    });
                } catch (e) {
                    console.error('Audit log failed', e);
                }
            }
        }
    };

    // ─── Toggle active status ─────────────────────────────────────────────────

    const toggleActiveStatus = async (user: StaffUser) => {
        setStatusTogglingId(user.id);
        const { error } = await supabase
            .from('profiles')
            .update({ is_active: !user.is_active })
            .eq('id', user.id);

        if (!error) {
            setEditingUser(prev => prev ? { ...prev, is_active: !user.is_active } : null);
            fetchUsers();
            
            // Audit log
            if (currentUser) {
                try {
                    await supabase.from('audit_logs').insert({
                        user_id: currentUser.id,
                        action: 'Status Changed',
                        target_type: 'Staff Account',
                        target_name: user.full_name,
                        details: `Account ${!user.is_active ? 'activated' : 'deactivated'}`
                    });
                } catch (e) {
                    console.error('Audit log failed', e);
                }
            }
        }
        setStatusTogglingId(null);
    };

    // ─── Helpers ──────────────────────────────────────────────────────────────

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    const getRoleBadge = (role: string) => {
        if (role === 'admin') return 'bg-primary/10 text-primary';
        return 'bg-amber-50 text-amber-700';
    };

    const getInitials = (name: string | null) =>
        (name ?? 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    // Permission summary for user card
    const getPermSummary = () => {
        const granted = Object.values(perms).filter(p => p.can_view).length;
        return `${granted} of ${MODULES.length} modules`;
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">User Management</h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {loading ? '…' : `${users.length} staff account${users.length !== 1 ? 's' : ''}`} · Create users and control their access.
                    </p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => { setIsCreating(true); setCreateError(''); setCreateSuccess(''); }}
                        className="h-10 px-5 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary-light transition-colors shadow-sm"
                    >
                        <span className="material-symbols-outlined text-lg">person_add</span>
                        Create User
                    </button>
                )}
            </div>

            {/* ── Users Table ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                <div className="overflow-x-auto relative">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                        <span className="size-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                        <p className="text-sm">Loading users…</p>
                    </div>
                ) : users.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-center">
                        <div className="size-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-3xl text-slate-300">manage_accounts</span>
                        </div>
                        <p className="text-slate-500 font-semibold">No staff users yet</p>
                        <p className="text-xs text-slate-400 mt-1">Create the first staff account to get started.</p>
                    </div>
                ) : (
                    <table className="w-full min-w-[600px]">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                <th className="text-left px-5 py-3">User</th>
                                <th className="text-left px-5 py-3">Contact</th>
                                <th className="text-left px-5 py-3">Role</th>
                                <th className="text-left px-5 py-3">Department</th>
                                <th className="text-left px-5 py-3">Status</th>
                                <th className="text-left px-5 py-3">Added</th>
                                <th className="text-left px-5 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className={`size-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${user.role === 'admin' ? 'bg-gradient-to-br from-primary to-primary-light text-white' : 'bg-amber-100 text-amber-700'}`}>
                                                {getInitials(user.full_name)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-primary">{user.full_name || '—'}</p>
                                                <p className="text-[10px] text-slate-400">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 text-sm text-slate-600">{user.phone || '—'}</td>
                                    <td className="px-5 py-3.5">
                                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg ${getRoleBadge(user.role)}`}>
                                            {user.role === 'admin' ? '⚡ Admin' : '👤 Staff'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-sm text-slate-500">{user.department || '—'}</td>
                                    <td className="px-5 py-3.5">
                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg ${user.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                            <span className={`size-1.5 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">{formatDate(user.created_at)}</td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-2">
                                            {isAdmin && user.role === 'staff' && (
                                                <button
                                                    onClick={() => openPermissionEditor(user)}
                                                    className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-sm">shield</span>
                                                    Permissions
                                                </button>
                                            )}
                                            {isAdmin && user.role === 'admin' && (
                                                <span className="text-[10px] text-slate-300 italic">Full access</span>
                                            )}

                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                </div>
            </div>

            {/* ── Info Banner ── */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-3">
                <span className="material-symbols-outlined text-blue-500 text-lg shrink-0 mt-0.5">info</span>
                <div>
                    <p className="text-xs font-bold text-blue-700">How User Access Works</p>
                    <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
                        <strong>Admin</strong> users have full unrestricted access to all modules.
                        <strong> Staff</strong> users can only view or manage modules explicitly granted via the Permissions editor.
                        Toggling <em>Manage</em> automatically grants <em>View</em> access.
                        Revoking <em>View</em> also revokes <em>Manage</em>.
                    </p>
                </div>
            </div>

            {/* ══════════════════════════════════════════════
                ── Create User Modal ──
            ══════════════════════════════════════════════ */}
            {isCreating && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">

                        {/* Header */}
                        <div className="bg-gradient-to-r from-primary to-primary-light px-6 pt-6 pb-7">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white text-xl">person_add</span>
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-white">Create Staff User</h2>
                                        <p className="text-white/60 text-xs">Share credentials with the staff member.</p>
                                    </div>
                                </div>
                                <button onClick={() => { setIsCreating(false); setCreateError(''); setCreateSuccess(''); }}
                                    className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                                    <span className="material-symbols-outlined text-white text-lg">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

                            {createError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm shrink-0">error</span>{createError}
                                </div>
                            )}

                            {createSuccess && (
                                <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl px-4 py-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm shrink-0">check_circle</span>{createSuccess}
                                </div>
                            )}

                            {/* Full Name */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Full Name <span className="text-red-400">*</span></label>
                                <input required type="text" value={form.full_name}
                                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                                    placeholder="e.g. Raj Sharma"
                                    className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Email Address <span className="text-red-400">*</span></label>
                                <input required type="email" value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    placeholder="raj@newmaharashtramotors.com"
                                    className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                    Temporary Password <span className="text-red-400">*</span>
                                    <span className="text-slate-400 font-normal ml-1">(min. 8 chars — share this with the user)</span>
                                </label>
                                <div className="relative">
                                    <input required type={showPassword ? 'text' : 'password'} value={form.password}
                                        onChange={e => setForm({ ...form, password: e.target.value })}
                                        placeholder="••••••••"
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 pr-12 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Phone + Role */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Phone <span className="text-slate-400 font-normal">(optional)</span></label>
                                    <input type="tel" value={form.phone}
                                        onChange={e => setForm({ ...form, phone: e.target.value })}
                                        placeholder="9876543210"
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Role <span className="text-red-400">*</span></label>
                                    <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as 'admin' | 'staff' })}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                        <option value="staff">Staff (restricted)</option>
                                        <option value="admin">Admin (full access)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Department */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Department <span className="text-slate-400 font-normal">(optional)</span></label>
                                <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                                    className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                    <option value="">Select department…</option>
                                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>

                            {/* Role warning */}
                            {form.role === 'admin' && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-amber-500 text-sm shrink-0">warning</span>
                                    <p className="text-xs text-amber-700">Admin users get <strong>full unrestricted access</strong> to all modules. Set permissions after creating a Staff user instead.</p>
                                </div>
                            )}

                            <div className="pt-1">
                                <button type="submit" disabled={saving}
                                    className="w-full h-12 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70">
                                    {saving
                                        ? <><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</>
                                        : <><span className="material-symbols-outlined text-lg">person_add</span> Create User</>
                                    }
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                ── Permission Editor Modal ──
            ══════════════════════════════════════════════ */}
            {editingUser && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">

                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 pt-6 pb-7 shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-11 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-base font-black shrink-0">
                                        {getInitials(editingUser.full_name)}
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-white">{editingUser.full_name}</h2>
                                        <p className="text-white/50 text-xs">{editingUser.email} · {editingUser.department || 'No department'}</p>
                                    </div>
                                </div>
                                <button onClick={() => { setEditingUser(null); setPermSuccess(false); }}
                                    className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                                    <span className="material-symbols-outlined text-white text-lg">close</span>
                                </button>
                            </div>

                            {/* Active toggle */}
                            <div className="mt-4 flex items-center justify-between bg-white/10 rounded-xl px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                    <span className={`size-2 rounded-full ${editingUser.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                                    <span className="text-xs font-semibold text-white/80">
                                        Account {editingUser.is_active ? 'Active' : 'Deactivated'}
                                    </span>
                                </div>
                                <button onClick={() => toggleActiveStatus(editingUser)}
                                    disabled={statusTogglingId === editingUser.id}
                                    className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 ${editingUser.is_active ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'}`}>
                                    {statusTogglingId === editingUser.id && <span className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                                    {editingUser.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                            </div>
                        </div>

                        {/* Module permissions grid */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Module Access Control</p>
                                {!permLoading && <p className="text-xs text-slate-400">{getPermSummary()} with view access</p>}
                            </div>

                            {permLoading ? (
                                <div className="py-12 flex items-center justify-center">
                                    <span className="size-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                                </div>
                            ) : (
                                <>
                                    {/* Column headers */}
                                    <div className="grid grid-cols-[1fr_84px_90px] gap-2 mb-2 px-3">
                                        <span />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center">View</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center">Manage</span>
                                    </div>

                                    <div className="space-y-1.5">
                                        {MODULES.map(mod => {
                                            const p = perms[mod.key] || { can_view: false, can_manage: false };
                                            return (
                                                <div key={mod.key}
                                                    className={`grid grid-cols-[1fr_84px_90px] gap-2 items-center rounded-xl px-3 py-2.5 transition-colors ${p.can_view || p.can_manage ? 'bg-primary/5 border border-primary/10' : 'bg-slate-50'}`}>
                                                    {/* Module info */}
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${p.can_view || p.can_manage ? 'bg-primary/10' : 'bg-slate-100'}`}>
                                                            <span className={`material-symbols-outlined text-sm ${p.can_view || p.can_manage ? 'text-primary' : 'text-slate-400'}`}>
                                                                {mod.icon}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <p className={`text-sm font-semibold ${p.can_view || p.can_manage ? 'text-primary' : 'text-slate-600'}`}>{mod.label}</p>
                                                            <p className="text-[10px] text-slate-400">{mod.desc}</p>
                                                        </div>
                                                    </div>

                                                    {/* View toggle */}
                                                    <div className="flex justify-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleView(mod.key)}
                                                            className={`size-8 rounded-lg flex items-center justify-center transition-all ${p.can_view ? 'bg-blue-500 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-300 hover:border-blue-300 hover:text-blue-400'}`}
                                                            title={p.can_view ? 'Revoke view' : 'Grant view'}>
                                                            <span className="material-symbols-outlined text-base">
                                                                {p.can_view ? 'visibility' : 'visibility_off'}
                                                            </span>
                                                        </button>
                                                    </div>

                                                    {/* Manage toggle */}
                                                    <div className="flex justify-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleManage(mod.key)}
                                                            className={`size-8 rounded-lg flex items-center justify-center transition-all ${p.can_manage ? 'bg-green-500 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-300 hover:border-green-300 hover:text-green-400'}`}
                                                            title={p.can_manage ? 'Revoke manage' : 'Grant manage'}>
                                                            <span className="material-symbols-outlined text-base">
                                                                {p.can_manage ? 'edit' : 'edit_off'}
                                                            </span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-4 bg-slate-50 rounded-xl px-4 py-3 flex items-start gap-2">
                                        <span className="material-symbols-outlined text-slate-400 text-sm shrink-0 mt-0.5">info</span>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">
                                            <strong className="text-blue-600">View</strong> — user can see this section in the sidebar and read data. &nbsp;
                                            <strong className="text-green-600">Manage</strong> — user can create, edit, and delete records. Enabling Manage auto-grants View.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 px-6 pb-6 pt-4 border-t border-slate-100">
                            {permSuccess && (
                                <div className="mb-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl px-4 py-2.5 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                    Permissions saved! Changes take effect on the user's next login or page refresh.
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button onClick={() => { setEditingUser(null); setPermSuccess(false); }}
                                    className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 transition-colors">
                                    Close
                                </button>
                                <button onClick={savePermissions} disabled={permSaving}
                                    className="flex-1 h-11 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary-light transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70">
                                    {permSaving
                                        ? <><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                                        : <><span className="material-symbols-outlined text-base">save</span> Save Permissions</>
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
};

export default UserManagement;
