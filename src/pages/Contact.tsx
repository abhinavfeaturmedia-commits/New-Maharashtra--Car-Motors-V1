import React, { useState } from 'react';
import { Phone, Mail, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Contact = () => {
    const [form, setForm] = useState({ full_name: '', phone: '', email: '', message: '' });
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const set = (field: string, val: string) => setForm(prev => ({ ...prev, [field]: val }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!form.full_name.trim() || !form.phone.trim()) {
            setError('Please fill in your name and phone number.');
            return;
        }

        setLoading(true);

        const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_public_lead', {
            p_full_name: form.full_name.trim(),
            p_phone: form.phone.trim(),
            p_email: form.email.trim() || null,
            p_message: form.message.trim() || null,
            p_type: 'contact',
            p_source: 'website_contact'
        });

        if (rpcError) {
            console.warn('RPC submit_public_lead failed on Contact page, using direct insert fallback:', rpcError);
            const { error: directError } = await supabase.from('leads').insert({
                type: 'contact',
                full_name: form.full_name.trim(),
                phone: form.phone.trim(),
                email: form.email.trim() || null,
                message: form.message.trim() || null,
                source: 'website_contact',
                status: 'new'
            });

            if (directError) {
                console.error('Contact direct insert error:', directError);
                setError('Something went wrong. Please call us directly or try again.');
            } else {
                setSubmitted(true);
            }
        } else if (rpcResult && rpcResult.success === false) {
            setError(rpcResult.error || 'Something went wrong. Please call us directly or try again.');
        } else {
            setSubmitted(true);
        }
        setLoading(false);
    };

    return (
        <div className="container-main py-12">
            <h1 className="text-4xl font-black text-primary font-display mb-2">Get in Touch</h1>
            <p className="text-slate-500 text-lg mb-10">Visit our showroom or send us a message to experience premium service in Pune.</p>

            <div className="grid lg:grid-cols-2 gap-10">
                {/* Left: Map + Contact Info */}
                <div className="space-y-6">
                    <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-[var(--shadow-card)] bg-white">
                        <div className="aspect-[4/3] bg-slate-100 relative">
                            <iframe
                                src="https://maps.google.com/maps?q=New%20Maharashtra%20Motors,%20Kasarwadi,%20Pimpri-Chinchwad,%20Maharashtra%20411034&t=&z=15&ie=UTF8&iwloc=&output=embed"
                                className="w-full h-full border-0" allowFullScreen loading="lazy" title="Location Map"
                            />
                            <a 
                                href="https://share.google/al67v4PD0nUK20g5x"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute bottom-4 right-4 bg-white shadow-md rounded-xl px-4 py-2 text-sm font-semibold text-primary flex items-center gap-2 hover:shadow-lg transition-shadow"
                            >
                                <span className="material-symbols-outlined text-accent text-lg">near_me</span> Get Directions
                            </a>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)] space-y-5">
                        <h3 className="text-xl font-bold text-primary font-display">Contact Information</h3>
                        {[
                            { icon: <MapPin size={18} className="text-primary" />, label: 'Address', value: 'Sr.no 515/1, near Shankar mandir, Kasarwadi, Pimpri-Chinchwad, Maharashtra 411034, India' },
                            { icon: <Phone size={18} className="text-primary" />, label: 'Phone', value: '+91 93737 21705 / +91 98232 37975', sub: 'Mon-Sat: 9AM - 8PM' },
                            { icon: <Mail size={18} className="text-primary" />, label: 'Email', value: 'sales@newmaharashtramotors.com' },
                        ].map(item => (
                            <div key={item.label} className="flex items-start gap-4">
                                <div className="size-10 rounded-xl bg-primary-light/10 flex items-center justify-center shrink-0">{item.icon}</div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-700 mb-0.5">{item.label}</p>
                                    <p className="text-sm text-slate-500">{item.value}</p>
                                    {item.sub && <p className="text-xs text-slate-400">{item.sub}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Form */}
                <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-[var(--shadow-card)] h-fit">
                    {submitted ? (
                        <div className="text-center py-10">
                            <div className="size-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-green-600 text-3xl">check_circle</span>
                            </div>
                            <h3 className="text-xl font-bold text-primary font-display mb-2">Message Sent!</h3>
                            <p className="text-slate-500 text-sm mb-6">Our team will contact you within 24 hours on the phone number provided.</p>
                            <button
                                onClick={() => { setSubmitted(false); setForm({ full_name: '', phone: '', email: '', message: '' }); }}
                                className="h-10 px-6 bg-primary text-white font-semibold rounded-xl text-sm hover:bg-primary-light transition-colors"
                            >
                                Send Another Message
                            </button>
                        </div>
                    ) : (
                        <>
                            <h3 className="text-2xl font-bold text-primary font-display mb-2">Send us a Message</h3>
                            <p className="text-sm text-slate-500 mb-6">Fill out the form and our team will get back to you within 24 hours.</p>

                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg shrink-0">error</span>{error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Full Name <span className="text-red-400">*</span></label>
                                    <input
                                        type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)}
                                        placeholder="Enter your full name"
                                        className="w-full h-12 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30"
                                        required disabled={loading}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number <span className="text-red-400">*</span></label>
                                    <div className="flex">
                                        <div className="shrink-0 h-12 px-4 bg-slate-50 border border-r-0 border-slate-200 rounded-l-xl flex items-center text-sm font-medium text-slate-500">+91</div>
                                        <input
                                            type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                                            placeholder="98XXX XXXXX"
                                            className="flex-1 h-12 border border-slate-200 rounded-r-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                            required disabled={loading}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Email <span className="text-xs text-slate-400">(optional)</span></label>
                                    <input
                                        type="email" value={form.email} onChange={e => set('email', e.target.value)}
                                        placeholder="you@example.com"
                                        className="w-full h-12 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30"
                                        disabled={loading}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">What can we help you with?</label>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {[
                                            'Buying a Used Car',
                                            'Selling My Vehicle',
                                            'Service & Repair Booking',
                                            'Car Loan / Finance Query'
                                        ].map(topic => (
                                            <button
                                                key={topic}
                                                type="button"
                                                onClick={() => set('message', `[${topic}] - `)}
                                                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${form.message.includes(topic) ? 'bg-primary text-white border-primary' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'}`}
                                            >
                                                {topic}
                                            </button>
                                        ))}
                                    </div>
                                    <textarea
                                        rows={4} value={form.message} onChange={e => set('message', e.target.value)}
                                        placeholder="Tell us more about your requirement..."
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 resize-y"
                                        disabled={loading}
                                    />
                                </div>
                                <button
                                    type="submit" disabled={loading}
                                    className="w-full h-12 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors shadow-sm text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                                >
                                    {loading ? (
                                        <><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</>
                                    ) : (
                                        <><span className="material-symbols-outlined text-lg">send</span> Send Message</>
                                    )}
                                </button>
                                <p className="text-xs text-slate-400 text-center">
                                    By submitting this form, you agree to our <a href="#" className="text-primary hover:underline">privacy policy</a>.
                                </p>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Contact;
