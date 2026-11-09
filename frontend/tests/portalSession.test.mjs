import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { Buffer } from 'node:buffer';
import api from '../src/services/api.js';
import { getPortalSession, savePortalSession, clearPortalSession, sessionKey, portalRole, isSessionStorageKey } from '../src/utils/portalSession.js';

class Storage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key,value) { this.data.set(key,String(value)); }
  removeItem(key) { this.data.delete(key); }
}
const session = (role,id=role.toLowerCase()) => ({user:{id,role},token:`header.${Buffer.from(JSON.stringify({id,role})).toString('base64url')}.signature`});
beforeEach(()=>{
  globalThis.window = Object.assign(new globalThis.EventTarget(), {localStorage:new Storage(),location:{pathname:'/admin/reconciliation',href:''}});
});

test('Admin and Employee sign-ins persist independently; logout affects only its portal',()=>{
  const admin=session('ADMIN'),employee=session('EMPLOYEE');
  savePortalSession('ADMIN',admin); savePortalSession('EMPLOYEE',employee);
  assert.deepEqual(getPortalSession('ADMIN'),admin); assert.deepEqual(getPortalSession('EMPLOYEE'),employee);
  clearPortalSession('EMPLOYEE'); assert.equal(getPortalSession('EMPLOYEE'),null);assert.deepEqual(getPortalSession('ADMIN'),admin);
});
test('legacy session migrates only to the matching role and wrong-role login never overwrites another portal',()=>{
  const employee=session('EMPLOYEE');globalThis.window.localStorage.setItem('token',employee.token);globalThis.window.localStorage.setItem('user',JSON.stringify(employee.user));
  assert.equal(getPortalSession('ADMIN'),null);assert.deepEqual(getPortalSession('EMPLOYEE'),employee);
  assert.throws(()=>savePortalSession('ADMIN',employee));
  savePortalSession('ADMIN',session('ADMIN'));assert.deepEqual(getPortalSession('EMPLOYEE'),employee);
  savePortalSession('EMPLOYEE',employee);assert.equal(globalThis.window.localStorage.getItem('token'),null);
});
test('malformed storage and mismatched JWT role or identity cannot render an authorized portal',()=>{
  globalThis.window.localStorage.setItem(sessionKey('ADMIN'),'{broken');assert.equal(getPortalSession('ADMIN'),null);
  const wrong=session('EMPLOYEE');wrong.user={id:'employee',role:'ADMIN'};
  globalThis.window.localStorage.setItem(sessionKey('ADMIN'),JSON.stringify(wrong));assert.equal(getPortalSession('ADMIN'),null);
  const identity=session('ADMIN');identity.user.id='someone-else';assert.throws(()=>savePortalSession('ADMIN',identity));
});
test('portal routing and storage events ignore the other portal session',()=>{
  assert.equal(portalRole('/admin/reconciliation'),'ADMIN');assert.equal(portalRole('/employee/settlements'),'EMPLOYEE');assert.equal(portalRole('/administrator'),null);
  assert.equal(isSessionStorageKey(sessionKey('EMPLOYEE'),'ADMIN'),false);assert.equal(isSessionStorageKey(sessionKey('ADMIN'),'ADMIN'),true);
});

test('Axios sends the Admin JWT from Admin, even after an Employee login in shared browser storage',async()=>{
  const admin=session('ADMIN'),employee=session('EMPLOYEE');savePortalSession('ADMIN',admin);savePortalSession('EMPLOYEE',employee);
  const adapter=async config=>({data:config.headers.Authorization,status:200,statusText:'OK',headers:{},config});
  assert.equal((await api.get('/settlements/accounts',{adapter})).data,`Bearer ${admin.token}`);
  globalThis.window.location.pathname='/employee/settlements';
  assert.equal((await api.get('/settlements/accounts',{adapter})).data,`Bearer ${employee.token}`);
});
test('public login requests omit existing credentials and failed login does not erase a valid session',async()=>{
  const admin=session('ADMIN');savePortalSession('ADMIN',admin);
  const adapter=async config=>{assert.equal(config.headers.Authorization,undefined);throw new axios.AxiosError('Invalid credentials','ERR_BAD_REQUEST',config,null,{status:401,config});};
  await assert.rejects(api.post('/auth/login',{}, {adapter}));assert.deepEqual(getPortalSession('ADMIN'),admin);
});
test('401 clears only the failed session; late responses cannot clear a newer login',async()=>{
  const admin=session('ADMIN'),employee=session('EMPLOYEE');savePortalSession('ADMIN',admin);savePortalSession('EMPLOYEE',employee);
  const fail=async config=>{throw new axios.AxiosError('Expired','ERR_BAD_REQUEST',config,null,{status:401,config});};
  await assert.rejects(api.get('/settlements/accounts',{adapter:fail}));assert.equal(getPortalSession('ADMIN'),null);assert.deepEqual(getPortalSession('EMPLOYEE'),employee);
  savePortalSession('ADMIN',admin);globalThis.window.location.href='';
  const newer=session('ADMIN','new-admin');
  await assert.rejects(api.get('/settlements/accounts',{adapter:async config=>{savePortalSession('ADMIN',newer);return fail(config);}}));
  assert.deepEqual(getPortalSession('ADMIN'),newer);assert.equal(globalThis.window.location.href,'');
});

test('Remember Me chooses persistence independently without extending or mixing portal identities',()=>{
 globalThis.window.sessionStorage=new Storage();const admin=session('ADMIN'),employee=session('EMPLOYEE');savePortalSession('ADMIN',admin);savePortalSession('EMPLOYEE',employee,globalThis.window.sessionStorage);
 assert.equal(globalThis.window.localStorage.getItem(sessionKey('EMPLOYEE')),null);assert.ok(globalThis.window.sessionStorage.getItem(sessionKey('EMPLOYEE')));assert.deepEqual(getPortalSession('EMPLOYEE'),employee);assert.deepEqual(getPortalSession('ADMIN'),admin);
 clearPortalSession('EMPLOYEE');assert.equal(globalThis.window.sessionStorage.getItem(sessionKey('EMPLOYEE')),null);assert.deepEqual(getPortalSession('ADMIN'),admin);
});
test('expired portal claims cannot authorize direct frontend navigation',()=>{
 const expired=session('ADMIN');expired.token=`header.${Buffer.from(JSON.stringify({id:'admin',role:'ADMIN',exp:1})).toString('base64url')}.signature`;
 globalThis.window.localStorage.setItem(sessionKey('ADMIN'),JSON.stringify(expired));assert.equal(getPortalSession('ADMIN'),null);assert.throws(()=>savePortalSession('ADMIN',expired));
});
