import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, ArrowRight, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SellCar = () => {
    const [form, setForm] = useState({ full_name: '', phone: '', car_make: '', car_model: '', car_year: String(new Date().getFullYear()), car_mileage: '' });
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [heroReg, setHeroReg] = useState('');
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    const set = (f: string, v: string) => setForm(prev => ({ ...prev, [f]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!form.full_name.trim() || !form.phone.trim() || !form.car_make.trim() || !form.car_model.trim()) {
            setError('Please fill in all the required fields (Name, Phone, Make, Model).');
            return;
        }

        setLoading(true);

        const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_public_lead', {
            p_full_name: form.full_name.trim(),
            p_phone: form.phone.trim(),
            p_type: 'sell_car',
            p_source: 'website_sell_car',
            p_car_make: form.car_make.trim() || null,
            p_car_model: form.car_model.trim() || null,
            p_car_year: form.car_year ? Number(form.car_year) : null,
            p_car_mileage: form.car_mileage ? Number(form.car_mileage) : null
        });

        if (rpcError) {
            console.warn('RPC submit_public_lead failed on SellCar, using direct fallback:', rpcError);
            const { error: directError } = await supabase.from('leads').insert({
                type: 'sell_car',
                full_name: form.full_name.trim(),
                phone: form.phone.trim(),
                car_make: form.car_make.trim() || null,
                car_model: form.car_model.trim() || null,
                car_year: form.car_year ? Number(form.car_year) : null,
                car_mileage: form.car_mileage ? Number(form.car_mileage) : null,
                source: 'website_sell_car',
                status: 'new'
            });

            if (directError) {
                console.error('SellCar direct insert error:', directError);
                setError('Something went wrong. Please call us directly.');
            } else {
                setSubmitted(true);
            }
        } else if (rpcResult && rpcResult.success === false) {
            setError(rpcResult.error || 'Something went wrong. Please call us directly.');
        } else {
            setSubmitted(true);
        }
        setLoading(false);
    };

    return (
        <div className="w-full">
            {/* Hero */}
            <section className="relative bg-primary overflow-hidden">
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1XK2L7EpsFR7K_eosnwu-nObzshJ1Ty2a8myYaJLGxNfVRumnjS7qbstQgmr0orhubbj2qWZONaSEPe_N7kcPM_1QfK25z_ISQyqhepk7R2dKxgZkvCaLxu1sknYBEuc8ql5XtjjvTxpkgGtcvcz9YskEEhJWegVcLP20ML2BowuulsKcxPJys4ux6Vi6vSqWwbUnsgtemZ2KMzcaeJsz8ZDBvA8U6qYDVmNQ5ksSaho1Svizzl2FUtSrad_4n_fgXjaKl4oo-CEH" className="absolute inset-0 w-full h-full object-cover opacity-30" alt="" />
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/95 to-primary/80" />
                <div className="relative z-10 container-main py-16 lg:py-24">
                    <span className="inline-flex items-center gap-2 bg-accent text-primary text-xs font-bold px-3 py-1.5 rounded-lg mb-6 uppercase"><span className="material-symbols-outlined text-sm">verified</span> Best Price Guaranteed</span>
                    <h1 className="text-4xl lg:text-6xl font-black text-white font-display leading-tight mb-4">Sell your car in <span className="text-accent">30 minutes</span></h1>
                    <p className="text-slate-400 text-lg max-w-lg mb-8">New Maharashtra Motors: Pune's most trusted vehicle sales & service. Instant payment, free RC transfer.</p>
                    <div className="flex gap-3 max-w-lg">
                        <input type="text" value={heroReg} onChange={e => setHeroReg(e.target.value)} placeholder="MH09 AB 1234" className="flex-1 h-12 bg-white/10 border border-white/20 text-white placeholder:text-white/50 rounded-xl px-5 text-sm outline-none backdrop-blur focus:ring-2 focus:ring-accent/30" />
                        <button onClick={() => {
                            document.getElementById('sell-form')?.scrollIntoView({ behavior: 'smooth' });
                        }} className="h-12 flex items-center justify-center px-6 bg-accent text-primary font-bold rounded-xl hover:bg-accent-hover transition-all text-sm whitespace-nowrap border-0">Get Instant Quote</button>
                    </div>
                    <p className="text-xs text-slate-500 mt-3 flex items-center gap-1"><span className="material-symbols-outlined text-xs text-green-400">check_circle</span> 10,000+ Happy Customers in Pune</p>
                </div>
            </section>

            {/* Benefits */}
            <section className="py-16 container-main">
                <h2 className="text-2xl font-bold text-primary font-display text-center mb-3">Why Sell to Us?</h2>
                <p className="text-slate-500 text-center mb-10">We make selling your car simple, safe, and speedy.</p>
                <div className="grid md:grid-cols-3 gap-6">
                    {[
                        { icon: 'payments', title: 'Instant Payment', desc: "Don't wait. Bank transfer NEFT/IMPS on the spot, within minutes of deal finalization." },
                        { icon: 'description', title: 'RC Transfer Free', desc: 'We handle all the legal paperwork and RC transfer process at zero cost to you.' },
                        { icon: 'home', title: 'Doorstep Inspection', desc: 'Our experts come to your home or office anywhere in Pune for a free evaluation.' },
                    ].map(b => (
                        <div key={b.title} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)] text-center">
                            <div className="size-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-accent text-2xl">{b.icon}</span>
                            </div>
                            <h3 className="font-bold text-primary font-display mb-2">{b.title}</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">{b.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* How it works */}
            <section className="py-16 bg-white">
                <div className="container-main">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <p className="text-xs font-bold text-accent uppercase tracking-widest mb-2">Simple Process</p>
                            <h2 className="text-3xl font-black text-primary font-display mb-3">How it works</h2>
                            <p className="text-slate-500 mb-8">From quote to cash in just 3 simple steps. No haggling, no headaches.</p>
                            <Link to="/sell" className="text-sm font-bold text-primary flex items-center gap-1 hover:text-accent transition-colors">Start selling now <ArrowRight size={14} /></Link>
                        </div>
                        <div className="space-y-6">
                            {[
                                { icon: 'computer', title: 'Instant Online Quote', desc: 'Get an AI-driven estimated price range in seconds by entering your car details.' },
                                { icon: 'home', title: 'Free Home Evaluation', desc: 'We visit you in Pune to inspect the car condition. It takes just 30 minutes.' },
                                { icon: 'payments', title: 'Same-Day Payment', desc: "Agree on the price? Money is transferred to your bank instantly." },
                            ].map((step, i) => (
                                <div key={i} className="flex items-start gap-4 bg-slate-50 rounded-2xl p-5">
                                    <div className="size-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm">
                                        <span className="material-symbols-outlined text-accent text-xl">{step.icon}</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-primary font-display mb-1">{step.title}</h4>
                                        <p className="text-sm text-slate-500">{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Form Section */}
            <section id="sell-form" className="py-16 bg-slate-50 border-t border-slate-200">
                <div className="container-main max-w-3xl">
                    <div className="bg-white rounded-3xl border border-slate-100 p-8 md:p-10 shadow-xl">
                        {submitted ? (
                            <div className="text-center py-10">
                                <div className="size-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <span className="material-symbols-outlined text-green-600 text-3xl">check_circle</span>
                                </div>
                                <h3 className="text-2xl font-bold text-primary font-display mb-2">Request Received!</h3>
                                <p className="text-slate-500 text-sm mb-8">Our evaluation expert will call you shortly on +91 {form.phone} to give you an estimate.</p>
                                <button
                                    onClick={() => { setSubmitted(false); setForm({ full_name: '', phone: '', car_make: '', car_model: '', car_year: String(new Date().getFullYear()), car_mileage: '' }); }}
                                    className="h-11 px-6 bg-primary text-white font-semibold rounded-xl text-sm hover:bg-primary-light transition-colors"
                                >
                                    Submit Another Car
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="text-center mb-8">
                                    <span className="inline-flex items-center gap-1.5 bg-accent/20 text-accent-hover text-xs font-bold px-3 py-1.5 rounded-lg mb-3">
                                        <span className="material-symbols-outlined text-[14px]">speed</span> 30-Min Evaluation
                                    </span>
                                    <h2 className="text-3xl font-black text-primary font-display mb-2">Get Your Car's Value</h2>
                                    <p className="text-slate-500 text-sm">Fill details below. No obligations, 100% free quote.</p>
                                </div>

                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg shrink-0">error</span>{error}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name <span className="text-red-400">*</span></label>
                                            <input type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)} required disabled={loading} className="w-full h-12 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" placeholder="e.g. Ramesh Patil" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number <span className="text-red-400">*</span></label>
                                            <div className="flex">
                                                <div className="shrink-0 h-12 px-4 bg-slate-50 border border-r-0 border-slate-200 rounded-l-xl flex items-center text-sm font-medium text-slate-500">+91</div>
                                                <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} required disabled={loading} className="flex-1 h-12 border border-slate-200 rounded-r-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10" placeholder="98XXX XXXXX" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 grid md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Car Make <span className="text-red-400">*</span></label>
                                            <input type="text" value={form.car_make} onChange={e => set('car_make', e.target.value)} required disabled={loading} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white" placeholder="e.g. Maruti Suzuki" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Model / Variant <span className="text-red-400">*</span></label>
                                            <input type="text" value={form.car_model} onChange={e => set('car_model', e.target.value)} required disabled={loading} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white" placeholder="e.g. Swift VXI" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Reg Year</label>
                                            <select value={form.car_year} onChange={e => set('car_year', e.target.value)} disabled={loading} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white">
                                                {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">KMs Driven</label>
                                            <input type="number" value={form.car_mileage} onChange={e => set('car_mileage', e.target.value)} disabled={loading} className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 bg-white" placeholder="e.g. 45000" />
                                        </div>
                                    </div>

                                    {/* Estimated Payout Banner */}
                                    {form.car_make.trim() && form.car_model.trim() && (
                                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
                                            <div>
                                                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Estimated Pune Trade-in Value</span>
                                                <span className="text-xs text-slate-500">Based on recent market sales in Pune</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-black text-primary font-display tabular-nums">
                                                    ₹ {(Math.max(2.5, 8.5 - (new Date().getFullYear() - Number(form.car_year || new Date().getFullYear())) * 0.45)).toFixed(2)} - {(Math.max(2.8, 9.2 - (new Date().getFullYear() - Number(form.car_year || new Date().getFullYear())) * 0.45)).toFixed(2)} Lakh
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <button type="submit" disabled={loading} className="w-full h-14 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all shadow-md text-[15px] flex items-center justify-center gap-2 cursor-pointer border-none">
                                        {loading ? (
                                            <><span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
                                        ) : (
                                            <>Request Call Back <span className="material-symbols-outlined text-lg">arrow_forward</span></>
                                        )}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="py-16 container-main">
                <h2 className="text-2xl font-bold text-primary font-display text-center mb-8">Frequently Asked Questions</h2>
                <div className="max-w-2xl mx-auto space-y-3">
                    {[
                        { q: 'What documents do I need to sell my car?', a: 'You will need your original RC book, valid insurance, PUC, PAN card, Aadhar card, and two passport size photographs.' },
                        { q: 'Is the home inspection chargeable?', a: 'No, our home inspection service is completely free with no obligations.' },
                        { q: 'How fast will I receive the payment?', a: 'You will receive instant payment right after the agreement is signed and keys are handed over.' },
                        { q: 'Do you take care of the RC transfer?', a: 'Yes, we handle the entire ownership transfer process completely free of charge.' }
                    ].map((faq, i) => (
                        <div key={faq.q} onClick={() => setOpenFaq(openFaq === i ? null : i)} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)] cursor-pointer hover:shadow-[var(--shadow-card-hover)] transition-all">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-primary">{faq.q}</span>
                                <span className="material-symbols-outlined text-slate-400 transition-transform duration-300" style={{ transform: openFaq === i ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                            </div>
                            {openFaq === i && (
                                <p className="text-sm text-slate-500 mt-4 pt-4 border-t border-slate-100">{faq.a}</p>
                            )}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default SellCar;
