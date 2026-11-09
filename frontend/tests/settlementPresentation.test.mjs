import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
let vite,ui;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/settlement-presentation',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});ui=await vite.ssrLoadModule('/src/components/settlements/SettlementPresentation.jsx');});
after(async()=>vite?.close());
const render=(component,props)=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(component,props)));
test('twelve primary summary cards use existing minor-unit totals independently',()=>{const html=render(ui.SettlementMetrics,{totals:{collectionsMinor:70000,cashHeldMinor:308167,availableDigitalMinor:70000}});assert.equal((html.match(/<article/g)||[]).length,12);for(const text of ['Customer collections in period','₹700.00','₹3,081.67','Earlier collections still outstanding'])assert.ok(html.includes(text),text);assert.doesNotMatch(html,/Reconciliation difference/);});
test('payment table and mobile cards retain real identity, receipt link and separate custody statuses',()=>{const p={_id:'pos',collectionId:{_id:'receipt',collectionNumber:'SYN-001',customerId:{name:'Synthetic Customer',customerCode:'SYN-C'},loanId:{loanNumber:'SYN-L'}},amountMinor:70000,paymentDate:'2026-11-03T00:00:00+05:30',method:'CASH',bucket:'CASH',verification:'PENDING',settlementStatus:'UNSETTLED'};const html=render(ui.SettlementPayments,{payments:[p]});for(const value of ['Synthetic Customer','SYN-L','SYN-001','₹700.00','UNSETTLED','PENDING','/employee/collections/receipt/receipt'])assert.ok(html.includes(value),value);assert.match(html,/<table/);assert.match(html,/ds-payment-cards/);assert.doesNotMatch(html,/ds-verified/);const admin=render(ui.SettlementPayments,{payments:[p],admin:true});assert.match(admin,/admin\/collections\/receipt\/receipt/);});
test('empty payments explain that installments are not received money',()=>{const html=render(ui.SettlementPayments,{payments:[]});assert.match(html,/No received payments/);assert.match(html,/scheduled installments are not received payments/);});

test('all six accounting details reuse dark summary cards and preserve minor-unit amounts',()=>{
 const html=render(ui.SettlementAccountingDetails,{totals:{submittedMinor:12345,verifiedSettlementsMinor:70000,unclassifiedMinor:0,disputedMinor:900,cashShortageMinor:100,differenceMinor:-200}});
 assert.equal((html.match(/class="ds-stat"/g)||[]).length,6);
 for(const text of ['Submitted, awaiting review','Verified settlements in period','Unclassified historical / legacy funds','Disputed settlements','Observed cash shortage','Reconciliation difference','₹123.45','₹700.00','₹0.00','₹9.00','₹1.00','₹2.00'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/bg-white|text-gray|text-white|glass-panel/);
 const zeros=render(ui.SettlementAccountingDetails,{totals:{}});assert.equal((zeros.match(/₹0.00/g)||[]).length,6);
});
