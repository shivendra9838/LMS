import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
let vite,recovery;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/email-system',server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'});recovery=await vite.ssrLoadModule('/src/pages/employee/PasswordRecovery.jsx');});
after(async()=>{await vite?.close();});
test('Admin and Employee recovery forms use registered account email and OTP without leaking credentials',()=>{
 for(const role of ['ADMIN','EMPLOYEE']){
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(recovery.default,{role})));
  assert.match(html,/Send OTP/);assert.match(html,/one-time code valid for 10 minutes/);assert.match(html,/autoComplete="email"/i);assert.match(html,new RegExp('/'+role.toLowerCase()+'/login'));assert.doesNotMatch(html,/SMTP_PASS|smtp.gmail.com|synthetic-not-a-real-credential/);
 }
});
