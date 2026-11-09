import {ArrowLeft,ArrowRight,CalendarDays,CheckCircle2,Clock3,FileCheck2,FileText,Layers3,RotateCcw,ShieldCheck,TriangleAlert,UserRound,X,XCircle} from 'lucide-react';
import {Link} from 'react-router-dom';
import toast from 'react-hot-toast';
import './kyc-verification.css';
import KycReviewIllustration from './KycReviewIllustration';

const presentations={
 PENDING:{label:'Pending Approval',heading:'Waiting for Admin Approval',message:"Your customer's KYC application has been submitted successfully and is currently under review by the Admin. You will be notified once the verification is complete.",Icon:Clock3},
 APPROVED:{label:'Approved',heading:'KYC Approved Successfully',message:'Admin has approved this customer application. The saved application and approval history remain available.',Icon:ShieldCheck},
 REJECTED:{label:'Rejected',heading:'KYC Rejected',message:'Admin has reviewed and rejected this application. Read the review remarks before updating and resubmitting the KYC.',Icon:XCircle},
 CORRECTION_REQUIRED:{label:'Corrections Required',heading:'KYC Corrections Required',message:'Admin has requested changes to this application. Review the requested corrections and update the existing KYC.',Icon:TriangleAlert}
};
export function verificationDetails(record){
 const latest=action=>[...(record?.history||[])].reverse().find(row=>row.action===action)?.at;
 return {...presentations[record?.status],submittedOn:latest('SUBMITTED'),approvedOn:record?.approvedAt||latest('APPROVED')};
}
export function showKycSubmitted(id){toast.custom(t=><div className="kyc-submission-toast" role="status"><CheckCircle2 size={23}/><div><strong>KYC submitted successfully!</strong><p>Your application has been sent for admin approval.</p></div><button type="button" aria-label="Dismiss KYC submission notification" onClick={()=>toast.dismiss(t.id)}><X size={17}/></button></div>,{id:'kyc-submitted-'+id,duration:6500});}
const stamp=value=>value&&Number.isFinite(new Date(value).getTime())?new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST':null;
function PendingVerification({record,detail,onView}){
 return <section className="kyc-verification kyc-verification-PENDING" aria-labelledby="kyc-verification-title">
  <header><Link to="/employee/customers/kyc"><ArrowLeft size={16}/>Back to KYC Records</Link><h2>KYC VERIFICATION</h2></header>
  <div className="kyc-pending-main"><div className="kyc-pending-hero"><div className="kyc-verification-stamp" aria-hidden="true"><Clock3 size={35}/><span>PENDING</span></div><span className="kyc-verification-badge">{detail.label}</span><h1 id="kyc-verification-title">{detail.heading}</h1><p>{detail.message}</p><KycReviewIllustration/></div>
   <dl className="kyc-pending-details"><div><dt><UserRound size={21} aria-hidden="true"/>Customer</dt><dd>{record.data?.name||'Name not recorded'}</dd></div><div><dt><Layers3 size={21} aria-hidden="true"/>KYC reference</dt><dd>{record._id}</dd></div><div><dt><CalendarDays size={21} aria-hidden="true"/>Submitted on</dt><dd>{stamp(detail.submittedOn)||'Not recorded'}</dd></div></dl>
  </div>
  <footer><button type="button" className="btn-secondary" onClick={onView}><FileText size={16}/>View Submitted Application<ArrowRight size={16}/></button><Link className="btn-primary" to="/employee/customers/kyc"><ArrowLeft size={16}/>Back to KYC Records</Link></footer>
 </section>;
}
export default function KycVerification({record,onView,onEdit}){
 const detail=verificationDetails(record),Icon=detail.Icon;
 if(!Icon)return null;
 if(record.status==='PENDING')return <PendingVerification {...{record,detail,onView}}/>;
 return <section className={'kyc-verification kyc-verification-'+record.status} aria-labelledby="kyc-verification-title">
  <header><Link to="/employee/customers/kyc"><ArrowLeft size={16}/>Back to KYC Records</Link><span>KYC VERIFICATION</span></header>
  <div className="kyc-verification-paper"><div className="kyc-verification-copy"><div className="kyc-verification-stamp" aria-hidden="true"><Icon size={34}/><span>{record.status==='PENDING'?'PENDING':detail.label}</span></div><span className="kyc-verification-badge">{detail.label}</span><h1 id="kyc-verification-title">{detail.heading}</h1><p>{detail.message}</p></div>
   <div className="kyc-verification-document" aria-hidden="true"><FileCheck2 size={82} strokeWidth={1.2}/><CheckCircle2 size={28}/><span>Secure application review</span></div>
   <dl><div><dt>Customer</dt><dd>{record.data?.name||'Name not recorded'}</dd></div><div><dt>KYC reference</dt><dd>{record._id}</dd></div><div><dt>Submitted on</dt><dd>{stamp(detail.submittedOn)||'Not recorded'}</dd></div>{record.status==='APPROVED'&&<div><dt>Approved on</dt><dd>{stamp(detail.approvedOn)||'Not recorded'}</dd></div>}</dl>
   {['REJECTED','CORRECTION_REQUIRED'].includes(record.status)&&<aside><strong>{record.status==='REJECTED'?'Admin rejection reason':'Requested corrections'}</strong><p>{record.adminRemarks||'No review remarks were recorded. Contact Admin before resubmitting.'}</p></aside>}
  </div>
  <footer><button type="button" className="btn-secondary" onClick={onView}><FileText size={16}/>View Submitted Application<ArrowRight size={15}/></button>{['REJECTED','CORRECTION_REQUIRED'].includes(record.status)&&<button type="button" className="btn-primary" onClick={onEdit}><RotateCcw size={16}/>Update & Resubmit KYC</button>}<Link className="btn-primary" to="/employee/customers/kyc">Back to KYC Records</Link></footer>
 </section>;
}
