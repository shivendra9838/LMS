import LoadingIndicator from './ui/Loading';
import { useEffect, useRef, useState } from 'react';
import { printPdfPages } from '../utils/printPdfPages';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export async function loadPdf(source) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs.getDocument({ ...(typeof source === 'string' ? { url: source } : { data: source }), isEvalSupported: false });
}

export async function printPdf(bytes, popup, options) {
  const task = await loadPdf(bytes);
  try {
    const pdf = await task.promise;
    await printPdfPages(pdf, popup, options);
  } finally { await task.destroy(); }
}

export default function KycPdfPreview({ url, downloadName="kyc-document.pdf" }) {
  const canvas = useRef(null);
  const [number, setNumber] = useState(1);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState('100');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let stopped = false; let task; let render;
    setLoading(true); setError('');
    async function draw() {
      try {
        task = await loadPdf(url);
        if (stopped) { await task.destroy(); return; }
        const pdf = await task.promise;
        if (stopped) return;
        setCount(pdf.numPages);
        const page = await pdf.getPage(number);
        if (stopped) return;
        const viewport = page.getViewport({ scale: 1.3 });
        canvas.current.width = viewport.width; canvas.current.height = viewport.height;
        render = page.render({ canvasContext: canvas.current.getContext('2d'), viewport });
        await render.promise;
      } catch { if (!stopped) setError('Unable to load the PDF preview. Retry, or download the document to view it locally.'); }
      finally { if (!stopped) setLoading(false); }
    }
    draw();
    return () => { stopped = true; render?.cancel(); if (task) void task.destroy(); };
  }, [url, number, retry]);
  return <div className="space-y-3">
    <div className="grid grid-cols-2 sm:grid-cols-[1fr_auto_1fr] gap-2 items-center text-sm"><button className="btn-secondary" disabled={number <= 1 || loading} onClick={() => setNumber(number - 1)}>Previous page</button><span className="col-span-2 row-start-1 sm:col-span-1 sm:row-auto text-center">Page {number} of {count || '…'}</span><button className="btn-secondary" disabled={number >= count || loading} onClick={() => setNumber(number + 1)}>Next page</button></div>
    <label className="flex items-center gap-3 text-sm">PDF zoom<select aria-label="PDF zoom" className="input-field !w-auto" value={zoom} onChange={event => setZoom(event.target.value)}><option value="100">Fit width</option><option value="125">125%</option><option value="150">150%</option><option value="200">200%</option></select></label>
    {loading && <LoadingIndicator message="Rendering secure PDF preview…"/>}
    {error && <div role="alert" className="text-sm"><p style={{color:'#ffb4a9'}}>{error}</p><button type="button" className="btn-secondary mt-2" onClick={()=>setRetry(value=>value+1)}>Retry PDF preview</button></div>}
    <div tabIndex={0} role="region" aria-label="Scrollable PDF page" className="max-h-[60vh] overflow-auto bg-gray-100 rounded-lg"><canvas ref={canvas} aria-label={`Document page ${number}`} className="block max-w-none h-auto" style={{ width: `${zoom}%` }} /></div>
    <a href={url} download={downloadName} className="text-blue-600 underline text-sm">Download this document</a>
  </div>;
}
