/* global window, CustomEvent */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
let vite,api,events;
before(async()=>{globalThis.window={location:{pathname:'/employee/customers'},localStorage:{getItem:()=>null},dispatchEvent:e=>events.push(e)};vite=await createServer({cacheDir:'node_modules/.vite-tests/financial-refresh',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});api=(await vite.ssrLoadModule('/src/services/api.js')).default;});
after(async()=>{await vite?.close();delete globalThis.window;});
const adapter=config=>Promise.resolve({status:200,data:{success:true},headers:{},config});
test('successful payment, correction and loan writes publish a scoped refresh without customer or payment data',async()=>{events=[];for(const [method,url]of [['post','/collections'],['patch','/collections/isolated'],['put','/loans/isolated']])await api.request({method,url,adapter});assert.equal(events.length,3);for(const e of events){assert.equal(e.type,'royal:financial-change');assert.deepEqual(e.detail,{role:'EMPLOYEE'});assert.ok(e instanceof CustomEvent);}});
test('risk reads, unrelated writes and rejected financial writes do not create refresh loops',async()=>{events=[];await api.get('/customer-risk/isolated',{adapter});await api.post('/customers/isolated/photo',{}, {adapter});await assert.rejects(api.post('/collections',{}, {adapter:config=>Promise.reject({config,response:{status:422}})}));assert.equal(events.length,0);assert.equal(window.location.pathname,'/employee/customers');});
