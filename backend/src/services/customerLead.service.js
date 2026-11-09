async function logEvent(lead,action,userId,userRole){await require('../models/AuditLog').create({userId,userRole,userModel:userRole==='ADMIN'?'Admin':'Employee',action,module:'CUSTOMER_REQUEST',referenceId:String(lead._id)});}
const { findByMobile } = require('../repositories/customer.repository');
const {
  createCustomerLead,
  findCustomerLeadById,
  findPendingLeadByMobile,
  getCustomerLeads,
  updateCustomerLeadById
} = require('../repositories/customerLead.repository');
const { createCustomerService } = require('./customer.service');

const submitCustomerLeadService = async (leadData, employeeId) => {
  const existingCustomer = await findByMobile(leadData.mobile);
  if (existingCustomer) {
    const error = new Error('A customer with this mobile number already exists');
    error.status = 400;
    throw error;
  }

  const pendingLead = await findPendingLeadByMobile(leadData.mobile);
  if (pendingLead) {
    const error = new Error('This customer is already submitted and pending admin review');
    error.status = 400;
    throw error;
  }

  const created = await createCustomerLead({
    ...Object.fromEntries(['name','fatherName','mobile','alternateMobile','age','gender','occupation','address','city','area','landmark','idProofType','idProofNumber','employeeNotes'].filter(key => leadData[key] !== undefined).map(key => [key, leadData[key]])),
    submittedByEmployeeId: employeeId,
    status: 'PENDING'
  });
  await logEvent(created,'CUSTOMER_REQUEST_SUBMITTED',employeeId,'EMPLOYEE');
  return created;
};

const getCustomerLeadListService = async (query, user) => {
  const account = user.role === 'EMPLOYEE'
    ? await require('../models/Employee').findById(user.id)
    : await require('../models/Admin').findById(user.id);
  if (!account || (user.role === 'EMPLOYEE' ? account.status !== 'ACTIVE' : !account.isActive)) {
    throw Object.assign(new Error('Account is inactive'), { status: 403 });
  }
  if(query.requestDirectory==='true')return require('./customerRequestDirectory.service').list(query,user);
  if(query.listing==='true')return require('./kycDirectory.service').list(query,user);
  const { page = 1, limit = 20, status = 'PENDING', search, kycOnly } = query;
  const filter = {};

  if (status) filter.status = status;
  if (kycOnly === 'true') filter.kycVersion = 1;
  if (search) {
    const literal = String(search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: new RegExp(literal, 'i') }, { mobile: new RegExp(literal, 'i') }];
  }
  if (user.role === 'ADMIN' && status === 'DRAFT') return { leads: [], total: 0, page: Number(page), totalPages: 0 };
  if (user.role === 'EMPLOYEE') {
    filter.$and = [{ $or: [{ customerId: { $exists: false }, submittedByEmployeeId: user.id }, { assignedEmployeeId: user.id }] }];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const { leads, total } = await getCustomerLeads(filter, skip, Number(limit));

  return {
    leads,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit))
  };
};

const getCustomerLeadByIdService = async (id, user) => {
  const lead = await findCustomerLeadById(id);
  if (!lead) {
    const error = new Error('Customer request not found');
    error.status = 404;
    throw error;
  }

  if (lead.kycVersion) return require('./kyc.service').get(id, user);

  const owner=lead.customerId?(await require('../models/Customer').findById(lead.customerId._id||lead.customerId).select('employeeId'))?.employeeId:lead.submittedByEmployeeId?._id;
  if (user.role === 'EMPLOYEE' && String(owner) !== user.id) {
    const error = new Error('Customer request not found');
    error.status = 404;
    throw error;
  }

  return lead;
};

const approveCustomerLeadService = async (id, adminId, payload) => {
  const lead = await findCustomerLeadById(id);
  if (!lead) {
    const error = new Error('Customer request not found');
    error.status = 404;
    throw error;
  }

  if (lead.kycVersion) return require('./kyc.service').review(id, payload, { id: adminId, role: 'ADMIN' }, 'APPROVED');

  if (lead.status !== 'PENDING') {
    const error = new Error('This request has already been processed');
    error.status = 400;
    throw error;
  }

  const employeeId = payload.employeeId;
  if (!employeeId) {
    const error = new Error('Please select an employee to allocate this customer');
    error.status = 400;
    throw error;
  }

  const customerPayload = {
    name: payload.name ?? lead.name,
    fatherName: payload.fatherName ?? lead.fatherName,
    mobile: payload.mobile ?? lead.mobile,
    alternateMobile: payload.alternateMobile ?? lead.alternateMobile,
    age: payload.age ?? lead.age,
    gender: payload.gender ?? lead.gender,
    occupation: payload.occupation ?? lead.occupation,
    address: payload.address ?? lead.address,
    city: payload.city ?? lead.city,
    area: payload.area ?? lead.area,
    landmark: payload.landmark ?? lead.landmark,
    idProofType: payload.idProofType ?? lead.idProofType,
    idProofNumber: payload.idProofNumber ?? lead.idProofNumber,
    employeeId
  };

  const customer = await createCustomerService(customerPayload, adminId, 'ADMIN');

  const updated = await updateCustomerLeadById(id, {
    status: 'APPROVED',
    customerId: customer._id,
    assignedEmployeeId: employeeId,
    reviewedBy: adminId,
    adminRemarks: payload.adminRemarks
  });
  await logEvent(updated,'CUSTOMER_REQUEST_APPROVED',adminId,'ADMIN');
  return updated;
};

const rejectCustomerLeadService = async (id, adminId, adminRemarks, version) => {
  const lead = await findCustomerLeadById(id);
  if (!lead) {
    const error = new Error('Customer request not found');
    error.status = 404;
    throw error;
  }

  if (lead.kycVersion) return require('./kyc.service').review(id, { adminRemarks, version }, { id: adminId, role: 'ADMIN' }, 'REJECTED');

  if (lead.status !== 'PENDING') {
    const error = new Error('This request has already been processed');
    error.status = 400;
    throw error;
  }

  const updated = await updateCustomerLeadById(id, {
    status: 'REJECTED',
    reviewedBy: adminId,
    adminRemarks
  });
  await logEvent(updated,'CUSTOMER_REQUEST_REJECTED',adminId,'ADMIN');
  return updated;
};

module.exports = {
  submitCustomerLeadService,
  getCustomerLeadListService,
  getCustomerLeadByIdService,
  approveCustomerLeadService,
  rejectCustomerLeadService
};
