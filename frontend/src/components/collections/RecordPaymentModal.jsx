import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function RecordPaymentModal({ isOpen, onClose, schedule, onSuccess }) {
  const [amountReceived, setAmountReceived] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !schedule) return null;

  const expectedAmount = schedule.amount - (schedule.paidAmount || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/collections', {
        loanScheduleId: schedule._id,
        amountReceived: Number(amountReceived),
        paymentMode,
        remarks,
        isMissed: false
      });
      toast.success('Payment recorded successfully!');
      onSuccess(res.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const handleMissed = async () => {
    if (!remarks) {
      toast.error('Please provide a reason in remarks for missing the payment');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/collections', {
        loanScheduleId: schedule._id,
        isMissed: true,
        remarks
      });
      toast.success('Payment marked as missed!');
      onSuccess(res.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to mark as missed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative mx-auto p-6 border w-full max-w-md shadow-lg rounded-xl bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg leading-6 font-semibold text-gray-900">Record Payment</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-100">
            <p className="text-sm text-gray-600">Expected Amount: <span className="font-bold text-gray-900">₹{expectedAmount.toLocaleString()}</span></p>
            <p className="text-sm text-gray-600 mt-1">Loan: <span className="font-medium">{schedule.loan?.loanNumber || 'N/A'}</span></p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount Received (₹)</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                placeholder={`e.g. ${expectedAmount}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Remarks / Reason (if missed)</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                placeholder="e.g. Customer not home"
              />
            </div>

            <div className="flex justify-between items-center pt-4 mt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleMissed}
                disabled={loading}
                className="inline-flex justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
              >
                Mark Missed
              </button>
              <div className="space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                >
                  Record Payment
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
