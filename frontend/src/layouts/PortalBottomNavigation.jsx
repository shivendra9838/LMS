import {NavLink} from 'react-router-dom';
import ProfileAvatar from '../components/ProfileAvatar';

export default function PortalBottomNavigation({base,items,role,photo,name,keyboard}){
 return <nav className={`mobile-work-nav lg:hidden ${keyboard?'keyboard-open':''}`} aria-label="Daily work navigation">
  {items.map(([path,label,Icon])=><NavLink key={path} to={base+'/'+path} aria-label={label} className={({isActive})=>isActive?'is-active':''}>
   {role==='EMPLOYEE'&&path==='settings'?<ProfileAvatar src={photo} name={name} size={23}/>:<Icon size={20} aria-hidden="true"/>}
   <span>{path==='reconciliation'?'Settlement':path==='customers'?'Customers':role==='ADMIN'&&path==='collections'?'Collections':label.replace('Daily ','')}</span>
  </NavLink>)}
 </nav>;
}
