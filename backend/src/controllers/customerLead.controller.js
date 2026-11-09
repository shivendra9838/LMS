const {
  submitCustomerLeadService,
  getCustomerLeadListService,
  getCustomerLeadByIdService,
  approveCustomerLeadService,
  rejectCustomerLeadService
} = require('../services/customerLead.service');

const submitCustomerLeadController = async (req, res, next) => {
  try {
    const lead = await submitCustomerLeadService(req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: 'Customer details sent to admin for review',
      data: lead
    });
  } catch (error) {
    next(error);
  }
};

const getCustomerLeadListController = async (req, res, next) => {
  try {
    const result = await getCustomerLeadListService(req.query, req.user);
    res.status(200).json({
      success: true,
      data: result.leads,
      meta: {
        total: result.total,
        ...(result.counts ? {counts:result.counts} : {}),
        page: result.page,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};
const getCustomerLeadController = async (req, res, next) => {
  try {
    const lead = await getCustomerLeadByIdService(req.params.id, req.user);
    res.status(200).json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
};

const approveCustomerLeadController = async (req, res, next) => {
  try {
    const lead = await approveCustomerLeadService(req.params.id, req.user.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Customer created and allocated to employee',
      data: lead
    });
  } catch (error) {
    next(error);
  }
};

const rejectCustomerLeadController = async (req, res, next) => {
  try {
    const lead = await rejectCustomerLeadService(
      req.params.id,
      req.user.id,
      req.body.adminRemarks,
      req.body.version
    );
    res.status(200).json({
      success: true,
      message: 'Customer request rejected',
      data: lead
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitCustomerLeadController,
  getCustomerLeadListController,
  getCustomerLeadController,
  approveCustomerLeadController,
  rejectCustomerLeadController
};
