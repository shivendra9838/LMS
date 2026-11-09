const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
jest.mock('../../src/utils/logger',()=>({logAccess:jest.fn(),logError:jest.fn(),accessLoggerMiddleware:(req,res,next)=>next()}));
jest.mock('../../src/utils/cache',()=>({getCache:jest.fn(),setCache:jest.fn(),invalidateCache:jest.fn()}));
const app = require('../../src/app');
const Admin = require('../../src/models/Admin');
const Employee = require('../../src/models/Employee');
const Account = require('../../src/models/PaymentAccount');
const Collection = require('../../src/models/Collection');
const Position = require('../../src/models/CollectionPosition');
const Settlement = require('../../src/models/EmployeeSettlement');
const { generateToken } = require('../../src/utils/jwt');
jest.setTimeout(120000);
let repl,admin,employee,other,adminToken,employeeToken,cash,upi,bank,source,foreignSource,old;
const call=(method,path,token=employeeToken)=>request(app)[method]('/api/v1/settlements'+path).set('Authorization','Bearer '+token);
const data=(res,status=200)=>{expect(res.status).toBe(status);return res.body.data;};
const create=(label,owner,modes,employeeId=employee._id)=>call('post','/accounts',adminToken).send({label,owner,modes,employeeId:String(employeeId),details:`${label}@synthetic.invalid`});
const pending=(accountId,extra={})=>({kind:'CASH',amount:'10.00',accountId:String(accountId),occurredAt:new Date().toISOString(),idempotencyKey:require('crypto').randomBytes(16).toString('hex'),...extra});
const collection=values=>Collection.create({collectionNumber:'QA-'+require('crypto').randomBytes(6).toString('hex'),employeeId:employee._id,collectedBy:employee._id,customerId:new mongoose.Types.ObjectId(),loanId:new mongoose.Types.ObjectId(),loanScheduleId:new mongoose.Types.ObjectId(),amountReceived:100,expectedAmount:100,status:'PAID',paymentMode:'CASH',paymentDate:new Date(),...values});
beforeAll(async()=>{
 process.env.JWT_SECRET='receiving-accounts-isolated';process.env.KYC_ENCRYPTION_KEY='43'.repeat(32);
 repl=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(repl.getUri(),{dbName:'isolated_receiving_review'});
 await Promise.all([Admin,Employee,Account,Collection,Position,Settlement].map(model=>model.init()));
 admin=await Admin.create({name:'Synthetic Admin',email:'receiving-admin@example.test',password:'Isolated123!',phone:'9000000000'});
 const make=(code)=>Employee.create({name:'Synthetic Employee',employeeCode:code,email:code+'@example.test',password:'Isolated123!',phone:'9000000001',city:'Test',area:code,createdBy:admin._id});
 employee=await make('EMP-SYNTHETIC-1');other=await make('EMP-SYNTHETIC-2');
 adminToken=generateToken(admin._id,'ADMIN');employeeToken=generateToken(employee._id,'EMPLOYEE');
});
afterAll(async()=>{await mongoose.disconnect();if(repl)await repl.stop();});

test('empty account configuration is a valid empty list; employee cannot create accounts',async()=>{
 expect(data(await call('get','/accounts'))).toEqual([]);
 expect((await call('post','/accounts').send({label:'Unauthorized',owner:'COMPANY',modes:['CASH']})).status).toBe(403);
 expect(await Account.countDocuments()).toBe(0);
 expect((await request(app).get('/api/v1/settlements/accounts')).status).toBe(401);
});
test('Admin authorizes cash, UPI and bank; employee sees masked company and own sources only',async()=>{
 cash=data(await create('Synthetic cash location','COMPANY',['CASH']),201);
 upi=data(await create('Synthetic company UPI','COMPANY',['UPI']),201);
 bank=data(await create('Synthetic company bank','COMPANY',['BANK_TRANSFER']),201);
 source=data(await create('Synthetic employee UPI','EMPLOYEE',['UPI']),201);
 foreignSource=data(await create('Other employee bank','EMPLOYEE',['BANK_TRANSFER'],other._id),201);
 const accounts=data(await call('get','/accounts'));
 expect(accounts.map(a=>a._id).sort()).toEqual([cash,upi,bank,source].map(a=>a._id).sort());
 for(const account of accounts){expect(account.encryptedDetails).toBeUndefined();expect(account.detailsFingerprint).toBeUndefined();}
 expect(JSON.stringify(accounts)).not.toContain('@synthetic.invalid');
 expect(data(await call('get','/accounts',adminToken))).toHaveLength(5);
});
test('missing, foreign, inactive and incompatible company destinations cannot create settlements',async()=>{
 const before=await Settlement.countDocuments();
 expect((await call('post','/').send(pending(''))).status).toBe(422);
 for(const id of [new mongoose.Types.ObjectId(),source._id,foreignSource._id,upi._id,bank._id])expect((await call('post','/').send(pending(id))).status).toBe(422);
 data(await call('patch',`/accounts/${cash._id}`,adminToken).send({active:false}));
 expect((await call('post','/').send(pending(cash._id))).status).toBe(422);
 expect((await call('patch',`/accounts/${cash._id}`).send({active:true})).status).toBe(403);
 data(await call('patch',`/accounts/${cash._id}`,adminToken).send({active:true}));
 expect(await Settlement.countDocuments()).toBe(before);
});
test('old payments appear read-only on their original dates, scoped to employee, method and search',async()=>{
 old=await collection({collectionNumber:'QA-LEGACY-ORIGINAL',paymentDate:new Date('2026-07-29T08:00:00Z')});
 await collection({employeeId:other._id,collectionNumber:'QA-OTHER-EMPLOYEE',paymentDate:old.paymentDate});
 await collection({amountReceived:0,status:'MISSED',paymentDate:old.paymentDate});
 const original=await Collection.findById(old._id).lean();
 const own=data(await call('get','/dashboard?from=2026-07-29&to=2026-07-29'));
 expect(own.paymentsTotal).toBe(1);expect(own.positionsTotal).toBe(0);expect(own.legacyPaymentsInPeriod).toBe(1);
 expect(own.payments[0]).toMatchObject({legacy:true,bucket:'UNCLASSIFIED',settlementStatus:'UNCLASSIFIED',collectionId:{collectionNumber:'QA-LEGACY-ORIGINAL'}});
 expect(own.totals.availableCashMinor).toBe(0);
 expect(data(await call('get','/dashboard?from=2026-07-30&to=2026-07-30')).paymentsTotal).toBe(0);
 expect(data(await call('get','/dashboard?from=2026-07-29&to=2026-07-29&method=UPI')).paymentsTotal).toBe(0);
 expect(data(await call('get','/dashboard?from=2026-07-29&to=2026-07-29&search=OTHER')).paymentsTotal).toBe(0);
 expect(data(await call('get',`/dashboard?from=2026-07-29&to=2026-07-29&employeeId=${other._id}`)).paymentsTotal).toBe(1);
 expect(data(await call('get',`/dashboard?from=2026-07-29&to=2026-07-29&employeeId=${other._id}`,adminToken)).payments[0].collectionId.collectionNumber).toBe('QA-OTHER-EMPLOYEE');
 expect(await Collection.findById(old._id).lean()).toEqual(original);expect(await Position.countDocuments()).toBe(0);
});
test('Admin classification avoids double-counting; cash handover and independent Admin count verify without rewriting collections',async()=>{
 const original=await Collection.findById(old._id).lean();
 data(await call('post',`/legacy/${old._id}/classify`,adminToken).send({remarks:'Synthetic original cash evidence reviewed'}));
 const activity=data(await call('get','/dashboard?from=2026-07-29&to=2026-07-29'));
 expect(activity.paymentsTotal).toBe(1);expect(activity.positionsTotal).toBe(1);expect(activity.legacyPaymentsInPeriod).toBe(0);
 const submitted=data(await call('post','/').send(pending(cash._id)),201);
 const proof=data(await call('post',`/${submitted._id}/evidence`,adminToken).field('source','CASH_COUNT').field('amount','10.00').field('reference',submitted.reference).field('observedAt',new Date().toISOString()).field('note','Synthetic Admin counted cash'),201);
 expect((await call('post',`/${submitted._id}/review`).send({action:'approve',version:submitted.version,evidenceId:proof._id,remarks:'Unauthorized approval'})).status).toBe(403);
 const verified=data(await call('post',`/${submitted._id}/review`,adminToken).send({action:'approve',version:submitted.version,evidenceId:proof._id,remarks:'Synthetic Admin counted and received cash'}));
 expect(verified.status).toBe('VERIFIED');expect(await Collection.findById(old._id).lean()).toEqual(original);
});

test('invalid or inactive employees and duplicate account authorizations fail without adding accounts',async()=>{
 const count=await Account.countDocuments();
 for(const employeeId of ['not-a-mongo-id',String(new mongoose.Types.ObjectId())]){
  expect((await call('post','/accounts',adminToken).send({label:'Invalid employee source',owner:'EMPLOYEE',employeeId,modes:['UPI'],details:'invalid-source@synthetic.invalid'})).status).toBe(422);
 }
 await Employee.updateOne({_id:other._id},{$set:{status:'INACTIVE'}});
 try { expect((await create('Inactive employee source','EMPLOYEE',['UPI'],other._id)).status).toBe(422); }
 finally { await Employee.updateOne({_id:other._id},{$set:{status:'ACTIVE'}}); }
 const duplicate=await create('Synthetic employee UPI','EMPLOYEE',['UPI']);
 expect(duplicate.status).toBe(409);expect(duplicate.body.message).toMatch(/already registered/);
 expect(await Account.countDocuments()).toBe(count);
});

test('Employee mutation denial clearly requires Admin, while inactive Admin remains blocked',async()=>{
 const denied=await call('post','/accounts').send({label:'Denied',owner:'EMPLOYEE',employeeId:String(employee._id),modes:['UPI'],details:'not-authorized@synthetic.invalid'});
 expect(denied.status).toBe(403);expect(denied.body.message).toMatch(/Admin session/);
 const otherDenied=await call('patch',`/accounts/${foreignSource._id}`).send({active:false});
 expect(otherDenied.status).toBe(403);
 await Admin.updateOne({_id:admin._id},{$set:{isActive:false}});
 try { expect((await create('Inactive Admin company account','COMPANY',['CASH'])).status).toBe(403); }
 finally { await Admin.updateOne({_id:admin._id},{$set:{isActive:true}}); }
 expect((await Account.findById(foreignSource._id)).active).toBe(true);
});

test('authorized Employee UPI source supports digital settlement and Admin verification; company cannot be a source',async()=>{
 const received=await collection({paymentMode:'UPI',receivingAccountId:source._id,receivingDestination:'EMPLOYEE',transactionReference:'SYNTHETIC-SOURCE-COLLECTION'});
 await Position.create({collectionId:received._id,employeeId:employee._id,paymentDate:received.paymentDate,method:'UPI',amountMinor:10000,bucket:'UPI_EMPLOYEE',verification:'NOT_REQUIRED',accountId:source._id,reference:received.transactionReference});
 const original=await Collection.findById(received._id).lean();
 expect(data(await call('get','/accounts')).some(account=>account._id===source._id&&account.owner==='EMPLOYEE')).toBe(true);
 const invalid=await call('post','/').send(pending(upi._id,{kind:'DIGITAL',sourceAccountId:upi._id,reference:'INVALID-COMPANY-SOURCE'}));
 expect(invalid.status).toBe(422);
 const submitted=data(await call('post','/').send(pending(upi._id,{kind:'DIGITAL',sourceAccountId:source._id,reference:'SYNTHETIC-EMPLOYEE-TRANSFER',amount:'20.00'})),201);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 const proof=data(await call('post',`/${submitted._id}/evidence`,adminToken).field('source','UPI_PROVIDER').field('amount','20.00').field('reference',submitted.reference).field('observedAt',new Date().toISOString()).field('note','Independent synthetic company UPI receipt').attach('file',png,{filename:'synthetic.png',contentType:'image/png'}),201);
 const verified=data(await call('post',`/${submitted._id}/review`,adminToken).send({action:'approve',version:submitted.version,evidenceId:proof._id,remarks:'Synthetic company UPI receipt matched'}));
 expect(verified.status).toBe('VERIFIED');expect((await Position.findOne({collectionId:received._id})).settledMinor).toBe(2000);
 expect(await Collection.findById(received._id).lean()).toEqual(original);
});
