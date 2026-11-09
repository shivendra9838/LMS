import LoadingIndicator from "../ui/Loading";
import {useEffect,useRef,useState} from 'react';
import {changePortfolioQuery} from '../../utils/portfolioQuery.js';
import {Link,useSearchParams,useLocation} from 'react-router-dom';
import api from '../../services/api';

export const money=value=>Number(value||0).toLocaleString('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2});
export const date=value=>value?new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'No received payment';
export const readPayload=response=>response.data?.rows?{...response.data,meta:response.data.meta||response.meta}:response;
export function useRead(url,revision=0){
 const notification=useLocation().state?.notification||'';
 const key=`${url || ''}:${revision}:${notification}`;
 const [state,setState]=useState({key:null,loading:true,data:null,error:''});
 useEffect(()=>{
  if(!url)return;
  const controller=new AbortController();
  setState({key,loading:true,data:null,error:''});
  api.get(url,{signal:controller.signal}).then(res=>setState({key,loading:false,data:readPayload(res.data),error:''})).catch(err=>{
   if(err.code!=='ERR_CANCELED')setState({key,loading:false,data:null,error:err.response?.data?.message||'Unable to load this portfolio. Retry the request.'});
  });
  return()=>controller.abort();
 },[url,revision,key]);
 // A changed URL must be loading during render, before the effect runs. Never render a previous tab's payload.
 if(!url)return {loading:false,data:null,error:''};
 return state.key===key?state:{loading:true,data:null,error:''};
}
export function useFilters(){
 const [params,setParams]=useSearchParams(),queryRef=useRef(params),urlSearch=params.get('search')||'';
 const [search,setSearch]=useState(urlSearch);
 useEffect(()=>{queryRef.current=params;},[params]);
 useEffect(()=>{setSearch(urlSearch);},[urlSearch]);
 useEffect(()=>{if(search===urlSearch)return;const timer=setTimeout(()=>setParams(changePortfolioQuery(queryRef,'search',search.trim()),{replace:true}),350);return()=>clearTimeout(timer);},[search,urlSearch,setParams]);
 const change=(key,value)=>setParams(changePortfolioQuery(queryRef,key,value));
 return {params,search,setSearch,change,query:params.toString()};
}
export function Breadcrumbs({items}){return <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-gray-600">{items.map(([label,to],i)=><span key={i} className="flex items-center gap-2">{i>0&&<span aria-hidden="true">/</span>}{to?<Link className="underline underline-offset-4" to={to}>{label}</Link>:<span aria-current="page">{label}</span>}</span>)}</nav>;}
export function Stats({items}){return <dl className="grid grid-cols-1 min-[375px]:grid-cols-2 xl:grid-cols-3 gap-3">{items.map(([label,value])=><div key={label} className="bg-white border border-gray-200 rounded-xl p-4 min-w-0"><dt className="text-sm text-gray-600">{label}</dt><dd className="text-2xl font-bold mt-2 break-words">{value??0}</dd></div>)}</dl>;}
export function Pager({meta,change}){if(!meta||!Number.isFinite(meta.total))return null;return <div className="flex flex-wrap justify-between items-center gap-3 border-t pt-4"><p className="text-sm text-gray-600">{meta.total.toLocaleString('en-IN')} results · Page {meta.page} of {Math.max(1,meta.totalPages)}</p><div className="flex flex-wrap gap-2"><button className="btn-secondary min-h-11" disabled={meta.page<=1} onClick={()=>change('page',String(meta.page-1))}>Previous</button><button className="btn-secondary min-h-11" disabled={meta.page>=meta.totalPages} onClick={()=>change('page',String(meta.page+1))}>Next</button></div></div>;}
export function LoadState({loading,error,retry}){if(error)return <div role="alert" className="rounded-xl p-4 bg-red-50 text-red-900">{error}<button className="btn-secondary block mt-3" onClick={retry}>Retry</button></div>;return loading?<LoadingIndicator message={"Loading current portfolio records…"} className="p-4 text-gray-600"/>:null;}
export function Select({label,value,onChange,children}){return <label className="block text-sm font-medium">{label}<select className="input-field mt-1 min-h-11" value={value||''} onChange={e=>onChange(e.target.value)}>{children}</select></label>;}
export function PortfolioActions(){return <div className="flex flex-wrap gap-2"><Link className="btn-secondary min-h-11" to="/admin/customers/requests">Employee Requests</Link><Link className="btn-primary min-h-11" to="/admin/customers/add">Add Customer</Link></div>;}
