const express = require('express');
const request = require('supertest');
const validate = require('../../src/middlewares/validate.middleware');
const branch = require('../../src/validators/branch.validator');
const cash = require('../../src/validators/cashBook.validator');
const expense = require('../../src/validators/expense.validator');
const report = require('../../src/validators/report.validator');
const customer = require('../../src/validators/customer.validator');
const leads = require('../../src/validators/customerLead.validator');
const collection = require('../../src/validators/collection.validator');
const employee = require('../../src/validators/employee.validator');
function app(rules) {
  const result = express(); result.use(express.json());
  result.post('/check/:id', rules, validate, (req,res)=>res.json({ok:true}));
  return result;
}
const validId = '507f1f77bcf86cd799439011';
describe('Existing workflow validation regression checks',()=>{
  test.each([
    ['branch',branch.validateCreateBranch,{name:'Branch',areas:['Central']},{name:'',areas:[]}],
    ['cash opening',cash.validateOpeningBalance,{date:'2026-01-01',openingBalance:100},{date:'bad',openingBalance:'bad'}],
    ['expense',expense.validateCreateExpense,{category:'OFFICE_EXPENSE',amount:100,description:'Rent'},{category:'BAD',amount:-1,description:''}],
    ['customer',customer.validateCreateCustomer,{name:'Customer',mobile:'9876543210',address:'Address',employeeId:validId,age:30},{name:'',mobile:'bad',address:'',employeeId:'bad',age:10}],
    ['customer request',leads.validateSubmitCustomerLead,{name:'Customer',fatherName:'Father',mobile:'9876543210',age:30,occupation:'Shop',address:'Road',city:'Mumbai',area:'Central'},{name:'',mobile:'bad',age:10}],
    ['collection',collection.validateCollection,{loanScheduleId:validId,amountReceived:100,paymentMode:'CASH'},{loanScheduleId:'bad',amountReceived:-1,paymentMode:'BAD'}]
  ])('%s accepts valid input and rejects invalid input',async(_name,rules,good,bad)=>{
    expect((await request(app(rules)).post(`/check/${validId}`).send(good)).status).toBe(200);
    expect((await request(app(rules)).post(`/check/${validId}`).send(bad)).status).toBe(400);
  });
  test('report filters reject invalid dates and export modes',async()=>{
    expect((await request(app(report.validateReportFilters)).post(`/check/${validId}?startDate=bad&export=csv`).send({})).status).toBe(400);
    expect((await request(app(report.validateReportFilters)).post(`/check/${validId}?startDate=2026-01-01&export=excel`).send({})).status).toBe(200);
  });
  test('missed collection does not require a received payment',async()=>{
    expect((await request(app(collection.validateCollection)).post(`/check/${validId}`).send({loanScheduleId:validId,isMissed:true})).status).toBe(200);
  });
  test('employee creation accepts branch allocation and validates invalid branch IDs',async()=>{
    const body={name:'Employee',email:'test@example.com',phone:'9876543210',branchId:validId,area:'Central'};
    expect((await request(app(employee.validateCreateEmployee)).post(`/check/${validId}`).send(body)).status).toBe(200);
    expect((await request(app(employee.validateCreateEmployee)).post(`/check/${validId}`).send({...body,branchId:'bad'})).status).toBe(400);
  });
  test('reject reasons are mandatory for existing customer approval workflow',async()=>{
    expect((await request(app(leads.validateRejectCustomerLead)).post(`/check/${validId}`).send({})).status).toBe(400);
    expect((await request(app(leads.validateRejectCustomerLead)).post(`/check/${validId}`).send({adminRemarks:'Identity needs rechecking'})).status).toBe(200);
  });
});
