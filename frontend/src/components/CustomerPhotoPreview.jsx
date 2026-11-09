import LoadingIndicator from "./ui/Loading";
import {useEffect,useId,useRef,useState} from 'react';
import {X,ZoomIn,ZoomOut,RotateCcw} from 'lucide-react';
import api from '../services/api';
import ProfileAvatar from './ProfileAvatar';
import {SESSION_EVENT} from '../utils/portalSession';
import './customer-photo-preview.css';

const clamp=value=>Math.min(4,Math.max(1,value));
export default function CustomerPhotoPreview({customer,close}){
 const title=useId(),dialog=useRef(null),stage=useRef(null),pointers=useRef(new Map()),pinch=useRef(null);
 const [reload,setReload]=useState(0),[state,setState]=useState({loading:true,src:'',available:false,error:''}),[zoom,setZoom]=useState(1),[natural,setNatural]=useState({width:0,height:0}),[size,setSize]=useState({width:0,height:0});
 useEffect(()=>{const previous=document.activeElement;dialog.current?.showModal();return()=>previous?.focus();},[]);
 useEffect(()=>{const update=()=>close();window.addEventListener(SESSION_EVENT,update);window.addEventListener('royal:customer-photo',update);return()=>{window.removeEventListener(SESSION_EVENT,update);window.removeEventListener('royal:customer-photo',update);};},[close]);
 useEffect(()=>{const controller=new AbortController();let url;setState({loading:true,src:'',available:false,error:''});
  (async()=>{try{const meta=await api.get(`/customers/${customer._id}/photo/meta`,{signal:controller.signal});if(controller.signal.aborted)return;if(!meta.data.data.available){setState({loading:false,src:'',available:false,error:''});return;}
   const response=await api.get(`/customers/${customer._id}/photo`,{params:{variant:'preview'},responseType:'blob',signal:controller.signal});if(controller.signal.aborted)return;url=URL.createObjectURL(response.data);setState({loading:false,src:url,available:true,error:''});
  }catch(error){if(!controller.signal.aborted)setState({loading:false,src:'',available:false,error:error.response?.status===404?'This photo is unavailable or access has changed.':'Unable to load the photo securely. Please retry.'});}})();
  return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};
 },[customer._id,reload]);
 useEffect(()=>{const element=stage.current;if(!element)return;const update=()=>setSize({width:element.clientWidth,height:element.clientHeight});update();const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(update):null;observer?.observe(element);window.addEventListener('resize',update);return()=>{observer?.disconnect();window.removeEventListener('resize',update);};},[]);
 const fit=natural.width&&size.width?Math.min(Math.max(1,size.width-2)/natural.width,Math.max(1,size.height-2)/natural.height,1):1,width=natural.width*fit*zoom,height=natural.height*fit*zoom;
 function down(event){event.preventDefault();pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});event.currentTarget.setPointerCapture(event.pointerId);if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom};}}
 function move(event){const previous=pointers.current.get(event.pointerId);if(!previous)return;event.preventDefault();pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.current.size===2&&pinch.current?.distance){const [a,b]=[...pointers.current.values()];setZoom(clamp(pinch.current.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.current.distance));}else if(pointers.current.size===1){event.currentTarget.scrollLeft-=event.clientX-previous.x;event.currentTarget.scrollTop-=event.clientY-previous.y;}}
 function up(event){pointers.current.delete(event.pointerId);if(pointers.current.size<2)pinch.current=null;}
 return <dialog ref={dialog} className="customer-photo-preview" aria-labelledby={title} onCancel={event=>{event.preventDefault();close();}} onClose={close} onClick={event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}}>
  <header><div><h2 id={title}>Customer photo</h2><p>{customer.name}</p></div><button type="button" aria-label="Close customer photo preview" onClick={close}><X size={22}/></button></header>
  <div className="cpp-toolbar" aria-label="Photo zoom controls"><button type="button" aria-label="Zoom out photo" disabled={!state.src||zoom<=1} onClick={()=>setZoom(value=>clamp(value-.5))}><ZoomOut size={18}/></button><output aria-live="polite">{Math.round(zoom*100)}%</output><button type="button" aria-label="Zoom in photo" disabled={!state.src||zoom>=4} onClick={()=>setZoom(value=>clamp(value+.5))}><ZoomIn size={18}/></button><button type="button" disabled={!state.src} onClick={()=>setZoom(1)}><RotateCcw size={15}/>Reset zoom</button></div>
  <div ref={stage} className="cpp-stage" style={{overflow:zoom===1?'hidden':'auto'}} tabIndex={0} role="region" aria-label="Customer photo preview. Pinch to zoom or use the zoom controls." onPointerDown={state.src?down:undefined} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}>
   {state.loading?<LoadingIndicator message={"Loading customer photo securely…"}/>:state.error?<div role="alert"><p>{state.error}</p><button type="button" onClick={()=>setReload(value=>value+1)}>Retry photo</button></div>:state.src?<div className="cpp-canvas" style={{width:Math.max(size.width,width),height:Math.max(size.height,height)}}><img src={state.src} alt={`${customer.name} uploaded photo`} draggable={false} style={natural.width?{width,height}:undefined} onLoad={event=>setNatural({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} onError={()=>setState(s=>({...s,src:'',error:'This photo could not be displayed.'}))}/></div>:<div className="cpp-placeholder"><ProfileAvatar name={customer.name} size={96} alt="Customer photo placeholder"/><p>No customer photo has been uploaded.</p></div>}
  </div><p className="cpp-help">Original aspect ratio · Pinch to zoom or use the controls. Drag to pan when enlarged.</p>
 </dialog>;
}
