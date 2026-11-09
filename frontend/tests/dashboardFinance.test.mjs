import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
import {latestInstallmentReceipt} from '../src/components/dashboard/employeePresentation.js';
let vite,ui;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/dashboard-finance',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});ui=await vite.ssrLoadModule('/src/components/dashboard/FinancialBreakdown.jsx');});
after(async()=>{await vite?.close();});
test('receipt shortcut selects latest allocated payment without mutating history',()=>{
 const rows=[{_id:'old',paymentDate:'2026-10-28',recordedAt:'2026-10-29'},{_id:'new',paymentDate:'2026-10-29',recordedAt:'2026-10-29'}];
 assert.equal(latestInstallmentReceipt({receiptSummaries:rows})._id,'new');assert.equal(rows[0]._id,'old');assert.equal(latestInstallmentReceipt({}),undefined);
});
const render=(component,props)=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(component,props)));
test('installment breakdown preserves full 800 receipt, 700 allocation and 100 carried forward',()=>{
 const row={dayNumber:2,customerName:'Synthetic',loanNumber:'SYN1',loanId:'loan',dueDate:'2026-10-28',amount:700,paidAmount:700,advanceApplied:0,remaining:0,receiptSummaries:[{_id:'receipt',collectionNumber:'SYN800',amount:800,allocatedAmount:700,paymentDate:'2026-10-28',recordedAt:'2026-10-29',mode:'UPI',collectedByName:'Synthetic Collector',advanceCarriedForward:100,unallocatedAmount:0,otherAllocations:[{scheduleId:'next',dayNumber:3,dueDate:'2026-10-29',amount:100}]}]};
 const html=render(ui.InstallmentLedgerDialog,{row,date:'2026-10-28'});for(const text of ['₹800.00','₹700.00','₹100.00','SYN800','UPI','Synthetic Collector','Not verified by Admin','/employee/collections/receipt/receipt','settlement are separate'])assert.ok(html.includes(text),text);
});
test('remaining breakdown explains prior advance instead of subtracting actual receipts',()=>{
 const data={date:'2026-10-29',target:700,coveredBeforeDate:100,allocatedOnDate:0,remaining:600,collected:0,openingCollectible:600,collectibleAllocatedOnDate:0,previousOverdue:0,todayUnpaid:600,remainingCollectible:600,recoveryBreakdown:[{_id:'s',dayNumber:1,dueDate:'2026-10-29',amount:700,coveredBeforeDate:100,allocatedOnDate:0,remaining:600}]};const html=render(ui.TargetBreakdownDialog,{data});assert.match(html,/₹600.00/);assert.match(html,/₹100.00/);assert.match(html,/Advance or unapplied receipt amounts do not reduce these dues/);
});
test('an unpaid installment shows no fabricated receipt or verification',()=>{
 const html=render(ui.InstallmentLedgerDialog,{row:{dayNumber:3,amount:700,paidAmount:0,remaining:700,advanceApplied:0,receiptSummaries:[]},date:'2026-10-29'});assert.match(html,/No valid receipt allocations/);assert.doesNotMatch(html,/View exact receipt|Admin verified by/);
});
