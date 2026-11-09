// Explicitly invoked, single-message test. Never imports MongoDB or creates financial records.
require('dotenv').config({path:require('path').resolve(__dirname,'../.env'),quiet:true});
const {emailConfiguration}=require('../src/services/passwordRecovery.service');
async function main(){
 const config=emailConfiguration();
 const status={configured:Boolean(config),gmail:process.env.SMTP_HOST==='smtp.gmail.com',accepted:false};
 if(!config){console.log(JSON.stringify({...status,result:'NOT_VERIFIED',reason:'Required SMTP fields or trusted frontend origin are missing/invalid'}));process.exitCode=2;return;}
 if(!process.argv.includes('--send')){console.log(JSON.stringify({...status,result:'CONFIGURATION_ONLY',reason:'Use --send for one controlled message to the configured sender mailbox'}));return;}
 const parsed=require('nodemailer/lib/addressparser')(config.from),destination=parsed.length===1?parsed[0].address:null;
 if(!destination||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination))throw new Error('INVALID_SENDER');
 await require('../src/services/email.service').send(destination,{title:'Royal Enterprises — controlled email delivery test',message:'This is one authorized email-system test sent to the configured sender mailbox. It contains no customer, financial, password or OTP data. No records or account settings were changed.'},'controlled-test:'+require('crypto').randomUUID());
 console.log(JSON.stringify({...status,accepted:true,result:'SMTP_ACCEPTED',inboxReceipt:'NOT_VERIFIED'}));
}
main().catch(()=>{console.log(JSON.stringify({result:'NOT_VERIFIED',reason:'SMTP test failed; inspect configuration locally. No secrets logged.'}));process.exitCode=1;});
