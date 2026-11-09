const router=require('express').Router();
const multer=require('multer');
const service=require('../services/settlement.service');
const reconciliation=require('../services/reconciliation.service');
const {authenticate}=require('../middlewares/auth.middleware');
const {authorizeRoles}=require('../middlewares/role.middleware');
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024,files:1,fields:8,parts:9,fieldSize:2000}});
const run=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(err){next(err);}};
const json=(res,data,status=200)=>res.status(status).json({success:true,data});
const accountAdmin=(req,res,next)=>{
  if(req.user.role!=='ADMIN')return res.status(403).json({success:false,message:'Receiving-account management requires an Admin session. Sign in to the Admin Portal and retry.'});
  next();
};
router.use(authenticate,authorizeRoles('ADMIN','EMPLOYEE'),async(req,res,next)=>{try{await service.authorize(req.user);res.set('Cache-Control','no-store');res.set('Pragma','no-cache');next();}catch(err){next(err);}});
router.get('/accounts',run(async(req,res)=>json(res,await service.accounts(req.user))));
router.post('/accounts',accountAdmin,run(async(req,res)=>json(res,await service.createAccount(req.body,req.user),201)));
router.patch('/accounts/:id',accountAdmin,run(async(req,res)=>json(res,await service.setAccountActive(req.params.id,req.body,req.user))));
router.get('/dashboard',run(async(req,res)=>json(res,await reconciliation.dashboard(req.query,req.user))));
router.get('/export/:format',run(async(req,res)=>{
  if(!['xlsx','pdf'].includes(req.params.format))throw service.error(422,'Choose xlsx or pdf');
  const data=await reconciliation.dashboard(req.query,req.user,{exportRows:true});
  const exporter=require('../services/reconciliationExport.service');
  let context;
  if(req.params.format==='pdf'){const actor=await require('../models/'+(req.user.role==='ADMIN'?'Admin':'Employee')).findById(req.user.id).select('name').lean();const filters=[];if(req.query.employeeId){const selected=data.employees.find(e=>String(e._id)===req.query.employeeId);filters.push(['Employee',selected?selected.name+' ('+selected.employeeCode+')':'Selected employee']);}if(req.query.branchId){const branch=await require('../models/Branch').findById(req.query.branchId).select('name').lean();filters.push(['Branch',branch?.name||'Selected branch']);}for(const [key,label] of [['area','Area'],['method','Method'],['status','Settlement status'],['search','Reference search']])if(req.query[key])filters.push([label,req.query[key]]);context={generatedBy:{name:actor?.name,role:req.user.role},generatedAt:new Date(),filters};}
  const bytes=await exporter[req.params.format](data,context);
  await service.audit(req.user,'RECONCILIATION_EXPORTED',req.user.id,{format:req.params.format,from:data.dates.from,to:data.dates.to});
  res.type(req.params.format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.attachment(`reconciliation.${req.params.format}`);res.send(bytes);
}));
router.post('/',authorizeRoles('EMPLOYEE'),run(async(req,res)=>json(res,await service.submit(req.body,req.user),201)));
router.get('/:id',run(async(req,res)=>json(res,await service.details(req.params.id,req.user))));
router.post('/:id/review',authorizeRoles('ADMIN'),run(async(req,res)=>json(res,await service.review(req.params.id,req.body,req.user))));
router.post('/positions/:id/review',authorizeRoles('ADMIN'),run(async(req,res)=>json(res,await service.verifyPosition(req.params.id,req.body,req.user))));
router.post('/legacy/:id/classify',authorizeRoles('ADMIN'),run(async(req,res)=>json(res,await service.classify(req.params.id,req.body,req.user))));
const evidenceUpload=type=>run(async(req,res)=>{
  await service.authorize(req.user);
  // Ownership is checked before allocating multipart buffers.
  if(type==='Settlement')await service.details(req.params.id,req.user);else if(req.user.role!=='ADMIN')throw service.error(403,'Forbidden');
  await new Promise((resolve,reject)=>upload.single('file')(req,res,err=>err?reject(service.error(422,'Upload one JPEG, PNG, or PDF up to 2 MB')):resolve()));
  json(res,await service.evidence(type,req.params.id,req.body,req.file,req.user),201);
});
router.post('/:id/evidence',evidenceUpload('Settlement'));
router.post('/positions/:id/evidence',authorizeRoles('ADMIN'),evidenceUpload('Position'));
router.get('/proofs/:id',run(async(req,res)=>{const file=await service.proof(req.params.id,req.user);res.type(file.mime);res.set('X-Content-Type-Options','nosniff');res.set('Content-Security-Policy',"default-src 'none'; sandbox");res.set('Content-Disposition','attachment; filename="financial-proof.'+(file.mime==='application/pdf'?'pdf':file.mime==='image/png'?'png':'jpg')+'"');res.send(file.bytes);}));
module.exports=router;
