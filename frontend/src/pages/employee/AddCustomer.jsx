import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import CustomerForm from '../../components/CustomerForm';

const AddCustomer = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    mobile: '',
    alternateMobile: '',
    age: '',
    gender: 'Male',
    occupation: '',
    address: '',
    city: '',
    area: '',
    landmark: '',
    idProofType: 'Aadhar',
    idProofNumber: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/customers', {
        ...formData,
        age: parseInt(formData.age)
      });
      toast.success('Customer created successfully');
      navigate('/employee/customers');
    } catch (error) {
      if (error.response?.data?.errors) {
        error.response.data.errors.forEach(err => toast.error(err.msg));
      } else {
        toast.error(error.response?.data?.message || 'Failed to create customer');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Add New Customer</h1>
        <p className="text-sm text-gray-500 mt-1">Enter customer details to initiate onboarding.</p>
      </div>

      <div className="glass-panel p-6">
        <CustomerForm 
          formData={formData} 
          handleChange={handleChange} 
          handleSubmit={handleSubmit} 
          loading={loading} 
          isEdit={false} 
          basePath="/employee/customers"
        />
      </div>
    </div>
  );
};

export default AddCustomer;
