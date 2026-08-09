import React, { useState } from 'react';
import { Search } from 'lucide-react';

const CATEGORIES = ['All Questions', 'Buying', 'Selling', 'Services', 'Finance'];

const FAQ_DATA = [
    {
        category: 'Buying', section: 'Buying & Registration', items: [
            { q: 'What documents are needed for purchase?', a: 'You will need a valid ID proof (Aadhar/PAN), address proof, and income proof for loan processing. Our team will guide you through the RTO Kolhapur registration process seamlessly to ensure your vehicle is road-legal immediately upon delivery.' },
            { q: 'How do I book a test drive in Kolhapur?', a: 'You can book a test drive through our website, by calling us at 098232 37975, or by visiting our Kasaba Bawada showroom directly. We also offer doorstep test drives within Kolhapur city limits.' },
        ]
    },
    {
        category: 'Selling', section: 'Selling & Exchange', items: [
            { q: "How is my car's value calculated?", a: 'We evaluate your car based on its age, mileage, condition, service history, and current market demand. Our AI-powered valuation tool provides an instant estimate, followed by a detailed physical inspection.' },
            { q: 'Do you offer instant cash for old cars?', a: 'Yes! Once your car passes our inspection and you accept our offer, payment is transferred instantly to your bank account. The entire process takes less than 30 minutes.' },
        ]
    },
    {
        category: 'Finance', section: 'Finance & Loans', items: [
            { q: 'Do you partner with local Kolhapur banks?', a: 'Yes, we partner with all major banks including HDFC, ICICI, SBI, and local cooperative banks in Kolhapur. We help you get the best interest rates and flexible EMI options.' },
        ]
    },
];

const FAQ = () => {
    const [activeCategory, setActiveCategory] = useState('All Questions');
    const [openQ, setOpenQ] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredData = FAQ_DATA.filter(group =>
        activeCategory === 'All Questions' || group.category === activeCategory
    );

    return (
        <div className="w-full">
            {/* Hero */}
            <section className="relative bg-primary overflow-hidden">
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1XK2L7EpsFR7K_eosnwu-nObzshJ1Ty2a8myYaJLGxNfVRumnjS7qbstQgmr0orhubbj2qWZONaSEPe_N7kcPM_1QfK25z_ISQyqhepk7R2dKxgZkvCaLxu1sknYBEuc8ql5XtjjvTxpkgGtcvcz9YskEEhJWegVcLP20ML2BowuulsKcxPJys4ux6Vi6vSqWwbUnsgtemZ2KMzcaeJsz8ZDBvA8U6qYDVmNQ5ksSaho1Svizzl2FUtSrad_4n_fgXjaKl4oo-CEH" alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
                <div className="relative z-10 container-main py-16 text-center">
                    <h1 className="text-3xl lg:text-4xl font-black text-white font-display mb-3">Hello! How can we help you today?</h1>
                    <p className="text-slate-400 mb-8 max-w-lg mx-auto">Find answers to common questions about buying, selling, and servicing your car in Kolhapur.</p>
                    <div className="flex items-center gap-2 bg-white rounded-xl px-5 h-12 max-w-lg mx-auto shadow-lg">
                        <Search size={18} className="text-slate-400" />
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 bg-transparent border-none text-sm outline-none text-primary placeholder:text-slate-400" placeholder="Search for issues, car models, or services..." />
                        <button className="bg-primary text-white text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-primary-light transition-colors">Search</button>
                    </div>
                </div>
            </section>

            <div className="container-main py-12">
                {/* Popular Topics */}
                <div className="mb-12">
                    <h2 className="text-xl font-bold text-primary font-display mb-2">Popular Topics</h2>
                    <p className="text-sm text-slate-500 mb-6">Quick access to frequently requested information.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { icon: 'directions_car', title: 'Book a Test Drive', desc: 'Schedule a drive with your dream car.' },
                            { icon: 'verified_user', title: 'Warranty Info', desc: 'Details on comprehensive coverage.' },
                            { icon: 'location_on', title: 'Service Centers', desc: 'Find authorized workshops near you.' },
                        ].map(topic => (
                            <div key={topic.title} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all cursor-pointer group">
                                <div className="size-12 rounded-xl bg-primary/5 flex items-center justify-center mb-4 group-hover:bg-accent/10 transition-colors">
                                    <span className="material-symbols-outlined text-primary text-xl group-hover:text-accent transition-colors">{topic.icon}</span>
                                </div>
                                <h3 className="font-bold text-primary font-display mb-1">{topic.title}</h3>
                                <p className="text-sm text-slate-500">{topic.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Category Tabs */}
                <div className="flex gap-1 border-b border-slate-200 mb-8 overflow-x-auto">
                    {CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${activeCategory === cat ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent hover:text-primary'}`}>
                            {cat}
                        </button>
                    ))}
                </div>

                {/* FAQ Items */}
                <div className="space-y-8 max-w-3xl">
                    {filteredData.map(group => (
                        <div key={group.section}>
                            <h3 className="text-xs font-bold text-accent uppercase tracking-widest mb-4">{group.section}</h3>
                            <div className="space-y-3">
                                {group.items.map(item => (
                                    <div key={item.q} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-[var(--shadow-card)]">
                                        <button onClick={() => setOpenQ(openQ === item.q ? null : item.q)} className="w-full flex items-center justify-between p-5 text-left">
                                            <span className="text-sm font-semibold text-primary pr-4">{item.q}</span>
                                            <span className="material-symbols-outlined text-slate-400 shrink-0">{openQ === item.q ? 'expand_less' : 'expand_more'}</span>
                                        </button>
                                        {openQ === item.q && (
                                            <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-50 pt-3">
                                                {item.a}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Still need help */}
                <div className="mt-12 bg-slate-50 rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div>
                        <h3 className="text-lg font-bold text-primary font-display mb-1">Still need help?</h3>
                        <p className="text-sm text-slate-500">Our support team is available Mon-Sat, 9am - 7pm.</p>
                    </div>
                    <div className="flex gap-3">
                        <a href="tel:09823237975" className="inline-flex items-center gap-2 h-10 px-5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-primary hover:bg-primary hover:text-white hover:border-primary transition-all">
                            <span className="material-symbols-outlined text-lg">call</span> Call Us
                        </a>
                        <a href="#" className="inline-flex items-center gap-2 h-10 px-5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
                            <span className="material-symbols-outlined text-lg">chat</span> WhatsApp
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FAQ;
