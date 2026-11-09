import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
let vite,Table,RiskGroup;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/admin-portfolio',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});Table=(await vite.ssrLoadModule('/src/components/portfolios/AdminPortfolioCustomers.jsx')).default;RiskGroup=(await vite.ssrLoadModule('/src/components/CustomerRisk.jsx')).RiskGroup;});
after(async()=>{await vite?.close();});
const customer={_id:'synthetic-customer',name:'Synthetic Portfolio Customer',customerCode:'CUS-TEST',mobile:'9900000011',occupation:'Test business',city:'Test city',area:'Test area',status:'ACTIVE',kycStatus:'APPROVED',kycReviewStatus:'PENDING',activeLoanCount:1,loanCount:3,totalOutstanding:9407.33,overdueAmount:100,overdueInstallments:1,lastPaymentDate:'2026-11-05T12:00:00Z',employee:{name:'Synthetic Employee',employeeCode:'EMP-TEST'}};
const render=rows=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(RiskGroup,{ids:rows.map(c=>c._id)},React.createElement(Table,{rows}))));
test('desktop and mobile reuse secure customer identity, exact routes and existing risk workflow',()=>{const html=render([customer]);for(const text of ['Customer / Contact','Location','Loans (Active / Total)','Test city','Test area','CUS-TEST','9900000011','9,407.33','100.00','View Details','View Risk Details for Synthetic Portfolio Customer','Revision: PENDING','/admin/customers/synthetic-customer'])assert.ok(html.includes(text),text);assert.equal((html.match(/<tr tabindex/g)||[]).length,1);assert.equal((html.match(/<article/g)||[]).length,1);assert.match(html,/>1 \/ 3</);assert.doesNotMatch(html,/http[^\s]*\/uploads\/|65\/100|66\/100/);});
test('empty data creates no fake customers and no loan navigation',()=>{const html=render([]);assert.doesNotMatch(html,/<article|<tbody><tr|\/employee\//);});
test('missing KYC and payment dates use explicit fallbacks',()=>{const html=render([{...customer,kycStatus:null,kycReviewStatus:null,lastPaymentDate:null}]);assert.match(html,/NOT RECORDED/);assert.match(html,/No received payment/);});

test('compact filter controls retain full accessible names and server query values',async()=>{const {PortfolioFilter}=await vite.ssrLoadModule('/src/pages/admin/CustomerPortfolio.jsx');const html=renderToStaticMarkup(React.createElement(PortfolioFilter,{label:'Customer status',value:'ACTIVE',onChange:()=>{}},React.createElement('option',{value:'ACTIVE'},'Active')));assert.match(html,/aria-label="Customer status"/);assert.match(html,/value="ACTIVE" selected/);assert.match(html,/ap-filter-label/);});
test('mobile metadata remains available without a duplicate history or fake extra action menu',()=>{const html=render([customer]);for(const text of ['Location &amp; last received','Last received:','active / total','overdue installments','Open Synthetic Portfolio Customer details'])assert.ok(html.includes(text),text);assert.match(html,/Test business/);assert.doesNotMatch(html,/More actions|Delete customer|Reassign customer/);});
