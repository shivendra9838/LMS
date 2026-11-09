import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentAmountError} from '../src/utils/minimumPayment.js';
test('amount validates in paise with the exact minimum message',()=>{
 assert.equal(paymentAmountError('1090.01',1090.02,21000),'Minimum payment required is ₹1,090.02. Please enter this amount or more.');
 for(const amount of ['1090.02','1200','21000'])assert.equal(paymentAmountError(amount,1090.02,21000),'');
 assert.match(paymentAmountError('21000.01',1090.02,21000),/exceeds/);
});
test('invalid amounts blocked, empty stays quiet and no-due advances remain valid',()=>{
 for(const amount of ['0','-1','NaN','Infinity','1.001','1e3','01'])assert.match(paymentAmountError(amount),/positive amount/);
 assert.equal(paymentAmountError('',100),'');assert.equal(paymentAmountError('0.01',0,100),'');
});
