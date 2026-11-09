const { createLoanService, getLoanListService, getLoanByIdService, updateLoanStatusService } = require('../services/loan.service');
const { logAccess } = require('../utils/logger');

const createLoanController = async (req, res, next) => {
  try {
    const loan = await createLoanService(req.body, req.user);
    logAccess('LOAN_CREATED', {
      loanId: loan._id,
      loanNumber: loan.loanNumber,
      userId: req.user.id,
      userRole: req.user.role
    });
    res.status(201).json({ success: true, message: 'Loan Created Successfully', data: loan });
  } catch (error) {
    next(error);
  }
};

const getLoanListController = async (req, res, next) => {
  try {
    const data = await getLoanListService(req.query, req.user);
    res.status(200).json({
      success: true,
      meta: { total: data.total, page: data.page, totalPages: data.totalPages, ...(data.counts?{counts:data.counts}:{}) },
      data: data.loans
    });
  } catch (error) {
    next(error);
  }
};

const getLoanController = async (req, res, next) => {
  try {
    const loan = await getLoanByIdService(req.params.id, req.user);
    res.status(200).json({ success: true, data: loan });
  } catch (error) {
    next(error);
  }
};

const updateLoanStatusController = async (req, res, next) => {
  try {
    const { status } = req.body;
    const loan = await updateLoanStatusService(req.params.id, status, req.user);
    res.status(200).json({ success: true, message: 'Loan Status Updated', data: loan });
  } catch (error) {
    next(error);
  }
};

const { getLoanTimeline } = require('../repositories/loanTimeline.repository');

const getLoanTimelineController = async (req, res, next) => {
  try {
    const loan=await getLoanByIdService(req.params.id,req.user);
    const timeline = await getLoanTimeline(req.params.id,loan);
    res.status(200).json({ success: true, data: timeline });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createLoanController,
  getLoanListController,
  getLoanController,
  updateLoanStatusController,
  getLoanTimelineController
};
