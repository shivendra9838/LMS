// Device-independent pointer input. Bitmap and CSS use the same aspect ratio.
export function createSignaturePad(canvas,{onImage,onStart,isBusy=()=>false}){
 let drawing=false,ink=false,disposed=false,generation=0,activePointer=null;
 const ctx=canvas.getContext('2d');
 const point=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height];};
 function clear(){generation++;drawing=false;ink=false;if(activePointer!==null&&canvas.hasPointerCapture(activePointer))canvas.releasePointerCapture(activePointer);activePointer=null;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#172137';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';}
 clear();
 return {
  start(e){if(disposed||drawing||isBusy()||e.button!==0)return;e.preventDefault();generation++;drawing=true;activePointer=e.pointerId;canvas.setPointerCapture(e.pointerId);ctx.beginPath();ctx.moveTo(...point(e));onStart();},
  move(e){if(!drawing||disposed||e.pointerId!==activePointer)return;e.preventDefault();for(const sample of e.getCoalescedEvents?.()||[e]){ctx.lineTo(...point(sample));ctx.stroke();ink=true;}},
  end(e){if(!drawing||disposed||e.pointerId!==activePointer)return;drawing=false;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);activePointer=null;const encodedGeneration=generation;if(ink)canvas.toBlob(blob=>{if(blob&&!disposed&&encodedGeneration===generation)onImage(blob);},'image/png');},
  clear,dispose(){clear();disposed=true;}
 };
}
