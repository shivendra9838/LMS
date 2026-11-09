// Default is a local schema/index preview. --apply adds indexes; it never rewrites or deletes transactions.
const mongoose=require('mongoose');
const models=['Collection','CashBook','AuditLog','PaymentAccount','CollectionPosition','EmployeeSettlement','FinanceEvidence','FinanceReference','FinanceSequence'].map(name=>require(`../src/models/${name}`));
async function main(){
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({mode:'preview',transactionRequired:true,models:models.map(model=>({name:model.modelName,indexes:model.schema.indexes().map(([keys,options])=>({keys,unique:Boolean(options.unique),partial:options.partialFilterExpression}))}))},null,2));return;}
 require('dotenv').config({quiet:true});
 if(!process.env.MONGODB_URI)throw new Error('MONGODB_URI is not configured');
 if(!/^[a-f\d]{64}$/i.test(process.env.KYC_ENCRYPTION_KEY||''))throw new Error('Persistent encryption key is not configured');
 await mongoose.connect(process.env.MONGODB_URI);
 const hello=await mongoose.connection.db.admin().command({hello:1});if(!hello.setName&&hello.msg!=='isdbgrid')throw new Error('A replica set or sharded MongoDB deployment is required');
 await require('../src/services/settlement.service').ensureIndexes();
 console.log('Additive settlement indexes ready. No financial records were migrated.');
}
main().catch(err=>{console.error(err.message);process.exitCode=1;}).finally(()=>mongoose.disconnect());
