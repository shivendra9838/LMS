const { getLoans, getLoanById } = require('../repositories/loan.repository');
const { getCustomerByIdService } = require('./customer.service');
const Employee = require('../models/Employee');
const { calculateLoanDetails } = require('../utils/loanCalculator');
const { generateLoanNumber } = require('../utils/generateCode');
const Customer = require('../models/Customer');
const { recordCashBookEntry, getPerformerModel } = require('./cashBook.service');

const createLoanService = async (loanData, user) => {
  const mongoose=require('mongoose'),finance=require('./settlement.service');
  const {minor,major}=require('../utils/money');
  const {businessDay,dayStart,addDays}=require('../utils/businessDay');
  const {installmentAmounts}=require('../utils/loanCalculator');
  await finance.authorize(user);
  const customer=await getCustomerByIdService(loanData.customerId,user);
  const employeeId=user.role==='EMPLOYEE'?user.id:String(loanData.employeeId||customer.employeeId?._id||customer.employeeId);
  if(!await Employee.exists({_id:employeeId,status:'ACTIVE'}))throw finance.error(422,'Select an active assigned employee');
  if(String(customer.employeeId?._id||customer.employeeId)!==employeeId)throw finance.error(422,'Loan employee must match the approved customer assignment');
  const amount=major(minor(loanData.loanAmount)),duration=Number(loanData.durationDays);
  const calculated=calculateLoanDetails(loanData.loanAmount,loanData.interestPercent,duration);
  const day=/^\d{4}-\d{2}-\d{2}$/.test(loanData.loanDate)?loanData.loanDate:businessDay(loanData.loanDate);
  const startDate=dayStart(day);
  if(day>businessDay())throw finance.error(422,'Loan issuance date cannot be in the future');
  await finance.ensureIndexes();
  const Schedule=require('../models/LoanSchedule'),LoanModel=require('../models/Loan');
  const CustomerTimeline=require('../models/CustomerTimeline'),Timeline=require('../models/LoanTimeline');
  await Promise.all([LoanModel,Schedule,CustomerTimeline,Timeline].map(model=>model.init()));
  for(let attempt=0;attempt<3;attempt++){try{return await mongoose.connection.transaction(async session=>{
    // Serialize issuance for this customer to prevent concurrent duplicate active loans.
    const locked=await Customer.findOneAndUpdate({_id:customer._id,status:'ACTIVE'},{$inc:{__v:1}},{session,returnDocument:'after'});
    if(locked?.kycLeadId&&!await require('../models/CustomerLead').exists({_id:locked.kycLeadId,$or:[{status:'APPROVED'},{approvedAt:{$type:'date'}}]}).session(session))throw finance.error(409,'Customer KYC approval is required before issuing a loan');
    if(!locked)throw finance.error(409,'Customer must be active and approved before loan issuance');
    if(await LoanModel.exists({customerId:customer._id,status:{$in:['ACTIVE','DEFAULTED']},remainingAmount:{$gt:0}}).session(session))throw finance.error(400,'Customer already has an outstanding loan');
    const loanNumber=await generateLoanNumber(session);
    const [created]=await LoanModel.create([{loanNumber,customerId:customer._id,employeeId,loanAmount:amount,interestPercent:Number(loanData.interestPercent),...calculated,durationDays:duration,loanDate:startDate,maturityDate:dayStart(addDays(day,duration)),paidAmount:0,remainingAmount:calculated.totalPayable,paidDays:0,remainingDays:duration,status:'ACTIVE',createdBy:user.id}],{session});
    const amounts=installmentAmounts(calculated.totalPayable,duration);
    await Schedule.insertMany(amounts.map((value,index)=>({loanId:created._id,dayNumber:index+1,date:dayStart(addDays(day,index+1)),amount:value,status:'PENDING',paidAmount:0})),{session});
    await CustomerTimeline.create([{customerId:customer._id,action:'Loan Created',details:`Loan ${loanNumber} issued.`}],{session});
    await Timeline.create([{loanId:created._id,action:'Loan Created',description:'Loan account opened and verified.'},{loanId:created._id,action:'Schedule Generated',description:'Paise-exact daily schedule generated; first installment is the next business calendar day.'}],{session,ordered:true});
    await recordCashBookEntry({date:startDate,type:'NEW_LOAN',direction:'CASH_OUT',cashOut:amount,description:`Loan ${loanNumber} given`,referenceModel:'Loan',referenceId:created._id,createdBy:user.id,createdByModel:getPerformerModel(user.role)},session);
    await finance.audit(user,'LOAN_ISSUED',created,{loanNumber,totalPayable:created.totalPayable,durationDays:duration,actualIssueDate:created.loanDate,recordedAt:created.createdAt},session);
    return created;
  });}catch(error){if(error.code===11000){if(attempt<2)continue;throw finance.error(409,'Concurrent loan issuance conflict. Check existing loans before retrying.');}throw error;}}
};

const getLoanListService = async (queryParams, user) => {
  const { page = 1, limit = 10, search, employee, customer, status, city, area } = queryParams;
  const pagination=require('./customerPortfolio.service').pageInfo({page,limit});
  if(search!==undefined&&(typeof search!=='string'||search.length>100))throw require('./settlement.service').error(422,'Search is limited to 100 characters');
  const literalSearch=search?search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'):'';
  
  const query = {};
  // Read-only issue-date filtering uses inclusive India business days, not entry timestamps.
  const {issuedFrom,issuedTo}=queryParams;
  if(issuedFrom||issuedTo){
    const {dayStart,addDays}=require('../utils/businessDay');
    const validate=value=>{if(typeof value!=='string')throw require('./settlement.service').error(422,'Use an issue date in YYYY-MM-DD format');return dayStart(value);};
    const start=issuedFrom?validate(issuedFrom):null,end=issuedTo?validate(issuedTo):null;
    if(start&&end&&start>end)throw require('./settlement.service').error(422,'Issue date From must be on or before Through');
    query.loanDate={...(start?{$gte:start}:{}),...(end?{$lt:dayStart(addDays(issuedTo,1))}:{})};
  }

  // Employee RBAC
  if (user.role === 'EMPLOYEE') {
    query.employeeId = user.id;
  } else if (employee) {
    query.employeeId = employee; // Admin can filter by employee
  }

  // Direct filters
  if (customer) query.customerId = customer;
  const baseStatus = status;
  if(status==='OVERDUE') {
    const ids=await require('../models/LoanSchedule').distinct('loanId',{date:{$lt:require('../utils/businessDay').bounds().start},$expr:{$gt:['$amount',{$ifNull:['$paidAmount',0]}]}});
    query._id={$in:ids};query.status={$in:['ACTIVE','DEFAULTED']};query.remainingAmount={$gt:0};
  } else if(status) query.status=status;

  // Complex filters requiring Customer lookup (Search by name/mobile or City/Area)
  let customerFilterActive = false;
  const customerQuery = {};
  
  if (city) { customerQuery.city = city; customerFilterActive = true; }
  if (area) { customerQuery.area = area; customerFilterActive = true; }
  
  // If search is not a loan number, assume it's a customer name or mobile
  if (search) {
    customerQuery.$or = [
      { name: new RegExp(literalSearch, 'i') },
      { mobile: new RegExp(literalSearch, 'i') },
      { customerCode: new RegExp(literalSearch, 'i') }
    ];
  }

  if (customerFilterActive) {
    const matchedCustomers = await Customer.find(customerQuery).select('_id').lean();
    const matchedIds = matchedCustomers.map(c => c._id);
    
    if (query.customerId) {
      // If customer was explicitly passed but also searched/filtered, intersect them
      if (!matchedIds.some(id => id.toString() === query.customerId.toString())) {
        query.customerId = null; // Forces empty result
      }
    } else {
      query.customerId = { $in: matchedIds };
    }
  }

  // Search loan identifiers and customer fields together, without guessing from a prefix.
  if(search){const matches=await Customer.find(customerQuery).select('_id').lean();query.$or=[{loanNumber:new RegExp(literalSearch,'i')},{customerId:{$in:matches.map(c=>c._id)}}];}
  let counts;
  if(queryParams.includeCounts==='true'){
    const mongoose=require('mongoose'),countQuery={...query};delete countQuery.status;delete countQuery.remainingAmount;delete countQuery._id;
    for(const field of ['employeeId','customerId'])if(typeof countQuery[field]==='string')countQuery[field]=new mongoose.Types.ObjectId(countQuery[field]);
    const overdueIds=await require('../models/LoanSchedule').distinct('loanId',{date:{$lt:require('../utils/businessDay').bounds().start},$expr:{$gt:['$amount',{$ifNull:['$paidAmount',0]}]}});
    const result=await require('../models/Loan').aggregate([{$match:countQuery},{$group:{_id:null,all:{$sum:1},active:{$sum:{$cond:[{$eq:['$status','ACTIVE']},1,0]}},closed:{$sum:{$cond:[{$in:['$status',['CLOSED','COMPLETED']]},1,0]}},overdue:{$sum:{$cond:[{$and:[{$in:['$_id',overdueIds]},{$in:['$status',['ACTIVE','DEFAULTED']]},{$gt:['$remainingAmount',0]}]},1,0]}}}}]);
    counts=result[0]||{all:0,active:0,closed:0,overdue:0};delete counts._id;
  }
  if(baseStatus==='CLOSED'&&queryParams.includeCounts==='true')query.status={$in:['CLOSED','COMPLETED']};

  const { loans, total } = await getLoans(query, pagination.skip, pagination.limit, { createdAt: -1,_id:1 });
  const schedules=await require('../models/LoanSchedule').find({loanId:{$in:loans.map(loan=>loan._id)}}).select('loanId dayNumber date amount paidAmount status').sort({date:1,dayNumber:1}).lean(),byLoan=new Map();
  for(const row of schedules){const key=String(row.loanId);if(!byLoan.has(key))byLoan.set(key,[]);byLoan.get(key).push(row);}

  return {
    loans:loans.map(loan=>{const rows=byLoan.get(String(loan._id))||[],next=rows.find(s=>s.amount>s.paidAmount);return {...loan,...require('./overdue.service').scheduleSummary(loan,rows),nextDueDate:next?.date||null,nextDueDay:next?.dayNumber||null};}),
    counts,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit)
  };
};

const getLoanByIdService = async (id, user) => {
  const loan = await getLoanById(id);
  
  if (!loan) {
    const error = new Error('Loan not found');
    error.status = 404;
    throw error;
  }

  // Employee RBAC check: Can only view loans assigned to their customers or created by them
  // Actually, since the loan itself has an employeeId, we can just check if loan.employeeId matches user.id
  if (user.role === 'EMPLOYEE' && loan.employeeId._id.toString() !== user.id) {
    const error = new Error('Loan not found'); // Disguised 404
    error.status = 404;
    throw error;
  }

  const {mongoMinor,major}=require('../utils/money');
  const [receipts,allocations]=await Promise.all([
    require('../models/Collection').aggregate([{$match:{loanId:loan._id,amountReceived:{$gt:0},status:{$in:['PAID','PARTIAL','EXTRA_PAYMENT']}}},{$group:{_id:null,received:{$sum:mongoMinor('$amountReceived')},count:{$sum:1}}}]),
    require('../models/LoanSchedule').aggregate([{$match:{loanId:loan._id}},{$group:{_id:null,allocated:{$sum:mongoMinor('$paidAmount')}}}])
  ]);
  return {...loan,...await require('./overdue.service').loanSummary(loan),financialDisplay:{received:major(receipts[0]?.received||0),allocated:major(allocations[0]?.allocated||0),receiptCount:receipts[0]?.count||0}};
};

const updateLoanStatusService = async (id, status, user) => {
  const finance=require('./settlement.service');await finance.authorize(user,true);
  if(!['ACTIVE','DEFAULTED','COMPLETED','CLOSED'].includes(status))throw finance.error(422,'Choose a supported loan status; cancellation requires a separate reviewed disbursement reversal');
  return finance.transaction(async session=>{
    const loan=await require('../models/Loan').findById(id).session(session);
    if(!loan)throw finance.error(404,'Loan not found');
    const Schedule=require('../models/LoanSchedule');
    const unpaid=await Schedule.exists({loanId:loan._id,$expr:{$gt:['$amount',{$ifNull:['$paidAmount',0]}]}}).session(session);
    if(['COMPLETED','CLOSED'].includes(status)&&(loan.remainingAmount>0||unpaid))throw finance.error(409,'Unpaid installments cannot be marked completed or closed');
    if(['ACTIVE','DEFAULTED'].includes(status)&&(!['ACTIVE','DEFAULTED'].includes(loan.status)||loan.remainingAmount<=0))throw finance.error(409,'Only outstanding open loans can change recovery status');
    const previous=loan.status;loan.status=status;await loan.save({session});await finance.audit(user,'LOAN_STATUS_CHANGED',loan,{previous,status},session);return loan;
  });
};

module.exports = {
  createLoanService,
  getLoanListService,
  getLoanByIdService,
  updateLoanStatusService
};
