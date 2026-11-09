import test from 'node:test';
import assert from 'node:assert/strict';
import {printPdfPages} from '../src/utils/printPdfPages.js';

function fixture({decodeFails=false}={}) {
  const events=[],sections=[];
  const popup={document:{open:()=>events.push('open'),write:html=>events.push(html),close:()=>events.push('close'),body:{appendChild:node=>sections.push(node)},createElement:tag=>tag==='img'?{decode:async()=>{events.push('decode');if(decodeFails)throw new Error('Synthetic image decode failure');}}:{children:[],appendChild(node){this.children.push(node);}}},focus:()=>events.push('focus'),print:()=>events.push('print')};
  const pdf={numPages:3,getPage:async number=>({getViewport:({scale})=>({width:595.28*scale,height:841.89*scale}),render:({viewport})=>{assert.ok(viewport.height>viewport.width);events.push('render '+number);return {promise:Promise.resolve()};}})};
  const document={createElement:tag=>{assert.equal(tag,'canvas');return {getContext:()=>({}),toDataURL:type=>{assert.equal(type,'image/png');return 'data:image/png;base64,synthetic';}};}};
  return {popup,pdf,document,events,sections};
}

test('A4 print pipeline renders and decodes every page before opening the printer dialog',async()=>{
  const f=fixture(),previous=globalThis.document;globalThis.document=f.document;
  try {
    await printPdfPages(f.pdf,f.popup);
    assert.equal(f.sections.length,3);
    assert.match(f.events[1],/@page\{size:A4;margin:0\}/);
    assert.match(f.events[1],/page:last-child\{break-after:auto/);
    assert.deepEqual(f.sections.map(s=>s.className),['page','page','page']);
    assert.deepEqual(f.sections.map(s=>s.children[0].alt),['KYC page 1','KYC page 2','KYC page 3']);
    assert.deepEqual(f.events.slice(-2),['focus','print']);
    assert.equal(f.events.filter(e=>e==='decode').length,3);
    assert.ok(f.sections.every(s=>s.children[0].src.startsWith('data:image/png;')));
  } finally {globalThis.document=previous;}
});

test('a failed page cannot silently print an incomplete application',async()=>{
  const f=fixture({decodeFails:true}),previous=globalThis.document;globalThis.document=f.document;
  try {await assert.rejects(printPdfPages(f.pdf,f.popup),/Synthetic image decode failure/);assert.ok(!f.events.includes('print'));}
  finally {globalThis.document=previous;}
});

test('receipt printing uses the actual title, higher-resolution A4 pages and receipt alt text without changing KYC defaults',async()=>{
 const f=fixture(),previous=globalThis.document;globalThis.document=f.document;
 try{await printPdfPages(f.pdf,f.popup,{title:'Royal Enterprises Payment Receipt COL-TEST',pageLabel:'Receipt page',scale:2});assert.equal(f.popup.document.title,'Royal Enterprises Payment Receipt COL-TEST');assert.deepEqual(f.sections.map(s=>s.children[0].alt),['Receipt page 1','Receipt page 2','Receipt page 3']);assert.equal(f.sections.length,3);assert.equal(f.events.at(-1),'print');}finally{globalThis.document=previous;}
});
