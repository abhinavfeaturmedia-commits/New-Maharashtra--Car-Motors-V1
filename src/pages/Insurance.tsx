import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Insurance = () => {
    const [form, setForm] = useState({ full_name: '', phone: '', car_model: '' });
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const set = (f: string, v: string) => setForm(prev => ({ ...prev, [f]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const { error: err } = await supabase.from('leads').insert({
            type: 'insurance',
            full_name: form.full_name.trim(),
            phone: form.phone.trim(),
            car_model: form.car_model.trim() || null,
            source: 'website_insurance',
        });

        if (err) setError('Something went wrong. Please call us directly.');
        else setSubmitted(true);
        setLoading(false);
    };

    return (
        <div className="w-full">
            {/* Hero */}
            <section className="relative bg-primary overflow-hidden">
                <div className="container-main py-16 lg:py-20">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div className="relative z-10">
                            <span className="inline-flex items-center gap-2 text-xs font-bold text-accent mb-4"><span className="material-symbols-outlined text-sm">verified</span> Trusted in Kolhapur</span>
                            <h1 className="text-4xl lg:text-5xl font-black text-white font-display leading-tight mb-4">Secure Your Drive with Confidence</h1>
                            <p className="text-slate-400 text-lg mb-6 max-w-lg">Comprehensive car insurance solutions tailored for you. Get instant quotes, enjoy hassle-free claims, and drive with peace of mind.</p>
                            <div className="flex flex-wrap gap-4 text-sm text-white/80">
                                {['Cashless Garages', '24/7 Support', 'Instant Renewal'].map(f => (
                                    <span key={f} className="flex items-center gap-1.5"><Check size={14} className="text-green-400" />{f}</span>
                                ))}
                            </div>
                            <div className="mt-8 rounded-2xl overflow-hidden aspect-[2/1] max-w-md shadow-xl">
                                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAaKaKnGbHYFJCDX_cjtEoTnOXSXRK1uOJAuY6xFM7kHp1lRjh4SrbIY13EtB-lwh_114ezqDBbNp5k2MOvbj_PNfwJjMA1w8u_fpQBxshaORXq2tfnEb1wSb7IgJcccWGiTcxGrHqjKxC1gRJADNvYzyCMnomGUynio4g4v59OhKtWfnneo_bWxmB6w4I_K-C3b35seWjirJAHTfQPNvbuys4WYUgrG9v6VQTl4drFcuU4qZnN88NmIXTdpXCdgnADTxWjYRYJuEfR" alt="Car Insurance" className="w-full h-full object-cover" />
                                <div className="absolute bottom-4 left-4 bg-primary/80 text-white text-xs font-bold px-3 py-1 rounded-lg backdrop-blur-sm">Your Safety, Our Priority</div>
                            </div>
                        </div>

                        {/* Estimate Form */}
                        <div className="bg-white rounded-2xl p-8 shadow-xl">
                            {submitted ? (
                                <div className="text-center py-8">
                                    <div className="size-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <ShieldCheck size={32} className="text-blue-500" />
                                    </div>
                                    <h3 className="text-xl font-bold text-primary font-display mb-2">Quote Requested!</h3>
                                    <p className="text-sm text-slate-500 mb-6">Our insurance advisor will contact you on +91 {form.phone} with the best plans for your {form.car_model || 'car'}.</p>
                                    <button
                                        onClick={() => { setSubmitted(false); setForm({ full_name: '', phone: '', car_model: '' }); }}
                                        className="h-10 px-6 bg-primary text-white font-semibold rounded-xl text-sm hover:bg-primary-light transition-colors"
                                    >
                                        Check Another Vehicle
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <h3 className="text-xl font-bold text-primary font-display mb-2">Get an Estimate</h3>
                                    <p className="text-sm text-slate-500 mb-6">Fill the details to get a quote in minutes.</p>

                                    {error && (
                                        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-5 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg">error</span>{error}
                                        </div>
                                    )}

                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Full Name <span className="text-red-400">*</span></label>
                                            <input type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)} required disabled={loading} placeholder="Enter your full name" className="w-full h-12 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Phone Number <span className="text-red-400">*</span></label>
                                            <div className="flex">
                                                <span className="h-12 px-4 bg-slate-50 border border-r-0 border-slate-200 rounded-l-xl flex items-center text-sm text-slate-500">+91</span>
                                                <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} required disabled={loading} placeholder="10-digit mobile number" className="flex-1 h-12 border border-slate-200 rounded-r-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Vehicle Model</label>
                                            <div className="flex">
                                                <span className="h-12 px-4 bg-slate-50 border border-r-0 border-slate-200 rounded-l-xl flex items-center text-sm text-slate-400">🚗</span>
                                                <input type="text" value={form.car_model} onChange={e => set('car_model', e.target.value)} disabled={loading} placeholder="e.g. Swift Dzire ZDI" className="flex-1 h-12 border border-slate-200 rounded-r-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" />
                                            </div>
                                        </div>
                                        <button type="submit" disabled={loading} className="w-full h-12 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors text-sm flex items-center justify-center gap-2">
                                            {loading ? <span className="size-4 animate-spin border-2 border-white/30 border-t-white rounded-full"/> : <>Get Insurance Quote <ArrowRight size={16} /></>}
                                        </button>
                                        <p className="text-xs text-slate-400 text-center">By clicking, you agree to our Terms & Privacy Policy.</p>
                                    </form>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Services */}
            <section className="py-16 container-main">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-black text-primary font-display mb-2">Our Insurance Services</h2>
                    <p className="text-slate-500 max-w-xl mx-auto">We offer end-to-end insurance solutions tailored to your needs.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                    {[
                        { icon: 'shield', title: 'Buy New Policy', desc: 'Purchasing a new car? Get comprehensive coverage immediately with zero paperwork and instant policy issuance.', cta: 'Check Plans' },
                        { icon: 'autorenew', title: 'Policy Renewal', desc: 'Existing policy expiring? Renew it in minutes. Compare quotes from top insurers and save on premiums.', cta: 'Renew Now' },
                        { icon: 'support_agent', title: 'Claims Assistance', desc: 'Need to make a claim? Our dedicated support team in Kolhapur ensures quick settlement and cashless repairs.', cta: 'Get Support' },
                    ].map(s => (
                        <div key={s.title} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all">
                            <div className="size-12 rounded-xl bg-primary/5 flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-primary text-xl">{s.icon}</span>
                            </div>
                            <h3 className="font-bold text-primary font-display text-lg mb-2">{s.title}</h3>
                            <p className="text-sm text-slate-500 mb-4 leading-relaxed">{s.desc}</p>
                            <a href="#" className="text-sm font-semibold text-primary hover:text-accent inline-flex items-center gap-1">{s.cta} <ArrowRight size={14} /></a>
                        </div>
                    ))}
                </div>
            </section>

            {/* Partners */}
            <section className="py-12 border-y border-slate-100 bg-white">
                <div className="container-main">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-6">
                        <h3 className="font-bold text-primary font-display">Our Trusted Insurance Partners</h3>
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Licensed & Regulated</span>
                    </div>
                    <div className="flex flex-wrap gap-4 sm:gap-8 items-center">
                        {['HDFC ERGO', 'ICICI Lombard', 'TATA AIG', 'Bajaj Allianz', 'SBI General', 'Kotak'].map(p => (
                            <span key={p} className="text-sm font-semibold text-slate-400 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-slate-300" />{p}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="py-16 bg-primary">
                <div className="container-main grid md:grid-cols-3 gap-8 text-center">
                    {[
                        { val: '5,000+', label: 'Policies Issued' },
                        { val: '98%', label: 'Claim Settlement Ratio' },
                        { val: '30 Mins', label: 'Average Quote Time' },
                    ].map(s => (
                        <div key={s.label}>
                            <p className="text-4xl font-black text-white font-display mb-1">{s.val}</p>
                            <p className="text-sm text-slate-400">{s.label}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default Insurance;
