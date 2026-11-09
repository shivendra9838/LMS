import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
let vite,Login;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/portal-login',server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'});Login=(await vite.ssrLoadModule('/src/components/PortalLogin.jsx')).default;});
after(async()=>{await vite?.close();});
test('independent portal screens retain accessible controls, original logo and matching recovery link',()=>{
 for(const role of ['ADMIN','EMPLOYEE']){
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Login,{role})));
  assert.match(html,/Royal Enterprises — A Tradition of TRUST/);assert.match(html,/Remember me/);assert.match(html,/Show password/);assert.match(html,/autoComplete="current-password"/i);assert.match(html,/type="submit"/);assert.match(html,new RegExp(`href="/${role.toLowerCase()}/forgot-password"`));
  assert.doesNotMatch(html,/href="\/(admin|employee)\/login"/);assert.match(html,new RegExp(role==='ADMIN'?'Administrator Portal':'Employee Portal'));
  assert.match(html,new RegExp(role==='ADMIN'?'royal-admin-office':'royal-employee-office'));assert.match(html,/object-contain/);assert.doesNotMatch(html,/SMTP_PASS|synthetic-only/);
 }
});
test('employee input reset remains available without adding a portal-switch control',()=>{
 const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Login,{role:'EMPLOYEE'})));assert.match(html,/>Reset</);assert.doesNotMatch(html,/Admin sign in|Administrator\?/);
});
