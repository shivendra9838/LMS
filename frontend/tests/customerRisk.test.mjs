import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{calculateRisk}=require('../../backend/src/services/customerRiskCalculator');
let vite,ui;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/customer-risk',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});ui=await vite.ssrLoadModule('/src/components/CustomerRisk.jsx');});
after(async()=>{await vite?.close();});
const render=a=>renderToStaticMarkup(React.createElement(ui.RiskDetails,{assessment:a}));
test('new customer has neutral insufficient history, no invented score, and decision support warning',()=>{const html=render(calculateRisk([],[],[],new Date('2026-10-27')));assert.match(html,/Insufficient History/);assert.doesNotMatch(html,/100\/100/);assert.match(html,/does not approve, reject or block/);assert.match(html,/repayment-v2/);});
test('adverse behavior details show actual arrears and human explanations',()=>{const s=[1,2,3].map(i=>({_id:'s'+i,loanId:'loan',dayNumber:i,date:'2026-10-2'+i,amount:700,paidAmount:i===1?200:0}));const a=calculateRisk([{_id:'loan',status:'ACTIVE'}],s,[],new Date('2026-10-27'));const html=render(a);assert.match(html,/High Risk/);assert.match(html,/1,900.00/);assert.match(html,/partially paid/);assert.match(html,/Current overdue/);assert.match(html,/Policy /);});
test('all four categories have distinct compact badge labels',()=>{assert.deepEqual(Object.values(ui.riskLabels),['Good','Review Required','High Risk','Insufficient History']);const a=calculateRisk([],[],[]);for(const category of Object.keys(ui.riskLabels))assert.ok(render({...a,category}).includes('risk-'+category));});

test('review category remains visible without a published score, and zero is not hidden',()=>{
 const renderBadge=props=>renderToStaticMarkup(React.createElement(ui.RiskBadge,props));
 const unrated=renderBadge({category:'REVIEW_REQUIRED',score:null,ratingStatus:'UNRATED'});assert.match(unrated,/Review Required/);assert.match(unrated,/Not Rated Yet/);assert.doesNotMatch(unrated,/null|\/100/);
 assert.match(renderBadge({category:'HIGH_RISK',score:0}),/0\/100/);
 for(const category of [undefined,'UNKNOWN']){const html=renderBadge({category,score:67});assert.match(html,/Risk Not Assessed/);assert.doesNotMatch(html,/67\/100|undefined/);}
});
