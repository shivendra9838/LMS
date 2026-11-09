import {uncertainFinancialError,issuedLoanMatch,uncertainScope} from '../../utils/financialOutcome';
import LoadingIndicator, {LoadingButton,ProcessingOverlay} from "../../components/ui/Loading";
import CustomerRisk from '../../components/CustomerRisk';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { businessDay } from '../../utils/businessDate';
import toast from 'react-hot-toast';

export default function AddLoan({isAdmin=false}) {
  const portal=isAdmin?'admin':'employee';
  const { id: customerId } = useParams();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState(null);
  const [activeLoan, setActiveLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,setSaving]=useState(false);
  const inFlight=useRef(false),recoveryScope=uncertainScope('loan:'+portal+':'+customerId);
  const [unconfirmed,setUnconfirmed]=useState(()=>typeof sessionStorage==='undefined'?'':sessionStorage.getItem(recoveryScope)||'');
  async function checkIssuedLoan(){const response=await api.get(`/loans?customer=${customerId}&limit=100`);const payload={...formData,loanDate:formData.loanDate};const match=issuedLoanMatch(response.data.data,payload,Number(sessionStorage.getItem(recoveryScope)));if(match){sessionStorage.removeItem(recoveryScope);setUnconfirmed('');toast.success('Loan entry confirmed in loan history');navigate(`/${portal}/loans/${match._id}`);return true;}return false;}
  async function recheck(){if(inFlight.current)return;inFlight.current=true;setSaving(true);try{if(!await checkIssuedLoan())toast.error('Outcome is still unconfirmed. Check My Loans or contact Admin before another submission.');}catch{toast.error('Unable to confirm loan status. Another submission remains blocked.');}finally{inFlight.current=false;setSaving(false);}}
  
  const [formData, setFormData] = useState({
    loanAmount: '',
    interestPercent: '',
    durationDays: '',
    loanDate: businessDay()
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
      const [customerRes, loansRes] = await Promise.all([
        api.get(`/customers/${customerId}`),
        api.get(`/loans?customer=${customerId}&limit=100`)
      ]);

      if (customerRes.data.data.status !== 'ACTIVE') {
        toast.error('Cannot issue loan to inactive customer');
        navigate(`/${portal}/customers`);
        return;
      }

      const existingLoan = loansRes.data.data?.find(loan=>['ACTIVE','DEFAULTED'].includes(loan.status)&&loan.remainingAmount>0);
      if (existingLoan) {
        setActiveLoan(existingLoan);
      }

      setCustomer(customerRes.data.data);
    } catch (error) {
      toast.error('Customer not found');
      navigate(`/${portal}/customers`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(inFlight.current||unconfirmed||sessionStorage.getItem(recoveryScope))return;inFlight.current=true;setSaving(true);
    const startedAt=Date.now();sessionStorage.setItem(recoveryScope,String(startedAt));
    try {
      const payload = {
        customerId,
        loanAmount: parseFloat(formData.loanAmount),
        interestPercent: parseFloat(formData.interestPercent),
        durationDays: parseInt(formData.durationDays),
        loanDate: formData.loanDate
      };
      
      const res = await api.post('/loans', payload);
      sessionStorage.removeItem(recoveryScope);toast.success('Loan issued successfully and schedule generated!');
      navigate(`/${portal}/loans/${res.data.data._id}`);
    } catch (error) {
      if(uncertainFinancialError(error)){sessionStorage.setItem(recoveryScope,String(startedAt));setUnconfirmed(String(startedAt));try{if(!await checkIssuedLoan())toast.error('Loan outcome is unconfirmed. Check loan history before another attempt.');}catch{toast.error('Loan outcome is unconfirmed. Check status when connected.');}}else{sessionStorage.removeItem(recoveryScope);toast.error(error.response?.data?.message || 'Loan was not issued');}
    } finally {inFlight.current=false;setSaving(false);}
  };

  if (loading) return <LoadingIndicator message={"Loading customer details..."} className="p-8"/>;
  if (!customer) return null;

  if (activeLoan) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h1 className="text-xl font-bold text-amber-900 mb-2">Active Loan Already Exists</h1>
          <CustomerRisk customerId={customerId}/>
          <p className="text-amber-800 mb-4">
            {customer.name} already has an active loan ({activeLoan.loanNumber}).
            A new loan can only be issued after the current one is completed or closed.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate(`/${portal}/loans/${activeLoan._id}`)}
              className="min-h-11 bg-[#211b10] text-white px-4 py-2 rounded-md hover:bg-[#3c2e14]"
            >
              View Existing Loan
            </button>
            <button
              onClick={() => navigate(`/${portal}/customers`)}
              className="text-gray-600 px-4 py-2 rounded-md hover:bg-gray-100"
            >
              Back to Customers
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Issue New Loan</h1>
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">Cancel</button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Customer Info Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Customer Details</h2>
          <p className="text-sm text-gray-500">{customer.name} ({customer.customerCode}) - Mobile: {customer.mobile}</p><CustomerRisk customerId={customerId}/>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Input Form */}
          <ProcessingOverlay active={saving} message={unconfirmed?"Checking loan status…":"Issuing loan…"}/>{unconfirmed&&<div className="royal-recovery" role="alert">The previous loan request has an unconfirmed result. Do not issue it again until its status is confirmed.<LoadingButton busy={saving} loadingText="Checking loan status…" type="button" disabled={saving} className="btn-secondary" onClick={recheck}>Check loan status</LoadingButton></div>}<form onSubmit={handleSubmit} className="space-y-4"><fieldset className="space-y-4" disabled={saving||Boolean(unconfirmed)}>
            <div>
              <label htmlFor="field-loan-amount" className="block text-sm font-medium text-gray-700">Loan Amount (₹)</label>
              <input id="field-loan-amount"
                type="number"
                inputMode="decimal"
                min="1"
                required
                className="input-field mt-1"
                value={formData.loanAmount}
                onChange={e => setFormData({...formData, loanAmount: e.target.value})}
              />
            </div>

            <div>
              <label htmlFor="field-interest-rate" className="block text-sm font-medium text-gray-700">Interest Rate (%)</label>
              <input id="field-interest-rate"
                type="number"
                inputMode="decimal"
                min="0.1"
                step="0.1"
                required
                className="input-field mt-1"
                value={formData.interestPercent}
                onChange={e => setFormData({...formData, interestPercent: e.target.value})}
              />
            </div>

            <div>
              <label htmlFor="field-duration-days" className="block text-sm font-medium text-gray-700">Duration (Days)</label>
              <input id="field-duration-days"
                type="number"
                inputMode="numeric"
                min="1"
                required
                className="input-field mt-1"
                value={formData.durationDays}
                onChange={e => setFormData({...formData, durationDays: e.target.value})}
              />
            </div>

            <div>
              <label htmlFor="field-start-date" className="block text-sm font-medium text-gray-700">Actual loan issue date (India)</label>
              <input id="field-start-date"
                type="date"
                max={businessDay()}
                required
                className="input-field mt-1"
                value={formData.loanDate}
                onChange={e => setFormData({...formData, loanDate: e.target.value})}
              />
              <p className="text-xs text-gray-600 mt-2">Choose the day the loan was actually given, including a past date. The first installment is due the following day. The system entry timestamp stays today.</p>
            </div>

            <LoadingButton busy={saving} loadingText="Issuing loan…"
              type="submit" disabled={saving||Boolean(unconfirmed)}
              className="w-full min-h-11 bg-[#211b10] text-white py-2 px-4 rounded-md hover:bg-[#3c2e14] transition-colors mt-6 font-medium"
            >
              {saving?'Issuing…':'Issue Loan'}
            </LoadingButton>
          </fieldset></form>

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
