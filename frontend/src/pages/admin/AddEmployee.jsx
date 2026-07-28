import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';

const AddEmployee = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    area: '',
    joiningDate: new Date().toISOString().split('T')[0]
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/employees', formData);
      toast.success('Employee created successfully');
      navigate('/admin/employees');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Add New Employee</h1>
        <p className="text-sm text-gray-500 mt-1">Enter details to onboard a new team member.</p>
      </div>

      <div className="glass-panel p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Full Name *</label>
              <input type="text" name="name" required value={formData.name} onChange={handleChange} className="input-field" placeholder="Rahul Kumar" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Email Address *</label>
              <input type="email" name="email" required value={formData.email} onChange={handleChange} className="input-field" placeholder="rahul@loan.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Phone Number *</label>
              <input type="tel" name="phone" required value={formData.phone} onChange={handleChange} className="input-field" placeholder="9876543210" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Joining Date *</label>
              <input type="date" name="joiningDate" required value={formData.joiningDate} onChange={handleChange} className="input-field" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">City *</label>
              <input type="text" name="city" required value={formData.city} onChange={handleChange} className="input-field" placeholder="Mumbai" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Area *</label>
              <input type="text" name="area" required value={formData.area} onChange={handleChange} className="input-field" placeholder="Vashi" />
            </div>
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
            <button type="button" onClick={() => navigate('/admin/employees')} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary min-w-[120px]">
              {loading ? 'Creating...' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEmployee;
