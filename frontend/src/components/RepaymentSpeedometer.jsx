import LoadingIndicator from "./ui/Loading";
import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Clock3} from 'lucide-react';
import {moveNeedle,needleAngle} from '../utils/repaymentNeedle';
const Gauge=lazy(()=>import('react-gauge-component'));
export const repaymentBands=[
 {limit:30,label:'Very Bad',range:'0–29',color:'#991b1b'},
 {limit:50,label:'Bad',range:'30–49',color:'#ef4444'},
 {limit:80,label:'Average / Review Required',range:'50–79',color:'#f59e0b'},
 {limit:90,label:'Good',range:'80–89',color:'#22c55e'},
 {limit:100,label:'Excellent',range:'90–100',color:'#10b981'}
];
export function repaymentDisplay(assessment){
 const score=assessment?.score;
 const rated=assessment?.ratingStatus!=='UNRATED'&&(assessment?.ratingStatus==='PROVISIONAL'||assessment?.category!=='INSUFFICIENT_HISTORY')&&typeof score==='number'&&Number.isFinite(score)&&score>=0&&score<=100;
 return {rated,score:rated?score:null,band:rated?repaymentBands.find(b=>score<b.limit)||repaymentBands[4]:null};
}
export function repaymentGaugeOptions(assessment){const {rated,score}=repaymentDisplay(assessment);return {
 type:'semicircle',minValue:0,maxValue:100,value:rated?score:0,
 marginInPercent:{top:.06,bottom:.09,left:.08,right:.08},
 arc:{width:.16,padding:.015,cornerRadius:3,subArcs:repaymentBands.map(({limit,color})=>({limit,color}))},
 pointer:{hide:true,animate:false,animationDuration:0},
 labels:{valueLabel:{hide:true},tickLabels:{type:'outer',hideMinMax:true,ticks:[0,25,50,75,100].map(value=>({value})),defaultTickValueConfig:{formatTextValue:value=>String(value),style:{fill:'#e8e1d4',fontSize:'12px',textShadow:'none'}},defaultTickLineConfig:{color:'#a69b85',length:5,width:1}}}
};}
export default function RepaymentSpeedometer({assessment}){
 const [reduced,setReduced]=useState(()=>typeof window==='undefined'||!window.matchMedia?true:window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [geometry,setGeometry]=useState(null);
 const canvas=useRef(null),dial=useRef(null),needle=useRef(null),drawn=useRef(0);
 const {rated,score,band}=repaymentDisplay(assessment),policy=assessment.policy,ready=Boolean(geometry);
 const options=useMemo(()=>repaymentGaugeOptions({category:rated?'RATED':'INSUFFICIENT_HISTORY',score}),[rated,score]);
 const draw=useCallback(value=>{drawn.current=value;needle.current?.setAttribute('transform',`rotate(${needleAngle(value)})`);needle.current?.setAttribute('data-value',String(value));},[]);
 useEffect(()=>{const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');if(!media)return;const change=()=>setReduced(media.matches);change();media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 // Read the library's final SVG coordinate system, including its measured labels
 // and responsive viewBox. Our sibling SVG is outside D3's redraw ownership.
 useEffect(()=>{let frame;const measure=()=>{frame=undefined;const content=canvas.current?.querySelector('.gauge-content'),arc=canvas.current?.querySelector('.doughnut');if(!content||!arc||!dial.current)return;try{const matrix=content.getScreenCTM(),box=arc.getBBox(),rect=dial.current.getBoundingClientRect();if(!matrix||box.width<=0||rect.width<=0||rect.height<=0)return;const next={width:rect.width,height:rect.height,x:matrix.e-rect.left,y:matrix.f-rect.top,radius:box.width/2*Math.hypot(matrix.a,matrix.b)};setGeometry(old=>old&&Object.keys(next).every(key=>Math.abs(old[key]-next[key])<.1)?old:next);}catch{/* The lazy SVG may still be mounting. */}};
  const queue=()=>{if(frame===undefined)frame=requestAnimationFrame(measure);};
  const changes=new MutationObserver(queue);changes.observe(canvas.current,{childList:true,subtree:true,attributes:true});
  const sizes=new ResizeObserver(queue);sizes.observe(dial.current);queue();
  return()=>{changes.disconnect();sizes.disconnect();if(frame!==undefined)cancelAnimationFrame(frame);};
 },[]);
 useEffect(()=>{if(!ready)return;const controller=new AbortController();if(!rated)draw(0);else moveNeedle({from:drawn.current,to:score,duration:reduced?0:1500,onValue:draw,signal:controller.signal});return()=>controller.abort();},[ready,rated,score,reduced,draw]);
 return <section className="repayment-speedometer" aria-label="Customer Repayment Score">
  <h3>Customer Repayment Score</h3>
  <div ref={dial} className="repayment-dial" aria-hidden="true">
   <div ref={canvas} className="repayment-canvas"><Suspense fallback={<LoadingIndicator message={"Loading repayment gauge…"} className="repayment-dial-loading"/>}><Gauge {...options}/></Suspense></div>
   {geometry&&<svg className="repayment-needle-layer" viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none"><g transform={`translate(${geometry.x} ${geometry.y})`} visibility={rated?'visible':'hidden'}><g ref={needle} className="repayment-needle" data-value={drawn.current} transform={`rotate(${needleAngle(drawn.current)})`}><path d={`M ${-geometry.radius*.78} 0 L 5 -4 L 11 0 L 5 4 Z`} fill="#f8d783" stroke="#fff3cc" strokeWidth="1.2" strokeLinejoin="round"/></g><circle r="7" fill="#191b20" stroke="#f6d17a" strokeWidth="2"/><circle r="3" fill="#f6d17a"/></g></svg>}
  </div>
  <div className="repayment-score" role="status" aria-live="polite" aria-atomic="true"><strong>{rated?<>{score}<small>/100</small></>:'Not Rated Yet'}</strong><span style={band?{color:band.limit<=50?'#fca5a5':band.color}:undefined}>{rated?band.label:<><Clock3 size={16} aria-hidden="true"/> Insufficient History</>}</span></div>
  {assessment.ratingStatus&&<div className="risk-confidence"><strong>{assessment.ratingStatus==='PROVISIONAL'?'Provisional — Limited History':assessment.ratingStatus==='ESTABLISHED'?'Established History':'Insufficient verified history'}</strong><p>{assessment.confidence?.observedInstallments??assessment.metrics.totalDueInstallments} observed due installments · {assessment.confidence?.verifiedCompletedInstallments??assessment.metrics.verifiedCompletedInstallments??0} verified completions</p>{assessment.metrics.legacyCompletedInstallments>0&&<p>{assessment.metrics.legacyCompletedInstallments} completions use existing recorded legacy payment dates; detailed receipt allocations are unavailable.</p>}<p>Confidence: {assessment.confidence?.level||'NONE'} <span>· evidence strength, not a probability</span></p></div>}
  {!rated&&<p className="risk-note">{policy.provisional?<>Provisional scoring requires at least {policy.provisional.minDueInstallments} due installments and {policy.provisional.minVerifiedCompletedInstallments} verified completions with valid payment allocations. Still needed: {assessment.evidenceNeeded?.dueInstallments??Math.max(0,policy.provisional.minDueInstallments-assessment.metrics.totalDueInstallments)} more due installments, {assessment.evidenceNeeded?.verifiedCompletedInstallments??Math.max(0,policy.provisional.minVerifiedCompletedInstallments-(assessment.metrics.verifiedCompletedInstallments||0))} more verified completions. {assessment.metrics.unknownHistoryCount>0&&<>Review {assessment.metrics.unknownHistoryCount} incomplete payment histories.</>}</>:<>Scoring requires at least {policy.minDueInstallments} due and {policy.minCompletedInstallments} completed installments with known payment dates.</>} Future installments do not count as observed due history. Current arrears may still require review independently of a numeric score.</p>}
  {assessment.ratingStatus==='PROVISIONAL'&&<p className="risk-note">This score is provisional. Established history requires at least {policy.minDueInstallments} due and {policy.minCompletedInstallments} completed installments with known payment dates and no incomplete history.</p>}
  <ul className="repayment-band-legend" aria-label="Visual score bands">{repaymentBands.map(b=><li key={b.limit}><i style={{background:b.color}} aria-hidden="true"/><span>{b.range}<br/>{b.label}</span></li>)}</ul>
 </section>;
}
