const mongoose = require('mongoose');
const crypto = require('crypto');
const Lead = require('../models/CustomerLead');
const Customer = require('../models/Customer');
const Employee = require('../models/Employee');
const Admin = require('../models/Admin');
const Document = require('../models/KycDocument');
const AuditLog = require('../models/AuditLog');
const CustomerTimeline = require('../models/CustomerTimeline');
const { encrypt, decrypt } = require('../utils/kycCrypto');
const { validateKyc } = require('../validators/kyc.validator');
const { generateCustomerCode } = require('../utils/generateCode');
const { PDFDocument } = require('pdf-lib');

const error = (status, message) => Object.assign(new Error(message), { status });
const id = value => String(value?._id || value);
const editable = lead => ['DRAFT', 'CORRECTION_REQUIRED', 'REJECTED'].includes(lead.status);
const decode = value => value ? JSON.parse(decrypt(value).toString('utf8')) : {};
async function access(leadId, user) {
  if (!mongoose.isValidObjectId(leadId)) throw error(404, 'KYC not found');
  const lead = await Lead.findById(leadId).select('+kycEncrypted +approvedKycEncrypted');
  if (!lead?.kycVersion) throw error(404, 'KYC not found');
  if (user.role === 'EMPLOYEE') {
    const employee = await Employee.findById(user.id);
    if (!employee || employee.status !== 'ACTIVE') throw error(403, 'Employee account is inactive');
    const owner = lead.customerId ? (await Customer.findById(lead.customerId))?.employeeId : lead.submittedByEmployeeId;
    if (id(owner) !== user.id) throw error(404, 'KYC not found');
  } else if (user.role === 'ADMIN') {
    const admin = await Admin.findById(user.id);
    if (!admin || !admin.isActive) throw error(403, 'Admin account is inactive');
  } else throw error(403, 'Forbidden');
  return lead;
}
function checkVersion(lead, version) {
  if (!Number.isInteger(version) || version !== lead.__v) throw error(409, 'KYC changed in another session. Reload before saving.');
}
function event(lead, user, action, fields = [], reason) {
  lead.history.push({ actorId: user.id, role: user.role, action, fields, reason });
}
async function audit(lead, user, action, session) {
  await AuditLog.create([{ userId: user.id, userModel: user.role === 'ADMIN' ? 'Admin' : 'Employee', userRole: user.role,
    action, module: 'KYC', referenceId: id(lead), newValue: { status: lead.status, version: lead.__v,employeeVerificationId:lead.employeeVerificationId,approvalId:lead.kycApprovalId,assignedEmployeeId:lead.assignedEmployeeId } }], session ? { session } : {});
}
async function save(lead, user, action) {
  await require('../models/KycSubmission').init();
  try {
    await mongoose.connection.transaction(async session => {
      if(['KYC_CORRECTION_REQUIRED','KYC_REJECTED'].includes(action)) await require('./kycApplication.service').capture(lead,session,'LEGACY_PENDING');
      await lead.save({ session });
      if(action==='KYC_SUBMITTED') await require('./kycApplication.service').capture(lead,session);
      await audit(lead, user, action, session);
    });
  } catch (err) {
    if (err.name === 'VersionError') throw error(409, 'KYC changed in another session. Reload before saving.');
    if (err.code === 11000) throw error(409, 'A pending KYC or customer already exists for this mobile number');
    throw err;
  }
  return dto(lead);
}
async function dto(lead) {
  const entries=lead.history||[],actorIds=[...new Set(entries.map(e=>String(e.actorId||'')).filter(Boolean))];
  const [employeeActors,adminActors]=actorIds.length?await Promise.all([Employee.find({_id:{$in:actorIds}}).select('_id name').lean(),Admin.find({_id:{$in:actorIds}}).select('_id name').lean()]):[[],[]];
  const actorNames=new Map([...employeeActors.map(a=>['EMPLOYEE:'+a._id,a.name]),...adminActors.map(a=>['ADMIN:'+a._id,a.name])]);
  const history=entries.map(e=>({...typeof e.toObject==='function'?e.toObject():e,actorName:actorNames.get(e.role+':'+e.actorId)||null}));
  const allDocuments = await Document.find({ _id: { $in: [...lead.documentIds, ...lead.approvedDocumentIds] }, leadId: lead._id }).select('kind mime size createdAt');
  const documents = allDocuments.filter(doc => lead.documentIds.some(value => id(value) === id(doc)));
  const approvedDocuments = allDocuments.filter(doc => lead.approvedDocumentIds.some(value => id(value) === id(doc)));
  return { _id: lead._id, status: lead.status, version: lead.__v, data: decode(lead.kycEncrypted),
    approvedData: decode(lead.approvedKycEncrypted), approvedAt: lead.approvedAt, customerId: lead.customerId,
    adminRemarks: lead.adminRemarks, history, documents, approvedDocuments, approvedDocumentIds: lead.approvedDocumentIds,
    assignedEmployeeId: lead.assignedEmployeeId, employeeVerification:require('./kycSignature.service').metadata(lead.employeeVerificationId?await require('../models/KycVerificationSignature').findById(lead.employeeVerificationId):null), approvalId:lead.kycApprovalId };
}
async function create(data, user, customerId) {
  if (user.role !== 'EMPLOYEE') throw error(403, 'Only employees can create KYC');
  const employee = await Employee.findById(user.id);
  if (!employee || employee.status !== 'ACTIVE') throw error(403, 'Employee account is inactive');
  const clean = validateKyc(data);
  let customer;
  if (customerId) {
    if (!mongoose.isValidObjectId(customerId)) throw error(404, 'Customer not found');
    customer = await Customer.findById(customerId);
    if (!customer || id(customer.employeeId) !== user.id) throw error(404, 'Customer not found');
    if (customer.kycLeadId) throw error(409, 'This customer already has a KYC record');
  }
  const lead = new Lead({ kycVersion: 1, submittedByEmployeeId: user.id, status: 'DRAFT',
    customerId: customer?._id, assignedEmployeeId: customer ? user.id : undefined,
    name: clean.name || 'Untitled KYC', mobile: clean.mobile || undefined, kycEncrypted: encrypt(Buffer.from(JSON.stringify(clean))) });
  event(lead, user, 'DRAFT_CREATED');
  if (customer) {
    await mongoose.connection.transaction(async session => {
      const result = await Customer.updateOne({ _id: customer._id, kycLeadId: { $exists: false } }, { $set: { kycLeadId: lead._id } }, { session });
      if (!result.modifiedCount) throw error(409, 'This customer already has a KYC record');
      await lead.save({ session }); await audit(lead, user, 'KYC_DRAFT_CREATED', session);
    });
    return dto(lead);
  }
  return save(lead, user, 'KYC_DRAFT_CREATED');
}
async function update(leadId, body, user) {
  const lead = await access(leadId, user);
  if (user.role !== 'EMPLOYEE' || !editable(lead)) throw error(409, 'Only editable drafts or returned KYC can be changed');
  checkVersion(lead, body.version);
  const clean = validateKyc(body.data);
  const before = decode(lead.kycEncrypted);
  const changed = Object.keys(clean).filter(key => clean[key] !== before[key]);
  lead.kycEncrypted = encrypt(Buffer.from(JSON.stringify(clean)));
  lead.name = clean.name || 'Untitled KYC';
  lead.mobile = clean.mobile || undefined;
  event(lead, user, 'DRAFT_SAVED', changed);
  return save(lead, user, 'KYC_DRAFT_SAVED');
}
async function submit(leadId, version, user, verification={}) {
  const lead = await access(leadId, user);
  if (user.role !== 'EMPLOYEE' || !editable(lead)) throw error(409, 'This KYC cannot be submitted');
  checkVersion(lead, version);
  const data = validateKyc(decode(lead.kycEncrypted), true);
  const documents = await Document.find({ _id: { $in: lead.documentIds }, leadId });
  for (const kind of ['PHOTO', 'IDENTITY', 'ADDRESS', 'SIGNATURE']) {
    if (!documents.some(doc => doc.kind === kind)) throw error(422, `Upload the ${kind.toLowerCase()} document before submission`);
  }
  const duplicate = await Customer.findOne({ mobile: data.mobile, ...(lead.customerId ? { _id: { $ne: lead.customerId } } : {}) });
  if (duplicate) throw error(409, 'A customer with this mobile number already exists');
  if (await Lead.exists({ _id: { $ne: lead._id }, mobile: data.mobile, status: 'PENDING' })) throw error(409, 'A pending request already exists for this mobile number');
  if(verification.confirmed!==true)throw error(422,'Confirm employee verification before submitting.');
  const signature=await require('./kycSignature.service').requireSignature(lead,verification.signatureId,user);
  lead.employeeVerificationId=signature._id;lead.kycApprovalId=undefined;
  event(lead,user,'EMPLOYEE_VERIFIED',['employeeVerificationId']);
  lead.status = 'PENDING';
  lead.adminRemarks = undefined;
  event(lead, user, 'SUBMITTED');
  return save(lead, user, 'KYC_SUBMITTED');
}
async function revise(leadId, version, user) {
  const lead = await access(leadId, user);
  if (user.role !== 'EMPLOYEE' || lead.status !== 'APPROVED') throw error(409, 'Only approved KYC can start a revision');
  checkVersion(lead, version);
  if(!await require('../models/KycSubmission').exists({leadId:lead._id})) await mongoose.connection.transaction(session=>require('./kycApplication.service').capture(lead,session,'LEGACY_APPROVED'));
  lead.status = 'DRAFT';
  lead.employeeVerificationId=undefined;lead.kycApprovalId=undefined;
  event(lead, user, 'REVISION_STARTED');
  return save(lead, user, 'KYC_REVISION_STARTED');
}
async function review(leadId, body, user, action) {
  if (user.role !== 'ADMIN') throw error(403, 'Forbidden');
  await Promise.all([require('../models/KycSubmission').init(),require('../models/KycApproval').init()]);
  const lead = await access(leadId, user);
  checkVersion(lead, body.version);
  if (lead.status !== 'PENDING') throw error(409, 'Only pending KYC can be reviewed');
  if (action !== 'APPROVED') {
    const reason = String(body.adminRemarks || '').trim();
    if (!reason || reason.length > 1000) throw error(422, 'Provide a reason between 1 and 1000 characters');
    lead.status = action;
    lead.adminRemarks = reason;
    lead.reviewedBy = user.id;
    event(lead, user, action, [], reason);
    return save(lead, user, `KYC_${action}`);
  }
  if(body.confirmed!==true)throw error(422,'Explicit approval confirmation and your own Admin signature are required.');
  const adminSignature=await require('./kycSignature.service').requireSignature(lead,body.signatureId,user);
  const data = validateKyc(decode(lead.kycEncrypted), true);
  const employee = mongoose.isValidObjectId(body.employeeId) ? await Employee.findById(body.employeeId) : null;
  if (!employee || employee.status !== 'ACTIVE') throw error(422, 'Assign an active employee');
  const dob = new Date(data.dob); const today = new Date();
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  if (today.getUTCMonth() < dob.getUTCMonth() || (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() < dob.getUTCDate())) age--;
  const profile = { name: data.name, fatherName: data.fatherName, mobile: data.mobile, alternateMobile: data.alternateMobile,
    age, gender: data.gender, occupation: data.occupation, address: data.address, city: data.city, area: data.area,
    landmark: data.landmark, employeeId: employee._id, branchId: employee.branchId, idProofType: data.idProofType,
    idProofNumber: `********${data.idProofNumber.slice(-4)}`, kycLeadId: lead._id, kycApprovedAt: new Date() };
  const customerCode = lead.customerId ? undefined : await generateCustomerCode();
  try {
    await mongoose.connection.transaction(async session => {
      if (await Customer.exists({ mobile: data.mobile, ...(lead.customerId ? { _id: { $ne: lead.customerId } } : {}) }).session(session)) throw error(409, 'A customer with this mobile number already exists');
      if (lead.customerId) {
        // Existing loans retain their responsible employee; this phase does not rewrite loans.
        const customer = await Customer.findByIdAndUpdate(lead.customerId, { $set: profile }, { returnDocument: 'after', runValidators: true, session });
        if (!customer) throw error(409, 'Linked customer no longer exists');
      } else {
        const [customer] = await Customer.create([{ ...profile, customerCode, createdBy: user.id }], { session });
        lead.customerId = customer._id;
      }
      await require('./kycApplication.service').capture(lead,session,'LEGACY_PENDING');
      const snapshot=await require('../models/KycSubmission').findOne({leadId:lead._id,leadVersion:lead.__v}).session(session);
      const Approval=require('../models/KycApproval');
      const approval=new Approval({leadId:lead._id,submissionId:snapshot._id,adminSignatureId:adminSignature._id,assignedEmployeeId:employee._id,assignedEmployeeName:employee.name,assignedEmployeeCode:employee.employeeCode,approvedAt:new Date()});
      const signedPdf=await require('./kycApplicationPdf.service').generate({lead,data,documentIds:[...lead.documentIds],employeeVerificationId:snapshot.employeeVerificationId,approval:approval.toObject(),submittedAt:snapshot.submittedAt,version:snapshot.leadVersion,revisionId:String(snapshot._id),label:'Final approved submitted application'});
      approval.signedPdfEncrypted=encrypt(signedPdf);approval.pdfDigest=crypto.createHash('sha256').update(signedPdf).digest('hex');await approval.save({session});
      lead.kycApprovalId=approval._id;
      lead.status = 'APPROVED'; lead.reviewedBy = user.id; lead.assignedEmployeeId = employee._id;
      lead.approvedAt = new Date(); lead.approvedKycEncrypted = lead.kycEncrypted;
      lead.approvedDocumentIds = [...lead.documentIds]; lead.adminRemarks = body.adminRemarks || undefined;
      event(lead, user, 'APPROVED');
      await lead.save({ session });
      await CustomerTimeline.create([{ customerId: lead.customerId, action: 'KYC Approved', details: 'Customer KYC reviewed and approved' }], { session });
      await audit(lead, user, 'KYC_APPROVED', session);
    });
  } catch (err) {
    if (err.name === 'VersionError' || err.code === 11000) throw error(409, 'Record changed or customer already exists. Reload and retry.');
    throw err;
  }
  return dto(lead);
}
async function upload(leadId, file, kind, version, user) {
  const lead = await access(leadId, user);
  if (user.role !== 'EMPLOYEE' || !editable(lead)) throw error(409, 'Documents can only be uploaded to an editable KYC');
  checkVersion(lead, version);
  if (!file || !['PHOTO', 'IDENTITY', 'ADDRESS', 'BUSINESS', 'INCOME', 'SIGNATURE'].includes(kind)) throw error(422, 'Choose a valid file and document category');
  const bytes = file.buffer;
  let mime;
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mime = 'image/png';
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mime = 'image/jpeg';
  else if (bytes.subarray(0, 5).toString() === '%PDF-') mime = 'application/pdf';
  if (!mime || mime !== file.mimetype || (['PHOTO', 'SIGNATURE'].includes(kind) && mime === 'application/pdf')) throw error(422, 'Upload a genuine JPEG, PNG, or PDF (photo/signature must be an image)');
  try {
    if (mime === 'application/pdf') {
      const pdf = await PDFDocument.load(bytes);
      if (pdf.getPageCount() > 20 || !pdf.getPageCount()) throw new Error('Page limit');
      // Reject active actions and embedded attachments, including objects from compressed object streams.
      for (const [, object] of pdf.context.enumerateIndirectObjects()) {
        if (/\/(JavaScript|JS|Launch|EmbeddedFiles|OpenAction|AA|RichMedia)\b/.test(object.toString())) throw new Error('Active PDF');
      }
    } else {
      if (mime === 'image/png' && (bytes.length < 33 || bytes.toString('ascii', 12, 16) !== 'IHDR' || bytes.readUInt32BE(16) < 1 || bytes.readUInt32BE(20) < 1 || bytes.readUInt32BE(16) * bytes.readUInt32BE(20) > 20000000)) throw new Error('Image dimensions');
      const pdf = await PDFDocument.create();
      const image = mime === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      if (image.width * image.height > 20000000) throw new Error('Image dimensions');
    }
  } catch { throw error(422, 'File is invalid, encrypted, too complex, or contains active content'); }
  const existing = await Document.find({ leadId }).select('size');
  if (existing.length >= 30 || existing.reduce((sum, doc) => sum + doc.size, 0) + bytes.length > 12 * 1024 * 1024) throw error(422, 'KYC upload limit reached (30 files / 12 MB including previous revisions)');
  const doc = new Document({ leadId, kind, mime, size: bytes.length, digest: crypto.createHash('sha256').update(bytes).digest('hex'),
    encryptedBytes: encrypt(bytes), uploadedBy: user.id });
  // One current document per category. Previous approved documents stay immutable for review history.
  const current = await Document.find({ _id: { $in: lead.documentIds }, leadId });
  lead.documentIds = [...current.filter(item => item.kind !== kind).map(item => item._id), doc._id];
  event(lead, user, 'DOCUMENT_UPLOADED', [kind]);
  await mongoose.connection.transaction(async session => {
    await doc.save({ session }); await lead.save({ session }); await audit(lead, user, 'KYC_DOCUMENT_UPLOADED', session);
  });
  return dto(lead);
}
async function document(leadId, documentId, user) {
  const lead = await access(leadId, user);
  if (!mongoose.isValidObjectId(documentId)) throw error(404, 'Document not found');
  const allowed = [...lead.documentIds, ...lead.approvedDocumentIds].some(value => id(value) === documentId) || Boolean(await require('../models/KycSubmission').exists({leadId:lead._id,documentIds:documentId}));
  if (!allowed) throw error(404, 'Document not found');
  const doc = await Document.findOne({ _id: documentId, leadId }).select('+encryptedBytes');
  if (!doc) throw error(404, 'Document not found');
  await audit(lead, user, 'KYC_DOCUMENT_VIEWED');
  return { bytes: decrypt(doc.encryptedBytes), mime: doc.mime, kind: doc.kind };
}
async function get(leadId, user) { const lead = await access(leadId, user); await audit(lead, user, 'KYC_VIEWED'); return dto(lead); }
module.exports = { access, dto, create, update, submit, revise, review, upload, document, get, decode, audit };
