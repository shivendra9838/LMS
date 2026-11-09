import LoadingIndicator from "../../components/ui/Loading";
import { useState, useEffect, useRef } from 'react';
import {ArrowLeft,UserPlus} from 'lucide-react';
import {validateCustomerFields} from '../../components/customers/customerFields';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import CustomerForm from '../../components/CustomerForm';

const AddCustomer = () => {
  const navigate = useNavigate();
  const submitting=useRef(false);
  const [errors,setErrors]=useState({});
  const [employeeError,setEmployeeError]=useState('');
  const [employeesLoading,setEmployeesLoading]=useState(true);
  const [retry,setRetry]=useState(0);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    mobile: '',
    alternateMobile: '',
    age: '',
    gender: 'Male',
    occupation: '',
    address: '',
    city: '',
    area: '',
    landmark: '',
    idProofType: 'Aadhar',
    idProofNumber: '',
    employeeId: ''
  });

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        setEmployeeError('');setEmployeesLoading(true);
        const res = await api.get('/employees?limit=200&status=ACTIVE');
        setEmployees(res.data.data || []);
      } catch {
        setEmployeeError('Unable to load eligible employees. Retry before adding a customer.');
      } finally {setEmployeesLoading(false);}
    };
    loadEmployees();
  }, [retry]);

  const handleChange = (e) => {
    setFormData(previous=>({ ...previous, [e.target.name]: e.target.value }));
    setErrors(previous=>({...previous,[e.target.name]:''}));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(submitting.current)return;
    const validation=validateCustomerFields(formData);setErrors(validation);
    if(Object.keys(validation).length){requestAnimationFrame(()=>document.getElementById('customer-'+Object.keys(validation)[0])?.focus());return;}
    submitting.current=true;
    setLoading(true);
    try {
      const response=await api.post('/customers', {
        ...formData,
        age: parseInt(formData.age, 10)
      });
      toast.success('Customer created and allocated successfully');
      navigate(response.data.data?._id?`/admin/customers/${response.data.data._id}`:`/admin/customers/employees/${formData.employeeId}`);
    } catch (error) {
      if (error.response?.data?.errors?.length) {
        const fields={};error.response.data.errors.forEach(err=>{if(err.path||err.param)fields[err.path||err.param]=err.msg||err.message;});setErrors(fields);
        toast.error(error.response.data.message||'Check the highlighted customer details.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to create customer');
      }
    } finally {
      submitting.current=false;
      setLoading(false);
    }
  };

  return (
    <div className="ae-page ac-page max-w-6xl mx-auto">
      <header className="ae-heading"><div><Link className="ae-back" to="/admin/customers"><ArrowLeft size={17}/>Customers</Link><h1><UserPlus size={25}/>Add Customer</h1><p>Create a new customer and assign them to an active employee.</p></div></header>
      {employeeError?<div role="alert" className="ac-alert">{employeeError}<button className="btn-secondary" onClick={()=>setRetry(n=>n+1)}>Retry employees</button></div>:(employeesLoading?<LoadingIndicator message={"Loading active employees…"}/>:!employees.length&&<p role="status">No active employees are available. Add or activate an employee in Admin → Employees before adding a customer.</p>)}
      <div>
        <CustomerForm
          premium
          errors={errors}
          formData={formData}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          loading={loading}
          isEdit={false}
          basePath="/admin/customers"
          showEmployeeSelect
          employees={employees}
        />
      </div>
    </div>
  );
};

export default AddCustomer;
