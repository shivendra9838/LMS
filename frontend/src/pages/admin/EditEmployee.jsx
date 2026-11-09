import LoadingIndicator, {LoadingButton} from "../../components/ui/Loading";
import { useRef,useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import {User,Save} from 'lucide-react';
import {EmployeeHeading,EmployeePanel,EmployeeFields} from '../../components/employees/EmployeeUi';
import {employeeErrors} from '../../components/employees/presentation';

const EditEmployee = () => {
  const lock=useRef(false),[errors,setErrors]=useState({}),[errorMessage,setErrorMessage]=useState('');
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    city: '',
    area: '',
    status: 'ACTIVE'
  });

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await api.get(`/employees/${id}`);
        setFormData({
          name: res.data.data.name,
          phone: res.data.data.phone,
          city: res.data.data.city,
          area: res.data.data.area,
          status: res.data.data.status
        });
      } catch (error) {
        toast.error('Failed to load employee details');
        navigate('/admin/employees');
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [id, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(lock.current)return;const invalid=employeeErrors(formData,true);setErrors(invalid);if(Object.keys(invalid).length)return;lock.current=true;setErrorMessage('');
    setSaving(true);
    try {
      await api.put(`/employees/${id}`, formData);
      toast.success('Employee updated successfully');
      navigate('/admin/employees');
    } catch (error) {
      const message=error.response?.data?.errors?.map(e=>e.msg).filter(Boolean).join(' · ')||error.response?.data?.message||'Failed to update employee';setErrorMessage(message);toast.error(message);
    } finally {
      lock.current=false;setSaving(false);
    }
  };

  if(loading)return <LoadingIndicator message={"Loading employee…"} className="ae-page"/>;
  return <div className="ae-page ae-form-page"><EmployeeHeading back title="Edit Employee" description="Update authorized employment details. Identity codes and financial history are preserved."/><EmployeePanel title="Employee Information" Icon={User}>{errorMessage&&<p role="alert" className="ae-error">{errorMessage}</p>}<form onSubmit={handleSubmit}><EmployeeFields value={formData} onChange={handleChange} errors={errors} editing busy={saving}/><div className="ae-form-actions"><button type="button" disabled={saving} className="btn-secondary" onClick={()=>navigate('/admin/employees')}>Cancel</button><LoadingButton busy={saving} loadingText={"Saving…"} className="btn-primary" disabled={saving}><Save size={17}/>{saving?'Saving…':'Save Changes'}</LoadingButton></div></form></EmployeePanel></div>;
};
export default EditEmployee;
