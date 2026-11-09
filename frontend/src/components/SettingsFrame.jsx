import {useEffect,useRef} from 'react';
import {Settings,ChevronRight,ArrowLeft} from 'lucide-react';
import './settings-frame.css';

export default function SettingsFrame({admin=false,sections,section,mobileDetail,onSection,children}){
 const content=useRef(null),previous=useRef(section);
 useEffect(()=>{if(previous.current!==section&&mobileDetail&&window.matchMedia('(max-width:767px)').matches)content.current?.focus({preventScroll:true});previous.current=section;},[section,mobileDetail]);
 return <div className={'royal-settings '+(admin?'admin-settings-page':'employee-settings')+(mobileDetail?' settings-detail':' settings-menu')}>
  <header className="settings-page-title"><Settings size={32} aria-hidden="true"/><div><h1>Settings</h1><p>{admin?'Manage your profile, security, employees and company preferences.':'Your profile, security and everyday work preferences.'}</p></div></header>
  <div className="settings-layout"><nav className="settings-nav" aria-label="Settings sections">{sections.map(([id,label,Icon])=><button type="button" key={id} aria-current={section===id?'page':undefined} onClick={()=>onSection(id)}><Icon size={17} aria-hidden="true"/><span>{label}</span><ChevronRight className="settings-section-chevron" size={16} aria-hidden="true"/></button>)}</nav>
   <div ref={content} className="settings-content" tabIndex={-1}><button type="button" className="settings-mobile-back" onClick={()=>onSection('')}><ArrowLeft size={17}/>Back to Settings</button>{children}</div>
  </div>
 </div>;
}
