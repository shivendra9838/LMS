import {uncertainFinancialError,collectionByRequest,uncertainScope} from '../../utils/financialOutcome';
import LoadingIndicator, {LoadingButton} from "../ui/Loading";
import { useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import './record-payment-modal.css';
import { paymentAmountError } from '../../utils/minimumPayment';
import { persistentRequestKey } from '../../utils/requestKey';
import { businessDate, businessDay } from '../../utils/businessDate';

export default function RecordPaymentModal({ isOpen, onClose, schedule, onSuccess, isAdmin=false, customerCollection, onLoanChange, initialPaymentDate, outstandingDueMessage=false }) {
  const paymentFormId = useId();
  const [amountReceived, setAmountReceived] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [unconfirmed,setUnconfirmed]=useState(false);
  const requestScope=schedule?`collection-request:${schedule._id}`:'';
  useEffect(()=>{setUnconfirmed(Boolean(isOpen&&requestScope&&sessionStorage.getItem(uncertainScope(requestScope))));},[isOpen,requestScope]);
  async function checkRecordedPayment(){const key=sessionStorage.getItem(requestScope),response=await api.get(`/collections/history/${schedule.loanId?._id||schedule.loanId}`),record=collectionByRequest(response.data.data,key);if(!record)return false;sessionStorage.removeItem(requestScope);sessionStorage.removeItem(uncertainScope(requestScope));setUnconfirmed(false);toast.success('Recorded entry confirmed in payment history');onSuccess(record);return true;}
  async function recheckPayment(){if(inFlight.current)return;inFlight.current=true;setLoading(true);try{if(!await checkRecordedPayment())toast.error('No matching entry is confirmed yet. Another payment remains blocked; check history or contact Admin.');}catch{toast.error('Unable to check history. Another payment remains blocked.');}finally{inFlight.current=false;setLoading(false);}}
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [accountError, setAccountError] = useState('');
  const [paymentDate,setPaymentDate]=useState(()=>businessDay());
  const [backdateReason,setBackdateReason]=useState('');
  const [cashConfirmed,setCashConfirmed]=useState(false);
  const [quote,setQuote]=useState({key:'',data:null,error:''});
  const [confirmedKey,setConfirmedKey]=useState('');
  const [quoteRevision,setQuoteRevision]=useState(0);
  const [minimum,setMinimum]=useState({key:'',data:null,error:''});
  const minimumKey=isOpen&&schedule?`${schedule._id}:${paymentDate}:${quoteRevision}`:'';
  useEffect(()=>{
    if(!isOpen)return;
    setPaymentDate(initialPaymentDate||businessDay());setAmountReceived('');setConfirmedKey('');setBackdateReason('');setMinimum({key:'',data:null,error:''});setQuoteRevision(n=>n+1);
  },[isOpen,schedule?._id,initialPaymentDate]);
  useEffect(()=>{
    if(!isOpen||!schedule||!paymentDate)return;
    const controller=new AbortController();
    api.get(`/collections/installments/${schedule._id}/allocation-preview`,{params:{paymentDate},signal:controller.signal}).then(res=>{
      if(controller.signal.aborted)return;
      setMinimum({key:minimumKey,data:{...res.data.data.minimum,outstanding:res.data.data.loanOutstanding},error:''});
      setAmountReceived(res.data.data.amount.toFixed(2));
    }).catch(error=>{if(error.code!=='ERR_CANCELED')setMinimum({key:minimumKey,data:null,error:error.response?.data?.message||'Unable to calculate the minimum. Retry before recording payment.'});});
    return()=>controller.abort();
  },[isOpen,schedule?._id,paymentDate,minimumKey]);
  const minimumReady=minimum.key===minimumKey&&Boolean(minimum.data);
  const money=value=>Number(value).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const belowMinimum=minimumReady&&amountReceived!==''&&Math.round(Number(amountReceived)*100)<Math.round(minimum.data.minimumPayment*100);
  const validAmount=/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(amountReceived)&&Number(amountReceived)>0;
  const amountError=outstandingDueMessage&&validAmount&&belowMinimum?`Payment cannot be less than the total outstanding due of ₹${money(minimum.data.minimumPayment)}.`:paymentAmountError(amountReceived,minimumReady?minimum.data.minimumPayment:0,minimumReady?minimum.data.outstanding:undefined);
  const quoteKey=isOpen&&schedule?`${schedule._id}:${paymentDate}:${amountReceived}:${schedule.paidAmount}:${schedule.canCollect}:${quoteRevision}`:'';
  useEffect(()=>{
    if(!isOpen||!schedule||!validAmount)return;
    const controller=new AbortController();
    const timer=setTimeout(()=>api.get(`/collections/installments/${schedule._id}/allocation-preview`,{params:{amount:amountReceived,paymentDate},signal:controller.signal}).then(res=>{if(!controller.signal.aborted)setQuote({key:quoteKey,data:res.data.data,error:''});}).catch(error=>{if(error.code!=='ERR_CANCELED')setQuote({key:quoteKey,data:null,error:error.response?.data?.message||'Unable to preview allocation. Check the connection and retry.'});}),350);
    return()=>{clearTimeout(timer);controller.abort();};
  },[isOpen,schedule?._id,amountReceived,paymentDate,quoteKey,validAmount]);
  const confirmationKey=`${quoteKey}:${paymentDate}:${paymentMode}:${accountId}:${reference}`;
  const inFlight = useRef(false);
  const dialogRef = useRef(null);
  useEffect(() => { if (!isOpen) return; let active = true; api.get('/settlements/accounts').then(res => { if(active)setAccounts(res.data.data.filter(account => account.active)); }).catch(() => { if(active)setAccountError('Receiving accounts could not be loaded. Cash remains available; retry digital payments later.'); }); return () => { active = false; }; }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKey = event => {
      if (event.key === 'Escape' && !inFlight.current) onClose();
      if (event.key !== 'Tab') return;
      const items = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')];
      if (!items.length) { event.preventDefault(); dialogRef.current.focus(); return; }
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [isOpen, onClose]);

  if (!isOpen || !schedule) return null;

  const expectedAmount = schedule.amount - (schedule.paidAmount || 0);
  const quoteReady=!unconfirmed&&minimumReady&&!amountError&&!belowMinimum&&validAmount&&quote.data?.meetsMinimum!==false&&quote.key===quoteKey&&Boolean(quote.data)&&schedule.canCollect!==false&&schedule.collectionLocked!==true;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inFlight.current||unconfirmed||sessionStorage.getItem(uncertainScope(requestScope))) return;
    if(!quoteReady||confirmedKey!==confirmationKey){toast.error('Review a valid oldest-unpaid allocation preview before recording payment.');return;}
    inFlight.current = true;
    setLoading(true);
    sessionStorage.setItem(uncertainScope(requestScope),'1');
    try {
      const res = await api.post('/collections', {
        loanScheduleId: schedule._id,
        amountReceived: Number(amountReceived),
        paymentMode,
        remarks,
        paymentDate,
        ...(paymentDate<businessDay()?{backdateReason}:{}),
        ...(isAdmin&&paymentMode==='CASH'&&cashConfirmed?{cashReceivedByEmployeeId:schedule.employeeId}:{}),
        isMissed: false,
        financeVersion: 2,
        idempotencyKey: persistentRequestKey(`collection-request:${schedule._id}`),
        ...(paymentMode !== 'CASH' ? {receivingAccountId:accountId,transactionReference:reference} : {})
      });
      sessionStorage.removeItem(`collection-request:${schedule._id}`);sessionStorage.removeItem(uncertainScope(requestScope));
      toast.success('Payment recorded successfully!');
      onSuccess(res.data.data);
    } catch (error) {
      if(uncertainFinancialError(error)){sessionStorage.setItem(uncertainScope(requestScope),'1');setUnconfirmed(true);try{if(!await checkRecordedPayment())toast.error('Payment outcome is unconfirmed. Check payment history before another attempt.');}catch{toast.error('Payment outcome is unconfirmed. Reconnect and check history.');}}else{sessionStorage.removeItem(uncertainScope(requestScope));toast.error(error.response?.data?.message || 'Payment was not recorded');}
      setConfirmedKey('');setQuoteRevision(n=>n+1);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  const handleMissed = async () => {
    if (inFlight.current||unconfirmed||sessionStorage.getItem(uncertainScope(requestScope))) return;
    if (!remarks.trim()) {
      toast.error('Please provide a reason in remarks for missing the payment');
      return;
    }
    inFlight.current = true;
    setLoading(true);
    sessionStorage.setItem(uncertainScope(requestScope),'1');
    try {
      const res = await api.post('/collections', {
        loanScheduleId: schedule._id,
        isMissed: true,
        remarks,
        financeVersion: 2,
        idempotencyKey: persistentRequestKey(`collection-request:${schedule._id}`)
      });
      sessionStorage.removeItem(`collection-request:${schedule._id}`);sessionStorage.removeItem(uncertainScope(requestScope));
      toast.success('Payment marked as missed!');
      onSuccess(res.data.data);
    } catch (error) {
      if(uncertainFinancialError(error)){sessionStorage.setItem(uncertainScope(requestScope),'1');setUnconfirmed(true);try{await checkRecordedPayment();}catch{toast.error('Entry outcome is unconfirmed. Check history.');}}else{sessionStorage.removeItem(uncertainScope(requestScope));toast.error(error.response?.data?.message || 'Missed entry was not recorded');}
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="rp-overlay">
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="payment-title" aria-busy={loading} className="payment-dialog rp-dialog">
        <header className="rp-header">
            <h3 id="payment-title" className="text-lg leading-6 font-semibold text-gray-900">Record Payment</h3>
            <button type="button" aria-label="Close payment form" disabled={loading} onClick={onClose} className="p-2.5 text-gray-500 hover:text-gray-600 transition-colors">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>
        <div className="rp-body">
          <div className="rp-payment-details">
            {schedule.loanRemainingAmount!==undefined&&<p className="text-sm mb-2">Total loan outstanding: ₹{schedule.loanRemainingAmount.toLocaleString('en-IN')}. Payment must start at the earliest unpaid installment, then cover later unpaid installments in order, including advances. The total loan balance cannot be exceeded.</p>}
            {(schedule.collectionLocked||schedule.canCollect===false)&&<p role="alert" className="text-sm text-red-700">{schedule.collectionLockReason||'This installment is no longer available for collection. Close the form and refresh the list.'}</p>}
            <p className="text-sm font-semibold">{schedule.customerName} · Day {schedule.dayNumber}</p><p className="text-sm">Scheduled installment: ₹{Number(schedule.amount).toLocaleString('en-IN')} · Already paid / adjusted: ₹{Number(schedule.paidAmount||0).toLocaleString('en-IN')}</p><p className="text-sm text-gray-600">Remaining to collect: <span className="font-bold text-gray-900">₹{expectedAmount.toLocaleString()}</span></p>
            <p className="text-sm text-gray-600 mt-1">Loan: <span className="font-medium">{schedule.loanNumber || schedule.loan?.loanNumber || 'N/A'}</span></p>
            <p className="text-sm mt-2">Installment due: {businessDate(schedule.dueDate)}. This is separate from when money was received.</p>
          </div>

          <form id={paymentFormId} onSubmit={handleSubmit} className="rp-form">
            <label className="block text-sm font-medium">Actual payment received date (India)<input type="date" required className="input-field mt-1" max={businessDay()} min={schedule.loanIssueDate?businessDay(schedule.loanIssueDate):undefined} disabled={loading} value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} /></label>
            {paymentDate<businessDay()&&<label className="block text-sm font-medium">Reason for backdated entry<input required minLength={5} maxLength={1000} className="input-field mt-1" value={backdateReason} disabled={loading} onChange={e=>setBackdateReason(e.target.value)} /><span className="block text-xs text-gray-600 mt-2">Received date and system entry timestamp are stored separately in the audit trail.</span></label>}
            {isAdmin&&paymentMode==='CASH'&&<label className="rp-check"><input type="checkbox" required checked={cashConfirmed} disabled={loading} onChange={e=>setCashConfirmed(e.target.checked)} /><span>I confirm this cash was physically received by the employee assigned to this loan.</span></label>}
            <p className="text-xs text-gray-600">If the connection is interrupted, check payment status before another attempt. The original request key stays unchanged.</p>
            {customerCollection&&<section className="rp-minimum" aria-label="Customer collection summary"><p><strong>{customerCollection.customerName}</strong> · Combined customer dues ₹{money(customerCollection.remaining)}</p>{customerCollection.loans.filter(loan=>loan.remaining>0&&loan.currentSchedule).length>1&&<label>Collect for loan<select className="input-field" value={schedule.loanId} onChange={event=>onLoanChange(customerCollection.loans.find(loan=>loan.loanId===event.target.value))} disabled={loading}>{customerCollection.loans.filter(loan=>loan.remaining>0&&loan.currentSchedule).map(loan=><option key={loan.loanId} value={loan.loanId}>{loan.loanNumber} · ₹{money(loan.remaining)}</option>)}</select><small>One receipt applies to the selected loan. Collect other loans separately.</small></label>}</section>}
            <section className="rp-minimum" aria-label="Minimum payment summary" aria-live="polite">
              {!minimumReady?<p role={minimum.error?'alert':'status'}>{minimum.key===minimumKey&&minimum.error?minimum.error:<LoadingIndicator message={"Calculating amounts due…"}/>}{minimum.key===minimumKey&&minimum.error&&<button type="button" className="btn-secondary" onClick={()=>setQuoteRevision(n=>n+1)}>Retry</button>}</p>:<>
                <p>Previous Overdue: <strong>₹{money(minimum.data.previousOverdue)}</strong></p>
                <p>Today’s Due: <strong>₹{money(minimum.data.todayUnpaid)}</strong></p>
                <p className="rp-minimum-total">Minimum Payment Required: <strong>₹{money(minimum.data.minimumPayment)}</strong></p>
                <small>As of {businessDate(paymentDate)} · Asia/Kolkata{minimum.data.minimumPayment===0?' · No unpaid amount is due. Advance payments remain available.':''}</small>
              </>}
            </section>
            <div>
              <label htmlFor="payment-amount" className="block text-sm font-medium text-gray-700">Amount Received (₹)</label>
              <input
                id="payment-amount"
                aria-invalid={Boolean(amountError)}
                aria-describedby={amountError?"payment-amount-error":undefined}
                disabled={loading||!minimumReady}
                type="number"
                inputMode="decimal"
                required
                min={minimumReady?Math.max(0.01,minimum.data.minimumPayment):0.01}
                step="0.01"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                placeholder={`e.g. ${expectedAmount}`}
              />
              {amountError&&<p id="payment-amount-error" role="alert" className="rp-amount-error">{amountError}</p>}
            </div>

            {amountReceived&&<section aria-label="Allocation preview" className="rounded-lg border border-amber-600/40 p-3 text-sm"><h4 className="font-semibold">Allocation preview</h4>{quote.data?.outstandingDues&&<details><summary className="min-h-11 py-3 cursor-pointer">Full overdue and today breakdown</summary>{quote.data.outstandingDues.map(row=><p key={row.scheduleId}>Day {row.dayNumber} · Original due {businessDate(row.dueDate)} · Outstanding ₹{row.outstanding.toFixed(2)} · Allocation ₹{row.allocation.toFixed(2)}</p>)}</details>}{!validAmount?<p role="alert">Enter a positive amount with at most two decimal places.</p>:quote.key!==quoteKey?<LoadingIndicator message="Checking payment allocation…"/>:quote.error?<p role="alert">{quote.error}<button type="button" className="btn-secondary min-h-11 mt-2" onClick={()=>setQuoteRevision(n=>n+1)}>Retry preview</button></p>:<><ol className="max-h-40 overflow-y-auto space-y-2 mt-2">{quote.data?.allocations.map(a=><li key={a.scheduleId}>Day {a.dayNumber} · Due {businessDate(a.dueDate)}: ₹{a.amount.toLocaleString('en-IN',{minimumFractionDigits:2})} allocated · ₹{a.remainingAfter.toLocaleString('en-IN',{minimumFractionDigits:2})} remaining</li>)}</ol><p className="mt-2 font-semibold">Total received: ₹{quote.data?.amount.toLocaleString('en-IN')}</p>{quote.data?.nextInstallment&&<p>Next unpaid installment: Day {quote.data.nextInstallment.dayNumber} · ₹{quote.data.nextInstallment.remainingAmount.toLocaleString('en-IN')} remaining</p>}<p className="text-xs mt-2">{quote.data?.policy}</p></>}</section>}

            <div>
              <label htmlFor="payment-mode" className="block text-sm font-medium text-gray-700">Payment Mode</label>
              <select
                id="payment-mode"
                disabled={loading}
                value={paymentMode}
                onChange={(e) => { setPaymentMode(e.target.value); setAccountId(''); }}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            {accountError && <p role="alert" className="text-sm text-red-700">{accountError}</p>}
            {paymentMode !== 'CASH' && <>
              <label className="block text-sm font-medium">Actual receiving account<select required className="input-field mt-1" value={accountId} disabled={loading} onChange={event => setAccountId(event.target.value)}><option value="">Select destination</option>{accounts.filter(account => account.modes.includes(paymentMode)).map(account => <option key={account._id} value={account._id}>{account.owner === 'COMPANY' ? 'Company direct' : 'Employee received'} · {account.label} {account.maskedDetails}</option>)}</select></label>
              <label className="block text-sm font-medium">UPI transaction ID / bank reference<input required minLength={3} maxLength={100} className="input-field mt-1" value={reference} disabled={loading} onChange={event => setReference(event.target.value)} /></label>
              <p className="text-xs text-gray-600">Company-direct payments await Admin bank verification. Employee-received digital funds must be remitted through Daily Settlement.</p>
            </>}

            <div>
              <label htmlFor="payment-remarks" className="block text-sm font-medium text-gray-700">Remarks / Reason (if missed)</label>
              <input
                id="payment-remarks"
                disabled={loading}
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                placeholder="e.g. Customer not home"
              />
            </div>

            <label className="rp-check"><input type="checkbox" required disabled={!quoteReady||loading} checked={confirmedKey===confirmationKey} onChange={e=>setConfirmedKey(e.target.checked?confirmationKey:'')} className="mt-1 shrink-0"/><span>I confirm the received amount, payment date and allocation preview above.</span></label>
          </form>
        </div>
        <footer className="rp-footer">{unconfirmed&&<div className="royal-recovery" role="alert">The previous entry has an unconfirmed result. Recording again is blocked.<LoadingButton busy={loading} loadingText="Checking payment history…" disabled={loading} type="button" onClick={recheckPayment}>Check payment status</LoadingButton></div>}
              {!schedule.recovery&&<LoadingButton busy={loading} loadingText="Recording missed installment…"
                type="button"
                onClick={handleMissed}
                disabled={loading || unconfirmed || schedule.collectionLocked || schedule.canCollect===false || (schedule.dueDate && businessDay(schedule.dueDate)>businessDay())}
                className="inline-flex justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
              >
                Mark Missed
              </LoadingButton>}
              <div className="rp-footer-buttons">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                >
                  Cancel
                </button>
                <LoadingButton busy={loading} loadingText="Recording payment…"
                  type="submit"
                  disabled={loading||!quoteReady||confirmedKey!==confirmationKey}
                  form={paymentFormId}
                  className="btn-primary"
                >
                  {loading ? 'Saving payment…' : 'Record Payment'}
                </LoadingButton>
              </div>
        </footer>
      </div>
    </div>
  );
}
