import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── 10 Comprehensive Report Types ───────────────────────────────────────────
const REPORT_TYPES = [
    'Sales Report',
    'Inventory Report',
    'Lead Analysis',
    'Customer CRM Report',
    'Bookings & Test Drives',
    'Park & Sell Listings',
    'Vehicle Expenses Report',
    'Commission Report',
    'Financial Transactions',
    'Tax Compliance & GST',
] as const;

type ReportType = typeof REPORT_TYPES[number];

const Reports = () => {
    const {
        sales, inventory, leads, customers, bookings, expenses,
        manualTransactions, taxFilings, reportHistory, refreshData
    } = useData();
    const { user, profile } = useAuth();

    const [reportType, setReportType] = useState<ReportType>('Sales Report');
    const [dateFrom, setDateFrom]     = useState('');
    const [dateTo, setDateTo]         = useState('');
    const [generating, setGenerating] = useState(false);
    const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // ─── Preset Date Handler ──────────────────────────────────────────────────
    const applyPreset = (preset: 'today' | 'this_month' | 'last_30' | 'this_year' | 'all') => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        if (preset === 'today') {
            setDateFrom(todayStr);
            setDateTo(todayStr);
        } else if (preset === 'this_month') {
            const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            setDateFrom(firstOfMonth);
            setDateTo(todayStr);
        } else if (preset === 'last_30') {
            const past30 = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];
            setDateFrom(past30);
            setDateTo(todayStr);
        } else if (preset === 'this_year') {
            const Jan1 = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
            setDateFrom(Jan1);
            setDateTo(todayStr);
        } else if (preset === 'all') {
            setDateFrom('');
            setDateTo('');
        }
    };

    // ─── CSV Export Helpers ───────────────────────────────────────────────────
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

    // ─── Date Boundary Filter (Fixes 00:00 vs 23:59 boundary) ─────────
    const filterDate = (dateStr: string | null | undefined) => {
        if (!dateFrom && !dateTo) return true;
        if (!dateStr) return false;

        const d = new Date(dateStr).getTime();
        if (isNaN(d)) return false;

        const dF = dateFrom ? new Date(`${dateFrom}T00:00:00.000`).getTime() : 0;
        const dT = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Infinity;

        return d >= dF && d <= dT;
    };

    // ─── Generate & Persist Report ────────────────────────────────────────────
    const generateReport = async (overrideType?: ReportType, overrideFrom?: string, overrideTo?: string) => {
        const targetType = overrideType || reportType;
        const targetFrom = overrideFrom !== undefined ? overrideFrom : dateFrom;
        const targetTo   = overrideTo   !== undefined ? overrideTo   : dateTo;

        setGenerating(true);
        try {
            let dataToExport: any[] = [];
            let fileName = '';

            const localFilterDate = (dateStr: string | null | undefined) => {
                if (!targetFrom && !targetTo) return true;
                if (!dateStr) return false;
                const d = new Date(dateStr).getTime();
                if (isNaN(d)) return false;
                const dF = targetFrom ? new Date(`${targetFrom}T00:00:00.000`).getTime() : 0;
                const dT = targetTo ? new Date(`${targetTo}T23:59:59.999`).getTime() : Infinity;
                return d >= dF && d <= dT;
            };

            const today = new Date().toISOString().split('T')[0];

            switch (targetType) {
                case 'Sales Report':
                    dataToExport = sales.filter(s => localFilterDate(s.sale_date)).map(s => ({
                        SaleID:       s.id,
                        Date:         s.sale_date ? new Date(s.sale_date).toLocaleDateString('en-IN') : '',
                        Customer:     s.customer?.full_name || s.customer_name || 'General Customer',
                        Phone:        s.customer?.phone || s.customer_phone || '',
                        Vehicle:      s.car ? `${s.car.year || ''} ${s.car.make || ''} ${s.car.model || ''}`.trim() : 'Vehicle',
                        LicensePlate: s.car?.license_plate || s.car?.registration_no || '',
                        SaleType:     s.sale_type || 'purchased',
                        SalePrice:    s.sale_price ?? s.final_price ?? 0,
                        CostSnapshot: s.purchase_cost_snapshot || 0,
                        Profit:       s.profit || 0,
                        ConsignmentFee: s.consignment_fee_collected || 0,
                        PaymentStatus: s.payment_status || 'paid',
                        Notes:        s.notes || '',
                    }));
                    fileName = `Sales_Report_${today}.csv`;
                    break;

                case 'Inventory Report':
                    dataToExport = inventory.filter(i => localFilterDate(i.created_at)).map(i => ({
                        StockID:      i.id,
                        Make:         i.make,
                        Model:        i.model,
                        Variant:      i.variant || '',
                        Year:         i.year,
                        LicensePlate: i.license_plate || i.registration_no || '',
                        Color:        i.color || '',
                        FuelType:     i.fuel_type || '',
                        Transmission: i.transmission || '',
                        Mileage:      i.mileage || 0,
                        Status:       i.status,
                        Source:       i.source || 'purchased',
                        ListPrice:    i.price,
                        PurchaseCost: i.purchase_cost || '',
                        DealerCost:   i.dealer_asking_price || '',
                        MarginOrCommission: i.our_margin || i.dealer_commission || '',
                        AgreedPrice:  i.consignment_agreed_price || '',
                    }));
                    fileName = `Inventory_Report_${today}.csv`;
                    break;

                case 'Lead Analysis':
                    dataToExport = leads.filter((l: any) => localFilterDate(l.created_at)).map((l: any) => ({
                        LeadID:        l.id,
                        Created:       l.created_at ? new Date(l.created_at).toLocaleDateString('en-IN') : '',
                        Name:          l.full_name || l.name || '',
                        Phone:         l.phone || '',
                        Email:         l.email || '',
                        LeadType:      l.lead_type || l.type || 'general',
                        Status:        l.status || 'new',
                        LeadQuality:   l.lead_quality || '',
                        Budget:        l.budget || '',
                        Source:        l.source || 'Website Direct',
                        AssignedTo:    l.assigned_profile?.full_name || 'Unassigned',
                        City:          l.city || '',
                    }));
                    fileName = `Lead_Analysis_${today}.csv`;
                    break;

                case 'Customer CRM Report':
                    dataToExport = customers.filter((c: any) => localFilterDate(c.created_at)).map((c: any) => ({
                        CustomerID:     c.id,
                        Name:           c.full_name || c.name || '',
                        Phone:          c.phone,
                        Email:          c.email || '',
                        City:           c.city || '',
                        Address:        c.address || '',
                        TotalPurchases: c.total_purchases || 0,
                        JoinedDate:     c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '',
                    }));
                    fileName = `Customer_CRM_Report_${today}.csv`;
                    break;

                case 'Bookings & Test Drives':
                    dataToExport = bookings.filter((b: any) => localFilterDate(b.booking_date || b.created_at)).map((b: any) => ({
                        BookingID:   b.id,
                        Date:        b.booking_date ? new Date(b.booking_date).toLocaleDateString('en-IN') : '',
                        Time:        b.preferred_time || b.booking_time || '',
                        BookingType: b.booking_type || 'test_drive',
                        Customer:    b.lead?.full_name || b.customer_name || 'Walk-in',
                        Phone:       b.lead?.phone || b.customer_phone || '',
                        Vehicle:     b.car ? `${b.car.year || ''} ${b.car.make || ''} ${b.car.model || ''}`.trim() : 'N/A',
                        Status:      b.status || 'pending',
                        Notes:       b.notes || '',
                    }));
                    fileName = `Bookings_Report_${today}.csv`;
                    break;

                case 'Park & Sell Listings':
                    dataToExport = inventory.filter((i: any) => i.source === 'consignment' && localFilterDate(i.created_at)).map((i: any) => ({
                        ParkAndSellID: i.id,
                        Make:          i.make,
                        Model:         i.model,
                        Year:          i.year,
                        OwnerName:     i.consignment_owner_name || '',
                        OwnerPhone:    i.consignment_owner_phone || '',
                        AgreedPrice:   i.consignment_agreed_price || 0,
                        FeeType:       i.consignment_fee_type || 'percentage',
                        FeeValue:      i.consignment_fee_value || 0,
                        Status:        i.status,
                        EndDate:       i.consignment_end_date ? new Date(i.consignment_end_date).toLocaleDateString('en-IN') : '',
                    }));
                    fileName = `Park_and_Sell_Listings_${today}.csv`;
                    break;

                case 'Vehicle Expenses Report':
                    dataToExport = expenses.filter((e: any) => localFilterDate(e.expense_date || e.created_at)).map((e: any) => ({
                        ExpenseID: e.id,
                        Date:      new Date(e.expense_date || e.created_at).toLocaleDateString('en-IN'),
                        Category:  e.category,
                        Amount:    e.amount,
                        Vehicle:   e.car ? `${e.car.year || ''} ${e.car.make || ''} ${e.car.model || ''}`.trim() : 'General',
                        License:   e.car?.license_plate || e.car?.registration_no || '',
                        Memo:      e.description || '',
                    }));
                    fileName = `Vehicle_Expenses_Report_${today}.csv`;
                    break;

                case 'Commission Report':
                    dataToExport = sales.filter(s => localFilterDate(s.sale_date)).map(s => {
                        const salePrice = Number(s.sale_price ?? s.final_price ?? 0);
                        const netProfit = Number(s.profit || 0);
                        return {
                            SaleID:             s.id,
                            Date:               s.sale_date ? new Date(s.sale_date).toLocaleDateString('en-IN') : '',
                            Vehicle:            s.car ? `${s.car.year || ''} ${s.car.make || ''} ${s.car.model || ''}`.trim() : 'Car',
                            SaleType:           s.sale_type || 'purchased',
                            SalePrice:          salePrice,
                            BaseCost:           Number(s.purchase_cost_snapshot || 0),
                            DealershipEarnings: netProfit,
                            StaffIncentive:     Math.round(netProfit * 0.05),
                            SoldBy:             s.sold_by || 'Admin',
                            Notes:              s.notes || '',
                        };
                    });
                    fileName = `Commission_Report_${today}.csv`;
                    break;

                case 'Financial Transactions':
                    dataToExport = manualTransactions.filter((t: any) => localFilterDate(t.transaction_date || t.created_at)).map((t: any) => ({
                        TxID:        t.id,
                        Date:        t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('en-IN') : '',
                        Type:        t.type,
                        Category:    t.category,
                        Amount:      t.amount,
                        Status:      t.status || 'Completed',
                        PaymentMode: t.payment_mode || 'Cash',
                        Notes:       t.notes || '',
                    }));
                    fileName = `Financial_Transactions_${today}.csv`;
                    break;

                case 'Tax Compliance & GST':
                    dataToExport = taxFilings.filter((tf: any) => localFilterDate(tf.created_at)).map((tf: any) => ({
                        FilingID:       tf.id,
                        MonthKey:       tf.month_key || '',
                        GstCollected:   tf.gst_collected || 0,
                        InputTaxCredit: tf.input_tax_credit || 0,
                        NetLiability:   tf.net_liability || 0,
                        Status:         tf.status || 'pending',
                        FiledDate:      tf.filed_date ? new Date(tf.filed_date).toLocaleDateString('en-IN') : '',
                    }));
                    fileName = `Tax_GST_Report_${today}.csv`;
                    break;
            }

            if (dataToExport.length === 0) {
                showToast(`No records found for "${targetType}" in the selected date range.`, 'error');
                return;
            }

            const csv = convertToCSV(dataToExport);
            const sizeKb = parseFloat((csv.length / 1024).toFixed(2));

            // Persist to Supabase report_history
            await supabase.from('report_history').insert({
                report_type:       targetType,
                filters_json:      { dateFrom: targetFrom || null, dateTo: targetTo || null, reportType: targetType },
                row_count:         dataToExport.length,
                file_name:         fileName,
                file_size_kb:      sizeKb,
                generated_by:      user?.id ?? null,
                generated_by_name: (profile as any)?.full_name ?? user?.email ?? 'Admin',
            });

            refreshData(); // update reportHistory in context
            downloadCSV(csv, fileName);
            showToast(`Exported ${dataToExport.length} rows to ${fileName} ✓`);

        } catch (err: any) {
            console.error('Export failed', err);
            showToast('Failed to generate report: ' + (err.message || 'Unknown error'), 'error');
        } finally {
            setGenerating(false);
        }
    };

    // ─── Direct Re-Export & Filter Restoration ───────────────────────────────
    const handleRedownload = async (r: any) => {
        const storedType = r.report_type as ReportType;
        const storedFrom = r.filters_json?.dateFrom || '';
        const storedTo   = r.filters_json?.dateTo || '';

        setReportType(storedType);
        setDateFrom(storedFrom);
        setDateTo(storedTo);

        await generateReport(storedType, storedFrom, storedTo);
    };

    // ─── Delete Report History Log ───────────────────────────────────────────
    const handleDeleteHistory = async (id: string, fileName: string) => {
        if (!window.confirm(`Remove history record for "${fileName}"?`)) return;
        try {
            const { error } = await supabase.from('report_history').delete().eq('id', id);
            if (error) throw error;
            showToast(`History record removed ✓`);
            refreshData();
        } catch (err: any) {
            showToast(err.message || 'Failed to delete history log', 'error');
        }
    };

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <div className="space-y-6">
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg font-medium text-sm flex items-center gap-2 ${
                    toast.type === 'success' ? 'bg-emerald-800 text-emerald-100 border border-emerald-700' : 'bg-red-800 text-red-100 border border-red-700'
                }`}>
                    <span className="material-symbols-outlined text-lg">
                        {toast.type === 'success' ? 'check_circle' : 'error'}
                    </span>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Data Reports Extractor</h1>
                    <p className="text-slate-500 text-sm">Download aggregated CSV extracts — persistent export history across sessions.</p>
                </div>
                <span className="py-1.5 px-3 text-[10px] font-bold tracking-wider uppercase text-blue-600 bg-blue-100 rounded-lg shadow-sm w-fit">
                    NATIVE EXPORTER • 10 ENTITIES
                </span>
            </div>

            {/* Live Data Summary Linkage Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                    { label: 'Sales Records',     count: sales.length,       icon: 'sell',             to: '/admin/sales',       color: 'bg-blue-50 text-blue-700 border-blue-100' },
                    { label: 'Inventory Stock',  count: inventory.length,   icon: 'inventory_2',      to: '/admin/inventory',   color: 'bg-amber-50 text-amber-700 border-amber-100' },
                    { label: 'CRM Leads',         count: leads.length,       icon: 'contact_mail',     to: '/admin/leads',       color: 'bg-purple-50 text-purple-700 border-purple-100' },
                    { label: 'Customer Base',     count: customers.length,   icon: 'people',           to: '/admin/customers',   color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                    { label: 'Expenses Logged',   count: expenses.length,    icon: 'account_balance',  to: '/admin/accounts',    color: 'bg-rose-50 text-rose-700 border-rose-100' },
                ].map(c => (
                    <Link key={c.label} to={c.to} className={`rounded-xl border p-3 flex flex-col justify-between hover:shadow-sm transition-shadow ${c.color}`}>
                        <div className="flex items-center justify-between">
                            <span className="material-symbols-outlined text-base">{c.icon}</span>
                            <span className="text-xs font-black">{c.count}</span>
                        </div>
                        <p className="text-[11px] font-bold mt-2 truncate">{c.label}</p>
                    </Link>
                ))}
            </div>

            {/* Generator Panel */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[var(--shadow-card)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="font-bold text-primary font-display text-lg">Export Production Data</h2>

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Presets:</span>
                        {[
                            { label: 'Today', key: 'today' },
                            { label: 'This Month', key: 'this_month' },
                            { label: 'Last 30 Days', key: 'last_30' },
                            { label: 'This Year', key: 'this_year' },
                            { label: 'All Time', key: 'all' },
                        ].map(p => (
                            <button
                                key={p.key}
                                onClick={() => applyPreset(p.key as any)}
                                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-primary hover:text-white transition-colors"
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end pt-1">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Report Entity</label>
                        <select
                            value={reportType}
                            onChange={e => setReportType(e.target.value as ReportType)}
                            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary font-medium outline-none cursor-pointer hover:border-slate-300 transition-colors"
                        >
                            {REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Start Date (Optional)</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:border-primary transition-colors"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">End Date (Optional)</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-primary outline-none focus:border-primary transition-colors"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => generateReport()}
                            disabled={generating}
                            className="flex-1 h-10 bg-primary text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-md shadow-primary/20 cursor-pointer"
                        >
                            <span className={`material-symbols-outlined text-lg ${generating ? 'animate-spin' : ''}`}>
                                {generating ? 'sync' : 'download'}
                            </span>
                            {generating ? 'Exporting...' : 'Extract CSV'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Persisted Report History */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] overflow-hidden">
                <div className="p-5 pb-3 flex items-center justify-between border-b border-slate-50">
                    <div>
                        <h2 className="font-bold text-primary font-display text-lg">Report History</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Persisted to Supabase — accessible across all devices & sessions</p>
                    </div>
                    {reportHistory.length > 0 && (
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                            {reportHistory.length} reports logged
                        </span>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                <th className="text-left px-5 py-2.5">Report Entity</th>
                                <th className="text-left px-5 py-2.5">Records</th>
                                <th className="text-left px-5 py-2.5">Generated By</th>
                                <th className="text-left px-5 py-2.5">Generated At</th>
                                <th className="text-left px-5 py-2.5">Size</th>
                                <th className="text-left px-5 py-2.5">Filters</th>
                                <th className="text-right px-5 py-2.5">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportHistory.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-10 text-center">
                                        <span className="material-symbols-outlined text-4xl text-slate-200 block mb-3">analytics</span>
                                        <p className="text-slate-400 font-medium">No reports generated yet.</p>
                                        <p className="text-slate-300 text-sm mt-1">Reports you generate will be logged here automatically.</p>
                                    </td>
                                </tr>
                            )}
                            {reportHistory.map((r: any) => (
                                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <span className="material-symbols-outlined text-lg text-emerald-600">table_chart</span>
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
                                    <td className="px-5 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handleRedownload(r)}
                                                className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                                                title="Re-export CSV with stored filters"
                                            >
                                                <span className="material-symbols-outlined text-base">download</span>
                                                Export
                                            </button>
                                            <button
                                                onClick={() => handleDeleteHistory(r.id, r.file_name)}
                                                className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                                                title="Delete history log"
                                            >
                                                <span className="material-symbols-outlined text-base">delete</span>
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

