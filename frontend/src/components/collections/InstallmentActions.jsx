import {Link} from 'react-router-dom';
import {CheckCircle2,LockKeyhole} from 'lucide-react';
export default function InstallmentActions({row,isAdmin,onHistory,onReview,onCollect,onAwaiting,compact=false}) {
 const locked=row.collectionLocked===true;
 const lock=locked&&(compact?<details className="aci-lock"><summary><LockKeyhole size={14}/>Locked</summary><p>{row.collectionLockReason}</p></details>:<div className="max-w-[18rem] min-w-0"><button type="button" disabled className="btn-secondary min-h-11 cursor-not-allowed" title={row.collectionLockReason}>Locked</button><p className="mt-1 text-xs text-gray-500 break-words">{row.collectionLockReason}</p></div>);
 return <div className="flex flex-wrap gap-2 min-w-0">
  {row.hasPaymentHistory===true&&<button className="btn-secondary min-h-11" onClick={()=>onHistory(row)}>History</button>}
  {lock}{locked&&!isAdmin&&<Link className="btn-primary min-h-11" to={'/employee/collections/today?loan='+encodeURIComponent(row.loanNumber||'')}>Collect Outstanding Dues</Link>}
  {isAdmin?row.customerPaymentReview?.status==='VERIFIED'?<span className="inline-flex items-center gap-2 min-h-11 px-3 text-sm font-semibold text-emerald-600"><CheckCircle2 size={17} aria-hidden="true"/>Verified</span>:(!locked||row.hasPaymentHistory===true||compact)&&<button className={row.customerPaymentReview?.status==='AWAITING_EMPLOYEE_COLLECTION'?'min-h-11 px-3 rounded-lg border border-amber-700/40 text-gray-400 bg-black/10':'btn-primary min-h-11'} onClick={()=>{if(!['PENDING_REVIEW','REQUIRES_HISTORY_REVIEW'].includes(row.customerPaymentReview?.status)){onAwaiting();return;}onReview(row);}}>{row.customerPaymentReview?.status==='PENDING_REVIEW'?'Verify Payment':row.customerPaymentReview?.status==='REQUIRES_HISTORY_REVIEW'?'Review Payment History':'Awaiting Employee Collection'}</button>:!locked&&row.canCollect&&<button className="btn-primary min-h-11" onClick={()=>onCollect(row)}>Collect Payment</button>}
 </div>;
}
