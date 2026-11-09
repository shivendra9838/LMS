import {RiskGroup} from '../../components/CustomerRisk';
import AdminPortfolioCustomers from '../../components/portfolios/AdminPortfolioCustomers';
import '../../components/portfolios/admin-portfolio.css';
import {useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {Users,Search,Plus} from 'lucide-react';
import {useRead,useFilters,Breadcrumbs,Pager,LoadState,Select} from '../../components/portfolios/PortfolioUi';

export function PortfolioFilter({label,shortLabel,value,onChange,children}){return <label className="ap-filter"><span className="ap-filter-label">{label}</span><select aria-label={label} value={value||''} onChange={e=>onChange(e.target.value)} title={shortLabel||label}>{children}</select></label>;}
export default function CustomerPortfolio({unassigned=false,assignedEmployeeId,embedded=false}){
 const route=useParams(),employeeId=assignedEmployeeId||route.employeeId,{params,search,setSearch,change,query}=useFilters();const [revision,setRevision]=useState(0);
 const endpoint=employeeId?`/customer-portfolios/employees/${employeeId}`:'/customer-portfolios/customers';
 const {loading,error,data}=useRead(`${endpoint}?${query}${unassigned?'&assignment=unassigned':''}`,revision);const employee=data?.employee;
 const title=employee?`${employee.name} — Customer Portfolio`:employeeId?'Employee Customer Portfolio':unassigned?'Unassigned Customers':'All Customers';
 return <RiskGroup ids={data?.rows.map(c=>c._id)}><div className={'ae-page ac-page ac-portfolio ap-portfolio'+(embedded?' ap-embedded':'')}>
  {embedded?<header className="ap-heading"><h2>Assigned customers</h2><Link className="btn-secondary" to={`/admin/customers/employees/${employeeId}`}>Open full customer portfolio</Link></header>:<><div className="ap-navigation"><Breadcrumbs items={[["Employees",'/admin/customers'],...(employee?[[`${employee.name} (${employee.employeeCode})`,`/admin/employees/${employeeId}`]]:[]),[employeeId?'Customer Portfolio':title]]}/><Link className="ap-back" to="/admin/customers">← Back to Employees</Link></div><header className="ap-heading"><div className="ap-heading-identity"><Users size={27} aria-hidden="true"/><div><h1>{title}</h1>{employee&&<div className="ap-employee-meta"><span>{employee.employeeCode}</span><span>{employee.branchId?.name||employee.city||'Branch not assigned'}</span><span>{employee.area||'Area not assigned'}</span><span className={'ap-status ap-'+employee.status}>{employee.status}</span></div>}</div></div><div className="ap-header-actions"><Link className="btn-secondary" to="/admin/customers/requests">Employee Requests</Link><Link className="btn-primary" to="/admin/customers/add"><Plus size={15} aria-hidden="true"/>Add Customer</Link></div></header></>}
  <section className="ap-body">
   <div className="ap-filter-grid">
    <label className="ap-search"><span className="sr-only">Search customer name, code or mobile</span><Search size={16} aria-hidden="true"/><input type="search" placeholder="Search by customer name, code or mobile…" maxLength={100} value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <PortfolioFilter label="Customer status" value={params.get('status')} onChange={v=>change('status',v)}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></PortfolioFilter>
    <PortfolioFilter label="KYC approval" value={params.get('kycStatus')} onChange={v=>change('kycStatus',v)}><option value="">All KYC states</option>{['APPROVED','PENDING','CORRECTION_REQUIRED','REJECTED','DRAFT','NOT_RECORDED'].map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</PortfolioFilter>
    <PortfolioFilter label="Loan filter" value={params.get('loanState')} onChange={v=>change('loanState',v)}><option value="">All customers</option><option value="active">With active loans</option><option value="overdue">With overdue balance</option><option value="none">No loans</option></PortfolioFilter>
    <PortfolioFilter label="Sort customers" value={params.get('sort')||'name'} onChange={v=>change('sort',v)}><option value="name">Name</option><option value="customerCode">Customer code</option><option value="outstandingMinor">Outstanding amount</option><option value="overdueMinor">Overdue amount</option><option value="lastPaymentDate">Last received payment</option></PortfolioFilter>
   </div>
   <LoadState loading={loading} error={error} retry={()=>setRevision(n=>n+1)}/>
   {!loading&&!error&&<><AdminPortfolioCustomers rows={data.rows} showEmployee={!employeeId}/>{!data.rows.length&&<p className="ap-empty">No customers match this portfolio and its filters.</p>}</>}
   <footer className="ap-footer"><div className="ap-list-options"><Select label="Sort order" value={params.get('direction')||'asc'} onChange={v=>change('direction',v)}><option value="asc">Ascending</option><option value="desc">Descending</option></Select><Select label="Customers per page" value={params.get('limit')||'20'} onChange={v=>change('limit',v)}>{[20,50,100].map(n=><option key={n} value={n}>{n}</option>)}</Select></div>{!loading&&!error&&<Pager meta={data.meta} change={change}/>}</footer>
  </section>
 </div></RiskGroup>;
}
