import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function Receipt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReceipt();
  }, [id]);

  const fetchReceipt = async () => {
    try {
      const res = await api.get(`/collections/receipt/${id}`);
      setReceipt(res.data.data);
    } catch (error) {
      toast.error('Failed to load receipt');
      navigate('/employee/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center text-gray-500">Generating receipt...</div>;
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-8 print:hidden">
        <button
          onClick={() => navigate('/employee/collections/today')}
          className="text-indigo-600 hover:text-indigo-900 font-medium flex items-center"
        >
          ← Back to Collections
        </button>
        <button
          onClick={handlePrint}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Print Receipt
        </button>
      </div>

      <div className="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden print:shadow-none print:border-none">
        {/* Receipt Header */}
        <div className="bg-indigo-600 p-8 text-center text-white print:bg-gray-100 print:text-black">
          <h1 className="text-3xl font-bold tracking-wider uppercase mb-2">Payment Receipt</h1>
          <p className="text-indigo-100 text-sm print:text-gray-600">Microfinance Daily Collection System</p>
        </div>

        {/* Receipt Body */}
        <div className="p-8">
          <div className="flex justify-between items-start border-b border-gray-200 pb-8 mb-8">
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Receipt Number</p>
              <p className="text-xl font-bold text-gray-900">{receipt.collectionNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Date</p>
              <p className="text-lg font-medium text-gray-900">
                {new Date(receipt.date).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wider mb-2">Customer Details</p>
              <p className="text-lg font-bold text-gray-900">{receipt.customerName}</p>
              <p className="text-gray-600">ID: {receipt.customerCode}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 uppercase tracking-wider mb-2">Loan Details</p>
              <p className="text-lg font-bold text-gray-900">Loan: {receipt.loanNumber}</p>
              <p className="text-gray-600">Status: <span className="font-semibold">{receipt.status}</span></p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-8 border border-gray-100 flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Amount Paid</p>
              <p className="text-4xl font-bold text-indigo-600">₹{receipt.amount.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Payment Mode</p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white border border-gray-200 text-gray-800">
                {receipt.mode}
              </span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8 mt-8 flex justify-between items-end">
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Collected By</p>
              <p className="font-medium text-gray-900">{receipt.employeeName}</p>
              <p className="text-xs text-gray-500">ID: {receipt.employeeCode}</p>
            </div>
            <div className="text-center">
              <div className="w-48 border-b border-gray-400 mb-2"></div>
              <p className="text-xs text-gray-500">Authorized Signature</p>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          .max-w-3xl {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          .max-w-3xl * {
            visibility: visible;
          }
        }
      `}</style>
    </div>
  );
}
