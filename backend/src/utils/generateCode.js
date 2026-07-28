const Customer = require('../models/Customer');
const Loan = require('../models/Loan');

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

const generateLoanNumber = async () => {
  const lastLoan = await Loan.findOne().sort({ loanNumber: -1 });
  if (!lastLoan || !lastLoan.loanNumber) return 'LN000001';
  const numericPart = parseInt(lastLoan.loanNumber.replace('LN', ''), 10);
  return `LN${(numericPart + 1).toString().padStart(6, '0')}`;
};

module.exports = { generateEmployeeCode, generateCustomerCode, generateLoanNumber };
