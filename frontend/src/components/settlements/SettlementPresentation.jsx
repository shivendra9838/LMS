import {useEffect,useRef} from 'react';
import {Link} from 'react-router-dom';
import {Users,Banknote,Building2,UserRound,Landmark,Wallet,ArrowLeftRight,Clock3,Hourglass,FileText,ChevronDown} from 'lucide-react';
import {businessDate} from '../../utils/businessDate';

export const settlementMoney=value=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format((value||0)/100);
const metrics=[
 ['Customer collections in period','collectionsMinor',Users,'green'],['Cash collected in period','cashCollectedMinor',Banknote,'blue'],
 ['Company-direct UPI','companyUpiMinor',Building2,'purple'],['Employee-received UPI','employeeUpiMinor',UserRound,'rose'],
 ['Bank transfers in period','bankCollectedMinor',Landmark,'bronze'],['Physical cash held','cashHeldMinor',Banknote,'gold'],
 ['Employee UPI pending transfer','upiHeldMinor',ArrowLeftRight,'teal'],['Employee bank funds pending transfer','bankHeldMinor',Landmark,'slate'],
 ['Cash available for handover','availableCashMinor',Wallet,'blue'],['Digital funds available for transfer','availableDigitalMinor',Wallet,'purple'],
 ['Company payments awaiting verification','pendingCompanyMinor',Clock3,'gold'],['Earlier collections still outstanding','previousOutstandingMinor',Hourglass,'rose']
];
export function SettlementMetrics({totals}){return <div className="ds-metrics">{metrics.map(([label,key,Icon,tone])=><article key={key} className="ds-stat"><span className={'ds-stat-icon ds-tone-'+tone}><Icon size={22} aria-hidden="true"/></span><div><p>{label}</p><strong>{settlementMoney(totals[key])}</strong></div></article>)}</div>;}

// Secondary accounting totals share the primary cards' surface and typography.
export function SettlementAccountingDetails({totals}){return <div className="ds-secondary-metrics">{[
 ['Submitted, awaiting review','submittedMinor'],['Verified settlements in period','verifiedSettlementsMinor'],
 ['Unclassified historical / legacy funds','unclassifiedMinor'],['Disputed settlements','disputedMinor'],
 ['Observed cash shortage','cashShortageMinor'],['Reconciliation difference','differenceMinor']
].map(([label,key])=><article key={key} className="ds-stat"><div><p>{label}</p><strong>{settlementMoney(totals[key])}</strong></div></article>)}</div>;}

// Native details retain form state when collapsed. Only breakpoint changes reset
// the initial presentation; submitting and financial eligibility stay in the page.
export function SettlementPanel({title,Icon=FileText,children,mobileCollapse=false,collapsible=false,className='',id,panelRef}){
 const ref=useRef(null);
 useEffect(()=>{if(!mobileCollapse)return;const media=window.matchMedia('(min-width:768px)');const update=()=>{if(ref.current)ref.current.open=media.matches;};update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[mobileCollapse]);
 const heading=<><Icon size={19} aria-hidden="true"/><span>{title}</span></>;
 if(mobileCollapse||collapsible)return <details ref={node=>{ref.current=node;if(panelRef)panelRef.current=node;}} id={id} className={'ds-panel '+className}><summary className="ds-panel-heading">{heading}<ChevronDown size={17} className="ds-chevron" aria-hidden="true"/></summary><div className="ds-panel-body">{children}</div></details>;
 return <section id={id} className={'ds-panel '+className}><h2 className="ds-panel-heading">{heading}</h2><div className="ds-panel-body">{children}</div></section>;
}

export function SettlementPayments({payments,admin=false}){
 const stamp=value=>value?new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'Not recorded';
 const identity=p=>{const c=p.collectionId;return <><strong>{c?.customerId?.name||'Customer unavailable'}</strong><small>{c?.customerId?.customerCode||'—'} · {c?.loanId?.loanNumber||'Loan unavailable'}</small></>;};
 const receipt=p=>p.collectionId?._id?<Link className="ds-receipt-link" to={`/${admin?'admin':'employee'}/collections/receipt/${p.collectionId._id}`}>{p.collectionId?.collectionNumber||'View receipt'}</Link>:<span>Receipt unavailable</span>;
 const status=p=><><span className={'ds-badge '+(p.verification==='VERIFIED'?'ds-verified':'')}>{p.verification||'UNCLASSIFIED'}</span><small>Custody: {p.bucket||'UNCLASSIFIED'}<br/>Settlement: {p.settlementStatus||'UNCLASSIFIED'}</small></>;
 const note=p=><><p>{p.accountId?.label||(p.bucket==='CASH'?'Physical employee cash':'Destination requires classification')} {p.accountId?.maskedDetails}</p><p>{p.reference||(p.method==='CASH'?'Cash collection':'Reference unavailable')}</p>{p.collectionId?.backdateReason&&<p>Backdated reason: {p.collectionId.backdateReason}</p>}{p.legacy&&<p className="ds-warning">Historical payment · not yet classified for settlement</p>}</>;
 if(!payments.length)return <div className="ds-empty"><FileText size={30}/><p>No received payments match these filters.</p><small>Assigned customers and scheduled installments are not received payments. Check the date range and collection method.</small></div>;
 return <><div className="ds-payment-table" tabIndex={0} role="region" aria-label="Customer payments table"><table><thead><tr>{['Customer / loan','Receipt / received date','Amount / method','Verification / custody','Details'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{payments.map(p=><tr key={p._id}><td>{identity(p)}</td><td>{receipt(p)}<p>{businessDate(p.paymentDate)}</p><small>Entered: {stamp(p.recordedAt||p.createdAt)}</small></td><td><strong>{settlementMoney(p.amountMinor)}</strong><small>{p.method}</small></td><td>{status(p)}</td><td>{note(p)}</td></tr>)}</tbody></table></div><div className="ds-payment-cards">{payments.map(p=><article key={p._id}><header><div>{identity(p)}</div><strong>{settlementMoney(p.amountMinor)}</strong></header><p>{receipt(p)} · {p.method}</p><p>Received: {businessDate(p.paymentDate)}</p><small>Entered: {stamp(p.recordedAt||p.createdAt)}</small><div className="ds-payment-status">{status(p)}</div>{note(p)}</article>)}</div></>;
}
