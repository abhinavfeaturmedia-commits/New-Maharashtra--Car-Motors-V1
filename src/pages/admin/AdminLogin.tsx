import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { profile } = useAuth();

    // If already logged in as admin or staff, skip login page
    React.useEffect(() => {
        if (profile?.role === 'admin' || profile?.role === 'staff' || profile?.role === 'owner') {
            const from = (location.state as any)?.from?.pathname ?? '/admin';
            navigate(from, { replace: true });
        }
    }, [profile, navigate, location]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!isSupabaseConfigured) {
            setError('Authentication backend is unconfigured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Netlify Environment Variables.');
            setLoading(false);
            return;
        }

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (signInError) {
                const isFetchError = signInError.message?.toLowerCase().includes('failed to fetch') || signInError.message?.toLowerCase().includes('fetch');
                if (isFetchError) {
                    setError('Unable to connect to authentication server. Please check your internet connection or verify VITE_SUPABASE_URL setting on Netlify.');
                } else {
                    setError(signInError.message || 'Invalid email or password');
                }
                return;
            }

            if (!data.user) {
                setError('Login failed. Please try again.');
                return;
            }

            // Verify the user is an admin, owner, or staff
            const { data: profileData } = await supabase
                .from('profiles')
                .select('role, is_active')
                .eq('id', data.user.id)
                .single();

            const userRole = profileData?.role || data.user.user_metadata?.role;
            const isActive = profileData ? profileData.is_active : true;

            if (!userRole || !['admin', 'staff', 'owner'].includes(userRole)) {
                await supabase.auth.signOut();
                setError('Access denied. This portal is for staff, admin, and owner users only.');
                return;
            }

            if (isActive === false) {
                await supabase.auth.signOut();
                setError('Your account has been deactivated. Contact the administrator.');
                return;
            }

            // Success — redirect to intended page or dashboard
            const from = (location.state as any)?.from?.pathname ?? '/admin';
            navigate(from, { replace: true });

        } catch (err: any) {
            console.error('Admin login error:', err);
            setError('An unexpected connection error occurred. Please check network connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex font-body">
            {/* Left side — brand */}
            <div className="hidden lg:flex lg:w-[55%] bg-primary relative overflow-hidden items-center justify-center">
                <div className="absolute inset-0">
                    <img
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1XK2L7EpsFR7K_eosnwu-nObzshJ1Ty2a8myYaJLGxNfVRumnjS7qbstQgmr0orhubbj2qWZONaSEPe_N7kcPM_1QfK25z_ISQyqhepk7R2dKxgZkvCaLxu1sknYBEuc8ql5XtjjvTxpkgGtcvcz9YskEEhJWegVcLP20ML2BowuulsKcxPJys4ux6Vi6vSqWwbUnsgtemZ2KMzcaeJsz8ZDBvA8U6qYDVmNQ5ksSaho1Svizzl2FUtSrad_4n_fgXjaKl4oo-CEH"
                        alt=""
                        className="w-full h-full object-cover opacity-20"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-primary/60 to-primary" />
                </div>
                <div className="relative z-10 max-w-lg px-16">
                    <div className="flex items-center gap-3 mb-12">
                        <div className="size-14 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center border border-white/10">
                            <span className="material-symbols-outlined text-accent text-3xl">directions_car</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white font-display">New Maharashtra</h2>
                            <p className="text-white/60 text-sm">Motors Admin Panel</p>
                        </div>
                    </div>

                    <h1 className="text-4xl lg:text-5xl font-black text-white font-display leading-tight mb-6">
                        Manage Your <span className="text-accent">Dealership</span> with Precision.
                    </h1>
                    <p className="text-white/60 text-lg leading-relaxed mb-10">
                        Access your command center to track inventory, manage leads, monitor sales, and run daily operations — all from one powerful dashboard.
                    </p>

                    <div className="grid grid-cols-3 gap-6">
                        {[
                            { val: 'Live', label: 'Inventory', icon: 'inventory_2' },
                            { val: 'CRM', label: 'Leads', icon: 'people' },
                            { val: 'RLS', label: 'Secured', icon: 'shield' },
                        ].map(stat => (
                            <div key={stat.label} className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 text-center">
                                <span className="material-symbols-outlined text-accent text-xl mb-1 block">{stat.icon}</span>
                                <p className="text-xl font-black text-white font-display">{stat.val}</p>
                                <p className="text-[10px] text-white/50 uppercase font-bold tracking-wide">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right side — login form */}
            <div className="flex-1 flex items-center justify-center bg-white p-6 lg:p-16">
                <div className="w-full max-w-sm">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
                        <div className="size-11 bg-primary rounded-xl flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-xl">directions_car</span>
                        </div>
                        <span className="text-lg font-bold text-primary font-display">New Maharashtra Motors Admin</span>
                    </div>

                    <Link
                        to="/"
                        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary font-medium mb-8 group transition-colors"
                    >
                        <span className="material-symbols-outlined text-base group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
                        Back to Website
                    </Link>

                    <div className="mb-8">
                        <h2 className="text-2xl font-black text-primary font-display mb-2">Admin Login</h2>
                        <p className="text-sm text-slate-500">Sign in to access the dealership management panel.</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg shrink-0">error</span>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">mail</span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="admin@newmaharashtramotors.com"
                                    className="w-full h-12 border border-slate-200 rounded-xl pl-11 pr-4 text-sm text-primary placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-slate-700">Password</label>
                            </div>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">lock</span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full h-12 border border-slate-200 rounded-xl pl-11 pr-12 text-sm text-primary placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all"
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-gradient-to-r from-primary to-primary-light text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Signing in…
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg">login</span>
                                    Sign In to Dashboard
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                        <p className="text-xs text-slate-400">
                            This portal is restricted to authorized personnel only.
                        </p>
                        <Link
                            to="/"
                            className="inline-flex items-center justify-center gap-1.5 mt-4 h-9 px-4 w-full bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-100 transition-colors"
                        >
                            <span className="material-symbols-outlined text-base">home</span>
                            Go to New Maharashtra Motors Website
                        </Link>
                    </div>

                    <div className="mt-6 bg-slate-50 rounded-xl p-4 flex items-start gap-3">
                        <span className="material-symbols-outlined text-accent text-lg shrink-0">security</span>
                        <div>
                            <p className="text-xs font-bold text-primary mb-0.5">Secure Access</p>
                            <p className="text-[11px] text-slate-500">Authenticated via Supabase Auth. All activities are logged for security compliance.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
