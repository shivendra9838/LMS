import LoadingIndicator from "../ui/Loading";
import {useState} from 'react';
import CustomerRisk from '../CustomerRisk';
import LoanTimeline from '../LoanTimeline';
import {useRead} from '../portfolios/PortfolioUi';
import {FinancialSummary,LoanParties} from './LoanUi';
import LoanCustomer from './LoanCustomer';
import LoanInstallments from './LoanInstallments';
import LoanPayments from './LoanPayments';
import LoanDocuments from './LoanDocuments';
export function LoanOverview({loan,portal,revision}){const [retry,setRetry]=useState(0),events=useRead(`/loans/${loan._id}/timeline`,revision+retry);return <div className="rl-detail-grid"><div className="rl-main"><FinancialSummary loan={loan}/><LoanParties loan={loan} portal={portal}/><CustomerRisk customerId={loan.customerId?._id}/></div><aside className="rl-timeline">{events.loading?<LoadingIndicator message={"Loading timeline…"}/>:events.error?<div role="alert">{events.error}<button className="rl-button" onClick={()=>setRetry(n=>n+1)}>Retry timeline</button></div>:<LoanTimeline events={events.data?.data||[]} portal={portal} loanNumber={loan.loanNumber} onLoanDetails={()=>document.getElementById('loan-financial-summary')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})}/>}</aside></div>;}
const Payments=props=><LoanPayments {...props}/>;
const History=props=><LoanPayments {...props} history/>;
export const LOAN_PANELS={overview:LoanOverview,customer:LoanCustomer,installments:LoanInstallments,payments:Payments,documents:LoanDocuments,history:History};
export default function LoanTabPanel({tab,...props}){const Panel=LOAN_PANELS[tab]||LoanOverview;return <Panel key={props.loan._id} {...props}/>;}
