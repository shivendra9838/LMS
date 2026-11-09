export const boundedScore=value=>Math.max(0,Math.min(100,Number.isFinite(value)?value:0));
export const needleAngle=value=>boundedScore(value)*1.8;

// One cancellable animation driven only by backend assessments.
// The caller keeps the last drawn value so a new assessment continues smoothly.
export function moveNeedle({from,to,duration=1500,onValue,signal,clock={request:callback=>requestAnimationFrame(callback),cancel:handle=>cancelAnimationFrame(handle),now:()=>performance.now()}}){
 return new Promise(resolve=>{
  let frame,finished=false;const start=clock.now(),a=boundedScore(from),b=boundedScore(to);
  const finish=ok=>{if(finished)return;finished=true;if(frame!==undefined)clock.cancel(frame);signal?.removeEventListener('abort',abort);resolve(ok);};
  const abort=()=>finish(false);
  if(signal?.aborted){finish(false);return;}
  signal?.addEventListener('abort',abort,{once:true});
  if(duration<=0||a===b){onValue(b);finish(true);return;}
  onValue(a);
  const draw=time=>{if(finished)return;const t=Math.max(0,Math.min(1,(time-start)/duration)),ease=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;onValue(a+(b-a)*ease);if(t===1)finish(true);else frame=clock.request(draw);};
  frame=clock.request(draw);
 });
}
