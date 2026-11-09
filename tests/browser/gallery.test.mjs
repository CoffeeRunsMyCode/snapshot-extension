import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SNAPSHOT_PLAYWRIGHT_PATH || 'playwright');
let browser;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.SNAPSHOT_CHROMIUM_PATH || undefined }); });
after(async () => { await browser?.close(); });
const source = 'https://example.com/design/components?view=cards#overview';
async function setup(t, width = 1200, legacy = false) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  page.setDefaultTimeout(6000);
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.route('https://snapshot.test/**', async route => {
    const path = new URL(route.request().url()).pathname.slice(1) || 'gallery.html';
    if (path === 'seed') { await route.fulfill({ contentType: 'text/html', body: '<title>Legacy fixture</title>' }); return; }
    const contentType = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.png') ? 'image/png' : 'text/html';
    await route.fulfill({ contentType, body: await readFile(new URL('../../' + path, import.meta.url)) });
  });
  if (legacy) {
    await page.goto('https://snapshot.test/seed');
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 3;
      const blob = await new Promise(resolve => canvas.toBlob(resolve));
      const record = { id: 'legacy', title: 'Legacy capture', url: 'https://example.com/old?q=yes#part', label: 'article', createdAt: 12345, width: 4, height: 3, clipped: true, favorite: true, blob };
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
      sessionStorage.setItem('legacy-bytes', JSON.stringify(bytes));
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('element-snap', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('captures', { keyPath: 'id' });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result, tx = db.transaction('captures', 'readwrite');
          tx.objectStore('captures').put(record);
          tx.oncomplete = () => { db.close(); resolve(); };
        };
      });
    });
    await page.goto('https://snapshot.test/gallery.html');
    await page.waitForFunction(() => document.querySelectorAll('.card').length === 1);
    return page;
  }
  await page.goto('https://snapshot.test/gallery.html');
  await page.waitForFunction(() => !document.getElementById('empty').hidden);
  await page.evaluate(async source => {
    const { changeCaptures } = await import('/dist/db.js');
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#dce9df'; ctx.fillRect(0,0,320,180);
    ctx.fillStyle = '#32664f'; ctx.font = '20px sans-serif'; ctx.fillText('Saved page detail', 70,95);
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    await changeCaptures([
      { id: 'one', title: 'Component library', url: source, favorite: true },
      { id: 'two', title: 'Pricing page', url: 'https://example.com/pricing' },
      { id: 'three', title: 'Other website', url: 'https://other.example/articles/a-long-article-path' }
    ].map((r, i) => ({ ...r, label: 'section', blob, createdAt: Date.now() - i * 1000, width: 320, height: 180, clipped: false })));
  }, source);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 3);
  return page;
}
const stored = page => page.evaluate(async () => (await (await import('/dist/db.js')).listCaptures()).map(r => r.id).sort());

test('source links open the original full page URL and websites remain grouped', async t => {
  const page = await setup(t);
  const link = page.locator('.card[data-id="one"] .source-domain');
  assert.equal(await link.textContent(), new URL(source).hostname, 'cards show the site name');
  assert.equal(await link.getAttribute('title'), source, 'full address on hover');
  assert.equal(await link.getAttribute('href'), source);
  assert.equal(await link.getAttribute('target'), '_blank');
  assert.equal(await page.locator('#sites button').count(), 2);
  await page.route('https://example.com/**', route => route.fulfill({ body: 'Source page' }));
  const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
  await popup.waitForLoadState();
  assert.equal(popup.url(), source);
  await popup.close();
  await page.locator('.card[data-id="one"] .thumb').click();
  assert.equal(await page.locator('#viewer-source').getAttribute('href'), source);
  assert.equal(await page.locator('#viewer-source-url').textContent(), source);
});

async function newFolder(page, name) {
  await page.locator('#new-folder').click();
  await page.locator('#folder-name').fill(name);
  await page.locator('#save-folder').click();
  await page.locator('#folder-editor').waitFor({ state: 'hidden' });
  return page.evaluate(async name => (await (await import('/dist/db.js')).listFolders()).find(f => f.name === name.trim()).id, name);
}
const openFolder = (page, name) => page.getByRole('button', { name: `Open folder: ${name}`, exact: true }).click();
const allSnapshots = page => page.getByRole('button', { name: 'All snapshots', exact: true }).click();
async function snapshotState(page) {
  return page.evaluate(async () => {
    const db = await import('/dist/db.js');
    return { folders: await db.listFolders(), captures: await Promise.all((await db.listCaptures()).map(async r => ({ ...r, blob: Array.from(new Uint8Array(await r.blob.arrayBuffer())) }))) };
  });
}

test('folders create, validate, rename, cancel, render names as text, and persist', async t => {
  const page = await setup(t);
  const id = await newFolder(page, '  Design references  ');
  assert.equal(await page.locator('#page-title').textContent(), 'Design references');
  assert.equal(await page.locator('#no-results-title').textContent(), 'This folder is empty');
  await page.locator('#new-folder').click();
  await page.locator('#folder-name').fill('DESIGN REFERENCES');
  await page.locator('#save-folder').click();
  assert.match(await page.locator('#folder-error').textContent(), /already exists/);
  await page.locator('#folder-name').fill('Unfiled');
  assert.match(await page.locator('#folder-error').textContent(), /reserved/);
  await page.locator('#folder-name').fill('   ');
  await page.locator('#save-folder').click();
  assert.match(await page.locator('#folder-error').textContent(), /Enter a folder name/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#folder-editor').isVisible(), false);
  await page.locator('#rename-folder').click();
  assert.equal(await page.locator('#folder-name').inputValue(), 'Design references');
  await page.locator('#folder-name').fill('Cancelled'); await page.locator('#cancel-folder').click();
  assert.equal(await page.locator('#page-title').textContent(), 'Design references');
  await page.locator('#rename-folder').click();
  await page.locator('#folder-name').fill('<b>Project Alpha</b>'); await page.locator('#save-folder').click();
  await page.locator('#folder-editor').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#page-title').textContent(), '<b>Project Alpha</b>');
  assert.equal(await page.locator('#folders b').count(), 0);
  await page.reload(); await openFolder(page, '<b>Project Alpha</b>');
  const state = await snapshotState(page);
  assert.equal(state.folders.length, 1); assert.equal(state.folders[0].id, id);
});

test('single and bulk moves preserve image data and work in preview, filters, and Unfiled', async t => {
  const page = await setup(t), before = await snapshotState(page);
  const id = await newFolder(page, 'Project'); await allSnapshots(page);
  await page.locator('.card[data-id="one"] .move-snapshot').click();
  await page.locator('#move-destination').selectOption(id); await page.locator('#confirm-move').click();
  await page.locator('#move-dialog').waitFor({ state: 'hidden' });
  await openFolder(page, 'Project'); assert.equal(await page.locator('.card').count(), 1);
  await page.locator('.thumb').click(); assert.equal(await page.locator('#viewer-folder').textContent(), 'Folder: Project');
  await page.locator('#viewer-move').click(); assert.equal(await page.locator('#move-destination').inputValue(), id);
  await page.locator('#move-new-folder').click(); await page.locator('#folder-name').fill('Second project');
  await page.locator('#save-folder').click(); await page.locator('#folder-editor').waitFor({ state: 'hidden' });
  const second = await page.locator('#move-destination').inputValue(); assert.notEqual(second, id);
  await page.locator('#confirm-move').click(); await page.locator('#move-dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#viewer-folder').textContent(), 'Folder: Second project');
  await page.locator('#close-viewer').click(); assert.equal(await page.locator('.card').count(), 0);
  await allSnapshots(page); await page.locator('#select-mode').click(); await page.locator('#select-all').check();
  await page.getByRole('button', { name: 'Filter by example.com', exact: true }).click();
  assert.equal(await page.locator('#selection-count').textContent(), '2 selected');
  await page.locator('#move-selected').click(); await page.locator('#move-destination').selectOption(id);
  await page.locator('#confirm-move').click(); await page.locator('#move-dialog').waitFor({ state: 'hidden' });
  await openFolder(page, 'Project'); assert.equal(await page.locator('.card').count(), 2);
  await page.locator('#search').fill('Pricing'); assert.equal(await page.locator('.card').count(), 1);
  await page.locator('#search').fill(''); await page.locator('#sort').selectOption('oldest');
  assert.equal(await page.locator('.card').first().getAttribute('data-id'), 'two');
  await page.getByRole('button', { name: 'Favorites', exact: true }).click(); assert.equal(await page.locator('.card').count(), 1);
  await openFolder(page, 'Unfiled'); assert.equal(await page.locator('.card').count(), 1);
  await openFolder(page, 'Project'); await page.locator('#select-mode').click(); await page.locator('#select-all').check();
  await page.locator('#move-selected').click(); await page.locator('#move-destination').selectOption('');
  await page.locator('#confirm-move').click(); await page.locator('#move-dialog').waitFor({ state: 'hidden' });
  await openFolder(page, 'Unfiled'); assert.equal(await page.locator('.card').count(), 3);
  assert.deepEqual((await snapshotState(page)).captures, before.captures);
  await page.reload(); await openFolder(page, 'Unfiled'); assert.equal(await page.locator('.card').count(), 3);
});

test('folder deletion keeps snapshots and Undo restores to an existing folder or Unfiled', async t => {
  const page = await setup(t), before = await snapshotState(page);
  const id = await newFolder(page, 'Keep images');
  await page.evaluate(async id => { await (await import('/dist/db.js')).moveCaptures(['one', 'two'], id); }, id);
  await page.reload(); await openFolder(page, 'Keep images');
  await page.locator('#delete-folder').click();
  assert.match(await page.locator('#folder-delete-description').textContent(), /kept in Unfiled/);
  await page.locator('#cancel-folder-delete').click(); assert.equal((await snapshotState(page)).folders.length, 1);
  await page.locator('#select-mode').click(); await page.locator('#select-all').check(); await page.locator('#delete-selected').click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 2);
  assert.equal((await snapshotState(page)).captures.find(r => r.id === 'one').folderId, id);
  await page.locator('.card[data-id="one"] .remove').click();
  await page.locator('#delete-folder').click(); await page.locator('#confirm-folder-delete').click();
  await page.locator('#folder-delete-dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#page-title').textContent(), 'Unfiled');
  assert.equal((await snapshotState(page)).folders.length, 0);
  await page.getByRole('button', { name: 'Undo snapshot deletion', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 3);
  assert.deepEqual((await snapshotState(page)).captures, before.captures);
});

test('legacy database upgrades without changing any image bytes or metadata', async t => {
  const page = await setup(t, 1200, true);
  await openFolder(page, 'Unfiled');
  const state = await snapshotState(page), legacy = state.captures[0];
  assert.deepEqual(legacy, { id: 'legacy', title: 'Legacy capture', url: 'https://example.com/old?q=yes#part', label: 'article', createdAt: 12345, width: 4, height: 3, clipped: true, favorite: true, blob: await page.evaluate(() => JSON.parse(sessionStorage.getItem('legacy-bytes'))) });
  await newFolder(page, 'Migrated library'); await page.reload();
  assert.equal((await snapshotState(page)).folders.length, 1);
  assert.deepEqual((await snapshotState(page)).captures, state.captures);
});

test('storage prevents duplicate names and stale writes, and rejects missing destinations atomically', async t => {
  const page = await setup(t);
  const results = await page.evaluate(async () => {
    const db = await import('/dist/db.js');
    const original = await db.getCapture('one');
    const names = await Promise.allSettled([db.createFolder('Concurrent'), db.createFolder('CONCURRENT')]);
    const folder = (await db.listFolders())[0];
    await db.moveCaptures(['one'], folder.id); await db.setFavorite('one', false); await db.saveCapture(original);
    const kept = await db.getCapture('one');
    const errors = [];
    for (const action of [() => db.moveCaptures(['one', 'two'], 'missing'), () => db.moveCaptures(['two', 'missing'], folder.id)]) {
      try { await action(); } catch (e) { errors.push(e.message); }
    }
    await db.deleteCapture('three');
    try { await db.setFavorite('three', true); } catch (e) { errors.push(e.message); }
    return { statuses: names.map(r => r.status), duplicate: names.find(r => r.status === 'rejected').reason.message, kept: { folderId: kept.folderId, favorite: kept.favorite }, folder: folder.id, errors, two: (await db.getCapture('two')).folderId, three: await db.getCapture('three') };
  });
  assert.deepEqual(results.statuses.sort(), ['fulfilled', 'rejected']); assert.match(results.duplicate, /already exists/);
  assert.deepEqual(results.kept, { folderId: results.folder, favorite: false });
  assert.equal(results.errors.length, 3); assert.equal(results.two, undefined); assert.equal(results.three, undefined);
});

test('failed folder writes roll back completed requests and dialogs allow retry', async t => {
  const page = await setup(t);
  const id = await newFolder(page, 'Original'); const before = await snapshotState(page);
  await page.evaluate(() => {
    window.failWrites = true;
    for (const method of ['put', 'add', 'delete']) {
      const original = IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method] = function(...args) {
        const request = original.apply(this, args);
        request.addEventListener('success', () => { if (window.failWrites) this.transaction.abort(); });
        return request;
      };
    }
  });
  await page.locator('#rename-folder').click(); await page.locator('#folder-name').fill('Changed'); await page.locator('#save-folder').click();
  await page.waitForFunction(() => document.getElementById('folder-error').textContent.includes('could not be updated'));
  assert.deepEqual(await snapshotState(page), before); await page.locator('#cancel-folder').click();
  await page.locator('#new-folder').click(); await page.locator('#folder-name').fill('Failed creation'); await page.locator('#save-folder').click();
  await page.waitForFunction(() => document.getElementById('folder-error').textContent.includes('could not be updated'));
  assert.deepEqual(await snapshotState(page), before); await page.locator('#cancel-folder').click();
  await allSnapshots(page); await page.locator('#select-mode').click(); await page.locator('#select-all').check();
  await page.locator('#move-selected').click(); await page.locator('#move-destination').selectOption(id); await page.locator('#confirm-move').click();
  await page.waitForFunction(() => document.getElementById('move-error').textContent.includes('could not be updated'));
  assert.deepEqual(await snapshotState(page), before);
  await page.evaluate(() => { window.failWrites = false; }); await page.locator('#confirm-move').click();
  await page.locator('#move-dialog').waitFor({ state: 'hidden' });
  await openFolder(page, 'Original'); const filed = await snapshotState(page);
  await page.evaluate(() => { window.failWrites = true; });
  await page.locator('#delete-folder').click(); await page.locator('#confirm-folder-delete').click();
  await page.waitForFunction(() => document.getElementById('folder-delete-error').textContent.includes('could not be updated'));
  assert.deepEqual(await snapshotState(page), filed);
  await page.evaluate(() => { window.failWrites = false; }); await page.locator('#confirm-folder-delete').click();
  await page.locator('#folder-delete-dialog').waitFor({ state: 'hidden' });
  assert.deepEqual((await snapshotState(page)).captures, before.captures);
});

test('folder dialogs and selection fit narrow layouts and preserve keyboard escape and focus', async t => {
  const page = await setup(t);
  const name = 'Project references with a longer descriptive folder name';
  const id = await newFolder(page, name); await allSnapshots(page);
  await page.locator('#select-mode').click(); await page.locator('#select-all').check();
  await page.locator('#move-selected').click(); await page.locator('#move-destination').selectOption(id);
  await page.locator('#confirm-move').click(); await page.locator('#move-dialog').waitFor({ state: 'hidden' });
  await openFolder(page, name);
  await page.waitForFunction(() => [...document.querySelectorAll('.thumb img')].every(img => img.complete && img.naturalWidth));
  if (process.env.SNAPSHOT_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SNAPSHOT_SCREENSHOT_DIR}/folders-desktop.png` });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.locator('#sidebar').waitFor({ state: 'hidden' }); await page.locator('#toggle-sidebar').click();
    await page.waitForFunction(() => document.getElementById('sidebar').getBoundingClientRect().top >= document.querySelector('.topbar').getBoundingClientRect().bottom - 1);
    const header = await page.locator('.topbar').boundingBox(), sidebar = await page.locator('#sidebar').boundingBox();
    assert.ok(sidebar.y >= header.y + header.height - 1, 'sidebar begins below wrapped folder heading');
    if (await page.locator('#sidebar').isVisible()) await page.locator('#toggle-sidebar').click();
    await page.locator('#rename-folder').click();
    assert.equal(await page.locator('#folder-name').evaluate(el => el === document.activeElement), true);
    for (const selector of ['#folder-editor', '#folder-name', '#save-folder']) {
      const box = await page.locator(selector).boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width, `${selector} fits`);
    }
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#folder-editor').isVisible(), false);
    assert.equal(await page.locator('#rename-folder').evaluate(el => el === document.activeElement), true);
    await page.locator('#select-mode').click(); await page.locator('#select-all').check();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('#move-selected').click();
    await page.locator('#move-dialog').waitFor({ state: 'visible' });
    const box = await page.locator('#move-dialog').boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width);
    if (process.env.SNAPSHOT_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SNAPSHOT_SCREENSHOT_DIR}/folders-move-${width}.png` });
    await page.keyboard.press('Escape'); await page.locator('#cancel-selection').click();
    await page.locator('#list-view').click();
    if (process.env.SNAPSHOT_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SNAPSHOT_SCREENSHOT_DIR}/folders-list-${width}.png` });
    const overflow = await page.evaluate(() => [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > innerWidth).map(el => el.className));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow: ${overflow}`);
    await page.locator('#grid-view').click();
  }
});

test('batch delete is persisted and Undo restores the entire batch with metadata', async t => {
  const page = await setup(t);
  await page.locator('#select-mode').click();
  assert.equal(await page.locator('#delete-selected').isDisabled(), true);
  await page.locator('.card[data-id="one"] .card-selection input').check();
  await page.locator('.card[data-id="two"] .thumb').click();
  assert.equal(await page.locator('#selection-count').textContent(), '2 selected');
  assert.equal(await page.locator('#select-all').evaluate(el => el.indeterminate), true);
  await page.locator('#delete-selected').click();
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 1);
  assert.deepEqual(await stored(page), ['three']);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 3);
  assert.deepEqual(await stored(page), ['one', 'three', 'two']);
  const record = await page.evaluate(async () => { const r = await (await import('/dist/db.js')).getCapture('one'); return { favorite: r.favorite, url: r.url, bytes: r.blob.size }; });
  assert.equal(record.favorite, true); assert.equal(record.url, source); assert.ok(record.bytes > 0);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 3);
  await page.locator('#select-mode').click(); await page.locator('#select-all').check();
  await page.keyboard.press('Delete');
  await page.waitForFunction(() => !document.getElementById('empty').hidden);
  assert.deepEqual(await stored(page), []);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 3);
});

test('selection follows visible filters, supports list view and Escape, and leaves hidden records intact', async t => {
  const page = await setup(t);
  await page.locator('#select-mode').click(); await page.locator('#select-all').check();
  await page.getByRole('button', { name: 'Filter by example.com', exact: true }).click();
  assert.equal(await page.locator('#selection-count').textContent(), '2 selected');
  await page.locator('#search').fill('Pricing');
  assert.equal(await page.locator('#selection-count').textContent(), '1 selected');
  await page.keyboard.press('Delete');
  assert.equal((await stored(page)).length, 3, 'Delete while typing does not delete snapshots');
  await page.locator('#list-view').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#selection-bar').isVisible(), false);
  await page.locator('#select-mode').click(); await page.locator('#select-all').check();
  await page.locator('#delete-selected').click();
  await page.waitForFunction(() => !document.getElementById('no-results').hidden);
  assert.deepEqual(await stored(page), ['one', 'three']);
});

test('a failed bulk transaction preserves every capture and allows retry', async t => {
  const page = await setup(t);
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function(...args) {
      const tx = original.apply(this, args);
      if (args[1] === 'readwrite' && window.failWrites) queueMicrotask(() => tx.abort());
      return tx;
    };
    window.failWrites = true;
  });
  await page.locator('#select-mode').click(); await page.locator('#select-all').check();
  await page.locator('#delete-selected').click();
  await page.waitForFunction(() => document.getElementById('notice').textContent.includes('could not be updated'));
  assert.deepEqual(await stored(page), ['one', 'three', 'two']);
  assert.equal(await page.locator('#selection-count').textContent(), '3 selected');
  assert.equal(await page.locator('#delete-selected').isEnabled(), true);
  await page.evaluate(() => { window.failWrites = false; });
  await page.locator('#delete-selected').click();
  await page.waitForFunction(() => !document.getElementById('empty').hidden);
  assert.deepEqual(await stored(page), []);
});

test('sidebar preference persists, guide is simplified, and desktop/narrow layouts fit', async t => {
  const page = await setup(t);
  assert.equal(await page.locator('#sidebar').isVisible(), true);
  const expanded = await page.locator('.app').boundingBox();
  await page.locator('#toggle-sidebar').click();
  assert.equal(await page.locator('#sidebar').isVisible(), false);
  assert.ok((await page.locator('.app').boundingBox()).width > expanded.width);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 3);
  assert.equal(await page.locator('#toggle-sidebar').getAttribute('aria-expanded'), 'false');
  await page.locator('#toggle-sidebar').click();
  assert.equal(await page.locator('#top-help').count(), 0);
  assert.equal(await page.locator('#help [data-icon="arrow"]').count(), 0);
  await page.locator('#help').click(); assert.equal(await page.locator('#guide').isVisible(), true);
  assert.equal(await page.locator('#full-guide').getAttribute('href'), 'docs/index.html');
  assert.equal(await page.evaluate(async () => (await fetch('docs/index.html')).ok), true, 'full guide ships with the extension');
  await page.locator('#got-it').click();
  if (process.env.SNAPSHOT_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SNAPSHOT_SCREENSHOT_DIR}/library-desktop.png` });
  await page.locator('#select-mode').click(); await page.locator('#select-all').check();
  if (process.env.SNAPSHOT_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SNAPSHOT_SCREENSHOT_DIR}/library-selection.png` });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.locator('#sidebar').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const id of ['toggle-sidebar', 'selection-bar', 'delete-selected']) {
      const box = await page.locator('#' + id).boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width, `${id} fits at ${width}`);
    }
    if (process.env.SNAPSHOT_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SNAPSHOT_SCREENSHOT_DIR}/library-${width}.png` });
    await page.locator('#toggle-sidebar').click();
    assert.equal(await page.locator('#sidebar').isVisible(), true);
    assert.equal(await page.evaluate(() => document.getElementById('sites').scrollWidth <= document.getElementById('sites').clientWidth), true, 'sidebar never scrolls sideways');
    await page.mouse.click(width - 8, 600);
    assert.equal(await page.locator('#sidebar').isVisible(), false, 'clicking outside closes the drawer');
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('#sidebar').waitFor({ state: 'visible' });
});

test('Recently deleted persists, restores, and only empties after confirmation', async t => {
  const page=await setup(t);
  await page.locator('[data-id="one"] .remove').click();
  await page.waitForFunction(()=>document.querySelectorAll('.card').length===2);
  await page.reload();
  await page.locator('[data-filter="trash"]').click();
  await page.locator('.restore-snapshot').waitFor();
  assert.equal(await page.locator('.card').count(),1);
  assert.equal(await page.locator('#trash-count').textContent(),'1');
  await page.locator('.restore-snapshot').click();
  await page.waitForFunction(()=>document.querySelectorAll('.card').length===0);
  assert.deepEqual(await stored(page),['one','three','two']);
  await page.locator('[data-filter="all"]').click();
  await page.locator('#select-mode').click(); await page.locator('#select-all').check();
  await page.locator('#delete-selected').click();
  await page.locator('[data-filter="trash"]').click();
  await page.locator('#empty-trash').click(); await page.locator('#cancel-trash').click();
  assert.equal(await page.locator('.card').count(),3);
  await page.locator('#empty-trash').click(); await page.locator('#confirm-trash').click();
  await page.locator('#trash-confirm').waitFor({state:'hidden'});
  await page.reload(); await page.locator('[data-filter="trash"]').click();
  assert.equal(await page.locator('.card').count(),0);
  assert.deepEqual(await stored(page),[]);
  await page.evaluate(async()=>{await (await import('/dist/db.js')).restoreTrash(['one','two','three']);});
  assert.deepEqual(await stored(page),[],'stale restore cannot resurrect purged snapshots');
});

test('snapshots can be renamed on the card or in the preview, and clearing restores the page title', async t => {
  const page = await setup(t);
  const named = () => page.evaluate(async () => Object.fromEntries((await (await import('/dist/db.js')).listCaptures()).map(r => [r.id, r.name])));
  const title = page.locator('.card[data-id="two"] .card-title');
  await title.click();
  const input = page.locator('.card[data-id="two"] .rename-input');
  assert.equal(await input.inputValue(), 'Pricing page');
  await input.fill('  Plan comparison   table '); await input.press('Enter');
  await page.waitForFunction(() => document.querySelector('.card[data-id="two"] .card-title')?.textContent === 'Plan comparison table');
  assert.equal((await named()).two, 'Plan comparison table', 'whitespace is tidied');
  assert.equal(await page.evaluate(() => document.querySelector(':focus-visible')), null, 'a rename started with the mouse leaves no focus ring');
  // Started from the keyboard, focus returns to the title so keyboard users keep their place.
  await title.focus(); await page.keyboard.press('Enter');
  await input.fill('Plan comparison'); await input.press('Enter');
  await page.waitForFunction(() => document.querySelector('.card[data-id="two"] .card-title')?.textContent === 'Plan comparison');
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('card-title')), true, 'keyboard rename returns focus to the title');
  await title.click(); await input.fill('Plan comparison table'); await input.press('Enter');
  await page.waitForFunction(() => document.querySelector('.card[data-id="two"] .card-title')?.textContent === 'Plan comparison table');
  // Search finds the new name and the original page title.
  for (const query of ['comparison', 'pricing page']) {
    await page.locator('#search').fill(query);
    await page.waitForFunction(() => document.querySelectorAll('.card').length === 1);
    assert.equal(await page.locator('.card').getAttribute('data-id'), 'two');
  }
  await page.locator('#search').fill(''); await page.waitForFunction(() => document.querySelectorAll('.card').length === 3);
  // Esc cancels without saving.
  await page.locator('.card[data-id="two"] .card-title').click();
  await page.locator('.card[data-id="two"] .rename-input').fill('Discarded'); await page.keyboard.press('Escape');
  assert.equal(await page.locator('.card[data-id="two"] .card-title').textContent(), 'Plan comparison table');
  // Preview: Rename, then clear the field to go back to the page title.
  await page.locator('.card[data-id="two"] .thumb').click(); await page.locator('#viewer').waitFor();
  assert.match(await page.locator('#viewer-meta').textContent(), /Page title: Pricing page/);
  await page.locator('#viewer-rename').click();
  await page.locator('#viewer .rename-input').fill(''); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('viewer-title').textContent === 'Pricing page');
  assert.equal(await page.locator('#viewer').isVisible(), true, 'Enter does not close the preview');
  assert.equal((await named()).two, undefined, 'empty name removes the custom name');
  await page.keyboard.press('Escape');
  // F2 on a focused preview starts renaming.
  await page.locator('.card[data-id="three"] .thumb').focus(); await page.keyboard.press('F2');
  assert.equal(await page.locator('.card[data-id="three"] .rename-input').count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.card[data-id="three"] .card-title').textContent(), 'Other website');
});

test('names Windows cannot store show an error under the field and are never saved', async t => {
  const page = await setup(t);
  await page.locator('.card[data-id="two"] .card-title').click();
  const input = page.locator('.card[data-id="two"] .rename-input');
  await input.fill('Q3/Q4 plans');
  const error = page.locator('.card[data-id="two"] .rename-error');
  assert.match(await error.textContent(), /can’t include/);
  assert.equal(await input.getAttribute('aria-invalid'), 'true');
  await input.press('Enter');
  assert.equal(await input.count(), 1, 'Enter keeps the field open while the name has a problem');
  await input.fill('Q3 and Q4 plans');
  assert.equal(await error.isHidden(), true, 'the error clears once fixed');
  await input.press('Enter');
  await page.waitForFunction(() => document.querySelector('.card[data-id="two"] .card-title')?.textContent === 'Q3 and Q4 plans');
  // Leaving the field with a bad name cancels and explains.
  await page.locator('.card[data-id="three"] .card-title').click();
  await page.locator('.card[data-id="three"] .rename-input').fill('CON');
  await page.locator('#search').focus();
  await page.waitForFunction(() => document.getElementById('notice').textContent.includes('Name not saved'));
  assert.equal(await page.locator('.card[data-id="three"] .card-title').textContent(), 'Other website');
  assert.equal(await page.locator('.rename-error').count(), 0);
});
