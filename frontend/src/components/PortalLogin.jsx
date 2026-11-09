import {LoadingButton} from "./ui/Loading";
import {useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {Lock,Mail,Eye,EyeOff,LogIn} from 'lucide-react';
import AuthShell from './AuthShell';
import api from '../services/api';
import {savePortalSession} from '../utils/portalSession';

export default function PortalLogin({role}){
 const admin=role==='ADMIN',base='/'+role.toLowerCase(),navigate=useNavigate();
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[remember,setRemember]=useState(false),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const inFlight=useRef(false);
 async function submit(event){
  event.preventDefault();if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');
  try{
   const response=await api.post('/auth'+base+'/login',{email:email.trim(),password},{timeout:15000});
   const session=response.data.data||response.data;
   if(!session.token||session.user?.role!==role)throw new Error('Invalid email or password for this portal.');
   savePortalSession(role,session,remember?window.localStorage:window.sessionStorage);
   setPassword('');navigate(base+'/dashboard',{replace:true});
  }catch(failure){setError(failure.response?.status===429?'Too many sign-in attempts. Please try again in 15 minutes.':!failure.response&&failure.isAxiosError?'Cannot reach the sign-in server. Check your connection and try again.':'Invalid email or password for this portal.');}
  finally{inFlight.current=false;setBusy(false);}
 }
 return <AuthShell role={admin?'Admin':'Employee'}><form className="portal-login-form" onSubmit={submit} aria-busy={busy}>
  <div className="login-input-wrap"><label className="login-accessible-label" htmlFor="login-email">Email address</label><Mail size={18} aria-hidden="true"/><input id="login-email" type="email" autoComplete="username" inputMode="email" enterKeyHint="next" required maxLength={254} className="input-field" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></div>
  <div className="login-input-wrap"><label className="login-accessible-label" htmlFor="login-password">Password</label><Lock size={18} aria-hidden="true"/><input id="login-password" type={show?'text':'password'} autoComplete="current-password" enterKeyHint="go" required maxLength={1000} className="input-field" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/><button type="button" className="password-toggle" aria-label={show?'Hide password':'Show password'} aria-pressed={show} onClick={()=>setShow(!show)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
  <div className="login-options"><label className="login-remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} disabled={busy}/>Remember me</label><Link className="login-forgot" to={base+'/forgot-password'}>Forgot password?</Link></div>
  {error&&<p className="login-error" role="alert">{error}</p>}
  <LoadingButton busy={busy} loadingText={"Signing in…"} className="btn-primary login-submit" type="submit" disabled={busy}><LogIn size={18} aria-hidden="true"/>{busy?'Signing in…':'Sign In'}</LoadingButton>
  {!admin&&<button type="button" disabled={busy} className="login-reset" onClick={()=>{setEmail('');setPassword('');setShow(false);setError('');}}>Reset</button>}
 </form></AuthShell>;
}
