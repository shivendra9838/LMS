import LoadingIndicator from "../ui/Loading";
import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Phone,Search} from 'lucide-react';
import {Link} from 'react-router-dom';
import api from '../../services/api';
import CustomerPhoto from '../CustomerPhoto';
import ProfileAvatar from '../ProfileAvatar';
import {businessDate} from '../../utils/businessDate';
import './directory.css';
export const dateLabel=value=>value?businessDate(value):'—';
export function useDirectoryRead(url,revision){
 const [state,setState]=useState({key:'',data:null,loading:true,error:''});
 useEffect(()=>{if(!url)return;const controller=new AbortController();setState(old=>({key:url,data:old.key===url?old.data:null,loading:true,error:''}));api.get(url,{signal:controller.signal}).then(res=>{if(!controller.signal.aborted)setState({key:url,data:res.data,loading:false,error:''});}).catch(e=>{if(!controller.signal.aborted)setState(old=>({...old,key:url,loading:false,error:e.response?.data?.message||'Unable to load records. Please retry.'}));});return()=>controller.abort();},[url,revision]);
 return state.key===url?state:{data:null,loading:true,error:''};
}
export function DirectoryState({state,retry,empty}){return state.error?<div className="rd-message rd-error" role="alert">{state.error}<button className="rd-button" onClick={retry}>Retry</button></div>:state.loading&&!state.data?<LoadingIndicator message={"Loading authorized records…"} className="rd-message"/>:empty?<p className="rd-message">No records match these filters.</p>:null;}
export function DirectorySearch({value,onChange,label='Search customer name, code or mobile…'}){return <label className="rd-search"><span className="sr-only">{label}</span><input type="search" maxLength={100} placeholder={label} value={value} onChange={e=>onChange(e.target.value)}/><Search size={18} aria-hidden="true"/></label>;}
export function DirectoryPager({meta,onPage}){if(!meta)return null;const first=meta.total?(meta.page-1)*(meta.limit||10)+1:0,last=Math.min(meta.total,meta.page*(meta.limit||10));return <footer className="rd-pagination"><p>Showing {first}–{last} of {meta.total} records</p><nav aria-label="Results pages"><button className="rd-button" aria-label="Previous page" disabled={meta.page<=1} onClick={()=>onPage(meta.page-1)}><ChevronLeft size={16}/></button><span aria-current="page">{meta.page}</span><button className="rd-button" aria-label="Next page" disabled={meta.page>=meta.totalPages} onClick={()=>onPage(meta.page+1)}><ChevronRight size={16}/></button></nav></footer>;}
export function DirectoryAvatar({customer,lead}){
 const [state,setState]=useState({key:'',src:''}),ref=useRef(null),[visible,setVisible]=useState(false),key=lead?._id+':'+lead?.photoDocumentId;
 useEffect(()=>{if(!ref.current)return;if(!window.IntersectionObserver){setVisible(true);return;}const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'100px'});observer.observe(ref.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(!visible||customer?._id||!lead?.photoDocumentId)return;const controller=new AbortController();let url;api.get(`/kyc/${lead._id}/documents/${lead.photoDocumentId}`,{responseType:'blob',signal:controller.signal}).then(res=>{if(controller.signal.aborted||!res.data.type.startsWith('image/'))return;url=URL.createObjectURL(res.data);setState({key,src:url});}).catch(()=>{});return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};},[key,customer?._id,visible,lead?._id,lead?.photoDocumentId]);
 return <span ref={ref}>{customer?._id?<CustomerPhoto customer={customer}/>:<ProfileAvatar src={state.key===key?state.src:''} name={lead?.name} size={42} alt={(lead?.name||'Customer')+' profile photo'}/>}</span>;
}
export function DirectoryIdentity({row,to,lead=false}){const customer=lead?row.customerId?{_id:row.customerId,name:row.name}:null:{_id:row.customerId,name:row.name};return <div className="rd-identity"><Link to={to} aria-label={'Open '+row.name+' photo and details'}><DirectoryAvatar customer={customer} lead={lead?row:null}/></Link><div><Link to={to} className="rd-name">{row.name||'Untitled KYC'}</Link>{row.customerCode&&<small>{row.customerCode}</small>}{<small className={lead?'rd-identity-mobile':''}><Phone size={10}/>{row.mobile||'—'}</small>}</div></div>;}
export const kycLabels={DRAFT:'Draft',PENDING:'Pending Approval',APPROVED:'Approved',REJECTED:'Rejected',CORRECTION_REQUIRED:'Corrections Required'};
export const kycAction=status=>status==='DRAFT'?'View / Edit':['REJECTED','CORRECTION_REQUIRED'].includes(status)?'View / Revise':'View';
export function KycStatus({status}){return <span className={'rd-badge rd-'+status}>{kycLabels[status]||status}</span>;}

