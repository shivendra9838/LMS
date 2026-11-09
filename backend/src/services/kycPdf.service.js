const applicationPdf=require('./kycApplicationPdf.service');
// Preserve the existing approved/current selection and use one private renderer.
async function generate(lead,data,approved=false){
 return applicationPdf.generate({lead,data,documentIds:approved?lead.approvedDocumentIds:lead.documentIds,version:approved?undefined:lead.__v,label:approved?'Approved KYC snapshot':'Current saved form (not a submitted snapshot)',submittedAt:undefined});
}
module.exports={generate};
