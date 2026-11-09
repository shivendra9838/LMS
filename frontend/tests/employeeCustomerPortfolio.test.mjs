import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
let vite,ui,Page;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/employee-customers',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});ui=await vite.ssrLoadModule('/src/components/EmployeeCustomerPortfolio.jsx');Page=(await vite.ssrLoadModule('/src/pages/employee/CustomerList.jsx')).default;});
after(async()=>{await vite?.close();});
const render=(component,props)=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(component,props)));
const customer={_id:'synthetic-id',name:'Synthetic Customer',customerCode:'CUS-TEST',mobile:'9900000011',occupation:'Test business',city:'Test city',area:'Test area',status:'ACTIVE',activeLoanCount:1,overdueInstallments:0,risk:{category:'INSUFFICIENT_HISTORY',score:null,ratingStatus:'UNRATED'}};
test('customer rows/cards reuse exact existing routes, secure photo fallback and real unrated behavior',()=>{
 const html=render(ui.CustomerPortfolioTable,{rows:[customer]});
 for(const text of ['Synthetic Customer','CUS-TEST','9900000011','Test city','Test business','Insufficient History','View Risk Details','/employee/customers/synthetic-id','/employee/loans?customer=synthetic-id','More actions for Synthetic Customer','Edit Synthetic Customer'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/100\/100|Good|At Risk<|http[^\s]*\/uploads\//);assert.match(html,/tabindex="0"/);assert.match(html,/tel:9900000011/);assert.match(html,/pc-more-menu[\s\S]*>Edit Customer<\/a>/);
});
test('approved KYC profiles use revision workflow and keep account status separate from risk',()=>{
 const html=render(ui.CustomerPortfolioTable,{rows:[{...customer,kycLeadId:'approved-kyc',status:'INACTIVE',overdueInstallments:2,risk:{category:'HIGH_RISK',score:20}}]});
 assert.match(html,/View \/ Revise KYC for Synthetic Customer/);assert.match(html,/\/employee\/customers\/synthetic-id\/kyc/);assert.match(html,/Inactive/);assert.match(html,/High Risk/);assert.match(html,/2 overdue/);assert.doesNotMatch(html,/aria-label="Edit Synthetic Customer"/);
});
test('compact pager reports actual boundaries, current page and empty portfolios',()=>{
 const html=render(ui.CustomerPortfolioPager,{meta:{page:2,limit:10,total:12,totalPages:2}});assert.match(html,/Showing 11–12 of 12 customers/);assert.match(html,/aria-current="page"/);assert.match(html,/Next page/);
 assert.match(render(ui.CustomerPortfolioPager,{meta:{page:1,limit:10,total:0,totalPages:0}}),/Showing 0–0 of 0 customers/);
});
test('initial page contains functional destinations and loading states without fabricated statistics',()=>{
 const html=render(Page);for(const text of ['My Customers','Add Customer KYC','/employee/customers/add','/employee/customers/risk','/employee/customers/kyc','Export Customer List','Total Customers','Active Customers','At Risk / Insufficient','Inactive / Closed','Loading your authorized customer portfolio'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/42 customers|this month|90% of total/);
});
