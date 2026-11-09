import {Crown, Users, ShieldCheck} from 'lucide-react';
import BrandLogo from './BrandLogo';
import employeeBackground from '../assets/branding/royal-employee-office.webp';
import adminBackground from '../assets/branding/royal-admin-office.webp';
import './auth-shell.css';

export default function AuthShell({role,children}) {
 const admin=role==='Admin',Icon=admin?Crown:Users;
 return <div className={`luxury-auth luxury-auth--${admin?'admin':'employee'}`} style={{'--auth-background':`url("${admin?adminBackground:employeeBackground}")`}}>
  <div className="luxury-background" aria-hidden="true"/>
  <main className="luxury-main">
   <div className="luxury-introduction">
    <header className="luxury-brand"><BrandLogo variant="full" className="luxury-logo"/></header>
    <section className="luxury-intro" aria-label={`${role} login introduction`}>
     <p className="luxury-eyebrow">{admin?'Admin':'Employee'} portal</p>
     <h1>{admin?'Administrator':'Employee'} <span>Login</span></h1>
     <p>{admin?'Sign in to manage users, customers, loans, collections and system settings.':'Sign in to manage your assigned customers, collections and daily activities.'}</p>
    </section>
   </div>
   <section className="luxury-card" aria-label={`${role} sign in`}>
    <header className="login-card-header"><span className="login-portal-icon"><Icon size={25} aria-hidden="true"/></span><div><h2>{admin?'Administrator Portal':'Employee Portal'}</h2><p>{admin?'Access full system control and management':'Access your collection and customer workspace'}</p></div></header>
    {children}
   </section>
  </main>
  <footer className="luxury-security"><ShieldCheck size={14} aria-hidden="true"/>Private access · Authorized personnel only</footer>
 </div>;
}
