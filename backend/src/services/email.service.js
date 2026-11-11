const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Settings = require('../models/AccountSettings');
const Challenge = require('../models/EmailChallenge');
const {emailConfiguration} = require('./passwordRecovery.service');
const {render} = require('./emailTemplate.service');
const defaults = {daily:true,overdue:true,kycLoan:true,paymentSettlement:true};
const accountModel = role => require('../models/'+(role==='ADMIN'?'Admin':'Employee'));
const active = role => role==='ADMIN'?{isActive:true}:{status:'ACTIVE'};
const fail = message => Object.assign(new Error(message),{status:422});
function digest(value) {
  if (!process.env.JWT_SECRET) throw new Error('Email security configuration unavailable');
  return crypto.createHmac('sha256',process.env.JWT_SECRET).update('royal-email-v1:'+value).digest('hex');
}
async function sendViaBrevo(to, content, apiKey, senderEmail, senderName = 'Royal Enterprises') {
  const rendered = render(content);
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey.trim(),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject: content.title.replace(/[\r\n]/g, ' '),
      htmlContent: rendered.html,
      textContent: rendered.text
    })
  });
  if (!response.ok) {
    const errorData = await response.text();
    console.error(`[Brevo API Error] Status ${response.status}: ${errorData}`);
    throw new Error(`Brevo API delivery failed (${response.status}): ${errorData}`);
  }
  return true;
}

async function sendViaResend(to, content, apiKey, fromAddress = 'Royal Enterprises <onboarding@resend.dev>') {
  const rendered = render(content);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [to],
      subject: content.title.replace(/[\r\n]/g, ' '),
      html: rendered.html,
      text: rendered.text
    })
  });
  if (!response.ok) {
    const errorData = await response.text();
    console.error(`[Resend API Error] Status ${response.status}: ${errorData}`);
    throw new Error(`Resend API delivery failed (${response.status}): ${errorData}`);
  }
  return true;
}

async function send(to, content, key) {
  const config = emailConfiguration();
  const brevoKey = (process.env.BREVO_API_KEY || '').trim();
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.GMAIL_USER || config?.user || 'vtechsoft9838@gmail.com').trim();

  if (brevoKey) {
    console.log(`[Email Delivery] Sending "${content.title}" to ${to} via Brevo API (HTTPS)...`);
    const sent = await sendViaBrevo(to, content, brevoKey, senderEmail);
    console.log(`[Email Delivery] Successfully sent "${content.title}" to ${to} via Brevo API`);
    return sent;
  }
  if (resendKey) {
    console.log(`[Email Delivery] Sending "${content.title}" to ${to} via Resend API (HTTPS)...`);
    const sent = await sendViaResend(to, content, resendKey, process.env.RESEND_FROM || 'Royal Enterprises <onboarding@resend.dev>');
    console.log(`[Email Delivery] Successfully sent "${content.title}" to ${to} via Resend API`);
    return sent;
  }

  if (!config || !config.transport) {
    console.error('[Email Delivery Error] No email provider configured. Please configure BREVO_API_KEY or GMAIL_USER + GMAIL_APP_PASSWORD.');
    throw new Error('EMAIL_NOT_CONFIGURED');
  }

  console.log(`[Email Delivery] Sending "${content.title}" to ${to} via Gmail SMTP...`);
  const transport = nodemailer.createTransport(config.transport);
  try {
    const result = await transport.sendMail({
      from: config.from,
      to,
      subject: content.title.replace(/[\r\n]/g, ' '),
      messageId: `<${crypto.createHash('sha256').update(key).digest('hex')}@royal-enterprises.local>`,
      ...render(content)
    });
    if (!result.accepted?.length) throw Object.assign(new Error('Email not accepted'), { code: 'EENVELOPE' });
    console.log(`[Email Delivery] Successfully sent "${content.title}" to ${to} via Gmail SMTP`);
    return true;
  } catch (err) {
    console.error(`[Email Delivery Error] Failed to send to ${to} via Gmail:`, err?.message || err);
    if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
      console.error('[OTP Diagnostic] Connection timeout connecting to smtp.gmail.com:465.');
      console.error('[OTP Diagnostic] On Render Free Tier, outbound ports 25, 465, and 587 are blocked. Upgrade Render to a paid instance or set BREVO_API_KEY to send over HTTPS port 443.');
    }
    throw err;
  } finally {
    transport.close();
  }
}
async function preferences(user,body) {
  await require('./settlement.service').authorize(user);
  if(body!==undefined){
    if(!body||Array.isArray(body)||Object.entries(body).some(([k,v])=>!Object.hasOwn(defaults,k)||typeof v!=='boolean'))throw fail('Choose valid email preferences');
    await Settings.updateOne({userId:user.id,role:user.role},{$set:Object.fromEntries(Object.entries(body).map(([k,v])=>['emailPreferences.'+k,v]))},{upsert:true});
  }
  const [settings,account]=await Promise.all([Settings.findOne({userId:user.id,role:user.role}).select('+emailVerifiedHash').lean(),accountModel(user.role).findById(user.id).lean()]);
  return {preferences:{...defaults,...settings?.emailPreferences},verified:Boolean(settings?.emailVerifiedAt&&settings.emailVerifiedHash===digest(account.email.toLowerCase())),configured:Boolean(emailConfiguration())};
}
async function requestCode(email,role,purpose='RESET',user,requestId) {
  if(!['ADMIN','EMPLOYEE'].includes(role)||!['RESET','VERIFY'].includes(purpose))throw fail('Invalid request');
  if(!emailConfiguration())throw Object.assign(new Error('Email is not configured. Contact Admin.'),{status:503});
  if(purpose==='VERIFY')await require('./settlement.service').authorize(user);
  let effectiveRole = role;
  let account=await accountModel(role).findOne({...active(role),...(purpose==='VERIFY'?{_id:user.id}:{email:String(email).trim().toLowerCase()})}).lean();
  if(!account && purpose==='RESET') {
    const altRole = role === 'ADMIN' ? 'EMPLOYEE' : 'ADMIN';
    const altAccount = await accountModel(altRole).findOne({...active(altRole), email: String(email).trim().toLowerCase()}).lean();
    if (altAccount) {
      account = altAccount;
      effectiveRole = altRole;
    }
  }
  const fake=requestId||crypto.randomBytes(24).toString('hex');
  if(!account){
    console.warn(`[OTP] Account lookup failed: no active account found in database matching "${email}"`);
    return fake;
  }
  const now=new Date(), code=String(crypto.randomInt(100000,1000000));
  await Challenge.init();
  // A unique account/purpose slot enforces cooldown across processes and restarts.
  let row;
  const existing=await Challenge.findOne({accountId:account._id,role:effectiveRole,purpose});
  if(existing){
    if(+existing.requestedAt>+now-60000)return fake;
    row=await Challenge.findOneAndUpdate({_id:existing.id,requestedAt:existing.requestedAt},{$set:{requestId:fake,emailHash:digest(account.email.toLowerCase()),codeHash:digest(fake+':'+code),attempts:0,expiresAt:new Date(+now+10*60000),requestedAt:now},$unset:{consumedAt:1}},{returnDocument:'after'});
  }else{
    try{row=await Challenge.create({_id:fake,requestId:fake,accountId:account._id,role:effectiveRole,purpose,emailHash:digest(account.email.toLowerCase()),codeHash:digest(fake+':'+code),expiresAt:new Date(+now+10*60000),requestedAt:now});}
    catch(error){if(error.code===11000)return fake;throw error;}
  }
  if(!row)return fake;
  // OTP exists only in memory and this message; persistence contains a keyed hash only.
  try{
    console.log(`[OTP] Sending OTP code to ${account.email} (${effectiveRole})...`);
    await send(account.email,{title:purpose==='RESET'?'Password Reset OTP':'Verify Your Account Email',recipientName:account.name,category:'SECURITY',message:purpose==='RESET'?'We received a request to reset your Royal Enterprises account password. Use the verification code below to continue.':'Please verify your registered Royal Enterprises account email using the code below.',otp:{code,expiresAt:row.expiresAt}},'challenge:'+row.id+':'+now.getTime());
    console.log(`[OTP] OTP email successfully sent to ${account.email}`);
  }catch(sendError){
    console.error(`[OTP Error] Failed to send email to ${account.email}:`, sendError?.message || sendError);
    await Challenge.updateOne({_id:row.id,requestedAt:now},{$set:{expiresAt:new Date(0)}});
    throw Object.assign(new Error('Email could not be sent. Please try again later.'),{status:503});
  }
  return fake;
}
async function confirmCode(body,user,expectedRole) {
  if(!body||typeof body.challenge!=='string'||!/^[a-f0-9]{48}$/.test(body.challenge)||typeof body.code!=='string'||!/^\d{6}$/.test(body.code))throw fail('Invalid or expired code');
  const row=await Challenge.findOneAndUpdate({requestId:body.challenge,...(expectedRole?{role:expectedRole}:{}),consumedAt:{$exists:false},expiresAt:{$gt:new Date()},attempts:{$lt:5}},{$inc:{attempts:1}},{returnDocument:'after'}).select('+codeHash');
  if(!row||typeof row.codeHash!=='string'||row.codeHash.length!==64||!crypto.timingSafeEqual(Buffer.from(row.codeHash),Buffer.from(digest(row.requestId+':'+body.code))))throw fail('Invalid or expired code');
  const account=await accountModel(row.role).findOne({_id:row.accountId,...active(row.role)}).lean();
  if(!account||digest(account.email.toLowerCase())!==row.emailHash)throw fail('Invalid or expired code');
  let password;
  if(row.purpose==='VERIFY'){
    if(!user||user.role!==row.role||String(user.id)!==String(row.accountId))throw fail('Invalid or expired code');
    await require('./settlement.service').authorize(user);
  }else{
    const value=body.password;
    if(typeof value!=='string'||value.length<12||value.length>64||Buffer.byteLength(value)>72||!/[a-z]/.test(value)||!/[A-Z]/.test(value)||!/[0-9]/.test(value)||!/[\W_]/.test(value)||value!==body.confirmPassword)throw fail('Use matching 12–64 character passwords with uppercase, lowercase, number and symbol');
    const utils=require('../utils/password');if(await utils.comparePassword(value,account.password))throw fail('Choose a different password');password=await utils.hashPassword(value);
  }
  await Settings.init();
  await require('./settlement.service').transaction(async session=>{
    const consumed=await Challenge.updateOne({_id:row.id,requestId:body.challenge,codeHash:row.codeHash,attempts:row.attempts,consumedAt:{$exists:false},expiresAt:{$gt:new Date()}},{$set:{consumedAt:new Date()},$unset:{codeHash:1}},{session});if(!consumed.modifiedCount)throw fail('Invalid or expired code');
    if(password){const changed=await accountModel(row.role).updateOne({_id:account._id,email:account.email,password:account.password,...active(row.role)},{$set:{password},$inc:{authVersion:1},...(row.role==='EMPLOYEE'?{$unset:{passwordReset:1}}:{})},{session});if(!changed.modifiedCount)throw fail('Account changed; request a new code');}
    await Settings.updateOne({userId:row.accountId,role:row.role},{$set:{emailVerifiedHash:row.emailHash,emailVerifiedAt:new Date()}},{upsert:true,session});
    await require('../models/AuditLog').create([{userId:row.accountId,userModel:row.role==='ADMIN'?'Admin':'Employee',userRole:row.role,action:password?'PASSWORD_RESET_COMPLETED':'EMAIL_VERIFIED',module:'AUTH',referenceId:String(row.accountId)}],{session});
  });
  return {saved:true,signInRequired:Boolean(password)};
}
module.exports={send,digest,preferences,requestCode,confirmCode,defaults,accountModel,active,sendViaBrevo,sendViaResend};
