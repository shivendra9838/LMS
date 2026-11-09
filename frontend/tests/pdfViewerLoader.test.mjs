import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';

test('cold dev server serves the prebundled PDF API and matching worker without outdated-dependency errors',async()=>{
 const server=await createServer({cacheDir:'node_modules/.vite-tests/pdf-viewer-loader',server:{host:'127.0.0.1',port:0,strictPort:false,hmr:false,ws:false}});
 try{
  assert.ok(server.config.optimizeDeps.include.includes('pdfjs-dist'),'PDF loader must be prebundled before a lazy receipt route opens');
  await server.listen();const base='http://127.0.0.1:'+server.httpServer.address().port;
  const response=await globalThis.fetch(base+'/src/components/KycPdfPreview.jsx');assert.equal(response.status,200);const source=await response.text();
  const modulePath=source.match(/import\("([^"]*pdfjs-dist[^"\n]*)"\)/)?.[1];assert.ok(modulePath,'PDF dynamic import must resolve to a local optimized module');
  const module=await globalThis.fetch(base+modulePath);assert.equal(module.status,200);assert.ok((await module.text()).includes('getDocument'));
  const workerImport=source.match(/import workerUrl from "([^"]+)"/)?.[1];assert.ok(workerImport);
  const workerModule=await globalThis.fetch(base+workerImport);assert.equal(workerModule.status,200);const workerSource=await workerModule.text();
  const workerPath=workerSource.match(/export default "([^"]+)"/)?.[1];assert.ok(workerPath);assert.equal((await globalThis.fetch(base+workerPath)).status,200);
 }finally{await server.close();}
});

