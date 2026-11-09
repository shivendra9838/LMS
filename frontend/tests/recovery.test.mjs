import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
let vite,Summary,Rows;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/recovery',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});const ui=await vite.ssrLoadModule('/src/components/collections/RecoveryCollections.jsx');Summary=ui.RecoverySummary;Rows=ui.CollectionRows;});
after(async()=>vite?.close());
test('five compact recovery totals separate unpaid dues from actual cash flow',()=>{const html=renderToStaticMarkup(React.createElement(Summary,{data:{totalCustomers:2,todayUnpaid:700,previousOverdue:1300,totalCollectible:2000,collected:800}}));for(const value of ['₹2,000','₹1,300','₹700','₹800','Total Customers','Due Today','Collected Today'])assert.ok(html.includes(value));assert.equal((html.match(/<article/g)||[]).length,5);assert.doesNotMatch(html,/Scheduled Amount/);});

test('one row per loan with a direct amount button, secure identity and collapsed actions',async()=>{const {MemoryRouter}=await import('react-router-dom');const row={loanId:'loan',loanNumber:'LN1',customerId:'customer',customerName:'Synthetic',customerCode:'CUS1',previousOverdue:2700,todayUnpaid:700,totalCollectible:3400,status:'Overdue',collectSchedule:{_id:'schedule'}};const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Rows,{rows:[row]})));for(const value of ['Collect ₹3,400','LN1','Previous Overdue','Installment Breakdown','Receipt History','Follow-up History'])assert.ok(html.includes(value),value);assert.equal((html.match(/<tr>/g)||[]).length,2);assert.doesNotMatch(html,/Day 1/);});

test('fully covered loan shows Paid and exact receipt without a Collect action',async()=>{const {MemoryRouter}=await import('react-router-dom');const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Rows,{rows:[{loanId:'loan',loanNumber:'LN1',customerId:'customer',customerName:'Synthetic',previousOverdue:0,todayUnpaid:0,totalCollectible:0,status:'Paid',latestReceipt:{_id:'receipt'}}]})));assert.match(html,/View Receipt/);assert.match(html,/employee\/collections\/receipt\/receipt/);assert.doesNotMatch(html,/>Collect ₹/);});
