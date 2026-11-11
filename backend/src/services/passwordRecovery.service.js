const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Employee = require('../models/Employee');
const { hashPassword, comparePassword } = require('../utils/password');
const { createAuditLog } = require('../utils/auditLogger');
const {render,publicActionUrl}=require('./emailTemplate.service');

function emailConfiguration() {
  const rawFrontendUrl = String(process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/^["']|["']$/g, '');

  try {
    const url = new URL(rawFrontendUrl);
    if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) return null;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return null;

    const brevoKey = String(process.env.BREVO_API_KEY || '').trim();
    const resendKey = String(process.env.RESEND_API_KEY || '').trim();
    const senderEmail = String(process.env.BREVO_SENDER_EMAIL || process.env.GMAIL_USER || 'vtechsoft9838@gmail.com').trim();

    if (brevoKey) {
      return {
        origin: url.origin,
        from: `Royal Enterprises <${senderEmail}>`,
        isBrevo: true,
        user: senderEmail
      };
    }

    if (resendKey) {
      return {
        origin: url.origin,
        from: process.env.RESEND_FROM || `Royal Enterprises <onboarding@resend.dev>`,
        isResend: true,
        user: senderEmail
      };
    }

    const user = String(process.env.GMAIL_USER || '').trim().replace(/^["']|["']$/g, '');
    const rawPass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASS;
    if (!user || !rawPass) return null;

    const pass = String(rawPass).trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
    if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(user) || !/^[a-zA-Z]{16}$/.test(pass)) return null;

    return {
      origin: url.origin,
      from: `Royal Enterprises <${user}>`,
      isGmail: true,
      user,
      transport: {
        service: 'gmail',
        requireTLS: true,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
      }
    };
  } catch { return null; }
}

const digest = token => crypto.createHash('sha256').update(token).digest('hex');

async function requestReset(email, req) {
  const config = emailConfiguration();
  if (!config||!publicActionUrl(config.origin+'/employee/reset-password')) throw new Error('RECOVERY_NOT_CONFIGURED');
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = digest(token);
  const now = new Date();
  const expiresAt=new Date(now.getTime()+15*60000);
  const employee = await Employee.findOneAndUpdate({ email, status: 'ACTIVE', $or: [
    { 'passwordReset.requestedAt': { $exists: false } },
    { 'passwordReset.requestedAt': { $lte: new Date(now.getTime() - 60000) } }
  ] }, { $set: { passwordReset: { tokenHash, requestedAt: now, expiresAt } } }, { returnDocument: 'after' });
  if (!employee) return;
  const resetUrl = `${config.origin}/employee/reset-password#token=${token}`;
  const content = {title:'Reset Your Employee Password',recipientName:employee.name,category:'SECURITY',message:'A password reset was requested for your Royal Enterprises Employee Portal account. Open the one-time link below to choose a new password.',url:resetUrl,actionLabel:'Reset password',rows:[['Link expires at',require('./emailTemplate.service').dateLabel(expiresAt)]],guidance:'If you did not request this, ignore this email. Your password has not changed. Never share this one-time link.'};
  try {
    const emailService = require('./email.service');
    await emailService.send(employee.email, content, `reset-${employee._id}-${now.getTime()}`);
    await createAuditLog(req, { action: 'EMPLOYEE_PASSWORD_RESET_EMAIL_SENT', module: 'AUTH', referenceId: employee._id });
  } catch (err) {
    await Employee.updateOne({ _id: employee._id, 'passwordReset.tokenHash': tokenHash }, { $unset: { 'passwordReset.tokenHash': '', 'passwordReset.expiresAt': '' } });
    throw new Error('RESET_EMAIL_DELIVERY_FAILED');
  }
}

async function completeReset(token, password, req) {
  const tokenHash = digest(token);
  const now = new Date();

  // 1. Check if token is an employee email change verification token
  const verificationEmployee = await Employee.findOne({
    status: 'ACTIVE',
    'emailVerification.tokenHash': tokenHash,
    'emailVerification.expiresAt': { $gt: now }
  }).select('+emailVerification +password +authVersion');

  if (verificationEmployee) {
    if (await comparePassword(password, verificationEmployee.password)) {
      const error = new Error('Choose a password different from your current password');
      error.status = 400;
      throw error;
    }
    const newPendingEmail = verificationEmployee.emailVerification?.pendingEmail || verificationEmployee.pendingEmail;
    if (!newPendingEmail) {
      return false;
    }

    const passwordHash = await hashPassword(password);
    const updated = await Employee.findOneAndUpdate(
      {
        _id: verificationEmployee._id,
        'emailVerification.tokenHash': tokenHash,
        'emailVerification.expiresAt': { $gt: now },
        password: verificationEmployee.password
      },
      {
        $set: {
          email: newPendingEmail,
          password: passwordHash
        },
        $inc: { authVersion: 1 },
        $unset: {
          emailVerification: '',
          pendingEmail: '',
          passwordReset: ''
        }
      },
      { returnDocument: 'after' }
    );

    if (!updated) return false;

    try {
      const emailDigest = require('./email.service').digest(newPendingEmail.toLowerCase());
      await require('../models/AccountSettings').updateOne(
        { userId: verificationEmployee._id, role: 'EMPLOYEE' },
        { $set: { emailVerifiedHash: emailDigest, emailVerifiedAt: new Date() } },
        { upsert: true }
      );
    } catch (err) {
      console.error('Email change succeeded; AccountSettings could not be saved:', err.message);
    }

    await createAuditLog(req, {
      action: 'EMPLOYEE_EMAIL_CHANGE_COMPLETED',
      module: 'AUTH',
      referenceId: verificationEmployee._id,
      newValue: { email: newPendingEmail }
    });

    try {
      const config = emailConfiguration();
      if (config) {
        const loginUrl = `${config.origin}/employee/login`;
        const content = {
          title: 'Account Credentials Updated',
          recipientName: verificationEmployee.name,
          category: 'SECURITY',
          message: 'Your Royal Enterprises employee email and password have been successfully updated. You can now log in using your new credentials.',
          url: loginUrl,
          actionLabel: 'Sign in to Employee Portal',
          guidance: 'If you did not perform this change, please contact your administrator immediately.'
        };
        await require('./email.service').send(newPendingEmail, content, `confirm-${verificationEmployee._id}-${Date.now()}`);
      }
    } catch (emailErr) {
      console.error('Confirmation email after email change failed to send:', emailErr.message);
    }

    return true;
  }

  // 2. Standard password reset token logic
  const filter = { status: 'ACTIVE', 'passwordReset.tokenHash': tokenHash, 'passwordReset.expiresAt': { $gt: now } };
  const employee = await Employee.findOne(filter);
  if (!employee) return false;
  if (await comparePassword(password, employee.password)) {
    const error = new Error('Choose a password different from your current password'); error.status = 400; throw error;
  }
  const passwordHash = await hashPassword(password);
  // Password change and token consumption happen in one atomic document update.
  const result = await Employee.findOneAndUpdate({ ...filter, 'passwordReset.expiresAt': { $gt: now }, _id: employee._id, password: employee.password }, {
    $set: { password: passwordHash }, $inc: { authVersion: 1 }, $unset: { passwordReset: '' }
  }, { returnDocument: 'after' });
  if (!result) return false;
  // Consuming the emailed one-time link proves ownership of this registered mailbox.
  // Delivery infrastructure must not turn an already successful reset into an error.
  try {
    await require('../models/AccountSettings').updateOne({userId:employee._id,role:'EMPLOYEE'},{$set:{
      emailVerifiedHash:require('./email.service').digest(employee.email.toLowerCase()),emailVerifiedAt:new Date()
    }},{upsert:true});
  } catch { console.error('Reset succeeded; email verification status could not be saved'); }
  await createAuditLog(req, { action: 'EMPLOYEE_PASSWORD_RESET_COMPLETED', module: 'AUTH', referenceId: employee._id });
  return true;
}

module.exports = { emailConfiguration, requestReset, completeReset };
