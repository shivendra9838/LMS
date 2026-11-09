import {useEffect,useState} from 'react';
import ProfileAvatar from '../ProfileAvatar';
import api from '../../services/api';

// Private employee photos use the existing authenticated endpoint, never public URLs.
export default function EmployeeDashboardAvatar({employee}) {
  const [src,setSrc]=useState('');
  useEffect(()=>{
    if(!employee.hasPhoto)return;
    const controller=new AbortController();let url;
    api.get('/settings/employees/'+employee._id+'/photo',{responseType:'blob',signal:controller.signal})
      .then(response=>{if(!controller.signal.aborted){url=URL.createObjectURL(response.data);setSrc(url);}}).catch(()=>{});
    return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};
  },[employee._id,employee.hasPhoto]);
  return <ProfileAvatar src={employee.hasPhoto?src:''} name={employee.name} size={36} alt={employee.name+' profile'}/>;
}
