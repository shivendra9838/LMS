import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';

test('test runners have a separate default cache from the live website',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
 try{assert.match(server.config.cacheDir.replaceAll('\\','/'),/\.vite-tests\/default$/);}finally{await server.close();}
});
test('both dashboard modules and their dependencies remain available while isolated SSR tests run',async()=>{
 const liveCache='node_modules/.vite-tests/dashboard-live-smoke';
 const live=await createServer({cacheDir:liveCache,server:{host:'127.0.0.1',port:0,strictPort:false,hmr:false,ws:false}});
 let ssr;
 try{
  await live.listen();const base='http://127.0.0.1:'+live.httpServer.address().port,dependencies=new Set();
  for(const path of ['/src/App.jsx','/src/pages/admin/Dashboard.jsx','/src/pages/employee/Dashboard.jsx','/src/components/dashboard/EmployeeWorkspace.jsx']){
   const response=await globalThis.fetch(base+path);assert.equal(response.status,200,path);const source=await response.text();
   for(const match of source.matchAll(/"(\/node_modules\/[^"\n]*\/deps\/[^"\n]+)"/g))dependencies.add(match[1]);
  }
  assert.ok([...dependencies].some(url=>url.includes('recharts')));
  for(const path of dependencies)assert.equal((await globalThis.fetch(base+path)).status,200,path);
  const metadata=await readFile(liveCache+'/deps/_metadata.json','utf8');
  ssr=await createServer({cacheDir:'node_modules/.vite-tests/dashboard-ssr-smoke',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
  await ssr.ssrLoadModule('/src/components/collections/RecoveryCollections.jsx');await ssr.close();ssr=null;
  assert.equal(await readFile(liveCache+'/deps/_metadata.json','utf8'),metadata,'SSR checks must not overwrite live dependency metadata');
  for(const path of dependencies)assert.equal((await globalThis.fetch(base+path)).status,200,path);
 }finally{await ssr?.close();await live.close();}
});
