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

      <h2 className="text-xl font-bold text-gray-900 mt-10 mb-6 border-b pb-2">Today's Collections (Global)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500">Collected Amount Today</p>
          <p className="text-3xl font-bold text-green-600 mt-2">₹{(stats.collectionAmountToday || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500">Total Installments Due</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalDueToday || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500">Successfully Paid</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{stats.collectedToday || 0}</p>
        </div>
        <div 
          onClick={() => window.location.href = '/admin/notifications'}
          className="bg-white p-6 rounded-lg shadow-sm border border-red-200 cursor-pointer hover:shadow-md transition-shadow group"
        >
          <p className="text-sm font-medium text-gray-500 group-hover:text-red-600 transition-colors">Missed Today</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{stats.missedToday || 0}</p>
          <p className="text-xs text-red-400 mt-2">View Notifications →</p>
        </div>
      </div>
    </div>
  );
}
