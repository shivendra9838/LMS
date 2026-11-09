const mongoose=require('mongoose');
const Settings=require('../models/AccountSettings'),Request=require('../models/AccountRequest'),Company=require('../models/CompanySettings');
const Employee=require('../models/Employee'),Admin=require('../models/Admin'),Audit=require('../models/AuditLog');
const finance=require('./settlement.service'),{comparePassword,hashPassword}=require('../utils/password');
const defaults={appearance:'light',textSize:'normal',dateFormat:'DD/MM/YYYY',notifications:true,language:'en'};
const model=user=>user.role==='ADMIN'?Admin:Employee;
const fail=finance.error;
const clean=(value,max=100)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw fail(422,'Enter a valid text value');return value.trim();};
function fields(body,allowed){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))throw fail(422,'This operation contains unsupported fields');}
const paging=q=>{const page=Number(q.page||1),limit=Number(q.limit||20);if(!Number.isInteger(page)||page<1||page>100000||!Number.isInteger(limit)||limit<1||limit>100)throw fail(422,'Choose a page size between 1 and 100');return {page,limit,skip:(page-1)*limit};};
async function atomic(fn){await Promise.all([Settings,Request,Company].map(m=>m.init()));return finance.transaction(fn);}
async function audit(user,action,referenceId,newValue,session){await Audit.create([{userId:user.id,userModel:user.role==='ADMIN'?'Admin':'Employee',userRole:user.role,action,module:'ACCOUNT',referenceId:String(referenceId),newValue}],{session});}
async function reauthenticate(user,password){const account=await model(user).findById(user.id).select('+authVersion');if(typeof password!=='string'||password.length>100||!account||!await comparePassword(password,account.password))throw fail(422,'Current password is incorrect');return account;}
async function me(user){
 await finance.authorize(user);const account=await model(user).findById(user.id).select('name email phone address city area branchId employeeCode joiningDate status isActive role createdAt updatedAt').populate(user.role==='EMPLOYEE'?{path:'branchId',select:'name'}:[]).lean();
 const [settings,company]=await Promise.all([Settings.findOne({userId:user.id,role:user.role}).lean(),Company.findById('company').lean()]);
 return {profile:account,preferences:{...defaults,...settings?.preferences},photo:settings?.photoType?{updatedAt:settings.photoUpdatedAt}:null,company:company||{name:'Royal Enterprises'},version:require('../../package.json').version,currency:'INR',timeZone:'Asia/Kolkata'};
}
async function profile(body,user){
 await finance.authorize(user);fields(body,user.role==='ADMIN'?['name','phone','address']:['address']);
 const changes={};for(const [key,value]of Object.entries(body)){if(key==='address'){if(typeof value!=='string'||value.length>500)throw fail(422,'Address is limited to 500 characters');changes[key]=value.trim();}else changes[key]=clean(value);}
 if(changes.phone&&!/^\d{10}$/.test(changes.phone))throw fail(422,'Use a 10-digit mobile number');
 return atomic(async session=>{await model(user).updateOne({_id:user.id},{$set:changes},{session,runValidators:true});await audit(user,'PROFILE_UPDATED',user.id,{fields:Object.keys(changes)},session);return {updated:true};});
}
async function preferences(body,user){
 await finance.authorize(user);fields(body,Object.keys(defaults));
 for(const [key,value]of Object.entries(body)){const allowed={appearance:['light','dark','system'],textSize:['normal','large'],dateFormat:['DD/MM/YYYY','YYYY-MM-DD'],notifications:[true,false],language:['en']};if(!allowed[key].includes(value))throw fail(422,'Choose supported preferences');}
 await Settings.findOneAndUpdate({userId:user.id,role:user.role},{$set:Object.fromEntries(Object.entries(body).map(([k,v])=>['preferences.'+k,v]))},{upsert:true,runValidators:true});return {saved:true};
}
async function password(body,user){
 await finance.authorize(user);fields(body,['currentPassword','password','confirmPassword']);const account=await reauthenticate(user,body.currentPassword),value=body.password;
 if(typeof value!=='string'||value.length<12||value.length>64||Buffer.byteLength(value)>72||!/[a-z]/.test(value)||!/[A-Z]/.test(value)||!/\d/.test(value)||!/[\W_]/.test(value))throw fail(422,'Use 12–64 characters with uppercase, lowercase, a number and a symbol');
 if(value!==body.confirmPassword)throw fail(422,'Passwords do not match');if(await comparePassword(value,account.password))throw fail(422,'Choose a different password');const hashed=await hashPassword(value);
 return atomic(async session=>{const changed=await model(user).updateOne({_id:user.id,password:account.password},{$set:{password:hashed},$inc:{authVersion:1},...(user.role==='EMPLOYEE'?{$unset:{passwordReset:1}}:{})},{session});if(!changed.modifiedCount)throw fail(409,'Account changed; sign in and retry');await audit(user,'PASSWORD_CHANGED',user.id,{sessionsRevoked:true},session);return {signInRequired:true};});
}
async function sessions(body,user){await finance.authorize(user);await reauthenticate(user,body.currentPassword);return atomic(async session=>{await model(user).updateOne({_id:user.id},{$inc:{authVersion:1}},{session});await audit(user,'ALL_SESSIONS_REVOKED',user.id,{},session);return {signInRequired:true};});}
async function upload(file,user){
 await finance.authorize(user);if(!file||!['image/jpeg','image/png'].includes(file.mimetype))throw fail(422,'Choose a JPEG or PNG image up to 2 MB');
 const bytes=file.buffer,png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!(png&&file.mimetype==='image/png'||jpg&&file.mimetype==='image/jpeg'))throw fail(422,'Image contents do not match the file type');
 if(png&&(bytes.length<33||bytes.readUInt32BE(16)*bytes.readUInt32BE(20)>16000000))throw fail(422,'Use an image smaller than 16 megapixels');
 try{const pdf=await require('pdf-lib').PDFDocument.create(),image=png?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);if(image.width*image.height>16000000)throw Error('dimensions');}catch{throw fail(422,'The image is damaged or too large');}
 const encrypted=require('../utils/kycCrypto').encrypt(bytes);return atomic(async session=>{await Settings.findOneAndUpdate({userId:user.id,role:user.role},{$set:{photo:encrypted,photoType:file.mimetype,photoUpdatedAt:new Date()}},{session,upsert:true});await audit(user,'PROFILE_PHOTO_UPDATED',user.id,{},session);return {saved:true};});
}
async function photo(user,target){await finance.authorize(user,Boolean(target));const userId=target?String(finance.objectId(target)):user.id;const row=await Settings.findOne({userId,role:target?'EMPLOYEE':user.role}).select('+photo');if(!row?.photo)throw fail(404,'Profile photo not found');return {bytes:require('../utils/kycCrypto').decrypt(row.photo),type:row.photoType};}
async function removePhoto(user){await finance.authorize(user);return atomic(async session=>{await Settings.updateOne({userId:user.id,role:user.role},{$unset:{photo:1,photoType:1},$set:{photoUpdatedAt:new Date()}},{session});await audit(user,'PROFILE_PHOTO_REMOVED',user.id,{},session);return {removed:true};});}
async function dependencies(employeeId,session){
 const loans=require('../models/Loan'),positions=require('../models/CollectionPosition'),settlements=require('../models/EmployeeSettlement');
 const [activeLoans,outstandingCustody,unresolvedSettlements,assignedCustomers]=await Promise.all([
  loans.countDocuments({employeeId,status:{$in:['ACTIVE','DEFAULTED']},remainingAmount:{$gt:0}}).session(session||null),
  positions.countDocuments({employeeId,bucket:{$in:[...finance.held,'UNCLASSIFIED']},$expr:{$gt:['$amountMinor',{$ifNull:['$settledMinor',0]}]}}).session(session||null),
  settlements.countDocuments({employeeId,status:{$in:['SUBMITTED','DISPUTED']}}).session(session||null),require('../models/Customer').countDocuments({employeeId}).session(session||null)
 ]);return {activeLoans,outstandingCustody,unresolvedSettlements,assignedCustomers,canDeactivate:!activeLoans&&!outstandingCustody&&!unresolvedSettlements};
}
async function request(body,user){
 await finance.authorize(user);if(user.role!=='EMPLOYEE')throw fail(403,'Employee account required');fields(body,['kind','reason','currentPassword','changes']);const account=await reauthenticate(user,body.currentPassword);
 if(!['PROFILE_CHANGE','DEACTIVATION'].includes(body.kind))throw fail(422,'Choose a request type');const reason=clean(body.reason,1000);if(reason.length<5)throw fail(422,'Give a reason of at least 5 characters');
 const changes={},previous={};if(body.kind==='PROFILE_CHANGE'){
  fields(body.changes,['name','email','phone','city','area']);if(!Object.keys(body.changes||{}).length)throw fail(422,'Choose at least one profile field');
  for(const [key,value]of Object.entries(body.changes)){changes[key]=clean(value,key==='email'?254:100);previous[key]=account[key]||'';}
  if(changes.phone&&!/^\d{10}$/.test(changes.phone))throw fail(422,'Use a 10-digit mobile number');if(changes.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email))throw fail(422,'Use a valid email');if(changes.email)changes.email=changes.email.toLowerCase();
 }
 return atomic(async session=>{const [created]=await Request.create([{employeeId:user.id,kind:body.kind,reason,changes,previous}],{session});await audit(user,'ACCOUNT_REQUEST_SUBMITTED',created._id,{kind:body.kind},session);return created;});
}
async function requests(q,user){await finance.authorize(user);const p=paging(q),match=(user.role==='EMPLOYEE'||q.scope==='own')?{employeeId:user.id}:{};if(q.status){if(!['PENDING','APPROVED','REJECTED','CANCELLED'].includes(q.status))throw fail(422,'Choose a request status');match.status=q.status;}if(q.employeeId&&user.role==='ADMIN')match.employeeId=finance.objectId(q.employeeId);if(q.requestId)match._id=finance.objectId(q.requestId);const [rows,total]=await Promise.all([Request.find(match).populate('employeeId','name employeeCode').populate('reviewedBy','name').sort({createdAt:-1,_id:-1}).skip(p.skip).limit(p.limit).lean(),Request.countDocuments(match)]);return {rows,meta:{...p,total,totalPages:Math.ceil(total/p.limit)}};}
async function cancel(id,user){await finance.authorize(user);if(user.role!=='EMPLOYEE')throw fail(403,'Employee account required');return atomic(async session=>{const row=await Request.findOneAndUpdate({_id:finance.objectId(id),employeeId:user.id,status:'PENDING'},{$set:{status:'CANCELLED'}},{session,returnDocument:'after'});if(!row)throw fail(409,'Only your pending request can be cancelled');await audit(user,'ACCOUNT_REQUEST_CANCELLED',id,{},session);return row;});}
async function review(id,body,user){
 await finance.authorize(user,true);fields(body,['action','remarks']);if(!['APPROVED','REJECTED'].includes(body.action))throw fail(422,'Choose approve or reject');const remarks=clean(body.remarks,1000);if(remarks.length<5)throw fail(422,'Give review remarks of at least 5 characters');
 return atomic(async session=>{const row=await Request.findById(finance.objectId(id)).session(session);if(!row||row.status!=='PENDING')throw fail(409,'Request already reviewed or unavailable');const employee=await Employee.findById(row.employeeId).select('+authVersion').session(session);if(!employee)throw fail(404,'Employee not found');
  if(body.action==='APPROVED'){
   if(row.kind==='DEACTIVATION'){const deps=await dependencies(row.employeeId,session);if(!deps.canDeactivate)throw fail(409,'Resolve active loans, outstanding custody and pending/disputed settlements before deactivation');employee.status='INACTIVE';}
   else for(const [key,value]of row.changes){if(String(employee[key]||'')!==row.previous.get(key))throw fail(409,'Profile changed since submission. Reject this request and request a fresh one');if(['email','phone'].includes(key)){if(await Employee.exists({_id:{$ne:employee._id},[key]:value}).session(session)||key==='email'&&await Admin.exists({email:value}).session(session))throw fail(409,'Email or mobile is already registered');}employee[key]=value;}
   employee.authVersion=(employee.authVersion||0)+1;await employee.save({session});
  }
  row.status=body.action;row.remarks=remarks;row.reviewedBy=user.id;row.reviewedAt=new Date();await row.save({session});await audit(user,'ACCOUNT_REQUEST_'+body.action,id,{kind:row.kind,employeeId:row.employeeId,fields:[...row.changes.keys()]},session);return row;
 });
}
async function activity(q,user){await finance.authorize(user);const p=paging(q),match=(user.role==='EMPLOYEE'||q.scope==='own')?{userId:new mongoose.Types.ObjectId(user.id),module:{$in:['AUTH','ACCOUNT']}}:{};if(q.employeeId){await finance.authorize(user,true);const id=finance.objectId(q.employeeId);match.$or=[{userId:id},{module:'ACCOUNT',referenceId:String(id)},{'newValue.employeeId':{$in:[id,String(id)]}}];}if(q.action){const value=clean(q.action,100);match.action={$regex:value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'};}if(q.role&&user.role==='ADMIN'){if(!['ADMIN','EMPLOYEE','SYSTEM'].includes(q.role))throw fail(422,'Choose a role');match.userRole=q.role;}const [rows,total]=await Promise.all([Audit.find(match).select('userRole action module createdAt').sort({createdAt:-1,_id:-1}).skip(p.skip).limit(p.limit).lean(),Audit.countDocuments(match)]);return {rows,meta:{page:p.page,limit:p.limit,total,totalPages:Math.ceil(total/p.limit)}};}
async function company(body,user){await finance.authorize(user,true);fields(body,['name','contactEmail','contactPhone','address']);const changes={};for(const [key,value]of Object.entries(body)){if(typeof value!=='string'||value.length>(key==='address'?500:254))throw fail(422,'Company details are too long');changes[key]=value.trim();}if(changes.name!==undefined&&!changes.name)throw fail(422,'Company name is required');if(changes.contactEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.contactEmail))throw fail(422,'Use a valid support email');if(changes.contactPhone&&!/^\+?[\d ()-]{7,20}$/.test(changes.contactPhone))throw fail(422,'Use a valid support number');return atomic(async session=>{await Company.updateOne({_id:'company'},{$set:changes},{upsert:true,session});await audit(user,'COMPANY_CONTACT_UPDATED','company',{fields:Object.keys(changes)},session);return {saved:true};});}
async function work(user,brief=false){await finance.authorize(user);const employeeId=user.role==='EMPLOYEE'?user.id:undefined,match=employeeId?{employeeId}:{};const [dashboard,pending,recent,activeLoans]=await Promise.all([brief?Promise.resolve(null):user.role==='ADMIN'?require('../repositories/dashboard.repository').getAdminDashboardStats({}):require('../repositories/dashboard.repository').getEmployeeDashboardStats(user.id),require('../models/EmployeeSettlement').countDocuments({...match,status:'SUBMITTED'}),require('../models/EmployeeSettlement').find(match).select('status kind amountMinor occurredAt reviewedAt createdAt employeeId').populate('employeeId','name employeeCode').sort({createdAt:-1}).limit(5).lean(),require('../models/Loan').countDocuments({...match,status:{$in:['ACTIVE','DEFAULTED']},remainingAmount:{$gt:0}})]);return {dashboard,pendingSettlements:pending,recentSettlements:recent,activeLoans};}
module.exports={me,profile,preferences,password,sessions,upload,photo,removePhoto,request,requests,cancel,review,dependencies,activity,company,work};
