const Expense = require('../models/Expense');

const createExpense = async (expenseData) => {
  return await Expense.create(expenseData);
};

const getExpenseById = async (id) => {
  return await Expense.findById(id);
};

const updateExpenseById = async (id, updateData) => {
  return await Expense.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
};

const getExpenses = async (filter, skip, limit) => {
  const [expenses, total] = await Promise.all([
    Expense.find(filter)
      .populate('createdBy', 'name email')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Expense.countDocuments(filter)
  ]);

  return { expenses, total };
};

const getExpenseReport = async (filter) => {
  return await Expense.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$category',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

module.exports = {
  createExpense,
  getExpenseById,
  updateExpenseById,
  getExpenses,
  getExpenseReport
};
