import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    // If already logged in, redirect away
    React.useEffect(() => {
        if (user) {
            const from = (location.state as any)?.from?.pathname ?? '/dashboard';
            navigate(from, { replace: true });
        }
    }, [user, navigate, location]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            if (isLogin) {
                // ── Sign In ──────────────────────────────────────────
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                });
                if (signInError) {
                    setError('Invalid email or password. Please try again.');
                    return;
                }
                const from = (location.state as any)?.from?.pathname ?? '/dashboard';
                navigate(from, { replace: true });

            } else {
                // ── Sign Up ──────────────────────────────────────────
                const { error: signUpError } = await supabase.auth.signUp({
                    email: email.trim(),
                    password,
                    options: {
                        data: { full_name: name.trim() },
                    },
                });
                if (signUpError) {
                    setError(signUpError.message);
                    return;
                }
                setSuccessMsg('Account created! Please check your email to verify your account, then sign in.');
                setIsLogin(true);
                setPassword('');
            }
        } catch {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-72px)] flex">
            {/* Left Side - Brand */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-100 to-slate-200 relative items-center justify-center p-16">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://lh3.googleusercontent.com/aida-public/AB6AXuA1XK2L7EpsFR7K_eosnwu-nObzshJ1Ty2a8myYaJLGxNfVRumnjS7qbstQgmr0orhubbj2qWZONaSEPe_N7kcPM_1QfK25z_ISQyqhepk7R2dKxgZkvCaLxu1sknYBEuc8ql5XtjjvTxpkgGtcvcz9YskEEhJWegVcLP20ML2BowuulsKcxPJys4ux6Vi6vSqWwbUnsgtemZ2KMzcaeJsz8ZDBvA8U6qYDVmNQ5ksSaho1Svizzl2FUtSrad_4n_fgXjaKl4oo-CEH')] bg-cover bg-center opacity-10 blur-sm" />
                </div>
                <div className="relative z-10 max-w-md">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="size-12 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg">
                            <span className="material-symbols-outlined text-2xl">directions_car</span>
                        </div>
                        <h2 className="text-xl font-bold text-primary font-display">New Maharashtra Motors</h2>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-primary font-display leading-tight mb-6">
                        Experience the premium journey.
                    </h1>
                    <p className="text-slate-600 text-lg leading-relaxed mb-8">
                        Access your garage, schedule services, and explore our exclusive inventory. Join thousands of satisfied customers in Kolhapur.
                    </p>
                    <div className="flex items-center gap-6 text-sm text-slate-500">
                        <span className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-accent text-lg">verified</span>
                            Trusted Service
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-accent text-lg">build</span>
                            Genuine Parts
                        </span>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-16 bg-white">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-primary font-display mb-2">
                            {isLogin ? 'Welcome Back' : 'Create Account'}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {isLogin ? 'Sign in to your account to continue.' : 'Register to book services and track your cars.'}
                        </p>
                    </div>

                    {/* Login / Sign Up toggle */}
                    <div className="flex bg-slate-100 rounded-xl p-1 mb-8">
                        <button
                            onClick={() => { setIsLogin(true); setError(''); setSuccessMsg(''); }}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${isLogin ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
                        >
                            Login
                        </button>
                        <button
                            onClick={() => { setIsLogin(false); setError(''); setSuccessMsg(''); }}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${!isLogin ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
                        >
                            Sign Up
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5 flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg shrink-0">error</span>
                            {error}
                        </div>
                    )}

                    {/* Success */}
                    {successMsg && (
                        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-5 flex items-start gap-2">
                            <span className="material-symbols-outlined text-lg shrink-0">check_circle</span>
                            {successMsg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Name — Sign Up only */}
                        {!isLogin && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">person</span>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Enter your full name"
                                        className="w-full h-12 border border-slate-200 rounded-xl pl-11 pr-4 text-sm text-primary placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all"
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">mail</span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="w-full h-12 border border-slate-200 rounded-xl pl-11 pr-4 text-sm text-primary placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-slate-700">Password</label>
                                {isLogin && (
                                    <a href="#" className="text-xs font-semibold text-accent hover:underline">
                                        Forgot Password?
                                    </a>
                                )}
                            </div>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">lock</span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder={isLogin ? 'Enter your password' : 'Create a strong password'}
                                    className="w-full h-12 border border-slate-200 rounded-xl pl-11 pr-12 text-sm text-primary placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all"
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
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
                                    {isLogin ? 'Signing in…' : 'Creating account…'}
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg">
                                        {isLogin ? 'login' : 'person_add'}
                                    </span>
                                    {isLogin ? 'Sign In' : 'Create Account'}
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-xs text-slate-400 mt-8">
                        By continuing, you agree to our{' '}
                        <a href="#" className="text-accent font-semibold hover:underline">Terms of Service</a>
                        {' '}and{' '}
                        <a href="#" className="text-accent font-semibold hover:underline">Privacy Policy</a>.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Auth;
