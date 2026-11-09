import {LoadingButton} from "../../components/ui/Loading";
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import {UserPlus,User} from 'lucide-react';
import {EmployeeHeading,EmployeePanel,EmployeeFields} from '../../components/employees/EmployeeUi';
import {employeeErrors} from '../../components/employees/presentation';
import {businessDay} from '../../utils/businessDate';

const AddEmployee = () => {
  const navigate = useNavigate();
  const lock=useRef(false),[errors,setErrors]=useState({});
  const [loading, setLoading] = useState(false);
  const [createdEmployee, setCreatedEmployee] = useState(null);
  const [formErrors, setFormErrors] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    area: '',
    joiningDate: businessDay()
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(lock.current||createdEmployee)return;const invalid=employeeErrors(formData);setErrors(invalid);if(Object.keys(invalid).length)return;lock.current=true;
    setLoading(true);
    setFormErrors([]);
    try {
      const res = await api.post('/employees', formData);
      const responseData = res.data.data || {};
      setCreatedEmployee({
        ...responseData.employee,
        temporaryPassword: responseData.temporaryPassword
      });
      toast.success('Employee created successfully');
    } catch (error) {
      const errors = error.response?.data?.errors || [];
      const messages = errors.map((err) => err.msg || err.message).filter(Boolean);

      setFormErrors(messages.length?messages:[error.response?.data?.message||'Failed to create employee']);
      toast.error(messages[0] || error.response?.data?.message || 'Failed to create employee');
    } finally {
      lock.current=false;setLoading(false);
    }
  };

  return <div className="ae-page ae-form-page"><EmployeeHeading back title="Add New Employee" description="Enter details to onboard a new team member."/>
    {createdEmployee?<EmployeePanel title="Employee login created" Icon={UserPlus}><p className="ae-note">Store this one-time login information securely and share it only with this employee.</p><dl className="ae-info"><div><dt>Email</dt><dd>{createdEmployee.email}</dd></div><div><dt>Temporary Password</dt><dd>{createdEmployee.temporaryPassword}</dd></div></dl><div className="ae-form-actions"><button className="btn-primary" onClick={()=>navigate('/admin/employees')}>Done</button></div></EmployeePanel>:<EmployeePanel title="Employee Information" Icon={User}>
    {formErrors.length>0&&<div role="alert" className="ae-error">{formErrors.map(message=><p key={message}>{message}</p>)}</div>}
    <form onSubmit={handleSubmit}><EmployeeFields value={formData} onChange={handleChange} errors={errors} busy={loading}/><div className="ae-form-actions"><button type="button" disabled={loading} className="btn-secondary" onClick={()=>navigate('/admin/employees')}>Cancel</button><LoadingButton busy={loading} loadingText={"Creating…"} type="submit" disabled={loading} className="btn-primary"><UserPlus size={17}/>{loading?'Creating…':'Add Employee'}</LoadingButton></div></form></EmployeePanel>}
  </div>;
};
export default AddEmployee;
