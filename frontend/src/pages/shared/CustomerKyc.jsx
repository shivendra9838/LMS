import KycSignature from '../../components/kyc/KycSignature';
import {Skeleton} from '../../components/ui/Primitives';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import KycEditorView,{KycDocumentPreview,KycLeaveDialog,documentDefinitions,kycPdfPath} from '../../components/kyc/KycFormUi';
import useKycNavigationGuard from '../../hooks/useKycNavigationGuard';
import KycApplication from '../../components/KycApplication';
import { printPdf } from '../../components/KycPdfPreview';
import {ProcessingOverlay} from '../../components/ui/Loading';
import KycVerification,{showKycSubmitted} from '../../components/kyc/KycVerification';
import {useCollectionRefresh} from '../../hooks/useCollectionRefresh';

export default function CustomerKyc() {
  const { id, customerId } = useParams();
  const navigate = useNavigate();
  const [viewParams,setViewParams]=useSearchParams();
  const admin = window.location.pathname.startsWith('/admin');
  const base = admin ? '/admin' : '/employee';
  const [record, setRecord] = useState(null);
  const [data, setData] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [loading, setLoading] = useState(Boolean(id || customerId));
  const [fatal, setFatal] = useState('');
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [reason, setReason] = useState('');
  const [signature,setSignature]=useState(null),[signatureConfirmed,setSignatureConfirmed]=useState(false),[signer,setSigner]=useState(null);
  useEffect(()=>{let active=true;api.get('/settings/me').then(res=>{if(active)setSigner(res.data.data.profile);}).catch(()=>{});return()=>{active=false;};},[]);
  const [preview, setPreview] = useState(null);
  const [application, setApplication] = useState(false);
  const [snapshot, setSnapshot] = useState(false);
  const dirty = useRef(false),inFlight=useRef(false),recordRef=useRef(null),pendingRoute=useRef('');
  const [uploadState,setUploadState]=useState(null);
  const [revision]=useCollectionRefresh(admin?'ADMIN':'EMPLOYEE',!admin&&Boolean(id||customerId));
  const navigationGuard=useKycNavigationGuard(dirty,inFlight);
  function begin(){if(inFlight.current)return false;inFlight.current=true;setBusy(true);return true;}
  function finish(){inFlight.current=false;setBusy(false);setSubmitting(false);if(pendingRoute.current){const path=pendingRoute.current;pendingRoute.current='';navigate(path,{replace:true});}}
  const editable = !admin && !snapshot && (!record || record.status==='DRAFT'||(['CORRECTION_REQUIRED','REJECTED'].includes(record.status)&&viewParams.get('view')==='edit'));
  const values = snapshot ? record?.approvedData || {} : data;

  function apply(next,preserveErrors=false) { recordRef.current=next; setRecord(next); setData(next.data); if(!preserveErrors)setErrors({}); dirty.current = false; }
  useEffect(() => {
    if(inFlight.current||dirty.current)return;
    if(!revision&&id&&String(recordRef.current?._id)===id)return;
    let active = true;const background=Boolean(recordRef.current&&((id&&id===String(recordRef.current._id))||(customerId&&customerId===String(recordRef.current.customerId?._id||recordRef.current.customerId))));if(!background)setLoading(Boolean(id||customerId));setFatal('');
    async function load() {
      try {
        if (id || customerId) {
          const res = await api.get(customerId ? `/kyc/customer/${customerId}` : `/kyc/${id}`);
          if (!active||inFlight.current||dirty.current) return;
          if (res.data.data) { apply(res.data.data,background); if(!background)setEmployeeId(res.data.data.assignedEmployeeId || ''); }
          else if (!admin) {
            const profile = await api.get(`/customers/${customerId}`);
            if (active) setData({ ...profile.data.data, idProofNumber: '', declarationAccepted: false });
          }
        }
        if (admin) {
          const res = await api.get('/employees?limit=200&status=ACTIVE');
          if (active) setEmployees(res.data.data || []);
        }
      } catch (err) { if (active&&!background) setFatal(err.response?.data?.message || 'Unable to load KYC'); }
      finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [id, customerId, admin,revision]);
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);

  function report(err) {
    const fields = {};
    for (const item of err.response?.data?.errors || []) fields[item.path] = item.msg || item.message;
    setErrors(fields);
    const first = Object.keys(fields)[0];
    if (first) toast.error('Review the highlighted KYC fields.');
    toast.error(err.response?.data?.message || 'KYC action failed');
  }
  async function persist() {
    const res = record
      ? await api.put(`/kyc/${record._id}`, { data, version: record.version })
      : await api.post('/kyc', { data, customerId });
    apply(res.data.data);
    if (!record && !customerId) pendingRoute.current=`${base}/customers/kyc/${res.data.data._id}`;
    return res.data.data;
  }
  async function uploadVerification(saved){
    const form=new FormData();form.append('file',signature,'verification-signature.'+(signature.type==='image/jpeg'?'jpg':signature.type==='image/webp'?'webp':'png'));form.append('version',saved.version);
    const res=await api.post(`/kyc/${saved._id}/verification-signatures`,form);return res.data.data._id;
  }
  async function save(submit = false) {
    if(submit&&(!signature||!signatureConfirmed)){toast.error('Provide your employee verification signature and confirmation.');return;}
    if(!begin())return;
    setSubmitting(submit);
    try {
      const saved = await persist();
      if (submit) {
        const signatureId=await uploadVerification(saved);
        const res = await api.post(`/kyc/${saved._id}/submit`, { version: saved.version,signatureId,confirmed:signatureConfirmed });
        apply(res.data.data);
        if(!admin){pendingRoute.current='/employee/customers/kyc';showKycSubmitted(saved._id);return;}
      }
      toast.success(submit ? 'KYC submitted for admin approval' : 'KYC draft saved');
    } catch (err) { report(err); } finally { finish(); }
  }
  async function upload(kind, file) {
    if (!file) return;
    if(!documentDefinitions[kind]||!(['PHOTO','SIGNATURE'].includes(kind)?['image/jpeg','image/png']:['image/jpeg','image/png','application/pdf']).includes(file.type)){setUploadState({kind,name:file.name,progress:0,error:'Choose a JPEG, PNG or permitted PDF document'});toast.error('Choose a JPEG, PNG or permitted PDF document');return;}
    if (file.size > 2 * 1024 * 1024) { setUploadState({kind,name:file.name,progress:0,error:'Choose a file up to 2 MB'});toast.error('Choose a file up to 2 MB'); return; }
    if(!begin())return;
    try {
      setUploadState({kind,name:file.name,progress:0});
      const saved = await persist();
      const form = new FormData(); form.append('file', file); form.append('kind', kind); form.append('version', saved.version);
      const res = await api.post(`/kyc/${saved._id}/documents`, form,{onUploadProgress:e=>setUploadState({kind,name:file.name,progress:e.total?Math.min(90,Math.round(e.loaded/e.total*90)):0})});
      apply(res.data.data);setUploadState({kind,name:file.name,progress:100}); toast.success('Document securely uploaded');
    } catch (err) {setUploadState({kind,name:file.name,progress:0,error:err.response?.data?.message||'Unable to upload document. Please retry.'}); report(err); } finally { finish(); }
  }
  async function openDocument(doc) {
    if(!begin())return;
    try {
      const res = await api.get(`/kyc/${record._id}/documents/${doc._id}`, { responseType: 'blob' });
      setPreview({ url: URL.createObjectURL(new Blob([res.data], { type: doc.mime })), mime: doc.mime, kind: doc.kind });
    } catch { toast.error('Unable to preview document'); } finally { finish(); }
  }
  async function download(print = false, applicationForm = false) {
    if(!begin())return;
    const popup = print ? window.open('', '_blank') : null;
    try {
      const res = await api.get(kycPdfPath(record,snapshot,applicationForm), { responseType: 'blob' });
      if (print && popup) {
        await printPdf(new Uint8Array(await res.data.arrayBuffer()), popup);
      } else {
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const link = document.createElement('a'); link.href = url; link.download = `${applicationForm ? 'customer-application' : 'customer-kyc'}-${record._id}.pdf`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      if (print && !popup) toast.error('Allow pop-ups to open the print preview; PDF downloaded');
    } catch { popup?.close(); toast.error('Unable to generate KYC PDF'); } finally { finish(); }
  }
  async function previewApplication(){
    if(!snapshot&&!['DRAFT','CORRECTION_REQUIRED','REJECTED'].includes(record?.status)){setApplication(true);return;}
    if(!begin())return;
    try{const res=await api.get(kycPdfPath(record,snapshot),{responseType:'blob'});setPreview({url:URL.createObjectURL(new Blob([res.data],{type:'application/pdf'})),mime:'application/pdf',kind:snapshot?'Approved KYC snapshot':'Current saved KYC form'});}
    catch{toast.error('Unable to preview this saved KYC version');}finally{finish();}
  }
  async function review(action) {
    if (action !== 'approve' && !reason.trim()) { toast.error('Enter a rejection or correction reason'); return; }
    if(action==='approve'&&(!signature||!signatureConfirmed)){toast.error('Provide your Admin signature and explicit approval confirmation.');return;}
    if (action === 'approve' && !employeeId) { toast.error('Assign an employee'); return; }
    if(!begin())return;
    try {
      const signatureId=action==='approve'?await uploadVerification(record):undefined;
      const res = await api.post(`/customer-leads/${record._id}/${action}`, { employeeId, adminRemarks: reason, version: record.version,signatureId,confirmed:action==='approve'?signatureConfirmed:undefined });
      apply(res.data.data);setSignature(null);setSignatureConfirmed(false); toast.success('KYC review saved');
    } catch (err) { report(err); } finally { finish(); }
  }
  async function revise() {
    if(!begin())return;
    try { const res = await api.post(`/kyc/${record._id}/revise`, { version: record.version }); apply(res.data.data); setSnapshot(false); }
    catch (err) { report(err); } finally { finish(); }
  }
  if (loading) return <Skeleton/>;
  if (fatal) return <div role="alert" className="kfu-load-error"><p>{fatal}</p><button className="btn-secondary mt-3" onClick={()=>window.location.reload()}>Reload KYC</button></div>;
  if (admin && !record) return <p>This customer does not yet have a KYC submission.</p>;

  const hasVerification=!admin&&record&&['PENDING','APPROVED','REJECTED','CORRECTION_REQUIRED'].includes(record.status);
  const showVerification=hasVerification&&!['application','edit'].includes(viewParams.get('view'));
  const setView=value=>setViewParams(old=>{const next=new URLSearchParams(old);if(value)next.set('view',value);else next.delete('view');return next;});
  return <><ProcessingOverlay active={submitting} delayMs={0} message="Submitting KYC..." description="Please wait while we securely submit the customer's KYC for admin approval."/>{showVerification?<KycVerification record={record} onView={()=>setView('application')} onEdit={()=>setView('edit')}/>:<>{hasVerification&&<button type="button" className="kyc-return-verification" onClick={()=>setView('')}>← Back to KYC Verification</button>}<KycEditorView {...{record,data,values,errors,editable,snapshot,busy,admin,base,employees,employeeId,setEmployeeId,reason,setReason,uploadState}} dirty={dirty.current} verificationSection={editable?<KycSignature role="EMPLOYEE" actor={signer} value={signature} onChange={value=>{setSignature(value);dirty.current=true;}} confirmed={signatureConfirmed} onConfirm={setSignatureConfirmed} busy={busy}/>:null} adminSignatureSection={<KycSignature role="ADMIN" actor={signer} value={signature} onChange={setSignature} confirmed={signatureConfirmed} onConfirm={setSignatureConfirmed} busy={busy}/>} onChange={(key,value)=>{setSignatureConfirmed(false);dirty.current=true;setData(old=>({...old,[key]:value}));}} onSave={save} onUpload={upload} onDocument={openDocument} onDownload={download} onPreview={previewApplication} onRevise={revise} onVersions={()=>setApplication(true)} onReview={review} onSnapshot={()=>setSnapshot(!snapshot)}/></>}{navigationGuard.pending&&<KycLeaveDialog message={navigationGuard.pending.message} onChoice={navigationGuard.respond}/>}{application&&<KycApplication leadId={record._id} onClose={()=>setApplication(false)}/>}{preview&&<KycDocumentPreview preview={preview} onClose={()=>setPreview(null)}/>}</>;
}


