import LoadingIndicator from "../../components/ui/Loading";
import CustomerProfileHeader from '../../components/customers/CustomerProfileHeader';
import {CustomerOverview} from '../../components/customers/CustomerDetailSections';
import {useEffect,useRef,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowLeft,User,MapPin,FileText,Clock,Pencil,Plus,RefreshCw,CheckCircle2} from 'lucide-react';
import {SettlementPanel} from '../../components/settlements/SettlementPresentation';

import {useCollectionRead,useCollectionRefresh} from '../../hooks/useCollectionRefresh';
import '../../components/loans/loans.css';
import '../../components/settlements/daily-settlement.css';
import './customer-details.css';

export const maskCustomerIdentity=value=>{const text=String(value||'').trim();if(!text)return 'Not provided';return text.length>4?'********'+text.slice(-4):'********';};
const recorded=value=>value?new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'})+' IST':'Timestamp unavailable';
const present=value=>value===undefined||value===null||value===''?'Not provided':value;
function Actions({customer}){return <><Link className="cd-button" to={`/employee/customers/${customer._id}/kyc`}><FileText size={16}/><span className="cd-full-label">View / Complete KYC</span><span className="cd-short-label">KYC</span></Link>{customer.status==='ACTIVE'&&<Link className="cd-button cd-primary" to={`/employee/customers/${customer._id}/loans/new`}><Plus size={17}/>Issue Loan</Link>}<Link className="cd-button" to={`/employee/customers/${customer._id}/${customer.kycLeadId?'kyc':'edit'}`}><RefreshCw size={16}/><span className="cd-full-label">{customer.kycLeadId?'View / Revise KYC':'Edit Customer'}</span><span className="cd-short-label">{customer.kycLeadId?'Revise KYC':'Edit'}</span></Link></>;}
function Fields({rows}){return <dl className="cd-fields">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{present(value)}</dd></div>)}</dl>;}
export function CustomerDetailsView({customer,timeline=[],timelineLoading=false,timelineError='',retryTimeline}){
 const summary=customer.financialSummary,profile={...customer,...summary},edit=`/employee/customers/${customer._id}/${customer.kycLeadId?'kyc':'edit'}`;
 return <div className="customer-detail-page customer-profile-page customer-profile-employee"><div className="cp-back"><Link className="cd-back" to="/employee/customers"><ArrowLeft size={18}/>Back to My Customers</Link><span>Customer Details</span></div>
 <CustomerProfileHeader customer={profile} employee={customer.employeeId} onRefresh={retryTimeline} actions={<><Link className="cd-button" to={edit}><Pencil size={15}/>Edit Profile</Link><Actions customer={customer}/></>}/>
 {!summary&&<p className="cd-help">Unavailable: customer financial summary could not be loaded.</p>}
 <CustomerOverview customer={{...customer,...summary}}/>
 <div className="cd-content"><div className="cd-information"><SettlementPanel title="Personal Information" Icon={User} mobileCollapse><Fields rows={[["Father’s name",customer.fatherName],['Age & gender',[customer.age!=null?customer.age+' years':null,customer.gender].filter(Boolean).join(', ')],['Occupation',customer.occupation],...(customer.dob?[['Date of birth',new Date(customer.dob).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'})]]:[]),...(customer.nationality?[['Nationality',customer.nationality]]:[]),...(customer.maritalStatus?[['Marital status',customer.maritalStatus]]:[]),['Assigned employee',customer.employeeId?.name],...(customer.branchId?.name?[['Branch',customer.branchId.name]]:[]) ]}/></SettlementPanel>
 <SettlementPanel title="Contact & Address" Icon={MapPin} mobileCollapse><Fields rows={[["Mobile",customer.mobile],...(customer.alternateMobile?[['Alternate mobile',customer.alternateMobile]]:[]),...(customer.email?[['Email',customer.email]]:[]),['Full address',customer.address],['Area / city',[customer.area,customer.city].filter(Boolean).join(', ')],...(customer.district?[['District',customer.district]]:[]),...(customer.state?[['State',customer.state]]:[]),...(customer.pin?[['PIN code',customer.pin]]:[]),...(customer.landmark?[['Landmark',customer.landmark]]:[])]}/></SettlementPanel>
 <SettlementPanel title="Identity Proof" Icon={FileText} mobileCollapse><Fields rows={[["Document type",customer.idProofType],['Identity number',maskCustomerIdentity(customer.idProofNumber)]]}/><Link className="cd-text-link" to={`/employee/customers/${customer._id}/kyc`}>View authorized KYC documents</Link><p className="cd-help">Identity numbers are masked. Documents use the existing protected KYC viewer.</p></SettlementPanel></div>
 <aside className="cd-timeline"><SettlementPanel title="Timeline" Icon={Clock} mobileCollapse>{timelineLoading?<LoadingIndicator message={"Loading recorded events…"}/>:timelineError?<div role="alert"><p>{timelineError}</p><button className="cd-button" onClick={retryTimeline}>Retry timeline</button></div>:timeline.length?<ol>{timeline.map(event=><li key={event._id}><span className="cd-event-icon"><CheckCircle2 size={18}/></span><div><h3>{event.action}</h3>{event.details&&<p>{event.details}</p>}<time dateTime={event.createdAt}>{recorded(event.createdAt)}</time></div></li>)}</ol>:<p className="cd-help">No recorded timeline events are available.</p>}</SettlementPanel></aside></div></div>;
}
export default function CustomerDetails(){
 const {id}=useParams(),[retry,setRetry]=useState(0),[revision]=useCollectionRefresh('EMPLOYEE');
 const profile=useCollectionRead(`/customers/${id}`,revision+retry),timeline=useCollectionRead(`/customers/${id}/timeline`,revision+retry),cached=useRef({id:null,data:null});
 // Keep an open photo stable during background refresh, but never reuse a
 // different customer's data or retain the view after an authorization error.
 if(profile.data?.data)cached.current={id,data:profile.data.data};
 const customer=profile.data?.data||(cached.current.id===id?cached.current.data:null);
 useEffect(()=>{const changed=event=>{if(String(event.detail?.customerId)===id)setRetry(value=>value+1);};window.addEventListener('royal:customer-photo',changed);return()=>window.removeEventListener('royal:customer-photo',changed);},[id]);
 if(profile.loading&&!customer)return <LoadingIndicator message={"Loading customer details…"} className="re-loans cd-load"/>;
 if(profile.error)return <div className="re-loans cd-load" role="alert"><p>{profile.error}</p><button className="rl-button" onClick={()=>setRetry(value=>value+1)}>Retry customer details</button><Link className="rl-button" to="/employee/customers">Back to My Customers</Link></div>;
 if(!customer)return <div className="re-loans cd-load">Customer details are unavailable.</div>;
 return <CustomerDetailsView customer={customer} timeline={timeline.data?.data||[]} timelineLoading={timeline.loading&&!timeline.data} timelineError={timeline.error} retryTimeline={()=>setRetry(value=>value+1)}/>;
}
