import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {MemoryRouter} from 'react-router-dom';
import {renderToStaticMarkup} from 'react-dom/server';
let vite,Actions,Modal;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/installment-sequence',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});Actions=(await vite.ssrLoadModule('/src/components/collections/InstallmentActions.jsx')).default;Modal=(await vite.ssrLoadModule('/src/components/collections/RecordPaymentModal.jsx')).default;});
after(async()=>{await vite?.close();});
const render=(row,isAdmin=false)=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Actions,{row,isAdmin})));
test('Day 3 is collectible; later unpaid days show disabled Locked with a visible reason in both portals',()=>{const next={_id:'day3',canCollect:true,dayNumber:3,customerPaymentReview:{status:'AWAITING_EMPLOYEE_COLLECTION'}};assert.match(render(next),/>Collect Payment</);assert.match(render(next,true),/Awaiting Employee Collection/);for(let day=4;day<=30;day++)for(const isAdmin of [false,true]){const html=render({canCollect:false,collectionLocked:true,dayNumber:day,collectionLockReason:`Complete Day 3 payment before collecting Day ${day}.`,hasPaymentHistory:false},isAdmin);assert.match(html,/disabled=""/);assert.match(html,/>Locked</);assert.match(html,new RegExp(`before collecting Day ${day}`));assert.doesNotMatch(html,/Collect Payment|>History<|Verify Payment/);}});
test('partial installment remains collectible; locked historical receipts retain their own history and Admin review',()=>{assert.match(render({canCollect:true,paidAmount:300,hasPaymentHistory:true}),/>History</);assert.match(render({canCollect:true,paidAmount:300,hasPaymentHistory:true}),/>Collect Payment</);const html=render({canCollect:false,collectionLocked:true,collectionLockReason:'Complete Day 3 first.',hasPaymentHistory:true,customerPaymentReview:{status:'PENDING_REVIEW'}},true);assert.match(html,/>Locked</);assert.match(html,/>History</);assert.match(html,/>Verify Payment</);});
test('inconsistent client collect flags cannot turn a locked row into Collect Payment',()=>{assert.doesNotMatch(render({canCollect:true,collectionLocked:true,collectionLockReason:'Earlier balance remains.'}),/Collect Payment/);});
test('record form explains sequential advance allocation and cannot submit without a server quote',()=>{const html=renderToStaticMarkup(React.createElement(Modal,{isOpen:true,schedule:{_id:'synthetic',dayNumber:3,amount:700,paidAmount:300,loanRemainingAmount:19300,canCollect:true,dueDate:'2026-10-28'},onClose:()=>{}}));assert.match(html,/earliest unpaid installment/);assert.match(html,/including advances/);assert.match(html,/₹400/);assert.match(html,/type="submit" disabled=""/);});

test('multi-loan customer collection selects one loan and never submits a combined receipt to another loan',()=>{
 const schedule={_id:'s1',loanId:'l1',dayNumber:1,amount:700,paidAmount:0,canCollect:true,dueDate:'2026-10-28'};
 const html=renderToStaticMarkup(React.createElement(Modal,{isOpen:true,schedule,onClose:()=>{},onLoanChange:()=>{},customerCollection:{customerName:'Synthetic combined',remaining:1400,loans:[{loanId:'l1',loanNumber:'LN1',remaining:700,currentSchedule:schedule},{loanId:'l2',loanNumber:'LN2',remaining:700,currentSchedule:{...schedule,_id:'s2',loanId:'l2'}}]}}));
 for(const text of ['Combined customer dues','1,400.00','Collect for loan','LN1','LN2','One receipt applies to the selected loan'])assert.ok(html.includes(text),text);
 assert.match(html,/option value="l1" selected=""/);assert.match(html,/type="submit" disabled=""/);
});
