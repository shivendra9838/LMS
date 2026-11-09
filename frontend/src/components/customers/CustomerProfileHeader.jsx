import {Link} from 'react-router-dom';
import {Users,RefreshCw,ShieldCheck} from 'lucide-react';
import {CustomerPhotoEditor} from '../CustomerPhoto';
import CustomerRisk from '../CustomerRisk';
import {DetailStatus} from './CustomerDetailSections';
import './customer-profile.css';
import {customerKycPresentation} from './customerDetailPresentation';

export default function CustomerProfileHeader({customer,employee,employeeLink,actions,onRefresh}){
 const kyc=customerKycPresentation(customer);
 const assigned=employee?.name?[employee.name,employee.employeeCode?'('+employee.employeeCode+')':null].filter(Boolean).join(' '):employee?'Employee details unavailable':'Unassigned';
 return <><header className="cp-profile"><div className="cp-identity"><CustomerPhotoEditor customer={customer} previewOnClick/><div className="cp-name"><div><h1>{customer.name||'Customer'}</h1><DetailStatus value={customer.status}/></div><p><span>{customer.customerCode||'Code unavailable'}</span>{customer.mobile&&<a href={'tel:'+customer.mobile}>{customer.mobile}</a>}</p><div className="cp-kyc-status"><ShieldCheck size={16} aria-hidden="true"/><DetailStatus value={kyc.value} label={kyc.label}/>{kyc.revision&&<small>{kyc.revision}</small>}</div></div></div><div className="cp-assigned"><Users size={23} aria-hidden="true"/><div><span>Assigned employee:</span>{employeeLink&&employee?.name?<Link to={employeeLink}>{assigned}</Link>:<strong>{assigned}</strong>}</div></div><div className="cp-actions">{actions}</div></header><div className="cp-risk"><CustomerRisk customerId={customer._id}/>{onRefresh&&<button type="button" aria-label="Refresh customer details" onClick={onRefresh}><RefreshCw size={18}/></button>}</div></>;
}
