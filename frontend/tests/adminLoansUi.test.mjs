import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
let vite,ui;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/admin-loans',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});ui=await vite.ssrLoadModule('/src/components/admin-loans/AdminLoanPresentation.jsx');});
after(async()=>vite?.close());
const render=(component,props)=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(component,props)));
const loan={_id:'test-loan',loanNumber:'LN-TEST',loanDate:'2026-10-22T18:30:00Z',loanAmount:20000,totalPayable:21000,remainingAmount:20200,status:'ACTIVE',effectiveStatus:'OVERDUE',customerId:{name:'Synthetic customer',mobile:'9876543210'},employeeId:{name:'Synthetic employee',employeeCode:'EMP-TEST'}};
test('admin loan table and mobile cards preserve source amounts, identity, dates and detail route',()=>{const html=render(ui.AdminLoanResults,{loans:[loan]});for(const value of ['₹20,000.00','₹21,000.00','₹20,200.00','Synthetic customer','9876543210','Synthetic employee','EMP-TEST','23 Oct 2026','/admin/loans/test-loan','Outstanding','Loan Info','al-cards','al-table'])assert.ok(html.includes(value),value);assert.match(html,/al-financial/);assert.match(html,/tel:9876543210/);});
test('effective loan status is authoritative; missing monetary data is never displayed as paid or zero',()=>{const html=render(ui.LoanListStatus,{loan});assert.match(html,/OVERDUE/);assert.doesNotMatch(html,/>ACTIVE</);assert.match(ui.loanCurrency(0),/₹0.00/);assert.equal(ui.loanCurrency(null),'Not available');assert.equal(ui.loanCurrency(undefined),'Not available');const empty=render(ui.AdminLoanResults,{loans:[{_id:'old',loanNumber:'OLD',status:'CLOSED'}]});assert.match(empty,/Customer unavailable/);assert.match(empty,/Employee unavailable/);assert.match(empty,/Not available/);});
test('loading, connection error, empty database and no matching loans have separate accessible states',()=>{const loading=render(ui.AdminLoanState,{loading:true});assert.match(loading,/role="status"/);assert.match(loading,/Loading loans/);const error=render(ui.AdminLoanState,{error:'Connection unavailable',onRetry:()=>{}});assert.match(error,/role="alert"/);assert.match(error,/Retry/);assert.match(error,/Connection unavailable/);assert.match(render(ui.AdminLoanState,{}),/No loans found/);const filtered=render(ui.AdminLoanState,{filtered:true,onClear:()=>{}});assert.match(filtered,/No matching loans/);assert.match(filtered,/Clear Filters/);});

