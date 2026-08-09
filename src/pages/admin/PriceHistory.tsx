import React from 'react';

const PriceHistory = () => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Price History & Market Appraisal</h1>
                    <p className="text-slate-500 text-sm">Track inventory price adjustments against active market API valuations.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-12 flex flex-col items-center justify-center text-center h-[50vh]">
                <div className="size-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-4xl">timeline</span>
                </div>
                <h2 className="text-2xl font-black text-primary font-display mb-2">Market Valuation API Pending</h2>
                <p className="text-slate-500 max-w-md mx-auto mb-4">
                    The external Appraiser Engine (e.g., Indian Blue Book) integration is scheduled for Phase 2.
                    Once connected, active inventory will automatically map listed prices against external market averages here.
                </p>
                <div className="flex items-center gap-2 p-3 bg-slate-50 text-slate-500 rounded-lg text-xs font-bold w-max mx-auto border border-slate-200">
                    <span className="material-symbols-outlined text-sm">api</span> Requires External Authentication
                </div>
            </div>
        </div>
    );
};

export default PriceHistory;
