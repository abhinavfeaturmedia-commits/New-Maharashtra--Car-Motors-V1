import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatPriceLakh } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { X, Check, Loader2, Sparkles, PhoneCall, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Accessory {
    id: string;
    name: string;
    category: 'Exterior' | 'Interior' | 'Electronics' | 'Protection & Services';
    price: number;
    description: string;
    image_url: string;
}

interface InventoryCar {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
}

const AccessoryCatalog: React.FC = () => {
    const [accessories, setAccessories] = useState<Accessory[]>([]);
    const [cars, setCars] = useState<InventoryCar[]>([]);
    const [selectedCarId, setSelectedCarId] = useState<string>('');
    const [selectedAccessories, setSelectedAccessories] = useState<Accessory[]>([]);
    const [activeTab, setActiveTab] = useState<string>('All');
    const [loading, setLoading] = useState(true);
    
    // Form fields
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [remarks, setRemarks] = useState('');
    
    // Status states
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    
    // EMI Calculation configuration
    const [downPaymentPct, setDownPaymentPct] = useState(20);
    const [tenureMonths, setTenureMonths] = useState(60);
    const interestRate = 9.5; // 9.5% p.a.

    // Categories definition
    const categories = ['All', 'Exterior', 'Interior', 'Electronics', 'Protection & Services'];

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch accessories
                const { data: accData, error: accErr } = await supabase
                    .from('accessories')
                    .select('*')
                    .eq('is_available', true);
                if (accErr) throw accErr;
                setAccessories(accData || []);

                // Fetch available cars for selection
                const { data: carData, error: carErr } = await supabase
                    .from('inventory')
                    .select('id, make, model, year, price')
                    .eq('status', 'available')
                    .order('make', { ascending: true });
                if (carErr) throw carErr;
                setCars(carData || []);
            } catch (err) {
                console.error('Error fetching catalog data:', err);
                setErrorMsg('Failed to load catalog catalog items. Please refresh the page.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Filter items based on activeTab
    const filteredAccessories = accessories.filter(item => {
        if (activeTab === 'All') return true;
        return item.category === activeTab;
    });

    const toggleAccessory = (item: Accessory) => {
        if (selectedAccessories.some(x => x.id === item.id)) {
            setSelectedAccessories(selectedAccessories.filter(x => x.id !== item.id));
        } else {
            setSelectedAccessories([...selectedAccessories, item]);
        }
    };

    const isSelected = (id: string) => {
        return selectedAccessories.some(x => x.id === id);
    };

    // Calculations
    const accessoriesTotal = selectedAccessories.reduce((sum, item) => sum + Number(item.price), 0);
    const selectedCar = cars.find(c => c.id === selectedCarId);
    // Convert car price from Lakhs/Decimal (e.g., if price is saved as 5.5 Lakhs or as a full number). 
    // In our inventory table, price is stored as NUMERIC, e.g., 550000.00.
    const carPrice = selectedCar ? Number(selectedCar.price) : 0;
    const totalQuote = carPrice + accessoriesTotal;
    
    // EMI Calculator Logic
    const calculateEMI = () => {
        if (totalQuote === 0) return 0;
        const downPayment = (totalQuote * downPaymentPct) / 100;
        const principal = totalQuote - downPayment;
        const r = (interestRate / 12) / 100; // monthly rate
        const n = tenureMonths;
        const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        return isNaN(emi) ? 0 : Math.round(emi);
    };

    const handleSubmitQuote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedAccessories.length === 0) {
            setErrorMsg('Please select at least one accessory to request a quote.');
            return;
        }

        setSubmitting(true);
        setErrorMsg('');

        try {
            // 1. Format Message
            const accListText = selectedAccessories
                .map((acc, idx) => `${idx + 1}. ${acc.name} (₹ ${Number(acc.price).toLocaleString('en-IN')})`)
                .join('\n');

            let message = `Customer Requested Accessories Package Quote:\n${accListText}\n\nAccessories Total: ₹ ${accessoriesTotal.toLocaleString('en-IN')}`;
            
            if (selectedCar) {
                message += `\nSelected Vehicle: ${selectedCar.year} ${selectedCar.make} ${selectedCar.model} (₹ ${formatPriceLakh(selectedCar.price)} Lakh)`;
                message += `\nTotal Combined Quote: ₹ ${totalQuote.toLocaleString('en-IN')}`;
                message += `\nConfigured Loan: ${downPaymentPct}% Down Payment, ${tenureMonths} Months Tenure @ 9.5% p.a.`;
                message += `\nEstimated EMI: ₹ ${calculateEMI().toLocaleString('en-IN')}/month`;
            }

            if (remarks) {
                message += `\n\nRemarks:\n${remarks}`;
            }

            // 2. Insert Lead
            const { data: lead, error: leadError } = await supabase
                .from('leads')
                .insert({
                    type: 'general',
                    full_name: name,
                    phone: phone,
                    email: email || null,
                    message: message,
                    source: 'accessory_catalog',
                    status: 'new'
                })
                .select()
                .single();

            if (leadError) throw leadError;

            // 3. Link Accessories in lead_accessories table
            const linkAccItems = selectedAccessories.map(acc => ({
                lead_id: lead.id,
                accessory_id: acc.id
            }));

            const { error: linkAccError } = await supabase
                .from('lead_accessories')
                .insert(linkAccItems);

            if (linkAccError) throw linkAccError;

            // 4. Link Car if selected
            if (selectedCarId) {
                await supabase
                    .from('lead_inventory_items')
                    .insert({
                        lead_id: lead.id,
                        inventory_id: selectedCarId
                    });
            }

            setSuccess(true);
        } catch (error: any) {
            console.error('Error submitting accessories quote:', error);
            setErrorMsg(error.message || 'Failed to submit quote request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const getWhatsAppUrl = () => {
        const adminNumber = '919823237975';
        let text = `Hello New Maharashtra Motors, I just built a custom accessory package on your website under the name *${name}* (${phone}).\n\n`;
        text += `*Selected Accessories:*\n`;
        selectedAccessories.forEach((acc) => {
            text += `- ${acc.name} (₹ ${Number(acc.price).toLocaleString('en-IN')})\n`;
        });
        text += `\n*Accessories Subtotal:* ₹ ${accessoriesTotal.toLocaleString('en-IN')}\n`;
        
        if (selectedCar) {
            text += `*Car:* ${selectedCar.year} ${selectedCar.make} ${selectedCar.model} (₹ ${formatPriceLakh(selectedCar.price)} Lakh)\n`;
            text += `*Estimated Combined Quote:* ₹ ${totalQuote.toLocaleString('en-IN')}\n`;
            text += `*Estimated EMI:* ₹ ${calculateEMI().toLocaleString('en-IN')}/month\n`;
        }
        
        return `https://wa.me/${adminNumber}?text=${encodeURIComponent(text)}`;
    };

    const handleReset = () => {
        setSelectedAccessories([]);
        setSelectedCarId('');
        setName('');
        setPhone('');
        setEmail('');
        setRemarks('');
        setSuccess(false);
        setErrorMsg('');
    };

    return (
        <div className="bg-slate-50 min-h-screen py-10">
            <div className="container-main max-w-7xl mx-auto px-4">
                
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-10">
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 mb-3">
                        <Sparkles size={12} /> Customize Your Ride
                    </span>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 font-display">
                        Accessories & Service Packages
                    </h1>
                    <p className="mt-2 text-sm sm:text-base text-slate-500">
                        Select premium accessories, warranty extensions, or protective coatings. Build your custom package quote and calculate combined EMI options instantly.
                    </p>
                </div>

                {success ? (
                    <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 border border-slate-100 shadow-xl text-center space-y-6">
                        <div className="bg-emerald-50 text-emerald-500 p-4 rounded-full inline-block animate-bounce">
                            <Check size={48} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800">Quote Requested Successfully!</h2>
                            <p className="mt-2 text-slate-500">
                                Thank you, <strong>{name}</strong>. We have logged your accessory package preferences. A quotation representative will get in touch with you shortly.
                            </p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl text-left border border-slate-100 space-y-2">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wide">Summary</h4>
                            <p className="text-sm font-semibold text-slate-700">Accessories Selected: {selectedAccessories.length}</p>
                            <p className="text-sm font-semibold text-slate-700">Accessories Value: ₹ {accessoriesTotal.toLocaleString('en-IN')}</p>
                            {selectedCar && (
                                <>
                                    <p className="text-sm font-semibold text-slate-700">Vehicle: {selectedCar.year} {selectedCar.make} {selectedCar.model}</p>
                                    <p className="text-sm font-semibold text-slate-700">Total Valuation: ₹ {totalQuote.toLocaleString('en-IN')}</p>
                                </>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <a
                                href={getWhatsAppUrl()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 h-12 flex items-center justify-center gap-2 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors shadow-md text-sm"
                            >
                                <span className="material-symbols-outlined text-lg">chat</span> Message on WhatsApp
                            </a>
                            <button
                                onClick={handleReset}
                                className="flex-1 h-12 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors text-sm"
                            >
                                Build Another Package
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        
                        {/* Left Section: Categories & Accessory Grid */}
                        <div className="lg:col-span-8 space-y-6">
                            
                            {/* Tabs */}
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveTab(cat)}
                                        className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${activeTab === cat ? 'bg-primary text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-primary border border-slate-100 shadow-sm'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {/* Accessory Grid */}
                            {loading ? (
                                <div className="bg-white rounded-3xl p-20 border border-slate-100 shadow-sm text-center text-slate-400 font-medium">
                                    <Loader2 className="animate-spin inline-block mr-2 text-primary" size={24} /> Loading premium catalog...
                                </div>
                            ) : filteredAccessories.length === 0 ? (
                                <div className="bg-white rounded-3xl p-16 border border-slate-100 shadow-sm text-center text-slate-400 font-medium">
                                    No accessories found in this category.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {filteredAccessories.map(item => {
                                        const selected = isSelected(item.id);
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => toggleAccessory(item)}
                                                className={`bg-white rounded-2xl overflow-hidden border transition-all duration-300 cursor-pointer shadow-sm group flex flex-col ${selected ? 'border-primary ring-2 ring-primary/10' : 'border-slate-100 hover:border-slate-200 hover:shadow-md'}`}
                                            >
                                                {/* Image */}
                                                <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                                                    <img
                                                        src={item.image_url}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    />
                                                    <div className="absolute top-3 right-3">
                                                        <div className={`size-6 rounded-full flex items-center justify-center border shadow-sm transition-all duration-200 ${selected ? 'bg-primary border-primary text-white' : 'bg-white/80 backdrop-blur-sm border-slate-200 text-slate-400'}`}>
                                                            {selected ? <Check size={14} strokeWidth={3} /> : null}
                                                        </div>
                                                    </div>
                                                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded">
                                                        {item.category}
                                                    </div>
                                                </div>

                                                {/* Content */}
                                                <div className="p-5 flex-1 flex flex-col justify-between">
                                                    <div className="space-y-1">
                                                        <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-tight group-hover:text-primary transition-colors">
                                                            {item.name}
                                                        </h3>
                                                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                                                            {item.description}
                                                        </p>
                                                    </div>
                                                    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                                                        <span className="text-sm font-semibold text-slate-400">Price</span>
                                                        <span className="text-base sm:text-lg font-black text-primary font-display">
                                                            ₹ {Number(item.price).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Right Section: Sticky Quote Builder & Calculator */}
                        <div className="lg:col-span-4 lg:sticky lg:top-[5.5rem] space-y-6">
                            
                            {/* Summary & EMI Quote panel */}
                            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl space-y-6">
                                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 pb-3 border-b border-slate-100">
                                    <span className="material-symbols-outlined text-primary">analytics</span> Quote Summary
                                </h3>

                                {/* Select Car */}
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-wide mb-2">Associate with a Vehicle</label>
                                    <select
                                        value={selectedCarId}
                                        onChange={e => setSelectedCarId(e.target.value)}
                                        className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    >
                                        <option value="">-- No Car Selected (Accessories Only) --</option>
                                        {cars.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.year} {c.make} {c.model} (₹{formatPriceLakh(c.price)} L)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Items Breakdowns */}
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 font-medium">Selected Accessories ({selectedAccessories.length})</span>
                                        <span className="font-bold text-slate-800">₹ {accessoriesTotal.toLocaleString('en-IN')}</span>
                                    </div>
                                    {selectedCar && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500 font-medium">Vehicle Price ({selectedCar.make})</span>
                                            <span className="font-bold text-slate-800">₹ {carPrice.toLocaleString('en-IN')}</span>
                                        </div>
                                    )}
                                    <div className="h-px bg-slate-100" />
                                    <div className="flex justify-between items-baseline pt-1">
                                        <span className="text-base font-bold text-slate-800">Total Quote</span>
                                        <span className="text-2xl font-black text-primary font-display">₹ {totalQuote.toLocaleString('en-IN')}</span>
                                    </div>
                                </div>

                                {/* EMI Calculator Integrated */}
                                {totalQuote > 0 && (
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wide">Integrated EMI Estimate</h4>
                                            <span className="text-xs font-bold text-slate-500">{interestRate}% p.a.</span>
                                        </div>

                                        {/* Slider for Down Payment */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs font-semibold text-slate-600">
                                                <span>Down Payment: {downPaymentPct}%</span>
                                                <span>₹ {((totalQuote * downPaymentPct) / 100).toLocaleString('en-IN')}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="10"
                                                max="80"
                                                step="5"
                                                value={downPaymentPct}
                                                onChange={e => setDownPaymentPct(Number(e.target.value))}
                                                className="w-full accent-primary h-1 rounded bg-slate-200 cursor-pointer"
                                            />
                                        </div>

                                        {/* Dropdown for tenure */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-600">Loan Tenure:</span>
                                            <select
                                                value={tenureMonths}
                                                onChange={e => setTenureMonths(Number(e.target.value))}
                                                className="h-8 px-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white"
                                            >
                                                <option value={12}>12 Months (1 Yr)</option>
                                                <option value={24}>24 Months (2 Yrs)</option>
                                                <option value={36}>36 Months (3 Yrs)</option>
                                                <option value={48}>48 Months (4 Yrs)</option>
                                                <option value={60}>60 Months (5 Yrs)</option>
                                            </select>
                                        </div>

                                        <div className="h-px bg-slate-200" />

                                        <div className="text-center py-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimated Monthly Payment</p>
                                            <p className="text-2xl font-black text-primary font-display mt-0.5">
                                                ₹ {calculateEMI().toLocaleString('en-IN')}<span className="text-sm font-semibold text-slate-500">/mo</span>
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Quote Request Form */}
                                <form onSubmit={handleSubmitQuote} className="space-y-4 pt-4 border-t border-slate-100">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wide">Request Proposal Quote</h4>
                                    
                                    <div>
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            placeholder="Your Name *"
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <input
                                            type="tel"
                                            required
                                            value={phone}
                                            onChange={e => setPhone(e.target.value)}
                                            placeholder="Phone Number *"
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="Email Address (Optional)"
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <textarea
                                            value={remarks}
                                            onChange={e => setRemarks(e.target.value)}
                                            rows={2}
                                            placeholder="Any special customizations or notes..."
                                            className="w-full p-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                                        />
                                    </div>

                                    {errorMsg && (
                                        <div className="p-3 text-xs text-red-500 bg-red-50 rounded-lg">
                                            {errorMsg}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={submitting || selectedAccessories.length === 0}
                                        className="w-full h-12 rounded-xl bg-primary text-white font-bold hover:bg-primary-light transition-colors shadow-lg disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center"
                                    >
                                        {submitting ? (
                                            <Loader2 className="animate-spin" size={18} />
                                        ) : (
                                            `Request Quotation (${selectedAccessories.length} Items)`
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

export default AccessoryCatalog;
