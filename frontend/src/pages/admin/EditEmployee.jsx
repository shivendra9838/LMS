import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';

const EditEmployee = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    city: '',
    area: '',
    status: 'ACTIVE'
  });

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await api.get(`/employees/${id}`);
        setFormData({
          name: res.data.data.name,
          phone: res.data.data.phone,
          city: res.data.data.city,
          area: res.data.data.area,
          status: res.data.data.status
        });
      } catch (error) {
        toast.error('Failed to load employee details');
        navigate('/admin/employees');
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [id, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/employees/${id}`, formData);
      toast.success('Employee updated successfully');
      navigate('/admin/employees');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Edit Employee</h1>
      </div>

      <div className="glass-panel p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Full Name</label>
              <input type="text" name="name" required value={formData.name} onChange={handleChange} className="input-field" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Phone Number</label>
              <input type="tel" name="phone" required value={formData.phone} onChange={handleChange} className="input-field" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">City</label>
              <input type="text" name="city" required value={formData.city} onChange={handleChange} className="input-field" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Area</label>
              <input type="text" name="area" required value={formData.area} onChange={handleChange} className="input-field" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="input-field">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
            <button type="button" onClick={() => navigate('/admin/employees')} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary min-w-[120px]">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEmployee;
