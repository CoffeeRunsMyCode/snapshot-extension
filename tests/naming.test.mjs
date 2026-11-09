import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32 as nodeCrc } from 'node:zlib';
import { nameProblem, displayName } from '../dist/library.js';
import { downloadName } from '../dist/geometry.js';
import { buildZip, crc32, uniqueNames } from '../dist/zip.js';

test('typed names accept ordinary text and reject what Windows cannot store', () => {
  for (const ok of ['', '   ', 'Plan comparison table', "Mum's medical results", 'Café menu — v2', 'notes.txt draft']) assert.equal(nameProblem(ok), undefined, ok);
  for (const bad of ['a/b', 'a\\b', 'what?', 'x:y', 'quote"d', 'a<b', 'a>b', 'pipe|d', 'star*', 'ends with dot.', 'CON', 'nul', 'com1.png', 'LPT9']) assert.ok(nameProblem(bad), bad);
  assert.equal(nameProblem('a/b'), 'Names can’t include \\ / : * ? " < > |');
});

test('renamed snapshots download under their name; others keep the neutral timestamp; never the page title', () => {
  const createdAt = 0;
  assert.equal(downloadName({ createdAt, name: 'Plan comparison table' }), 'Snapshot/Plan comparison table.png');
  assert.match(downloadName({ createdAt }), /^Snapshot\/capture-1970-01-01T00-00-00-000Z\.png$/);
  assert.match(downloadName({ createdAt, title: 'Secret page title' }), /^Snapshot\/capture-/);
  assert.equal(downloadName({ createdAt, name: 'legacy/bad:name.' }), 'Snapshot/legacy-bad-name.png', 'older names are made safe');
  assert.equal(displayName({ title: 'Page', name: 'Mine' }), 'Mine');
  assert.equal(displayName({ title: 'Page' }), 'Page');
});

test('duplicate names inside a ZIP get numbered, ignoring letter case', () => {
  assert.deepEqual(uniqueNames(['A.png', 'a.png', 'A.png', 'B.png']), ['A.png', 'a (2).png', 'A (3).png', 'B.png']);
});

test('ZIP archives are valid stored archives with UTF-8 names and correct checksums', async () => {
  const files = [['Café menu.png', new Uint8Array([1, 2, 3, 4])], ['capture-2026.png', new Uint8Array(1000).fill(7)]];
  const zip = new Uint8Array(await buildZip(files.map(([name, data]) => ({ name, data, modified: Date.UTC(2026, 10, 9) }))).arrayBuffer());
  const view = new DataView(zip.buffer);
  const end = zip.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), files.length);
  let at = view.getUint32(end + 16, true);
  for (const [name, data] of files) {
    assert.equal(view.getUint32(at, true), 0x02014b50);
    assert.equal(view.getUint16(at + 8, true) & 0x0800, 0x0800, 'UTF-8 flag');
    assert.equal(view.getUint32(at + 16, true), nodeCrc(Buffer.from(data)), 'CRC matches zlib');
    const length = view.getUint16(at + 28, true);
    assert.equal(new TextDecoder().decode(zip.subarray(at + 46, at + 46 + length)), name);
    const local = view.getUint32(at + 42, true);
    assert.equal(view.getUint32(local, true), 0x04034b50);
    const start = local + 30 + view.getUint16(local + 26, true);
    assert.deepEqual(zip.subarray(start, start + data.length), data, 'file bytes stored unchanged');
    at += 46 + length;
  }
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926, 'standard CRC-32 check value');
});
