const { findByMobile, createCustomer, getCustomerList, getCustomerById, updateCustomer, updateCustomerStatus } = require('../repositories/customer.repository');
const { createTimelineEntry, getTimelineByCustomerId } = require('../repositories/customerTimeline.repository');
const { generateCustomerCode } = require('../utils/generateCode');
const Employee = require('../models/Employee'); // We need this to resolve employee code to ID

const createCustomerService = async (customerData, createdBy, role) => {
  // Mobile unique check
  const existing = await findByMobile(customerData.mobile);
  if (existing) {
    const error = new Error('Mobile already exists');
    error.status = 400;
    throw error;
  }

  // Generate code
  const customerCode = await generateCustomerCode();

  const newCustomer = {
    ...customerData,
    customerCode,
    createdBy,
    employeeId: createdBy // Since employeeId is required and Admin or Employee creates it
  };

  const createdCustomer = await createCustomer(newCustomer);
  
  // Log timeline event
  await createTimelineEntry(createdCustomer._id, 'Customer Created', 'Customer profile was created in the system');

  return createdCustomer;
};

const getCustomerListService = async (queryParams, user) => {
  const { page = 1, limit = 20, search, city, area, employee, status, sort } = queryParams;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  let query = {};
  
  // Role-based access control for listing
  if (user.role === 'EMPLOYEE') {
    query.employeeId = user.id;
  } else if (user.role === 'ADMIN' && employee) {
    // If Admin wants to filter by employee code (e.g., EMP001)
    const emp = await Employee.findOne({ employeeCode: employee });
    if (emp) {
      query.employeeId = emp._id;
    } else {
      // If employee code is invalid, return empty results
      return { total: 0, page: parseInt(page), totalPages: 0, customers: [] };
    }
  }

  // Filters
  if (city) query.city = new RegExp(city, 'i');
  if (area) query.area = new RegExp(area, 'i');
  if (status) query.status = status;

  // Search
  if (search) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { customerCode: new RegExp(search, 'i') },
      { mobile: new RegExp(search, 'i') }
    ];
  }

  // Sorting
  let sortObj = { createdAt: -1 }; // default
  if (sort) {
    const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
    const sortOrder = sort.startsWith('-') ? -1 : 1;
    sortObj = { [sortField]: sortOrder };
  }

  const result = await getCustomerList(query, skip, parseInt(limit), sortObj);
  return {
    total: result.total,
    page: parseInt(page),
    totalPages: Math.ceil(result.total / parseInt(limit)),
    customers: result.customers
  };
};

const getCustomerByIdService = async (id, user) => {
  const customer = await getCustomerById(id);
  if (!customer) {
    throw new Error('Customer Not Found');
  }

  // RBAC
  if (user.role === 'EMPLOYEE' && customer.employeeId._id.toString() !== user.id) {
    throw new Error('Customer Not Found'); // Disguise 403 as 404 for security
  }

  return customer;
};

const updateCustomerService = async (id, updateData, user) => {
  const customer = await getCustomerByIdService(id, user); // Checks existence and RBAC

  // Filter out non-editable fields
  delete updateData.customerCode;
  delete updateData.employeeId;
  delete updateData.status; // Handled by separate API

  if (updateData.mobile && updateData.mobile !== customer.mobile) {
    const existing = await findByMobile(updateData.mobile);
    if (existing) {
      const error = new Error('Mobile already exists');
      error.status = 400;
      throw error;
    }
  }

  return await updateCustomer(id, updateData);
};

const updateCustomerStatusService = async (id, status, user) => {
  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    throw new Error('Invalid status');
  }

  await getCustomerByIdService(id, user); // Checks existence and RBAC
  return await updateCustomerStatus(id, status);
};

const getCustomerTimelineService = async (id, user) => {
  await getCustomerByIdService(id, user); // Checks existence and RBAC first
  return await getTimelineByCustomerId(id);
};

module.exports = { createCustomerService, getCustomerListService, getCustomerByIdService, updateCustomerService, updateCustomerStatusService, getCustomerTimelineService };
