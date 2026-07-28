const { createCustomerService, getCustomerListService, getCustomerByIdService, updateCustomerService, updateCustomerStatusService, getCustomerTimelineService } = require('../services/customer.service');
const { createAuditLog } = require('../utils/auditLogger');

const createCustomerController = async (req, res, next) => {
  try {
    const createdBy = req.user.id;
    const role = req.user.role;
    
    const customer = await createCustomerService(req.body, createdBy, role);
    
    createAuditLog(req, {
      action: 'CUSTOMER_CREATED',
      module: 'CUSTOMER',
      referenceId: customer._id,
      newValue: customer
    });

    res.status(201).json({
      success: true,
      message: 'Customer Created Successfully'
    });
  } catch (error) {
    if (error.message === 'Mobile already exists') {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getCustomerListController = async (req, res, next) => {
  try {
    const result = await getCustomerListService(req.query, req.user);
    res.status(200).json({
      success: true,
      data: result.customers,
      meta: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};

const getCustomerController = async (req, res, next) => {
  try {
    const customer = await getCustomerByIdService(req.params.id, req.user);
    res.status(200).json({
      success: true,
      data: customer
    });
  } catch (error) {
    if (error.name === 'CastError' || error.message === 'Customer Not Found') {
      return res.status(404).json({ success: false, message: 'Customer Not Found' });
    }
    next(error);
  }
};

const updateCustomerController = async (req, res, next) => {
  try {
    const oldCustomer = await getCustomerByIdService(req.params.id, req.user);
    const updatedCustomer = await updateCustomerService(req.params.id, req.body, req.user);
    
    createAuditLog(req, {
      action: 'CUSTOMER_UPDATED',
      module: 'CUSTOMER',
      referenceId: req.params.id,
      oldValue: oldCustomer,
      newValue: updatedCustomer
    });

    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: updatedCustomer
    });
  } catch (error) {
    if (error.name === 'CastError' || error.message === 'Customer Not Found') {
      return res.status(404).json({ success: false, message: 'Customer Not Found' });
    }
    if (error.message === 'Mobile already exists') {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const updateCustomerStatusController = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }
    const oldCustomer = await getCustomerByIdService(req.params.id, req.user);
    const updatedCustomer = await updateCustomerStatusService(req.params.id, status, req.user);
    
    createAuditLog(req, {
      action: 'STATUS_CHANGED',
      module: 'CUSTOMER',
      referenceId: req.params.id,
      oldValue: { status: oldCustomer.status },
      newValue: { status }
    });

    res.status(200).json({
      success: true,
      message: 'Customer status updated successfully',
      data: updatedCustomer
    });
  } catch (error) {
    if (error.name === 'CastError' || error.message === 'Customer Not Found') {
      return res.status(404).json({ success: false, message: 'Customer Not Found' });
    }
    if (error.message === 'Invalid status') {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getCustomerTimelineController = async (req, res, next) => {
  try {
    const timeline = await getCustomerTimelineService(req.params.id, req.user);
    res.status(200).json({
      success: true,
      data: timeline
    });
  } catch (error) {
    if (error.name === 'CastError' || error.message === 'Customer Not Found') {
      return res.status(404).json({ success: false, message: 'Customer Not Found' });
    }
    next(error);
  }
};

module.exports = { createCustomerController, getCustomerListController, getCustomerController, updateCustomerController, updateCustomerStatusController, getCustomerTimelineController };
