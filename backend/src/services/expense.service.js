const mongoose = require('mongoose');
const {
  createExpense,
  getExpenseById,
  updateExpenseById,
  getExpenses,
  getExpenseReport
} = require('../repositories/expense.repository');
const {
  recordCashBookEntry,
  removeCashBookEntriesByReference
} = require('./cashBook.service');

const buildExpenseFilter = (query = {}) => {
  const { category, from, to, search } = query;
  const filter = { status: 'ACTIVE' };

  if (category) filter.category = category;
  if (from || to) {
    filter.date = {};
    if (from) {
      const start = require('../utils/businessDay').dayStart(String(from).slice(0,10));
      filter.date.$gte = start;
    }
    if (to) {
      const end = require('../utils/businessDay').dayStart(require('../utils/businessDay').addDays(String(to).slice(0,10),1));
      filter.date.$lt = end;
    }
  }
  if (search) {
    filter.$or = [
      { description: new RegExp(search, 'i') },
      { paidTo: new RegExp(search, 'i') }
    ];
  }

  return filter;
};

const syncExpenseCashBook = async (expense) => {
  await removeCashBookEntriesByReference('Expense', expense._id);
  if (expense.status !== 'ACTIVE') return;

  await recordCashBookEntry({
    date: expense.date,
    type: expense.category,
    direction: 'CASH_OUT',
    cashOut: expense.amount,
    description: expense.description,
    referenceModel: 'Expense',
    referenceId: expense._id,
    createdBy: expense.createdBy,
    createdByModel: 'Admin'
  });
};

const createExpenseService = async (expenseData, adminId) => {
  const expense = await createExpense({
    ...expenseData,
    date: expenseData.date || new Date(),
    createdBy: adminId
  });

  await syncExpenseCashBook(expense);
  return expense;
};

const getExpenseListService = async (query) => {
  const { page = 1, limit = 20 } = query;
  const skip = (Number(page) - 1) * Number(limit);
  const result = await getExpenses(buildExpenseFilter(query), skip, Number(limit));

  return {
    expenses: result.expenses,
    total: result.total,
    page: Number(page),
    totalPages: Math.ceil(result.total / Number(limit))
  };
};

const getExpenseByIdService = async (id) => {
  const expense = await getExpenseById(id);
  if (!expense || expense.status === 'DELETED') {
    const error = new Error('Expense Not Found');
    error.status = 404;
    throw error;
  }
  return expense;
};

const updateExpenseService = async (id, updateData, adminId) => {
  const existing = await getExpenseByIdService(id);
  const allowedUpdates = {
    date: updateData.date || existing.date,
    category: updateData.category || existing.category,
    amount: updateData.amount || existing.amount,
    description: updateData.description || existing.description,
    paidTo: updateData.paidTo !== undefined ? updateData.paidTo : existing.paidTo,
    paymentMode: updateData.paymentMode || existing.paymentMode,
    updatedBy: adminId
  };

  const expense = await updateExpenseById(id, allowedUpdates);
  await syncExpenseCashBook(expense);
  return expense;
};

const deleteExpenseService = async (id, adminId) => {
  await getExpenseByIdService(id);
  const expense = await updateExpenseById(id, { status: 'DELETED', updatedBy: adminId });
  await removeCashBookEntriesByReference('Expense', new mongoose.Types.ObjectId(id));
  return expense;
};

const getExpenseReportService = async (query) => {
  const report = await getExpenseReport(buildExpenseFilter(query));
  const categories = {
    OFFICE_EXPENSE: { category: 'OFFICE_EXPENSE', totalAmount: 0, count: 0 },
    SALARY: { category: 'SALARY', totalAmount: 0, count: 0 },
    MISC: { category: 'MISC', totalAmount: 0, count: 0 }
  };

  report.forEach(item => {
    categories[item._id] = {
      category: item._id,
      totalAmount: item.totalAmount,
      count: item.count
    };
  });

  const data = Object.values(categories);
  return {
    data,
    totalAmount: data.reduce((sum, item) => sum + item.totalAmount, 0),
    totalCount: data.reduce((sum, item) => sum + item.count, 0)
  };
};

module.exports = {
  createExpenseService,
  getExpenseListService,
  getExpenseByIdService,
  updateExpenseService,
  deleteExpenseService,
  getExpenseReportService
};
