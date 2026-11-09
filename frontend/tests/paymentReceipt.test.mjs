import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
let vite,ui;
const receipt={collectionNumber:'SYN-COL-1',customerName:'Synthetic customer',customerCode:'SYN-CUS-1',loanNumber:'SYN-LN-1',amount:250,date:'2026-10-26T09:00:00Z',recordedAt:'2026-10-27T09:00:00Z',generatedAt:'2026-10-27T11:00:00Z',mode:'UPI',transactionReference:'SYN-UPI-REF',status:'PARTIAL',currentLoanOutstanding:20750,receivedBy:{name:'Synthetic Employee',employeeCode:'SYN-EMP-1',role:'EMPLOYEE'},employeeName:'Synthetic Employee',employeeCode:'SYN-EMP-1',receivingDestination:'EMPLOYEE',verification:'NOT_REQUIRED',settlementStatus:'UNSETTLED',allocations:[{scheduleId:'synthetic-day-1',installmentNumber:1,dueDate:'2026-10-27T00:00:00+05:30',installmentAmount:700,amount:250,currentPaidAmount:250,currentRemainingAmount:450,currentStatusLabel:'Partially Paid',timing:'PAID_EARLY'}]};
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/payment-receipt',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});ui=await vite.ssrLoadModule('/src/components/receipts/PaymentReceipt.jsx');});after(async()=>{await vite?.close();});
const render=data=>renderToStaticMarkup(React.createElement(ui.default,{receipt:data}));
test('paper receipt contains actual receipt details, separate dates and no fabricated signature',()=>{
 const html=render(receipt);for(const value of ['PAYMENT RECEIPT','SYN-COL-1','Synthetic customer','SYN-CUS-1','SYN-LN-1','SYN-UPI-REF','Installment 1','250.00','450.00','20,750.00','Computer-generated receipt','26 Oct 2026','27 Oct 2026','Current loan outstanding','not a reconstructed balance','royal-receipt'])assert.ok(html.includes(value),value);
 assert.match(html,/object|rr-logo/);assert.doesNotMatch(html,/Authorized Signature|signature image|<canvas/);
});
test('payment recording, receipt review and company settlement never share a misleading paid or verified status',()=>{
 const pending=render(receipt);assert.match(pending,/Part payment recorded/);assert.match(pending,/Not verified by Admin/);assert.match(pending,/Not settled/);assert.doesNotMatch(pending,/>Verified by Admin</);
 const reviewed=render({...receipt,customerPaymentReview:{status:'VERIFIED',verifiedAt:'2026-10-27T10:00:00Z',verifiedBy:{name:'Synthetic Admin'}}});assert.match(reviewed,/>Verified by Admin</);assert.match(reviewed,/Not settled/);
 const direct=render({...receipt,receivingDestination:'COMPANY',verification:'PENDING',settlementStatus:'NOT_APPLICABLE'});assert.match(direct,/Pending company funds confirmation/);assert.match(direct,/Not applicable - company-direct payment/);assert.doesNotMatch(direct,/Company funds confirmed/);
});
test('missing values remain unavailable, zero values remain zero and legacy allocations are never invented',()=>{
 assert.equal(ui.receiptMoney(null),'Not recorded');assert.equal(ui.receiptMoney(undefined),'Not recorded');assert.match(ui.receiptMoney(0),/0.00/);
 const html=render({...receipt,allocations:[],primaryInstallment:{installmentNumber:1,installmentAmount:700,currentRemainingAmount:450,dueDate:'2026-10-27'},currentLoanOutstanding:null,receivedBy:null});assert.match(html,/No allocation has been inferred/);assert.match(html,/Actor not recorded/);assert.match(html,/Not recorded/);
});
test('missed/waived entries cannot look like successful customer payments',()=>{
 for(const status of ['MISSED','WAIVED']){const html=render({...receipt,amount:0,status,customerPaymentReview:{status:'VERIFIED',verifiedAt:'2026-10-27'}});assert.doesNotMatch(html,/>Verified by Admin</);assert.match(html,status==='MISSED'?/no payment received/:/not a payment/);}
});
test('historical part receipt preserves original amount while clearly labelling current balances after later payments',()=>{
 const html=render({...receipt,amount:200,allocations:[{...receipt.allocations[0],amount:200,currentPaidAmount:700,currentRemainingAmount:0,currentStatusLabel:'Paid'}]});assert.match(html,/200.00/);assert.match(html,/700.00/);assert.match(html,/0.00/);assert.match(html,/Total paid now/);assert.match(html,/Current balances include later recorded payments/);assert.match(html,/Part payment recorded/);
});
