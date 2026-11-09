import test from 'node:test';
import assert from 'node:assert/strict';
import {currency,receiptPercent,installmentLabel,timelineWindow} from '../src/components/dashboard/employeePresentation.js';
test('actual receipts above target retain 800 and 114.29 percent independently of target coverage',()=>{
 assert.equal(currency(800),'₹800.00');assert.equal(receiptPercent(800,700),114.29);assert.equal(receiptPercent(0,0),null);
});
test('installments distinguish partial advance, paid advance, due and overdue without inventing payments',()=>{
 const row={dueDate:'2026-10-28T00:00:00+05:30',remaining:600,paidAmount:100};
 assert.equal(installmentLabel(row,'2026-10-27'),'Partially Paid');assert.equal(currency(row.remaining),'₹600.00');
 assert.equal(installmentLabel({...row,remaining:0},'2026-10-27'),'Paid in Advance');
 assert.equal(installmentLabel({...row,remaining:700,paidAmount:0},'2026-10-28'),'Due Today');
 assert.equal(installmentLabel({...row,remaining:700,paidAmount:0},'2026-10-29'),'Overdue');
 assert.equal(installmentLabel({...row,remaining:700,paidAmount:0},'2026-10-27'),'Upcoming');
});
test('timeline window includes the selected day and stays populated after maturity',()=>{
 const rows=Array.from({length:30},(_,i)=>({dayNumber:i+1,dueDate:`2026-10-${String(i+1).padStart(2,'0')}T00:00:00+05:30`}));
 assert.deepEqual(timelineWindow(rows,'2026-10-02').map(r=>r.dayNumber),[1,2,3,4,5]);
 assert.deepEqual(timelineWindow(rows,'2026-12-01').map(r=>r.dayNumber),[26,27,28,29,30]);
 assert.deepEqual(timelineWindow([],'2026-10-28'),[]);
});

test('historical allocation completion uses actual receipt dates for overdue, on-time and early labels',()=>{
 const row={dueDate:'2026-10-28',amount:700,remaining:0,paidAmount:700,receiptSummaries:[{allocatedAmount:200,paymentDate:'2026-10-27'},{allocatedAmount:500,paymentDate:'2026-10-29',review:{verifiedAt:'2026-11-01'}}]};
 assert.equal(installmentLabel(row,'2026-11-02'),'Overdue Paid');
 assert.equal(installmentLabel({...row,receiptSummaries:[{allocatedAmount:700,paymentDate:'2026-10-28'}]},'2026-11-02'),'Paid On Time');
 assert.equal(installmentLabel({...row,receiptSummaries:[{allocatedAmount:700,paymentDate:'2026-10-27'}]},'2026-11-02'),'Paid in Advance');
 assert.equal(installmentLabel({...row,remaining:500,paidAmount:200},'2026-10-29'),'Partially Paid — Overdue');
});
