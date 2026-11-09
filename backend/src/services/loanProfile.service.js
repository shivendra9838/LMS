const kyc=require('./kyc.service');
const {getLoanByIdService}=require('./loan.service');
const {getCustomerByIdService}=require('./customer.service');
const mask=value=>value?String(value).length>4?'•••• '+String(value).slice(-4):'••••':null;
// Loan and current customer ownership are checked independently; no draft is merged into approved data.
async function profile(loanId,user){
 const loan=await getLoanByIdService(loanId,user);
 const customer=await getCustomerByIdService(loan.customerId._id,user);
 let lead,data=customer.toObject(),documents=[],source='CUSTOMER_RECORD';
 if(customer.kycLeadId){
  lead=await kyc.access(customer.kycLeadId,user);
  if(lead.approvedAt&&lead.approvedKycEncrypted){data=kyc.decode(lead.approvedKycEncrypted);source='APPROVED_SNAPSHOT';}
  const ids=source==='APPROVED_SNAPSHOT'?lead.approvedDocumentIds:lead.documentIds;
  documents=await require('../models/KycDocument').find({_id:{$in:ids},leadId:lead._id}).select('_id kind mime size createdAt').lean();
 }
 const fields=require('../config/kycFields.json').flatMap(section=>section.fields.map(field=>field[0]));
 const safe=Object.fromEntries(fields.map(key=>[key,data[key]??null]));
 for(const field of ['accountNumber','idProofNumber','addressProofNumber'])safe[field]=mask(safe[field]);
 return {loanId:loan._id,loanNumber:loan.loanNumber,customer:{...safe,_id:customer._id,customerCode:customer.customerCode,status:customer.status,age:customer.age},source,
  kyc:lead?{_id:lead._id,status:lead.status,approvedAt:lead.approvedAt||null,hasApprovedSnapshot:source==='APPROVED_SNAPSHOT',documentVersion:source==='APPROVED_SNAPSHOT'?'Approved snapshot':'Unapproved saved KYC',documents}:null};
}
module.exports={profile};
