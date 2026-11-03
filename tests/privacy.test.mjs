import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privateSourceUrl } from '../dist/privacy.js';
test('private source defaults remove credentials, query secrets, fragments and file paths', () => {
  assert.equal(privateSourceUrl('https://alice:password@example.com/private?token=secret#email'), 'https://example.com/private');
  assert.equal(privateSourceUrl('file:///Users/private/report.pdf'), '');
  for (const input of ['javascript:alert(1)', 'data:text/plain,secret', 'invalid']) assert.equal(privateSourceUrl(input), '');
});
test('web paths remain useful but query and fragment are always removed', () => {
  assert.equal(privateSourceUrl('https://example.com/articles/one?search=text#section'),'https://example.com/articles/one');
});
