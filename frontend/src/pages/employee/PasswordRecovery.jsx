import {LoadingButton} from "../../components/ui/Loading";
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BrandLogo from '../../components/BrandLogo';
import api from '../../services/api';

export default function PasswordRecovery({ reset = false, role = 'EMPLOYEE' }) {
  const navigate=useNavigate();
  const token = useRef(reset ? new URLSearchParams(window.location.hash.slice(1)).get('token') || '' : '');
  const inFlight = useRef(false);
  const [challenge,setChallenge] = useState('');
  const [code,setCode] = useState('');
  const collecting = reset || Boolean(challenge);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const validToken = /^[a-f0-9]{64}$/.test(token.current);

  useEffect(() => {
    if (reset && window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  }, [reset]);

  const generate = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const generated = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('') + 'Aa1!';
    setPassword(generated); setConfirmation(generated); setShow(true); setError('');
  };

  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    setError('');
    if (collecting && password !== confirmation) { setError('Passwords do not match.'); return; }
    inFlight.current = true; setBusy(true);
    try {
      const response = await api.post(`/auth/${role.toLowerCase()}/${reset ? 'reset-password' : challenge ? 'otp/reset' : 'otp/request'}`,
        reset ? { token: token.current, password, confirmPassword: confirmation } : challenge ? {challenge,code,password,confirmPassword:confirmation} : { email: email.trim() }, { timeout: 20000 });
      if(!collecting){setChallenge(response.data.data.challenge);setError('');return;}
      setSuccess(response.data.message);
      setPassword(''); setConfirmation('');
      if (reset) token.current = '';
      toast.success('Password updated. Sign in with your new password.');
      navigate(`/${role.toLowerCase()}/login`,{replace:true});
    } catch (failure) {
      setError(failure.response?.data?.errors?.[0]?.msg || failure.response?.data?.message || 'Cannot reach the server. Please check your connection and try again.');
    } finally { inFlight.current = false; setBusy(false); }
  }

  return <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
    <div className="w-full max-w-md space-y-6">
      <div className="mx-auto max-w-[15rem]"><BrandLogo variant="full" /></div>
      <section className="glass-panel p-5 sm:p-8 space-y-5" aria-labelledby="recovery-title">
        <h1 id="recovery-title" className="text-xl font-semibold">{collecting ? 'Set a new password' : 'Forgot your password?'}</h1>
        {success ? <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-900">{success}</p> : <>
          <p className="text-sm text-gray-600">{collecting ? 'Choose a new account password or generate a strong password below. Save it securely before signing in.' : 'Enter your registered account email. We’ll send a one-time code valid for 10 minutes.'}</p>
          {reset && !validToken ? <p role="alert" className="text-sm text-red-700">This reset link is missing or invalid. <Link className="underline" to="/employee/forgot-password">Request a new link</Link>.</p> :
            <form onSubmit={submit} className="space-y-4">
              {collecting ? <>
                {!reset&&<label className="block text-sm font-medium">Email OTP<input className="input-field" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label>}
                <label className="block text-sm font-medium" htmlFor="new-password">New password</label>
                <input id="new-password" className="input-field" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={64} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,64}" value={password} onChange={e => setPassword(e.target.value)} aria-describedby="password-rules" />
                <p id="password-rules" className="text-xs text-gray-600">12–64 characters, including uppercase, lowercase, a number and a symbol.</p>
                <label className="block text-sm font-medium" htmlFor="confirm-password">Confirm new password</label>
                <input id="confirm-password" className="input-field" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={64} value={confirmation} onChange={e => setConfirmation(e.target.value)} />
                <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />Show passwords</label>
                <button type="button" disabled={busy} onClick={generate} className="btn-secondary w-full">Generate strong password</button>
              </> : <>
                <label className="block text-sm font-medium" htmlFor="recovery-email">Registered email address</label>
                <input id="recovery-email" className="input-field" type="email" autoComplete="email" inputMode="email" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} />
              </>}
              {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <LoadingButton busy={busy} loadingText={collecting?"Resetting password…":"Sending verification code…"} className="btn-primary w-full" disabled={busy} type="submit">{busy ? 'Please wait…' : collecting ? 'Save new password' : 'Send OTP'}</LoadingButton>
            </form>}
        </>}
        <Link className="flex min-h-11 items-center justify-center text-sm text-amber-900 underline" to={`/${role.toLowerCase()}/login`}>Back to login</Link>
      </section>
    </div>
  </main>;
}
