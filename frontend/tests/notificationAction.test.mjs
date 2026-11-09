import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationAction} from '../src/utils/notificationAction.js';
test('repeated read/open clicks share one pending operation and recover after completion',async()=>{
 const gate={current:false},pending=[];let finish,calls=0;
 const first=notificationAction(gate,'notice',key=>pending.push(key),async()=>{calls++;await new Promise(resolve=>finish=resolve);});
 await notificationAction(gate,'all',key=>pending.push(key),async()=>{calls++;});
 assert.equal(calls,1);assert.deepEqual(pending,['notice']);finish();await first;
 await notificationAction(gate,'all',key=>pending.push(key),async()=>{calls++;});
 assert.equal(calls,2);assert.deepEqual(pending,['notice',null,'all',null]);assert.equal(gate.current,false);
});
test('a failed operation clears pending state and allows an explicit retry',async()=>{
 const gate={current:false},pending=[];
 await assert.rejects(notificationAction(gate,'notice',key=>pending.push(key),async()=>{throw new Error('Isolated network failure');}));
 assert.equal(gate.current,false);assert.deepEqual(pending,['notice',null]);
 assert.equal(await notificationAction(gate,'notice',()=>{},async()=>'retried'),'retried');
});
