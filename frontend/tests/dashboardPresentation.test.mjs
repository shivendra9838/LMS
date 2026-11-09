import test from 'node:test';
import {URLSearchParams} from 'node:url';
import assert from 'node:assert/strict';
import {amount,count,dailySeries,reportQuery,initialReportFilters} from '../src/components/dashboard/presentation.js';

test('missing financial data is unavailable, not a fabricated zero balance',()=>{
  for(const value of [undefined,null,NaN,Infinity]){assert.equal(amount(value),'—');assert.equal(count(value),'—');}
  assert.equal(amount(0),'₹0.00');assert.equal(amount(2100),'₹2,100.00');assert.equal(amount(1234.5),'₹1,234.50');
});
test('daily chart uses real business-date rows chronologically and does not fabricate gaps',()=>{
  const rows=[{date:'2026-10-26',collectionAmount:1400},{date:'2026-10-23',collectionAmount:700},{_id:'obsolete-key',collectionAmount:900}];
  assert.deepEqual(dailySeries(rows).map(row=>row.date),['2026-10-23','2026-10-26']);
  assert.equal(rows[0].date,'2026-10-26');assert.equal(dailySeries(rows)[1].collectionAmount,1400);
});
test('large trend preview retains the latest 31 returned business days in order',()=>{
  const rows=Array.from({length:40},(_,i)=>({date:new Date(Date.UTC(2026,8,i+1)).toISOString().slice(0,10),collectionAmount:i}));
  const preview=dailySeries(rows.reverse());assert.equal(preview.length,31);assert.equal(preview[0].collectionAmount,9);assert.equal(preview.at(-1).collectionAmount,39);
});
test('report dates cross year boundaries safely and filters keep literal values encoded',()=>{
  assert.deepEqual(initialReportFilters('2026-01-05'),{startDate:'2025-12-23',endDate:'2026-01-05',employeeId:'',city:'',area:'',status:'',paymentMode:''});
  const query=reportQuery({area:'A&B + C',city:'',paymentMode:'UPI'}),params=new URLSearchParams(query);
  assert.equal(params.get('area'),'A&B + C');assert.equal(params.has('city'),false);assert.equal(params.get('paymentMode'),'UPI');
});    
