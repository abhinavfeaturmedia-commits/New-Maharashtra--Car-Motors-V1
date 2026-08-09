import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const SERVICES = [
    { id: 'general', icon: 'build', title: 'General Service', desc: 'Regular maintenance — oil change, filter replacement, fluid top-up, and 50-point checkup.' },
    { id: 'denting', icon: 'auto_fix_high', title: 'Denting & Painting', desc: 'Expert denting repairs and premium painting for your car body. We restore it to showroom condition.' },
    { id: 'ac', icon: 'ac_unit', title: 'AC Repair & Gas Filling', desc: 'Complete AC diagnostics, gas refill, compressor check, and cooling service by certified technicians.' },
    { id: 'wheel', icon: 'tire_repair', title: 'Wheel Alignment & Care', desc: 'Computerized wheel alignment, balancing, and tire rotation for a smooth, safe ride.' },
];

const ServiceBooking = () => {
    const [selected, setSelected] = useState<string[]>(['general']);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('10:00 AM');

    // Contact fields
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [secondaryPhone, setSecondaryPhone] = useState('');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [personalAddress, setPersonalAddress] = useState('');
    const [vehicleDesc, setVehicleDesc] = useState('');

    // UI state
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const toggle = (id: string) => {
        setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!name.trim()) newErrors.name = 'Full name is required';
        if (!phone.trim()) newErrors.phone = 'Phone number is required';
        else if (!/^[6-9]\d{9}$/.test(phone.replace(/\s/g, ''))) newErrors.phone = 'Enter a valid 10-digit Indian mobile number';
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Enter a valid email address';
        if (selected.length === 0) newErrors.services = 'Please select at least one service';
        if (!selectedDate) newErrors.date = 'Please select a preferred date';
        return newErrors;
    };

    const handleSubmit = async () => {
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        setErrors({});
        setSubmitting(true);

        const selectedServiceTitles = selected
            .map(id => SERVICES.find(s => s.id === id)?.title)
            .filter(Boolean)
            .join(', ');

        const { data: leadData, error } = await supabase.from('leads').insert({
            full_name: name.trim(),
            phone: phone.trim(),
            email: email.trim() || null,
            secondary_phone: secondaryPhone.trim() || null,
            whatsapp_number: whatsappNumber.trim() || null,
            personal_address: personalAddress.trim() || null,
            type: 'service',
            source: 'website',
            status: 'new',
            message: `Services: ${selectedServiceTitles} | Vehicle: ${vehicleDesc || 'Not specified'} | Date: ${selectedDate} | Time: ${selectedTime}`,
        }).select().single();

        setSubmitting(false);
        if (!error) {
            if (leadData?.id) {
                await supabase.from('bookings').insert({
                    lead_id: leadData.id,
                    booking_type: 'service',
                    booking_date: selectedDate,
                    booking_time: selectedTime,
                    status: 'scheduled'
                });
            }
            setSubmitted(true);
        } else {
            console.error('Service booking error:', error);
            setErrors({ submit: 'Something went wrong. Please call us directly at 098232 37975.' });
        }
    };

    if (submitted) {
        return (
            <div className="container-main py-20 text-center max-w-lg mx-auto">
                <div className="size-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-green-600 text-4xl">check_circle</span>
                </div>
                <h2 className="text-2xl font-black text-primary font-display mb-3">Booking Confirmed!</h2>
                <p className="text-slate-500 mb-2">
                    Thank you, <span className="font-semibold text-primary">{name}</span>! Your service appointment request has been received.
                </p>
                <p className="text-slate-500 text-sm mb-8">
                    Our team will call you at <span className="font-semibold text-primary">{phone}</span> within a few hours to confirm your slot for <span className="font-semibold">{selectedDate}</span>.
                </p>
                <Link to="/" className="inline-flex h-12 px-8 items-center justify-center gap-2 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors shadow-sm">
                    <span className="material-symbols-outlined text-lg">home</span> Back to Home
                </Link>
            </div>
        );
    }

    return (
        <div className="container-main py-12">
            <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
                <Link to="/" className="hover:text-primary">Home</Link>
                <span className="material-symbols-outlined text-xs">chevron_right</span>
                <span className="text-primary font-medium">Schedule Service</span>
            </nav>

            <h1 className="text-3xl font-black text-primary font-display mb-2">Schedule Your Service</h1>
            <p className="text-slate-500 text-lg mb-10">Expert care for your vehicle at Kolhapur's most trusted service center.</p>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Services */}
                <div className="lg:col-span-2">
                    <h2 className="text-lg font-bold text-primary font-display mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-accent">checklist</span> Select Services
                    </h2>
                    <div className="grid md:grid-cols-2 gap-4 mb-10">
                        {SERVICES.map(s => (
                            <button key={s.id} onClick={() => toggle(s.id)} className={`text-left rounded-2xl border-2 p-5 transition-all ${selected.includes(s.id) ? 'border-primary bg-primary/5 shadow-md' : 'border-slate-100 bg-white shadow-[var(--shadow-card)] hover:border-slate-200'}`}>
                                <div className="flex items-start gap-4">
                                    <div className={`size-12 rounded-xl flex items-center justify-center shrink-0 ${selected.includes(s.id) ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                                        <span className="material-symbols-outlined text-xl">{s.icon}</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-primary font-display text-base mb-1">{s.title}</h3>
                                        <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                                    </div>
                                </div>
                                {selected.includes(s.id) && (
                                    <div className="mt-3 flex items-center gap-1 text-xs font-bold text-primary">
                                        <span className="material-symbols-outlined text-sm">check_circle</span> Selected
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                    {errors.services && <p className="text-red-500 text-sm mb-4 flex items-center gap-1"><span className="material-symbols-outlined text-base">error</span>{errors.services}</p>}

                    {/* Why choose us */}
                    <div className="bg-slate-50 rounded-2xl p-8">
                        <h3 className="text-lg font-bold text-primary font-display mb-6">Why Choose Us?</h3>
                        <div className="grid md:grid-cols-3 gap-6">
                            {[
                                { icon: 'verified', title: 'Genuine Parts', desc: 'Only OEM and company-approved spare parts.' },
                                { icon: 'engineering', title: 'Expert Mechanics', desc: '20+ years combined experience in Kolhapur.' },
                                { icon: 'schedule', title: 'On-Time Delivery', desc: 'We value your time—strict pickup/delivery.' },
                            ].map(w => (
                                <div key={w.title} className="flex flex-col items-center text-center">
                                    <div className="size-12 rounded-xl bg-accent/10 flex items-center justify-center mb-3">
                                        <span className="material-symbols-outlined text-accent text-xl">{w.icon}</span>
                                    </div>
                                    <h4 className="font-bold text-primary text-sm mb-1">{w.title}</h4>
                                    <p className="text-xs text-slate-500">{w.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Booking Sidebar */}
                <div>
                    <div className="sticky top-[5.5rem]">
                        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)] space-y-5">
                            <h3 className="font-bold text-primary font-display text-lg">Booking Details</h3>

                            {/* Contact Info */}
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                                    Full Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g., Rahul Sharma"
                                    className={`w-full h-11 bg-slate-50 border rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 ${errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                                />
                                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                                    Phone Number <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="e.g., 9876543210"
                                    className={`w-full h-11 bg-slate-50 border rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 ${errors.phone ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                                />
                                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                                    Email <span className="text-xs text-slate-400">(optional)</span>
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="e.g., rahul@example.com"
                                    className={`w-full h-11 bg-slate-50 border rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10 ${errors.email ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                                />
                                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                                    Secondary Phone <span className="text-xs text-slate-400">(optional)</span>
                                </label>
                                <input
                                    type="tel"
                                    value={secondaryPhone}
                                    onChange={e => setSecondaryPhone(e.target.value)}
                                    placeholder="Alternate contact number"
                                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                                    WhatsApp Number <span className="text-xs text-slate-400">(if different)</span>
                                </label>
                                <input
                                    type="tel"
                                    value={whatsappNumber}
                                    onChange={e => setWhatsappNumber(e.target.value)}
                                    onFocus={() => { if (!whatsappNumber && phone) setWhatsappNumber(phone); }}
                                    placeholder="Auto-fills from phone number"
                                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                                    Your Address <span className="text-xs text-slate-400">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={personalAddress}
                                    onChange={e => setPersonalAddress(e.target.value)}
                                    placeholder="Street, Area, City"
                                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Your Vehicle</label>
                                <input
                                    type="text"
                                    value={vehicleDesc}
                                    onChange={e => setVehicleDesc(e.target.value)}
                                    placeholder="e.g., Honda City 2020"
                                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                                    Preferred Date <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    min={new Date().toISOString().split('T')[0]}
                                    onChange={e => setSelectedDate(e.target.value)}
                                    className={`w-full h-11 bg-slate-50 border rounded-xl px-4 text-sm outline-none ${errors.date ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                                />
                                {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Time Slot</label>
                                <div className="flex flex-wrap gap-2">
                                    {['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '04:00 PM'].map(t => (
                                        <button key={t} onClick={() => setSelectedTime(t)} className={`h-8 px-3 rounded-lg text-xs font-medium transition-all ${selectedTime === t ? 'bg-primary text-white' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Order Summary */}
                            <div className="bg-slate-50 rounded-xl p-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Order Summary</h4>
                                {selected.map(id => {
                                    const s = SERVICES.find(sv => sv.id === id);
                                    return s ? (
                                        <div key={id} className="flex items-center justify-between py-1.5">
                                            <span className="text-sm text-slate-700">{s.title}</span>
                                            <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>
                                        </div>
                                    ) : null;
                                })}
                                {selected.length === 0 && <p className="text-xs text-slate-400 italic">No services selected</p>}
                            </div>

                            {errors.submit && (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 flex items-start gap-2">
                                    <span className="material-symbols-outlined text-base shrink-0">error</span>
                                    {errors.submit}
                                </div>
                            )}

                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full h-12 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                {submitting ? (
                                    <>
                                        <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Booking...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-lg">event_available</span> Confirm Booking
                                    </>
                                )}
                            </button>
                            <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1">
                                <span className="material-symbols-outlined text-xs text-green-500">verified</span> Free vehicle pickup & drop
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServiceBooking;
