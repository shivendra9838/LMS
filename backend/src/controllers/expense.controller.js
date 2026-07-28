const {
  createExpenseService,
  getExpenseListService,
  getExpenseByIdService,
  updateExpenseService,
  deleteExpenseService,
  getExpenseReportService
} = require('../services/expense.service');
const { createAuditLog } = require('../utils/auditLogger');

const createExpenseController = async (req, res, next) => {
  try {
    const expense = await createExpenseService(req.body, req.user.id);

    createAuditLog(req, {
      action: 'EXPENSE_CREATED',
      module: 'EXPENSE',
      referenceId: expense._id,
      newValue: expense
    });

    res.status(201).json({
      success: true,
      message: 'Expense added successfully',
      data: expense
    });
  } catch (error) {
    next(error);
  }
};

const getExpenseListController = async (req, res, next) => {
  try {
    const result = await getExpenseListService(req.query);
    res.status(200).json({
      success: true,
      data: result.expenses,
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

const getExpenseController = async (req, res, next) => {
  try {
    const expense = await getExpenseByIdService(req.params.id);
    res.status(200).json({
      success: true,
      data: expense
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const updateExpenseController = async (req, res, next) => {
  try {
    const oldExpense = await getExpenseByIdService(req.params.id);
    const expense = await updateExpenseService(req.params.id, req.body, req.user.id);

    createAuditLog(req, {
      action: 'EXPENSE_UPDATED',
      module: 'EXPENSE',
      referenceId: expense._id,
      oldValue: oldExpense,
      newValue: expense
    });

    res.status(200).json({
      success: true,
      message: 'Expense updated successfully',
      data: expense
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const deleteExpenseController = async (req, res, next) => {
  try {
    const oldExpense = await getExpenseByIdService(req.params.id);
    const expense = await deleteExpenseService(req.params.id, req.user.id);

    createAuditLog(req, {
      action: 'EXPENSE_DELETED',
      module: 'EXPENSE',
      referenceId: expense._id,
      oldValue: oldExpense,
      newValue: { status: expense.status }
    });

    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully',
      data: expense
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getExpenseReportController = async (req, res, next) => {
  try {
    const report = await getExpenseReportService(req.query);
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createExpenseController,
  getExpenseListController,
  getExpenseController,
  updateExpenseController,
  deleteExpenseController,
  getExpenseReportController
};
