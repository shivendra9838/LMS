import LoadingIndicator from "../../components/ui/Loading";
import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {UserPlus,Users,Check,Hourglass,CalendarDays,Search,RefreshCw} from 'lucide-react';
import {useCollectionRead as useRead} from '../../hooks/useCollectionRefresh';
import EmployeeTable from '../../components/EmployeeTable';
import {employeePayload} from '../../components/employees/presentation';
import Pagination from '../../components/Pagination';
import {EmployeeHeading,EmployeeMetric} from '../../components/employees/EmployeeUi';

export default function EmployeeList(){
 const [searchInput,setSearchInput]=useState(''),[search,setSearch]=useState(''),[status,setStatus]=useState(''),[page,setPage]=useState(1),[revision,setRevision]=useState(0);
 useEffect(()=>{const timer=setTimeout(()=>{setSearch(searchInput);setPage(1);},350);return()=>clearTimeout(timer);},[searchInput]);
 const state=useRead('/employees?'+new URLSearchParams({page,limit:10,search,status}),revision),summary=useRead('/admin/dashboard',revision),stats=employeePayload(summary.data),rows=state.data?.data||[],meta=state.data?.meta;
 const refresh=()=>setRevision(n=>n+1);
 return <div className="ae-page"><EmployeeHeading title="Employees" description="Manage your enterprise workforce, roles and field operations." actions={<Link className="btn-primary" to="/admin/employees/add"><UserPlus size={17}/>Add Employee</Link>}/>
  {summary.error&&<p role="alert" className="ae-error">Employee counts unavailable. <button onClick={refresh}>Retry</button></p>}
  <section className="ae-metrics" aria-label="Employee directory totals"><EmployeeMetric label="Total Employees" value={stats?.totalEmployees} Icon={Users} tone="blue"/><EmployeeMetric label="Active" value={stats?.activeEmployees} Icon={Check} tone="green"/><EmployeeMetric label="Inactive" value={stats?.inactiveEmployees} Icon={Hourglass}/><EmployeeMetric label="Joined This Month" value={stats?.joinedThisMonth} Icon={CalendarDays} tone="purple"/></section>
  <section className="ae-panel ae-directory"><form className="ae-filters" onSubmit={e=>{e.preventDefault();setSearch(searchInput);setPage(1);}}><label className="ae-search"><Search size={17}/><input type="search" aria-label="Search employees" placeholder="Search by name, code, email or mobile…" maxLength={100} value={searchInput} onChange={e=>setSearchInput(e.target.value)}/></label><select aria-label="Employee status" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select><button className="btn-secondary" type="button" onClick={refresh}><RefreshCw size={15}/>Refresh</button></form>
  <p className="ae-note ae-search-help">Search matches the start of a name, code, email or mobile. Totals cover the full workforce.</p>
  {state.error?<div role="alert" className="ae-error">{state.error}<button onClick={refresh}>Retry</button></div>:<EmployeeTable employees={rows} loading={state.loading&&!state.data} refresh={refresh}/>}
  {state.loading&&state.data&&<LoadingIndicator message={"Refreshing employees…"} className="ae-note"/>}
  {meta&&<footer className="ae-pagination"><p>{meta.total?`${(page-1)*10+1}–${Math.min(page*10,meta.total)} of ${meta.total} employees`:'0 employees'}</p>{meta.totalPages>1&&<Pagination currentPage={page} totalPages={meta.totalPages} onPageChange={setPage}/>}</footer>}</section>
 </div>;
}
