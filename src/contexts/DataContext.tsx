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
    
    // New V2 Modules
    const [tasks, setTasks] = useState<any[]>([]);
    const [followUps, setFollowUps] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [inspections, setInspections] = useState<any[]>([]);
    const [visits, setVisits] = useState<any[]>([]);
    const [clubMembers, setClubMembers] = useState<any[]>([]);
    const [clubTransactions, setClubTransactions] = useState<any[]>([]);
    const [financeServices, setFinanceServices] = useState<any[]>([]);
    const [settings, setSettings] = useState<Record<string, any>>({});
    
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
                { data: financeServicesData }
            ] = await Promise.all([
                safeFetchAll(() => supabase.from('leads').select('*').order('created_at', { ascending: false })),
                safeFetchAll(() => supabase.from('customers').select('*').order('created_at', { ascending: false })),
                safeFetchAll(() => supabase.from('inventory').select('*').order('created_at', { ascending: false })),
                safeFetchAll(() => supabase.from('sales').select('*, customer:customers(*), car:inventory(*)').order('sale_date', { ascending: false })),
                safeFetchAll(() => supabase.from('bookings').select('*, lead:leads(*), car:inventory(*)').order('booking_date', { ascending: false })),
                safeFetchAll(() => supabase.from('lead_activities').select('*').order('created_at', { ascending: false })),
                
                // Keep these failsafe in case the user hasn't run the migration yet, it won't crash the app globally
                safeFetchAll(() => supabase.from('tasks').select('*, lead:leads(*)').order('due_date', { ascending: true })),
                safeFetchAll(() => supabase.from('follow_ups').select('*, lead:leads(*)').order('next_followup_date', { ascending: true })),
                safeFetchAll(() => supabase.from('vehicle_expenses').select('*, car:inventory(*)').order('expense_date', { ascending: false })),
                safeFetchAll(() => supabase.from('inspections').select('*, car:inventory(*)').order('inspection_date', { ascending: false })),
                safeFetchAll(() => supabase.from('visits').select('*, staff:profiles!staff_id(full_name), lead:leads(*), customer:customers(*)').order('created_at', { ascending: false })),
                safeFetchAll(() => supabase.from('dealership_settings').select('*')),
                safeFetchAll(() => supabase.from('club_members').select('*, customer:customers(*)').order('created_at', { ascending: false })),
                safeFetchAll(() => supabase.from('club_service_exchanges').select('*, added_by_profile:profiles!added_by(full_name)').order('transaction_date', { ascending: false })),
                safeFetchAll(() => supabase.from('finance_services').select('*, customer:customers(*), car:inventory(*)').order('created_at', { ascending: false }))
            ]);

            setLeads(leadsData || []);
            setCustomers(customersData || []);
            setInventory(inventoryData || []);
            setSales(salesData || []);
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
    }, []);

    return (
        <DataContext.Provider value={{ leads, customers, inventory, sales, bookings, activities, tasks, followUps, expenses, inspections, visits, clubMembers, clubTransactions, financeServices, settings, loading, refreshData }}>
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
