import LoadingIndicator from "./ui/Loading";
import {useState} from 'react';
import {ConfirmDialog} from './ui/Primitives';
import EmployeeAvatar from './EmployeeAvatar';
import { Edit2, KeyRound, ShieldAlert, ShieldCheck, Eye,Phone,MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import {EmployeeStatus} from './employees/EmployeeUi';
import {employeeRowProps} from './employees/presentation';
import {businessDate} from '../utils/businessDate';

const EmployeeTable = ({ employees, loading, refresh }) => {
  const navigate = useNavigate();const [confirmation,setConfirmation]=useState(null),[working,setWorking]=useState(false);
  const toggleStatus=(id,status)=>setConfirmation({id,status,type:'status'});
  const resetPassword=id=>setConfirmation({id,type:'password'});

  const applyStatus = async (id, currentStatus) => {
    if (!id) {
      toast.error('Employee id is missing');
      return;
    }

    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.patch(`/employees/${id}/status`, { status: newStatus });
      toast.success(`Employee marked as ${newStatus}`);
      refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    }
  };

  const applyReset = async (id) => {
    if (!id) {
      toast.error('Employee id is missing');
      return;
    }

    try {
      const res = await api.patch(`/employees/${id}/reset-password`);
      const data = res.data.data || {};
      toast.success(`New password: ${data.temporaryPassword}`, { duration: 12000 });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    }
  };

  if(loading)return <LoadingIndicator message={"Loading employees…"} className="ae-empty"/>;
  if(!employees.length)return <div className="ae-empty">No employees match your search and status filter.</div>;
  const actions=emp=><div className="ae-row-actions"><button aria-label={'View '+emp.name} title="View Details" onClick={()=>navigate('/admin/employees/'+emp._id)}><Eye size={17}/></button><button aria-label={'Edit '+emp.name} title="Edit Employee" onClick={()=>navigate('/admin/employees/'+emp._id+'/edit')}><Edit2 size={16}/></button><button aria-label={(emp.status==='ACTIVE'?'Deactivate ':'Activate ')+emp.name} title={emp.status==='ACTIVE'?'Deactivate':'Activate'} onClick={()=>toggleStatus(emp._id,emp.status)}>{emp.status==='ACTIVE'?<ShieldAlert size={17}/>:<ShieldCheck size={17}/>}</button><button aria-label={'Reset password for '+emp.name} title="Reset Password" onClick={()=>resetPassword(emp._id)}><KeyRound size={17}/></button></div>;
  const identity=emp=><div className="ae-identity"><EmployeeAvatar employeeId={emp._id} name={emp.name} hasPhoto={emp.hasPhoto}/><div><strong>{emp.name}</strong><small>{emp.email}</small></div></div>;
  return <><div className="ae-employee-cards">{employees.map(emp=><article key={emp._id} {...employeeRowProps(emp,navigate)}><header>{identity(emp)}<EmployeeStatus status={emp.status}/></header><p>{emp.employeeCode} · <Phone size={13}/> {emp.phone}</p><p><MapPin size={13}/>{emp.city} · {emp.area}</p><footer><small>Joined {businessDate(emp.joiningDate)}</small>{actions(emp)}</footer></article>)}</div>
  <div className="ae-table-wrap ae-employee-table" role="region" aria-label="Employees table" tabIndex={0}><table><thead><tr>{['Emp. code','Employee','Contact','Location','Joining date','Status','Actions'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{employees.map(emp=><tr key={emp._id} {...employeeRowProps(emp,navigate)}><td>{emp.employeeCode}</td><td>{identity(emp)}</td><td>{emp.phone}</td><td>{emp.city}<small>{emp.area}</small></td><td>{businessDate(emp.joiningDate)}</td><td><EmployeeStatus status={emp.status}/></td><td>{actions(emp)}</td></tr>)}</tbody></table></div>{confirmation&&<ConfirmDialog title={confirmation.type==='status'?'Change employee access?':'Reset employee password?'} busy={working} onClose={()=>setConfirmation(null)} confirmLabel="Confirm change" onConfirm={async()=>{setWorking(true);try{if(confirmation.type==='status')await applyStatus(confirmation.id,confirmation.status);else await applyReset(confirmation.id);setConfirmation(null);}finally{setWorking(false);}}}><p className="text-sm">{confirmation.type==='status'?'This changes the employee’s ability to sign in. Financial dependencies are checked before deactivation; all historical attribution is retained.':'This invalidates the previous password and sessions. Continue only after verifying the employee’s identity. The existing one-time credential workflow will be used.'}</p></ConfirmDialog>}</>;
};
export default EmployeeTable;
