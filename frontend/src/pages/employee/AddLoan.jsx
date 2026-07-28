import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function AddLoan() {
  const { id: customerId } = useParams();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    loanAmount: '',
    interestPercent: '',
    durationDays: '',
    loanDate: new Date().toISOString().split('T')[0]
  });

  const [calculations, setCalculations] = useState({
    interestAmount: 0,
    totalPayable: 0,
    dailyInstallment: 0
  });

  useEffect(() => {
    fetchCustomer();
  }, [customerId]);

  // LIVE CALCULATION EFFECT
  useEffect(() => {
    const principal = parseFloat(formData.loanAmount) || 0;
    const rate = parseFloat(formData.interestPercent) || 0;
    const duration = parseInt(formData.durationDays) || 0;

    if (principal > 0 && rate > 0 && duration > 0) {
      const interestAmount = parseFloat((principal * (rate / 100)).toFixed(2));
      const totalPayable = parseFloat((principal + interestAmount).toFixed(2));
      const dailyInstallment = parseFloat((totalPayable / duration).toFixed(2));

      setCalculations({
        interestAmount,
        totalPayable,
        dailyInstallment
      });
    } else {
      setCalculations({ interestAmount: 0, totalPayable: 0, dailyInstallment: 0 });
    }
  }, [formData.loanAmount, formData.interestPercent, formData.durationDays]);

  const fetchCustomer = async () => {
    try {
      const res = await api.get(`/customers/${customerId}`);
      if (res.data.data.status !== 'ACTIVE') {
        toast.error('Cannot issue loan to inactive customer');
        navigate('/employee/customers');
        return;
      }
      setCustomer(res.data.data);
    } catch (error) {
      toast.error('Customer not found');
      navigate('/employee/customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        customerId,
        loanAmount: parseFloat(formData.loanAmount),
        interestPercent: parseFloat(formData.interestPercent),
        durationDays: parseInt(formData.durationDays),
        loanDate: formData.loanDate
      };
      
      const res = await api.post('/loans', payload);
      toast.success('Loan issued successfully and schedule generated!');
      navigate(`/employee/loans/${res.data.data._id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to issue loan');
    }
  };

  if (loading) return <div className="p-8">Loading customer details...</div>;
  if (!customer) return null;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Issue New Loan</h1>
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">Cancel</button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Customer Info Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Customer Details</h2>
          <p className="text-sm text-gray-500">{customer.name} ({customer.customerCode}) - Mobile: {customer.mobile}</p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Loan Amount (₹)</label>
              <input
                type="number"
                min="1"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={formData.loanAmount}
                onChange={e => setFormData({...formData, loanAmount: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Interest Rate (%)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={formData.interestPercent}
                onChange={e => setFormData({...formData, interestPercent: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Duration (Days)</label>
              <input
                type="number"
                min="1"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={formData.durationDays}
                onChange={e => setFormData({...formData, durationDays: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={formData.loanDate}
                onChange={e => setFormData({...formData, loanDate: e.target.value})}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors mt-6 font-medium"
            >
              Issue Loan
            </button>
          </form>

          {/* Live Preview Panel */}
          <div className="bg-indigo-50 rounded-lg p-6 border border-indigo-100 flex flex-col justify-center space-y-6">
            <h3 className="text-lg font-semibold text-indigo-900 border-b border-indigo-200 pb-2">Live Calculation</h3>
            
            <div>
              <p className="text-sm text-indigo-700 font-medium">Interest Amount</p>
              <p className="text-3xl font-bold text-indigo-900">₹{calculations.interestAmount.toLocaleString()}</p>
            </div>
            
            <div>
              <p className="text-sm text-indigo-700 font-medium">Total Payable</p>
              <p className="text-3xl font-bold text-indigo-900">₹{calculations.totalPayable.toLocaleString()}</p>
            </div>

            <div>
              <p className="text-sm text-indigo-700 font-medium">Daily Installment</p>
              <p className="text-3xl font-bold text-emerald-600">₹{calculations.dailyInstallment.toLocaleString()}</p>
              <p className="text-xs text-indigo-600 mt-1">per day for {formData.durationDays || 0} days</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
