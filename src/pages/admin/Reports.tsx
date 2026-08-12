import React, { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Config ───────────────────────────────────────────────────────────────────

const REPORT_TYPES = ['Sales Report', 'Inventory Report', 'Lead Analysis', 'Vehicle Expenses Report', 'Commission Report'];

// ─── Component ────────────────────────────────────────────────────────────────

const Reports = () => {
    const { sales, inventory, leads, expenses, reportHistory, refreshData } = useData();
    const { user, profile } = useAuth();
    const [reportType, setReportType] = useState('Sales Report');
    const [dateFrom, setDateFrom]     = useState('');
    const [dateTo, setDateTo]         = useState('');
    const [generating, setGenerating] = useState(false);

    // ─── CSV Helpers ──────────────────────────────────────────────────────────

    const convertToCSV = (arr: any[]) => {
        if (arr.length === 0) return '';
        const keys = Object.keys(arr[0]).filter(k => typeof arr[0][k] !== 'object');
        const header = keys.join(',');
        const rows = arr.map(obj => keys.map(k => {
            const val = obj[k] !== null && obj[k] !== undefined ? obj[k] : '';
            return `"${String(val).replace(/"/g, '""')}"`;
        }).join(','));
        return [header, ...rows].join('\n');
    };

    const downloadCSV = (csvContent: string, fileName: string) => {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        setTimeout(() => {
            link.click();
            setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(url); }, 500);
        }, 0);
    };

    // ─── Generate & Persist Report ────────────────────────────────────────────

    const generateReport = async () => {
        setGenerating(true);
        try {
            let dataToExport: any[] = [];
            let fileName = '';

            const filterDate = (dateStr: string) => {
                if (!dateFrom && !dateTo) return true;
                const d  = new Date(dateStr).getTime();
                const dF = dateFrom ? new Date(dateFrom).getTime() : 0;
                const dT = dateTo ? new Date(dateTo).getTime() : Infinity;
                return d >= dF && d <= dT;
            };

            const today = new Date().toISOString().split('T')[0];

            switch (reportType) {
                case 'Sales Report':
                    dataToExport = sales.filter(s => filterDate(s.sale_date)).map(s => ({
                        SaleID:      s.id,
                        Date:        new Date(s.sale_date).toLocaleDateString('en-IN'),
                        Customer:    s.customer?.full_name || s.customer_name || 'General',
                        Phone:       s.customer?.phone || s.customer_phone || '',
                        Vehicle:     `${s.car?.year || ''} ${s.car?.make || ''} ${s.car?.model || ''}`.trim(),
                        LicensePlate: s.car?.license_plate || s.car?.registration_no || '',
                        SaleType:    s.sale_type || 'purchased',
                        FinalPrice:  s.sale_price ?? s.final_price,
                        Profit:      s.profit || 0,
                        Notes:       s.notes || '',
                    }));
                    fileName = `Sales_Report_${today}.csv`;
                    break;

                case 'Inventory Report':
                    dataToExport = inventory.filter(i => filterDate(i.created_at)).map(i => ({
                        StockID:      i.id,
                        Make:         i.make,
                        Model:        i.model,
                        Variant:      i.variant || '',
                        Year:         i.year,
                        LicensePlate: i.license_plate || i.registration_no || '',
                        Color:        i.color || '',
                        FuelType:     i.fuel_type || '',
                        Transmission: i.transmission || '',
                        Mileage:      i.mileage || '',
                        Status:       i.status,
                        Source:       i.source || '',
                        ListPrice:    i.price,
                        PurchaseCost: i.purchase_cost || '',
                    }));
                    fileName = `Inventory_Report_${today}.csv`;
                    break;

                case 'Lead Analysis':
                    dataToExport = leads.filter((l: any) => filterDate(l.created_at)).map((l: any) => ({
                        LeadID:        l.id,
                        Created:       new Date(l.created_at).toLocaleDateString('en-IN'),
                        Name:          l.full_name || l.name || '',
                        Phone:         l.phone,
                        Email:         l.email || '',
                        City:          l.city || '',
                        LeadType:      l.lead_type || l.type || '',
                        Status:        l.status,
                        Source:        l.source || '',
                        AssignedTo:    l.assigned_profile?.full_name || '',
                        OfferMade:     l.offer_made || '',
                        OfferOutcome:  l.offer_outcome || '',
                    }));
                    fileName = `Lead_Analysis_${today}.csv`;
                    break;

                case 'Vehicle Expenses Report':
                    dataToExport = expenses.filter((e: any) => filterDate(e.expense_date || e.created_at)).map((e: any) => ({
                        ExpenseID: e.id,
                        Date:      new Date(e.expense_date || e.created_at).toLocaleDateString('en-IN'),
                        Category:  e.category,
                        Amount:    e.amount,
                        Vehicle:   e.car ? `${e.car.year || ''} ${e.car.make || ''} ${e.car.model || ''}`.trim() : 'General',
                        License:   e.car?.license_plate || e.car?.registration_no || '',
                        Memo:      e.description || '',
                    }));
                    fileName = `Expenses_Report_${today}.csv`;
                    break;

                case 'Commission Report':
                    dataToExport = sales.filter(s => filterDate(s.sale_date)).map(s => ({
                        SaleID:    s.id,
                        Date:      new Date(s.sale_date).toLocaleDateString('en-IN'),
                        Vehicle:   `${s.car?.year || ''} ${s.car?.make || ''} ${s.car?.model || ''}`.trim(),
                        SalePrice: s.sale_price ?? s.final_price,
                        Profit:    s.profit || 0,
                        Commission: Math.round((Number(s.profit) || 0) * 0.05),  // 5% commission example
                        SoldBy:    s.sold_by || '',
                    }));
                    fileName = `Commission_Report_${today}.csv`;
                    break;
            }

            if (dataToExport.length === 0) {
                alert('No records found for the selected time range.');
                return;
            }

            const csv = convertToCSV(dataToExport);
            const sizeKb = parseFloat((csv.length / 1024).toFixed(2));

            // ─── Persist to Supabase ──────────────────────────────────────────
            await supabase.from('report_history').insert({
                report_type:       reportType,
                filters_json:      { dateFrom: dateFrom || null, dateTo: dateTo || null, reportType },
                row_count:         dataToExport.length,
                file_name:         fileName,
                file_size_kb:      sizeKb,
                generated_by:      user?.id ?? null,
                generated_by_name: (profile as any)?.full_name ?? user?.email ?? 'Admin',
            });

            refreshData(); // update reportHistory in context

            // Trigger CSV download
            downloadCSV(csv, fileName);

        } catch (err: any) {
            console.error('Export failed', err);
            alert('Failed to generate report: ' + (err.message || 'Unknown error'));
        } finally {
            setGenerating(false);
        }
    };

    // ─── Re-download (note: we can't re-generate CSV from DB without raw data,
    //     so we re-generate fresh with same filters stored in filters_json) ────

    const handleRedownload = async (r: any) => {
        // Restore filters from the stored record and re-trigger generation
        setReportType(r.report_type);
        setDateFrom(r.filters_json?.dateFrom || '');
        setDateTo(r.filters_json?.dateTo || '');
        // Small timeout to let state update
        setTimeout(() => {
            alert(`Filters restored for "${r.report_type}". Click "Extract CSV" to re-download.`);
        }, 100);
    };

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Data Reports Extractor</h1>
                    <p className="text-slate-500 text-sm">Download aggregated CSV extracts — history persisted to Supabase across all sessions.</p>
                </div>
                <span className="py-2 px-3 text-[10px] font-bold tracking-wider uppercase text-blue-600 bg-blue-100 rounded-lg shadow-sm">NATIVE EXPORTER</span>
            </div>

            {/* Generator Panel */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)]">
                <h2 className="font-bold text-primary font-display text-lg mb-5">Export Production Data</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Report Entity</label>
                        <select value={reportType} onChange={e => setReportType(e.target.value)} className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary font-medium outline-none">
                            {REPORT_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Start Date (Optional)</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">End Date (Optional)</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none" />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={generateReport} disabled={generating} className="flex-1 h-10 bg-primary text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-md shadow-primary/20">
                            <span className={`material-symbols-outlined text-lg ${generating ? 'animate-spin' : ''}`}>{generating ? 'sync' : 'description'}</span>
                            {generating ? 'Building...' : 'Extract CSV'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Persisted Report History */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                <div className="p-5 pb-3 flex items-center justify-between border-b border-slate-50">
                    <div>
                        <h2 className="font-bold text-primary font-display text-lg">Report History</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Persisted to Supabase — available across all devices & sessions</p>
                    </div>
                    {reportHistory.length > 0 && (
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{reportHistory.length} reports</span>
                    )}
                </div>
                <table className="w-full">
                    <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                            <th className="text-left px-5 py-2.5">Report</th>
                            <th className="text-left px-5 py-2.5">Records</th>
                            <th className="text-left px-5 py-2.5">Generated By</th>
                            <th className="text-left px-5 py-2.5">Generated At</th>
                            <th className="text-left px-5 py-2.5">Size</th>
                            <th className="text-left px-5 py-2.5">Filters</th>
                            <th className="text-left px-5 py-2.5">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportHistory.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-10 text-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-200 block mb-3">analytics</span>
                                    <p className="text-slate-400 font-medium">No reports generated yet.</p>
                                    <p className="text-slate-300 text-sm">Reports you generate will appear here and persist across sessions.</p>
                                </td>
                            </tr>
                        )}
                        {reportHistory.map((r: any) => (
                            <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                <td className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg text-green-600">table_chart</span>
                                        <div>
                                            <p className="text-sm font-semibold text-primary">{r.report_type}</p>
                                            <p className="text-[10px] text-slate-400">{r.file_name}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-3">
                                    <span className="text-sm font-bold text-primary">{r.row_count?.toLocaleString()}</span>
                                    <span className="text-xs text-slate-400 ml-1">rows</span>
                                </td>
                                <td className="px-5 py-3 text-sm text-slate-600">{r.generated_by_name || 'Admin'}</td>
                                <td className="px-5 py-3 text-sm text-slate-500">{formatDate(r.created_at)}</td>
                                <td className="px-5 py-3 text-sm text-slate-500">{r.file_size_kb} KB</td>
                                <td className="px-5 py-3">
                                    <div className="flex flex-wrap gap-1">
                                        {r.filters_json?.dateFrom && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">From: {r.filters_json.dateFrom}</span>}
                                        {r.filters_json?.dateTo   && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">To: {r.filters_json.dateTo}</span>}
                                        {!r.filters_json?.dateFrom && !r.filters_json?.dateTo && <span className="text-[10px] text-slate-400">All time</span>}
                                    </div>
                                </td>
                                <td className="px-5 py-3">
                                    <button onClick={() => handleRedownload(r)} className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg flex items-center transition-colors" title="Restore filters & re-download">
                                        <span className="material-symbols-outlined text-lg">replay</span>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Reports;
