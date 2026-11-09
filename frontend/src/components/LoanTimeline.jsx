import {useState} from 'react';
import {Link} from 'react-router-dom';
import {FilePlus,CalendarDays,IndianRupee,BadgeCheck,RotateCcw,CheckCircle2,Clock,ArrowDown} from 'lucide-react';
import './loan-timeline.css';

const icons={LOAN_CREATED:FilePlus,SCHEDULE_GENERATED:CalendarDays,PAYMENT_RECEIVED:IndianRupee,PAYMENT_VERIFIED:BadgeCheck,PAYMENT_REVERSED:RotateCcw,LOAN_COMPLETED:CheckCircle2};
export function activityTime(value){return value&&Number.isFinite(new Date(value).getTime())?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(value))+' IST':'Time not recorded';}
export default function LoanTimeline({events=[],portal,loanNumber,onLoanDetails}){
 const [all,setAll]=useState(false),visible=all?events:events.slice(0,5);
 return <section className="loan-activity" aria-label="Loan Timeline"><header><Clock size={18} aria-hidden="true"/><div><h2>Loan Timeline</h2><p>Latest activity first</p></div></header>
 {!events.length?<p className="la-empty">No recorded activity.</p>:<ol>{visible.map((event,index)=>{
 const Icon=icons[event.type]||Clock;
 const content=<><h3>{event.title}</h3><time dateTime={event.date||undefined}>{activityTime(event.date)}</time><p className="la-description">{event.description}</p></>;
 return <li key={event._id} className={'la-event la-'+event.type}><div className="la-rail" aria-hidden="true"><span className="la-icon"><Icon size={15}/></span>{index<visible.length-1&&<><span className="la-line"/><ArrowDown className="la-arrow" size={13}/></>}</div><div className="la-content">
 {event.target==='RECEIPT'&&event.receiptId?<Link className="la-event-link" to={`/${portal}/collections/receipt/${event.receiptId}`}>{content}<span className="la-action">View Receipt →</span></Link>:event.target==='SCHEDULE'?<Link className="la-event-link" to={`/${portal==='admin'?'admin/collections':'employee/collections/today'}?scope=ALL&loan=${encodeURIComponent(loanNumber)}`}>{content}<span className="la-action">View installment schedule →</span></Link>:event.target==='LOAN'?<button type="button" className="la-event-link" onClick={onLoanDetails}>{content}<span className="la-action">View loan details ↓</span></button>:<>{content}{event.review&&<details><summary>View verification details</summary><dl><dt>Receipt</dt><dd>{event.collectionNumber}</dd><dt>Verified by</dt><dd>{event.review.verifiedBy}</dd><dt>Verified at</dt><dd>{activityTime(event.review.verifiedAt)}</dd><dt>Remarks</dt><dd>{event.review.remarks||'No remarks recorded'}</dd></dl><p className="la-description">Receipt review is separate from company settlement.</p></details>}</>}
 </div></li>;
 })}</ol>}
 {events.length>5&&<button className="la-toggle" onClick={()=>setAll(value=>!value)}>{all?'Show Latest 5 Events':`View All Activity (${events.length})`}</button>}
 </section>;
}
