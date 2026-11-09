// Default is read-only. Apply/reverse requires an explicit reviewed plan and active Admin ID.
const path=require('path'),fs=require('fs');
require('dotenv').config({path:path.resolve(__dirname,'../.env'),quiet:true});
const mongoose=require('mongoose');mongoose.set('autoIndex',false);
const service=require('../src/services/scheduleRepair.service');
const Loan=require('../src/models/Loan');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
(async()=>{try{
 await mongoose.connect(process.env.MONGODB_URI);
 const user={role:'ADMIN',id:arg('--admin-id')};
 let result;
 if(arg('--apply')){if(!user.id)throw new Error('Active Admin ID is required');result=await service.applyPlan(JSON.parse(fs.readFileSync(arg('--apply'),'utf8')),user);}
 else if(arg('--rollback')){if(!user.id)throw new Error('Active Admin ID is required');result=await service.rollback(arg('--rollback'),user);}
 else {const loan=await Loan.findOne({loanNumber:arg('--loan')||'LN000003'}).lean();if(!loan)throw new Error('Loan not found');result=service.planFor(await service.snapshot(loan._id));if(arg('--out'))fs.writeFileSync(arg('--out'),JSON.stringify(result,null,2));console.log(JSON.stringify({dryRun:true,loanNumber:result.loanNumber,action:result.action,difference:result.difference,planWritten:!!arg('--out')}));return;}
 console.log(JSON.stringify(result));
}finally{await mongoose.disconnect();}})().catch(error=>{console.error(error.message);process.exitCode=1;});
