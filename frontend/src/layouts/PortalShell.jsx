import ProfileAvatar from '../components/ProfileAvatar';
import PortalBottomNavigation from './PortalBottomNavigation';
import './admin-mobile-shell.css';
import {createContext,useContext,useState,useEffect,useCallback,Suspense} from 'react';
import {Outlet,NavLink,Link,useNavigate,useLocation} from 'react-router-dom';
import {LayoutDashboard,Users,Wallet,Settings,FileCheck,Building2,Bell,Menu,X,LogOut,ChevronDown} from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import BrandLogo from '../components/BrandLogo';
import './admin-portal-polish.css';
import '../components/employees/employees.css';
import '../components/requests/customer-requests.css';
import '../components/customers/admin-customers.css';
import '../components/customers/admin-customer-details.css';
import '../components/reconciliation/reconciliation.css';
import '../components/admin-loans/admin-loans.css';
import '../components/collections/admin-collections.css';
import './employee-mobile-shell.css';
import {Skeleton} from '../components/ui/Primitives';
import usePortalSession from '../hooks/usePortalSession';
import useMobileNavigation from '../hooks/useMobileNavigation';
import {clearPortalSession} from '../utils/portalSession';
import api from '../services/api';
const AccountContext=createContext(null);
export const useAccount=()=>useContext(AccountContext);
const employeeLinks=[['dashboard','Dashboard',LayoutDashboard],['customers','My Customers',Users],['customers/kyc','Customer KYC',FileCheck],['loans','My Loans',Wallet],['collections/today','Collections',Wallet],['follow-ups','Overdue Follow-ups',Bell],['settlements','Daily Settlement',Building2],['settings','Settings',Settings]];
const adminLinks=[['dashboard','Dashboard',LayoutDashboard],['employees','Employees',Users],['customers','Customers',Users],['customers/requests','Customer Approvals',FileCheck],['loans','Loans',Wallet],['collections','Collections & Installments',Wallet],['notifications','Missed Payments',Bell],['follow-ups','Overdue Follow-ups',Bell],['reconciliation','Daily Reconciliation',Building2],['settings','Settings',Settings]];
export default function PortalShell({role}){
 const base='/'+role.toLowerCase(),session=usePortalSession(role),navigate=useNavigate(),location=useLocation();
 const [menuOpen,setMenuOpen]=useState(false),[account,setAccount]=useState(null),[photo,setPhoto]=useState(''),[keyboard,setKeyboard]=useState(false);
 const close=useCallback(()=>setMenuOpen(false),[]),navigationRef=useMobileNavigation(menuOpen,close,role==='ADMIN');
 const refreshAccount=useCallback(async()=>{const response=await api.get('/settings/me');setAccount(response.data.data);},[]);
 const authorized=Boolean(session?.token&&session?.user?.role===role);
 useEffect(()=>{if(!authorized){navigate(base+'/login',{replace:true});return;}refreshAccount().catch(()=>{});},[authorized,base,navigate,refreshAccount]);
 useEffect(()=>{const prefs=account?.preferences||{};const mq=window.matchMedia('(prefers-color-scheme: dark)');const apply=()=>{document.documentElement.dataset.theme=prefs.appearance==='system'?(mq.matches?'dark':'light'):prefs.appearance||'light';document.documentElement.dataset.textSize=prefs.textSize||'normal';document.documentElement.dataset.dateFormat=prefs.dateFormat||'DD/MM/YYYY';document.documentElement.dataset.notifications=String(prefs.notifications!==false);};apply();mq.addEventListener('change',apply);return()=>{mq.removeEventListener('change',apply);delete document.documentElement.dataset.theme;delete document.documentElement.dataset.textSize;delete document.documentElement.dataset.dateFormat;delete document.documentElement.dataset.notifications;};},[account]);
 useEffect(()=>{if(!account?.photo){setPhoto('');return;}setPhoto('');let url,active=true;const controller=new AbortController();api.get('/settings/photo',{responseType:'blob',signal:controller.signal}).then(r=>{if(active){url=URL.createObjectURL(r.data);setPhoto(url);}}).catch(()=>{});return()=>{active=false;controller.abort();if(url)URL.revokeObjectURL(url);};},[account?.photo?.updatedAt]);
 useEffect(()=>{const viewport=window.visualViewport;const update=()=>setKeyboard(Boolean(viewport&&window.innerHeight-viewport.height>150));viewport?.addEventListener('resize',update);return()=>viewport?.removeEventListener('resize',update);},[]);
 useEffect(()=>setMenuOpen(false),[location.pathname]);
 const logout=()=>{clearPortalSession(role);navigate(base+'/login');};
 if(!authorized)return null;
 const links=role==='ADMIN'?adminLinks:employeeLinks,bottom=role==='EMPLOYEE'?employeeLinks.filter(([path])=>['dashboard','customers','collections/today','settlements','settings'].includes(path)):adminLinks.filter(([path])=>['dashboard','customers','collections','reconciliation','settings'].includes(path));
 const customerDirectory=role==='EMPLOYEE'&&location.pathname===base+'/customers';
 const directories=role==='EMPLOYEE'&&[base+'/customers/risk',base+'/customers/kyc'].includes(location.pathname);
 const avatar=role==='EMPLOYEE'?<ProfileAvatar src={photo} name={account?.profile?.name||session.user.name} className="account-avatar"/>:<span className="account-avatar">{photo?<img src={photo} width="40" height="40" alt="Your profile" className="object-contain"/>:<span>{(account?.profile?.name||session.user.name||'R').charAt(0)}</span>}</span>;
 return <AccountContext.Provider value={{account,refreshAccount,photo}}><div className={`portal-shell ${role==='ADMIN'?'admin-portal-shell ':''}${role==='EMPLOYEE'?'employee-mobile-shell ':role==='ADMIN'&&location.pathname===base+'/customers/requests'?'admin-employees-shell admin-requests-shell ':role==='ADMIN'&&(/^\/admin\/customers\/[a-f\d]{24}$/i).test(location.pathname)?'admin-customer-detail-shell ':role==='ADMIN'&&(/^\/admin\/customers(?:$|\/add$|\/all$|\/unassigned$|\/employees\/)/).test(location.pathname)?'admin-employees-shell admin-customers-shell ':role==='ADMIN'&&location.pathname.startsWith(base+'/employees')?'admin-employees-shell ':''}${role==='ADMIN'&&[base+'/loans',base+'/collections'].includes(location.pathname)?'admin-loans-shell '+(location.pathname===base+'/collections'?'admin-collections-shell ':''):''}${role==='ADMIN'&&location.pathname===base+'/notifications'?'admin-missed-shell ':''}${role==='ADMIN'&&location.pathname===base+'/reconciliation'?'admin-reconciliation-shell ':''}${role==='EMPLOYEE'&&location.pathname===base+'/settings'?'employee-settings-shell ':''}${location.pathname===base+'/dashboard'?(role==='ADMIN'?'admin-dashboard-shell':'employee-dashboard-shell'):customerDirectory?'employee-customers-shell':directories?'employee-directories-shell':''}`}>
  <a href="#portal-main" className="skip-link">Skip to content</a>
  {menuOpen&&<button className="navigation-backdrop lg:hidden" aria-label="Close navigation" onClick={close}/>}
  <aside ref={navigationRef} id="portal-navigation" role={menuOpen?'dialog':undefined} aria-modal={menuOpen||undefined} aria-label="Main navigation" className={`portal-sidebar ${menuOpen?'is-open':''}`}><div className="sidebar-brand"><BrandLogo className={role==='ADMIN'?'admin-sidebar-logo':''}/><button className="icon-button lg:hidden" aria-label="Close menu" onClick={close}><X size={20}/></button></div><p className="sidebar-caption">{role==='ADMIN'?'Management workspace':'Employee workspace'}</p><nav className="sidebar-links" onClick={close}>{links.map(([path,label,Icon])=><NavLink key={path} to={base+'/'+path} end={path==='customers'} className={({isActive})=>isActive?'is-active':''}><Icon size={19}/><span>{label}</span></NavLink>)}</nav><div className="sidebar-footer"><span className="security-dot"/>Secure workspace · INR<button onClick={logout}><LogOut size={17}/>Sign out</button></div></aside>
  <div className="portal-workspace" inert={menuOpen||undefined}><header className="portal-header">{role==='ADMIN'&&<button className="icon-button admin-menu-trigger lg:hidden" aria-label="Open menu" aria-controls="portal-navigation" aria-expanded={menuOpen} onClick={()=>setMenuOpen(true)}><Menu size={21}/></button>}<div className="portal-mobile-brand lg:hidden"><BrandLogo variant="header" className={(role==='ADMIN'?'admin-mobile-brand ':'employee-mobile-brand ')+(directories?'employee-directories-mobile-brand':customerDirectory?'employee-customers-mobile-brand':role==='EMPLOYEE'&&location.pathname===base+'/dashboard'?'employee-dashboard-mobile-brand':'')}/></div><div className="hidden lg:block"><p className="eyebrow">{role==='ADMIN'?'Admin portal':'Employee portal'}</p><p className="header-page">{location.pathname===base+'/inbox'?'Notifications':location.pathname===base+'/customers/risk'?'Customer Repayment Risk':links.filter(([path])=>location.pathname.startsWith(base+'/'+path)).sort((a,b)=>b[0].length-a[0].length)[0]?.[1]||'Account details'}</p></div><span className="header-business hidden sm:inline">A tradition of trust</span><div className="header-actions"><NotificationBell role={role} token={session.token}/><details className="profile-menu"><summary aria-label="Account menu">{avatar}<span className="hidden sm:block text-left"><strong>{account?.profile?.name||session.user.name}</strong><small>{role==='ADMIN'?'Administrator':account?.profile?.employeeCode||'Employee'}</small></span><ChevronDown size={15}/></summary><div className="profile-popover" onClick={e=>e.currentTarget.parentElement.removeAttribute('open')}><Link to={base+'/settings'}>My profile & Settings</Link><Link to={base+'/settings?section=security'}>Account security</Link><button onClick={logout}>Sign out</button></div></details>{role!=='ADMIN'&&<button className="icon-button lg:hidden" aria-label="Open menu" aria-controls="portal-navigation" aria-expanded={menuOpen} onClick={()=>setMenuOpen(true)}><Menu size={21}/></button>}</div></header>
  <main id="portal-main" className="portal-content" tabIndex={-1}><Suspense fallback={<Skeleton/>}><Outlet key={location.state?.notification||'page'}/></Suspense></main>
  <PortalBottomNavigation base={base} items={bottom} role={role} photo={photo} name={account?.profile?.name||session.user.name} keyboard={keyboard}/></div>
 </div></AccountContext.Provider>;
}




