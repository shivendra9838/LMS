import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './loading.css';

// Original SVG geometry: twelve rounded bars. No external GIF or artwork is embedded.
export function Spinner({size='sm',className=''}){return <span className={'royal-spinner royal-spinner-'+size+' '+className} aria-hidden="true"><svg viewBox="0 0 40 40" focusable="false">{Array.from({length:12},(_,index)=><rect key={index} x="18.4" y="2" width="3.2" height="9" rx="1.6" transform={'rotate('+index*30+' 20 20)'} opacity={(index+1)/12}/>)}</svg></span>;}

export default function LoadingIndicator({active=true,message='Loading…',variant='inline',className='',label}){if(!active)return null;return <span className={'royal-loading royal-loading-'+variant+' '+className} role="status" aria-live="polite" aria-atomic="true" aria-label={label||message}><Spinner size={variant==='page'?'lg':variant==='section'?'md':'sm'}/><span>{message}</span></span>;}

export function LoadingButton({busy=false,loadingText='Saving changes…',disabled,children,className='',onClick,type,...props}){
 const [initiated,setInitiated]=useState(Boolean(busy));
 useEffect(()=>{if(!initiated||busy)return;const timer=setTimeout(()=>setInitiated(false),150);return()=>clearTimeout(timer);},[initiated,busy]);
 const show=Boolean(busy&&initiated);
 return <button type={type} disabled={disabled||busy} {...props} className={'royal-loading-button '+className} aria-busy={show} onClick={event=>{setInitiated(true);onClick?.(event);}}>{show?<><Spinner/><span className="royal-loading-button-label" role="status" aria-live="polite">{loadingText}</span></>:children}</button>;
}

export function ProcessingOverlay({active=false,message='Processing…',description='Please keep this page open while the operation is confirmed.',delayMs=350}){
 const [visible,setVisible]=useState(false),dialog=useRef(null);
 useEffect(()=>{if(!active){setVisible(false);return;}const timer=setTimeout(()=>setVisible(true),delayMs);return()=>clearTimeout(timer);},[active,delayMs]);
 useEffect(()=>{if(!visible||!active)return;const previous=document.activeElement,overflow=document.body.style.overflow,node=dialog.current;document.body.style.overflow='hidden';node?.showModal();node?.focus();return()=>{node?.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true});};},[visible,active]);
 if(!active||!visible||typeof document==='undefined')return null;
 return createPortal(<dialog ref={dialog} tabIndex={-1} className="royal-processing" aria-label={message} onCancel={event=>event.preventDefault()}><LoadingIndicator variant="section" message={message}/><p>{description}</p></dialog>,document.body);
}
