import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
let vite,ui;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/customer-details',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});ui=await vite.ssrLoadModule('/src/pages/employee/CustomerDetails.jsx');});
after(async()=>vite?.close());
const customer={_id:'synthetic',name:'Synthetic Customer',customerCode:'SYN-C',status:'ACTIVE',fatherName:'Synthetic parent',age:35,occupation:'Shop',address:'Synthetic address',mobile:'9300000000',kycLeadId:'synthetic-lead',idProofNumber:'123456789012',financialSummary:{loanCount:1,totalOutstanding:20200,overdueAmount:1300,overdueDays:2}};
const render=(c=customer)=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(ui.CustomerDetailsView,{customer:c})));
test('details show real aggregate fields, masked identity and existing protected routes',()=>{const html=render();for(const text of ['₹20,200.00','₹1,300.00','********9012','/employee/customers/synthetic/kyc','/employee/customers/synthetic/loans/new','Personal Information','Contact &amp; Address','Identity Proof','Timeline'])assert.ok(html.includes(text),text);assert.doesNotMatch(html,/123456789012/);assert.match(html,/View customer photo/);});
test('missing summary never fabricates zero balances and inactive customer has no issuance action',()=>{const html=render({...customer,status:'INACTIVE',financialSummary:undefined});assert.match(html,/Unavailable/);assert.doesNotMatch(html,/Issue Loan|\/loans\/new/);assert.match(html,/No recorded timeline events/);});

test('approved KYC with no loans shows actual verification independently of inactive account status',()=>{const html=render({...customer,status:'INACTIVE',financialSummary:{loanCount:0,activeLoanCount:0,closedLoanCount:0,totalOutstanding:0,overdueAmount:0,totalCollected:0,overdueInstallments:0,nextInstallment:null,kycStatus:'APPROVED',kycReviewStatus:'APPROVED'}});assert.match(html,/KYC Verified/);assert.match(html,/INACTIVE/);assert.match(html,/No loans issued yet/);assert.doesNotMatch(html,/Issue Loan|Reassign Customer|Deactivate Customer|Approve &amp; Assign/);assert.match(html,/₹0.00/);});
test('pending, returned and rejected KYC never infer verification from an active account',()=>{for(const [status,label]of [['PENDING','KYC Pending Approval'],['CORRECTION_REQUIRED','KYC Corrections Required'],['REJECTED','KYC Rejected']]){const html=render({...customer,financialSummary:{...customer.financialSummary,kycStatus:status,kycReviewStatus:status}});assert.ok(html.includes(label));assert.doesNotMatch(html,/KYC Verified/);assert.match(html,/ACTIVE/);}});
