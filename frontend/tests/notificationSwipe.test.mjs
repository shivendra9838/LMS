import test from 'node:test';
import assert from 'node:assert/strict';
import {swipeAxis,swipeAction} from '../src/utils/notificationSwipe.js';
test('horizontal swipes require a deliberate distance and map to inbox actions only',()=>{assert.equal(swipeAxis(5,3),null);assert.equal(swipeAxis(80,20),'horizontal');assert.equal(swipeAction(-80,'horizontal'),'dismiss');assert.equal(swipeAction(80,'horizontal'),'read');assert.equal(swipeAction(-60,'horizontal'),null);});
test('vertical scrolling and diagonal drags cannot dismiss notifications',()=>{for(const [x,y]of [[5,100],[80,100],[-70,60]]){assert.equal(swipeAxis(x,y),'vertical');assert.equal(swipeAction(x,'vertical'),null);}});
