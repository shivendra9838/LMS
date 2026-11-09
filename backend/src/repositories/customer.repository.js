const Customer = require('../models/Customer');

const findByMobile = async (mobile) => {
  return await Customer.findOne({ mobile });
};

const createCustomer = async (customerData) => {
  const customer = new Customer(customerData);
  return await customer.save();
};

const getCustomerList = async (query, skip, limit, sortObj) => {
  const total = await Customer.countDocuments(query);
  const customers = await Customer.find(query)
    .select('name customerCode mobile occupation city area status employeeId branchId kycLeadId kycApprovedAt createdAt')
    .populate('employeeId', 'name employeeCode')
    .populate('branchId', 'name areas status')
    .sort(sortObj)
    .skip(skip)
    .limit(limit);
  return { total, customers };
};

const getCustomerById = async (id) => {
  return await Customer.findById(id)
    .populate('employeeId', 'name employeeCode')
    .populate('branchId', 'name areas status');
};

const updateCustomer = async (id, updateData) => {
  return await Customer.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
};

const updateCustomerStatus = async (id, status) => {
  return await Customer.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
};

module.exports = { findByMobile, createCustomer, getCustomerList, getCustomerById, updateCustomer, updateCustomerStatus };
