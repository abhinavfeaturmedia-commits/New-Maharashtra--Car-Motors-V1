import React, { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';

const CATEGORIES = [
    { name: 'Engine & Transmission', items: ['Oil Level & Quality', 'Coolant Level', 'Belt Condition', 'Transmission Fluid', 'Clutch Operation', 'Engine Mount', 'Exhaust System'] },
    { name: 'Exterior Body', items: ['Paint Condition', 'Dent / Scratch Check', 'Windshield', 'Headlights', 'Tail Lights', 'Bumpers', 'Side Mirrors'] },
    { name: 'Interior & Comfort', items: ['Seat Condition', 'Dashboard', 'AC / Heater', 'Infotainment System', 'Power Windows', 'Central Locking', 'Boot Space'] },
    { name: 'Electrical System', items: ['Battery Health', 'Wiring Harness', 'Horn', 'Wipers', 'Indicators', 'Camera System', 'Key / Remote'] },
    { name: 'Tyres & Brakes', items: ['Front Tyres', 'Rear Tyres', 'Spare Tyre', 'Brake Pads', 'Brake Discs', 'Handbrake'] },
];

type Status = 'Pass' | 'Fail' | 'NA' | '';

const VehicleInspection = () => {
    const { inventory, refreshData } = useData();
    const availableInventory = inventory.filter(c => c.status !== 'sold');
    
    const [selectedVehicleId, setSelectedVehicleId] = useState(availableInventory.length > 0 ? availableInventory[0].id : '');
    const [statuses, setStatuses] = useState<Record<string, Status>>({});
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const total = CATEGORIES.reduce((s, c) => s + c.items.length, 0);
    const passed = Object.values(statuses).filter(v => v === 'Pass').length;
    const failed = Object.values(statuses).filter(v => v === 'Fail').length;
    const checked = Object.values(statuses).filter(v => v !== '' && v !== undefined).length;
    const score = checked > 0 ? Math.round((passed / ((passed + failed) || 1)) * 100) : 0;

    const setStatus = (item: string, status: Status) => setStatuses(prev => ({ ...prev, [item]: status }));

    const handleSave = async () => {
        if (!selectedVehicleId) return;
        setIsSaving(true);
        
        try {
            // Serialize checklist items to JSON string since schema only has 'notes'
            const formattedNotes = `Score: ${score}% (${passed} Pass, ${failed} Fail)\n\nInspector Notes:\n${notes}\n\nChecklist Dump:\n${JSON.stringify(statuses)}`;
            const finalStatus = score >= 80 ? 'passed' : 'failed';

            const { error } = await supabase.from('inspections').insert({
                inventory_id: selectedVehicleId,
                inspector_name: 'Admin User',
                status: finalStatus,
                notes: formattedNotes
            });

            if (error) {
                alert('Error saving inspection report.');
                console.error(error);
            } else {
                alert('Inspection saved successfully!');
                setStatuses({});
                setNotes('');
                refreshData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Vehicle Inspection</h1>
                    <p className="text-slate-500 text-sm">Log assessments and quality checklists for active inventory.</p>
                </div>
                <button onClick={handleSave} disabled={isSaving} className="h-10 px-5 bg-primary text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-primary-light transition-colors disabled:opacity-50">
                    <span className="material-symbols-outlined text-lg">save</span> {isSaving ? 'Saving...' : 'Save Report'}
                </button>
            </div>

            {/* Vehicle selector + score */}
            <div className="grid lg:grid-cols-4 gap-4">
                <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Select Internal Vehicle</label>
                    <select value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)} className="w-full max-w-md h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary font-medium outline-none">
                        {availableInventory.length === 0 && <option value="">No available inventory</option>}
                        {availableInventory.map(car => (
                            <option key={car.id} value={car.id}>
                                {car.year} {car.make} {car.model} — {car.license_plate}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)] text-center">
                    <div className="relative size-20 mx-auto mb-2">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                            <circle cx="50" cy="50" r="42" fill="none" stroke={score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'} strokeWidth="8" strokeDasharray={`${(score / 100) * 264} 264`} strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-primary font-display">{score}%</span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">{checked}/{total} checked</p>
                </div>
            </div>

            {/* Checklists */}
            {CATEGORIES.map(cat => (
                <div key={cat.name} className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                    <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-primary font-display text-sm">{cat.name}</h3>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{cat.items.filter(i => statuses[i]).length}/{cat.items.length} Scored</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {cat.items.map(item => (
                            <div key={item} className="px-5 py-3 flex items-center justify-between">
                                <span className="text-sm text-slate-700">{item}</span>
                                <div className="flex gap-1">
                                    {(['Pass', 'Fail', 'NA'] as Status[]).map(s => (
                                        <button key={s} onClick={() => setStatus(item, s)} className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-all ${statuses[item] === s
                                            ? s === 'Pass' ? 'bg-green-500 text-white border-green-500' : s === 'Fail' ? 'bg-red-500 text-white border-red-500' : 'bg-slate-400 text-white border-slate-400'
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>{s}</button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Notes */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[var(--shadow-card)]">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Inspector Additional Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Add any major concerns or observations..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-primary outline-none resize-none focus:border-primary/50" />
            </div>
        </div>
    );
};

export default VehicleInspection;
