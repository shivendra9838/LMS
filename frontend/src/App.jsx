import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Admin Pages
import AdminLogin from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import EmployeeList from './pages/admin/EmployeeList';
import AddEmployee from './pages/admin/AddEmployee';
import EditEmployee from './pages/admin/EditEmployee';
import EmployeeDetails from './pages/admin/EmployeeDetails';
import Customers from './pages/admin/Customers';
import AdminCustomerDetails from './pages/admin/CustomerDetails';
import AdminLoans from './pages/admin/Loans';
import AdminLoanDetails from './pages/admin/LoanDetails';
import MissedPayments from './pages/admin/MissedPayments';
import AdminLayout from './layouts/AdminLayout';

// Employee Pages
import EmployeeLogin from './pages/employee/Login';
import EmployeeCustomerList from './pages/employee/CustomerList';
import AddCustomer from './pages/employee/AddCustomer';
import EditCustomer from './pages/employee/EditCustomer';
import EmployeeCustomerDetails from './pages/employee/CustomerDetails';
import EmployeeDashboard from './pages/employee/Dashboard';
import AddLoan from './pages/employee/AddLoan';
import EmployeeLoanDetails from './pages/employee/LoanDetails';
import TodayCollections from './pages/employee/TodayCollections';
import Receipt from './pages/employee/Receipt';
import EmployeeLayout from './layouts/EmployeeLayout';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
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
          <Route path="customers/:id" element={<AdminCustomerDetails />} />
          <Route path="customers/:id/edit" element={<EditCustomer />} />
          <Route path="loans" element={<AdminLoans />} />
          <Route path="loans/:id" element={<AdminLoanDetails />} />
          <Route path="notifications" element={<MissedPayments />} />
        </Route>

        {/* Employee Routes */}
        <Route path="/employee/login" element={<EmployeeLogin />} />
        <Route path="/employee" element={<EmployeeLayout />}>
          <Route index element={<Navigate to="/employee/dashboard" replace />} />
          <Route path="dashboard" element={<EmployeeDashboard />} />
          <Route path="customers" element={<EmployeeCustomerList />} />
          <Route path="customers/add" element={<AddCustomer />} />
          <Route path="customers/:id" element={<EmployeeCustomerDetails />} />
          <Route path="customers/:id/edit" element={<EditCustomer />} />
          <Route path="customers/:id/loans/new" element={<AddLoan />} />
          <Route path="loans/:id" element={<EmployeeLoanDetails />} />
          <Route path="collections/today" element={<TodayCollections />} />
          <Route path="collections/receipt/:id" element={<Receipt />} />
        </Route>
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/employee/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
