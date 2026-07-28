const { createCustomerService, getCustomerListService, getCustomerByIdService, updateCustomerService, updateCustomerStatusService, getCustomerTimelineService } = require('../services/customer.service');

const createCustomerController = async (req, res, next) => {
  try {
    const createdBy = req.user.id;
    const role = req.user.role;
    
    await createCustomerService(req.body, createdBy, role);
    
    res.status(201).json({
      success: true,
      message: 'Customer Created Successfully'
    });
  } catch (error) {
    if (error.message === 'Mobile already exists') {
      return res.status(400).json({ success: false, message: error.message });
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
    const customer = await updateCustomerService(req.params.id, req.body, req.user);
    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: customer
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
    const customer = await updateCustomerStatusService(req.params.id, status, req.user);
    res.status(200).json({
      success: true,
      message: 'Customer status updated successfully',
      data: customer
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
