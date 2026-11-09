jest.mock('../../src/services/employeeDashboard.service',()=>({read:jest.fn()}));
const dashboard=require('../../src/services/employeeDashboard.service'),{read}=require('../../src/services/collectionRecovery.service');
const date='2026-11-06',item=(key,extra={})=>({_id:key,activeAtDate:true,dueDate:date,remaining:700,amount:700,paidAmount:0,currentSchedule:{_id:key},actualReceived:0,...extra});
beforeEach(()=>dashboard.read.mockResolvedValue({collected:800,customerSummaries:[{customerId:'c',customerName:'Synthetic',customerCode:'CUS1',mobile:'9000000001',loans:[{loanId:'l1',loanNumber:'LN1',currentSchedule:{_id:'a'},installments:[item('a',{dueDate:'2026-11-05',remaining:2700,amount:2800,paidAmount:100}),item('b')]},{loanId:'l2',loanNumber:'LN2',currentSchedule:{_id:'c'},installments:[item('c',{paidAmount:100,remaining:600,actualReceived:800,receiptSummaries:[{_id:'r',paymentDate:date}]}),item('d',{dueDate:'2026-11-07',remaining:600,paidAmount:100,actualReceived:0,receiptSummaries:[{_id:'r',paymentDate:date}]})]}]}]}));
test('multiple loans stay separate while cards count unique customers and receipts once',async()=>{
 const data=await read({id:'employee',role:'EMPLOYEE'},{view:'LOANS',date});
 expect(data.rows.map(r=>[r.loanId,r.totalCollectible])).toEqual([['l1',3400],['l2',600]]);
 expect(data.summary).toMatchObject({totalCustomers:1,previousOverdue:2700,todayUnpaid:1300,totalCollectible:4000,collected:800});
 expect(data.counts).toEqual({ALL:2,TODAY:2,OVERDUE:1,PAID_TODAY:1});expect(data.rows[1].latestReceipt._id).toBe('r');
});
test('loan/mobile search, filters and pagination keep portfolio summary stable',async()=>{
 const selected=await read({id:'employee',role:'EMPLOYEE'},{view:'LOANS',date,search:'ln2',filter:'PAID_TODAY',limit:1});expect(selected.rows.map(r=>r.loanId)).toEqual(['l2']);expect(selected.summary.totalCollectible).toBe(4000);
 expect((await read({id:'employee',role:'EMPLOYEE'},{view:'LOANS',date,search:'9000000001'})).meta.total).toBe(2);
});

test('latest receipt uses chronological received dates rather than lexical month ordering',async()=>{
 const data=await dashboard.read();data.customerSummaries[0].loans[0].installments[0].receiptSummaries=[{_id:'older',paymentDate:new Date('2026-09-30')},{_id:'newer',paymentDate:new Date('2026-10-01')}];
 const result=await read({id:'employee',role:'EMPLOYEE'},{view:'LOANS',date});expect(result.rows[0].latestReceipt._id).toBe('newer');
});

test('a loan issued after the selected historical day is excluded from active-customer cards',async()=>{
 const data=await dashboard.read();for(const loan of data.customerSummaries[0].loans)for(const item of loan.installments)item.currentSchedule.loanIssueDate='2026-11-07';for(const loan of data.customerSummaries[0].loans)for(const item of loan.installments)item.actualReceived=0;
 const result=await read({id:'employee',role:'EMPLOYEE'},{view:'LOANS',date});expect(result.rows).toHaveLength(0);expect(result.summary.totalCustomers).toBe(0);
});
