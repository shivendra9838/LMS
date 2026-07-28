import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function EmployeeDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/dashboard/employee');
      setStats(res.data.data);
    } catch (error) {
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading dashboard...</div>;
  if (!stats) return null;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Employee Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500">My Loans</p>
          <p className="text-3xl font-bold text-indigo-600 mt-2">{stats.myLoans}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500">My Customers</p>
          <p className="text-3xl font-bold text-indigo-600 mt-2">{stats.customers}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500">Total Outstanding</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">₹{stats.totalOutstanding.toLocaleString()}</p>
        </div>

        <div 
          onClick={() => window.location.href = '/employee/collections/today'}
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow group"
        >
          <p className="text-sm font-medium text-gray-500 group-hover:text-indigo-600 transition-colors">Today's Collections</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">₹{(stats.todaysTotalCollection || 0).toLocaleString()}</p>
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-400">View Due List →</p>
            <p className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">{stats.todaysDue || 0} Due</p>
          </div>
        </div>
      </div>
    </div>
  );
}
