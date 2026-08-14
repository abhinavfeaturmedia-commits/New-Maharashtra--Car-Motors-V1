import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase, createIsolatedClient } from '../../lib/supabase';
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
    { key: 'dashboard',   label: 'Dashboard',             icon: 'dashboard',           desc: 'Main overview & KPIs' },
    { key: 'inventory',   label: 'Inventory & Stock',     icon: 'directions_car',      desc: 'Vehicle stock & consignment management' },
    { key: 'leads',       label: 'Leads & Enquiries',     icon: 'people',              desc: 'Lead pipeline, follow-ups & assignments' },
    { key: 'sales',       label: 'Sales & Invoices',      icon: 'point_of_sale',       desc: 'Sales transactions & revenue tracking' },
    { key: 'bookings',    label: 'Bookings & Planner',    icon: 'event',               desc: 'Test drives, appointments & schedule' },
    { key: 'analytics',   label: 'Analytics & Reports',   icon: 'analytics',           desc: 'Performance metrics, charts & exports' },
    { key: 'crm',         label: 'CRM & Customers',       icon: 'contacts',            desc: 'Customer records, history & alerts' },
    { key: 'operations',  label: 'Operations & Docs',     icon: 'checklist',           desc: 'Expenses, catalogs & share logs' },
    { key: 'finance',     label: 'Finance & Accounts',    icon: 'account_balance',     desc: 'Ledgers, commissions & GST tax' },
    { key: 'schedule',    label: 'Schedule & Comms',      icon: 'calendar_month',      desc: 'Calendar & WhatsApp templates' },
    { key: 'dealers',     label: 'Dealer Partners',       icon: 'store',               desc: 'B2B partner dealership network' },
    { key: 'incentives',  label: 'Incentives & Targets',  icon: 'workspace_premium',   desc: 'Incentive calculation & leaderboards' },
    { key: 'attendance',  label: 'Attendance & HR',       icon: 'fingerprint',         desc: 'Staff clock-in records & leave logs' },
    { key: 'audit_logs',  label: 'Audit Logs',            icon: 'history',             desc: 'Security activity & audit trail' },
    { key: 'settings',    label: 'Settings',              icon: 'settings',            desc: 'Dealership master configuration' },
];

const DEPARTMENTS = ['Sales', 'Operations', 'Finance', 'CRM', 'Management', 'Service', 'IT', 'Other'];

const emptyForm = {
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'staff' as 'admin' | 'staff',
    department: 'Sales',
};

// Helper: Generate Random Strong Password
const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    // Ensure uppercase, lowercase, number, symbol
    pwd += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)];
    pwd += 'abcdefghijkmnpqrstuvwxyz'[Math.floor(Math.random() * 24)];
    pwd += '23456789'[Math.floor(Math.random() * 8)];
    pwd += '!@#$%&*' [Math.floor(Math.random() * 7)];
    for (let i = 0; i < 6; i++) {
        pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
};

// ─── Component ────────────────────────────────────────────────────────────────

const UserManagement: React.FC = () => {
    const { isAdmin, user: currentUser } = useAuth();

    if (!isAdmin) {
        return <Navigate to="/admin" replace />;
    }

    const [users, setUsers] = useState<StaffUser[]>([]);
    const [loading, setLoading] = useState(true);

    // Search & Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'staff'>('all');
    const [deptFilter, setDeptFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

    // Create modal state
    const [isCreating, setIsCreating] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [createError, setCreateError] = useState('');
    const [createdCredentials, setCreatedCredentials] = useState<{
        name: string;
        email: string;
        password: string;
        role: string;
        department: string;
    } | null>(null);
    const [copiedCreds, setCopiedCreds] = useState(false);

    // Edit user modal state
    const [editingProfileUser, setEditingProfileUser] = useState<StaffUser | null>(null);
    const [editForm, setEditForm] = useState({
        full_name: '',
        phone: '',
        role: 'staff' as 'admin' | 'staff',
        department: '',
    });
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState('');

    // Change Password modal state
    const [passwordUser, setPasswordUser] = useState<StaffUser | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [copiedNewPwd, setCopiedNewPwd] = useState(false);

    // Delete confirmation modal state
    const [deletingUser, setDeletingUser] = useState<StaffUser | null>(null);
    const [deleteSaving, setDeleteSaving] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    // Permission editor modal state
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
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email, phone, role, department, is_active, created_at')
                .in('role', ['admin', 'staff', 'owner'])
                .order('created_at', { ascending: false });

            if (!error && data) {
                setUsers(data as StaffUser[]);
            } else if (error) {
                console.error('Error fetching staff users:', error);
            }
        } catch (err) {
            console.error('Unexpected error fetching users:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // ─── Create user ─────────────────────────────────────────────────────────

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError('');
        setCopiedCreds(false);

        const fullName = form.full_name.trim();
        const email = form.email.trim().toLowerCase();
        const password = form.password;
        const phone = form.phone.trim();

        if (!fullName) {
            setCreateError('Please enter full name.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            setCreateError('Please provide a valid email address.');
            return;
        }

        if (password.length < 8) {
            setCreateError('Temporary password must be at least 8 characters.');
            return;
        }

        setSaving(true);

        try {
            // Instantiate an isolated secondary client to avoid overriding current admin session
            const tempClient = createIsolatedClient();

            // Register user in Supabase Auth
            const { data: authData, error: authError } = await tempClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullName,
                        role: form.role,
                        department: form.department || null,
                        phone: phone || null,
                    }
                }
            });

            if (authError) {
                if (authError.message.toLowerCase().includes('already registered') || authError.message.toLowerCase().includes('already exists')) {
                    setCreateError('An account with this email address already exists in the system.');
                } else if (authError.message.toLowerCase().includes('weak_password')) {
                    setCreateError('Password is too weak. Please use a stronger combination of letters and numbers.');
                } else {
                    setCreateError(authError.message || 'Failed to create user account.');
                }
                return;
            }

            // In Supabase, if email is already taken and confirmations are on, identities array is empty
            if (authData?.user && authData.user.identities && authData.user.identities.length === 0) {
                setCreateError('An account with this email already exists.');
                return;
            }

            if (authData?.user) {
                const newUserId = authData.user.id;

                // Synchronize profile row into public.profiles
                const { error: profileError } = await supabase.from('profiles').upsert({
                    id: newUserId,
                    full_name: fullName,
                    email: email,
                    phone: phone || null,
                    role: form.role,
                    department: form.department || null,
                    is_active: true,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });

                if (profileError) {
                    console.warn('Profile upsert note:', profileError.message);
                }

                // Populate default module permissions
                const defaultPermRows = MODULES.map(m => ({
                    user_id: newUserId,
                    module: m.key,
                    can_view: true,
                    can_manage: form.role === 'admin' || (m.key !== 'audit_logs' && m.key !== 'settings'),
                    updated_at: new Date().toISOString()
                }));

                const { error: permError } = await supabase
                    .from('user_permissions')
                    .upsert(defaultPermRows, { onConflict: 'user_id,module' });

                if (permError) {
                    console.warn('Permissions seeding note:', permError.message);
                }

                // Audit log entry
                if (currentUser) {
                    try {
                        await supabase.from('audit_logs').insert({
                            user_id: currentUser.id,
                            action: 'User Created',
                            target_type: 'Staff Account',
                            target_name: fullName,
                            details: `Created new ${form.role} user (${email}) in ${form.department || 'General'} department`
                        });
                    } catch (e) {
                        console.error('Audit log record failed', e);
                    }
                }

                // Store credentials for modal display
                setCreatedCredentials({
                    name: fullName,
                    email: email,
                    password: password,
                    role: form.role,
                    department: form.department || 'General',
                });

                setForm(emptyForm);
                await fetchUsers();
            } else {
                setCreateError('User registration did not return a valid user ID. Please try again.');
            }
        } catch (err: any) {
            console.error('User creation exception:', err);
            setCreateError(err.message || 'Failed to create user. Please check internet connection.');
        } finally {
            setSaving(false);
        }
    };

    // ─── Change Password ──────────────────────────────────────────────────────

    const openChangePassword = (user: StaffUser) => {
        setPasswordUser(user);
        setNewPassword('');
        setConfirmPassword('');
        setPasswordError('');
        setPasswordSuccess('');
        setCopiedNewPwd(false);
    };

    const handleSavePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passwordUser) return;
        setPasswordError('');
        setPasswordSuccess('');

        if (newPassword.length < 8) {
            setPasswordError('Password must be at least 8 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match. Please verify.');
            return;
        }

        setPasswordSaving(true);

        try {
            const { data, error } = await supabase.rpc('admin_change_user_password', {
                target_user_id: passwordUser.id,
                new_password: newPassword
            });

            if (error) {
                throw new Error(error.message || 'Failed to update password.');
            }

            setPasswordSuccess(`Password updated successfully for ${passwordUser.full_name || passwordUser.email}!`);
        } catch (err: any) {
            console.error('Password reset error:', err);
            setPasswordError(err.message || 'Failed to update password. Ensure you are logged in as admin.');
        } finally {
            setPasswordSaving(false);
        }
    };

    const copyNewPasswordToClipboard = () => {
        if (!passwordUser || !newPassword) return;
        const text = `*New Maharashtra Car Motors - Updated Credentials*\n\n` +
            `👤 *User:* ${passwordUser.full_name || 'Staff User'}\n` +
            `📧 *Email:* ${passwordUser.email}\n` +
            `🔑 *New Password:* ${newPassword}\n` +
            `🔗 *Login Portal:* ${window.location.origin}/admin/login`;

        navigator.clipboard.writeText(text);
        setCopiedNewPwd(true);
        setTimeout(() => setCopiedNewPwd(false), 3000);
    };

    // ─── Delete User ──────────────────────────────────────────────────────────

    const openDeleteModal = (user: StaffUser) => {
        setDeletingUser(user);
        setDeleteError('');
    };

    const handleConfirmDelete = async () => {
        if (!deletingUser) return;
        setDeleteSaving(true);
        setDeleteError('');

        try {
            const { data, error } = await supabase.rpc('admin_delete_user', {
                target_user_id: deletingUser.id
            });

            if (error) {
                throw new Error(error.message || 'Failed to delete user account.');
            }

            await fetchUsers();
            setDeletingUser(null);
        } catch (err: any) {
            console.error('User deletion error:', err);
            setDeleteError(err.message || 'Failed to delete user. Please try again.');
        } finally {
            setDeleteSaving(false);
        }
    };

    // ─── Edit Profile ─────────────────────────────────────────────────────────

    const openEditProfile = (user: StaffUser) => {
        setEditingProfileUser(user);
        setEditError('');
        setEditForm({
            full_name: user.full_name || '',
            phone: user.phone || '',
            role: user.role,
            department: user.department || '',
        });
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProfileUser) return;
        setEditSaving(true);
        setEditError('');

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: editForm.full_name.trim(),
                    phone: editForm.phone.trim() || null,
                    role: editForm.role,
                    department: editForm.department || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingProfileUser.id);

            if (error) throw error;

            // Audit log
            if (currentUser) {
                await supabase.from('audit_logs').insert({
                    user_id: currentUser.id,
                    action: 'Profile Updated',
                    target_type: 'Staff Account',
                    target_name: editForm.full_name,
                    details: `Updated details for ${editingProfileUser.email}`
                });
            }

            await fetchUsers();
            setEditingProfileUser(null);
        } catch (err: any) {
            console.error('Profile update failed:', err);
            setEditError(err.message || 'Failed to update profile.');
        } finally {
            setEditSaving(false);
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
                    can_manage: newView ? current.can_manage : false,
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
                    can_view: newManage ? true : current.can_view,
                    can_manage: newManage,
                },
            };
        });
    };

    // Quick Presets
    const applyPreset = (type: 'all' | 'none' | 'sales' | 'operations' | 'finance') => {
        const updated: PermissionMap = {};
        MODULES.forEach(m => {
            if (type === 'all') {
                updated[m.key] = { can_view: true, can_manage: true };
            } else if (type === 'none') {
                updated[m.key] = { can_view: false, can_manage: false };
            } else if (type === 'sales') {
                const isSalesRelated = ['dashboard', 'inventory', 'leads', 'sales', 'bookings', 'crm', 'incentives', 'attendance'].includes(m.key);
                updated[m.key] = { can_view: isSalesRelated, can_manage: isSalesRelated };
            } else if (type === 'operations') {
                const isOpsRelated = ['dashboard', 'inventory', 'bookings', 'operations', 'attendance'].includes(m.key);
                updated[m.key] = { can_view: isOpsRelated, can_manage: isOpsRelated };
            } else if (type === 'finance') {
                const isFinRelated = ['dashboard', 'sales', 'finance', 'operations', 'analytics', 'attendance'].includes(m.key);
                updated[m.key] = { can_view: isFinRelated, can_manage: isFinRelated };
            }
        });
        setPerms(updated);
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
            await fetchUsers();

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

    // ─── Copy Credentials Helper ─────────────────────────────────────────────

    const copyCredentialsToClipboard = () => {
        if (!createdCredentials) return;
        const text = `*New Maharashtra Car Motors - Staff Login Details*\n\n` +
            `👤 *Name:* ${createdCredentials.name}\n` +
            `📧 *Email:* ${createdCredentials.email}\n` +
            `🔑 *Temporary Password:* ${createdCredentials.password}\n` +
            `🏢 *Department:* ${createdCredentials.department}\n` +
            `🛡️ *Role:* ${createdCredentials.role === 'admin' ? 'Admin' : 'Staff'}\n\n` +
            `🔗 *Login Portal:* ${window.location.origin}/admin/login`;

        navigator.clipboard.writeText(text);
        setCopiedCreds(true);
        setTimeout(() => setCopiedCreds(false), 3000);
    };

    // ─── Filtered Users ───────────────────────────────────────────────────────

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const query = searchQuery.toLowerCase();
            const matchesSearch = !query ||
                (u.full_name?.toLowerCase().includes(query) ?? false) ||
                (u.email?.toLowerCase().includes(query) ?? false) ||
                (u.phone?.toLowerCase().includes(query) ?? false);

            const matchesRole = roleFilter === 'all' || u.role === roleFilter;
            const matchesDept = deptFilter === 'all' || (u.department || 'Other') === deptFilter;
            const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? u.is_active : !u.is_active);

            return matchesSearch && matchesRole && matchesDept && matchesStatus;
        });
    }, [users, searchQuery, roleFilter, deptFilter, statusFilter]);

    // ─── Metrics ─────────────────────────────────────────────────────────────

    const totalStaff = users.length;
    const activeStaff = users.filter(u => u.is_active && u.role === 'staff').length;
    const adminCount = users.filter(u => u.role === 'admin').length;
    const departmentsCount = new Set(users.map(u => u.department).filter(Boolean)).size;

    // ─── Helpers ──────────────────────────────────────────────────────────────

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    const getRoleBadge = (role: string) => {
        if (role === 'admin') return 'bg-purple-100 text-purple-800 border-purple-200';
        return 'bg-amber-100 text-amber-800 border-amber-200';
    };

    const getInitials = (name: string | null) =>
        (name ?? 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const getPermSummary = () => {
        const granted = Object.values(perms).filter(p => p.can_view).length;
        return `${granted} of ${MODULES.length} modules`;
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">

            {/* ── Header & Primary Action ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">
                        User <span className="font-serif-italic font-normal text-amber-600">Management</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        Manage staff users, passwords, access control, and account lifecycles.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setIsCreating(true);
                        setCreateError('');
                        setCreatedCredentials(null);
                    }}
                    className="h-11 px-5 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                >
                    <span className="material-symbols-outlined text-lg">person_add</span>
                    Create Staff User
                </button>
            </div>

            {/* ── Quick KPI Stat Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
                    <div className="size-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-xl">group</span>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-400">Total Accounts</p>
                        <p className="text-xl font-black text-slate-800">{totalStaff}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
                    <div className="size-11 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-xl">badge</span>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-400">Active Staff</p>
                        <p className="text-xl font-black text-slate-800">{activeStaff}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
                    <div className="size-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-400">Administrators</p>
                        <p className="text-xl font-black text-slate-800">{adminCount}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
                    <div className="size-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-xl">domain</span>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-400">Departments</p>
                        <p className="text-xl font-black text-slate-800">{departmentsCount}</p>
                    </div>
                </div>
            </div>

            {/* ── Filters & Search Bar ── */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
                {/* Search */}
                <div className="relative w-full md:w-80">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search name, email, phone…"
                        className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all"
                    />
                </div>

                {/* Filter Badges */}
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value as any)}
                        className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none cursor-pointer"
                    >
                        <option value="all">All Roles</option>
                        <option value="staff">Staff Only</option>
                        <option value="admin">Admins Only</option>
                    </select>

                    <select
                        value={deptFilter}
                        onChange={e => setDeptFilter(e.target.value)}
                        className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none cursor-pointer"
                    >
                        <option value="all">All Departments</option>
                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none cursor-pointer"
                    >
                        <option value="all">All Statuses</option>
                        <option value="active">Active Only</option>
                        <option value="inactive">Inactive Only</option>
                    </select>
                </div>
            </div>

            {/* ── Users Table ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                <div className="overflow-x-auto relative">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                            <span className="size-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                            <p className="text-sm">Loading staff users…</p>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-center">
                            <div className="size-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-300">
                                <span className="material-symbols-outlined text-3xl">manage_accounts</span>
                            </div>
                            <p className="text-slate-600 font-bold">No matching users found</p>
                            <p className="text-xs text-slate-400 mt-1">Try clearing filters or click &quot;Create Staff User&quot; above.</p>
                        </div>
                    ) : (
                        <table className="w-full min-w-[750px]">
                            <thead>
                                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50/50">
                                    <th className="text-left px-5 py-3.5">User</th>
                                    <th className="text-left px-5 py-3.5">Contact</th>
                                    <th className="text-left px-5 py-3.5">Role</th>
                                    <th className="text-left px-5 py-3.5">Department</th>
                                    <th className="text-left px-5 py-3.5">Status</th>
                                    <th className="text-left px-5 py-3.5">Created</th>
                                    <th className="text-right px-5 py-3.5">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => {
                                    const isSelf = currentUser?.id === user.id;

                                    return (
                                        <tr key={user.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                                            {/* User Details */}
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${user.role === 'admin' ? 'bg-gradient-to-br from-primary to-primary-light text-white shadow-sm' : 'bg-amber-100 text-amber-800'}`}>
                                                        {getInitials(user.full_name)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="text-sm font-bold text-slate-800">{user.full_name || '—'}</p>
                                                            {isSelf && (
                                                                <span className="text-[9px] font-extrabold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">
                                                                    YOU
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-slate-400 font-mono">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Contact */}
                                            <td className="px-5 py-3.5 text-xs text-slate-600 font-medium">
                                                {user.phone ? (
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[13px] text-slate-400">call</span>
                                                        {user.phone}
                                                    </span>
                                                ) : '—'}
                                            </td>

                                            {/* Role */}
                                            <td className="px-5 py-3.5">
                                                <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border ${getRoleBadge(user.role)}`}>
                                                    {user.role === 'admin' ? '⚡ Admin' : '👤 Staff'}
                                                </span>
                                            </td>

                                            {/* Department */}
                                            <td className="px-5 py-3.5 text-xs font-semibold text-slate-600">
                                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                                                    {user.department || 'General'}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-5 py-3.5">
                                                <button
                                                    onClick={() => toggleActiveStatus(user)}
                                                    disabled={statusTogglingId === user.id || isSelf}
                                                    className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg transition-colors ${user.is_active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-600 hover:bg-red-100'} ${isSelf ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                                                    title={isSelf ? 'Cannot deactivate yourself' : 'Click to toggle status'}
                                                >
                                                    {statusTogglingId === user.id ? (
                                                        <span className="size-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <span className={`size-1.5 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                                                    )}
                                                    {user.is_active ? 'Active' : 'Inactive'}
                                                </button>
                                            </td>

                                            {/* Created At */}
                                            <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap font-mono">
                                                {formatDate(user.created_at)}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-5 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* Permissions (Staff only) */}
                                                    {user.role === 'staff' ? (
                                                        <button
                                                            onClick={() => openPermissionEditor(user)}
                                                            className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1.5 rounded-lg transition-colors"
                                                            title="Edit Module Permissions"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">shield</span>
                                                            <span className="hidden sm:inline">Permissions</span>
                                                        </button>
                                                    ) : null}

                                                    {/* Edit Profile */}
                                                    <button
                                                        onClick={() => openEditProfile(user)}
                                                        className="size-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                                                        title="Edit User Profile"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">edit</span>
                                                    </button>

                                                    {/* Change Password */}
                                                    <button
                                                        onClick={() => openChangePassword(user)}
                                                        className="size-8 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 flex items-center justify-center transition-colors"
                                                        title="Directly Reset Password"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">key</span>
                                                    </button>

                                                    {/* Delete User */}
                                                    <button
                                                        onClick={() => openDeleteModal(user)}
                                                        disabled={isSelf}
                                                        className={`size-8 rounded-lg flex items-center justify-center transition-colors ${isSelf ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-red-50 hover:bg-red-100 text-red-600'}`}
                                                        title={isSelf ? 'You cannot delete your own account' : 'Delete User Permanently'}
                                                    >
                                                        <span className="material-symbols-outlined text-sm">delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ── Info Banner ── */}
            <div className="bg-blue-50/80 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-blue-600 text-xl shrink-0 mt-0.5">verified_user</span>
                <div className="text-xs text-blue-900 space-y-1">
                    <p className="font-bold text-blue-950">Security & Account Operations</p>
                    <p className="text-blue-800 leading-relaxed">
                        • <strong>Instant Activation:</strong> Newly created staff users are automatically verified and can sign in immediately at <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-900">/admin/login</code>.<br />
                        • <strong>Direct Password Change:</strong> Admins can reset any staff member&apos;s password instantly using the <span className="inline-flex items-center text-amber-800 font-bold"><span className="material-symbols-outlined text-xs mr-0.5">key</span>Key</span> icon.<br />
                        • <strong>Safe Deletion:</strong> Removing a staff member safely unbinds leads and sales records to prevent database orphans.
                    </p>
                </div>
            </div>

            {/* ══════════════════════════════════════════════
                ── Create User Modal ──
            ══════════════════════════════════════════════ */}
            {isCreating && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">

                        {/* Header */}
                        <div className="bg-gradient-to-r from-primary to-primary-light px-6 pt-6 pb-7 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white text-xl">person_add</span>
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-white">Create Staff User</h2>
                                        <p className="text-white/70 text-xs">Create account and generate login credentials.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsCreating(false);
                                        setCreateError('');
                                        setCreatedCredentials(null);
                                    }}
                                    className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                                >
                                    <span className="material-symbols-outlined text-white text-lg">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Created Success View with Shareable Card */}
                        {createdCredentials ? (
                            <div className="p-6 space-y-5">
                                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
                                    <span className="material-symbols-outlined text-green-600 text-2xl shrink-0 mt-0.5">check_circle</span>
                                    <div>
                                        <p className="text-sm font-bold text-green-900">User Account Created Successfully!</p>
                                        <p className="text-xs text-green-700 mt-0.5">
                                            Account is verified and ready for instant login. Share these credentials with the team member.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 font-mono text-xs text-slate-800">
                                    <div className="flex justify-between border-b border-slate-200 pb-1.5 font-sans">
                                        <span className="text-slate-400 font-semibold">Account Details</span>
                                        <span className="text-primary font-bold">{createdCredentials.role.toUpperCase()}</span>
                                    </div>
                                    <p><strong className="text-slate-500 font-sans font-semibold">Name:</strong> {createdCredentials.name}</p>
                                    <p><strong className="text-slate-500 font-sans font-semibold">Email:</strong> {createdCredentials.email}</p>
                                    <p><strong className="text-slate-500 font-sans font-semibold">Password:</strong> <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">{createdCredentials.password}</span></p>
                                    <p><strong className="text-slate-500 font-sans font-semibold">Department:</strong> {createdCredentials.department}</p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={copyCredentialsToClipboard}
                                        className="flex-1 h-12 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-lg">
                                            {copiedCreds ? 'done' : 'content_copy'}
                                        </span>
                                        {copiedCreds ? 'Copied to Clipboard!' : 'Copy Login Details'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCreatedCredentials(null);
                                            setIsCreating(false);
                                        }}
                                        className="h-12 px-5 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-sm transition-colors"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Form */
                            <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

                                {createError && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm shrink-0">error</span>
                                        <span>{createError}</span>
                                    </div>
                                )}

                                {/* Full Name */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                        Full Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        value={form.full_name}
                                        onChange={e => setForm({ ...form, full_name: e.target.value })}
                                        placeholder="e.g. Rohit Sankpal"
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                        Email Address <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        required
                                        type="email"
                                        value={form.email}
                                        onChange={e => setForm({ ...form, email: e.target.value })}
                                        placeholder="rohit.sankpal@shrawello.com"
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                                    />
                                </div>

                                {/* Password */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-xs font-bold text-slate-600">
                                            Temporary Password <span className="text-red-400">*</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setForm({ ...form, password: generateStrongPassword() })}
                                            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                                            Generate
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            required
                                            type={showPassword ? 'text' : 'password'}
                                            value={form.password}
                                            onChange={e => setForm({ ...form, password: e.target.value })}
                                            placeholder="••••••••"
                                            className="w-full h-11 border border-slate-200 rounded-xl px-4 pr-12 text-sm outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            <span className="material-symbols-outlined text-lg">
                                                {showPassword ? 'visibility_off' : 'visibility'}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {/* Phone + Role */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                            Phone <span className="text-slate-400 font-normal">(optional)</span>
                                        </label>
                                        <input
                                            type="tel"
                                            value={form.phone}
                                            onChange={e => setForm({ ...form, phone: e.target.value })}
                                            placeholder="9876543210"
                                            className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                            Role <span className="text-red-400">*</span>
                                        </label>
                                        <select
                                            value={form.role}
                                            onChange={e => setForm({ ...form, role: e.target.value as 'admin' | 'staff' })}
                                            className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white"
                                        >
                                            <option value="staff">Staff (restricted access)</option>
                                            <option value="admin">Admin (full access)</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Department */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                        Department <span className="text-slate-400 font-normal">(optional)</span>
                                    </label>
                                    <select
                                        value={form.department}
                                        onChange={e => setForm({ ...form, department: e.target.value })}
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white"
                                    >
                                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>

                                {/* Role notice */}
                                {form.role === 'admin' && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-amber-600 text-sm shrink-0">warning</span>
                                        <p className="text-[11px] text-amber-800">
                                            Admin users have unrestricted access across all modules and audit records.
                                        </p>
                                    </div>
                                )}

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="w-full h-12 bg-primary hover:bg-primary-light text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
                                    >
                                        {saving ? (
                                            <>
                                                <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Creating User Account…
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-lg">person_add</span>
                                                Create User
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                ── Change Password Modal ──
            ══════════════════════════════════════════════ */}
            {passwordUser && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-5 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white text-xl">key</span>
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white">Reset User Password</h2>
                                    <p className="text-white/80 text-xs">{passwordUser.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setPasswordUser(null)}
                                className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                            >
                                <span className="material-symbols-outlined text-white text-lg">close</span>
                            </button>
                        </div>

                        {passwordSuccess ? (
                            <div className="p-6 space-y-4">
                                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
                                    <span className="material-symbols-outlined text-green-600 text-2xl shrink-0 mt-0.5">check_circle</span>
                                    <div>
                                        <p className="text-sm font-bold text-green-900">Password Changed Successfully!</p>
                                        <p className="text-xs text-green-700 mt-0.5">
                                            The user can now log in with the new password.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 font-mono text-xs text-slate-800">
                                    <p><strong className="text-slate-500 font-sans">User:</strong> {passwordUser.full_name || passwordUser.email}</p>
                                    <p><strong className="text-slate-500 font-sans">New Password:</strong> <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">{newPassword}</span></p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={copyNewPasswordToClipboard}
                                        className="flex-1 h-11 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-base">
                                            {copiedNewPwd ? 'done' : 'content_copy'}
                                        </span>
                                        {copiedNewPwd ? 'Copied!' : 'Copy New Credentials'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPasswordUser(null)}
                                        className="h-11 px-5 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-xs transition-colors"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSavePassword} className="p-6 space-y-4">
                                {passwordError && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm shrink-0">error</span>
                                        <span>{passwordError}</span>
                                    </div>
                                )}

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs font-bold text-slate-600">New Password (min. 8 chars)</label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const gen = generateStrongPassword();
                                                setNewPassword(gen);
                                                setConfirmPassword(gen);
                                            }}
                                            className="text-[11px] font-bold text-amber-700 hover:underline flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                                            Generate
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            required
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            placeholder="Enter new password"
                                            className="w-full h-11 border border-slate-200 rounded-xl px-4 pr-12 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            <span className="material-symbols-outlined text-lg">
                                                {showNewPassword ? 'visibility_off' : 'visibility'}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Confirm New Password</label>
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        required
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm new password"
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 font-mono"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setPasswordUser(null)}
                                        className="flex-1 h-11 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={passwordSaving}
                                        className="flex-1 h-11 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60"
                                    >
                                        {passwordSaving ? 'Updating…' : 'Update Password'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                ── Delete Confirmation Modal ──
            ══════════════════════════════════════════════ */}
            {deletingUser && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        <div className="bg-red-600 px-6 py-5 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white text-xl">delete_forever</span>
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white">Delete User Account</h2>
                                    <p className="text-white/80 text-xs">Permanent deletion action</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDeletingUser(null)}
                                className="size-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
                            >
                                <span className="material-symbols-outlined text-white text-lg">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {deleteError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3">
                                    {deleteError}
                                </div>
                            )}

                            <p className="text-xs text-slate-600 leading-relaxed">
                                Are you sure you want to permanently delete <strong>{deletingUser.full_name || deletingUser.email}</strong>?
                            </p>

                            <div className="bg-red-50/70 border border-red-200 rounded-2xl p-3.5 text-xs text-red-900 space-y-1.5">
                                <p className="font-bold flex items-center gap-1.5 text-red-950">
                                    <span className="material-symbols-outlined text-base text-red-600">warning</span>
                                    Important Cleanup Info
                                </p>
                                <p className="text-[11px] text-red-800 leading-relaxed">
                                    • The user will be immediately logged out and unable to log in.<br />
                                    • Assigned leads will safely return to the unassigned lead pool.<br />
                                    • Historical sales receipts remain recorded for accounting.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setDeletingUser(null)}
                                    className="flex-1 h-11 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    disabled={deleteSaving}
                                    className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60"
                                >
                                    {deleteSaving ? 'Deleting…' : 'Yes, Delete Account'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                ── Edit Profile Modal ──
            ══════════════════════════════════════════════ */}
            {editingProfileUser && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        <div className="bg-slate-800 px-6 py-5 flex items-center justify-between text-white">
                            <div>
                                <h2 className="text-base font-bold text-white">Edit User Profile</h2>
                                <p className="text-slate-400 text-xs">{editingProfileUser.email}</p>
                            </div>
                            <button onClick={() => setEditingProfileUser(null)} className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-lg">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
                            {editError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3">
                                    {editError}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.full_name}
                                    onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Phone Number</label>
                                <input
                                    type="tel"
                                    value={editForm.phone}
                                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                    placeholder="9876543210"
                                    className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Role</label>
                                    <select
                                        value={editForm.role}
                                        onChange={e => setEditForm({ ...editForm, role: e.target.value as any })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs bg-white"
                                    >
                                        <option value="staff">Staff</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Department</label>
                                    <select
                                        value={editForm.department}
                                        onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                                        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs bg-white"
                                    >
                                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingProfileUser(null)}
                                    className="flex-1 h-11 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={editSaving}
                                    className="flex-1 h-11 bg-primary hover:bg-primary-light text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                                >
                                    {editSaving ? 'Saving…' : 'Save Changes'}
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
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">

                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 pt-6 pb-6 shrink-0 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-11 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-black shrink-0">
                                        {getInitials(editingUser.full_name)}
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-white">{editingUser.full_name}</h2>
                                        <p className="text-white/60 text-xs">{editingUser.email} · {editingUser.department || 'General'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setEditingUser(null); setPermSuccess(false); }}
                                    className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                >
                                    <span className="material-symbols-outlined text-white text-lg">close</span>
                                </button>
                            </div>

                            {/* Presets Row */}
                            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center gap-2">
                                <span className="text-[11px] text-white/60 font-semibold mr-1">Quick Presets:</span>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('all')}
                                    className="text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded-lg transition-colors"
                                >
                                    Grant All
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('sales')}
                                    className="text-[10px] font-bold bg-blue-500/30 hover:bg-blue-500/40 text-blue-200 px-2.5 py-1 rounded-lg transition-colors"
                                >
                                    Sales Team
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('operations')}
                                    className="text-[10px] font-bold bg-purple-500/30 hover:bg-purple-500/40 text-purple-200 px-2.5 py-1 rounded-lg transition-colors"
                                >
                                    Operations
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('finance')}
                                    className="text-[10px] font-bold bg-green-500/30 hover:bg-green-500/40 text-green-200 px-2.5 py-1 rounded-lg transition-colors"
                                >
                                    Finance
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('none')}
                                    className="text-[10px] font-bold bg-red-500/20 hover:bg-red-500/30 text-red-200 px-2.5 py-1 rounded-lg transition-colors"
                                >
                                    Revoke All
                                </button>
                            </div>
                        </div>

                        {/* Module permissions grid */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Module Access Controls</p>
                                {!permLoading && <p className="text-xs font-bold text-primary">{getPermSummary()} granted</p>}
                            </div>

                            {permLoading ? (
                                <div className="py-12 flex items-center justify-center">
                                    <span className="size-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {/* Column headers */}
                                    <div className="grid grid-cols-[1fr_84px_90px] gap-2 mb-2 px-3">
                                        <span />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center">View</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center">Manage</span>
                                    </div>

                                    {MODULES.map(mod => {
                                        const p = perms[mod.key] || { can_view: false, can_manage: false };
                                        return (
                                            <div
                                                key={mod.key}
                                                className={`grid grid-cols-[1fr_84px_90px] gap-2 items-center rounded-xl px-3 py-2.5 transition-colors ${p.can_view || p.can_manage ? 'bg-primary/5 border border-primary/10' : 'bg-slate-50'}`}
                                            >
                                                {/* Module info */}
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${p.can_view || p.can_manage ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-400'}`}>
                                                        <span className="material-symbols-outlined text-sm">{mod.icon}</span>
                                                    </div>
                                                    <div>
                                                        <p className={`text-xs font-bold ${p.can_view || p.can_manage ? 'text-primary' : 'text-slate-600'}`}>{mod.label}</p>
                                                        <p className="text-[10px] text-slate-400">{mod.desc}</p>
                                                    </div>
                                                </div>

                                                {/* View toggle */}
                                                <div className="flex justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleView(mod.key)}
                                                        className={`size-8 rounded-lg flex items-center justify-center transition-all ${p.can_view ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-300 hover:border-blue-300 hover:text-blue-400'}`}
                                                        title={p.can_view ? 'Revoke view' : 'Grant view'}
                                                    >
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
                                                        className={`size-8 rounded-lg flex items-center justify-center transition-all ${p.can_manage ? 'bg-green-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-300 hover:border-green-300 hover:text-green-400'}`}
                                                        title={p.can_manage ? 'Revoke manage' : 'Grant manage'}
                                                    >
                                                        <span className="material-symbols-outlined text-base">
                                                            {p.can_manage ? 'edit' : 'edit_off'}
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 px-6 pb-6 pt-4 border-t border-slate-100 bg-slate-50/50">
                            {permSuccess && (
                                <div className="mb-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl px-4 py-2.5 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                    Permissions successfully updated and applied in real-time!
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setEditingUser(null); setPermSuccess(false); }}
                                    className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-100 transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    onClick={savePermissions}
                                    disabled={permSaving}
                                    className="flex-1 h-11 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
                                >
                                    {permSaving ? (
                                        <>
                                            <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Saving Changes…
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-base">save</span>
                                            Save Permissions
                                        </>
                                    )}
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
