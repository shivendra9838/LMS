import {useCallback,useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import api from '../services/api';
import {notificationAction} from '../utils/notificationAction.js';
export function notifyChanged(role){window.dispatchEvent(new CustomEvent('royal:inbox',{detail:{role}}));try{localStorage.setItem('royal:notification-change:'+role,String(Date.now()));}catch{/* SSE still synchronizes when storage is unavailable. */}}
export function useNotificationFeed(role,params){
 const [data,setData]=useState({rows:[],unread:0,total:0,page:1,totalPages:0}),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const serialized=JSON.stringify(params),sequence=useRef(0),request=useRef(null);
 const refresh=useCallback(async()=>{const n=++sequence.current;request.current?.abort();const controller=new AbortController();request.current=controller;try{const r=await api.get('/notifications/inbox',{params:JSON.parse(serialized),signal:controller.signal});if(n===sequence.current){setData(r.data.data);setError('');}}catch(e){if(n===sequence.current&&e.code!=='ERR_CANCELED')setError('Notifications are unavailable. Please retry.');}finally{if(n===sequence.current)setLoading(false);}},[serialized]);
 useEffect(()=>{setLoading(true);refresh();return()=>{sequence.current++;request.current?.abort();};},[refresh]);
 useEffect(()=>{const listener=e=>{if(!e.detail?.role||e.detail.role===role)refresh();},storage=e=>{if(e.key==='royal:notification-change:'+role)refresh();};window.addEventListener('royal:inbox',listener);window.addEventListener('storage',storage);window.addEventListener('focus',refresh);return()=>{window.removeEventListener('royal:inbox',listener);window.removeEventListener('storage',storage);window.removeEventListener('focus',refresh);};},[role,refresh]);
 return {data,loading,error,refresh};
}
export function useNotificationActions(role,onOpen){
 const navigate=useNavigate(),[pending,setPending]=useState(null),[error,setError]=useState(''),inFlight=useRef(false);
 const run=(key,work)=>notificationAction(inFlight,key,setPending,async()=>{setError('');return await work();});
 const mark=row=>run(row._id,async()=>{try{await api.patch('/notifications/inbox/'+row._id,{unread:false});notifyChanged(role);}catch{setError('Unable to mark this notification read. Please retry.');}});
 const allRead=()=>run('all',async()=>{try{await api.post('/notifications/inbox/read-all');notifyChanged(role);}catch{setError('Unable to mark notifications read. Please retry.');}});
 const follow=(row,target='receipt')=>run(row._id,async()=>{try{const r=await api.post('/notifications/inbox/'+row._id+'/open',{target}),path=r.data.data.path;if(!path?.startsWith('/'+role.toLowerCase()+'/'))throw new Error('Invalid destination');notifyChanged(role);onOpen?.();navigate(path,{state:{notification:row._id+':'+Date.now()}});}catch(e){setError(e.response?.data?.message||'This record is unavailable or access has changed. Please retry.');}});
 const dismiss=row=>run(row._id,async()=>{try{await api.post('/notifications/inbox/'+row._id+'/dismiss');notifyChanged(role);return true;}catch{setError('Unable to dismiss this notification. Please retry.');return false;}});
 const restore=row=>run(row._id,async()=>{try{await api.post('/notifications/inbox/'+row._id+'/restore');notifyChanged(role);return true;}catch{setError('Unable to restore this notification. Please retry.');return false;}});
 return {pending,error,mark,allRead,follow,dismiss,restore,clearError:()=>setError('')};
}
