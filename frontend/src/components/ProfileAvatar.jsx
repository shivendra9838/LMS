import {useState} from 'react';
import './profile-avatar.css';
export const avatarInitials=name=>String(name||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase()||'RE';
export default function ProfileAvatar({src,name,size=40,className='',alt='Your profile',onImageError,onImageLoad}){const [failed,setFailed]=useState('');return <span className={'profile-avatar '+className} style={{'--avatar-size':size+'px',borderRadius:'50%'}} role="img" aria-label={alt}>{src&&src!==failed?<img src={src} alt="" width={size} height={size} onLoad={onImageLoad} onError={()=>{setFailed(src);onImageError?.();}}/>:<span aria-hidden="true">{avatarInitials(name)}</span>}</span>;}
