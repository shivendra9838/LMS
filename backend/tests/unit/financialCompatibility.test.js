const mongoose=require('mongoose');
const CashBook=require('../../src/models/CashBook');
const Collection=require('../../src/models/Collection');
const {settlementStatus}=require('../../src/services/settlement.service');
describe('Historical financial record compatibility',()=>{
 test('does not add a default fund channel to historical cash-book entries',()=>{const legacy=CashBook.hydrate({_id:new mongoose.Types.ObjectId(),date:new Date(),entries:[{_id:new mongoose.Types.ObjectId(),type:'LOAN_RECOVERY',direction:'CASH_IN',cashIn:250,cashOut:0}]});expect(legacy.entries[0].toObject()).not.toHaveProperty('fundChannel');});
 test('does not infer historical collection destinations or verification metadata',()=>{const legacy=Collection.hydrate({_id:new mongoose.Types.ObjectId(),collectionNumber:'COL000001',amountReceived:250,paymentMode:'UPI'});expect(legacy.financeVersion).toBeUndefined();expect(legacy.receivingDestination).toBeUndefined();expect(legacy.receivingAccountId).toBeUndefined();expect(legacy.idempotencyKey).toBeUndefined();});
 test.each([[undefined,'UNCLASSIFIED'],[{bucket:'UNCLASSIFIED'},'UNCLASSIFIED'],[{bucket:'COMPANY_DIGITAL'},'NOT_APPLICABLE'],[{bucket:'CASH',amountMinor:100,settledMinor:100,reservedMinor:0},'SETTLED'],[{bucket:'BANK_EMPLOYEE',amountMinor:100,settledMinor:0,reservedMinor:40},'AWAITING_ADMIN'],[{bucket:'UPI_EMPLOYEE',amountMinor:100,settledMinor:20,reservedMinor:0},'PARTIALLY_SETTLED'],[{bucket:'CASH',amountMinor:100,settledMinor:0,reservedMinor:0},'UNSETTLED']])('derives settlement status from the canonical counters', (position,expected)=>expect(settlementStatus(position)).toBe(expected));
});
