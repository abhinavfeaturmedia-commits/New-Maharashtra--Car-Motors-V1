import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// ─── Loading Spinner (used while session initialises) ─────────────────────────

const AuthLoader: React.FC = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
            <div className="size-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-white text-2xl">directions_car</span>
            </div>
            <div className="flex gap-1.5">
                <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
            </div>
            <p className="text-sm text-slate-400 font-medium">Verifying session…</p>
        </div>
    </div>
);

// ─── Admin Route Guard ────────────────────────────────────────────────────────
// Redirects to /admin/login if the user is not logged in or not an admin.

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, profile, loading, isAdmin, isStaff } = useAuth();
    const location = useLocation();

    if (loading) return <AuthLoader />;

    // Not logged in at all
    if (!user) {
        return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }

    // Profile is still loading — show loader rather than flicker
    if (!profile) return <AuthLoader />;

    // Only admins and staff can access the admin panel
    // Customers are redirected to the public site
    if (!isAdmin && !isStaff) {
        return <Navigate to="/" replace />;
    }

    // Inactive staff accounts are blocked
    if ((isAdmin || isStaff) && profile.is_active === false) {
        return <Navigate to="/admin/login" replace />;
    }

    return <>{children}</>;
};

// ─── Module Route Guard ───────────────────────────────────────────────────────
// Protects individual routes based on module access permissions.

export const ModuleRoute: React.FC<{ module: string, children: React.ReactNode }> = ({ module, children }) => {
    const { hasPermission, isAdmin } = useAuth();
    
    // Admins always have access, staff must have explicitly granted 'view' permission for the module.
    if (!isAdmin && !hasPermission(module, 'view')) {
        return <Navigate to="/admin" replace />;
    }
    
    return <>{children}</>;
};

// ─── User Route Guard ─────────────────────────────────────────────────────────
// Redirects to /auth if the user is not logged in.

export const UserRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return <AuthLoader />;

    if (!user) {
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};
