const {
  getCashBookListService,
  getCashBookDayService,
  setOpeningBalanceService,
  addManualCashEntryService,
  getCashBookDashboardService
} = require('../services/cashBook.service');
const { createAuditLog } = require('../utils/auditLogger');

const getCashBookListController = async (req, res, next) => {
  try {
    const cashBooks = await getCashBookListService(req.query);
    res.status(200).json({
      success: true,
      data: cashBooks
    });
  } catch (error) {
    next(error);
  }
};

const getCashBookDayController = async (req, res, next) => {
  try {
    const cashBook = await getCashBookDayService(req.params.date);
    res.status(200).json({
      success: true,
      data: cashBook
    });
  } catch (error) {
    next(error);
  }
};

const setOpeningBalanceController = async (req, res, next) => {
  try {
    const { date, openingBalance } = req.body;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    if (openingBalance === undefined || Number.isNaN(Number(openingBalance))) {
      return res.status(400).json({ success: false, message: 'Opening balance is required' });
    }

    const cashBook = await setOpeningBalanceService(date, openingBalance);

    createAuditLog(req, {
      action: 'OPENING_BALANCE_SET',
      module: 'CASH_BOOK',
      referenceId: cashBook._id,
      newValue: {
        date: cashBook.date,
        openingBalance: cashBook.openingBalance,
        closingBalance: cashBook.closingBalance
      }
    });

    res.status(200).json({
      success: true,
      message: 'Opening balance updated successfully',
      data: cashBook
    });
  } catch (error) {
    next(error);
  }
};

const addManualCashEntryController = async (req, res, next) => {
  try {
    const cashBook = await addManualCashEntryService(req.body, req.user);

    createAuditLog(req, {
      action: 'CASH_BOOK_ENTRY_CREATED',
      module: 'CASH_BOOK',
      referenceId: cashBook._id,
      newValue: req.body
    });

    res.status(201).json({
      success: true,
      message: 'Cash book entry added successfully',
      data: cashBook
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getCashBookDashboardController = async (req, res, next) => {
  try {
    const dashboard = await getCashBookDashboardService();
    res.status(200).json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCashBookListController,
  getCashBookDayController,
  setOpeningBalanceController,
  addManualCashEntryController,
  getCashBookDashboardController
};
