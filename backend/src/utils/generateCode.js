const Customer = require('../models/Customer');
const Loan = require('../models/Loan');
const Employee = require('../models/Employee');

const generateEmployeeCode = async () => {
  const lastEmployee = await Employee.findOne().sort({ employeeCode: -1 });
  if (!lastEmployee || !lastEmployee.employeeCode) return 'EMP0001';
  const numericPart = parseInt(lastEmployee.employeeCode.replace('EMP', ''), 10);
  return `EMP${(numericPart + 1).toString().padStart(4, '0')}`;
};

const generateCustomerCode = async () => {
  const lastCustomer = await Customer.findOne().sort({ customerCode: -1 });
  if (!lastCustomer || !lastCustomer.customerCode) return 'CUS000001';
  const numericPart = parseInt(lastCustomer.customerCode.replace('CUS', ''), 10);
  return `CUS${(numericPart + 1).toString().padStart(6, '0')}`;
};

const generateLoanNumber = async (session) => {
  const Sequence=require('../models/FinanceSequence');
  if(!await Sequence.findById('loan').session(session||null)) {
    const result=await Loan.aggregate([{$match:{loanNumber:/^LN\d+$/}},{$project:{value:{$convert:{input:{$substrBytes:['$loanNumber',2,30]},to:'double',onError:0}}}},{$group:{_id:null,value:{$max:'$value'}}}]).session(session||null);
    await Sequence.updateOne({_id:'loan'},{$setOnInsert:{value:result[0]?.value||0}},{upsert:true,session});
  }
  const counter=await Sequence.findOneAndUpdate({_id:'loan'},{$inc:{value:1}},{returnDocument:'after',session});
  return `LN${String(counter.value).padStart(6,'0')}`;
};

const generateCollectionNumber = async (session) => {
  const Sequence = require('../models/FinanceSequence');
  const Collection = require('../models/Collection'); // Require here to avoid circular dependencies if any
  let counter = await Sequence.findById('collection').session(session || null);
  if (!counter) {
    const highest = await Collection.aggregate([
      { $match: { collectionNumber: /^COL\d+$/ } },
      { $project: { value: { $convert: { input: { $substrBytes: ['$collectionNumber', 3, 30] }, to: 'double', onError: 0 } } } },
      { $group: { _id: null, value: { $max: '$value' } } }
    ]).session(session || null);
    await Sequence.updateOne({ _id: 'collection' }, { $setOnInsert: { value: highest[0]?.value || 0 } }, { upsert: true, session });
  }
  counter = await Sequence.findOneAndUpdate({ _id: 'collection' }, { $inc: { value: 1 } }, { returnDocument: 'after', session });
  return `COL${String(counter.value).padStart(6, '0')}`;
};

module.exports = { generateEmployeeCode, generateCustomerCode, generateLoanNumber, generateCollectionNumber };
