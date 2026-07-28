import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import CustomerForm from '../../components/CustomerForm';

const EditCustomer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
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
    idProofNumber: '',
    customerCode: ''
  });

  const basePath = window.location.pathname.startsWith('/admin') 
    ? '/admin/customers' 
    : '/employee/customers';

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const res = await api.get(`/customers/${id}`);
        const customer = res.data.data;
        setFormData({
          name: customer.name || '',
          fatherName: customer.fatherName || '',
          mobile: customer.mobile || '',
          alternateMobile: customer.alternateMobile || '',
          age: customer.age || '',
          gender: customer.gender || 'Male',
          occupation: customer.occupation || '',
          address: customer.address || '',
          city: customer.city || '',
          area: customer.area || '',
          landmark: customer.landmark || '',
          idProofType: customer.idProofType || 'Aadhar',
          idProofNumber: customer.idProofNumber || '',
          customerCode: customer.customerCode || ''
        });
      } catch (error) {
        toast.error('Failed to load customer details');
        navigate(basePath);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchCustomer();
  }, [id, navigate, basePath]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/customers/${id}`, {
        ...formData,
        age: parseInt(formData.age)
      });
      toast.success('Customer updated successfully');
      navigate(basePath);
    } catch (error) {
      if (error.response?.data?.errors) {
        error.response.data.errors.forEach(err => toast.error(err.msg));
      } else {
        toast.error(error.response?.data?.message || 'Failed to update customer');
      }
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Edit Customer</h1>
        <p className="text-sm text-gray-500 mt-1">Update customer profile for {formData.customerCode}</p>
      </div>

      <div className="glass-panel p-6">
        <CustomerForm 
          formData={formData} 
          handleChange={handleChange} 
          handleSubmit={handleSubmit} 
          loading={loading} 
          isEdit={true} 
          basePath={basePath}
        />
      </div>
    </div>
  );
};

export default EditCustomer;
