import {useRef,useState} from 'react';
import {MoreHorizontal} from 'lucide-react';
import NotificationItem from './NotificationItem';
import {swipeAxis,swipeAction} from '../utils/notificationSwipe';
export default function NotificationCard({row,actions,onDismiss,role}){
 const pointer=useRef(null),suppressClick=useRef(0),[offset,setOffset]=useState(0),busy=actions.pending!==null;
 const finish=e=>{const gesture=pointer.current;if(!gesture||gesture.id!==e.pointerId)return;pointer.current=null;setOffset(0);if(gesture.axis)suppressClick.current=Date.now()+500;const action=swipeAction(e.clientX-gesture.x,gesture.axis);if(!action)return;suppressClick.current=Date.now()+500;if(action==='dismiss')onDismiss(row);else if(!row.readAt)actions.mark(row);};
 return <article className="notification-history-card" aria-label={row.title} onPointerDown={e=>{if(e.isPrimary===false){pointer.current=null;setOffset(0);suppressClick.current=Date.now()+500;return;}if(busy||e.target.closest('details')||e.button>0)return;pointer.current={id:e.pointerId,x:e.clientX,y:e.clientY,axis:null};}} onPointerMove={e=>{const g=pointer.current;if(!g||g.id!==e.pointerId)return;const x=e.clientX-g.x,y=e.clientY-g.y;g.axis=g.axis||swipeAxis(x,y);if(g.axis==='horizontal'){e.currentTarget.setPointerCapture?.(e.pointerId);setOffset(Math.max(-115,Math.min(115,x)));}}} onPointerUp={finish} onPointerCancel={()=>{pointer.current=null;setOffset(0);}} onClickCapture={e=>{if(Date.now()<suppressClick.current){e.preventDefault();e.stopPropagation();}}}>
  <div className="notification-swipe-hint" aria-hidden="true"><span>Mark as read</span><span>Dismiss</span></div>
  <div className={'notification-card-surface '+(offset?'is-swiping':'')} style={{transform:`translateX(${offset}px)`}}>
   <NotificationItem row={row} busy={busy} onOpen={actions.follow}/>
   <details className="notification-card-options"><summary aria-label="Notification actions"><MoreHorizontal size={17}/></summary><div>{!row.readAt&&<button type="button" disabled={busy} onClick={()=>actions.mark(row)}>Mark as read</button>}<button type="button" disabled={busy} onClick={()=>onDismiss(row)}>Dismiss notification</button>{row.paymentContext&&<>{role==='ADMIN'&&row.paymentContext.employee&&<button disabled={busy} onClick={()=>actions.follow(row,'employee')}>View Employee</button>}{role==='ADMIN'&&row.paymentContext.customer&&<button disabled={busy} onClick={()=>actions.follow(row,'customer')}>View Customer</button>}{row.paymentContext.loan&&<button disabled={busy} onClick={()=>actions.follow(row,'loan')}>View Loan</button>}</>}</div></details>
  </div>
 </article>;
}
