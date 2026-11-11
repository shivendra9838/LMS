const Employee = require('../models/Employee');
const Admin = require('../models/Admin');
const { findByEmailOrPhone, createEmployee, getEmployees, getEmployeeById, updateEmployeeById, updateEmployeeStatusById, resetEmployeePasswordById, getEmployeeStats } = require('../repositories/employee.repository');
const { generateEmployeeCode } = require('../utils/generateCode');
const { getBranchByIdService, ensureBranchArea } = require('./branch.service');

const createEmployeeService = async (employeeData, createdBy) => {
  const existingUser = await findByEmailOrPhone(employeeData.email, employeeData.phone);
  if (existingUser) {
    if (existingUser.email === employeeData.email) {
      const error = new Error('Email already exists');
      error.status = 400;
      throw error;
    }
    if (existingUser.phone === employeeData.phone) {
      const error = new Error('Phone already exists');
      error.status = 400;
      throw error;
    }
  }

  const employeeCode = await generateEmployeeCode();
  const password = Math.random().toString(36).slice(-8) + 'A1!'; // Basic complexity logic
  let branch;

  if (employeeData.branchId) {
    branch = await getBranchByIdService(employeeData.branchId);
    ensureBranchArea(branch, employeeData.area);
  }

  const newEmployee = {
    ...employeeData,
    city: employeeData.city || branch?.name,
    employeeCode,
    password,
    createdBy
  };

  const employee = (await createEmployee(newEmployee)).toObject();
  delete employee.password;
  delete employee.__v;

  return {
    employee,
    temporaryPassword: password
  };
};

const getEmployeeListService = async (query) => {
  return await getEmployees(query);
};

const getEmployeeByIdService = async (id) => {
  const employee = await getEmployeeById(id);
  if (!employee) {
    const error = new Error('Employee Not Found');
    error.status = 404;
    throw error;
  }
  const obj = employee.toObject ? employee.toObject() : employee;
  if (obj.emailVerification) {
    delete obj.emailVerification.tokenHash;
  }
  return obj;
};

const updateEmployeeService = async (id, updateData, adminId, req) => {
  const employee = await Employee.findById(id).select('+emailVerification');
  if (!employee) {
    const error = new Error('Employee Not Found');
    error.status = 404;
    throw error;
  }
  
  if (updateData.phone && updateData.phone !== employee.phone) {
    const existing = await findByEmailOrPhone(null, updateData.phone);
    if (existing && existing._id.toString() !== id.toString()) {
      const error = new Error('Phone already exists');
      error.status = 400;
      throw error;
    }
  }

  let emailChangeInitiated = false;
  let newPendingEmail = employee.pendingEmail;
  let newEmailVerification = employee.emailVerification;

  if (updateData.email) {
    const requestedEmail = String(updateData.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedEmail)) {
      const error = new Error('Invalid email format');
      error.status = 400;
      throw error;
    }

    if (requestedEmail !== employee.email) {
      const Admin = require('../models/Admin');
      const existingAdmin = await Admin.findOne({ email: requestedEmail });
      if (existingAdmin) {
        const error = new Error('Email already exists');
        error.status = 400;
        throw error;
      }
      const existingEmployee = await Employee.findOne({ email: requestedEmail, _id: { $ne: id } });
      if (existingEmployee) {
        const error = new Error('Email already exists');
        error.status = 400;
        throw error;
      }
      const existingPending = await Employee.findOne({ pendingEmail: requestedEmail, _id: { $ne: id } });
      if (existingPending) {
        const error = new Error('Email is already pending verification for another account');
        error.status = 400;
        throw error;
      }

      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      newPendingEmail = requestedEmail;
      newEmailVerification = {
        pendingEmail: requestedEmail,
        tokenHash,
        expiresAt,
        requestedAt: now,
        requestedBy: (adminId && require('mongoose').isValidObjectId(adminId)) ? adminId : undefined
      };
      emailChangeInitiated = true;

      const { emailConfiguration } = require('./passwordRecovery.service');
      const emailConfig = emailConfiguration();
      const frontendUrl = String(process.env.FRONTEND_URL || emailConfig?.origin || 'http://localhost:5173').replace(/\/$/, '');
      const setupUrl = `${frontendUrl}/employee/setup-password#token=${token}`;
      console.log(`[Setup Link for ${requestedEmail}]: ${setupUrl}`);
      
      const emailService = require('./email.service');
      const templateService = require('./emailTemplate.service');

      const verificationContent = {
        title: 'Verify Your Email & Set Up Your Password',
        recipientName: updateData.name || employee.name,
        category: 'SECURITY',
        message: 'An administrator has updated your Royal Enterprises Employee account email address. To complete this change and secure your account, please open the link below to verify this email address and set your new password.',
        url: setupUrl,
        actionLabel: 'Set up new password',
        rows: [
          ['New Email Address', requestedEmail],
          ['Previous Email', employee.email],
          ['Link expires at', templateService.dateLabel(expiresAt)]
        ],
        guidance: 'If you did not authorize this change, contact your administrator immediately. This link can only be used once.'
      };

      const noticeContent = {
        title: 'Security Alert: Email Address Change Requested',
        recipientName: employee.name,
        category: 'SECURITY',
        message: `An administrator has initiated a request to change your Royal Enterprises account email from ${employee.email} to ${requestedEmail}. A verification link has been sent to the new address. Your current credentials remain active until the new email is verified and a new password is established.`,
        rows: [
          ['Current Registered Email', employee.email],
          ['Requested New Email', requestedEmail],
          ['Requested on', templateService.dateLabel(now)]
        ],
        guidance: 'If you did not expect this change, please contact your administrator immediately to secure your account.'
      };

      setImmediate(async () => {
        try {
          console.log(`[Email Change] Sending verification link to ${requestedEmail}...`);
          await emailService.send(requestedEmail, verificationContent, `verify-${id}-${now.getTime()}`);
          console.log(`[Email Change] Sending notice of change to previous email ${employee.email}...`);
          await emailService.send(employee.email, noticeContent, `notice-${id}-${now.getTime()}`);
        } catch (err) {
          console.error('[Email Change Delivery Error]:', err?.message || err);
        }
      });

      const { createAuditLog } = require('../utils/auditLogger');
      await createAuditLog(req, {
        action: 'EMPLOYEE_EMAIL_CHANGE_REQUESTED',
        module: 'ACCOUNT',
        referenceId: id,
        details: { oldEmail: employee.email, newEmail: requestedEmail }
      });
    }
  }
  
  let branch = null;
  const branchId = updateData.branchId !== undefined ? updateData.branchId : (employee.branchId?._id || employee.branchId);
  const area = updateData.area || employee.area;

  if (branchId) {
    branch = await getBranchByIdService(branchId);
    if (updateData.branchId || updateData.area) {
      ensureBranchArea(branch, area);
    }
  }

  const allowedUpdates = {
    name: updateData.name || employee.name,
    phone: updateData.phone || employee.phone,
    area,
    city: updateData.city || branch?.name || employee.city,
    status: updateData.status || employee.status
  };

  if (branchId) {
    allowedUpdates.branchId = branchId;
  }

  if (emailChangeInitiated) {
    allowedUpdates.pendingEmail = newPendingEmail;
    allowedUpdates.emailVerification = newEmailVerification;
  }

  if(allowedUpdates.status==='INACTIVE'&&employee.status!=='INACTIVE'){
    const dependencies=await require('./settings.service').dependencies(id);
    if(!dependencies.canDeactivate)throw Object.assign(new Error('Resolve active loans, custody and unresolved settlements before deactivation'),{status:409});
  }

  const updated = await Employee.findByIdAndUpdate(
    id,
    { $set: allowedUpdates, $inc: { authVersion: 1 } },
    { new: true, runValidators: true }
  ).select('-password -__v +emailVerification');

  const obj = updated.toObject ? updated.toObject() : updated;
  if (obj.emailVerification) {
    delete obj.emailVerification.tokenHash;
  }
  return {
    ...obj,
    emailChangePending: emailChangeInitiated
  };
};

const resendEmployeeEmailVerification = async (id, adminId, req) => {
  const employee = await Employee.findById(id).select('+emailVerification');
  if (!employee) {
    const error = new Error('Employee Not Found');
    error.status = 404;
    throw error;
  }
  if (!employee.emailVerification?.pendingEmail && !employee.pendingEmail) {
    const error = new Error('No pending email verification for this employee');
    error.status = 400;
    throw error;
  }

  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const pendingEmail = employee.emailVerification?.pendingEmail || employee.pendingEmail;

  employee.emailVerification = {
    pendingEmail,
    tokenHash,
    expiresAt,
    requestedAt: now,
    requestedBy: (adminId && require('mongoose').isValidObjectId(adminId)) ? adminId : undefined
  };
  await employee.save();

  const { emailConfiguration } = require('./passwordRecovery.service');
  const emailConfig = emailConfiguration();
  const frontendUrl = String(process.env.FRONTEND_URL || emailConfig?.origin || 'http://localhost:5173').replace(/\/$/, '');
  const setupUrl = `${frontendUrl}/employee/setup-password#token=${token}`;
  console.log(`[Setup Link for ${pendingEmail}]: ${setupUrl}`);
  
  const emailService = require('./email.service');
  const templateService = require('./emailTemplate.service');

  const verificationContent = {
    title: 'Verify Your Email & Set Up Your Password',
    recipientName: employee.name,
    category: 'SECURITY',
    message: 'An administrator has resent your verification link for your updated Royal Enterprises account email. Please open the link below to verify this email address and set your new password.',
    url: setupUrl,
    actionLabel: 'Set up new password',
    rows: [
      ['New Email Address', pendingEmail],
      ['Current Registered Email', employee.email],
      ['Link expires at', templateService.dateLabel(expiresAt)]
    ],
    guidance: 'If you did not authorize this change, contact your administrator immediately. This link can only be used once.'
  };

  setImmediate(async () => {
    try {
      console.log(`[Resend Verification] Resending verification link to ${pendingEmail}...`);
      await emailService.send(pendingEmail, verificationContent, `resend-${id}-${now.getTime()}`);
    } catch (err) {
      console.error('[Resend Verification Email Error]:', err?.message || err);
    }
  });

  const { createAuditLog } = require('../utils/auditLogger');
  await createAuditLog(req, {
    action: 'EMPLOYEE_EMAIL_CHANGE_RESENT',
    module: 'ACCOUNT',
    referenceId: id,
    details: { pendingEmail }
  });

  return {
    success: true,
    message: `Verification email resent to ${pendingEmail}`,
    setupUrl
  };
};

const cancelEmployeeEmailVerification = async (id, adminId, req) => {
  const employee = await Employee.findById(id).select('+emailVerification');
  if (!employee) {
    const error = new Error('Employee Not Found');
    error.status = 404;
    throw error;
  }
  if (!employee.emailVerification?.pendingEmail && !employee.pendingEmail) {
    const error = new Error('No pending email verification to cancel');
    error.status = 400;
    throw error;
  }

  const cancelledEmail = employee.emailVerification?.pendingEmail || employee.pendingEmail;
  employee.pendingEmail = undefined;
  employee.emailVerification = undefined;
  await employee.save();

  const { createAuditLog } = require('../utils/auditLogger');
  await createAuditLog(req, {
    action: 'EMPLOYEE_EMAIL_CHANGE_CANCELLED',
    module: 'ACCOUNT',
    referenceId: id,
    details: { cancelledEmail }
  });

  return { success: true, message: 'Pending email change cancelled successfully' };
};

const updateEmployeeStatusService = async (id, status) => {
  const employee = await getEmployeeById(id);
  if (!employee) {
    const error = new Error('Employee Not Found');
    error.status = 404;
    throw error;
  }
  
  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    const error = new Error('Invalid status');
    error.status = 400;
    throw error;
  }
  if(status==='INACTIVE'){
    const dependencies=await require('./settings.service').dependencies(id);
    if(!dependencies.canDeactivate)throw Object.assign(new Error('Resolve active loans, custody and unresolved settlements before deactivation'),{status:409});
  }

  return await updateEmployeeStatusById(id, status);
};

const resetEmployeePasswordService = async (id) => {
  const password = Math.random().toString(36).slice(-8) + 'A1!';
  const employee = await resetEmployeePasswordById(id, password);

  if (!employee) {
    const error = new Error('Employee Not Found');
    error.status = 404;
    throw error;
  }

  delete employee.password;
  delete employee.__v;

  return {
    employee,
    temporaryPassword: password
  };
};

const getEmployeeStatsService = async () => {
  return await getEmployeeStats();
};

module.exports = { 
  createEmployeeService, 
  getEmployeeListService, 
  getEmployeeByIdService,
  updateEmployeeService,
  updateEmployeeStatusService,
  resetEmployeePasswordService,
  getEmployeeStatsService,
  resendEmployeeEmailVerification,
  cancelEmployeeEmailVerification
};
