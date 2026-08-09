import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Car {
    id: string;
    make: string;
    model: string;
    year: number;
    price: number;
    fuel_type: string;
    transmission: string;
    mileage: number;
    condition: string;
    images: string[];
}

const SECTIONS = [
    { title: 'Vehicle Details', rows: [{ key: 'year', label: 'Year' }, { key: 'price', label: 'Price' }, { key: 'condition', label: 'Condition' }] },
    { title: 'Engine & Performance', rows: [{ key: 'fuel_type', label: 'Fuel Type' }, { key: 'transmission', label: 'Transmission' }] },
    { title: 'Usage', rows: [{ key: 'mileage', label: 'Odometer (km)' }] },
];

const CompareModels = () => {
    const [searchParams] = useSearchParams();
    const paramCarA = searchParams.get('carA') || '';
    const paramCarB = searchParams.get('carB') || '';

    const [inventory, setInventory] = useState<Car[]>([]);
    const [loading, setLoading] = useState(true);
    const [leftId, setLeftId] = useState('');
    const [rightId, setRightId] = useState('');

    useEffect(() => {
        const fetchInventory = async () => {
            const { data, error } = await supabase
                .from('inventory')
                .select('id, make, model, year, price, fuel_type, transmission, mileage, condition, images')
                .in('status', ['available', 'reserved'])
                .order('created_at', { ascending: false });
            if (!error && data) {
                setInventory(data);
                
                const hasA = data.some(c => c.id === paramCarA);
                const hasB = data.some(c => c.id === paramCarB);

                if (hasA) {
                    setLeftId(paramCarA);
                } else if (data.length >= 1) {
                    setLeftId(data[0].id);
                }

                if (hasB) {
                    setRightId(paramCarB);
                } else if (data.length >= 2) {
                    const fallbackB = data.find(c => c.id !== (hasA ? paramCarA : data[0].id));
                    setRightId(fallbackB ? fallbackB.id : (data[1] ? data[1].id : ''));
                }
            }
            setLoading(false);
        };
        fetchInventory();
    }, [paramCarA, paramCarB]);

    const getPrimaryImage = (images: string[] | null) => {
        if (!images || images.length === 0) return 'https://placehold.co/800x500/slate/white?text=No+Photo';
        const img = images[0];
        if (img.startsWith('http')) return img;
        return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/car-images/${img}`;
    };

    const leftCar = inventory.find(c => c.id === leftId) || null;
    const rightCar = inventory.find(c => c.id === rightId) || null;

    const getVal = (car: Car | null, key: string): string => {
        if (!car) return '—';
        const val = (car as any)[key];
        if (val === undefined || val === null || val === '') return '—';
        if (key === 'price') return Number(val) > 0 ? `₹${(Number(val) / 100000).toFixed(2)} L` : 'Price on Request';
        if (key === 'mileage') return `${Number(val).toLocaleString('en-IN')} km`;
        return String(val);
    };

    if (loading) {
        return <div className="container-main py-20 text-center text-slate-400 font-medium">Loading inventory...</div>;
    }

    if (inventory.length < 2) {
        return (
            <div className="container-main py-20 text-center">
                <div className="size-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 mx-auto">
                    <span className="material-symbols-outlined text-3xl text-slate-300">compare</span>
                </div>
                <h2 className="text-xl font-bold text-primary font-display mb-2">Not Enough Cars to Compare</h2>
                <p className="text-slate-400 mb-6">We need at least 2 vehicles in inventory to enable the comparison tool.</p>
                <Link to="/inventory" className="inline-flex items-center gap-2 h-10 px-6 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors">View Inventory</Link>
            </div>
        );
    }

    return (
        <div className="container-main py-12">
            <h1 className="text-3xl font-black text-primary font-display mb-2">Compare Models</h1>
            <p className="text-slate-500 mb-8">Select two vehicles from our live inventory to compare side by side.</p>

            {/* Car Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-10">
                {[
                    { car: leftCar, id: leftId, setId: setLeftId, excludeId: rightId },
                    { car: rightCar, id: rightId, setId: setRightId, excludeId: leftId },
                ].map(({ car, id, setId, excludeId }, idx) => (
                    <div key={idx} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)] text-center">
                        <div className="aspect-[16/10] rounded-xl overflow-hidden bg-slate-100 mb-4">
                            {car ? (
                                <img src={getPrimaryImage(car.images)} alt={`${car.year} ${car.make} ${car.model}`} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                    <span className="material-symbols-outlined text-4xl">directions_car</span>
                                </div>
                            )}
                        </div>
                        <select
                            value={id}
                            onChange={e => setId(e.target.value)}
                            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-medium text-primary outline-none focus:ring-2 focus:ring-primary/10"
                        >
                            <option value="">— Select a Car —</option>
                            {inventory.filter(c => c.id !== excludeId).map(c => (
                                <option key={c.id} value={c.id}>{c.year} {c.make} {c.model}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

            {/* Comparison Table */}
            {leftCar && rightCar ? (
                <div className="space-y-8">
                    {SECTIONS.map(section => (
                        <div key={section.title}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-0.5 w-6 bg-accent rounded-full" />
                                <h2 className="text-lg font-bold text-primary font-display">{section.title}</h2>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-[var(--shadow-card)]">
                                {section.rows.map((row, i) => (
                                    <div key={row.key} className={`flex flex-col sm:grid sm:grid-cols-3 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                                        {/* Label on top on mobile viewports */}
                                        <div className="sm:hidden px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-slate-100/50 border-b border-slate-100 flex items-center justify-center">
                                            {row.label}
                                        </div>
                                        <div className="flex sm:contents">
                                            <div className="flex-1 sm:flex-initial px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-bold text-primary flex items-center justify-center sm:justify-start bg-slate-50/20 sm:bg-slate-50/50">
                                                {getVal(leftCar, row.key)}
                                            </div>
                                            <div className="hidden sm:flex px-2 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold text-slate-400 text-center uppercase tracking-wide items-center justify-center bg-white border-x border-slate-50">
                                                {row.label}
                                            </div>
                                            <div className="flex-1 sm:flex-initial px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-bold text-primary flex items-center justify-center sm:justify-end bg-slate-50/20 sm:bg-slate-50/50 border-l sm:border-l-0 border-slate-100">
                                                {getVal(rightCar, row.key)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-10 text-slate-400 text-sm">Select two cars above to see the comparison.</div>
            )}

            {/* CTA */}
            {leftCar && rightCar && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-8 mt-8 mb-16">
                    {[leftCar, rightCar].map(car => (
                        <div key={car.id} className="flex flex-col sm:flex-row gap-2">
                            <Link to={`/car/${car.id}`} className="flex-1 h-12 flex items-center justify-center gap-2 bg-white text-primary border-2 border-primary font-bold rounded-xl hover:bg-slate-50 transition-colors text-sm">
                                View Details
                            </Link>
                            <Link to={`/book-test-drive?car=${car.id}`} className="flex-1 h-12 flex items-center justify-center gap-2 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors text-sm">
                                <span className="material-symbols-outlined text-lg">directions_car</span> Test Drive
                            </Link>
                        </div>
                    ))}
                </div>
            )}

            {/* Confused */}
            <div className="bg-slate-50 rounded-2xl p-8 text-center mb-8">
                <h3 className="text-xl font-bold text-primary font-display mb-2">Still confused?</h3>
                <p className="text-slate-500 mb-6">Let our experts in Kolhapur help you choose the right car for your needs.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link to="/contact" className="h-11 px-6 flex items-center gap-2 bg-primary text-white font-semibold rounded-xl hover:bg-primary-light transition-colors text-sm">Contact Us</Link>
                    <Link to="/contact" className="h-11 px-6 flex items-center gap-2 border-2 border-primary text-primary font-semibold rounded-xl hover:bg-primary hover:text-white transition-all text-sm">Visit Showroom</Link>
                </div>
            </div>
        </div>
    );
};

export default CompareModels;
