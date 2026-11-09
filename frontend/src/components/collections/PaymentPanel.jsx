import {useEffect,useId,useRef} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,X} from 'lucide-react';
import './payment-panel.css';

export default function PaymentPanel({title,subtitle,busy=false,onClose,children,footer}){
 const dialog=useRef(null),id=useId(),state=useRef({busy,onClose});state.current={busy,onClose};
 useEffect(()=>{
  const before=document.activeElement,scrollY=window.scrollY,overflow=document.body.style.overflow,restoration=window.history.scrollRestoration;
  window.history.scrollRestoration='manual';
  const position=Object.fromEntries(['position','top','left','right','width'].map(k=>[k,document.body.style[k]]));
  const openedUrl=window.location.href,marker='payment-panel-'+id;
  const historyFrame=window.requestAnimationFrame(()=>window.history.pushState({...window.history.state,royalPaymentPanel:marker},'',openedUrl));
  const pop=()=>{if(window.history.state?.royalPaymentPanel===marker)return;if(state.current.busy){window.history.pushState({...window.history.state,royalPaymentPanel:marker},'',openedUrl);return;}state.current.onClose();};
  window.addEventListener('popstate',pop);
  Object.assign(document.body.style,{overflow:'hidden',position:'fixed',top:`-${scrollY}px`,left:'0',right:'0',width:'100%'});
  dialog.current?.showModal();
  return()=>{window.cancelAnimationFrame(historyFrame);window.removeEventListener('popstate',pop);dialog.current?.close();if(window.location.href===openedUrl&&window.history.state?.royalPaymentPanel===marker)window.history.back();document.body.style.overflow=overflow;Object.assign(document.body.style,position);window.scrollTo(0,scrollY);window.requestAnimationFrame(()=>{window.scrollTo(0,scrollY);window.history.scrollRestoration=restoration;if(before?.isConnected)before.focus({preventScroll:true});});};
 },[id]);
 const content=<dialog ref={dialog} className="payment-panel" aria-labelledby={id+'-title'} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><header className="payment-panel-header"><button type="button" className="payment-panel-back" aria-label="Back to collections" disabled={busy} onClick={onClose}><ArrowLeft size={20}/></button><div><span className="payment-panel-eyebrow">Royal Enterprises</span><h2 id={id+'-title'}>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button type="button" className="payment-panel-close" aria-label="Close payment panel" disabled={busy} onClick={onClose}><X size={19}/></button></header><div className="payment-panel-body">{children}</div><footer className="payment-panel-footer">{footer}</footer></dialog>;
 return typeof document==='undefined'?content:createPortal(content,document.body);
}
