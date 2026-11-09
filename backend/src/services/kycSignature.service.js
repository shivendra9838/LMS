const crypto=require('crypto'),mongoose=require('mongoose'),sharp=require('sharp');
const Signature=require('../models/KycVerificationSignature');
const {encrypt,decrypt}=require('../utils/kycCrypto');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const binding=lead=>crypto.createHash('sha256').update(JSON.stringify({data:require('./kyc.service').decode(lead.kycEncrypted),documents:lead.documentIds.map(String)})).digest('hex');
async function upload(leadId,file,version,user){
 const kyc=require('./kyc.service'),lead=await kyc.access(leadId,user);
 if(!Number.isInteger(version)||version!==lead.__v)throw fail(409,'KYC changed. Reload and sign the current revision.');
 if(user.role==='ADMIN'?lead.status!=='PENDING':!['DRAFT','CORRECTION_REQUIRED','REJECTED'].includes(lead.status))throw fail(409,'This KYC revision cannot be signed in its current state.');
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.mimetype)||!file.buffer?.length||file.buffer.length>2*1024*1024)throw fail(422,'Choose a signature image (PNG, JPEG or WebP) up to 2 MB.');
 let bytes;
 try{
  const meta=await sharp(file.buffer,{limitInputPixels:16000000}).metadata();
  if(!['png','jpeg','webp'].includes(meta.format)||meta.pages>1||meta.width<2||meta.height<2)throw Error('Invalid image');
  // Decode the actual image and strip metadata. Reject empty/uniform signature canvases.
  const img=sharp(file.buffer,{limitInputPixels:16000000}).flatten({background:'#ffffff'});
  const stats=await img.clone().stats();if(stats.channels.slice(0,3).every(c=>c.stdev<1))throw Error('Empty signature');
  bytes=await img.png().toBuffer();
 }catch{throw fail(422,'Provide a genuine, non-empty signature image up to 16 megapixels.');}
 const actor=await require(user.role==='ADMIN'?'../models/Admin':'../models/Employee').findById(user.id);
 if(bytes.length>2*1024*1024)throw fail(422,'Signature image is too complex; choose a smaller image.');
 if(await Signature.countDocuments({leadId})>=60)throw fail(422,'Signature evidence limit reached. Contact Admin support.');
 const doc=new Signature({leadId,leadVersion:version,binding:binding(lead),actorId:user.id,role:user.role,name:actor.name,employeeCode:actor.employeeCode,mime:'image/png',digest:crypto.createHash('sha256').update(bytes).digest('hex'),encryptedBytes:encrypt(bytes)});
 await mongoose.connection.transaction(async session=>{await doc.save({session});await kyc.audit(lead,user,'KYC_'+user.role+'_SIGNATURE_UPLOADED',session);});return metadata(doc);
}
function metadata(doc){return doc?{_id:doc._id,name:doc.name,employeeCode:doc.employeeCode,role:doc.role,signedAt:doc.signedAt,leadVersion:doc.leadVersion}:null;}
async function requireSignature(lead,signatureId,user){
 if(!mongoose.isValidObjectId(signatureId))throw fail(422,'Upload your verification signature and explicitly confirm this action.');
 const doc=await Signature.findOne({_id:signatureId,leadId:lead._id,actorId:user.id,role:user.role,leadVersion:lead.__v,binding:binding(lead)});
 if(!doc)throw fail(422,'Signature does not belong to you or this revision. Sign the current saved form again.');return doc;
}
async function evidence(application){
 const ids=[application.employeeVerificationId,application.approval?.adminSignatureId].filter(Boolean);
 const rows=ids.length?await Signature.find({_id:{$in:ids},leadId:application.lead._id}).select('+encryptedBytes'):[];
 const find=id=>rows.find(r=>String(r._id)===String(id));
 return {employee:find(application.employeeVerificationId),admin:find(application.approval?.adminSignatureId)};
}
async function document(leadId,signatureId,user){
 const lead=await require('./kyc.service').access(leadId,user);
 if(!mongoose.isValidObjectId(signatureId))throw fail(404,'Signature not found');
 const doc=await Signature.findOne({_id:signatureId,leadId}).select('+encryptedBytes');if(!doc)throw fail(404,'Signature not found');
 const attached=await require('../models/KycSubmission').exists({leadId,employeeVerificationId:signatureId})||await require('../models/KycApproval').exists({leadId,adminSignatureId:signatureId});
 if(!attached&&(String(doc.actorId)!==user.id||doc.role!==user.role))throw fail(404,'Signature not found');
 await require('./kyc.service').audit(lead,user,'KYC_VERIFICATION_SIGNATURE_VIEWED');return {bytes:decrypt(doc.encryptedBytes),mime:doc.mime};
}
module.exports={upload,requireSignature,metadata,evidence,document,binding};
