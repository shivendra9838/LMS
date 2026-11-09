import LoadingIndicator from "./ui/Loading";
import {useEffect,useLayoutEffect,useState} from 'react';
import {Link,useParams,useSearchParams} from 'react-router-dom';
import {ArrowLeft,Bell,CalendarDays,Wallet} from 'lucide-react';
import {activityTime} from './LoanTimeline';
import {useCollectionRefresh,useCollectionRead} from '../hooks/useCollectionRefresh';
import {money} from './portfolios/PortfolioUi';
import {LoanStatus} from './loans/LoanUi';
import LoanTabPanel from './loans/LoanTabPanel';
import {LOAN_TABS,resolveLoanTab} from '../utils/loanTabs';
import {businessDate} from '../utils/businessDate';
import './loans/loans.css';
export default function LoanDetailsView({isAdmin}){
 const {id}=useParams(),[params,setParams]=useSearchParams(),portal=isAdmin?'admin':'employee',tab=params.get('tab'),activeTab=resolveLoanTab(tab);
 const [activityRevision]=useCollectionRefresh(isAdmin?'ADMIN':'EMPLOYEE'),[retry,setRetry]=useState(0),revision=activityRevision+retry;
 const detail=useCollectionRead(`/loans/${id}`,revision),loan=detail.data?.data;
 useEffect(()=>{window.scrollTo({top:0});},[id]);
 useLayoutEffect(()=>{const reveal=()=>{const button=document.getElementById('loan-tab-'+activeTab),nav=button?.parentElement;if(!button||!nav)return;const box=button.getBoundingClientRect(),container=nav.getBoundingClientRect();if(box.left<container.left||box.right>container.right)nav.scrollBy({left:box.left-container.left-(container.width-box.width)/2,behavior:'auto'});};reveal();window.addEventListener('resize',reveal);return()=>window.removeEventListener('resize',reveal);},[activeTab,loan?._id]);
 useEffect(()=>{if(tab&&tab!==activeTab)setParams(previous=>{const next=new URLSearchParams(previous);next.set('tab','overview');return next;},{replace:true});},[tab,activeTab,setParams]);
 const choose=key=>{if(key===activeTab)return;setParams(previous=>{const next=new URLSearchParams(previous);next.set('tab',key);return next;});};
 function tabKey(event,index){let next;if(event.key==='ArrowRight')next=(index+1)%LOAN_TABS.length;else if(event.key==='ArrowLeft')next=(index+LOAN_TABS.length-1)%LOAN_TABS.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=LOAN_TABS.length-1;else return;event.preventDefault();choose(LOAN_TABS[next][0]);document.getElementById('loan-tab-'+LOAN_TABS[next][0])?.focus();}
 if(detail.loading&&!loan)return <LoadingIndicator message={"Loading loan details…"} className="re-loans rl-empty"/>;
 if(detail.error)return <div className="re-loans rl-empty" role="alert">{detail.error}<button className="rl-button" onClick={()=>setRetry(n=>n+1)}>Retry</button><Link className="rl-text-link" to={`/${portal}/loans`}>Back to loans</Link></div>;
 if(!loan)return null;
 const collectionPath=`/${isAdmin?'admin/collections':'employee/collections/today'}?scope=ALL&loan=${encodeURIComponent(loan.loanNumber)}`;
 return <div className="re-loans rl-details"><Link className="rl-back" to={`/${portal}/loans`}><ArrowLeft size={16}/>Back to {isAdmin?'Loans':'My Loans'}</Link><header className="rl-heading"><div><h1><Wallet size={24}/>Loan {loan.loanNumber}<LoanStatus status={loan.effectiveStatus||loan.status}/></h1><p>Issued on {businessDate(loan.loanDate)} · Asia/Kolkata</p><p>Entered in system: {activityTime(loan.createdAt)}</p></div><div className="rl-inline-actions"><Link className="rl-button" to={`/${portal}/follow-ups?loan=${id}`}><Bell size={16}/>Follow-up History &amp; Reminders</Link><Link className="rl-button" to={collectionPath}><CalendarDays size={16}/>View All Installments / Collect Advance</Link></div></header>
 {loan.financialReviewRequired&&<p className="rl-alert" role="alert">Installment totals need Admin review. Existing payments are preserved; use the reviewed repair procedure before final repayment.</p>}{loan.overdueAmount>0&&<div className="rl-overdue"><strong>{money(loan.overdueAmount)} overdue · {loan.overdueInstallments} unpaid installments</strong><p>Maturity does not clear unpaid debt. Stored status: {loan.status}.</p>{!isAdmin&&loan.canCollect&&<Link className="rl-text-link" to={`/employee/collections/today?scope=OVERDUE&loan=${encodeURIComponent(loan.loanNumber)}`}>Collect overdue payment →</Link>}</div>}
 <nav className="rl-tabs" role="tablist" aria-label="Loan sections">{LOAN_TABS.map(([key,label],index)=><button key={key} id={'loan-tab-'+key} role="tab" aria-controls="loan-tab-panel" aria-selected={activeTab===key} aria-current={activeTab===key?'page':undefined} tabIndex={activeTab===key?0:-1} onKeyDown={event=>tabKey(event,index)} onClick={()=>choose(key)}>{label}</button>)}</nav>
 <section id="loan-tab-panel" role="tabpanel" aria-labelledby={'loan-tab-'+activeTab} data-loan-tab={activeTab} tabIndex={0}><LoanTabPanel tab={activeTab} loan={loan} portal={portal} revision={revision}/></section></div>;
}
