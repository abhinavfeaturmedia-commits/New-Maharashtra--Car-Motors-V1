import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatPriceLakh, getPrimaryImage } from '../lib/utils';

interface Car {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
    fuel_type: string;
    transmission: string;
    images: string[];
}

const EMICalculator = () => {
    const [searchParams] = useSearchParams();
    const initialPrice = Number(searchParams.get('price')) || 1000000;

    const [loanAmount, setLoanAmount] = useState(initialPrice);
    const [interestRate, setInterestRate] = useState(9.5);
    const [tenureYears, setTenureYears] = useState(5);
    const [tenureMode, setTenureMode] = useState<'years' | 'months'>('years');

    // ─── Budget cars ──────────────────────────────────────────────────────────
    const [budgetCars, setBudgetCars] = useState<Car[]>([]);
    const [carsLoading, setCarsLoading] = useState(false);

    // ─── Apply Form State ─────────────────────────────────────────────────────
    const [isApplying, setIsApplying] = useState(false);
    const [applyForm, setApplyForm] = useState({ full_name: '', phone: '', email: '', preferred_bank: '' });
    const [applyLoading, setApplyLoading] = useState(false);
    const [applySubmitted, setApplySubmitted] = useState(false);
    const [applyError, setApplyError] = useState('');

    const handleApply = async (e: React.FormEvent) => {
        e.preventDefault();
        setApplyError('');
        setApplyLoading(true);

        const { error: err } = await supabase.from('leads').insert({
            type: 'finance',
            full_name: applyForm.full_name.trim(),
            phone: applyForm.phone.trim(),
            email: applyForm.email.trim() || null,
            budget: `₹${(loanAmount / 100000).toFixed(2)}L`,
            message: `EMI Calculator Request: Loan of ₹${loanAmount.toLocaleString('en-IN')} over ${tenureYears} years at ${interestRate}%. Preferred Bank: ${applyForm.preferred_bank || 'No Preference'}. Estimated EMI: ₹${Math.round(emi).toLocaleString('en-IN')}/mo.`,
            source: 'website_finance',
        });

        if (err) {
            setApplyError('Failed to submit application. Please call us directly.');
        } else {
            setApplySubmitted(true);
        }
        setApplyLoading(false);
    };

    const tenureMonths = tenureMode === 'years' ? tenureYears * 12 : tenureYears;
    const monthlyRate = interestRate / 100 / 12;
    const emi = monthlyRate > 0
        ? loanAmount * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) / (Math.pow(1 + monthlyRate, tenureMonths) - 1)
        : loanAmount / tenureMonths;
    const totalPayable = emi * tenureMonths;
    const totalInterest = totalPayable - loanAmount;
    const principalPercent = (loanAmount / totalPayable) * 100;

    // ─── Fetch cars within budget ─────────────────────────────────────────────
    const fetchBudgetCars = useCallback(async (budget: number) => {
        setCarsLoading(true);
        // Loan amount ≈ 80% of on-road price → add 25% buffer
        const maxPrice = Math.round(budget * 1.25);
        const { data } = await supabase
            .from('inventory')
            .select('id, make, model, year, price, fuel_type, transmission, images')
            .in('status', ['available', 'reserved'])
            .lte('price', maxPrice)
            .order('price', { ascending: false })
            .limit(3);
        setBudgetCars(data || []);
        setCarsLoading(false);
    }, []);

    // Debounce so we don't hammer Supabase on every slider tick
    useEffect(() => {
        const timer = setTimeout(() => fetchBudgetCars(loanAmount), 600);
        return () => clearTimeout(timer);
    }, [loanAmount, fetchBudgetCars]);

    return (
        <div className="container-main py-12">
            <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
                <Link to="/" className="hover:text-primary">Home</Link>
                <span className="material-symbols-outlined text-xs">chevron_right</span>
                <span className="text-primary font-medium">EMI Calculator</span>
            </nav>

            <h1 className="text-3xl lg:text-4xl font-black text-primary font-display mb-2">
                Estimate Your <span className="text-accent">Payments</span>
            </h1>
            <p className="text-slate-500 text-lg mb-10 max-w-xl">
                Calculate your monthly car loan payments easily. Adjust the loan amount, interest rate, and tenure to find a plan that suits your budget.
            </p>

            <div className="grid lg:grid-cols-5 gap-8">
                {/* Calculator */}
                <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 p-8 shadow-[var(--shadow-card)] space-y-8">
                    {/* Loan Amount */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold text-primary flex items-center gap-2">
                                <span className="material-symbols-outlined text-accent text-lg">account_balance_wallet</span> Loan Amount
                            </label>
                            <div className="flex items-center gap-1 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200">
                                <span className="text-sm text-slate-400">₹</span>
                                <input
                                    type="text"
                                    value={loanAmount.toLocaleString('en-IN')}
                                    onChange={e => setLoanAmount(parseInt(e.target.value.replace(/,/g, '')) || 0)}
                                    className="w-24 text-sm font-bold text-primary text-right outline-none bg-transparent"
                                />
                            </div>
                        </div>
                        <input type="range" min={100000} max={5000000} step={50000} value={loanAmount} onChange={e => setLoanAmount(Number(e.target.value))} className="w-full accent-accent" />
                        <div className="flex justify-between text-xs text-slate-400 mt-1"><span>₹1L</span><span>₹50L</span></div>
                    </div>

                    {/* Interest Rate */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold text-primary flex items-center gap-2">
                                <span className="material-symbols-outlined text-accent text-lg">percent</span> Interest Rate
                            </label>
                            <div className="flex items-center gap-1 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200">
                                <input type="text" value={interestRate} onChange={e => setInterestRate(parseFloat(e.target.value) || 0)} className="w-12 text-sm font-bold text-primary text-right outline-none bg-transparent" />
                                <span className="text-sm text-slate-400">%</span>
                            </div>
                        </div>
                        <input type="range" min={6} max={20} step={0.1} value={interestRate} onChange={e => setInterestRate(Number(e.target.value))} className="w-full accent-accent" />
                        <div className="flex justify-between text-xs text-slate-400 mt-1"><span>6%</span><span>20%</span></div>
                    </div>

                    {/* Tenure */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold text-primary flex items-center gap-2">
                                <span className="material-symbols-outlined text-accent text-lg">date_range</span> Loan Tenure
                            </label>
                            <div className="flex bg-slate-100 rounded-lg p-0.5">
                                <button onClick={() => setTenureMode('years')} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${tenureMode === 'years' ? 'bg-primary text-white' : 'text-slate-500'}`}>Years</button>
                                <button onClick={() => setTenureMode('months')} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${tenureMode === 'months' ? 'bg-primary text-white' : 'text-slate-500'}`}>Months</button>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {[1, 2, 3, 4, 5, 6, 7].map(y => (
                                <button key={y} onClick={() => setTenureYears(y)} className={`h-10 px-5 rounded-lg text-sm font-semibold transition-all ${tenureYears === y ? 'bg-primary text-white shadow-sm' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
                                    {y}Y
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-500">
                        <span className="material-symbols-outlined text-sm text-slate-400">info</span>
                        <span>Interest rates are subject to change based on your credit score and the car model selected. Rates shown are indicative only.</span>
                    </div>
                </div>

                {/* Results */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Monthly EMI</p>
                        <p className="text-4xl font-black text-primary font-display">₹{Math.round(emi).toLocaleString('en-IN')}<span className="text-base font-medium text-slate-400">/month</span></p>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                        {/* Donut Chart */}
                        <div className="flex justify-center mb-6">
                            <div className="relative size-40">
                                <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#0f1729" strokeWidth="3"
                                        strokeDasharray={`${principalPercent} ${100 - principalPercent}`}
                                        className="transition-all duration-500" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total Amount</p>
                                    <p className="text-xl font-black text-primary font-display">₹{(totalPayable / 100000).toFixed(1)}L</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm text-slate-600"><span className="w-3 h-3 rounded-full bg-primary" /> Principal Amount</span>
                                <span className="text-sm font-bold text-primary">₹{loanAmount.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm text-slate-600"><span className="w-3 h-3 rounded-full bg-slate-300" /> Total Interest</span>
                                <span className="text-sm font-bold text-primary">₹{Math.round(totalInterest).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                <span className="text-sm font-bold text-primary">Total Payable</span>
                                <span className="text-lg font-black text-primary font-display">₹{Math.round(totalPayable).toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>

                    {applySubmitted ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                            <span className="material-symbols-outlined text-emerald-600 text-3xl mb-2 font-bold">check_circle</span>
                            <h4 className="font-bold text-primary text-sm mb-1 font-display">Application Submitted!</h4>
                            <p className="text-xs text-slate-500 mb-3">Our financial advisor will contact you on +91 {applyForm.phone} shortly.</p>
                            <button 
                                onClick={() => { setApplySubmitted(false); setApplyForm({ full_name: '', phone: '', email: '', preferred_bank: '' }); }}
                                className="text-xs font-semibold text-primary underline"
                            >
                                Calculate Another Loan
                            </button>
                        </div>
                    ) : isApplying ? (
                        <form onSubmit={handleApply} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <h4 className="font-bold text-primary text-sm font-display">Apply for Finance</h4>
                            {applyError && <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">{applyError}</div>}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Full Name *</label>
                                <input required type="text" placeholder="Your Name" value={applyForm.full_name} onChange={e => setApplyForm(f => ({ ...f, full_name: e.target.value }))} className="w-full h-10 border border-slate-200 bg-white rounded-xl px-3 text-xs outline-none focus:border-primary" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Phone Number *</label>
                                <div className="flex">
                                    <span className="h-10 px-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl flex items-center text-xs text-slate-500 font-medium">+91</span>
                                    <input required type="tel" placeholder="10-Digit Mobile" value={applyForm.phone} onChange={e => setApplyForm(f => ({ ...f, phone: e.target.value }))} className="flex-1 h-10 border border-slate-200 bg-white rounded-r-xl px-3 text-xs outline-none focus:border-primary" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Email Address</label>
                                <input type="email" placeholder="you@example.com (optional)" value={applyForm.email} onChange={e => setApplyForm(f => ({ ...f, email: e.target.value }))} className="w-full h-10 border border-slate-200 bg-white rounded-xl px-3 text-xs outline-none focus:border-primary" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Preferred Bank</label>
                                <input type="text" placeholder="e.g. HDFC, ICICI, SBI (optional)" value={applyForm.preferred_bank} onChange={e => setApplyForm(f => ({ ...f, preferred_bank: e.target.value }))} className="w-full h-10 border border-slate-200 bg-white rounded-xl px-3 text-xs outline-none focus:border-primary" />
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button type="button" onClick={() => setIsApplying(false)} className="flex-1 h-10 bg-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-300 transition-colors">Cancel</button>
                                <button type="submit" disabled={applyLoading} className="flex-1 h-10 bg-primary text-white font-bold rounded-xl text-xs hover:bg-primary-light transition-colors flex items-center justify-center gap-1">
                                    {applyLoading ? <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Submit App'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <button
                            onClick={() => setIsApplying(true)}
                            className="w-full h-12 bg-gradient-to-r from-accent to-amber-400 text-primary font-bold rounded-xl hover:opacity-90 transition-all shadow-lg text-sm flex items-center justify-center gap-2"
                        >
                            Apply for Finance <span className="material-symbols-outlined text-lg">arrow_forward</span>
                        </button>
                    )}
                    <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-xs">bolt</span> Approval in as fast as 30 minutes
                    </p>
                </div>
            </div>

            {/* Cars within budget */}
            <section className="mt-16">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-2">
                    <div>
                        <h2 className="text-2xl font-black text-primary font-display">Cars within your budget</h2>
                        <p className="text-sm text-slate-500">Based on your loan amount of ₹{formatPriceLakh(loanAmount)} Lakh</p>
                    </div>
                    <Link to="/inventory" className="text-sm font-semibold text-primary hover:text-accent flex items-center gap-1">
                        View all cars <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </Link>
                </div>

                {carsLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-2xl border border-slate-100 animate-pulse">
                                <div className="aspect-[16/10] bg-slate-100 rounded-t-2xl" />
                                <div className="p-5 space-y-3">
                                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : budgetCars.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">directions_car</span>
                        <p className="text-slate-500 font-medium">No cars in inventory match this budget range.</p>
                        <Link to="/inventory" className="mt-4 inline-flex items-center gap-2 h-10 px-6 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors">
                            Browse All Cars
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {budgetCars.map(car => (
                            <Link
                                key={car.id}
                                to={`/car/${car.id}`}
                                className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all group block"
                            >
                                <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
                                    <img
                                        src={getPrimaryImage(car.images)}
                                        alt={`${car.year} ${car.make} ${car.model}`}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                </div>
                                <div className="p-5">
                                    <h3 className="font-bold text-primary font-display mb-1">{car.year} {car.make} {car.model}</h3>
                                    <p className="text-xs text-slate-500 uppercase mb-3">{car.fuel_type} • {car.transmission}</p>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">Price</p>
                                            <p className="text-lg font-black text-primary font-display">₹{formatPriceLakh(car.price)} L</p>
                                        </div>
                                        <span className="text-accent">
                                            <span className="material-symbols-outlined">arrow_outward</span>
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default EMICalculator;
