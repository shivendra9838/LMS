import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/dashboard/admin');
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500">Total Loans</p>
          <p className="text-3xl font-bold text-indigo-600 mt-2">{stats.totalLoans}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500">Active Loans</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{stats.activeLoans}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500">Completed Loans</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.completedLoans}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500">Cancelled Loans</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{stats.cancelledLoans}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500">Total Loan Amount</p>
          <p className="text-3xl font-bold text-indigo-600 mt-2">₹{(stats.totalLoanAmount || 0).toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500">Average Loan Amount</p>
          <p className="text-3xl font-bold text-indigo-600 mt-2">₹{Math.round(stats.avgLoanAmount || 0).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
