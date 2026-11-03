import { test } from 'node:test';
import assert from 'node:assert/strict';
import { folderName } from '../dist/folders.js';
import { filterCaptures } from '../dist/library.js';

test('folder names trim, normalize Unicode, and enforce reserved names and length', () => {
  assert.deepEqual(folderName('  Website redesign  '), { name: 'Website redesign', nameKey: 'website redesign' });
  assert.equal(folderName('Cafe\u0301').nameKey, folderName('CAFÉ').nameKey);
  for (const name of ['', '  ', 'UNFILED', 'a'.repeat(81), 'bad\nname', 'bad\u0000name']) assert.throws(() => folderName(name));
  assert.equal([...folderName('📁'.repeat(80)).name].length, 80);
  assert.equal(folderName('<b>Project</b>').name, '<b>Project</b>', 'names are text, not markup');
});

test('folder filtering isolates Unfiled and composes with search and sort', () => {
  const records = [
    { id: 'old', title: 'Old reference', url: 'https://a.example', label: '', createdAt: 1 },
    { id: 'filed', title: 'New reference', url: 'https://b.example', label: '', createdAt: 3, folderId: 'project' },
    { id: 'other', title: 'Other reference', url: 'https://a.example', label: '', createdAt: 2, folderId: 'other' }
  ];
  const options = { filter: 'all', site: '', search: '', oldest: false };
  assert.deepEqual(filterCaptures(records, options).map(r => r.id), ['filed', 'other', 'old']);
  assert.deepEqual(filterCaptures(records, { ...options, folder: '' }).map(r => r.id), ['old']);
  assert.deepEqual(filterCaptures(records, { ...options, folder: 'project', search: ' NEW ' }).map(r => r.id), ['filed']);
  assert.deepEqual(filterCaptures(records, { ...options, folder: 'project', search: 'old' }), []);
});
