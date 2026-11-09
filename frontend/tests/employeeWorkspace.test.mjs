import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
let vite,ui;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/employee-workspace',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});ui=await vite.ssrLoadModule('/src/components/dashboard/EmployeeWorkspace.jsx');});
after(async()=>{await vite?.close();});
const render=(Component,props)=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Component,props)));
test('customer summaries keep installment history inside breakdown and collect only authorized balances',()=>{
 const installment={_id:'s',loanId:'l',loanNumber:'SYN1',dueDate:'2026-10-28',dayNumber:3,amount:700,paidAmount:0,remaining:700,currentSchedule:{canCollect:false},hasPaymentHistory:false};
 const row={_id:'c',customerId:'c',customerName:'Synthetic Customer',previousOverdue:0,todayDue:700,totalDue:700,remaining:700,received:0,status:'Due Today',currentSchedule:null,loans:[{loanId:'l',loanNumber:'SYN1',remaining:700,installments:[installment]}]};
 const data={date:'2026-10-28',customerCounts:{ALL:1,TODAY:1,PAID:0,OVERDUE:0},customerRows:[row],customerMeta:{page:1,totalPages:1}};
 const html=render(ui.CustomerCollectionTable,{data,search:'',filter:'ALL'});
 assert.doesNotMatch(html,/>History</);assert.match(html,/disabled=""/);assert.match(html,/employee\/loans\/l/);assert.match(html,/All Customers/);
 const partial=render(ui.CustomerCollectionTable,{data:{...data,customerRows:[{...row,todayDue:600,totalDue:600,remaining:600,received:100,status:'Partially Paid',currentSchedule:{_id:'s'},loans:[{...row.loans[0],installments:[{...installment,paidAmount:100,remaining:600,hasPaymentHistory:true}]}]}]},search:'',filter:'ALL'});
 for(const text of ['History','Collect','Partially Paid','₹600.00','₹100.00'])assert.ok(partial.includes(text),text);
});

test('payment tracking keeps actual receipt amount and verification separate from settlement',()=>{
 const html=render(ui.PaymentTracking,{state:{data:{rows:[{_id:'p',amountReceived:800,customerId:{name:'Synthetic'},loanId:{loanNumber:'SYN1'},paymentDate:'2026-10-28',createdAt:'2026-10-28',paymentMode:'CASH',paymentState:'RECORDED'}],meta:{totalPages:1}}}});
 assert.match(html,/₹800.00/);assert.match(html,/Recorded/);assert.match(html,/does not verify company settlement/);assert.match(html,/employee\/collections\/receipt\/p/);assert.doesNotMatch(html,/>Verified</);
});
test('activity feed does not invent milestones when no backend activity exists',()=>{
 const html=render(ui.RecentActivitiesPanel,{feed:{data:{rows:[]},loading:false},actions:{}});
 assert.match(html,/No recent activity yet/);assert.doesNotMatch(html,/Target Completed|Payment Collected/);
});
