import React, { useState } from 'react';
import { useData } from '../../contexts/DataContext';

const REPORT_TYPES = ['Sales Report', 'Inventory Report', 'Lead Analysis', 'Vehicle Expenses Report'];

const Reports = () => {
    const { sales, inventory, leads, expenses } = useData();
    const [reportType, setReportType] = useState('Sales Report');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [generating, setGenerating] = useState(false);

    // Mock history of generated reports, ideally saved to your database, but kept in state for demo UX.
    const [recentReports, setRecentReports] = useState<any[]>([]);

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
        const link = document.createElement("a");
        link.style.display = 'none';
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        
        // Small delay to ensure the browser registers the custom download attribute name before cleanup
        setTimeout(() => {
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 500);
        }, 0);
    };

    const generateReport = () => {
        setGenerating(true);
        try {
            let dataToExport: any[] = [];
            let fileName = '';

            const filterDate = (itemDateStr: string) => {
                if (!dateFrom && !dateTo) return true;
                const d = new Date(itemDateStr).getTime();
                const dF = dateFrom ? new Date(dateFrom).getTime() : 0;
                const dT = dateTo ? new Date(dateTo).getTime() : Infinity;
                return d >= dF && d <= dT;
            };

            switch (reportType) {
                case 'Sales Report':
                    dataToExport = sales.filter(s => filterDate(s.sale_date)).map(s => ({
                        SaleID: s.id,
                        Date: new Date(s.sale_date).toLocaleDateString(),
                        Customer: s.customer?.full_name || 'General',
                        Vehicle: `${s.car?.make} ${s.car?.model}`,
                        License: s.car?.license_plate || '',
                        FinalPrice: s.final_price,
                        Notes: s.notes
                    }));
                    fileName = `Sales_Report_${new Date().toISOString().split('T')[0]}.csv`;
                    break;
                case 'Inventory Report':
                    dataToExport = inventory.filter(i => filterDate(i.created_at)).map(i => ({
                        StockID: i.id,
                        Make: i.make,
                        Model: i.model,
                        Year: i.year,
                        License: i.license_plate,
                        Status: i.status,
                        PurchasedPrice: i.price
                    }));
                    fileName = `Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`;
                    break;
                case 'Lead Analysis':
                    dataToExport = leads.filter(l => filterDate(l.created_at)).map(l => ({
                        LeadID: l.id,
                        Created: new Date(l.created_at).toLocaleDateString(),
                        Name: l.full_name,
                        Contact: l.phone,
                        Status: l.status,
                        Source: l.source,
                        ExpectedClose: l.expected_close_date || ''
                    }));
                    fileName = `Lead_Analysis_${new Date().toISOString().split('T')[0]}.csv`;
                    break;
                case 'Vehicle Expenses Report':
                    dataToExport = expenses.filter(e => filterDate(e.expense_date)).map(e => ({
                        ExpenseID: e.id,
                        Date: new Date(e.expense_date).toLocaleDateString(),
                        Category: e.category,
                        Amount: e.amount,
                        Vehicle: `${e.car?.make} ${e.car?.model}`,
                        License: e.car?.license_plate,
                        Memo: e.description
                    }));
                    fileName = `Expenses_Report_${new Date().toISOString().split('T')[0]}.csv`;
                    break;
            }

            if (dataToExport.length === 0) {
                alert('No records found for the selected time range.');
                setGenerating(false);
                return;
            }

            const csv = convertToCSV(dataToExport);
            
            // Add to recent UI
            const newReport = {
                name: `${reportType} (${dataToExport.length} records)`,
                type: reportType.split(' ')[0], 
                date: new Date().toLocaleDateString('en-IN'),
                size: `${(csv.length / 1024).toFixed(1)} KB`,
                format: 'CSV',
                content: csv,
                filename: fileName
            };
            setRecentReports(prev => [newReport, ...prev]);
            
            // Trigger download automatically
            downloadCSV(csv, fileName);
            
        } catch (e) {
            console.error('Export failed', e);
            alert('Failed to generate report format.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Data Reports Extractor</h1>
                    <p className="text-slate-500 text-sm">Download aggregated live CSV extracts natively from global CRM contexts.</p>
                </div>
                <div className="flex gap-2">
                    <span className="py-2 px-3 text-[10px] font-bold tracking-wider uppercase text-blue-600 bg-blue-100 rounded-lg shadow-sm">NATIVE EXPORTER</span>
                </div>
            </div>

            {/* Generator */}
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
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Created Start Date (Optional)</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Created End Date (Optional)</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none" />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={generateReport} disabled={generating} className="flex-1 h-10 bg-primary text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-primary-light transition-colors disabled:opacity-50">
                            <span className="material-symbols-outlined text-lg">{generating ? 'sync' : 'description'}</span> {generating ? 'Building...' : 'Extract CSV'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-1 gap-6">
                {/* Recent Reports */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                    <div className="p-5 pb-0 flex items-center justify-between">
                        <h2 className="font-bold text-primary font-display text-lg">My Recent Extracts (This Session)</h2>
                    </div>
                    <table className="w-full mt-3">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                <th className="text-left px-5 py-2.5">Generated Filter Target</th>
                                <th className="text-left px-5 py-2.5">Domain</th>
                                <th className="text-left px-5 py-2.5">Created</th>
                                <th className="text-left px-5 py-2.5">Size</th>
                                <th className="text-left px-5 py-2.5">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentReports.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">Generate a report above to create an exportable file lock.</td></tr>}
                            {recentReports.map((r, i) => (
                                <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg text-green-600">table_chart</span>
                                            <span className="text-sm font-medium text-primary">{r.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3"><span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase bg-slate-100 text-slate-600 block w-max">{r.type}</span></td>
                                    <td className="px-5 py-3 text-sm text-slate-500">{r.date}</td>
                                    <td className="px-5 py-3 text-sm text-slate-500">{r.size}</td>
                                    <td className="px-5 py-3">
                                        <div className="flex gap-1">
                                            <button onClick={() => downloadCSV(r.content, r.filename)} className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg flex items-center transition-colors" title="Download Again">
                                                <span className="material-symbols-outlined text-lg">download</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Reports;
