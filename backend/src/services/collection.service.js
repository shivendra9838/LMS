const { getTodayCollectionsForEmployee, getCollectionHistoryForLoan } = require('../repositories/collection.repository');
const mongoose = require('mongoose');
const Collection = require('../models/Collection');
const LoanSchedule = require('../models/LoanSchedule');
const Loan = require('../models/Loan');
const LoanTimeline = require('../models/LoanTimeline');
const Notification = require('../models/Notification');
const { generateCollectionNumber } = require('../utils/generateCode');

const getTodayCollectionService = async (user) => {
  if (user.role !== 'EMPLOYEE') {
    const error = new Error('Only employees can view their daily collection list');
    error.status = 403;
    throw error;
  }
  return await getTodayCollectionsForEmployee(user.id);
};

const getCollectionHistoryService = async (loanId, user) => {
  const loan = await Loan.findById(loanId);
  if (!loan) {
    throw Object.assign(new Error('Loan not found'), { status: 404 });
  }

  // RBAC
  if (user.role === 'EMPLOYEE' && loan.employeeId.toString() !== user.id) {
    throw Object.assign(new Error('Unauthorized access to loan history'), { status: 403 });
  }

  return await getCollectionHistoryForLoan(loanId);
};

const getCollectionReceiptService = async (collectionId, user) => {
  const collection = await Collection.findById(collectionId)
    .populate('customerId', 'name customerCode')
    .populate('employeeId', 'name employeeCode')
    .populate('loanId', 'loanNumber');

  if (!collection) {
    throw Object.assign(new Error('Collection record not found'), { status: 404 });
  }

  // RBAC
  if (user.role === 'EMPLOYEE' && collection.employeeId._id.toString() !== user.id) {
    throw Object.assign(new Error('Unauthorized to view this receipt'), { status: 403 });
  }

  return {
    collectionNumber: collection.collectionNumber,
    customerName: collection.customerId.name,
    customerCode: collection.customerId.customerCode,
    loanNumber: collection.loanId.loanNumber,
    amount: collection.amountReceived,
    mode: collection.paymentMode,
    date: collection.paymentDate,
    employeeName: collection.employeeId.name,
    employeeCode: collection.employeeId.employeeCode,
    status: collection.status
  };
};

const recordCollectionService = async (data, user) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { loanScheduleId, amountReceived, paymentMode, remarks, isMissed } = data;

    // 1. Find Schedule and Loan
    const schedule = await LoanSchedule.findById(loanScheduleId)
      .populate({
        path: 'loanId',
        populate: [
          { path: 'customerId', select: 'name city area' },
          { path: 'employeeId', select: 'name' }
        ]
      })
      .session(session);
    if (!schedule) {
      throw Object.assign(new Error('Loan Schedule not found'), { status: 404 });
    }

    const loan = schedule.loanId;
    if (!loan) {
      throw Object.assign(new Error('Associated Loan not found'), { status: 404 });
    }

    if (loan.status !== 'ACTIVE') {
      throw Object.assign(new Error('Cannot record collection on a non-active loan'), { status: 400 });
    }

    // 2. Authorization
    if (user.id !== 'SYSTEM' && user.role === 'EMPLOYEE' && loan.employeeId._id.toString() !== user.id) {
      throw Object.assign(new Error('Unauthorized to collect for this loan'), { status: 403 });
    }

    if (schedule.status === 'PAID') {
      throw Object.assign(new Error('This schedule is already fully paid'), { status: 400 });
    }
    
    const colNum = await generateCollectionNumber();
    const expectedAmount = schedule.amount - schedule.paidAmount;

    // --- MISSED PAYMENT FLOW ---
    if (isMissed) {
      schedule.status = 'MISSED';
      await schedule.save({ session });

      const newCollection = new Collection({
        collectionNumber: colNum,
        loanId: loan._id,
        loanScheduleId: schedule._id,
        customerId: loan.customerId._id,
        employeeId: loan.employeeId._id,
        amountReceived: 0,
        expectedAmount,
        paymentDate: new Date(),
        status: 'MISSED',
        remarks: remarks || 'Missed Payment',
        collectedBy: user.id === 'SYSTEM' ? loan.employeeId._id : user.id
      });
      await newCollection.save({ session });

      await LoanTimeline.create([{
        loanId: loan._id,
        action: 'PAYMENT_MISSED',
        description: `Payment Missed. Reason: ${remarks || 'N/A'}`,
        performedBy: user.id === 'SYSTEM' ? loan.employeeId._id : user.id,
        remarks: colNum
      }], { session });

      await Notification.create([{
        loanId: loan._id,
        customerId: loan.customerId._id,
        employeeId: loan.employeeId._id,
        loanScheduleId: schedule._id,
        type: 'MISSED_PAYMENT',
        message: `Customer ${loan.customerId.name}, Employee ${loan.employeeId.name}, Area ${loan.customerId.city} - ${loan.customerId.area}, Today's installment missed.`,
        status: 'UNREAD'
      }], { session });

      await session.commitTransaction();
      session.endSession();
      return newCollection;
    }
    // --- END MISSED PAYMENT FLOW ---

    // 3. Compute Status & Amounts (NORMAL PAYMENT FLOW)
    let paymentStatus = 'PAID';
    
    if (amountReceived < expectedAmount) {
      paymentStatus = 'PARTIAL';
    } else if (amountReceived > expectedAmount) {
      paymentStatus = 'EXTRA_PAYMENT';
    }

    // 4. Create Collection Record
    const newCollection = new Collection({
      collectionNumber: colNum,
      loanId: loan._id,
      loanScheduleId: schedule._id,
      customerId: loan.customerId._id,
      employeeId: loan.employeeId._id,
      amountReceived,
      expectedAmount,
      paymentDate: new Date(),
      paymentMode: paymentMode || 'CASH',
      status: paymentStatus,
      remarks,
      collectedBy: user.id === 'SYSTEM' ? loan.employeeId._id : user.id
    });
    
    await newCollection.save({ session });

    // 5. Update Schedule(s) - Distribute extra payments to next installments
    let remainingToApply = amountReceived;
    
    // First apply to target schedule
    const applyToCurrent = Math.min(expectedAmount, remainingToApply);
    schedule.paidAmount += applyToCurrent;
    schedule.paidDate = new Date();
    
    if (schedule.paidAmount >= schedule.amount) {
      schedule.status = 'PAID';
    } else if (schedule.paidAmount > 0) {
      schedule.status = 'PARTIAL';
    }
    await schedule.save({ session });
    
    remainingToApply -= applyToCurrent;

    // Apply any excess to subsequent schedules
    if (remainingToApply > 0) {
      const subsequentSchedules = await LoanSchedule.find({
        loanId: loan._id,
        dayNumber: { $gt: schedule.dayNumber },
        status: { $ne: 'PAID' }
      }).sort({ dayNumber: 1 }).session(session);

      for (const nextSchedule of subsequentSchedules) {
        if (remainingToApply <= 0) break;
        
        const nextExpected = nextSchedule.amount - nextSchedule.paidAmount;
        const applyToNext = Math.min(nextExpected, remainingToApply);
        
        nextSchedule.paidAmount += applyToNext;
        nextSchedule.paidDate = new Date();
        
        if (nextSchedule.paidAmount >= nextSchedule.amount) {
          nextSchedule.status = 'PAID';
        } else if (nextSchedule.paidAmount > 0) {
          nextSchedule.status = 'PARTIAL';
        }
        
        await nextSchedule.save({ session });
        remainingToApply -= applyToNext;
      }
    }

    // 6. Update Loan Financials
    loan.paidAmount = (loan.paidAmount || 0) + amountReceived;
    loan.remainingAmount = Math.max(0, loan.totalPayable - loan.paidAmount);
    
    // Logic for paidDays: A day is considered 'paid' when full dailyInstallment is met.
    // For simplicity, we just recalculate paidDays = Math.floor(paidAmount / dailyInstallment)
    loan.paidDays = Math.floor(loan.paidAmount / loan.dailyInstallment);
    loan.remainingDays = loan.durationDays - loan.paidDays;
    loan.lastPaymentDate = new Date();
    
    // If loan fully paid, update loan status
    if (loan.remainingAmount <= 0 && loan.status === 'ACTIVE') {
      loan.status = 'COMPLETED';
    }
    
    await loan.save({ session });

    // 7. Create Timeline Event
    await LoanTimeline.create([{
      loanId: loan._id,
      action: 'PAYMENT_RECEIVED',
      description: `Payment of ₹${amountReceived} received via ${paymentMode || 'CASH'}`,
      performedBy: user.id === 'SYSTEM' ? loan.employeeId._id : user.id,
      remarks: colNum
    }], { session });

    await session.commitTransaction();
    session.endSession();

    return newCollection;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

module.exports = {
  getTodayCollectionService,
  recordCollectionService,
  getCollectionHistoryService,
  getCollectionReceiptService
};
