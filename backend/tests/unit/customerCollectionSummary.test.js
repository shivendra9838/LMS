const {summarize}=require('../../src/utils/customerCollectionSummary');
const date='2026-11-05',customers=[{_id:'c1',name:'First',customerCode:'CUS1',mobile:'9000000001'},{_id:'c2',name:'Second',customerCode:'CUS2'}];
const row=(n,extra={})=>({_id:'s'+n,customerId:'c1',loanId:'l1',loanNumber:'LN1',dueDate:date,amount:700,remaining:700,paidAmount:0,activeAtDate:true,currentSchedule:{canCollect:n===0,_id:'s'+n,loanId:'l1'},...extra});
test('ninety installments yield two assigned customer summaries including multiple loans',()=>{
 const rows=Array.from({length:90},(_,i)=>row(i,{customerId:i<60?'c1':'c2',loanId:i<30?'l1':i<60?'l2':'l3',loanNumber:'LN'+(i<30?1:i<60?2:3)})),before=JSON.stringify(rows),result=summarize(customers,rows,date);
 expect(result).toHaveLength(2);expect(result[0].loans).toHaveLength(2);expect(result[0].remaining).toBe(42000);expect(JSON.stringify(rows)).toBe(before);
});
test('overdue plus date remaining use exact minor units and current allocations',()=>{
 const result=summarize(customers,[row(0,{dueDate:'2026-11-04',amount:2800,paidAmount:100,remaining:2700,actualReceived:100}),row(1)],date)[0];
 expect(result).toMatchObject({previousOverdue:2700,todayDue:700,totalDue:3400,remaining:3400,received:100,status:'Overdue',needsCollection:true});
 const partial=summarize(customers,[row(0,{amount:181.67,paidAmount:100,remaining:81.67}),row(1,{dueDate:'2026-11-04',remaining:908.35})],date)[0];expect(partial.remaining).toBe(990.02);
});
test('paid advances and shared receipts are not counted twice and zero-due customers remain visible',()=>{
 const result=summarize(customers,[row(0,{remaining:0,paidAmount:700,actualReceived:800}),row(1,{remaining:0,paidAmount:100,dueDate:'2026-11-06',actualReceived:0})],date);
 expect(result[0]).toMatchObject({received:800,todayDue:0,remaining:0,status:'Paid',needsCollection:false,matchesToday:true});expect(result[1].status).toBe('No dues');
});
test('overdue remains collectible when today is paid, and searches match full customer portfolio',()=>{
 const rows=[row(0,{dueDate:'2026-11-03',remaining:500}),row(1,{remaining:0,paidAmount:700})];
 expect(summarize(customers,rows,date)[0]).toMatchObject({previousOverdue:500,todayDue:0,remaining:500,status:'Overdue'});
 for(const term of ['first','cus1','9000000001','ln1'])expect(summarize(customers,rows,date,term)).toHaveLength(1);
 expect(summarize(customers,rows,date,'absent')).toHaveLength(0);
});

test('late payment label uses actual paid date, preserving amounts and dates',()=>{
 const row={amount:700,paidAmount:700,date:new Date('2026-10-25T18:30:00Z'),paidDate:new Date('2026-10-27T06:00:00Z')},before=JSON.stringify(row);
 expect(require('../../src/utils/installmentStatus').present(row,new Date('2026-10-30')).statusLabel).toBe('Overdue Paid');expect(JSON.stringify(row)).toBe(before);
});

test('past fully paid installments do not label a fresh unpaid date installment partially paid',()=>{
 expect(summarize(customers,[row(0,{dueDate:'2026-11-04',paidAmount:700,remaining:0}),row(1)],date)[0].status).toBe('Due Today');
});
