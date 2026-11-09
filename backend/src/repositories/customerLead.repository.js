const CustomerLead = require('../models/CustomerLead');

const createCustomerLead = async (data) => CustomerLead.create(data);

const findCustomerLeadById = async (id) =>
  CustomerLead.findById(id).select('-history -documentIds -approvedDocumentIds')
    .populate('submittedByEmployeeId', 'name employeeCode')
    .populate('assignedEmployeeId', 'name employeeCode')
    .populate('customerId', 'customerCode name');

const findPendingLeadByMobile = async (mobile) =>
  CustomerLead.findOne({ mobile, status: 'PENDING' });

const getCustomerLeads = async (filter, skip, limit) => {
  const [leads, total] = await Promise.all([
    CustomerLead.find(filter)
      .select('-history -documentIds -approvedDocumentIds')
      .populate('submittedByEmployeeId', 'name employeeCode')
      .populate('assignedEmployeeId', 'name employeeCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    CustomerLead.countDocuments(filter)
  ]);
  return { leads, total };
};

const updateCustomerLeadById = async (id, update) =>
  CustomerLead.findByIdAndUpdate(id, update, { new: true, runValidators: true })
    .populate('submittedByEmployeeId', 'name employeeCode')
    .populate('assignedEmployeeId', 'name employeeCode')
    .populate('customerId', 'customerCode name');

module.exports = {
  createCustomerLead,
  findCustomerLeadById,
  findPendingLeadByMobile,
  getCustomerLeads,
  updateCustomerLeadById
};
