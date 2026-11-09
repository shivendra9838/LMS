const mongoose = require('mongoose');
const crypto = require('crypto');
const Account = require('../models/PaymentAccount');
const Position = require('../models/CollectionPosition');
const Settlement = require('../models/EmployeeSettlement');
const Evidence = require('../models/FinanceEvidence');
const Reference = require('../models/FinanceReference');
const Collection = require('../models/Collection');
const Employee = require('../models/Employee');
const Admin = require('../models/Admin');
const Audit = require('../models/AuditLog');
const { encrypt, decrypt } = require('../utils/kycCrypto');
const { minor, legacyMinor } = require('../utils/money');

const error = (status, message) => Object.assign(new Error(message), { status });
const id = value => String(value?._id || value);
const held = ['CASH', 'UPI_EMPLOYEE', 'BANK_EMPLOYEE'];
const bankSources=['BANK_STATEMENT','UPI_PROVIDER','BANK_STATEMENT_SUPPLEMENT','UPI_PROVIDER_SUPPLEMENT'];
function settlementStatus(position) {
  if(!position||position.bucket==='UNCLASSIFIED')return 'UNCLASSIFIED';
  if(position.bucket==='COMPANY_DIGITAL')return 'NOT_APPLICABLE';
  if(position.settledMinor===position.amountMinor)return 'SETTLED';
  if(position.reservedMinor>0)return 'AWAITING_ADMIN';
  return position.settledMinor>0?'PARTIALLY_SETTLED':'UNSETTLED';
}
const hash = data => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
const binaryHash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const text = (value, max = 1000) => { if (typeof value !== 'string' || !value.trim() || value.length > max) throw error(422, 'A valid text value is required'); return value.trim(); };
const objectId = value => { if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw error(422, 'Invalid record identifier'); return new mongoose.Types.ObjectId(value); };
const reference = value => { const result = text(value, 100).normalize('NFKC').toUpperCase().replace(/\s+/g, ''); if (!/^[A-Z0-9][A-Z0-9/_.:-]{2,99}$/.test(result)) throw error(422, 'Enter a valid transaction reference (3–100 characters)'); return result; };
const key = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) throw error(422, 'A valid idempotency key is required'); return value; };
function date(value) { if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(value))throw error(422,'Use an ISO date/time with a timezone');const result = new Date(value); if (!Number.isFinite(result.getTime()) || result > new Date()) throw error(422, 'Enter a valid date/time that is not in the future'); return result; }
async function authorize(user, adminOnly = false) {
  if (!['ADMIN','EMPLOYEE'].includes(user.role) || (adminOnly && user.role !== 'ADMIN')) throw error(403, 'Forbidden');
  const actor = user.role === 'ADMIN' ? await Admin.findById(user.id) : await Employee.findById(user.id);
  if (!actor || (user.role === 'ADMIN' ? !actor.isActive : actor.status !== 'ACTIVE')) throw error(403, 'Account is inactive');
}
async function audit(user, action, target, values, session) {
  await Audit.create([{userId:user.id,userModel:user.role==='ADMIN'?'Admin':'Employee',userRole:user.role,action,module:'SETTLEMENT',referenceId:id(target),newValue:values}], {session});
}
let readiness;
async function ensureIndexes() {
  if(!readiness) readiness=Promise.all([Account,Position,Settlement,Evidence,Reference,Collection,Audit,require('../models/FinanceSequence'),require('../models/Loan'),require('../models/LoanSchedule'),require('../models/CashBook')].map(async model=>{
    try{await model.createCollection();}catch(err){if(err.code!==48)throw err;}
    await model.createIndexes();
  })).catch(err=>{readiness=undefined;throw err;});
  return readiness;
}
async function transaction(fn) {
  await ensureIndexes();
  try { return await mongoose.connection.transaction(fn); }
  catch (err) { if (err.code === 11000) throw error(409, err.keyPattern?.detailsFingerprint ? 'This receiving account is already registered. Enable its existing authorization instead.' : 'Duplicate reference, idempotency key, or correction. Reload and check the existing transaction.'); throw err; }
}
async function accounts(user) { await authorize(user); return Account.find(user.role==='ADMIN'?{}:{$or:[{owner:'COMPANY'},{owner:'EMPLOYEE',employeeId:user.id}]}).select('-encryptedDetails').sort({createdAt:1}).lean(); }
async function createAccount(body, user) {
  await authorize(user,true);
  if (!['COMPANY','EMPLOYEE'].includes(body.owner) || !Array.isArray(body.modes) || !body.modes.length || body.modes.some(mode=>!['CASH','UPI','BANK_TRANSFER','CHEQUE'].includes(mode))) throw error(422,'Choose an account owner and supported payment methods');
  if (body.owner==='EMPLOYEE' && body.modes.includes('CASH')) throw error(422,'Employee cash custody is tracked separately from receiving accounts');
  if(body.modes.includes('CASH')&&body.modes.some(mode=>mode!=='CASH'))throw error(422,'Authorize physical cash locations separately from digital receiving accounts');
  let employeeId;
  if(body.owner==='EMPLOYEE') { employeeId=objectId(body.employeeId); if(!await Employee.exists({_id:employeeId,status:'ACTIVE'})) throw error(422,'Choose an active employee'); }
  const details = body.modes.some(mode=>mode!=='CASH') ? text(body.details,200) : '';
  const encryptedDetails=details?encrypt(Buffer.from(details)):undefined;
  const detailsFingerprint=details?crypto.createHmac('sha256',Buffer.from(process.env.KYC_ENCRYPTION_KEY,'hex')).update(details.normalize('NFKC').toUpperCase().replace(/\s+/g,'')).digest('hex'):undefined;
  return transaction(async session=>{
    const account=new Account({label:text(body.label,100),owner:body.owner,employeeId,modes:[...new Set(body.modes)],maskedDetails:details?`••••${details.slice(-4)}`:'Cash receiving location',encryptedDetails,detailsFingerprint,createdBy:user.id});
    await account.save({session}); await audit(user,'ACCOUNT_AUTHORIZED',account,{owner:account.owner,modes:account.modes,employeeId},session);
    return { _id:account._id,label:account.label,owner:account.owner,employeeId,modes:account.modes,maskedDetails:account.maskedDetails,active:account.active };
  });
}
async function setAccountActive(accountId, body, user) {
  await authorize(user,true); if(typeof body.active!=='boolean') throw error(422,'Active must be true or false');
  return transaction(async session=>{const account=await Account.findById(objectId(accountId)).session(session); if(!account)throw error(404,'Account not found');account.active=body.active;await account.save({session});await audit(user,'ACCOUNT_STATUS_CHANGED',account,{active:body.active},session);return {active:account.active};});
}
async function receiving(data, employeeId, session, strict = false) {
  const method=data.paymentMode || 'CASH';
  if(method==='CASH') return {bucket:'CASH',verification:'NOT_REQUIRED',destination:'EMPLOYEE'};
  if(!data.receivingAccountId) {
    if(strict) throw error(422,'Select the actual authorized receiving account');
    return {bucket:'UNCLASSIFIED',verification:'PENDING',destination:'UNCLASSIFIED'};
  }
  const account=await Account.findById(objectId(data.receivingAccountId)).session(session);
  if(!account?.active || !account.modes.includes(method) || (account.owner==='EMPLOYEE' && id(account.employeeId)!==id(employeeId))) throw error(422,'Receiving account is not authorized for this employee and method');
  const ref=reference(data.transactionReference);
  return {bucket:account.owner==='COMPANY'?'COMPANY_DIGITAL':method==='UPI'?'UPI_EMPLOYEE':method==='BANK_TRANSFER'?'BANK_EMPLOYEE':'UNCLASSIFIED',verification:account.owner==='COMPANY'?'PENDING':'NOT_REQUIRED',destination:account.owner,accountId:account._id,reference:ref};
}
async function registerCollection(collection, data, user, loan, session) {
  if(!collection.amountReceived) return;
  if(user.role==='ADMIN' && data.financeVersion===2 && collection.paymentMode==='CASH' && String(data.cashReceivedByEmployeeId)!==id(collection.employeeId))throw error(422,'Admin cash entries must explicitly identify the assigned employee who received the cash');
  const routing=await receiving(data,collection.employeeId,session,data.financeVersion===2);
  // A legacy Admin cash call does not establish who physically received the money.
  if(user.role==='ADMIN' && data.financeVersion!==2 && collection.paymentMode==='CASH') Object.assign(routing,{bucket:'UNCLASSIFIED',destination:'UNCLASSIFIED',verification:'PENDING'});
  const employee=await Employee.findById(collection.employeeId).session(session);
  const position = new Position({collectionId:collection._id,employeeId:collection.employeeId,branchId:employee?.branchId,area:loan.customerId?.area,paymentDate:collection.paymentDate,method:collection.paymentMode,amountMinor:legacyMinor(collection.amountReceived),bucket:routing.bucket,verification:routing.verification,accountId:routing.accountId,reference:routing.reference});
  if(routing.reference) await Reference.create([{accountId:routing.accountId,reference:routing.reference,ownerType:'Collection',ownerId:collection._id}],{session});
  position.recordedAt=collection.createdAt;
  await position.save({session});
  collection.financeVersion=2;collection.receivingAccountId=routing.accountId;collection.receivingDestination=routing.destination;collection.transactionReference=routing.reference;collection.recordedByRole=user.role;
  await collection.save({session});
  await audit(user,'COLLECTION_CUSTODY_RECORDED',position,{collectionId:collection._id,bucket:position.bucket,amountMinor:position.amountMinor,verification:position.verification},session);
}
async function getTarget(type, targetId, user, session) {
  const target=await (type==='Settlement'?Settlement:Position).findById(objectId(targetId)).session(session || null);
  if(!target || (user.role==='EMPLOYEE' && id(target.employeeId)!==user.id)) throw error(404,'Financial record not found');
  return target;
}
async function submit(body, user) {
  await authorize(user); if(user.role!=='EMPLOYEE') throw error(403,'Only employees can submit their funds');
  const clean={kind:body.kind,amountMinor:minor(body.amount),accountId:id(objectId(body.accountId)),sourceAccountId:body.kind==='DIGITAL'?id(objectId(body.sourceAccountId)):undefined,occurredAt:date(body.occurredAt).toISOString(),reference:body.kind==='CASH'?'CASH':reference(body.reference),remarks:body.remarks?text(body.remarks):'',supersedesId:body.supersedesId?id(objectId(body.supersedesId)):null};
  if(!['CASH','DIGITAL'].includes(clean.kind)) throw error(422,'Choose cash handover or digital transfer');
  const idem=key(body.idempotencyKey); const requestHash=hash(clean);
  const existing=await Settlement.findOne({employeeId:user.id,idempotencyKey:idem});
  if(existing) { if(existing.requestHash!==requestHash)throw error(409,'Idempotency key was already used for different data');return existing; }
  return transaction(async session=>{
    const duplicate=await Settlement.findOne({employeeId:user.id,idempotencyKey:idem}).session(session);
    if(duplicate) {if(duplicate.requestHash!==requestHash)throw error(409,'Idempotency conflict');return duplicate;}
    const account=await Account.findById(clean.accountId).session(session);
    if(!account?.active || account.owner!=='COMPANY' || (clean.kind==='CASH'?!account.modes.includes('CASH'):!account.modes.some(mode=>['UPI','BANK_TRANSFER'].includes(mode)))) throw error(422,'Select an active company receiving account for this settlement');
    if(clean.kind==='DIGITAL'){const source=await Account.findById(clean.sourceAccountId).session(session);if(!source||source.owner!=='EMPLOYEE'||id(source.employeeId)!==user.id||!source.modes.some(mode=>['UPI','BANK_TRANSFER'].includes(mode)))throw error(422,'Select your employee source account. Disabled accounts may only remit already-recorded funds.');}
    let original;
    if(clean.supersedesId) {original=await getTarget('Settlement',clean.supersedesId,user,session);if(original.status!=='REJECTED')throw error(409,'Only rejected submissions can be corrected');}
    const settlement=new Settlement({...clean,employeeId:user.id,idempotencyKey:idem,requestHash,allocations:[]});
    settlement.correctionRootId=original?(original.correctionRootId||original._id):settlement._id;
    if(clean.kind==='CASH') settlement.reference=`CASH:${settlement._id}`;
    const positions=await Position.find({employeeId:user.id,...(clean.kind==='DIGITAL'?{accountId:clean.sourceAccountId}:{}),bucket:{$in:clean.kind==='CASH'?['CASH']:['UPI_EMPLOYEE','BANK_EMPLOYEE']},paymentDate:{$lte:new Date(Date.parse(clean.occurredAt)+999)},$expr:{$gt:[{$subtract:['$amountMinor',{$add:['$settledMinor','$reservedMinor']}]},0]}}).sort({paymentDate:1,_id:1}).session(session);
    let remaining=clean.amountMinor;
    for(const position of positions) {
      const allocated=Math.min(remaining,position.amountMinor-position.settledMinor-position.reservedMinor);
      if(!allocated)continue;
      const result=await Position.updateOne({_id:position._id,version:position.version},{$inc:{reservedMinor:allocated,version:1}},{session});
      if(result.modifiedCount!==1)throw error(409,'Funds changed concurrently; retry with the same idempotency key');
      settlement.allocations.push({positionId:position._id,amountMinor:allocated});remaining-=allocated;if(!remaining)break;
    }
    if(remaining)throw error(422,'Settlement exceeds eligible available funds. Pending or disputed submissions are already reserved.');
    if(clean.kind==='DIGITAL') {
      const reused=original && original.reference===settlement.reference && id(original.accountId)===id(account);
      if(reused) {const result=await Reference.updateOne({accountId:account._id,reference:settlement.reference,ownerType:'Settlement',ownerId:original._id},{$set:{ownerId:settlement._id}},{session});if(result.modifiedCount!==1)throw error(409,'Original transfer reference is no longer available for correction');}
      else await Reference.create([{accountId:account._id,reference:settlement.reference,ownerType:'Settlement',ownerId:settlement._id}],{session});
    }
    await settlement.save({session});await audit(user,'SETTLEMENT_SUBMITTED',settlement,{amountMinor:settlement.amountMinor,kind:settlement.kind,allocations:settlement.allocations,supersedesId:clean.supersedesId},session);return settlement;
  });
}
async function review(settlementId, body, user) {
  await authorize(user,true); const remarks=text(body.remarks);
  if(!['approve','reject','dispute','reverse'].includes(body.action))throw error(422,'Invalid review action');
  return transaction(async session=>{
    const target=await getTarget('Settlement',settlementId,user,session);
    if(body.version!==target.version)throw error(409,'Settlement changed; reload before reviewing');
    const before=target.status;
    if(body.action==='reverse') {
      if(before!=='VERIFIED')throw error(409,'Only verified settlements can be reversed');
      for(const allocation of target.allocations){const result=await Position.updateOne({_id:allocation.positionId,settledMinor:{$gte:allocation.amountMinor}},{$inc:{settledMinor:-allocation.amountMinor,version:1}},{session});if(result.modifiedCount!==1)throw error(409,'Allocation reversal conflict');}
      target.status='REVERSED';
    } else {
      if(!['SUBMITTED','DISPUTED'].includes(before))throw error(409,'This settlement is already finalized');
      if(body.action==='approve') {
        const evidence=await Evidence.findById(objectId(body.evidenceId)).session(session);
        if(!evidence || evidence.role!=='ADMIN' || evidence.targetType!=='Settlement' || (id(evidence.targetId)!==id(target) && (!target.correctionRootId||id(evidence.correctionRootId)!==id(target.correctionRootId))) || evidence.amountMinor!==target.amountMinor || id(evidence.accountId)!==id(target.accountId) || evidence.reference!==target.reference || (target.kind==='CASH'?evidence.source!=='CASH_COUNT':!bankSources.includes(evidence.source)))throw error(422,'Approval requires matching Admin company evidence, or an Admin cash count');
        target.evidenceId=evidence._id;target.verifiedAt=new Date();target.observedMinor=target.amountMinor;target.differenceMinor=0;
      } else if(body.action==='dispute') {target.observedMinor=minor(body.observedAmount,true);target.differenceMinor=target.amountMinor-target.observedMinor;}
      if(body.action!=='dispute') for(const allocation of target.allocations){const result=await Position.updateOne({_id:allocation.positionId,reservedMinor:{$gte:allocation.amountMinor}},{$inc:{reservedMinor:-allocation.amountMinor,settledMinor:body.action==='approve'?allocation.amountMinor:0,version:1}},{session});if(result.modifiedCount!==1)throw error(409,'Allocation review conflict');}
      target.status=body.action==='approve'?'VERIFIED':body.action==='reject'?'REJECTED':'DISPUTED';
    }
    target.reviewedBy=user.id;target.reviewedAt=new Date();target.reviewRemarks=remarks;target.version+=1;
    await target.save({session});await audit(user,`SETTLEMENT_${target.status}`,target,{from:before,to:target.status,remarks,amountMinor:target.amountMinor,differenceMinor:target.differenceMinor,version:target.version},session);return target;
  });
}
async function evidence(type, targetId, body, file, user) {
  await authorize(user); const target=await getTarget(type,targetId,user);
  const isAdmin=user.role==='ADMIN'; let source=isAdmin?body.source:'EMPLOYEE_PROOF';
  if(!isAdmin && (type!=='Settlement' || !['SUBMITTED','DISPUTED'].includes(target.status)))throw error(403,'Employee proofs are only accepted for their pending settlements');
  if(isAdmin && !['BANK_STATEMENT','UPI_PROVIDER','CASH_COUNT'].includes(source))throw error(422,'Choose the evidence source');
  let mime;let bytes;
  if(file) {
    bytes=file.buffer;
    if(bytes.length>2*1024*1024)throw error(422,'Proof must be up to 2 MB');
    if(bytes.subarray(0,5).toString()==='%PDF-') {const {PDFDocument}=require('pdf-lib');try{await PDFDocument.load(bytes);mime='application/pdf';}catch{throw error(422,'Invalid PDF');}}
    else if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
    else if(bytes[0]===255 && bytes[1]===216 && bytes.at(-2)===255 && bytes.at(-1)===217)mime='image/jpeg';
    if(!mime || mime!==file.mimetype)throw error(422,'Upload a matching JPEG, PNG, or PDF file');
  }
  if(source!=='CASH_COUNT' && !bytes)throw error(422,'A secure proof file is required');
  if(isAdmin && (source==='CASH_COUNT' ? type!=='Settlement'||target.kind!=='CASH' : type==='Settlement'?target.kind!=='DIGITAL':target.bucket!=='COMPANY_DIGITAL'))throw error(422,'Evidence source does not match the receiving destination');
  if(isAdmin && source==='UPI_PROVIDER'){const account=await Account.findById(target.accountId);if(!account?.modes.includes('UPI')||(type==='Position'&&target.method!=='UPI'))throw error(422,'UPI provider evidence cannot verify a bank transfer or cheque');}
  const values=isAdmin?{accountId:target.accountId,reference:target.reference,amountMinor:minor(body.amount),observedAt:date(body.observedAt),note:text(body.note)}:{note:body.note?text(body.note):''};
  if(isAdmin && (values.amountMinor!==target.amountMinor || (source!=='CASH_COUNT' && reference(body.reference)!==target.reference)))throw error(422,'Evidence amount and reference must match the company receipt');
  if(isAdmin && values.observedAt.getTime()+59999<new Date(type==='Settlement'?target.occurredAt:target.paymentDate).getTime())throw error(422,'Evidence receipt time cannot precede the recorded transfer/payment');
  if(isAdmin && source!=='CASH_COUNT') {const existing=await Evidence.findOne({accountId:values.accountId,reference:values.reference,source:{$in:['BANK_STATEMENT','UPI_PROVIDER']}});if(existing){const sameTarget=id(existing.targetId)===id(target)||(type==='Settlement'&&target.correctionRootId&&id(existing.correctionRootId)===id(target.correctionRootId));if(!sameTarget||existing.targetType!==type)throw error(409,'Company evidence was already assigned to another posting');const matching=await Evidence.findOne({accountId:values.accountId,reference:values.reference,digest:binaryHash(bytes),amountMinor:values.amountMinor,role:'ADMIN',source:{$in:bankSources}});if(matching){await audit(user,'EXISTING_COMPANY_EVIDENCE_REVIEWED',target,{evidenceId:matching._id});return {_id:matching._id,source:matching.source,mime:matching.mime};}source=`${source}_SUPPLEMENT`;}}
  return transaction(async session=>{const doc=new Evidence({targetType:type,targetId:target._id,correctionRootId:type==='Settlement'?target.correctionRootId:undefined,employeeId:target.employeeId,source,...values,mime,digest:bytes?binaryHash(bytes):undefined,encryptedBytes:bytes?encrypt(bytes):undefined,uploadedBy:user.id,role:user.role});await doc.save({session});await audit(user,'FINANCIAL_EVIDENCE_ATTACHED',target,{evidenceId:doc._id,source,digest:doc.digest},session);return {_id:doc._id,source,mime,createdAt:doc.createdAt};});
}
async function proof(evidenceId,user) {
  await authorize(user);const doc=await Evidence.findById(objectId(evidenceId)).select('+encryptedBytes');
  if(!doc || (user.role==='EMPLOYEE' && (id(doc.employeeId)!==user.id || doc.source!=='EMPLOYEE_PROOF')) || !doc.encryptedBytes)throw error(404,'Proof not found');
  await getTarget(doc.targetType,id(doc.targetId),user);await audit(user,'FINANCIAL_PROOF_VIEWED',doc,{source:doc.source});return {mime:doc.mime,bytes:decrypt(doc.encryptedBytes)};
}
async function verifyPosition(positionId,body,user) {
  await authorize(user,true);const remarks=text(body.remarks);
  return transaction(async session=>{const target=await getTarget('Position',positionId,user,session);if(target.bucket!=='COMPANY_DIGITAL'||target.version!==body.version)throw error(409,'Company payment changed; reload before review');
    if(!['verify','dispute','reverse'].includes(body.action))throw error(422,'Invalid payment review action');
    if((target.verification==='VERIFIED')!==(body.action==='reverse'))throw error(409,'Verified payments require an explicit verification reversal');
    if(body.action==='verify'){const evidence=await Evidence.findById(objectId(body.evidenceId)).session(session);if(!evidence||evidence.role!=='ADMIN'||evidence.targetType!=='Position'||id(evidence.targetId)!==id(target)||evidence.amountMinor!==target.amountMinor||!bankSources.includes(evidence.source))throw error(422,'Reliable matching company evidence is required');target.verification='VERIFIED';target.evidenceId=evidence._id;target.verifiedAt=new Date();target.verifiedBy=user.id;}else target.verification='DISPUTED';
    target.version+=1;await target.save({session});await audit(user,body.action==='reverse'?'COMPANY_VERIFICATION_REVERSED':`COMPANY_PAYMENT_${target.verification}`,target,{remarks,verification:target.verification,evidenceId:target.evidenceId},session);return target;});
}
async function classify(collectionId,body,user) {
  await authorize(user,true);const remarks=text(body.remarks);
  return transaction(async session=>{const collection=await Collection.findById(objectId(collectionId)).populate('customerId','area').session(session);if(!collection || !collection.amountReceived)throw error(404,'Eligible collection not found');
    let position=await Position.findOne({collectionId:collection._id}).session(session);
    if(position && position.bucket!=='UNCLASSIFIED')throw error(409,'Collection already has classified custody');
    const routing=await receiving({...body,paymentMode:collection.paymentMode},collection.employeeId,session,true);
    if(routing.bucket==='UNCLASSIFIED')throw error(422,'This method requires a separate clearing review');
    const employee=await Employee.findById(collection.employeeId).session(session);
    if(!position)position=new Position({collectionId:collection._id,employeeId:collection.employeeId,branchId:employee?.branchId,area:collection.customerId?.area,paymentDate:collection.paymentDate,method:collection.paymentMode,amountMinor:legacyMinor(collection.amountReceived)});
    if(routing.reference)await Reference.create([{accountId:routing.accountId,reference:routing.reference,ownerType:'Collection',ownerId:collection._id}],{session});
    Object.assign(position,{bucket:routing.bucket,accountId:routing.accountId,reference:routing.reference,verification:routing.verification,version:position.version+1});await position.save({session});await audit(user,'LEGACY_CUSTODY_CLASSIFIED',position,{remarks,collectionId:collection._id,bucket:position.bucket},session);return position;
  });
}
async function details(settlementId,user) {
  await authorize(user);const settlement=await getTarget('Settlement',settlementId,user);
  const history=await Audit.find({module:'SETTLEMENT',referenceId:id(settlement)}).select('action userRole newValue createdAt').sort({createdAt:1}).lean();
  const evidenceList=await Evidence.find({targetType:'Settlement',targetId:settlement._id,...(user.role==='EMPLOYEE'?{source:'EMPLOYEE_PROOF'}:{})}).select('source mime amountMinor observedAt createdAt').lean();return {settlement,history,evidence:evidenceList};
}
async function idempotentSubmit(body,user) {
  try{return await submit(body,user);}catch(err){if(err.status===409 && typeof body.idempotencyKey==='string' && await Settlement.exists({employeeId:user.id,idempotencyKey:body.idempotencyKey}))return submit(body,user);throw err;}
}
module.exports={accounts,createAccount,setAccountActive,registerCollection,submit:idempotentSubmit,review,evidence,proof,verifyPosition,classify,details,authorize,transaction,audit,objectId,error,key,hash,reference,held,ensureIndexes,settlementStatus};
