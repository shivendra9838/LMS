import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
let vite,header,overview;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/customer-profile-header',server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'});header=(await vite.ssrLoadModule('/src/components/customers/CustomerProfileHeader.jsx')).default;overview=(await vite.ssrLoadModule('/src/components/customers/CustomerDetailSections.jsx')).CustomerOverview;});
after(async()=>vite?.close());
const render=(component,props)=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(component,props)));
test('shared profile header preserves actual identity, protected photo actions and authorized employee link',()=>{const html=render(header,{customer:{_id:'customer',name:'Synthetic Long Customer Name',customerCode:'CUS-QA',mobile:'9000000001',status:'ACTIVE'},employee:{name:'Synthetic Employee',employeeCode:'EMP-QA'},employeeLink:'/admin/customers/employees/employee',actions:React.createElement('a',{href:'/admin/customers/customer/edit'},'Edit Profile'),onRefresh:()=>{}});for(const value of ['Synthetic Long Customer Name','CUS-QA','tel:9000000001','EMP-QA','Upload / Change Customer Photo','View customer photo','Refresh customer details','/admin/customers/employees/employee'])assert.ok(html.includes(value),value);assert.doesNotMatch(html,/Deactivate Customer|Reassign Customer|Issue Loan|\/uploads\//);});
test('overview separates four financial metrics from three loan counts without fabricated balances',()=>{const html=render(overview,{customer:{totalOutstanding:12600,overdueAmount:0,totalCollected:8400,overdueInstallments:0,loanCount:2,activeLoanCount:1,closedLoanCount:1,nextInstallment:{loanNumber:'LN-QA',dayNumber:13,date:'2026-11-08',amount:700,paidAmount:100,remainingAmount:600,statusLabel:'Partially Paid',displayStatus:'PARTIAL'}}});for(const value of ['₹12,600.00','₹8,400.00','₹600.00','Total loans','Active loans','Closed loans','Scheduled amount','Already paid','LN-QA'])assert.ok(html.includes(value),value);assert.equal((html.match(/class="acd-metric /g)||[]).length,4);assert.match(render(overview,{customer:{}}),/Not recorded/);});

test('approved snapshot and a pending revision have distinct status labels',()=>{const html=render(header,{customer:{_id:'customer',name:'Synthetic',status:'ACTIVE',kycStatus:'APPROVED',kycReviewStatus:'PENDING'}});assert.match(html,/KYC Verified/);assert.match(html,/Current revision: KYC Pending Approval/);});
