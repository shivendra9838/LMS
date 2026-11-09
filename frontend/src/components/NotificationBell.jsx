import LoadingIndicator, {LoadingButton} from "./ui/Loading";
import {useEffect,useRef,useState} from 'react';
import {Bell,X,CheckCircle2} from 'lucide-react';
import {Link,useNavigate,useLocation} from 'react-router-dom';
import api from '../services/api';
import NotificationItem from './NotificationItem';
import NotificationCategoryTabs from './NotificationCategoryTabs';
import {useNotificationFeed,useNotificationActions} from '../hooks/useNotifications';
import './notification-bell.css';
export const unreadBadge=count=>count>9?'9+':String(count);
export default function NotificationBell({role,token}){
 const navigate=useNavigate(),location=useLocation();
 const [group,setGroup]=useState('ALL'),[mobile,setMobile]=useState(()=>typeof window!=='undefined'&&Boolean(window.matchMedia?.('(max-width:767px)').matches));
 useEffect(()=>{const media=window.matchMedia('(max-width:767px)'),change=()=>{setMobile(media.matches);setOpen(false);};media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 const [open,setOpen]=useState(false),[status,setStatus]=useState('Connecting'),root=useRef(null),button=useRef(null);
 const feed=useNotificationFeed(role,{group,limit:6,page:1}),actions=useNotificationActions(role,()=>setOpen(false));
 useEffect(()=>{let stopped=false,controller,timer,delay=1000;const invalidate=()=>window.dispatchEvent(new CustomEvent('royal:inbox',{detail:{role}}));
  async function connect(){controller=new AbortController();setStatus('Connecting');try{const r=await fetch(api.defaults.baseURL+'/notifications/stream',{headers:{Authorization:'Bearer '+token},signal:controller.signal,cache:'no-store'});if(!r.ok)throw new Error('Connection unavailable');setStatus('Live');delay=1000;invalidate();const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='';while(!stopped){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n\n'))!==-1){const event=buffer.slice(0,end);buffer=buffer.slice(end+2);if(event.includes('event: inbox'))invalidate();if(event.includes('event: revoked')){setStatus('Sign in again');return;}}}}catch(e){if(e.name==='AbortError')return;}if(!stopped){setStatus('Reconnecting');timer=setTimeout(connect,delay);delay=Math.min(delay*2,30000);}}
  if(token)connect();return()=>{stopped=true;controller?.abort();clearTimeout(timer);};
 },[role,token]);
 useEffect(()=>{if(status==='Live'||status==='Sign in again')return;const timer=setInterval(feed.refresh,30000);return()=>clearInterval(timer);},[status,feed.refresh]);
 useEffect(()=>{if(!open)return;root.current?.closest('.header-actions')?.querySelector('.profile-menu')?.removeAttribute('open');const close=e=>{if(e.type==='keydown'&&e.key==='Escape'){setOpen(false);button.current?.focus();}else if((e.type==='pointerdown'||e.type==='click')&&!root.current?.contains(e.target))setOpen(false);};document.addEventListener('pointerdown',close);document.addEventListener('click',close);document.addEventListener('keydown',close);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('click',close);document.removeEventListener('keydown',close);};},[open]);
 const error=actions.error||feed.error;
 return <div ref={root} className="notification-bell"><button ref={button} className="icon-button notification-trigger" aria-label={'Notifications, '+feed.data.unread+' unread'} aria-expanded={open} aria-controls={mobile?undefined:'notification-inbox'} onClick={()=>mobile?navigate('/'+role.toLowerCase()+'/inbox',{state:{notificationReturn:location.pathname+location.search}}):setOpen(!open)}><Bell size={20}/>{feed.data.unread>0&&<span className="notification-count">{unreadBadge(feed.data.unread)}</span>}</button>{open&&<NotificationPreview group={group} onGroup={setGroup} returnPath={location.pathname+location.search} role={role} status={status} feed={feed} actions={actions} error={error} onClose={()=>setOpen(false)}/>}</div>;
}

export function NotificationPreview({role,status,feed,actions,error,onClose,group='ALL',onGroup,returnPath}){return <section id="notification-inbox" className="notification-inbox" aria-label="Notifications">
 <header><div><strong>Notifications <span>({feed.data.unread})</span></strong><small role="status">{status}</small></div><div className="notification-header-actions"><LoadingButton busy={actions.pending} loadingText="Marking notifications read…" className="notification-mark-read" onClick={actions.allRead} disabled={!feed.data.unread||actions.pending!==null}>{actions.pending==='all'?'Marking…':'Mark all as read'}</LoadingButton><button className="icon-button" aria-label="Close notifications" onClick={onClose}><X size={18}/></button></div></header>
 <NotificationCategoryTabs value={group} counts={feed.data.groups} onChange={onGroup}/>
 {error&&<div role="alert">{error}<button onClick={()=>{actions.clearError();feed.refresh();}}>Retry</button></div>}
 <div className="notification-scroll">{feed.loading?<LoadingIndicator message={"Loading notifications…"}/>:<ol>{feed.data.rows.slice(0,6).map(row=><li key={row._id}><NotificationItem row={row} busy={actions.pending!==null} onOpen={actions.follow}/></li>)}</ol>}{!feed.loading&&!feed.data.rows.length&&!error&&<p className="notification-empty"><CheckCircle2 size={21} aria-hidden="true"/>You're all caught up.</p>}</div>
 <footer><Link to={'/'+role.toLowerCase()+'/inbox'} state={{notificationReturn:returnPath}} onClick={onClose}>View all notifications →</Link></footer>
 </section>;}
