import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface DataContextType {
    leads: any[];
    customers: any[];
    inventory: any[];
    sales: any[];
    bookings: any[];
    activities: any[];
    tasks: any[];
    followUps: any[];
    expenses: any[];
    inspections: any[];
    visits: any[];
    clubMembers: any[];
    clubTransactions: any[];
    financeServices: any[];
    settings: Record<string, any>;
    // New full-sync data arrays
    manualTransactions: any[];
    taxFilings: any[];
    reportHistory: any[];
    messageTemplates: any[];
    alertConfigs: any[];
    loading: boolean;
    refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [leads, setLeads] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [sales, setSales] = useState<any[]>([]);
    const [bookings, setBookings] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    
    // V2 Modules
    const [tasks, setTasks] = useState<any[]>([]);
    const [followUps, setFollowUps] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [inspections, setInspections] = useState<any[]>([]);
    const [visits, setVisits] = useState<any[]>([]);
    const [clubMembers, setClubMembers] = useState<any[]>([]);
    const [clubTransactions, setClubTransactions] = useState<any[]>([]);
    const [financeServices, setFinanceServices] = useState<any[]>([]);
    const [settings, setSettings] = useState<Record<string, any>>({});

    // V3 — Full Admin Panel Sync
    const [manualTransactions, setManualTransactions] = useState<any[]>([]);
    const [taxFilings, setTaxFilings] = useState<any[]>([]);
    const [reportHistory, setReportHistory] = useState<any[]>([]);
    const [messageTemplates, setMessageTemplates] = useState<any[]>([]);
    const [alertConfigs, setAlertConfigs] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(true);

    const refreshData = async () => {
        setLoading(true);
        try {
            const safeFetchAll = async (queryFn: () => any) => {
                try {
                    let allData: any[] = [];
                    let from = 0;
                    const batchSize = 1000;
                    let hasMore = true;
                    
                    while (hasMore) {
                        const { data, error } = await queryFn().range(from, from + batchSize - 1);
                        if (error) throw error;
                        if (data && data.length > 0) {
                            allData = [...allData, ...data];
                            from += batchSize;
                            if (data.length < batchSize) {
                                hasMore = false;
                            }
                        } else {
                            hasMore = false;
                        }
                    }
                    return { data: allData };
                } catch (error) {
                    console.error("Error in safeFetchAll:", error);
                    return { data: [] };
                }
            };

            const [
                { data: leadsData },
                { data: customersData },
                { data: inventoryData },
                { data: salesData },
                { data: bookingsData },
                { data: activitiesData },
                { data: tasksData },
                { data: followUpsData },
                { data: expensesData },
                { data: inspectionsData },
                { data: visitsData },
                { data: settingsData },
                { data: clubMembersData },
                { data: clubTransactionsData },
                { data: financeServicesData },
                // V3 Full-Sync
                { data: manualTxData },
                { data: taxFilingsData },
                { data: reportHistData },
                { data: msgTemplatesData },
                { data: alertConfigsData },
            ] = await Promise.all([
                safeFetchAll(() => supabase.from('leads').select('*, assigned_profile:profiles!leads_assigned_to_fkey(full_name, avatar_url)').order('created_at', { ascending: false })),
                safeFetchAll(() => supabase.from('customers').select('*').order('created_at', { ascending: false })),
                safeFetchAll(() => supabase.from('inventory').select('*').order('created_at', { ascending: false })),
                safeFetchAll(() => supabase.from('sales').select('*, customer:customer_id(id,full_name,phone,email), car:inventory_id(id,make,model,year,registration_no,license_plate)').order('sale_date', { ascending: false })),
                safeFetchAll(() => supabase.from('bookings').select('*, lead:leads(id,full_name,phone), car:inventory(id,make,model,year)').order('booking_date', { ascending: false })),
                // lead_activities — join profiles on created_by
                safeFetchAll(() => supabase.from('lead_activities').select('*, creator:profiles!created_by(full_name, avatar_url)').order('created_at', { ascending: false })),
                // Tasks with lead + assignee join
                safeFetchAll(() => supabase.from('tasks').select('*, lead:leads(id,full_name,phone), assignee:profiles!assigned_to(full_name)').order('due_date', { ascending: true })),
                safeFetchAll(() => supabase.from('follow_ups').select('*, lead:leads(id,full_name,phone)').order('created_at', { ascending: false })),
                safeFetchAll(() => supabase.from('vehicle_expenses').select('*, car:inventory(id,make,model,year,registration_no)').order('expense_date', { ascending: false })),
                safeFetchAll(() => supabase.from('inspections').select('*, car:inventory(id,make,model,year,registration_no)').order('inspection_date', { ascending: false })),
                safeFetchAll(() => supabase.from('visits').select('*, staff:profiles!staff_id(full_name,avatar_url), lead:leads(id,full_name,phone), customer:customers(id,full_name,phone)').order('created_at', { ascending: false })),
                safeFetchAll(() => supabase.from('dealership_settings').select('*')),
                safeFetchAll(() => supabase.from('club_members').select('*, customer:customers(id,full_name,phone)').order('created_at', { ascending: false })),
                safeFetchAll(() => supabase.from('club_service_exchanges').select('*, added_by_profile:profiles!added_by(full_name)').order('transaction_date', { ascending: false })),
                safeFetchAll(() => supabase.from('finance_services').select('*, customer:customers(id,full_name,phone), car:inventory(id,make,model,year)').order('created_at', { ascending: false })),
                // V3 Full-Sync fetches
                safeFetchAll(() => supabase.from('manual_transactions').select('*').order('transaction_date', { ascending: false })),
                safeFetchAll(() => supabase.from('tax_filings').select('*').order('month_key', { ascending: false })),
                safeFetchAll(() => supabase.from('report_history').select('*').order('created_at', { ascending: false })),
                safeFetchAll(() => supabase.from('message_templates').select('*').order('created_at', { ascending: false })),
                safeFetchAll(() => supabase.from('customer_alert_configs').select('*')),
            ]);

            setLeads(leadsData || []);
            setCustomers(customersData || []);
            setInventory(inventoryData || []);
            
            // Normalize sales data with fallback mapping
            let rawSales = salesData || [];
            if (rawSales.length === 0) {
                try {
                    const { data: fallbackSales } = await supabase.from('sales').select('*');
                    if (fallbackSales && fallbackSales.length > 0) {
                        rawSales = fallbackSales;
                    }
                } catch (err) {
                    console.error("Fallback sales fetch error:", err);
                }
            }

            const inventoryMap = new Map((inventoryData || []).map((i: any) => [i.id, i]));
            const customerMap = new Map((customersData || []).map((c: any) => [c.id, c]));

            const normalizedSales = rawSales.map((s: any) => {
                const carObj = s.car || s.inventory || inventoryMap.get(s.inventory_id || s.car_id) || null;
                const custObj = s.customer || customerMap.get(s.customer_id) || (s.customer_name ? { full_name: s.customer_name, phone: s.customer_phone, email: s.customer_email } : null);
                return {
                    ...s,
                    car: carObj,
                    customer: custObj,
                };
            });

            setSales(normalizedSales);
            setBookings(bookingsData || []);
            setActivities(activitiesData || []);
            
            setTasks(tasksData || []);
            setFollowUps(followUpsData || []);
            setExpenses(expensesData || []);
            setInspections(inspectionsData || []);
            setVisits(visitsData || []);
            setClubMembers(clubMembersData || []);
            setClubTransactions(clubTransactionsData || []);
            setFinanceServices(financeServicesData || []);

            // V3 Full-Sync states
            setManualTransactions(manualTxData || []);
            setTaxFilings(taxFilingsData || []);
            setReportHistory(reportHistData || []);
            setMessageTemplates(msgTemplatesData || []);
            setAlertConfigs(alertConfigsData || []);
            
            // Format settings from array of K/V to standard object
            // Supports both column naming conventions (setting_key/setting_value from v2, key/value from v1)
            if (settingsData && settingsData.length > 0) {
                const map: Record<string, any> = {};
                settingsData.forEach((s: any) => {
                    const k = s.setting_key ?? s.key;
                    const v = s.setting_value ?? s.value;
                    if (k !== undefined) map[k] = v;
                });
                setSettings(map);
            }
            
        } catch (error) {
            console.error("Error fetching global data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();

        // Subscribe to real-time updates for ALL admin panel tables
        const tables = [
            'leads', 'sales', 'bookings', 'customers', 'inventory',
            'tasks', 'follow_ups', 'vehicle_expenses', 'inspections',
            'visits', 'dealership_settings', 'club_members', 'club_service_exchanges',
            'finance_services',
            // V3 full-sync tables
            'manual_transactions', 'tax_filings', 'report_history',
            'message_templates', 'customer_alert_configs',
        ];

        let channel = supabase.channel('realtime:global_updates_v3');
        tables.forEach(table => {
            channel = channel.on(
                'postgres_changes',
                { event: '*', schema: 'public', table },
                () => { refreshData(); }
            );
        });
        channel.subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <DataContext.Provider value={{
            leads, customers, inventory, sales, bookings, activities,
            tasks, followUps, expenses, inspections, visits,
            clubMembers, clubTransactions, financeServices, settings,
            // V3 full-sync
            manualTransactions, taxFilings, reportHistory, messageTemplates, alertConfigs,
            loading, refreshData,
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
