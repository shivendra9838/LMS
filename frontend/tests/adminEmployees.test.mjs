import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {employeeErrors,employeeRowProps,employeePayload} from '../src/components/employees/presentation.js';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
let vite,ui,details;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/admin-employees',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});ui=await vite.ssrLoadModule('/src/components/employees/EmployeeUi.jsx');details=await vite.ssrLoadModule('/src/pages/admin/EmployeeDetails.jsx');});
after(async()=>vite?.close());
test('form validation rejects invalid dates, phone and whitespace, retaining only existing required fields',()=>{
 const valid={name:'Test Employee',email:'employee@example.test',phone:'9876543210',city:'Test',area:'Test',joiningDate:'2026-10-23'};
 assert.deepEqual(employeeErrors(valid),{});assert.ok(employeeErrors({...valid,joiningDate:'2026-02-30'}).joiningDate);assert.ok(employeeErrors({...valid,name:' ',phone:'short',email:'invalid'}).name);
 assert.deepEqual(employeeErrors({...valid,email:undefined,joiningDate:undefined},true),{});
});
test('row navigation supports Enter/Space and ignores independent interactive actions',()=>{
 const visits=[],props=employeeRowProps({_id:'employee-a',name:'Test'},url=>visits.push(url)),row={};let prevented=0;
 props.onClick({target:{closest:()=>null}});props.onClick({target:{closest:()=>({})}});
 for(const key of ['Enter',' ','Escape'])props.onKeyDown({key,target:row,currentTarget:row,preventDefault:()=>prevented++});
 props.onKeyDown({key:'Enter',target:{},currentTarget:row,preventDefault:()=>prevented++});
 assert.equal(visits.length,3);assert.equal(prevented,2);assert.ok(visits.every(url=>url==='/admin/employees/employee-a'));
});
test('Add fields have accessible labels, phone keyboard and visible field errors; Edit does not add identity fields',()=>{
 const render=props=>renderToStaticMarkup(React.createElement(ui.EmployeeFields,{value:{},onChange:()=>{},...props}));
 const add=render({errors:{phone:'Use 10 digits'}});assert.equal((add.match(/<input/g)||[]).length,6);assert.match(add,/inputMode="numeric"/);assert.match(add,/aria-invalid="true"/);assert.match(add,/employee-phone-error/);
 const edit=render({editing:true});assert.doesNotMatch(edit,/name="email"|name="joiningDate"/);assert.match(edit,/name="status"/);assert.match(edit,/dependency checks/);
});
test('portfolio summary uses the authoritative received amount, independently from outstanding and custody',()=>{
 const html=renderToStaticMarkup(React.createElement(details.EmployeeSummary,{dependencies:{assignedCustomers:2,activeLoans:1},work:{totalOutstanding:28118.33,todaysTotalCollection:700,todaysRevenue:999}}));
 for(const text of ['Assigned Customers','₹28,118.33','₹700.00','Received Today'])assert.ok(html.includes(text),text);assert.doesNotMatch(html,/999/);
});
test('dependencies retain financial blockers and existing action routes without offering deletion',()=>{
 const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(details.DependencyPanel,{dependencies:{activeLoans:2,outstandingCustody:6,unresolvedSettlements:1,canDeactivate:false},id:'employee-a',onLoans:()=>{}})));
 assert.match(html,/Resolve the listed financial dependencies/);assert.match(html,/counts, not rupee balances/);assert.match(html,/admin\/reconciliation/);assert.doesNotMatch(html,/Delete employee/);
});

test('employee screens read both global object envelopes and flattened paginated data',()=>{
 const page={rows:[{action:'EMPLOYEE_LOGIN'}],meta:{page:1,total:1}};assert.equal(employeePayload(page),page);assert.equal(employeePayload({success:true,data:page}),page);assert.equal(employeePayload({data:{totalEmployees:12}}).totalEmployees,12);assert.equal(employeePayload(null),null);
});
