import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
  AreaChart, Area as RechartsArea
} from 'recharts';

const PIE_COLORS = ['#10B981', '#F59E0B', '#EF4444'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [dailyStats, setDailyStats] = useState([]);
  const [employeeStats, setEmployeeStats] = useState([]);
  const [areaStats, setAreaStats] = useState([]);
  const [loading, setLoading] = useState(true);

  // Global Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    employeeId: '',
    city: '',
    area: '',
    status: '',
    paymentMode: ''
  });

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams(
        Object.entries(filters).filter(([_, v]) => v)
      ).toString();

      const [statsRes, dailyRes, empRes, areaRes] = await Promise.all([
        api.get(`/dashboard/admin?${queryParams}`),
        api.get(`/reports/daily?${queryParams}`),
        api.get(`/reports/employees?${queryParams}`),
        api.get(`/reports/area?${queryParams}`)
      ]);
      setStats(statsRes.data.data);
      setDailyStats(dailyRes.data.data || []);
      setEmployeeStats(empRes.data.data || []);
      setAreaStats(areaRes.data.data || []);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleExport = async (type) => {
    try {
      const toastId = toast.loading(`Exporting ${type} report...`);
      const queryParams = new URLSearchParams(
        Object.entries(filters).filter(([_, v]) => v)
      ).toString();
      
      const response = await api.get(`/reports/export/${type}?${queryParams}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `${type}-report-${dateStr}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Export successful', { id: toastId });
    } catch (error) {
      toast.error('Export failed');
    }
  };

  if (loading && !stats) return <div className="p-8">Loading dashboard...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        
        {/* Export Buttons */}
        <div className="flex flex-wrap gap-2">
          {['daily', 'monthly', 'outstanding', 'collections', 'employees', 'customers', 'loans'].map(type => (
            <button
              key={type}
              onClick={() => handleExport(type)}
              className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 capitalize"
            >
              Export {type}
            </button>
          ))}
        </div>
      </div>

      {/* Global Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
          <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="p-2 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
          <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="p-2 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Employee ID</label>
          <input type="text" name="employeeId" placeholder="Employee ID" value={filters.employeeId} onChange={handleFilterChange} className="p-2 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
          <input type="text" name="city" placeholder="All Cities" value={filters.city} onChange={handleFilterChange} className="p-2 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Area</label>
          <input type="text" name="area" placeholder="All Areas" value={filters.area} onChange={handleFilterChange} className="p-2 text-sm border rounded" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select name="status" value={filters.status} onChange={handleFilterChange} className="p-2 text-sm border rounded">
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Payment</label>
          <select name="paymentMode" value={filters.paymentMode} onChange={handleFilterChange} className="p-2 text-sm border rounded">
            <option value="">All Modes</option>
            <option value="CASH">CASH</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">BANK TRANSFER</option>
          </select>
        </div>
        <div>
          <button onClick={() => setFilters({ startDate: '', endDate: '', employeeId: '', city: '', area: '', status: '', paymentMode: '' })} className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100">
            Clear Filters
          </button>
        </div>
      </div>

      {stats && (
        <>
          {/* Entity Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase">Total / Active Employees</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalEmployees} <span className="text-sm font-normal text-emerald-600">({stats.activeEmployees} active)</span></p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase">Total / Active Customers</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalCustomers} <span className="text-sm font-normal text-emerald-600">({stats.activeCustomers} active)</span></p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase">Total / Active Loans</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">{stats.totalLoans} <span className="text-sm font-normal text-indigo-400">({stats.activeLoans} active)</span></p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase">Completed Loans</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.completedLoans}</p>
            </div>
          </div>

          {/* Financial Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 rounded-xl shadow-md text-white">
              <p className="text-indigo-100 text-sm font-medium uppercase tracking-wide">Total Outstanding</p>
              <p className="text-4xl font-bold mt-2">₹{(stats.totalOutstanding || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Monthly Revenue</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">₹{(stats.monthlyRevenue || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Collection Efficiency</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{(stats.collectionEfficiency || 0).toFixed(1)}%</p>
            </div>
          </div>

          {/* Today's Stats */}
          <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Today's Pulse</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase">Revenue</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">₹{(stats.todaysRevenue || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase">Avg Collection</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">₹{Math.round(stats.averageCollection || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase">Collected</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.todaysCollection || 0}</p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase">Pending</p>
              <p className="text-2xl font-bold text-orange-500 mt-1">{stats.todaysPending || 0}</p>
            </div>
            <div className="bg-red-50 p-5 rounded-xl shadow-sm border border-red-100">
              <p className="text-xs font-medium text-red-600 uppercase">Missed</p>
              <p className="text-2xl font-bold text-red-700 mt-1">{stats.todaysMissed || 0}</p>
            </div>
          </div>

          {/* Analytics Charts */}
          <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-600 mb-4">Schedule Status</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ name: 'Paid', value: stats.todaysCollection || 0 }, { name: 'Pending', value: stats.todaysPending || 0 }, { name: 'Missed', value: stats.todaysMissed || 0 }]} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {PIE_COLORS.map((color, i) => <Cell key={`cell-${i}`} fill={color} />)}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-600 mb-4">Daily Collections Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="_id" tick={{fontSize: 12}} />
                    <YAxis tick={{fontSize: 12}} />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="collectionAmount" name="Collection (₹)" stroke="#4f46e5" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-600 mb-4">Employee Performance (Efficiency %)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={employeeStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{fontSize: 12}} />
                    <YAxis tick={{fontSize: 12}} />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="collectionEfficiency" name="Efficiency (%)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-600 mb-4">Area-wise Outstanding & Collection</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={areaStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="area" tick={{fontSize: 12}} />
                    <YAxis tick={{fontSize: 12}} />
                    <RechartsTooltip />
                    <Legend />
                    <RechartsArea type="monotone" dataKey="outstanding" name="Outstanding" stackId="1" stroke="#818cf8" fill="#c7d2fe" />
                    <RechartsArea type="monotone" dataKey="todaysCollection" name="Today's Collection" stackId="2" stroke="#34d399" fill="#a7f3d0" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            
          </div>
        </>
      )}
    </div>
  );
}
