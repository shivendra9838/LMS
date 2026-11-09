import {LoadingButton} from "../../components/ui/Loading";
import CustomerProfileHeader from '../../components/customers/CustomerProfileHeader';
import {useEffect,useRef,useState} from 'react';
import {Link,useParams,useSearchParams} from 'react-router-dom';
import {ArrowLeft,ArrowLeftRight,Pencil,Plus,Power,Users,LayoutGrid,UserRound,ShieldCheck,Wallet,CalendarDays,ReceiptText,AlertTriangle,History} from 'lucide-react';
import {createPortal} from 'react-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PaymentReviewModal from '../../components/collections/PaymentReviewModal';
import {ConfirmDialog} from '../../components/ui/Primitives';
import {useRead,Breadcrumbs,Pager,LoadState,Select} from '../../components/portfolios/PortfolioUi';
import {useCollectionRead,useCollectionRefresh} from '../../hooks/useCollectionRefresh';
import {customerDetailTabs as tabs,detailTab,customerDetailQuery,formatCustomerMoney as money} from '../../components/customers/customerDetailPresentation';
import {CustomerOverview,CustomerPersonal,CustomerKycSummary,CustomerLoans,CustomerInstallments,CustomerPayments,CustomerTimeline,DetailMetric} from '../../components/customers/CustomerDetailSections';
const tabIcons={overview:LayoutGrid,personal:UserRound,kyc:ShieldCheck,loans:Wallet,installments:CalendarDays,payments:ReceiptText,overdue:AlertTriangle,history:History};
export function CustomerDetailNavigation({tab,onChange}){return <><label className="acd-mobile-tabs">Customer section<select value={tab} onChange={event=>onChange(event.target.value)}>{tabs.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><nav className="acd-tabs" aria-label="Customer detail sections">{tabs.map(([key,label])=>{const Icon=tabIcons[key];return <button key={key} className={tab===key?'is-active':''} aria-pressed={tab===key} onClick={()=>onChange(key)}><Icon size={16}/>{label}</button>;})}</nav></>;}
export default function CustomerDetails(){
 const {id}=useParams(),[params,setParams]=useSearchParams(),tab=detailTab(params.get('tab')),page=Math.max(1,Number(params.get('page'))||1),scope=['ALL','TODAY','OVERDUE','UPCOMING','PAID','ADVANCE'].includes(params.get('scope'))?params.get('scope'):tab==='overdue'?'OVERDUE':'ALL';
 const [revision,setRevision]=useCollectionRefresh('ADMIN'),[statusBusy,setStatusBusy]=useState(false),[confirmStatus,setConfirmStatus]=useState(false),statusLock=useRef(false),assignmentLock=useRef(false);
 const profile=useCollectionRead(`/customer-portfolios/customers/${id}`,revision),customer=profile.data?.data;
 const endpoint=tab==='personal'?`/customers/${id}`:['loans','payments','history'].includes(tab)?`/customer-portfolios/customers/${id}/${tab}?page=${page}&limit=20`:['installments','overdue'].includes(tab)?`/customer-portfolios/customers/${id}/installments?page=${page}&limit=20&scope=${scope}`:null;
 const resource=useCollectionRead(endpoint,revision),[showAssignment,setShowAssignment]=useState(false),[employeeSearch,setEmployeeSearch]=useState(''),[debounced,setDebounced]=useState(''),[employeeId,setEmployeeId]=useState(''),[reason,setReason]=useState(''),[saving,setSaving]=useState(false),[historyRow,setHistoryRow]=useState(null);
 useEffect(()=>{const timer=setTimeout(()=>setDebounced(employeeSearch),350);return()=>clearTimeout(timer);},[employeeSearch]);
 const options=useRead(showAssignment?`/customer-portfolios/employees/options?limit=20&search=${encodeURIComponent(debounced)}`:null,revision);
 const setQuery=(key,value)=>setParams(previous=>{const next=new URLSearchParams(previous);next.set(key,String(value));if(key!=='page')next.delete('page');return next;});
 const toggleStatus=async()=>{if(statusLock.current)return;statusLock.current=true;setStatusBusy(true);try{await api.patch(`/customers/${id}/status`,{status:customer.status==='ACTIVE'?'INACTIVE':'ACTIVE'});toast.success('Customer status updated');setConfirmStatus(false);setRevision(n=>n+1);}catch(error){toast.error(error.response?.data?.message||'Unable to update customer status');}finally{statusLock.current=false;setStatusBusy(false);}};
 const changeTab=key=>{setHistoryRow(null);setParams(previous=>customerDetailQuery(previous,key));};
 const assign=async event=>{event.preventDefault();if(assignmentLock.current)return;assignmentLock.current=true;setSaving(true);try{await api.patch(`/customer-portfolios/customers/${id}/assignment`,{employeeId,previousEmployeeId:customer.assignedEmployeeId||null,reason});toast.success('Customer profile assignment updated and audited');setShowAssignment(false);setReason('');setEmployeeId('');setRevision(n=>n+1);}catch(error){toast.error(error.response?.data?.message||'Reassignment failed');}finally{assignmentLock.current=false;setSaving(false);}};
 if(profile.loading&&!customer)return <div className="acd-page"><LoadState loading/></div>;
 if(profile.error)return <div className="acd-page"><LoadState error={profile.error} retry={()=>setRevision(n=>n+1)}/><Link className="acd-button" to="/admin/customers">Back to Customers</Link></div>;
 if(!customer)return null;
 const portfolio=customer.employee?`/admin/customers/employees/${customer.employee._id}`:'/admin/customers/unassigned',edit=`/admin/customers/${id}/${customer.kycLeadId?'kyc':'edit'}`,rows=resource.data?.rows||[],activeLabel=tabs.find(([key])=>key===tab)[1];
 return <div className="acd-page customer-profile-page customer-profile-admin">
  <Breadcrumbs items={[["Customers",'/admin/customers'],[customer.employee?.name||'Unassigned Customers',portfolio],[customer.name]]}/>
  <div className="acd-back-links"><Link to="/admin/customers"><ArrowLeft size={16}/>Back to Employees</Link><Link to={portfolio}><Users size={16}/>Back to assigned customer portfolio</Link></div>
  <CustomerProfileHeader customer={customer} employee={customer.employee} employeeLink={portfolio} onRefresh={()=>setRevision(n=>n+1)} actions={<><Link className="acd-button" to={edit}><Pencil size={16}/>Edit Profile</Link><LoadingButton busy={statusBusy} loadingText="Updating customer status…" className="acd-button" disabled={statusBusy} onClick={()=>setConfirmStatus(true)}><Power size={16}/>{statusBusy?'Updating…':customer.status==='ACTIVE'?'Deactivate Customer':'Activate Customer'}</LoadingButton><button className="acd-button" onClick={()=>setShowAssignment(v=>!v)} aria-expanded={showAssignment}><ArrowLeftRight size={16}/>Reassign Customer</button>{customer.status==='ACTIVE'&&<Link className="acd-button acd-primary" to={`/admin/customers/${id}/loans/new`}><Plus size={17}/>Issue Loan</Link>}</>}/>
  {showAssignment&&<form onSubmit={assign} className="acd-panel acd-reassignment"><h2><ArrowLeftRight size={19}/>Controlled customer reassignment</h2><p>Previous employee: {customer.employee?`${customer.employee.name} (${customer.employee.employeeCode})`:'Unassigned / former employee unavailable'}. Effective timestamp is recorded when saved.</p><p className="acd-note">This changes customer-profile and KYC access. Existing loans keep their servicing employee and original issuer. Payment collectors, receipts and custody are not moved.</p><fieldset disabled={saving} className="acd-form-grid"><label>Find active employee<input type="search" value={employeeSearch} maxLength={100} onChange={e=>{setEmployeeSearch(e.target.value);setEmployeeId('');}} placeholder="Start of name, code or mobile"/></label><label>New employee<select required value={employeeId} onChange={e=>setEmployeeId(e.target.value)}><option value="">Choose active employee</option>{options.data?.rows.filter(e=>e._id!==customer.assignedEmployeeId).map(e=><option key={e._id} value={e._id}>{e.name} ({e.employeeCode})</option>)}</select></label><label className="acd-form-wide">Reason for reassignment<textarea required minLength={5} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label></fieldset><LoadState loading={options.loading} error={options.error} retry={()=>setRevision(n=>n+1)}/>{!options.loading&&!options.error&&options.data&&!options.data.rows.some(employee=>employee._id!==customer.assignedEmployeeId)&&<p className="acd-muted">No other active employee matches this search.</p>}<div className="acd-actions"><LoadingButton busy={saving} loadingText={"Saving…"} className="acd-button acd-primary" disabled={saving||!employeeId||options.loading}>{saving?'Saving…':'Confirm Reassignment'}</LoadingButton><button type="button" className="acd-button" disabled={saving} onClick={()=>setShowAssignment(false)}>Cancel</button></div></form>}
  {tab==='overview'&&<CustomerOverview customer={customer}/>}
  <CustomerDetailNavigation tab={tab} onChange={changeTab}/>
  <section className="acd-tab-content" aria-label={activeLabel}>
  {tab==='kyc'&&<CustomerKycSummary customer={customer}/>}
  {endpoint&&<><LoadState loading={resource.loading&&!resource.data} error={resource.error} retry={()=>setRevision(n=>n+1)}/>
   {['installments','overdue'].includes(tab)&&<><div className="acd-section-heading"><div><h2>{activeLabel}</h2><p>Due dates and actual receipt dates are shown separately. Existing collection sequence applies.</p>{scope==='ADVANCE'&&<p>A row may contain an early allocation and a later receipt. Open Installment History to see the exact allocation dates.</p>}</div><Select label="Installment view" value={scope} onChange={v=>setQuery('scope',v)}><option value="ALL">All installments</option><option value="TODAY">Today</option><option value="OVERDUE">Unpaid overdue</option><option value="PAID">Paid installments</option><option value="UPCOMING">Upcoming & advance payments</option><option value="ADVANCE">Received before due date</option></Select></div>{tab==='overdue'&&<div className="acd-metrics acd-three"><DetailMetric label="Total overdue amount" value={money(customer.overdueAmount)} Icon={AlertTriangle} tone="red"/><DetailMetric label="Overdue installments" value={customer.overdueInstallments} Icon={CalendarDays}/><DetailMetric label="Remaining in selected view" value={resource.data?money(resource.data.remainingAmount):'Loading…'} Icon={Wallet}/></div>}</>}
   {!resource.error&&resource.data&&<>
    {tab==='personal'&&<CustomerPersonal customer={resource.data.data} edit={edit}/>}
    {tab==='loans'&&<CustomerLoans rows={rows}/>}
    {['installments','overdue'].includes(tab)&&<CustomerInstallments rows={rows} openHistory={setHistoryRow}/>}
    {tab==='payments'&&<CustomerPayments rows={rows}/>}
    {tab==='history'&&<CustomerTimeline rows={rows}/>}
    {resource.data.rows?.length===0&&<div className="acd-empty">No records match this section.</div>}
    {resource.data.meta&&<Pager meta={resource.data.meta} change={(_,value)=>setQuery('page',value)}/>}
   </>}
  </>}
  </section>
  {historyRow&&createPortal(<PaymentReviewModal row={historyRow} mode="history" portal="admin" onClose={()=>setHistoryRow(null)}/>,document.body)}
  {confirmStatus&&<ConfirmDialog title={customer.status==='ACTIVE'?'Deactivate customer?':'Activate customer?'} busy={statusBusy} confirmLabel={customer.status==='ACTIVE'?'Deactivate Customer':'Activate Customer'} onClose={()=>setConfirmStatus(false)} onConfirm={toggleStatus}><p>Update this customer’s status through the existing workflow. Saved loan, payment and audit history is retained.</p></ConfirmDialog>}
 </div>;
}
