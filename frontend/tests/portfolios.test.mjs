import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
let vite,ui;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/portfolios',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});ui=await vite.ssrLoadModule('/src/components/portfolios/PortfolioUi.jsx');});
after(async()=>{await vite?.close();});
test('personal-details API empty metadata does not render pagination or crash',()=>{
 for(const meta of [undefined,{},null])assert.equal(renderToStaticMarkup(React.createElement(ui.Pager,{meta,change:()=>{}})),'');
});
test('empty paginated portfolios display zero results and disabled navigation',()=>{
 const html=renderToStaticMarkup(React.createElement(ui.Pager,{meta:{total:0,page:1,totalPages:0},change:()=>{}}));
 assert.match(html,/0 results/);assert.match(html,/Page 1 of 1/);assert.equal((html.match(/disabled/g)||[]).length,2);
});
test('customer pages expose the correct total and enable forward navigation',()=>{
 const html=renderToStaticMarkup(React.createElement(ui.Pager,{meta:{total:650,page:1,totalPages:33},change:()=>{}}));
 assert.match(html,/650 results/);assert.match(html,/Page 1 of 33/);assert.equal((html.match(/disabled/g)||[]).length,1);
});
test('settings lists retain nested pagination while portfolio lists retain outer pagination',()=>{
 assert.deepEqual(ui.readPayload({data:{rows:[],meta:{total:3,page:1}},meta:{}}),{rows:[],meta:{total:3,page:1}});
 assert.deepEqual(ui.readPayload({data:{rows:[]},meta:{total:4,page:1}}),{rows:[],meta:{total:4,page:1}});
});
