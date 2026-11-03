import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cropBounds, filename } from '../dist/geometry.js';
test('normal and high-density captures preserve the exact selected bounds', () => {
  assert.deepEqual(cropBounds({x:80,y:120,width:320,height:200},{width:1200,height:900},{width:1200,height:900}), {x:80,y:120,width:320,height:200,clipped:false});
  assert.deepEqual(cropBounds({x:80,y:120,width:320,height:200},{width:1200,height:900},{width:2400,height:1800}), {x:160,y:240,width:640,height:400,clipped:false});
});
test('zoomed fractional bounds round outwards and stay within the screenshot', () => {
  assert.deepEqual(cropBounds({x:10.2,y:20.5,width:30.5,height:40.2},{width:960,height:720},{width:1200,height:900}), {x:12,y:25,width:39,height:51,clipped:false});
});
test('padding and oversized selections clip to the viewport explicitly', () => {
  assert.deepEqual(cropBounds({x:-8,y:-8,width:336,height:216},{width:300,height:180},{width:600,height:360}), {x:0,y:0,width:600,height:360,clipped:true});
});
test('offscreen and malformed crops are rejected instead of creating misleading images', () => {
  for (const rect of [{x:1300,y:0,width:5,height:5},{x:0,y:0,width:NaN,height:2},{x:0,y:0,width:-1,height:2}]) {
    assert.throws(() => cropBounds(rect,{width:1200,height:900},{width:1200,height:900}));
  }
});
test('download filenames are neutral timestamps, never derived from page titles', () => {
  assert.match(filename(0),/^Snapshot\/capture-1970-01-01T00-00-00-000Z\.png$/);
});
