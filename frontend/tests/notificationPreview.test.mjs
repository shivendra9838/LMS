import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
let vite,Preview;
before(async()=>{vite=await createServer({cacheDir:'node_modules/.vite-tests/notification-preview',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});Preview=(await vite.ssrLoadModule('/src/components/NotificationBell.jsx')).NotificationPreview;});
after(async()=>vite?.close());
const render=(rows,extra={})=>renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Preview,{role:'EMPLOYEE',status:'Live',feed:{data:{rows,unread:12},loading:false},actions:{pending:null},...extra})));
test('bell preview caps rows at six, preserves unread count and offers header/read/navigation controls',()=>{const rows=Array.from({length:7},(_,i)=>({_id:String(i),title:'Synthetic '+i,message:'An overdue reminder',createdAt:'2026-11-04T00:00:00+05:30',category:'REMINDERS'}));const html=render(rows);assert.equal((html.match(/<li>/g)||[]).length,6);for(const value of ['(12)','Mark all as read','View all notifications','/employee/inbox','Unread'])assert.ok(html.includes(value),value);assert.doesNotMatch(html,/Synthetic 6/);assert.ok(html.indexOf('Mark all as read')<html.indexOf('</header>'));});
test('empty and failed feeds remain readable rather than displaying fabricated reminders',()=>{assert.match(render([]),/caught up/);assert.match(render([],{error:'Unavailable'}),/role="alert"/);assert.match(render([],{error:'Unavailable'}),/Retry/);});

test('dropdown category tabs show only supplied persisted counts',()=>{const html=render([],{group:'PAYMENTS',feed:{data:{rows:[],unread:3,groups:{ALL:9,PAYMENTS:3,LOANS:4,SYSTEM:2}},loading:false}});for(const text of ['Notification categories','Payments','Loans','System','(9)','(3)','(4)','(2)'])assert.ok(html.includes(text));assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);});
