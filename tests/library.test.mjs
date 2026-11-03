import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterCaptures,siteName,sourceUrl} from '../dist/library.js';
const now=1000000000, day=86400000;
const captures=[
  {id:'legacy',title:'Old design',url:'https://www.example.com/a',label:'card',createdAt:now-9*day},
  {id:'new',title:'Profile settings',url:'https://example.com/b',label:'section',createdAt:now-day,favorite:true},
  {id:'other',title:'Price card',url:'https://other.example/pricing',label:'aside',createdAt:now-2*day}
];
const defaults={filter:'all',site:'',search:'',oldest:false,now};
test('source links preserve page routes and only allow navigable web or local file URLs',()=>{
  for (const url of ['https://example.com/page?q=a#route', 'http://example.com/path', 'file:///test/example.html']) assert.equal(sourceUrl(url),url);
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '/relative', 'invalid', '']) assert.equal(sourceUrl(url),undefined);
});
test('legacy captures remain visible and favorites opt in without migration',()=>{
  assert.deepEqual(filterCaptures(captures,defaults).map(r=>r.id),['new','other','legacy']);
  assert.deepEqual(filterCaptures(captures,{...defaults,filter:'favorites'}).map(r=>r.id),['new']);
  assert.equal(captures[0].favorite,undefined);
});
test('recent view includes only the last seven days',()=>{
  assert.deepEqual(filterCaptures(captures,{...defaults,filter:'recent'}).map(r=>r.id),['new','other']);
});
test('website filter and case-insensitive search compose without altering source order',()=>{
  assert.deepEqual(filterCaptures(captures,{...defaults,site:'example.com',search:' SETTINGS '}).map(r=>r.id),['new']);
  assert.deepEqual(filterCaptures(captures,{...defaults,oldest:true}).map(r=>r.id),['legacy','other','new']);
  assert.deepEqual(captures.map(r=>r.id),['legacy','new','other']);
  assert.equal(siteName('file:///test/example.html'),'Local file');
});
