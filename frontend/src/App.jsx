import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import {Skeleton} from './components/ui/Primitives';

// Admin Pages
const AdminLogin = lazy(() => import('./pages/admin/Login'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const EmployeeList = lazy(() => import('./pages/admin/EmployeeList'));
const AddEmployee = lazy(() => import('./pages/admin/AddEmployee'));
const EditEmployee = lazy(() => import('./pages/admin/EditEmployee'));
const EmployeeDetails = lazy(() => import('./pages/admin/EmployeeDetails'));
const Customers = lazy(() => import('./pages/admin/Customers'));
const CustomerPortfolio = lazy(() => import('./pages/admin/CustomerPortfolio'));
const AdminCustomerDetails = lazy(() => import('./pages/admin/CustomerDetails'));
const AdminLoans = lazy(() => import('./pages/admin/Loans'));
const AdminLoanDetails = lazy(() => import('./pages/admin/LoanDetails'));
const NotificationHistory = lazy(() => import('./pages/shared/NotificationHistory'));
const MissedPayments = lazy(() => import('./pages/admin/MissedPayments'));
const AdminAddCustomer = lazy(() => import('./pages/admin/AddCustomer'));
const CustomerLeads = lazy(() => import('./pages/admin/CustomerLeads'));
import AdminLayout from './layouts/AdminLayout';

// Employee Pages
const EmployeeLogin = lazy(() => import('./pages/employee/Login'));
const PasswordRecovery = lazy(() => import('./pages/employee/PasswordRecovery'));
const EmployeeCustomerList = lazy(() => import('./pages/employee/CustomerList'));
const AddCustomer = lazy(() => import('./pages/employee/AddCustomer'));
const EditCustomer = lazy(() => import('./pages/employee/EditCustomer'));
const EmployeeCustomerDetails = lazy(() => import('./pages/employee/CustomerDetails'));
const EmployeeDashboard = lazy(() => import('./pages/employee/Dashboard'));
const AddLoan = lazy(() => import('./pages/employee/AddLoan'));
const EmployeeLoanDetails = lazy(() => import('./pages/employee/LoanDetails'));
const EmployeeLoans = lazy(() => import('./pages/employee/Loans'));
const TodayCollections = lazy(() => import('./pages/employee/TodayCollections'));
const Receipt = lazy(() => import('./pages/employee/Receipt'));
import EmployeeLayout from './layouts/EmployeeLayout';
const CustomerKyc = lazy(() => import('./pages/shared/CustomerKyc'));
const KycList = lazy(() => import('./pages/employee/KycList'));
const DailySettlement = lazy(() => import('./pages/shared/DailySettlement'));
const SettingsPage = lazy(() => import('./pages/shared/Settings'));

const CustomerRiskDirectory = lazy(() => import('./pages/shared/CustomerRiskDirectory'));
const FollowUps = lazy(() => import('./pages/shared/FollowUps'));

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Suspense fallback={<div className="p-6"><Skeleton/></div>}>
      <Routes>
        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="employees" element={<EmployeeList />} />
          <Route path="employees/add" element={<AddEmployee />} />
          <Route path="employees/:id" element={<EmployeeDetails />} />
          <Route path="employees/:id/edit" element={<EditEmployee />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/risk" element={<CustomerRiskDirectory admin />} />
          <Route path="customers/all" element={<CustomerPortfolio />} />
          <Route path="customers/unassigned" element={<CustomerPortfolio unassigned />} />
          <Route path="customers/employees/:employeeId" element={<CustomerPortfolio />} />
          <Route path="customers/add" element={<AdminAddCustomer />} />
          <Route path="customers/requests" element={<CustomerLeads />} />
          <Route path="customers/kyc/:id" element={<CustomerKyc />} />
          <Route path="customers/:customerId/kyc" element={<CustomerKyc />} />
          <Route path="customers/:id" element={<AdminCustomerDetails />} />
          <Route path="customers/:id/edit" element={<EditCustomer />} />
          <Route path="loans" element={<AdminLoans />} />
          <Route path="loans/:id" element={<AdminLoanDetails />} />
          <Route path="customers/:id/loans/new" element={<AddLoan isAdmin />} />
          <Route path="collections" element={<TodayCollections isAdmin />} />
          <Route path="collections/receipt/:id" element={<Receipt isAdmin />} />
          <Route path="notifications" element={<MissedPayments />} /><Route path="inbox" element={<NotificationHistory role="ADMIN"/>}/>
          <Route path="follow-ups" element={<FollowUps admin />} />
          <Route path="reconciliation" element={<DailySettlement admin />} />
          <Route path="settings" element={<SettingsPage admin />} />
        </Route>

        {/* Employee Routes */}
        <Route path="/employee/login" element={<EmployeeLogin />} />
        <Route path="/admin/forgot-password" element={<PasswordRecovery key="admin-forgot" role="ADMIN" />} />
        <Route path="/employee/forgot-password" element={<PasswordRecovery key="forgot" />} />
        <Route path="/employee/reset-password" element={<PasswordRecovery key="reset" reset />} />
        <Route path="/employee" element={<EmployeeLayout />}>
          <Route index element={<Navigate to="/employee/dashboard" replace />} />
          <Route path="dashboard" element={<EmployeeDashboard />} />
          <Route path="customers" element={<EmployeeCustomerList />} />
          <Route path="customers/risk" element={<CustomerRiskDirectory />} />
          <Route path="customers/add" element={<AddCustomer />} />
          <Route path="customers/kyc" element={<KycList />} />
          <Route path="customers/kyc/:id" element={<CustomerKyc />} />
          <Route path="customers/:customerId/kyc" element={<CustomerKyc />} />
          <Route path="customers/:id" element={<EmployeeCustomerDetails />} />
          <Route path="customers/:id/edit" element={<EditCustomer />} />
          <Route path="customers/:id/loans/new" element={<AddLoan />} />
          <Route path="loans/:id" element={<EmployeeLoanDetails />} />
          <Route path="loans" element={<EmployeeLoans />} />
          <Route path="collections/today" element={<TodayCollections />} />
          <Route path="follow-ups" element={<FollowUps />} />
          <Route path="inbox" element={<NotificationHistory role="EMPLOYEE"/>}/><Route path="settlements" element={<DailySettlement />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="collections/receipt/:id" element={<Receipt />} />
        </Route>
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/employee/login" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
