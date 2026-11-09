import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
let vite,Actions,History,CustomerPaid;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/installment-history',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});Actions=(await vite.ssrLoadModule('/src/components/collections/InstallmentActions.jsx')).default;History=await vite.ssrLoadModule('/src/components/collections/PaymentReviewModal.jsx');CustomerPaid=(await vite.ssrLoadModule('/src/components/collections/CustomerPaid.jsx')).default;});
after(async()=>{await vite?.close();});
const render=node=>renderToStaticMarkup(React.createElement(MemoryRouter,null,node));
test('both portals show History only for installments with recorded allocation evidence',()=>{
 for(const isAdmin of [false,true]){
  const rows=Array.from({length:30},(_,index)=>({_id:'day-'+(index+1),paidAmount:index===0?700:0,hasPaymentHistory:index===0,canCollect:index!==0,customerPaymentReview:{status:index===0?'PENDING_REVIEW':'AWAITING_EMPLOYEE_COLLECTION'}}));
  assert.match(render(React.createElement(Actions,{row:rows[0],isAdmin})),/>History</);
  for(const row of rows.slice(1)){const html=render(React.createElement(Actions,{row,isAdmin}));assert.doesNotMatch(html,/>History</);assert.match(html,isAdmin?/Awaiting Employee Collection/:/Collect Payment/);}
  assert.doesNotMatch(render(React.createElement(Actions,{row:{paidAmount:700,canCollect:false},isAdmin})),/>History</); // a balance alone is not evidence
 }
});
test('partial history presents installment allocation and balance separately from the full receipt',()=>{
 const data={paidAmount:250,remainingAmount:450,statusLabel:'Partially Paid',dueDate:'2026-10-27T18:30:00Z',payments:[{_id:'synthetic-receipt',collectionNumber:'SYN-ADVANCE',allocatedAmount:250,amount:1650,paymentDate:'2026-10-25T18:30:00Z',recordedAt:'2026-10-27T10:00:00Z',mode:'CASH',timing:'PAID_EARLY',eligible:true}]};
 for(const portal of ['employee','admin']){const html=render(React.createElement(History.InstallmentPaymentEntries,{data,portal,readOnly:true}));for(const value of ['250.00','450.00','1,650.00','Partially Paid','Paid Early','Received:','Installment due:','Entered:'])assert.ok(html.includes(value));assert.match(html,new RegExp('/'+portal+'/collections/receipt/synthetic-receipt'));assert.doesNotMatch(html,/>Verify Payment</);}
});
test('empty installment history never displays a loan-level receipt or PAID status',()=>{
 const html=render(React.createElement(History.InstallmentPaymentEntries,{data:{paidAmount:0,remainingAmount:700,statusLabel:'Pending',payments:[]},portal:'employee',readOnly:true}));
 assert.match(html,/No recorded payment allocations for this installment/);assert.doesNotMatch(html,/View full receipt|Verified|PAID/);
});
test('read-only installment dialog keeps financial verification out of Employee and Admin history',()=>{
 for(const portal of ['employee','admin']){const html=render(React.createElement(History.default,{row:{_id:'synthetic-day-1',dayNumber:1,dueDate:'2026-10-25',loanNumber:'SYN-1'},mode:'history',portal,onClose:()=>{}}));assert.match(html,/Payment History/);assert.match(html,/Full loan collection history remains available/);assert.doesNotMatch(html,/Review remarks|Verify Payment/);assert.match(html,/<dialog/);assert.match(html,/payment-panel-body/);assert.match(html,/payment-panel-footer/);}
});

test('₹800 full receipt remains separate from ₹700 allocated and ₹100 carried forward in both portals',()=>{
 const data={dayNumber:2,paidAmount:700,remainingAmount:0,statusLabel:'Paid On Time',payments:[{_id:'extra',collectionNumber:'COL-SYNTHETIC',amount:800,allocatedAmount:700,totalAllocated:800,unallocatedAmount:0,collectedByName:'Synthetic Collector',otherAllocations:[{scheduleId:'day3',dayNumber:3,amount:100,carriedForward:true}],mode:'CASH',paymentDate:'2026-10-28',recordedAt:'2026-10-28'}]};
 for(const portal of ['admin','employee']){const html=render(React.createElement(History.InstallmentPaymentEntries,{data,portal,readOnly:true}));for(const text of ['Total customer payment:','800.00','Allocated to this installment:','700.00','Carried forward to','100.00','Total allocated:','Unallocated:','Synthetic Collector'])assert.ok(html.includes(text),text);}
});


test('verified actions are non-clickable and retain read-only history',()=>{
 const html=render(React.createElement(Actions,{row:{hasPaymentHistory:true,customerPaymentReview:{status:'VERIFIED'}},isAdmin:true}));
 assert.match(html,/Verified/);assert.doesNotMatch(html,/<button[^>]*>Verified<|Verify Payment/);assert.match(html,/>History</);
});
test('Customer Paid shows full receipt only at source installment, advances show no second collection',()=>{
 const receipt={_id:'receipt',collectionNumber:'SYN800',allocationTiming:'PAID_EARLY',isPrimaryInstallment:true,receiptTotal:800,allocatedAmount:700,otherAllocations:[{scheduleId:'3',dayNumber:3,amount:100,carriedForward:true,paidEarly:true}]};
 const source=render(React.createElement(CustomerPaid,{row:{dayNumber:2,receiptSummaries:[receipt]}}));assert.match(source,/800.00/);assert.match(source,/700.00/);assert.match(source,/100.00/);assert.match(source,/advance/);
 const advance=render(React.createElement(CustomerPaid,{row:{dayNumber:3,receiptSummaries:[{...receipt,isPrimaryInstallment:false,allocatedAmount:100}]}}));assert.match(advance,/Advance received:/);assert.match(advance,/100.00/);assert.match(advance,/SYN800/);assert.doesNotMatch(advance,/800.00/);
 const multiple=render(React.createElement(CustomerPaid,{row:{dayNumber:3,receiptSummaries:[{...receipt,isPrimaryInstallment:false,allocatedAmount:100},{...receipt,_id:'next',collectionNumber:'SYN600',receiptTotal:600,allocatedAmount:600,otherAllocations:[]}]}}));assert.match(multiple,/Payment Breakdown/);assert.match(multiple,/2 receipts/);assert.match(multiple,/600.00/);assert.match(multiple,/100.00/);assert.doesNotMatch(multiple,/800.00/);
});

test('late carry-forward is not mislabeled as advance money',()=>{
 const html=render(React.createElement(CustomerPaid,{row:{dayNumber:3,receiptSummaries:[{_id:'late',collectionNumber:'SYN-LATE',isPrimaryInstallment:false,allocationTiming:'PAID_LATE',allocatedAmount:100,receiptTotal:800}]}}));assert.match(html,/Received allocation:/);assert.doesNotMatch(html,/Advance received|800.00/);
});
