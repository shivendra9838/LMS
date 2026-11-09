import LoadingIndicator, {LoadingButton} from "../../components/ui/Loading";
import {useEffect,useState} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import api from '../../services/api';
import NotificationCard from '../../components/NotificationCard';
import NotificationCategoryTabs from '../../components/NotificationCategoryTabs';
import {ArrowLeft,Search} from 'lucide-react';
import {useNotificationFeed,useNotificationActions} from '../../hooks/useNotifications';
import '../../components/notification-bell.css';
export function NotificationRequestPreview(){const location=useLocation(),request=new URLSearchParams(location.search).get('request'),[state,setState]=useState({key:null,data:null,error:''});useEffect(()=>{if(!request)return;const controller=new AbortController();api.get('/customer-leads/'+encodeURIComponent(request),{signal:controller.signal}).then(r=>setState({key:request,data:r.data.data,error:''})).catch(e=>{if(e.code!=='ERR_CANCELED')setState({key:request,data:null,error:e.response?.data?.message||'This request is unavailable.'});});return()=>controller.abort();},[request]);if(!request)return null;return <section className="notification-record-preview" aria-label="Selected customer request"><h2 className="font-semibold">Customer request</h2>{state.key!==request?<LoadingIndicator message={"Loading selected request…"}/>:state.error?<p role="alert">{state.error}</p>:state.data?<><p>{state.data.name} · {state.data.status}</p><p>{state.data.occupation} · {state.data.city}</p><p>Admin remarks: {state.data.adminRemarks||state.data.rejectionReason||'No remarks recorded'}</p></>:<LoadingIndicator message={"Loading selected request…"}/>}</section>;}
export default function NotificationHistory({role}){
 const navigate=useNavigate(),location=useLocation(),base='/'+role.toLowerCase();
 const [group,setGroup]=useState('ALL'),[undo,setUndo]=useState(null);
 const [category,setCategory]=useState('ALL'),[search,setSearch]=useState(''),[debounced,setDebounced]=useState(''),[page,setPage]=useState(1),[unread,setUnread]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>{setDebounced(search);setPage(1);},300);return()=>clearTimeout(timer);},[search]);
 const feed=useNotificationFeed(role,{group,category,search:debounced,page,unread,limit:20}),actions=useNotificationActions(role);
 const dismiss=async row=>{if(await actions.dismiss(row))setUndo(row);};
 const back=()=>{const path=location.state?.notificationReturn;navigate(path?.startsWith(base+'/')&&path!==base+'/inbox'?path:base+'/dashboard');};
 return <div className="notification-history">
  <header className="notification-page-heading"><div><div className="notification-page-title"><button className="notification-back" aria-label="Back from notifications" onClick={back}><ArrowLeft size={21}/></button><h1>Notifications</h1></div><p>{feed.data.unread} unread · Your saved activity and reminders</p></div><LoadingButton busy={actions.pending} loadingText="Marking notifications read…" className="notification-mark-read" disabled={!feed.data.unread||actions.pending!==null} onClick={actions.allRead}>{actions.pending==='all'?'Marking…':'Mark all as read'}</LoadingButton></header>
  <NotificationCategoryTabs value={group} counts={feed.data.groups} onChange={value=>{setGroup(value);setCategory('ALL');setPage(1);}}/>
  <NotificationRequestPreview/>
  <details className="notification-filter-panel"><summary><Search size={16}/>Search &amp; filters</summary><div className="notification-history-controls"><label>Search notifications<input type="search" maxLength={150} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Customer, employee or receipt"/></label><label>Notification category<select value={category} onChange={e=>{setCategory(e.target.value);setGroup('ALL');setPage(1);}}>{[['ALL','All'],['PAYMENTS','Payments'],['KYC','KYC'],['LOANS','Loans'],['SETTLEMENTS','Settlements'],['REMINDERS','Reminders'],['CUSTOMERS','Customers'],['SYSTEM','System']].map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label className="notification-unread-filter"><input type="checkbox" checked={unread} onChange={e=>{setUnread(e.target.checked);setPage(1);}}/>Unread only</label><button onClick={feed.refresh}>Refresh</button></div></details>
  {(feed.error||actions.error)&&<div className="notification-error" role="alert">{actions.error||feed.error}<button onClick={()=>{actions.clearError();feed.refresh();}}>Retry notifications</button></div>}
  {undo&&<div className="notification-undo" role="status"><span>Notification dismissed.</span><LoadingButton busy={actions.pending} loadingText="Restoring notification…" disabled={actions.pending!==null} onClick={async()=>{if(await actions.restore(undo))setUndo(null);}}>Undo</LoadingButton><button className="notification-undo-close" aria-label="Close undo message" onClick={()=>setUndo(null)}>×</button></div>}
  <p className="notification-swipe-help">Swipe left to dismiss · Swipe right to mark as read</p>
  {feed.loading?<LoadingIndicator message={"Loading notifications…"} className="notification-empty"/>:<div className="notification-history-list">{feed.data.rows.map(row=><NotificationCard key={row._id} row={row} role={role} actions={actions} onDismiss={dismiss}/>)}{!feed.data.rows.length&&!feed.error&&<p className="notification-empty">No notifications match your filters. Read activity stays in All notifications.</p>}</div>}
  {feed.data.totalPages>1&&<nav className="notification-history-page" aria-label="Notification pages"><button disabled={page===1} onClick={()=>setPage(n=>n-1)}>Previous</button><span>Page {page} of {Math.max(1,feed.data.totalPages||0)}</span><button disabled={page>=(feed.data.totalPages||1)} onClick={()=>setPage(n=>n+1)}>Next</button></nav>}
 </div>;
}
