import { Edit2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import StatusBadge from './StatusBadge';

const EmployeeTable = ({ employees, loading, refresh }) => {
  const navigate = useNavigate();

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.patch(`/employees/${id}/status`, { status: newStatus });
      toast.success(`Employee marked as ${newStatus}`);
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

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p className="text-lg">No employees found.</p>
      </div>
    );
  }

  return (
    <table className="w-full text-left text-sm text-gray-600">
      <thead className="bg-gray-50/50 text-gray-700 text-xs uppercase tracking-wider border-b border-gray-100">
        <tr>
          <th className="px-6 py-4 font-medium">Code</th>
          <th className="px-6 py-4 font-medium">Name</th>
          <th className="px-6 py-4 font-medium">Location</th>
          <th className="px-6 py-4 font-medium">Status</th>
          <th className="px-6 py-4 font-medium text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {employees.map((emp) => (
          <tr key={emp._id} className="hover:bg-gray-50/50 transition-colors group">
            <td className="px-6 py-4 font-medium text-gray-900">{emp.employeeCode}</td>
            <td className="px-6 py-4">
              <div className="font-medium text-gray-900">{emp.name}</div>
              <div className="text-xs text-gray-500">{emp.email}</div>
            </td>
            <td className="px-6 py-4">
              <div>{emp.city}</div>
              <div className="text-xs text-gray-500">{emp.area}</div>
            </td>
            <td className="px-6 py-4">
              <StatusBadge status={emp.status} />
            </td>
            <td className="px-6 py-4 text-right">
              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => toggleStatus(emp._id, emp.status)}
                  className={`p-2 rounded-lg transition-colors ${
                    emp.status === 'ACTIVE' 
                      ? 'text-red-600 hover:bg-red-50' 
                      : 'text-emerald-600 hover:bg-emerald-50'
                  }`}
                  title={emp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                >
                  {emp.status === 'ACTIVE' ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                </button>
                <button
                  onClick={() => navigate(`/admin/employees/${emp._id}/edit`)}
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

export default EmployeeTable;
