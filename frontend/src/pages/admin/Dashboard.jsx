import { useState, useEffect } from 'react';
import { Users, UserCheck, UserX } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [stats, setStats] = useState({ totalEmployees: 0, activeEmployees: 0, inactiveEmployees: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/admin/dashboard');
        setStats(res.data);
      } catch (error) {
        toast.error('Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading stats...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-gray-500 mt-1">High-level metrics for your organization.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 flex items-center gap-4">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
            <Users size={32} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Employees</p>
            <h3 className="text-3xl font-bold text-gray-900">{stats.totalEmployees}</h3>
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center gap-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <UserCheck size={32} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Active Employees</p>
            <h3 className="text-3xl font-bold text-gray-900">{stats.activeEmployees}</h3>
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center gap-4">
          <div className="p-4 bg-gray-100 text-gray-600 rounded-2xl">
            <UserX size={32} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Inactive Employees</p>
            <h3 className="text-3xl font-bold text-gray-900">{stats.inactiveEmployees}</h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
