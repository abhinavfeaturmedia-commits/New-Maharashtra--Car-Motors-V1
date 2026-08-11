import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Award, Users, Car, Clock } from 'lucide-react';

const STATS = [
    { value: '3203+', label: 'Cars Sold', icon: 'sell' },
    { value: '13+', label: 'Years in Business', icon: 'calendar_month' },
    { value: '4125+', label: 'Happy Customers', icon: 'sentiment_very_satisfied' },
    { value: '120pt', label: 'Quality Checklist', icon: 'checklist' },
];

const TEAM = [
    { name: 'Amarsinh Malave', role: 'CEO & Founder', initials: 'AM', color: 'from-primary to-primary-light' },
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
                            <span className="material-symbols-outlined text-sm">stars</span> Kolhapur's Trusted Dealership
                        </span>
                        <h1 className="text-4xl md:text-5xl font-black font-display leading-tight mb-6">
                            Built on Trust,<br />Driven by Passion
                        </h1>
                        <p className="text-white/70 text-lg leading-relaxed max-w-xl">
                            Since 2001, New Maharashtra Motors has been Kolhapur's go-to destination for quality pre-owned vehicles, genuine spare parts, and comprehensive automotive services. We combine honest dealing with expert vehicle knowledge.
                        </p>
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="py-12 border-b border-slate-100 bg-white">
                <div className="container-main">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {STATS.map(stat => (
                            <div key={stat.label} className="text-center p-6 rounded-2xl bg-slate-50 border border-slate-100">
                                <span className="material-symbols-outlined text-accent text-3xl mb-2 block">{stat.icon}</span>
                                <p className="text-3xl font-black text-primary font-display mb-1 tabular-nums">{stat.value}</p>
                                <p className="text-sm text-slate-500">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Our Story */}
            <section className="py-16 bg-white">
                <div className="container-main">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <span className="text-xs font-bold text-accent uppercase tracking-widest flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-sm">history</span> Our Story
                            </span>
                            <h2 className="text-3xl font-black text-primary font-display mb-6">From a Small Lot to Kolhapur's Most Trusted Name</h2>
                            <div className="space-y-4 text-slate-600 leading-relaxed">
                                <p>
                                    New Maharashtra Motors was founded in 2001 with a simple mission: to make buying and servicing vehicles as trustworthy and transparent as buying a new one.
                                </p>
                                <p>
                                    In our early years, we expanded from genuine automotive spare parts distribution into full-scale pre-owned vehicle sales and servicing. Today, we're proud to serve thousands of satisfied customers across Shiroli, Kolhapur, Sangli, and the surrounding region.
                                </p>
                                <p>
                                    Every car in our inventory undergoes a rigorous 120-point inspection. We never sell cars or parts we wouldn't feel comfortable providing to our own family members. That's the New Maharashtra Motors promise.
                                </p>
                            </div>
                            <div className="mt-8 flex flex-wrap gap-3">
                                <Link to="/inventory" className="h-12 px-6 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors text-sm flex items-center gap-2 shadow-sm">
                                    <span className="material-symbols-outlined text-lg">directions_car</span> View Our Inventory
                                </Link>
                                <Link to="/contact" className="h-12 px-6 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">call</span> Contact Us
                                </Link>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-primary rounded-2xl p-6 text-white space-y-2 col-span-2">
                                <span className="material-symbols-outlined text-accent text-3xl">format_quote</span>
                                <p className="text-lg font-medium leading-relaxed text-white/90 italic">
                                    "We don't just sell cars — we help families make one of the most important financial decisions of their lives. That responsibility keeps us honest every single day."
                                </p>
                                <p className="text-sm text-white/60 font-semibold">— Founder, New Maharashtra Motors</p>
                            </div>
                            <div className="bg-accent/10 rounded-2xl p-6 flex flex-col justify-center items-center text-center">
                                <Car size={36} className="text-accent mb-3" />
                                <p className="text-2xl font-black text-primary font-display">2001</p>
                                <p className="text-sm text-slate-500">Established</p>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-6 flex flex-col justify-center items-center text-center">
                                <Award size={36} className="text-primary mb-3" />
                                <p className="text-2xl font-black text-primary font-display">100%</p>
                                <p className="text-sm text-slate-500">Certified Cars</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Our Values */}
            <section className="py-16 bg-slate-50 border-y border-slate-100">
                <div className="container-main">
                    <div className="text-center max-w-xl mx-auto mb-12">
                        <span className="text-xs font-bold text-accent uppercase tracking-widest flex items-center justify-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-sm">favorite</span> What We Stand For
                        </span>
                        <h2 className="text-3xl font-black text-primary font-display">Our Core Values</h2>
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

            {/* Team */}
            <section className="py-16 bg-white">
                <div className="container-main">
                    <div className="text-center max-w-xl mx-auto mb-12">
                        <span className="text-xs font-bold text-accent uppercase tracking-widest flex items-center justify-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-sm">group</span> The People Behind the Brand
                        </span>
                        <h2 className="text-3xl font-black text-primary font-display">Meet Our Founder</h2>
                        <p className="text-slate-500 mt-3">The visionary leader who built Kolhapur's most trusted used car dealership from the ground up.</p>
                    </div>

                    {/* Single founder card — centered, premium */}
                    <div className="flex justify-center">
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-[var(--shadow-card-hover)] p-10 flex flex-col items-center text-center max-w-sm w-full">
                            {/* Avatar */}
                            <div className="size-24 rounded-2xl bg-gradient-to-br from-primary to-primary-light text-white flex items-center justify-center text-3xl font-black font-display mb-5 shadow-lg">
                                AM
                            </div>
                            {/* Badge */}
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-accent uppercase tracking-widest bg-accent/10 px-3 py-1 rounded-full mb-3">
                                <span className="material-symbols-outlined text-sm">stars</span> Founder
                            </span>
                            <h3 className="text-xl font-black text-primary font-display">Amarsinh Malave</h3>
                            <p className="text-slate-500 text-sm mt-1 font-medium">CEO &amp; Founder</p>
                            <div className="mt-5 pt-5 border-t border-slate-100 w-full">
                                <p className="text-sm text-slate-500 leading-relaxed italic">
                                    "Our promise is simple — every customer drives home with confidence and a car they can trust."
                                </p>
                            </div>
                        </div>
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
                                        <p className="text-white/70 text-sm">Chatrapati Shivaji Nagar, Behind Mahadik Bungalow,<br />Shiroli (P), Kolhapur, Maharashtra 416122</p>
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
