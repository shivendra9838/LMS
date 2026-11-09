import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
let vite,Summary,kit;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/admin-dashboard',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});Summary=(await vite.ssrLoadModule('/src/pages/admin/Dashboard.jsx')).AdminCollectionSummary;kit=await vite.ssrLoadModule('/src/components/dashboard/DashboardKit.jsx');});
after(async()=>vite?.close());
test('Admin summary separates opening target, actual receipts and remaining without subtracting receipts again',()=>{
 const html=renderToStaticMarkup(React.createElement(Summary,{data:{openingCollectible:2800,collected:800,remainingCollectible:2000,collectionPercent:0}}));
 for(const text of ['₹2,800.00','₹800.00','₹2,000.00','0%','28.57%','advance allocations','same snapshot'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('₹1,200.00'));
});
test('unreconstructable historical remaining is unavailable; genuine zero remains zero',()=>{
 const render=data=>renderToStaticMarkup(React.createElement(Summary,{data}));
 assert.ok(!render({remainingCollectible:2000,collectibleBalanceKnown:false}).includes('₹2,000.00'));
 assert.ok(render({remainingCollectible:0,collectionPercent:null}).includes('₹0.00'));
 assert.match(render({}),/N\/A/);
});
test('mobile accordion retains child form values and accessible heading in its document',()=>{
 const html=renderToStaticMarkup(React.createElement(kit.DashboardPanel,{title:'Daily targets',mobileCollapse:true},React.createElement('input',{defaultValue:'retained remark'})));
 assert.match(html,/<details/);assert.match(html,/<summary/);assert.match(html,/retained remark/);assert.match(html,/<h2>Daily targets/);
});
test('Admin recent settlements distinguish employee, submitted time, transfer time and reversal',()=>{
 const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(kit.RecentSettlements,{admin:true,rows:[{_id:'test-only',employeeId:{name:'Test Employee',employeeCode:'EMP-TEST'},createdAt:'2026-10-26T06:00:00Z',occurredAt:'2026-10-25T06:00:00Z',reviewedAt:'2026-10-27T06:00:00Z',amountMinor:70000,kind:'DIGITAL',status:'REVERSED'}]})));
 for(const text of ['Test Employee','EMP-TEST','Submitted','Reported handover / transfer','Reviewed','REVERSED','₹700.00','/admin/reconciliation'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('Verified'));
});

test('advance receipts can exceed target without an invalid progressbar or fabricated zero-target percentage',()=>{
 const html=renderToStaticMarkup(React.createElement(Summary,{data:{openingCollectible:700,collected:1400,remainingCollectible:0}}));assert.match(html,/200%/);assert.match(html,/aria-valuenow="100"/);assert.match(html,/beyond the opening target/);
 const zero=renderToStaticMarkup(React.createElement(Summary,{data:{openingCollectible:0,collected:700,remainingCollectible:0}}));assert.match(zero,/N\/A/);assert.doesNotMatch(zero,/role="progressbar"/);
});
