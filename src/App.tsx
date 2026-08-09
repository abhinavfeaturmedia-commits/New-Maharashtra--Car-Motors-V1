import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { InquiryCartProvider } from './contexts/InquiryCartContext';
import { AdminRoute, UserRoute, ModuleRoute } from './components/ProtectedRoute';
import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';
import Home from './pages/Home';
import Inventory from './pages/Inventory';
import CarDetails from './pages/CarDetails';
import Auth from './pages/Auth';
import UserDashboard from './pages/UserDashboard';
import Contact from './pages/Contact';
import SellCar from './pages/SellCar';
import Insurance from './pages/Insurance';
import EMICalculator from './pages/EMICalculator';
import FAQ from './pages/FAQ';
import CompareModels from './pages/CompareModels';
import BookTestDrive from './pages/BookTestDrive';
import ServiceBooking from './pages/ServiceBooking';
import About from './pages/About';
import NotFound from './pages/NotFound';
import AccessoryCatalog from './pages/AccessoryCatalog';
import SharedCatalog from './pages/SharedCatalog';

// Admin — existing
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLeads from './pages/admin/AdminLeads';
import AdminInventory from './pages/admin/AdminInventory';
import AdminSales from './pages/admin/AdminSales';
import AdminBookings from './pages/admin/AdminBookings';
import InventoryForm from './pages/admin/InventoryForm';
import LeadDetail from './pages/admin/LeadDetail';
import DailyPlanner from './pages/admin/DailyPlanner';
import AdminLogin from './pages/admin/AdminLogin';

// Admin — Analytics
import Analytics from './pages/admin/Analytics';
import Reports from './pages/admin/Reports';
import PerformanceScorecard from './pages/admin/PerformanceScorecard';
import StaffAccountabilityDashboard from './pages/admin/StaffAccountabilityDashboard';

// Admin — CRM
import Customers from './pages/admin/Customers';
import FollowUps from './pages/admin/FollowUps';
import Visits from './pages/admin/Visits';
import LeadSources from './pages/admin/LeadSources';
import ClubMembers from './pages/admin/ClubMembers';

// Admin — Operations
import VehicleInspection from './pages/admin/VehicleInspection';
import PriceHistory from './pages/admin/PriceHistory';
import VehicleExpenses from './pages/admin/VehicleExpenses';
import ShareLogs from './pages/admin/ShareLogs';
import SharedCatalogsAdmin from './pages/admin/SharedCatalogsAdmin';
import ConsignmentTracker from './pages/admin/ConsignmentTracker';

// Admin — Finance
import Accounts from './pages/admin/Accounts';
import Commissions from './pages/admin/Commissions';
import TaxCompliance from './pages/admin/TaxCompliance';
import FinanceServices from './pages/admin/FinanceServices';

// Admin — Schedule
import NotificationsCenter from './pages/admin/NotificationsCenter';
import MessageTemplates from './pages/admin/MessageTemplates';
import CalendarView from './pages/admin/CalendarView';

// Admin — Administration
import UserManagement from './pages/admin/UserManagement';
import AuditLogs from './pages/admin/AuditLogs';
import AdminSettings from './pages/admin/AdminSettings';
// Admin — Partners
import DealerManagement from './pages/admin/DealerManagement';

// Admin — Incentives
import Incentives from './pages/admin/Incentives';
import StaffIncentivesView from './pages/admin/StaffIncentivesView';

// Admin — Attendance
import Attendance from './pages/admin/Attendance';

const App: React.FC = () => {
    return (
        <AuthProvider>
            <InquiryCartProvider>
                <BrowserRouter>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/" element={<PublicLayout />}>
                            <Route index element={<Home />} />
                            <Route path="inventory" element={<Inventory />} />
                            <Route path="accessories" element={<AccessoryCatalog />} />
                            <Route path="shared-catalog/:id" element={<SharedCatalog />} />
                            <Route path="car/:id" element={<CarDetails />} />
                            <Route path="auth" element={<Auth />} />
                            <Route path="dashboard" element={
                                <UserRoute><UserDashboard /></UserRoute>
                            } />
                            <Route path="contact" element={<Contact />} />
                            <Route path="sell" element={<SellCar />} />
                            <Route path="insurance" element={<Insurance />} />
                            <Route path="finance" element={<EMICalculator />} />
                            <Route path="faq" element={<FAQ />} />
                            <Route path="compare" element={<CompareModels />} />
                            <Route path="book-test-drive" element={<BookTestDrive />} />
                            <Route path="services" element={<ServiceBooking />} />
                            <Route path="about" element={<About />} />
                        </Route>

                        {/* Admin Login — standalone, no sidebar */}
                        <Route path="/admin/login" element={<AdminLogin />} />

                        {/* Admin Routes — protected with AdminRoute + layout */}
                        <Route path="/admin" element={
                            <AdminRoute><AdminLayout /></AdminRoute>
                        }>
                            {/* Main */}
                            <Route index element={<AdminDashboard />} />
                            <Route path="inventory" element={<ModuleRoute module="inventory"><AdminInventory /></ModuleRoute>} />
                            <Route path="inventory/new" element={<ModuleRoute module="inventory"><InventoryForm /></ModuleRoute>} />
                            <Route path="inventory/:id/edit" element={<ModuleRoute module="inventory"><InventoryForm /></ModuleRoute>} />
                            <Route path="leads" element={<ModuleRoute module="leads"><AdminLeads /></ModuleRoute>} />
                            <Route path="leads/:id" element={<ModuleRoute module="leads"><LeadDetail /></ModuleRoute>} />
                            <Route path="sales" element={<ModuleRoute module="sales"><AdminSales /></ModuleRoute>} />
                            <Route path="bookings" element={<ModuleRoute module="bookings"><AdminBookings /></ModuleRoute>} />
                            <Route path="planner" element={<ModuleRoute module="bookings"><DailyPlanner /></ModuleRoute>} />

                            {/* Analytics */}
                            <Route path="analytics" element={<ModuleRoute module="analytics"><Analytics /></ModuleRoute>} />
                            <Route path="reports" element={<ModuleRoute module="analytics"><Reports /></ModuleRoute>} />
                            <Route path="performance" element={<ModuleRoute module="analytics"><PerformanceScorecard /></ModuleRoute>} />
                            <Route path="accountability" element={<ModuleRoute module="analytics"><StaffAccountabilityDashboard /></ModuleRoute>} />

                            {/* CRM */}
                            <Route path="customers" element={<ModuleRoute module="crm"><Customers /></ModuleRoute>} />
                            <Route path="follow-ups" element={<ModuleRoute module="crm"><FollowUps /></ModuleRoute>} />
                            <Route path="visits" element={<ModuleRoute module="crm"><Visits /></ModuleRoute>} />
                            <Route path="lead-sources" element={<ModuleRoute module="crm"><LeadSources /></ModuleRoute>} />
                            <Route path="club-members" element={<ModuleRoute module="crm"><ClubMembers /></ModuleRoute>} />

                            {/* Operations */}
                            <Route path="inspections" element={<ModuleRoute module="operations"><VehicleInspection /></ModuleRoute>} />
                            <Route path="price-history" element={<ModuleRoute module="operations"><PriceHistory /></ModuleRoute>} />
                            <Route path="expenses" element={<ModuleRoute module="operations"><VehicleExpenses /></ModuleRoute>} />
                            <Route path="share-logs" element={<ModuleRoute module="operations"><ShareLogs /></ModuleRoute>} />
                            <Route path="shared-catalogs" element={<ModuleRoute module="operations"><SharedCatalogsAdmin /></ModuleRoute>} />
                            <Route path="consignments" element={<ModuleRoute module="inventory"><ConsignmentTracker /></ModuleRoute>} />

                            {/* Finance */}
                            <Route path="accounts" element={<ModuleRoute module="finance"><Accounts /></ModuleRoute>} />
                            <Route path="commissions" element={<ModuleRoute module="finance"><Commissions /></ModuleRoute>} />
                            <Route path="tax" element={<ModuleRoute module="finance"><TaxCompliance /></ModuleRoute>} />
                            <Route path="finance-services" element={<ModuleRoute module="finance"><FinanceServices /></ModuleRoute>} />

                            {/* Schedule */}
                            <Route path="calendar" element={<ModuleRoute module="schedule"><CalendarView /></ModuleRoute>} />
                            <Route path="notifications" element={<ModuleRoute module="schedule"><NotificationsCenter /></ModuleRoute>} />
                            <Route path="templates" element={<ModuleRoute module="schedule"><MessageTemplates /></ModuleRoute>} />

                            {/* Partners */}
                            <Route path="dealers" element={<ModuleRoute module="dealers"><DealerManagement /></ModuleRoute>} />

                            {/* Admin */}
                            <Route path="users" element={<ModuleRoute module="users"><UserManagement /></ModuleRoute>} />
                            <Route path="audit-logs" element={<ModuleRoute module="audit_logs"><AuditLogs /></ModuleRoute>} />

                            <Route path="settings" element={<ModuleRoute module="settings"><AdminSettings /></ModuleRoute>} />

                            {/* Incentives */}
                            <Route path="incentives" element={<ModuleRoute module="incentives"><Incentives /></ModuleRoute>} />
                            <Route path="my-incentives" element={<ModuleRoute module="incentives"><StaffIncentivesView /></ModuleRoute>} />

                            {/* Attendance */}
                            <Route path="attendance" element={<ModuleRoute module="attendance"><Attendance /></ModuleRoute>} />
                        </Route>

                        {/* Fallcard Fallback Route */}
                        <Route element={<PublicLayout />}>
                            <Route path="*" element={<NotFound />} />
                        </Route>
                    </Routes>
                </BrowserRouter>
            </InquiryCartProvider>
        </AuthProvider>
    );
};

export default App;
