const CashBook = require('../models/CashBook');
const { legacyMinor, major } = require('../utils/money');
const signedMinor = value => Math.sign(Number(value || 0)) * legacyMinor(Math.abs(Number(value || 0)));
const sumMoney = (entries, field) => major(entries.reduce((sum, entry) => {
  const next = sum + legacyMinor(entry[field]);
  if (!Number.isSafeInteger(next)) throw Object.assign(new Error('Cash-book total exceeds safe monetary limits'), { status: 422 });
  return next;
}, 0));
const closing = book => major(signedMinor(book.openingBalance) + legacyMinor(book.cashIn) - legacyMinor(book.cashOut));

const normalizeDate = (date = new Date()) => require('../utils/businessDay').dayStart(require('../utils/businessDay').businessDay(date));

const getPerformerModel = (role) => {
  if (role === 'EMPLOYEE') return 'Employee';
  if (role === 'SYSTEM') return 'SYSTEM';
  return 'Admin';
};

const CASH_IN_TYPES = ['LOAN_RECOVERY', 'MANUAL_INCOME'];
const CASH_OUT_TYPES = ['NEW_LOAN', 'OFFICE_EXPENSE', 'SALARY', 'MISC'];

const getPreviousCashBook = async (date, session) => {
  const query = CashBook.findOne({ date: { $lt: date } }).sort({ date: -1 });
  if (session) query.session(session);
  return await query;
};

const getCashBookForDate = async (date, session) => {
  const normalizedDate = normalizeDate(date);
  let query = CashBook.findOne({ date: {$gte:normalizedDate,$lt:new Date(normalizedDate.getTime()+86400000)} });
  if (session) query = query.session(session);
  let cashBook = await query;

  if (!cashBook) {
    const previous = await getPreviousCashBook(normalizedDate, session);
    cashBook = new CashBook({
      date: normalizedDate,
      openingBalance: previous?.closingBalance || 0,
      cashIn: 0,
      cashOut: 0,
      closingBalance: previous?.closingBalance || 0,
      entries: []
    });
  }

  return cashBook;
};

const recalculateBalancesFrom = async (date, session, preserveFirstOpening = false) => {
  const normalizedDate = normalizeDate(date);
  const previous = await getPreviousCashBook(normalizedDate, session);
  let runningOpening = previous?.closingBalance || 0;

  let query = CashBook.find({ date: { $gte: normalizedDate } }).sort({ date: 1 });
  if (session) query = query.session(session);
  const books = await query;

  for (let index = 0; index < books.length; index++) {
    const book = books[index];
    if (!preserveFirstOpening || index > 0) {
      book.openingBalance = runningOpening;
    }
    book.cashIn = sumMoney(book.entries, 'cashIn');
    book.cashOut = sumMoney(book.entries, 'cashOut');
    book.closingBalance = closing(book);
    await book.save({ session });
    runningOpening = book.closingBalance;
  }
};

const recordCashBookEntry = async ({
  date = new Date(),
  type,
  direction,
  cashIn = 0,
  cashOut = 0,
  description,
  referenceModel,
  referenceId,
  createdBy,
  createdByModel = 'Admin',
  fundChannel = 'LEGACY'
}, session) => {
  const normalizedDate = normalizeDate(date);
  const cashBook = await getCashBookForDate(normalizedDate, session);
  const resolvedDirection = direction || (cashIn > 0 ? 'CASH_IN' : 'CASH_OUT');

  if (resolvedDirection === 'CASH_IN' && !CASH_IN_TYPES.includes(type)) {
    const error = new Error('Invalid cash in type');
    error.status = 400;
    throw error;
  }

  if (resolvedDirection === 'CASH_OUT' && !CASH_OUT_TYPES.includes(type)) {
    const error = new Error('Invalid cash out type');
    error.status = 400;
    throw error;
  }

  const transactionKey = referenceModel && referenceId ? `${type}:${referenceModel}:${referenceId}` : null;

  if (transactionKey && cashBook.entries.some(entry => entry.transactionKey === transactionKey)) {
    return cashBook;
  }

  cashBook.entries.push({
    type,
    direction: resolvedDirection,
    cashIn,
    cashOut,
    description,
    referenceModel,
    referenceId,
    transactionKey,
    createdBy,
    createdByModel,
    fundChannel
  });
  cashBook.cashIn = sumMoney(cashBook.entries, 'cashIn');
  cashBook.cashOut = sumMoney(cashBook.entries, 'cashOut');
  cashBook.closingBalance = closing(cashBook);

  await cashBook.save({ session });
  await recalculateBalancesFrom(normalizedDate, session);

  return cashBook;
};

const removeCashBookEntriesByReference = async (referenceModel, referenceId, session) => {
  let query = CashBook.find({ 'entries.referenceModel': referenceModel, 'entries.referenceId': referenceId });
  if (session) query = query.session(session);
  const books = await query;

  for (const book of books) {
    book.entries = book.entries.filter(entry => {
      return !(entry.referenceModel === referenceModel && entry.referenceId?.toString() === referenceId.toString());
    });
    book.cashIn = sumMoney(book.entries, 'cashIn');
    book.cashOut = sumMoney(book.entries, 'cashOut');
    book.closingBalance = closing(book);
    await book.save({ session });
    await recalculateBalancesFrom(book.date, session);
  }
};

const addManualCashEntryService = async (entryData, user) => {
  const { date = new Date(), type, amount, description } = entryData;
  const numericAmount = Number(amount);

  if (!type) {
    const error = new Error('Type is required');
    error.status = 400;
    throw error;
  }

  if (!numericAmount || numericAmount <= 0) {
    const error = new Error('Amount must be greater than 0');
    error.status = 400;
    throw error;
  }

  const direction = CASH_IN_TYPES.includes(type) ? 'CASH_IN' : 'CASH_OUT';

  return await recordCashBookEntry({
    date,
    type,
    direction,
    cashIn: direction === 'CASH_IN' ? numericAmount : 0,
    cashOut: direction === 'CASH_OUT' ? numericAmount : 0,
    description,
    referenceModel: 'Manual',
    createdBy: user.id,
    createdByModel: getPerformerModel(user.role)
  });
};

const setOpeningBalanceService = async (date, openingBalance) => {
  const normalizedDate = normalizeDate(date);
  const cashBook = await getCashBookForDate(normalizedDate);

  cashBook.openingBalance = Number(openingBalance);
  cashBook.closingBalance = closing(cashBook);
  await cashBook.save();
  await recalculateBalancesFrom(normalizedDate, null, true);

  return cashBook;
};

const getCashBookListService = async (query) => {
  const { from, to } = query;
  const filter = {};

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = normalizeDate(from);
    if (to) filter.date.$lt = new Date(normalizeDate(to).getTime()+86400000);
  }

  return await CashBook.find(filter).sort({ date: -1 });
};

const getCashBookDayService = async (date) => {
  return await getCashBookForDate(date);
};

const getCashBookDashboardService = async () => {
  const today = await getCashBookForDate(new Date());
  return {
    date: today.date,
    todaysCash: today.closingBalance,
    cashIn: today.cashIn,
    cashOut: today.cashOut,
    closingBalance: today.closingBalance,
    openingBalance: today.openingBalance
  };
};

module.exports = {
  normalizeDate,
  getPerformerModel,
  recordCashBookEntry,
  removeCashBookEntriesByReference,
  addManualCashEntryService,
  setOpeningBalanceService,
  getCashBookListService,
  getCashBookDayService,
  getCashBookDashboardService
};
