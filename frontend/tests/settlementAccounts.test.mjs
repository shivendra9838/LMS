import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companyDestinations, employeeSources } from '../src/utils/settlementAccounts.js';
const accounts = [
  {_id:'cash',owner:'COMPANY',active:true,modes:['CASH']},
  {_id:'upi',owner:'COMPANY',active:true,modes:['UPI']},
  {_id:'bank',owner:'COMPANY',active:true,modes:['BANK_TRANSFER','CHEQUE']},
  {_id:'inactive',owner:'COMPANY',active:false,modes:['UPI']},
  {_id:'cheque',owner:'COMPANY',active:true,modes:['CHEQUE']},
  {_id:'source',owner:'EMPLOYEE',active:true,modes:['UPI']},
  {_id:'old-source',owner:'EMPLOYEE',active:false,modes:['BANK_TRANSFER']},
];
test('cash settlement offers only active company cash locations',()=>assert.deepEqual(companyDestinations(accounts,'CASH').map(a=>a._id),['cash']));
test('digital settlement offers active company UPI and bank destinations only',()=>assert.deepEqual(companyDestinations(accounts,'DIGITAL').map(a=>a._id),['upi','bank']));
test('no configuration or invalid kind yields no destinations',()=>{assert.deepEqual(companyDestinations([],'CASH'),[]);assert.deepEqual(companyDestinations(accounts,'INVALID'),[]);});
test('disabled source may remit existing funds, but not appear without available funds',()=>{
  assert.deepEqual(employeeSources(accounts).map(a=>a._id),['source']);
  assert.deepEqual(employeeSources(accounts,[{accountId:'old-source',availableMinor:1}]).map(a=>a._id),['source','old-source']);
});
