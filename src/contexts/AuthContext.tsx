import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    role: 'admin' | 'customer' | 'staff';
    avatar_url: string | null;
    department: string | null;
    is_active: boolean;
}

interface UserPermission {
    module: string;
    can_view: boolean;
    can_manage: boolean;
}

interface AuthContextValue {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    loading: boolean;
    isAdmin: boolean;
    isStaff: boolean;
    permissions: Record<string, UserPermission>;
    hasPermission: (module: string, action: 'view' | 'manage') => boolean;
    signOut: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    isAdmin: false,
    isStaff: false,
    permissions: {},
    hasPermission: () => false,
    signOut: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [permissions, setPermissions] = useState<Record<string, UserPermission>>({});
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (!error && data) {
            setProfile(data as Profile);
            // Fetch permissions for non-admin users
            if (data.role !== 'admin') {
                await fetchPermissions(userId);
            } else {
                // Admins have all permissions implicitly — empty map, hasPermission always returns true
                setPermissions({});
            }
        } else {
            setProfile(null);
            setPermissions({});
        }
    };

    const fetchPermissions = async (userId: string) => {
        const { data, error } = await supabase
            .from('user_permissions')
            .select('module, can_view, can_manage')
            .eq('user_id', userId);

        if (!error && data) {
            const permMap: Record<string, UserPermission> = {};
            data.forEach((p: UserPermission) => {
                permMap[p.module] = p;
            });
            setPermissions(permMap);
        } else {
            setPermissions({});
        }
    };

    useEffect(() => {
        // Get initial session on mount
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id).finally(() => setLoading(false));
            } else {
                setLoading(false);
            }
        });

        // Listen to auth state changes (login / logout / token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setProfile(null);
                setPermissions({});
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        setPermissions({});
    };

    const isAdmin = profile?.role === 'admin';
    const isStaff = profile?.role === 'staff';

    /**
     * Check if the current user has a given permission.
     * Admins always return true.
     * Staff users check their user_permissions record.
     */
    const hasPermission = (module: string, action: 'view' | 'manage'): boolean => {
        if (isAdmin) return true;
        const perm = permissions[module];
        if (!perm) return false;
        if (action === 'view') return perm.can_view;
        if (action === 'manage') return perm.can_manage;
        return false;
    };

    return (
        <AuthContext.Provider value={{
            user,
            session,
            profile,
            loading,
            isAdmin,
            isStaff,
            permissions,
            hasPermission,
            signOut,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = () => useContext(AuthContext);
