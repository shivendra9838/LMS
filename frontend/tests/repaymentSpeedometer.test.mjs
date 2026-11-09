import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{calculateRisk}=require('../../backend/src/services/customerRiskCalculator');
let vite,ui;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/speedometer',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});ui=await vite.ssrLoadModule('/src/components/RepaymentSpeedometer.jsx');});
after(async()=>{await vite?.close();});
const base=()=>calculateRisk([],[],[],new Date('2026-10-27'));
test('provisional evidence from the backend publishes the exact score with confidence, without upgrading the decision category',()=>{
 const schedules=[1,2,3].map(i=>({_id:'s'+i,loanId:'loan',dayNumber:i,date:`2026-10-${20+i}`,amount:700,paidAmount:700})),receipts=schedules.map(s=>({loanId:'loan',status:'PAID',paymentDate:s.date,amountReceived:700,allocations:[{scheduleId:s._id,amount:700}]}));
 const a=calculateRisk([{_id:'loan',status:'ACTIVE'}],schedules,receipts,new Date('2026-10-27'));
 assert.equal(a.ratingStatus,'PROVISIONAL');assert.equal(a.category,'INSUFFICIENT_HISTORY');assert.equal(ui.repaymentDisplay(a).score,a.score);
 const html=renderToStaticMarkup(React.createElement(ui.default,{assessment:a}));assert.match(html,/Provisional — Limited History/);assert.match(html,/LOW/);assert.match(html,/3.*observed due installments/);assert.doesNotMatch(html,/Test Speedometer|Demo Only|Stop demo/);
});
test('visual bands honor every boundary without changing the three backend categories',()=>{for(const [score,label]of [[0,'Very Bad'],[29,'Very Bad'],[30,'Bad'],[49,'Bad'],[50,'Average / Review Required'],[79,'Average / Review Required'],[80,'Good'],[89,'Good'],[90,'Excellent'],[100,'Excellent']])assert.equal(ui.repaymentDisplay({...base(),score,ratingStatus:'ESTABLISHED',category:score<50?'HIGH_RISK':score<80?'REVIEW_REQUIRED':'GOOD'}).band.label,label);assert.deepEqual(base().policy.thresholds,{good:80,review:50});});
test('missing, invalid and insufficient scores never publish an invented score or visible needle',()=>{for(const a of [base(),{...base(),score:75},{...base(),category:'GOOD',score:null},{...base(),category:'GOOD',score:NaN},{...base(),category:'GOOD',score:101}]){assert.equal(ui.repaymentDisplay(a).score,null);assert.equal(ui.repaymentGaugeOptions(a,false).pointer.hide,true);}const html=renderToStaticMarkup(React.createElement(ui.default,{assessment:base()}));assert.match(html,/Not Rated Yet/);assert.match(html,/at least 3 due installments and 3 verified completions/);assert.match(html,/Insufficient History/);assert.doesNotMatch(html,/aria-valuenow|75\/100|50\/100/);});
test('library only renders bands and markers; the stable SVG layer owns the needle',()=>{const a={...base(),category:'GOOD',ratingStatus:'ESTABLISHED',score:92},options=ui.repaymentGaugeOptions(a);assert.equal(options.value,92);assert.equal(options.pointer.hide,true);assert.equal(options.pointer.animate,false);assert.deepEqual(options.labels.tickLabels.ticks.map(t=>t.value),[0,25,50,75,100]);assert.equal(ui.repaymentGaugeOptions({...a,score:81}).value,81);});

test('real calculator results feed the gauge and preserve repayment policy and input fingerprints',()=>{const schedules=Array.from({length:5},(_,i)=>({_id:'s'+i,loanId:'loan',dayNumber:i+1,date:`2026-10-${20+i}`,amount:700,paidAmount:700,paidDate:`2026-10-${20+i}`})),a=calculateRisk([{_id:'loan',status:'ACTIVE'}],schedules,[],new Date('2026-10-27')),before=JSON.stringify(a);assert.equal(ui.repaymentGaugeOptions(a,false).value,a.score);assert.equal(ui.repaymentDisplay(a).band.label,'Excellent');assert.equal(JSON.stringify(a),before);});
