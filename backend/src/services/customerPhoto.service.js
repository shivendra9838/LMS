const mongoose=require('mongoose'),sharp=require('sharp'),crypto=require('crypto');
const Customer=require('../models/Customer'),Photo=require('../models/CustomerDisplayPhoto');
const finance=require('./settlement.service'),{encrypt,decrypt}=require('../utils/kycCrypto');
const MAX_BYTES=5*1024*1024,MAX_PIXELS=16000000;
const rasterMime=b=>b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':b[0]===255&&b[1]===216&&b[2]===255?'image/jpeg':b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'?'image/webp':null;
async function access(customerId,user){
 await finance.authorize(user);
 if(typeof customerId!=='string'||!/^[a-f\d]{24}$/i.test(customerId))throw finance.error(422,'Invalid customer identifier');
 const customer=await Customer.findOne({_id:customerId,...(user.role==='EMPLOYEE'?{employeeId:user.id}:{})}).select('_id employeeId kycLeadId photo').lean();
 if(!customer)throw finance.error(404,'Customer not found in your assigned portfolio');return customer;
}
function cropInput(body={}){const out={};for(const [field,fallback,max]of [['x',0.5,1],['y',0.5,1],['zoom',1,4]]){const value=body[field]===undefined?fallback:Number(body[field]);if(body[field]===''||!Number.isFinite(value)||value<(field==='zoom'?1:0)||value>max)throw finance.error(422,'Use valid photo positioning and a zoom between 1 and 4');out[field]=value;}return out;}
async function normalize(file,body){
 if(!file?.buffer||file.buffer.length>MAX_BYTES||!['image/jpeg','image/png','image/webp'].includes(file.mimetype)||!(/\.(jpe?g|png|webp)$/i.test(file.originalname||'')))throw finance.error(422,'Choose a JPG, PNG or WebP image up to 5 MB');
 const crop=cropInput(body);
 const detected=rasterMime(file.buffer);
 if(detected!==file.mimetype)throw finance.error(422,'Image contents do not match the declared file type');
 try{
  const image=sharp(file.buffer,{limitInputPixels:MAX_PIXELS,failOn:'warning'}),meta=await image.metadata();
  if(({jpeg:'image/jpeg',png:'image/png',webp:'image/webp'})[meta.format]!==file.mimetype||meta.pages>1||meta.width<128||meta.height<128)throw Error('Unsupported image');
  // Decode complete content, apply EXIF orientation, strip metadata and crop in normalized coordinates.
  const oriented=await image.rotate().toBuffer({resolveWithObject:true});
  const {width,height}=oriented.info,side=Math.max(1,Math.floor(Math.min(width,height)/crop.zoom));
  if(side<128)throw finance.error(422,'Reduce zoom or choose a larger image. The crop must retain at least 128 × 128 pixels.');
  const bytes=await sharp(oriented.data,{limitInputPixels:MAX_PIXELS}).extract({left:Math.round((width-side)*crop.x),top:Math.round((height-side)*crop.y),width:side,height:side}).resize(512,512,{withoutEnlargement:true}).webp({quality:85}).toBuffer();
  return {bytes,crop};
 }catch(error){if(error.status===422)throw error;throw finance.error(422,'Use a complete, non-animated JPG, PNG or WebP, at least 128 × 128 pixels and no more than 16 megapixels');}
}
async function source(customer,includeBytes=false){
 const display=await Photo.findOne({customerId:customer._id}).sort({createdAt:-1,_id:-1}).select(includeBytes?'+encryptedBytes':'_id createdAt');
 if(display)return {available:true,source:'DISPLAY',revision:String(display._id),...(includeBytes?{bytes:decrypt(display.encryptedBytes)}:{})};
 if(customer.kycLeadId){
  const lead=await require('../models/CustomerLead').findOne({_id:customer.kycLeadId,customerId:customer._id}).select('approvedDocumentIds documentIds status').lean();
  const ids=lead?.approvedDocumentIds?.length?lead.approvedDocumentIds:lead?.status==='APPROVED'?lead.documentIds:[];
  const doc=await require('../models/KycDocument').findOne({_id:{$in:ids||[]},leadId:customer.kycLeadId,kind:'PHOTO'}).select(includeBytes?'+encryptedBytes':'_id');
  if(doc)return {available:true,source:'APPROVED_KYC',revision:String(doc._id),...(includeBytes?{bytes:decrypt(doc.encryptedBytes)}:{})};
 }
 // Do not fetch arbitrary legacy URLs or expose them to the browser. Safe embedded legacy images stay private.
 if(typeof customer.photo==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\s]+$/.test(customer.photo)&&customer.photo.length<MAX_BYTES*1.4){const bytes=Buffer.from(customer.photo.split(',')[1],'base64');return {available:true,source:'LEGACY',revision:crypto.createHash('sha256').update(bytes).digest('hex'),...(includeBytes?{bytes}:{})};}
 return {available:false,source:null,revision:null};
}
async function metadata(id,user){return source(await access(id,user));}
async function image(id,user,variant){
 if(variant&&!['thumb','profile','preview'].includes(variant))throw finance.error(422,'Choose a supported photo size');
 const data=await source(await access(id,user),true);if(!data.available)throw finance.error(404,'Customer photo not found');
 try{if(!rasterMime(data.bytes))throw Error('Unsupported legacy content');const decoder=sharp(data.bytes,{limitInputPixels:20000000,failOn:'warning'}),meta=await decoder.metadata();if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1)throw Error('Unsupported raster');return await decoder.rotate().resize(variant==='preview'?1600:variant==='thumb'?88:512,variant==='preview'?1600:variant==='thumb'?88:512,{fit:variant==='preview'?'inside':'cover',withoutEnlargement:true}).webp({quality:85}).toBuffer();}catch{throw finance.error(422,'The saved photo cannot be displayed. Upload a valid display photo; original KYC files are unchanged.');}
}
async function upload(id,file,body,user){
 const customer=await access(id,user),{bytes,crop}=await normalize(file,body);
 const Timeline=require('../models/CustomerTimeline'),Audit=require('../models/AuditLog');
 await Promise.all([Photo,Timeline,Audit].map(m=>m.init()));
 return mongoose.connection.transaction(async session=>{
  // Recheck current assignment in the transaction; never update customer or approved KYC records.
  const allowed=await Customer.exists({_id:customer._id,...(user.role==='EMPLOYEE'?{employeeId:user.id}:{})}).session(session);if(!allowed)throw finance.error(404,'Customer assignment changed. Reload before uploading.');
  const [photo]=await Photo.create([{customerId:customer._id,encryptedBytes:encrypt(bytes),digest:crypto.createHash('sha256').update(bytes).digest('hex'),crop,actorId:user.id,actorRole:user.role}],{session});
  await Audit.create([{userId:user.id,userModel:user.role==='ADMIN'?'Admin':'Employee',userRole:user.role,module:'CUSTOMER',action:'CUSTOMER_DISPLAY_PHOTO_UPDATED',referenceId:String(customer._id),newValue:{photoId:photo._id,digest:photo.digest,crop,source:'DISPLAY'}}],{session});
  await Timeline.create([{customerId:customer._id,action:'Display Photo Updated',details:`Customer display photo updated by ${user.role} (${user.id}). Approved KYC photos and submission snapshots were preserved.`}],{session});
  return {available:true,source:'DISPLAY',revision:String(photo._id)};
 });
}
module.exports={access,metadata,image,upload,normalize,MAX_BYTES};

