import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatPriceLakh, getPrimaryImage } from '../lib/utils';

const TIMES = {
    Morning: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM'],
    Afternoon: ['12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM'],
    Evening: ['04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM', '06:00 PM'],
};

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface CarInfo {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
    fuel_type: string;
    transmission: string;
    images: string[];
}

const BookTestDrive = () => {
    const [searchParams] = useSearchParams();
    const carId = searchParams.get('car');

    // ─── Calendar state ───────────────────────────────────────────────────────
    const today = useMemo(() => new Date(), []);

    const [calYear, setCalYear] = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth());
    const [selectedDate, setSelectedDate] = useState<number | null>(null);
    const [selectedTime, setSelectedTime] = useState('10:30 AM');

    // ─── Car info sidebar ─────────────────────────────────────────────────────
    const [car, setCar] = useState<CarInfo | null>(null);
    const [carLoading, setCarLoading] = useState(false);

    // ─── Form state ───────────────────────────────────────────────────────────
    const [form, setForm] = useState({ full_name: '', phone: '' });
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    // ─── Fetch car if ID is passed ────────────────────────────────────────────
    useEffect(() => {
        if (!carId) return;
        const fetchCar = async () => {
            setCarLoading(true);
            const { data } = await supabase
                .from('inventory')
                .select('id, make, model, year, price, fuel_type, transmission, images')
                .eq('id', carId)
                .single();
            if (data) setCar(data);
            setCarLoading(false);
        };
        fetchCar();
    }, [carId]);

    // ─── Calendar helpers ─────────────────────────────────────────────────────
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    // ISO weekday of the 1st: 1=Mon … 7=Sun → offset 0-6
    const firstDayOffset = (() => {
        const d = new Date(calYear, calMonth, 1).getDay(); // 0=Sun, 1=Mon…
        return d === 0 ? 6 : d - 1; // convert to Mon-first
    })();

    const isDateDisabled = (day: number) => {
        const d = new Date(calYear, calMonth, day);
        d.setHours(0, 0, 0, 0);
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return d < t; // past dates disabled
    };

    const prevMonth = () => {
        if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
        else setCalMonth(m => m - 1);
        setSelectedDate(null);
    };

    const nextMonth = () => {
        if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
        else setCalMonth(m => m + 1);
        setSelectedDate(null);
    };

    const selectedDateLabel = selectedDate
        ? `${selectedDate} ${MONTH_NAMES[calMonth]} ${calYear}`
        : 'No date selected';

    // ─── Submit ───────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.full_name || !form.phone) return setError('Please enter your valid details.');
        if (!selectedDate) return setError('Please select a date for the test drive.');

        setError('');
        setLoading(true);

        const isoDate = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`;

        const messageText = car
            ? `Test Drive requested for: ${car.year} ${car.make} ${car.model} on ${selectedDateLabel} at ${selectedTime}`
            : `Test Drive requested for: ${selectedDateLabel} at ${selectedTime}`;

        const { data: leadData, error: err } = await supabase.from('leads').insert({
            type: 'test_drive',
            full_name: form.full_name.trim(),
            phone: form.phone.trim(),
            car_make: car?.make || null,
            car_model: car?.model || null,
            car_year: car?.year || null,
            inventory_id: car?.id || null,
            message: messageText,
            source: 'website_test_drive',
            status: 'new',
        }).select().single();

        if (err) {
            console.error('Test drive lead creation error:', err);
            setError('Something went wrong. Please call us directly.');
            setLoading(false);
            return;
        }

        if (leadData?.id) {
            const { error: bookingErr } = await supabase.from('bookings').insert({
                lead_id: leadData.id,
                inventory_id: car?.id || null,
                customer_name: form.full_name.trim(),
                customer_phone: form.phone.trim(),
                booking_type: 'test_drive',
                booking_date: isoDate,
                booking_time: selectedTime,
                status: 'scheduled',
                notes: `Test Drive requested for ${car ? `${car.year} ${car.make} ${car.model}` : 'Vehicle'}`
            });
            if (bookingErr) {
                console.error('Booking schedule creation error:', bookingErr);
            }
        }

        const { error: tdErr } = await supabase.from('test_drive_bookings').insert({
            customer_name: form.full_name.trim(),
            phone: form.phone.trim(),
            car_id: car?.id || null,
            preferred_date: isoDate,
            preferred_time: selectedTime,
            status: 'scheduled',
            notes: messageText
        });
        if (tdErr) {
            console.error('Test drive history creation error:', tdErr);
        }

        setSubmitted(true);
        setLoading(false);
    };

    return (
        <div className="container-main py-10">
            {/* Progress */}
            <div className="flex items-center gap-4 mb-8 overflow-x-auto pb-2">
                {['Select Car', 'Date & Time', 'Confirmation'].map((step, i) => (
                    <div key={step} className="flex items-center gap-2">
                        <div className={`size-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= 1 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-400'}`}>{i + 1}</div>
                        <span className={`text-sm font-medium ${i <= 1 ? 'text-primary' : 'text-slate-400'}`}>{step}</span>
                        {i < 2 && <div className={`w-12 h-0.5 ${i < 1 ? 'bg-primary' : 'bg-slate-200'}`} />}
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {submitted ? (
                        <div className="bg-white rounded-3xl border border-slate-100 p-10 text-center shadow-xl">
                            <div className="size-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="material-symbols-outlined text-green-600 text-4xl">check_circle</span>
                            </div>
                            <h2 className="text-3xl font-black text-primary font-display mb-3">Test Drive Confirmed!</h2>
                            <p className="text-slate-500 mb-2 max-w-sm mx-auto">
                                Thank you, <strong>{form.full_name}</strong>.
                            </p>
                            <p className="text-slate-500 mb-8 max-w-sm mx-auto">
                                Your test drive is booked for <strong>{selectedDateLabel}</strong> at <strong>{selectedTime}</strong>.
                                Our team will call you shortly to confirm the appointment.
                            </p>
                            <Link to="/" className="inline-flex h-12 px-8 bg-primary text-white font-bold rounded-xl items-center justify-center hover:bg-primary-light transition-all">
                                Return to Home
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black text-primary font-display mb-1">
                                    Select <span className="font-serif-italic font-normal text-amber-600">Date & Time</span>
                                </h1>
                                <p className="text-slate-500 text-sm">Choose a convenient slot for your test drive at our showroom.</p>
                            </div>

                            {/* Calendar */}
                            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                                <div className="flex items-center justify-between mb-4">
                                    <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                        <span className="material-symbols-outlined text-slate-400">chevron_left</span>
                                    </button>
                                    <h3 className="font-bold text-primary font-display">
                                        {MONTH_NAMES[calMonth]} {calYear}
                                    </h3>
                                    <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                        <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                                    </button>
                                </div>

                                {/* Day headers */}
                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {DAY_LABELS.map(d => (
                                        <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase py-2">{d}</div>
                                    ))}
                                </div>

                                {/* Date cells */}
                                <div className="grid grid-cols-7 gap-1">
                                    {/* Empty offset cells */}
                                    {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e${i}`} />)}

                                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                                        const disabled = isDateDisabled(d);
                                        const selected = selectedDate === d;
                                        return (
                                            <button
                                                key={d}
                                                onClick={() => !disabled && setSelectedDate(d)}
                                                disabled={disabled}
                                                className={`aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all
                                                    ${selected ? 'bg-primary text-white font-bold shadow-sm'
                                                    : disabled ? 'text-slate-300 cursor-not-allowed'
                                                    : 'text-slate-700 hover:bg-slate-100'}`}
                                            >
                                                {d}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex items-center gap-6 mt-4 text-xs text-slate-400">
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary" /> Selected</span>
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 border" /> Available</span>
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-50" /> Past</span>
                                </div>
                            </div>

                            {/* Time Slots */}
                            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                                <h3 className="font-bold text-primary font-display mb-4">Available Time Slots</h3>
                                {Object.entries(TIMES).map(([period, slots]) => (
                                    <div key={period} className="mb-5">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm text-accent">
                                                {period === 'Morning' ? 'wb_sunny' : period === 'Afternoon' ? 'wb_cloudy' : 'wb_twilight'}
                                            </span>
                                            {period}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {slots.map(t => (
                                                <button
                                                    key={t}
                                                    onClick={() => setSelectedTime(t)}
                                                    className={`h-9 px-4 rounded-lg text-sm font-medium transition-all ${selectedTime === t
                                                        ? 'bg-primary text-white shadow-sm'
                                                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Personal Details */}
                            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                                <h3 className="font-bold text-primary font-display mb-4">Your Details</h3>

                                {error && (
                                    <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-5 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">error</span>{error}
                                    </div>
                                )}

                                {selectedDate && (
                                    <div className="bg-accent/10 border border-accent/20 rounded-xl px-4 py-3 mb-5 flex items-center gap-2 text-sm">
                                        <span className="material-symbols-outlined text-accent text-lg">event_available</span>
                                        <span className="font-medium text-primary">
                                            {selectedDateLabel} at <strong>{selectedTime}</strong>
                                        </span>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Full Name</label>
                                            <input
                                                type="text"
                                                value={form.full_name}
                                                onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                                                required
                                                disabled={loading}
                                                placeholder="Enter your name"
                                                className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Phone</label>
                                            <input
                                                type="tel"
                                                value={form.phone}
                                                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                                                required
                                                disabled={loading}
                                                placeholder="+91 XXXXX XXXXX"
                                                className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-primary/10"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="mt-6 w-full h-12 bg-accent text-primary font-bold rounded-xl hover:bg-accent-hover transition-all shadow-sm text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                                    >
                                        {loading
                                            ? <span className="size-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                            : <><span className="material-symbols-outlined text-lg">event_available</span> Confirm Test Drive</>
                                        }
                                    </button>
                                </form>
                            </div>
                        </>
                    )}
                </div>

                {/* Car Info Sidebar */}
                <div className="space-y-4">
                    <div className="sticky top-[5.5rem]">
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                            {carLoading ? (
                                <div className="flex flex-col gap-3 animate-pulse">
                                    <div className="aspect-[16/10] rounded-xl bg-slate-100" />
                                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                                    <div className="h-4 bg-slate-100 rounded w-1/2" />
                                </div>
                            ) : car ? (
                                <>
                                    <div className="aspect-[16/10] rounded-xl overflow-hidden bg-slate-100 mb-4">
                                        <img
                                            src={getPrimaryImage(car.images)}
                                            alt={`${car.year} ${car.make} ${car.model}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <h3 className="font-bold text-primary font-display text-lg mb-1">{car.year} {car.make} {car.model}</h3>
                                    <p className="text-lg font-black text-primary font-display mb-3">₹{formatPriceLakh(car.price)} Lakh</p>
                                    <div className="grid grid-cols-2 gap-2 text-center">
                                        {[
                                            { val: car.fuel_type, label: 'Fuel' },
                                            { val: car.transmission, label: 'Trans' },
                                        ].map(s => (
                                            <div key={s.label} className="bg-slate-50 rounded-lg py-2.5">
                                                <p className="text-xs font-bold text-primary truncate px-1">{s.val}</p>
                                                <p className="text-[10px] text-slate-400 uppercase">{s.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="aspect-[16/10] rounded-xl overflow-hidden bg-slate-100 mb-4 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-4xl text-slate-300">directions_car</span>
                                    </div>
                                    <p className="text-sm text-slate-400 text-center">No car selected. <Link to="/inventory" className="text-accent font-semibold hover:underline">Browse inventory →</Link></p>
                                </>
                            )}
                        </div>

                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mt-4">
                            <h4 className="text-sm font-bold text-primary mb-2">📌 Showroom Location</h4>
                            <p className="text-xs text-slate-500">New Maharashtra Motors, Shiroli (P), Kolhapur, Maharashtra 416122</p>
                            <a
                                href="https://share.google/Wzyb6tEjrHeTi0J0n"
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold text-accent hover:underline mt-2 inline-block"
                            >
                                View on Map →
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BookTestDrive;
