import { Edit2, ShieldAlert, ShieldCheck, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import StatusBadge from './StatusBadge';

const CustomerTable = ({ customers, loading, refresh, basePath = '/admin/customers' }) => {
  const navigate = useNavigate();

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.patch(`/customers/${id}/status`, { status: newStatus });
      toast.success(`Customer marked as ${newStatus}`);
      refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p className="text-lg">No customers found.</p>
      </div>
    );
  }

  return (
    <table className="w-full text-left text-sm text-gray-600">
      <thead className="bg-gray-50/50 text-gray-700 text-xs uppercase tracking-wider border-b border-gray-100">
        <tr>
          <th className="px-6 py-4 font-medium">Code</th>
          <th className="px-6 py-4 font-medium">Name</th>
          <th className="px-6 py-4 font-medium">Contact</th>
          <th className="px-6 py-4 font-medium">Location</th>
          <th className="px-6 py-4 font-medium">Status</th>
          <th className="px-6 py-4 font-medium text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {customers.map((cus) => (
          <tr key={cus._id} className="hover:bg-gray-50/50 transition-colors group">
            <td className="px-6 py-4 font-medium text-gray-900">{cus.customerCode}</td>
            <td className="px-6 py-4">
              <div className="font-medium text-gray-900">{cus.name}</div>
              <div className="text-xs text-gray-500">{cus.occupation}</div>
            </td>
            <td className="px-6 py-4">
              <div className="font-medium text-gray-900">{cus.mobile}</div>
            </td>
            <td className="px-6 py-4">
              <div>{cus.city}</div>
              <div className="text-xs text-gray-500">{cus.area}</div>
            </td>
            <td className="px-6 py-4">
              <StatusBadge status={cus.status} />
            </td>
            <td className="px-6 py-4 text-right">
              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => navigate(`${basePath}/${cus._id}`)}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="View Details"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => toggleStatus(cus._id, cus.status)}
                  className={`p-2 rounded-lg transition-colors ${
                    cus.status === 'ACTIVE' 
                      ? 'text-red-600 hover:bg-red-50' 
                      : 'text-emerald-600 hover:bg-emerald-50'
                  }`}
                  title={cus.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                >
                  {cus.status === 'ACTIVE' ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                </button>
                <button
                  onClick={() => navigate(`${basePath}/${cus._id}/edit`)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit2 size={16} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default CustomerTable;
