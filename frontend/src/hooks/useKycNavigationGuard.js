import {useContext,useEffect,useRef,useState} from 'react';
import {UNSAFE_NavigationContext,useLocation} from 'react-router-dom';
import toast from 'react-hot-toast';

// BrowserRouter does not support useBlocker. Guard its existing history adapter.
export function installKycNavigationGuard({navigator,dirty,inFlight,host,confirm,notify}){
 const originals={},wrapped={};let restoring=false,allowedPop=false,pendingPop=null,index=host.history.state?.idx;
 const ask=done=>{if(inFlight.current){notify('Please wait for the KYC action to finish before leaving.');done(false);return;}if(!dirty.current){done(true);return;}let answered=false;const decide=value=>{if(answered)return;answered=true;done(Boolean(value));};const answer=confirm('You have unsaved KYC changes. Leave without saving?',decide);if(typeof answer==='boolean')decide(answer);};
 const goPop=delta=>{allowedPop=true;(originals.go||navigator.go).call(navigator,delta);};
 for(const method of ['push','replace','go']){
  if(typeof navigator[method]!=='function')continue;originals[method]=navigator[method];
  wrapped[method]=function(...args){ask(allowed=>{if(!allowed)return;if(method==='go')allowedPop=true;originals[method].apply(navigator,args);index=host.history.state?.idx;});};navigator[method]=wrapped[method];
 }
 const pop=event=>{
  if(restoring){restoring=false;event.stopImmediatePropagation();if(pendingPop!==null){const delta=pendingPop;pendingPop=null;goPop(delta);}return;}
  if(allowedPop){allowedPop=false;index=event.state?.idx;return;}
  if(!dirty.current&&!inFlight.current){index=event.state?.idx;return;}
  event.stopImmediatePropagation();const next=event.state?.idx;
  if(!Number.isInteger(index)||!Number.isInteger(next)||index===next){notify('Save this draft before leaving the form.');return;}
  const delta=next-index;restoring=true;host.history.go(-delta);
  ask(allowed=>{if(!allowed)return;if(restoring)pendingPop=delta;else goPop(delta);});
 };
 const unload=event=>{if(dirty.current||inFlight.current){event.preventDefault();event.returnValue='';}};
 host.addEventListener('popstate',pop,true);host.addEventListener('beforeunload',unload);
 return()=>{for(const method of Object.keys(originals))if(navigator[method]===wrapped[method])navigator[method]=originals[method];host.removeEventListener('popstate',pop,true);host.removeEventListener('beforeunload',unload);};
}
export default function useKycNavigationGuard(dirty,inFlight){
 const {navigator}=useContext(UNSAFE_NavigationContext),location=useLocation(),[pending,setPending]=useState(null),request=useRef(null);
 useEffect(()=>installKycNavigationGuard({navigator,dirty,inFlight,host:window,confirm:(message,resolve)=>{if(request.current)return;request.current={message,resolve};setPending(request.current);},notify:message=>toast.error(message)}),[navigator,dirty,inFlight,location.key]);
 const respond=accepted=>{const current=request.current;request.current=null;setPending(null);current?.resolve(accepted);};
 return {pending,respond};
}


