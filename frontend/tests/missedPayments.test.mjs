import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
let vite,Results;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/missed-payments',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});Results=(await vite.ssrLoadModule('/src/pages/admin/MissedPayments.jsx')).MissedPaymentResults;});
after(async()=>vite?.close());
const row={_id:'installment-1',loanId:'loan-1',loanNumber:'LN-TEST',dayNumber:6,dueDate:'2026-11-01T18:30:00Z',customerName:'Synthetic Customer',employeeName:'Synthetic Employee',remainingAmount:600.35,type:'MISSED_PAYMENT',title:'Overdue installment · LN-TEST',message:'Original overdue details retained',status:'UNRESOLVED'};
const render=notifications=>renderToStaticMarkup(React.createElement(Results,{notifications,onViewLoan:()=>{}}));
test('desktop table and mobile cards preserve actual overdue fields and view-loan action',()=>{const html=render([row]);for(const value of ['mp-table','mp-cards','02 Nov 2026','LN-TEST','Synthetic Customer','Synthetic Employee','₹600.35','UNRESOLVED','View Loan','Original overdue details retained','Original installment due date'])assert.ok(html.includes(value),value);for(const label of ['Date','Loan ID','Customer','Due Amount','Employee'])assert.ok(html.includes(label));assert.match(html,/scope="col"/);assert.match(html,/role="listitem"/);});
test('missing amounts are not invented as zero; general notices retain original information',()=>{const html=render([{_id:'general',type:'GENERAL',createdAt:'2026-11-01T00:00:00Z',title:'Original notice',message:'Original message'}]);assert.match(html,/Not available/);assert.match(html,/Assignment requires review/);assert.match(html,/disabled=""/);assert.match(html,/Original message/);assert.doesNotMatch(html,/₹0.00/);});
test('empty result remains accessible and has no stale table or cards',()=>{const html=render([]);assert.match(html,/role="status"/);assert.match(html,/No Missed Payments/);assert.doesNotMatch(html,/<table|role="listitem"/);});

