import LoadingIndicator, {LoadingButton} from "../../components/ui/Loading";
import { useRef, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { User, Save, Mail } from 'lucide-react';
import { EmployeeHeading, EmployeePanel, EmployeeFields } from '../../components/employees/EmployeeUi';
import { employeeErrors } from '../../components/employees/presentation';

const EditEmployee = () => {
  const lock = useRef(false);
  const [errors, setErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingEmail, setPendingEmail] = useState(null);
  const [resending, setResending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    area: '',
    status: 'ACTIVE'
  });

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await api.get(`/employees/${id}`);
        const emp = res.data.data;
        setFormData({
          name: emp.name || '',
          email: emp.email || '',
          phone: emp.phone || '',
          city: emp.city || '',
          area: emp.area || '',
          status: emp.status || 'ACTIVE'
        });
        setPendingEmail(emp.pendingEmail || emp.emailVerification?.pendingEmail || null);
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

  const handleResendVerification = async () => {
    setResending(true);
    try {
      await api.post(`/employees/${id}/resend-verification`);
      toast.success('Verification link resent successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resend verification link');
    } finally {
      setResending(false);
    }
  };

  const handleCancelEmailChange = async () => {
    setCancelling(true);
    try {
      await api.post(`/employees/${id}/cancel-email-change`);
      toast.success('Pending email change cancelled');
      setPendingEmail(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel email change');
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    const invalid = employeeErrors(formData, true);
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    lock.current = true;
    setErrorMessage('');
    setSaving(true);
    try {
      const res = await api.put(`/employees/${id}`, formData);
      if (res.data?.emailChangePending) {
        toast.success(res.data.message || 'Employee updated. Verification email sent to new address.');
      } else {
        toast.success('Employee updated successfully');
      }
      navigate('/admin/employees');
    } catch (error) {
      const message = error.response?.data?.errors?.map(e => e.msg).filter(Boolean).join(' · ') || error.response?.data?.message || 'Failed to update employee';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  if (loading) return <LoadingIndicator message={"Loading employee…"} className="ae-page" />;
  return (
    <div className="ae-page ae-form-page">
      <EmployeeHeading back title="Edit Employee" description="Update authorized employment details. Identity codes and financial history are preserved." />
      <EmployeePanel title="Employee Information" Icon={User}>
        {errorMessage && <p role="alert" className="ae-error">{errorMessage}</p>}
        {pendingEmail && (
          <div className="ae-pending-banner" style={{
            background: 'rgba(212, 175, 55, 0.08)',
            border: '1px solid rgba(212, 175, 55, 0.35)',
            borderRadius: '8px',
            padding: '14px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Mail size={18} style={{ color: 'var(--gold, #d4af37)', flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--gold, #d4af37)', fontSize: '0.9rem' }}>
                  Pending Email Verification
                </p>
                <p style={{ margin: 0, fontSize: '0.825rem', color: '#94a3b8' }}>
                  Verification link sent to <strong style={{ color: '#fff' }}>{pendingEmail}</strong>. Current address remains active until verified.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                disabled={resending || cancelling}
                onClick={handleResendVerification}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                {resending ? 'Sending…' : 'Resend link'}
              </button>
              <button
                type="button"
                disabled={resending || cancelling}
                onClick={handleCancelEmailChange}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 12px', borderColor: '#ef4444', color: '#ef4444' }}
              >
                {cancelling ? 'Cancelling…' : 'Cancel change'}
              </button>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <EmployeeFields value={formData} onChange={handleChange} errors={errors} editing allowEmail busy={saving} />
          <div className="ae-form-actions">
            <button type="button" disabled={saving} className="btn-secondary" onClick={() => navigate('/admin/employees')}>Cancel</button>
            <LoadingButton busy={saving} loadingText={"Saving…"} className="btn-primary" disabled={saving}>
              <Save size={17} />{saving ? 'Saving…' : 'Save Changes'}
            </LoadingButton>
          </div>
        </form>
      </EmployeePanel>
    </div>
  );
};
export default EditEmployee;
