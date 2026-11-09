import LoadingIndicator from "../../components/ui/Loading";
import AdminCollections from '../../components/collections/AdminCollections';
import RecoveryCollections from '../../components/collections/RecoveryCollections';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import PaymentReviewModal from '../../components/collections/PaymentReviewModal';
import CustomerPaid from '../../components/collections/CustomerPaid';
import InstallmentActions from '../../components/collections/InstallmentActions';
import RecordPaymentModal from '../../components/collections/RecordPaymentModal';
import { businessDate } from '../../utils/businessDate';
import {useCollectionRefresh} from '../../hooks/useCollectionRefresh';

const filters = [['TODAY','Today'],['OVERDUE','Overdue'],['UPCOMING','Upcoming'],['ALL','All Installments']];
const money = amount => Number(amount||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const badge = row => <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${row.remainingAmount>0?(row.overdue?'bg-red-100 text-red-900':'bg-amber-100 text-amber-900'):'bg-green-100 text-green-900'}`}>{row.statusLabel || row.status}{row.displayStatus==='PARTIAL'&&row.overdue?' · Overdue':''}</span>;

export default function TodayCollections({isAdmin=false}) {return isAdmin?<AdminCollections/>:<EmployeeCollections/>;}
function EmployeeCollections({isAdmin=false}) {
  const [collections,setCollections]=useState([]);const [meta,setMeta]=useState({total:0,totalPages:0}),[remaining,setRemaining]=useState(0),[debounced,setDebounced]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState(null);
  const [reviewRow,setReviewRow]=useState(null),[notice,setNotice]=useState('');
  const [historyRow,setHistoryRow]=useState(null);
  const [scope,setScope]=useState(()=>{const s=new URLSearchParams(window.location.search).get('scope');return filters.some(([key])=>key===s)?s:'TODAY';});
  const [search,setSearch]=useState(()=>new URLSearchParams(window.location.search).get('loan')||'');
  const [refresh,setRefresh]=useCollectionRefresh(isAdmin?'ADMIN':'EMPLOYEE');
  const [page,setPage]=useState(1);
  const [loadedKey,setLoadedKey]=useState(null);
  const queryKey=`${scope}:${page}:${debounced}`;
  const navigate=useNavigate();
  const portal=isAdmin?'admin':'employee';
  useEffect(()=>{const timer=setTimeout(()=>setDebounced(search),350);return()=>clearTimeout(timer);},[search]);
  useEffect(()=>{
    if(!isAdmin&&['TODAY','OVERDUE'].includes(scope))return;
    const controller=new AbortController();setLoading(true);setError('');
    api.get('/collections/installments',{params:{scope,page,limit:50,search:debounced},signal:controller.signal}).then(res=>{setCollections(res.data.data.rows);setMeta(res.data.data.meta);setRemaining(res.data.data.remainingAmount);setLoadedKey(queryKey);}).catch(err=>{if(err.code!=='ERR_CANCELED')setError(err.response?.data?.message||'Unable to load installments. Please retry.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[scope,refresh,page,debounced,queryKey]);
  const rows=collections;
  const shownRows=collections;
  const actions=row=><InstallmentActions row={row} isAdmin={isAdmin} onHistory={setHistoryRow} onReview={setReviewRow} onCollect={setSelected} onAwaiting={()=>setNotice('Employee has not recorded this payment yet.')} />;
  if(!isAdmin&&['TODAY','OVERDUE'].includes(scope))return <RecoveryCollections key={scope} revision={refresh} initialFilter={scope==='OVERDUE'?'OVERDUE':'ALL'} onScope={setScope}/>;
  return <div className="max-w-7xl mx-auto space-y-5" aria-busy={loading}>
    <header><h1 className="text-2xl font-bold">Collections &amp; Installments</h1><p className="text-sm text-gray-600 mt-2">{isAdmin?'Review employee-recorded receipts separately from company settlements.':'View due dates and record actual receipts, including advance or backdated payments.'} All business dates use Asia/Kolkata.</p></header>
    <label className="block text-sm font-medium">Collection list<select className="input-field mt-2" value={scope} onChange={e=>{setScope(e.target.value);setPage(1);}}>{filters.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label className="block text-sm font-medium">Find a customer or loan<input className="input-field mt-2" type="search" placeholder="Name, customer code or loan number" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} /></label>
    {notice&&<div role="status" className="rounded-xl border border-amber-600/40 bg-[#191711] text-amber-100 p-4 flex justify-between gap-3">{notice}<button onClick={()=>setNotice('')} className="min-h-11 px-3">Dismiss</button></div>}
    {error?<div role="alert" className="p-4 bg-red-50 rounded-xl text-red-800">{error}<button className="btn-secondary mt-3" onClick={()=>setRefresh(n=>n+1)}>Retry</button></div>:loadedKey!==queryKey?<LoadingIndicator message={"Loading installments…"}/>:<>
      <div className="p-5 bg-[#191711] text-white rounded-xl"><p>Unpaid balance in this list</p><p className="text-3xl font-bold mt-2">₹{money(remaining)}</p><p className="text-sm text-amber-100 mt-2">{meta.total} installments · Paid installments remain visible in Today, Upcoming and All Installments.</p></div>
      <div className="md:hidden space-y-4">{shownRows.map(row=><article key={row._id} className="bg-white border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2 justify-between"><h2 className="font-semibold">{row.customerName}</h2>{badge(row)}</div>
        <p className="text-sm text-gray-600">{row.customerCode} · {row.loanNumber} · Day {row.dayNumber}</p><p className="font-medium">Due: {businessDate(row.dueDate)}</p>
        <dl className="grid grid-cols-2 gap-3"><div><dt className="text-sm text-gray-500">Installment</dt><dd>₹{money(row.amount)}</dd></div><div><dt className="text-sm text-gray-500">Customer Paid</dt><dd><CustomerPaid row={row}/></dd></div></dl>
        <p className="text-sm">Remaining: ₹{money(Math.max(0,row.amount-row.paidAmount))}</p>{row.paidDate&&<p className="text-sm text-gray-600">Latest received: {businessDate(row.paidDate)}</p>}{actions(row)}
      </article>)}</div>
      <div className="hidden md:block bg-white border rounded-xl overflow-hidden"><div className="overflow-x-auto" role="region" aria-label="Installment collections" tabIndex={0}><table className="min-w-full text-sm"><thead className="bg-gray-50"><tr>{['Customer / loan','Due date','Installment','Customer Paid','Remaining','Status','Actions'].map(label=><th key={label} className="text-left p-4 whitespace-nowrap">{label}</th>)}</tr></thead><tbody>{shownRows.map(row=><tr key={row._id} className="border-t"><td className="p-4"><strong>{row.customerName}</strong><p>{row.loanNumber} · Day {row.dayNumber}</p></td><td className="p-4 whitespace-nowrap">{businessDate(row.dueDate)}{row.paidDate&&<p className="text-xs text-gray-500">Received: {businessDate(row.paidDate)}</p>}</td><td className="p-4">₹{money(row.amount)}</td><td className="p-4"><CustomerPaid row={row}/></td><td className="p-4">₹{money(Math.max(0,row.amount-row.paidAmount))}</td><td className="p-4">{badge(row)}</td><td className="p-4">{actions(row)}</td></tr>)}</tbody></table></div></div>
      {meta.totalPages>1&&<div className="flex flex-wrap items-center gap-3"><button className="btn-secondary min-h-11" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {meta.totalPages}</span><button className="btn-secondary min-h-11" disabled={page>=meta.totalPages} onClick={()=>setPage(p=>p+1)}>Next</button></div>}
      {!rows.length&&<p className="p-5 bg-white border rounded-xl">No installments match this list.</p>}
    </>}
    {reviewRow&&<PaymentReviewModal key={reviewRow._id} row={reviewRow} onClose={()=>setReviewRow(null)} onChange={()=>setRefresh(n=>n+1)} />}
    {historyRow&&<PaymentReviewModal key={'history-'+historyRow._id} row={historyRow} mode="history" portal={portal} onClose={()=>setHistoryRow(null)} />}
    {!isAdmin&&<RecordPaymentModal key={selected?._id||'closed'} isOpen={!!selected} onClose={()=>setSelected(null)} schedule={collections.find(row=>row._id===selected?._id)||selected} isAdmin={isAdmin} onSuccess={receipt=>{setSelected(null);setRefresh(n=>n+1);if(receipt?._id)navigate(`/${portal}/collections/receipt/${receipt._id}`);}} />}
  </div>;
}
