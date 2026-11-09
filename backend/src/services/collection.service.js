const { getTodayCollectionsForEmployee, getCollectionHistoryForLoan } = require('../repositories/collection.repository');
const mongoose = require('mongoose');
const Collection = require('../models/Collection');
const LoanSchedule = require('../models/LoanSchedule');
const Loan = require('../models/Loan');
const LoanTimeline = require('../models/LoanTimeline');
const Notification = require('../models/Notification');
const finance = require('./settlement.service');
const { minor, legacyMinor, major } = require('../utils/money');
const { generateCollectionNumber } = require('../utils/generateCode');
const { recordCashBookEntry, getPerformerModel } = require('./cashBook.service');
const { businessDay } = require('../utils/businessDay');
const { resolvePaymentDate, validateReceipt } = require('../utils/paymentDate');

const getTodayCollectionService = async (user, query = {}) => {
  if (user.role !== 'EMPLOYEE') {
    const error = new Error('Only employees can view their daily collection list');
    error.status = 403;
    throw error;
  }
  return await getTodayCollectionsForEmployee(user.id, query);
};

const getInstallmentsService = async (user, query = {}) => {
  await finance.authorize(user);
  if (!['TODAY','OVERDUE','UPCOMING','ALL'].includes(query.scope || 'TODAY')) throw finance.error(422,'Choose Today, Overdue, Upcoming or All Installments');
  if (query.loanId && !mongoose.isValidObjectId(query.loanId)) throw finance.error(422,'Invalid loan identifier');
  if (query.employeeId && !mongoose.isValidObjectId(query.employeeId)) throw finance.error(422,'Invalid employee identifier');
  if (user.role==='EMPLOYEE' && query.employeeId && query.employeeId!==user.id) throw finance.error(403,'You can only view your assigned installments');
  if(query.paymentState&&!['PAID','PARTIAL','UNPAID'].includes(query.paymentState))throw finance.error(422,'Choose a supported installment payment status');
  let pagination;
  if(query.page!==undefined||query.limit!==undefined){const p=require('./customerPortfolio.service').pageInfo(query);if(query.search!==undefined&&(typeof query.search!=='string'||query.search.length>100))throw finance.error(422,'Search is limited to 100 characters');pagination={...p,search:query.search,paymentState:query.paymentState};}
  const result=await require('../repositories/collection.repository').getInstallments(user.role==='EMPLOYEE'?user.id:query.employeeId,query.scope||'TODAY',query.loanId,pagination);
  if(pagination&&query.includeSummary==='true'){const entries=await Promise.all(['TODAY','OVERDUE','UPCOMING','ALL'].map(async scope=>[scope,(await require('../repositories/collection.repository').getInstallments(user.role==='EMPLOYEE'?user.id:query.employeeId,scope,query.loanId,{...pagination,skip:0,limit:1})).total]));result.counts=Object.fromEntries(entries);}
  const review=require('./customerPaymentReview.service');
  if(pagination)result.rows=await review.decorate(result.rows);else return review.decorate(result);
  return pagination?{...result,meta:{page:pagination.page,limit:pagination.limit,total:result.total,totalPages:Math.ceil(result.total/pagination.limit)}}:result;
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
  await finance.authorize(user);
  if (!mongoose.isValidObjectId(collectionId)) throw finance.error(422,'Invalid receipt identifier');
  const collection = await Collection.findById(collectionId)
    .populate('customerId', 'name customerCode')
    .populate('employeeId', 'name employeeCode')
    .populate('loanId', 'loanNumber remainingAmount');

  if (!collection) {
    throw Object.assign(new Error('Collection record not found'), { status: 404 });
  }

  // RBAC
  if (user.role === 'EMPLOYEE' && String(collection.employeeId?._id) !== user.id) {
    throw Object.assign(new Error('Unauthorized to view this receipt'), { status: 403 });
  }

  const position = await require('../models/CollectionPosition').findOne({collectionId:collection._id}).select('verification bucket amountMinor reservedMinor settledMinor');
  // Presentation-only enrichment: never reconstruct historical balances or write a receipt.
  const schedules = await LoanSchedule.find({loanId:collection.loanId?._id,_id:{$in:[collection.loanScheduleId,...(collection.allocations||[]).map(a=>a.scheduleId)]}}).lean();
  const scheduleDetails = schedule => schedule ? {installmentNumber:schedule.dayNumber,dueDate:schedule.date,installmentAmount:schedule.amount,currentPaidAmount:schedule.paidAmount||0,currentRemainingAmount:major(Math.max(0,legacyMinor(schedule.amount)-legacyMinor(schedule.paidAmount))),currentStatusLabel:require('../utils/installmentStatus').present(schedule).statusLabel} : null;
  const actor = ['ADMIN','EMPLOYEE'].includes(collection.recordedByRole) ? await require('../models/'+(collection.recordedByRole==='ADMIN'?'Admin':'Employee')).findById(collection.collectedBy).select('name employeeCode').lean() : null;
  const recovery=await require('./overdue.service').loanSummary(collection.loanId);
  return {
    currentOverdue:recovery.overdueAmount,currentTodayUnpaid:recovery.dueTodayAmount,
    collectionNumber: collection.collectionNumber,
    customerName: collection.customerId?.name,
    customerId: collection.customerId?._id,
    employeeId: collection.employeeId?._id,
    canReview:collection.recordedByRole==='EMPLOYEE'&&String(collection.collectedBy)===String(collection.employeeId?._id)&&collection.amountReceived>0&&!['MISSED','WAIVED'].includes(collection.status),
    customerCode: collection.customerId?.customerCode,
    loanNumber: collection.loanId?.loanNumber,
    loanId: collection.loanId?._id ? String(collection.loanId._id) : undefined,
    amount: collection.amountReceived,
    mode: collection.paymentMode,
    date: collection.paymentDate,
    recordedAt: collection.createdAt,
    recordedByRole: collection.recordedByRole,
    backdateReason: collection.backdateReason,
    allocations: (collection.allocations || []).map(a=>({...a.toObject(),...scheduleDetails(schedules.find(s=>String(s._id)===String(a.scheduleId))),dueDate:a.dueDate,paymentDate:collection.paymentDate,timing:require('../utils/installmentStatus').timing(collection.paymentDate,a.dueDate)})),
    primaryInstallment: scheduleDetails(schedules.find(s=>String(s._id)===String(collection.loanScheduleId))),
    totalAllocated:collection.allocations?.length?major(collection.allocations.reduce((sum,a)=>sum+legacyMinor(a.amount),0)):null,
    unallocatedAmount:collection.allocations?.length?major(legacyMinor(collection.amountReceived)-collection.allocations.reduce((sum,a)=>sum+legacyMinor(a.amount),0)):null,
    currentLoanOutstanding: collection.loanId?.remainingAmount ?? null,
    generatedAt: new Date(),
    receivedBy: actor ? {name:actor.name,employeeCode:actor.employeeCode,role:collection.recordedByRole} : null,
    employeeName: collection.employeeId?.name,
    employeeCode: collection.employeeId?.employeeCode,
    status: collection.status,
    receivingDestination: collection.receivingDestination || 'UNCLASSIFIED',
    transactionReference: collection.transactionReference,
    customerPaymentReview: await require('../models/CustomerPaymentReview').findOne({collectionId:collection._id}).populate('verifiedBy','name').lean(),
    verification: position?.verification || 'UNCLASSIFIED',
    settlementStatus: finance.settlementStatus(position)
  };
};

const recordCollectionService = async (data, user) => {
  if(user.id==='SYSTEM'&&!data.isMissed)throw finance.error(403,'System jobs cannot receive customer money');
  if (user.id !== 'SYSTEM') await finance.authorize(user);
  await finance.ensureIndexes();
  if (data.financeVersion !== undefined && data.financeVersion !== 2) throw finance.error(422, 'Unsupported finance version');
  const idem = data.idempotencyKey ? finance.key(data.idempotencyKey) : undefined;
  if (data.financeVersion === 2 && !idem) throw finance.error(422, 'An idempotency key is required');
  const actor = `${user.role}:${user.id}`;
  const paymentDate = resolvePaymentDate(data.paymentDate);
  const requestHash = finance.hash({schedule:data.loanScheduleId, amount:data.isMissed?0:minor(data.amountReceived), mode:data.paymentMode, account:data.receivingAccountId, reference:data.transactionReference, remarks:data.remarks, missed:Boolean(data.isMissed),...(data.paymentDate!==undefined?{paymentDate:data.paymentDate}:{}),...(data.backdateReason!==undefined?{backdateReason:data.backdateReason}:{}),...(data.cashReceivedByEmployeeId?{cashReceivedByEmployeeId:data.cashReceivedByEmployeeId}:{})});
  try {
    return await mongoose.connection.transaction(async session => {
    if (idem) {
      const existing = await Collection.findOne({idempotencyActor:actor,idempotencyKey:idem}).select('+requestHash').session(session);
      if (existing) { if(existing.requestHash !== requestHash) throw finance.error(409, 'Idempotency key was used for different payment data'); existing.requestHash = undefined; return existing; }
    }
    const { loanScheduleId, paymentMode, remarks, isMissed } = data;
    const amountReceived = isMissed ? 0 : major(minor(data.amountReceived));

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

    if (!require('./overdue.service').OPEN_STATUSES.includes(loan.status)) {
      throw Object.assign(new Error('Cannot record collection on a non-active loan'), { status: 400 });
    }

    // 2. Authorization
    if (user.id !== 'SYSTEM' && user.role === 'EMPLOYEE' && loan.employeeId._id.toString() !== user.id) {
      throw Object.assign(new Error('Unauthorized to collect for this loan'), { status: 403 });
    }

    if (!isMissed) validateReceipt(paymentDate,loan.loanDate,data.backdateReason);
    else if(data.paymentDate!==undefined || data.backdateReason) throw finance.error(422,'Missed markers are not received payments; do not supply a receipt date');

    if (legacyMinor(schedule.paidAmount)>=legacyMinor(schedule.amount)) {
      throw Object.assign(new Error('This schedule is already fully paid'), { status: 400 });
    }
    if (!isMissed) await require('../utils/installmentSequence').assertSequence(schedule,session);
    
    const colNum = await generateCollectionNumber(session);
    const expectedAmount = major(legacyMinor(schedule.amount) - legacyMinor(schedule.paidAmount));
    if(legacyMinor(loan.totalPayable)-legacyMinor(loan.paidAmount)!==legacyMinor(loan.remainingAmount))throw finance.error(409,'Loan balances need Admin review before receiving more money');
    if(!isMissed&&minor(amountReceived)>legacyMinor(loan.remainingAmount))throw finance.error(422,'Payment exceeds the total outstanding loan balance');
    if(isMissed&&new Date(schedule.date)>=require('../utils/businessDay').bounds().end)throw finance.error(422,'A future installment cannot be marked missed');
    if(isMissed&&schedule.status==='MISSED')throw finance.error(409,'This installment is already recorded as missed; its remaining balance can still be collected');

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
      newCollection.set({idempotencyActor:actor,idempotencyKey:idem,requestHash,recordedByRole:user.role});
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

      return newCollection;
    }
    // --- END MISSED PAYMENT FLOW ---

    // Recalculate from the same transaction snapshot as the allocation writes.
    const dueRows=await LoanSchedule.find({loanId:loan._id}).select('date amount paidAmount').session(session).lean();
    const minimum=require('../utils/minimumPayment');
    minimum.assertMinimum(minor(amountReceived),minimum.minimumPayment(dueRows,paymentDate));

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
      paymentDate,
      paymentMode: paymentMode || 'CASH',
      status: paymentStatus,
      remarks,
      backdateReason: businessDay(paymentDate)<businessDay() ? data.backdateReason.trim() : undefined,
      collectedBy: user.id === 'SYSTEM' ? loan.employeeId._id : user.id
    });
    
    newCollection.set({idempotencyActor:actor,idempotencyKey:idem,requestHash,recordedByRole:user.role});
      await newCollection.save({ session });

    // One planner supplies both the preview and committed allocations. The
    // oldest-unpaid guard above is repeated within this same transaction.
    const subsequent=await LoanSchedule.find({loanId:loan._id,dayNumber:{$gt:schedule.dayNumber},$expr:require('../utils/installmentSequence').unpaidExpression()}).sort({dayNumber:1}).session(session);
    const allocationRows=[schedule,...subsequent],plan=require('../utils/collectionAllocation').plan(allocationRows,minor(amountReceived));
    const byId=new Map(allocationRows.map(row=>[String(row._id),row]));
    for(const entry of plan.allocations){const row=byId.get(String(entry.scheduleId));row.paidAmount=major(entry.paidBeforeMinor+entry.amountMinor);row.paidDate=row.paidDate&&row.paidDate>paymentDate?row.paidDate:paymentDate;row.status=entry.remainingMinor===0?'PAID':'PARTIAL';newCollection.allocations.push({scheduleId:row._id,dueDate:row.date,amount:major(entry.amountMinor)});await row.save({session});}
    await newCollection.save({session});

    // 6. Update Loan Financials
    loan.paidAmount = major(legacyMinor(loan.paidAmount) + legacyMinor(amountReceived));
    loan.remainingAmount = major(Math.max(0, legacyMinor(loan.totalPayable) - legacyMinor(loan.paidAmount)));
    
    // Logic for paidDays: A day is considered 'paid' when full dailyInstallment is met.
    // For simplicity, we just recalculate paidDays = Math.floor(paidAmount / dailyInstallment)
    loan.paidDays = await LoanSchedule.countDocuments({loanId:loan._id,$expr:{$gte:[{$ifNull:['$paidAmount',0]},'$amount']}}).session(session);
    loan.remainingDays = Math.max(0,loan.durationDays - loan.paidDays);
    loan.lastPaymentDate = loan.lastPaymentDate && loan.lastPaymentDate>paymentDate ? loan.lastPaymentDate : paymentDate;
    
    // If loan fully paid, update loan status
    if (loan.remainingAmount <= 0) {
      loan.status = 'COMPLETED';
    }
    
    await loan.save({ session });

    // 7. Create Timeline Event
    await LoanTimeline.create([{
      loanId: loan._id,
      action: 'PAYMENT_RECEIVED',
      description: `Payment of ₹${amountReceived} received on ${businessDay(paymentDate)} via ${paymentMode || 'CASH'}; entered on ${businessDay(newCollection.createdAt)}`,
      performedBy: user.id === 'SYSTEM' ? loan.employeeId._id : user.id,
      remarks: colNum
    }], { session });

    await finance.registerCollection(newCollection, data, user, loan, session);
    await finance.audit(user,'PAYMENT_RECEIVED',newCollection,{paymentDate,recordedAt:newCollection.createdAt,backdateReason:newCollection.backdateReason,allocations:newCollection.allocations.map(a=>({scheduleId:a.scheduleId,dueDate:a.dueDate,amount:a.amount}))},session);
    if (amountReceived > 0) {
      await recordCashBookEntry({
        date: newCollection.paymentDate,
        type: 'LOAN_RECOVERY',
        direction: 'CASH_IN',
        cashIn: amountReceived,
        description: `Collection ${colNum} received`,
        referenceModel: 'Collection',
        referenceId: newCollection._id,
        createdBy: user.id === 'SYSTEM' ? loan.employeeId._id : user.id,
        createdByModel: getPerformerModel(user.role),
        fundChannel: newCollection.receivingDestination === 'COMPANY' ? 'COMPANY_DIGITAL' : newCollection.receivingDestination === 'UNCLASSIFIED' ? 'UNCLASSIFIED' : newCollection.paymentMode === 'CASH' ? 'CASH_EMPLOYEE' : 'EMPLOYEE_DIGITAL'
      }, session);
    }

    newCollection.requestHash = undefined;
    return newCollection;
    });
  } catch (error) {
    if(error.code === 11000 && idem) { const existing=await Collection.findOne({idempotencyActor:actor,idempotencyKey:idem}).select('+requestHash'); if(existing && existing.requestHash===requestHash) {existing.requestHash=undefined;return existing;} }
    if(error.code === 11000) throw finance.error(409, 'Duplicate payment reference or collection. Check the existing receipt.');
    throw error;
  }
};

module.exports = {
  getTodayCollectionService,
  getInstallmentsService,
  recordCollectionService,
  getCollectionHistoryService,
  getCollectionReceiptService
};
