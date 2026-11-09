import LoadingIndicator from "../../components/ui/Loading";
import {useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {IndianRupee,Users,Wallet,CalendarDays,CheckCircle2,RefreshCw,TriangleAlert,Building2} from 'lucide-react';
import {useAccount} from '../../layouts/PortalShell';
import {useCollectionRead,useCollectionRefresh} from '../../hooks/useCollectionRefresh';
import {useNotificationFeed,useNotificationActions} from '../../hooks/useNotifications';
import {businessDay} from '../../utils/businessDate';
import RecordPaymentModal from '../../components/collections/RecordPaymentModal';
import PaymentReviewModal from '../../components/collections/PaymentReviewModal';
import {DashboardKpiCard,DashboardDatePicker,CollectionProgressTimeline,CollectionTrendChart,CustomerCollectionTable,RecentActivitiesPanel,PaymentTracking,DashboardMessage} from '../../components/dashboard/EmployeeWorkspace';
import {currency,receiptPercent} from '../../components/dashboard/employeePresentation';
import {TargetBreakdownDialog,InstallmentLedgerDialog} from '../../components/dashboard/FinancialBreakdown';
import '../../components/dashboard/dashboard.css';
import '../../components/dashboard/employee-workspace.css';
import '../../components/dashboard/employee-mobile.css';

export function EmployeeDashboardSummary({data,today,loading,onBreakdown}){
 const collectedPercent=data.openingCollectible===null?null:receiptPercent(data.collected,data.openingCollectible);
 return (<div className="ew-kpis" aria-busy={loading}>
    <DashboardKpiCard label={today?'Today’s Target':'Target at Date'} value={data.openingCollectible===null?'Unavailable':currency(data.openingCollectible)} Icon={IndianRupee} tone="green" hint="Including previous overdue and today's dues" onClick={onBreakdown}/>
    <DashboardKpiCard label={today?'Collected Today':'Collected on Date'} value={currency(data.collected)} Icon={Wallet} tone="blue" progress={data.openingCollectible===null?null:collectedPercent} progressLabel="Actual receipts / opening collectible" green hint={data.advanceAllocatedOnDate>0?`${currency(data.advanceAllocatedOnDate)} allocated early`:'Actual customer receipts · received date'} />
    <DashboardKpiCard label={today?'Remaining Today':'Remaining at Date'} value={data.collectibleBalanceKnown===false?'Unavailable':currency(data.remainingCollectible)} Icon={CalendarDays} tone="amber" onClick={onBreakdown} hint={!data.remainingCollectible?<><CheckCircle2 size={14}/> No outstanding dues</>:<><TriangleAlert size={14}/> Overdue + unpaid dues on date</>}/>
    <DashboardKpiCard label="Active Customers" value={data.activeCustomers.toLocaleString('en-IN')} Icon={Users} tone="purple" hint={`${data.assignedCustomers} assigned · ${data.dueCustomerCount} due · ${data.overdueCustomerCount} overdue`} to="/employee/customers"/>
   </div>);
}

export default function EmployeeDashboard(){
 const {account}=useAccount()||{},navigate=useNavigate();
 const [date,setDate]=useState(businessDay),[revision,refresh]=useCollectionRefresh('EMPLOYEE');
 const [filter,setFilter]=useState('ALL'),[search,setSearch]=useState(''),[debounced,setDebounced]=useState(''),[page,setPage]=useState(1),[loan,setLoan]=useState(''),[tab,setTab]=useState('targets'),[paymentPage,setPaymentPage]=useState(1),[activityPage,setActivityPage]=useState(1),[selected,setSelected]=useState(null),[history,setHistory]=useState(null),[inspected,setInspected]=useState(null),[targetBreakdown,setTargetBreakdown]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>{setDebounced(search);setPage(1);},300);return()=>clearTimeout(timer);},[search]);
 const query=new URLSearchParams({date,filter,search:debounced,page:String(page),limit:'5',...(loan?{loanId:loan}:{})});
 const state=useCollectionRead('/dashboard/employee-workspace?'+query,revision),data=state.data?.data||state.data;
 const payments=useCollectionRead(tab==='payments'?'/collections/tracking?'+new URLSearchParams({date,page:String(paymentPage),limit:'5'}):null,revision);
 const feed=useNotificationFeed('EMPLOYEE',{limit:6,page:activityPage}),actions=useNotificationActions('EMPLOYEE');
 const today=date===businessDay();
 function changeDate(value){setDate(value);setPage(1);setPaymentPage(1);}
 function changeTab(value,event){setTab(value);if(window.matchMedia('(max-width:767px)').matches)event.currentTarget.closest('.ew-collections')?.scrollIntoView({block:'start',behavior:'auto'});}
 return <div className="ew-page">
  <header className="ew-welcome"><div><h1>Welcome back{account?.profile?.name?', '+account.profile.name:''} <span aria-hidden="true">👋</span></h1><p>Here’s your collection progress and upcoming targets.</p></div><div className="ew-welcome-actions"><DashboardDatePicker date={date} onChange={changeDate}/><Link className="ew-button ew-gold" to="/employee/collections/today"><IndianRupee size={18}/>Collect Payment</Link><button className="ew-icon-button" aria-label="Refresh dashboard" onClick={()=>{refresh(n=>n+1);feed.refresh();}}><RefreshCw size={17}/></button></div></header>
  {state.error&&<DashboardMessage error={state.error} retry={()=>refresh(n=>n+1)}/>}
  {!data&&state.loading&&<LoadingIndicator message={"Loading your collection dashboard…"} className="ew-skeleton"/>}
  {data&&<>
   <EmployeeDashboardSummary data={data} today={today} loading={state.loading} onBreakdown={()=>setTargetBreakdown(true)}/>
   {data.openingCollectible===null&&<DashboardMessage error="Opening collectible cannot be reconstructed from incomplete legacy payment dates. Check original receipts; no opening balance has been invented."/>}{data.reconciliationIssues>0&&<DashboardMessage error="Some stored balances disagree with valid receipt history. Admin reconciliation is required; no historical records were changed."/>}{data.unmappedReceivedOnDate>0&&<DashboardMessage error={currency(data.unmappedReceivedOnDate)+' of receipts has no explicit allocation mapping. Review original history; no missing allocation has been invented.'}/>}<div className="ew-upper-grid"><CollectionProgressTimeline data={data} date={date} onLoan={setLoan} onInspect={setInspected}/><CollectionTrendChart rows={data.trend} date={date}/></div>
   <div className="ew-lower-grid"><section className="ew-collections" aria-label="Collections workspace">
    <div className="ew-tabs" role="group" aria-label="Dashboard views">{[['targets','Targets & Customers'],['payments','Payment Tracking'],['activity','Recent Activities']].map(([key,label])=><button key={key} aria-pressed={tab===key} onClick={event=>changeTab(key,event)}>{label}</button>)}</div>
    <div className="ew-panel ew-table-panel">
     {tab==='targets'&&<CustomerCollectionTable data={data} search={search} onSearch={setSearch} filter={filter} onFilter={value=>{setFilter(value);setPage(1);}} onPage={setPage} onCollect={setSelected} onHistory={setHistory} onInspect={setInspected}/>}
     {tab==='payments'&&<PaymentTracking state={payments} onPage={setPaymentPage} retry={()=>refresh(n=>n+1)}/>}
     {tab==='activity'&&<RecentActivitiesPanel feed={feed} actions={actions} embedded onPage={setActivityPage}/>}
    </div>
   </section></div>
   <footer className="ew-dashboard-footer"><Link to="/employee/collections/today?scope=OVERDUE"><TriangleAlert size={15}/>Overdue: {currency(data.overdueAmount)}</Link><Link to="/employee/follow-ups">Overdue follow-ups</Link><Link to="/employee/loans">My loans</Link><Link to="/employee/customers/add">Add customer KYC</Link><Link to="/employee/settlements"><Building2 size={15}/>Daily settlement</Link><p>Asia/Kolkata · Target is opening overdue + date-due collectible; remaining uses valid allocations. Receipts use the actual date received. Payment review and company settlement remain separate.</p>{data.unattributedHistoricalAmount>0&&<p role="status">Historical allocation dates are unavailable for {currency(data.unattributedHistoricalAmount)}. Remaining amounts are an upper bound; check original receipts.</p>}</footer>
  </>}
  {targetBreakdown&&data&&<TargetBreakdownDialog data={data} onClose={()=>setTargetBreakdown(false)}/>}
  {inspected&&<InstallmentLedgerDialog row={data?.timeline.find(r=>r._id===inspected._id)||data?.rows.find(r=>r._id===inspected._id)||inspected} date={date} onClose={()=>setInspected(null)}/>}
  {history&&<PaymentReviewModal key={history._id} row={history} mode="history" portal="employee" onClose={()=>setHistory(null)}/>}
  {selected&&<RecordPaymentModal key={selected.currentSchedule._id} isOpen schedule={selected.currentSchedule} customerCollection={selected} onLoanChange={loan=>setSelected({...selected,currentSchedule:loan.currentSchedule})} onClose={()=>setSelected(null)} onSuccess={receipt=>{setSelected(null);refresh(n=>n+1);feed.refresh();if(receipt?._id)navigate('/employee/collections/receipt/'+receipt._id);}}/>}
 </div>;
}



