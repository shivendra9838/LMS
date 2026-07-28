import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import StatusBadge from './StatusBadge';

export default function LoanDetailsView({ isAdmin }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loan, setLoan] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [loanRes, timeRes] = await Promise.all([
        api.get(`/loans/${id}`),
        api.get(`/loans/${id}/timeline`)
      ]);
      setLoan(loanRes.data.data);
      setTimeline(timeRes.data.data);
    } catch (error) {
      toast.error('Failed to load loan details');
      navigate(isAdmin ? '/admin/loans' : '/employee/customers');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading loan details...</div>;
  }

  if (!loan) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            Loan {loan.loanNumber}
            <StatusBadge status={loan.status} />
          </h1>
          <p className="text-sm text-gray-500 mt-1">Issued on {new Date(loan.loanDate).toLocaleDateString()}</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-700 font-medium"
        >
          &larr; Back
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Financials Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Financial Summary</h2>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-500">Principal Amount</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">₹{loan.loanAmount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Interest ({loan.interestPercent}%)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">₹{loan.interestAmount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Payable</p>
                <p className="text-2xl font-bold text-indigo-600 mt-1">₹{loan.totalPayable.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Daily Installment</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">₹{loan.dailyInstallment.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Duration</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{loan.durationDays} Days</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Maturity Date</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{new Date(loan.maturityDate).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Parties Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-md font-medium text-gray-500 mb-4 uppercase tracking-wider">Customer Info</h3>
              <p className="text-lg font-bold text-gray-900">{loan.customerId?.name}</p>
              <p className="text-sm text-gray-600 mt-1">{loan.customerId?.customerCode}</p>
              <p className="text-sm text-gray-600 mt-1">{loan.customerId?.mobile}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-md font-medium text-gray-500 mb-4 uppercase tracking-wider">Issued By</h3>
              <p className="text-lg font-bold text-gray-900">{loan.employeeId?.name}</p>
              <p className="text-sm text-gray-600 mt-1">{loan.employeeId?.employeeCode}</p>
              <p className="text-sm text-gray-600 mt-1">Branch: {loan.employeeId?.city}</p>
            </div>
          </div>
        </div>

        {/* Timeline Column */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-fit">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
            <Clock className="text-blue-500" size={20} />
            <h2 className="text-lg font-semibold text-gray-800">Loan Timeline</h2>
          </div>
          
          <div className="relative border-l border-gray-200 ml-3 space-y-6">
            {timeline.length === 0 ? (
              <p className="text-sm text-gray-500 pl-4">No events found.</p>
            ) : (
              timeline.map((event) => (
                <div key={event._id} className="relative pl-6">
                  <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white"></div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900">{event.action}</span>
                    <span className="text-sm text-gray-600 mt-0.5">{event.description}</span>
                    <span className="text-xs text-gray-400 mt-1">
                      {new Date(event.date).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
