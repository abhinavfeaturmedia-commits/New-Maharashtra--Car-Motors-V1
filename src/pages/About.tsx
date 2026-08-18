import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';

const STATS = [
    { value: '3203+', label: 'Cars Sold', icon: 'sell' },
    { value: '13+', label: 'Years in Business', icon: 'calendar_month' },
    { value: '4125+', label: 'Happy Customers', icon: 'sentiment_very_satisfied' },
    { value: '120pt', label: 'Quality Checklist', icon: 'checklist' },
];

const VALUES = [
    { icon: 'verified', title: 'Transparency First', desc: 'No hidden charges, no fine print surprises. Every car comes with a full disclosure of history and condition.' },
    { icon: 'handshake', title: 'Customer Trust', desc: 'We build lifelong relationships. Our 40% repeat customer rate speaks for our commitment to your satisfaction.' },
    { icon: 'workspace_premium', title: 'Quality Assurance', desc: '120-point multi-stage inspection on every vehicle before it reaches our forecourt. No compromises.' },
    { icon: 'support_agent', title: 'After-Sale Support', desc: 'Our relationship doesn\'t end at the sale. We\'re here for servicing, insurance, and any future queries.' },
];

const About = () => {
    return (
        <div>
            {/* Hero */}
            <section className="bg-primary text-white py-20 relative overflow-hidden">
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute top-8 right-10 size-64 rounded-full bg-white" />
                    <div className="absolute -bottom-16 -left-10 size-80 rounded-full bg-white" />
                </div>
                <div className="container-main relative">
                    <nav className="flex items-center gap-2 text-sm text-white/50 mb-8">
                        <Link to="/" className="hover:text-white transition-colors">Home</Link>
                        <span className="material-symbols-outlined text-xs">chevron_right</span>
                        <span className="text-white/80">About Us</span>
                    </nav>
                    <div className="max-w-2xl">
                        <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-accent mb-4">
                            <span className="material-symbols-outlined text-sm">stars</span> Pune's Trusted Dealership
                        </span>
                        <h1 className="text-4xl sm:text-5xl font-black font-display leading-tight mb-6">
                            Redefining Pre-Owned Car Buying in Pune
                        </h1>
                        <p className="text-white/70 text-lg leading-relaxed">
                            Since 2011, New Maharashtra Motors has helped thousands of families find reliable, verified, and transparently priced pre-owned cars.
                        </p>
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="bg-white py-12 border-b border-slate-100">
                <div className="container-main">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {STATS.map(s => (
                            <div key={s.label} className="text-center p-4">
                                <div className="size-12 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <span className="material-symbols-outlined text-accent text-2xl">{s.icon}</span>
                                </div>
                                <p className="text-3xl font-black text-primary font-display">{s.value}</p>
                                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Story */}
            <section className="py-16 bg-white">
                <div className="container-main">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <span className="text-xs font-bold text-accent uppercase tracking-widest flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-sm">auto_stories</span> Our Story
                            </span>
                            <h2 className="text-3xl font-black text-primary font-display mb-6">
                                13+ Years of Building Trust, One Car at a Time
                            </h2>
                            <div className="space-y-4 text-slate-600 leading-relaxed text-sm">
                                <p>
                                    Founded in 2011 in Kasarwadi, Pimpri-Chinchwad, New Maharashtra Motors began with a single mission: to eliminate the ambiguity and mistrust commonly associated with the pre-owned automobile industry in India.
                                </p>
                                <p>
                                    Over the past 13 years, we have grown from a modest dealership into one of Pune's most recommended used car showrooms. Our secret? A strict 120-point inspection protocol, complete paper transparency, and a relentless focus on customer satisfaction after the keys are handed over.
                                </p>
                                <p>
                                    Whether you're buying your first hatchback, upgrading to an SUV for the family, or selling your current vehicle at fair market value — we ensure every interaction is straightforward, dignified, and honest.
                                </p>
                            </div>
                        </div>
                        <div className="relative">
                            <div className="rounded-3xl overflow-hidden shadow-2xl bg-primary aspect-[4/3] flex items-center justify-center relative">
                                <div className="absolute inset-0 bg-gradient-to-tr from-primary to-primary-light opacity-90" />
                                <div className="relative text-center p-8 text-white">
                                    <div className="size-20 bg-accent/20 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-accent/30">
                                        <span className="material-symbols-outlined text-accent text-4xl">verified_user</span>
                                    </div>
                                    <p className="text-2xl font-black font-display mb-2">100% Certified</p>
                                    <p className="text-white/70 text-sm max-w-xs mx-auto">Every car comes with clean paperwork, verified odometer, and zero accident guarantee.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Values */}
            <section className="py-16 bg-slate-50">
                <div className="container-main">
                    <div className="text-center max-w-xl mx-auto mb-12">
                        <span className="text-xs font-bold text-accent uppercase tracking-widest flex items-center justify-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-sm">diamond</span> Our Principles
                        </span>
                        <h2 className="text-3xl font-black text-primary font-display">What Sets Us Apart</h2>
                        <p className="text-slate-500 mt-3">The values that guide every car we inspect, buy, and sell.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {VALUES.map(v => (
                            <div key={v.title} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow">
                                <div className="size-12 bg-primary/5 rounded-xl flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-primary text-xl">{v.icon}</span>
                                </div>
                                <h3 className="font-bold text-primary font-display mb-2">{v.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{v.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Location / Contact */}
            <section className="py-16 bg-primary text-white">
                <div className="container-main">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <span className="text-xs font-bold text-accent uppercase tracking-widest flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-sm">location_on</span> Find Us
                            </span>
                            <h2 className="text-3xl font-black font-display mb-8">Visit Our Showroom</h2>
                            <div className="space-y-5">
                                <div className="flex items-start gap-4">
                                    <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                                        <MapPin size={18} className="text-accent" />
                                    </div>
                                    <div>
                                        <p className="font-semibold mb-1">Address</p>
                                        <p className="text-white/70 text-sm">Sr.no 515/1, near Shankar mandir, Kasarwadi,<br />Pimpri-Chinchwad, Maharashtra 411034, India</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                                        <Phone size={18} className="text-accent" />
                                    </div>
                                    <div>
                                        <p className="font-semibold mb-1">Phone</p>
                                        <a href="tel:+919373721705" className="text-white/70 text-sm hover:text-accent transition-colors">+91 93737 21705</a>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                                        <Mail size={18} className="text-accent" />
                                    </div>
                                    <div>
                                        <p className="font-semibold mb-1">Email</p>
                                        <a href="mailto:sales@newmaharashtramotors.com" className="text-white/70 text-sm hover:text-accent transition-colors">sales@newmaharashtramotors.com</a>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                                        <Clock size={18} className="text-accent" />
                                    </div>
                                    <div>
                                        <p className="font-semibold mb-1">Business Hours</p>
                                        <p className="text-white/70 text-sm">Monday – Saturday: 9:00 AM – 7:00 PM</p>
                                        <p className="text-white/70 text-sm">Sunday: 10:00 AM – 5:00 PM</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
                            <h3 className="font-bold font-display text-lg mb-6">Ready to Find Your Car?</h3>
                            <div className="space-y-3">
                                <Link to="/inventory" className="flex items-center gap-3 h-12 px-5 bg-accent text-primary font-bold rounded-xl hover:bg-accent-hover transition-colors text-sm">
                                    <span className="material-symbols-outlined text-lg">directions_car</span> Browse Inventory
                                </Link>
                                <Link to="/sell" className="flex items-center gap-3 h-12 px-5 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors text-sm">
                                    <span className="material-symbols-outlined text-lg">sell</span> Sell Your Car
                                </Link>
                                <Link to="/services" className="flex items-center gap-3 h-12 px-5 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors text-sm">
                                    <span className="material-symbols-outlined text-lg">build</span> Book a Service
                                </Link>
                                <Link to="/contact" className="flex items-center gap-3 h-12 px-5 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors text-sm">
                                    <span className="material-symbols-outlined text-lg">call</span> Contact Us
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default About;
