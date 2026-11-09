const Submission=require('../models/KycSubmission');
const kyc=require('./kyc.service');
const error=(status,message)=>Object.assign(new Error(message),{status});
async function capture(lead,session,source='SUBMITTED'){
 const version=lead.__v||0;
 const approved=source==='LEGACY_APPROVED';
 const bytes=approved?lead.approvedKycEncrypted:lead.kycEncrypted;
 if(!bytes)return;
 const submitted=[...(lead.history||[])].reverse().find(e=>e.action==='SUBMITTED')?.at;
 await Submission.updateOne({leadId:lead._id,leadVersion:version},{$setOnInsert:{encryptedData:bytes,employeeVerificationId:lead.employeeVerificationId,documentIds:approved?lead.approvedDocumentIds:lead.documentIds,submittedAt:submitted,source,createdAt:new Date(),updatedAt:new Date()}},{upsert:true,session,timestamps:false});
}
function submittedDate(row,lead){
 if(!row)return undefined;
 if(row.source!=='LEGACY_APPROVED')return row.submittedAt;
 // Older captures used approval time. Only a recorded submission event proves submission time.
 return [...(lead.history||[])].reverse().find(event=>event.action==='SUBMITTED'&&event.at&&event.at<=row.createdAt)?.at;
}
async function list(id,user){const lead=await kyc.access(id,user);const rows=await Submission.find({leadId:id}).select('-encryptedData').sort({leadVersion:-1}).lean();return rows.map(row=>({...row,submittedAt:submittedDate(row,lead)||null}));}
async function resolve(id,revision,user){
 const lead=await kyc.access(id,user);
 let row;
 if(revision){if(!/^[a-f0-9]{24}$/i.test(revision))throw error(404,'Application version not found');row=await Submission.findOne({_id:revision,leadId:id}).select('+encryptedData');if(!row)throw error(404,'Application version not found');}
 else row=await Submission.findOne({leadId:id}).sort({leadVersion:-1}).select('+encryptedData');
 const approval=row?await require('../models/KycApproval').findOne({submissionId:row._id,leadId:id}).select('+signedPdfEncrypted'):null;
 const data=kyc.decode(row?row.encryptedData:lead.kycEncrypted);
 return {lead,data,approval,employeeVerificationId:row?.employeeVerificationId,documentIds:row?row.documentIds:lead.documentIds,submittedAt:submittedDate(row,lead),version:row?row.leadVersion:lead.__v,label:row?(row.source==='SUBMITTED'?'Submitted application':'Preserved legacy snapshot'):'Current saved form - original submission snapshot unavailable',revisionId:row?String(row._id):null};
}
module.exports={capture,list,resolve};
