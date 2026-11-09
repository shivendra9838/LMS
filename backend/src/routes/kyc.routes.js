const router = require('express').Router();
const multer = require('multer');
const mongoose = require('mongoose');
const service = require('../services/kyc.service');
const pdf = require('../services/kycPdf.service');
const Customer = require('../models/Customer');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2*1024*1024, files:1, fields:2, parts:3, fieldSize:100 } });
const run = fn => async (req,res,next) => { try { await fn(req,res); } catch(err) { next(err); } };
const json = (res,data,status=200) => res.status(status).json({success:true,data});
router.use(authenticate, authorizeRoles('ADMIN','EMPLOYEE'));
router.use((req,res,next)=> { res.set('Cache-Control','no-store'); res.set('Pragma','no-cache'); next(); });
router.post('/',run(async(req,res)=>json(res,await service.create(req.body.data,req.user,req.body.customerId),201)));
router.get('/customer/:customerId',run(async(req,res)=> {
  if(!mongoose.isValidObjectId(req.params.customerId)) throw Object.assign(new Error('Customer not found'),{status:404});
  const customer=await Customer.findById(req.params.customerId);
  if(!customer || (req.user.role==='EMPLOYEE' && String(customer.employeeId)!==req.user.id)) throw Object.assign(new Error('Customer not found'),{status:404});
  if(!customer.kycLeadId) return json(res,null);
  return json(res,await service.get(customer.kycLeadId,req.user));
}));
router.post('/:id/verification-signatures',run(async(req,res)=>{
 await service.access(req.params.id,req.user);
 await new Promise((resolve,reject)=>upload.single('file')(req,res,err=>err?reject(Object.assign(new Error('Upload one signature image up to 2 MB'),{status:422})):resolve()));
 json(res,await require('../services/kycSignature.service').upload(req.params.id,req.file,Number(req.body.version),req.user),201);
}));
router.get('/:id/verification-signatures/:signatureId',run(async(req,res)=>{
 const doc=await require('../services/kycSignature.service').document(req.params.id,req.params.signatureId,req.user);
 res.set('Content-Type',doc.mime);res.set('X-Content-Type-Options','nosniff');res.set('Content-Disposition','inline; filename="verification-signature.png"');res.send(doc.bytes);
}));
router.get('/:id',run(async(req,res)=>json(res,await service.get(req.params.id,req.user))));
router.put('/:id',run(async(req,res)=>json(res,await service.update(req.params.id,req.body,req.user))));
router.post('/:id/submit',run(async(req,res)=>json(res,await service.submit(req.params.id,req.body.version,req.user,req.body))));
router.post('/:id/revise',run(async(req,res)=>json(res,await service.revise(req.params.id,req.body.version,req.user))));
router.post('/:id/documents',run(async(req,res)=> {
  // Authorize before parsing file bytes to prevent unauthorized upload allocation.
  await service.access(req.params.id,req.user);
  if(req.user.role!=='EMPLOYEE') throw Object.assign(new Error('Only employees can upload documents'),{status:403});
  await new Promise((resolve,reject)=>upload.single('file')(req,res,err=>err?reject(Object.assign(err,{status:422,message:'Upload one JPEG, PNG, or PDF up to 2 MB'})):resolve()));
  return json(res,await service.upload(req.params.id,req.file,req.body.kind,Number(req.body.version),req.user),201);
}));
router.get('/:id/documents/:documentId',run(async(req,res)=> {
  const doc=await service.document(req.params.id,req.params.documentId,req.user);
  const ext=doc.mime==='application/pdf'?'pdf':doc.mime==='image/png'?'png':'jpg';
  res.set('Content-Type',doc.mime); res.set('X-Content-Type-Options','nosniff');
  res.set('Content-Security-Policy',"default-src 'none'; sandbox");
  res.set('Content-Disposition',`inline; filename="${doc.kind.toLowerCase()}.${ext}"`);
  res.send(doc.bytes);
}));
router.get('/:id/applications',run(async(req,res)=>json(res,await require('../services/kycApplication.service').list(req.params.id,req.user))));
router.get('/:id/application/documents',run(async(req,res)=>{
 const application=await require('../services/kycApplication.service').resolve(req.params.id,req.query.revision,req.user);
 const documents=await require('../models/KycDocument').find({_id:{$in:application.documentIds},leadId:application.lead._id}).select('kind mime size createdAt').lean();
 json(res,{revisionId:application.revisionId,documents});
}));
router.get('/:id/application/pdf',run(async(req,res)=>{
 const application=await require('../services/kycApplication.service').resolve(req.params.id,req.query.revision,req.user);
 const bytes=await require('../services/kycApplicationPdf.service').generate(application);
 await require('../models/AuditLog').create({userId:req.user.id,userModel:req.user.role==='ADMIN'?'Admin':'Employee',userRole:req.user.role,action:'KYC_APPLICATION_VIEWED',module:'KYC',referenceId:String(application.lead._id),newValue:{submissionId:application.revisionId,version:application.version}});
 res.set('Content-Type','application/pdf');res.set('Content-Disposition',`inline; filename="customer-application-${application.lead._id}.pdf"`);res.send(bytes);
}));
router.get('/:id/pdf',run(async(req,res)=> {
  const lead=await service.access(req.params.id,req.user);
  const approved=req.query.snapshot==='approved';
  if(approved&&!lead.approvedAt) throw Object.assign(new Error('Approved snapshot not found'),{status:404});
  let application;
  if(approved){const approval=lead.kycApprovalId?await require('../models/KycApproval').findById(lead.kycApprovalId):await require('../models/KycApproval').findOne({leadId:lead._id}).sort({approvedAt:-1});if(approval)application=await require('../services/kycApplication.service').resolve(req.params.id,String(approval.submissionId),req.user);}
  else if(lead.status==='PENDING'||lead.status==='APPROVED')application=await require('../services/kycApplication.service').resolve(req.params.id,null,req.user);
  const bytes=application?await require('../services/kycApplicationPdf.service').generate(application):await pdf.generate(lead,service.decode(approved?lead.approvedKycEncrypted:lead.kycEncrypted),approved);
  await service.audit(lead,req.user,'KYC_PDF_DOWNLOADED');
  res.set('Content-Type','application/pdf');
  res.set('Content-Disposition',`attachment; filename="customer-kyc-${lead._id}.pdf"`);
  res.send(bytes);
}));
module.exports=router;
