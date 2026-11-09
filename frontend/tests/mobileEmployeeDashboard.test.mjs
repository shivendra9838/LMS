import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {timelineCounts} from '../src/components/dashboard/employeePresentation.js';
let vite,ui;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/mobile-employee',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});ui=await vite.ssrLoadModule('/src/components/dashboard/EmployeeWorkspace.jsx');});
after(async()=>{await vite?.close();});
const render=(Component,props)=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Component,props)));
test('mobile timeline counts distinguish completed, partial, future and overdue without crediting unpaid rows',()=>{assert.deepEqual(timelineCounts([{dueDate:'2026-10-27',paidAmount:700,remaining:0},{dueDate:'2026-10-28',paidAmount:100,remaining:600},{dueDate:'2026-10-30',paidAmount:0,remaining:700},{dueDate:'2026-10-29',paidAmount:0,remaining:700},{dueDate:'2026-10-26',paidAmount:0,remaining:700}],'2026-10-29'),{paid:1,partial:1,upcoming:1,overdue:1,due:1});});
test('mobile customer summary counts shared receipts once and leaves allocation detail in the ledger',()=>{
 const row={_id:'c',customerId:'c',customerName:'Synthetic',customerCode:'SYN',previousOverdue:0,todayDue:0,totalDue:0,remaining:0,received:800,status:'Paid',currentSchedule:null,loans:[{loanId:'l',loanNumber:'LN-SYN',remaining:0,installments:[{_id:'s',dayNumber:1,dueDate:'2026-10-28',paidAmount:700,remaining:0,amount:700,hasPaymentHistory:true}]}]};
 const html=render(ui.CustomerCollectionTable,{data:{date:'2026-10-28',customerRows:[row],customerCounts:{ALL:1,TODAY:0,PAID:1,OVERDUE:0}},search:'',filter:'ALL'});
 for(const text of ['Paid / received on date','₹800.00','₹700.00','Collection filters','View Loan','History'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/>Collect /);
});
test('full activity tab uses real rows, pagination and correct overdue/KYC tones',()=>{const html=render(ui.RecentActivitiesPanel,{embedded:true,onPage:()=>{},actions:{},feed:{data:{rows:[{_id:'1',title:'Actual receipt',message:'Synthetic receipt only',createdAt:'2026-10-29'}],page:1,totalPages:2,total:8},loading:false}});assert.match(html,/Actual receipt/);assert.match(html,/Next/);assert.match(html,/ew-activity-chevron/);assert.equal(ui.dashboardActivityVisual({kind:'OVERDUE_REMINDER',category:'REMINDERS'}).tone,'red');assert.equal(ui.dashboardActivityVisual({kind:'KYC_SUBMITTED',category:'KYC'}).tone,'blue');});


test('trend labels render zero receipt days using the chart view box',()=>{const html=render(ui.ReceiptTrendLabel,{viewBox:{x:10,y:60,width:20},value:0});assert.match(html,/₹0/);assert.match(html,/x="20"/);});
