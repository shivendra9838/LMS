import LoadingIndicator from "../../components/ui/Loading";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {CheckCircle2,ExternalLink} from 'lucide-react';
import './missed-payments.css';
import { businessDate } from '../../utils/businessDate';

export default function MissedPayments() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,setError]=useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);setError('');
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.data);
    } catch (error) {
      setError('Unable to load overdue payments. Please retry.');
      toast.error('Failed to load missed payments notifications');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingIndicator message={"Loading missed payments…"} className="mp-page mp-state"/>;

  return <div className="mp-page">
    <header className="mp-heading"><h1>Missed Payments</h1><p>Unpaid overdue installments, including matured loans. Derived from actual balances in Asia/Kolkata.</p></header>
    {error?<div role="alert" className="mp-state mp-error"><p>{error}</p><button className="btn-secondary" onClick={fetchNotifications}>Retry overdue payments</button></div>:<MissedPaymentResults notifications={notifications} onViewLoan={id=>navigate(`/admin/loans/${id}`)}/>}
  </div>;
}

const dueAmount=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'Not available':Number(value).toLocaleString('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2});
function PaymentDate({notification}){return <><time dateTime={notification.dueDate||notification.createdAt}>{businessDate(notification.dueDate||notification.createdAt)}</time><small>{notification.dueDate?'Original installment due date':new Date(notification.createdAt).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'})}</small></>;}
function LoanAction({notification,onViewLoan}){return <button type="button" className="mp-view-loan" disabled={!notification.loanId} onClick={()=>onViewLoan(notification.loanId)}><ExternalLink size={15} aria-hidden="true"/>View Loan</button>;}
function PaymentStatus(){return <span className="mp-status">UNRESOLVED</span>;}

export function MissedPaymentResults({notifications,onViewLoan}){
 if(!notifications.length)return <div className="mp-state mp-empty" role="status"><CheckCircle2 size={32} aria-hidden="true"/><h2>No Missed Payments</h2><p>All collections are on track right now.</p></div>;
 return <>
  <div className="mp-table-wrap"><table className="mp-table" aria-label="Missed payments"><thead><tr><th scope="col">Date &amp; Time</th><th scope="col">Message</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>{notifications.map(notification=><tr key={notification._id}>
   <td><PaymentDate notification={notification}/></td><td><strong>{notification.title}</strong><p>{notification.message}</p></td><td><PaymentStatus/></td><td><LoanAction notification={notification} onViewLoan={onViewLoan}/></td>
  </tr>)}</tbody></table></div>
  <div className="mp-cards" role="list" aria-label="Missed payment cards">{notifications.map(notification=><article className="mp-card" key={notification._id} role="listitem">
   <header><div><span className="mp-label">Date</span><PaymentDate notification={notification}/></div><PaymentStatus/></header>
   <dl><div><dt>Loan ID</dt><dd>{notification.loanNumber||'Not available'}{notification.dayNumber&&<small>Installment {notification.dayNumber}</small>}</dd></div><div><dt>Customer</dt><dd>{notification.customerName||'Not available'}</dd></div><div><dt>Due Amount</dt><dd className="mp-amount">{dueAmount(notification.remainingAmount)}</dd></div><div><dt>Employee</dt><dd>{notification.employeeName||'Assignment requires review'}</dd></div></dl>
   {notification.type==='GENERAL'&&<p className="mp-general">{notification.title}<br/>{notification.message}</p>}
   <LoanAction notification={notification} onViewLoan={onViewLoan}/>
  </article>)}</div>
 </>;
}
