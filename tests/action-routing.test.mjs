import { test } from 'node:test';
import assert from 'node:assert/strict';

// Exercise the compiled worker's event handlers without a live browser.
async function worker({ injectionFails = false, session = {} } = {}) {
  const events = {}, opened = [], injected = [], badges = [], menus = [], popups = [];
  const event = name => ({ addListener: fn => { events[name] = fn; } });
  globalThis.chrome = {
    storage: { local: {get: async () => ({settings: session.settings})}, session: { setAccessLevel: async () => {}, set: async value => Object.assign(session, value), get: async () => session, remove: async key => { delete session[key]; } } },
    action: {
      onClicked: event('click'), setPopup: async value => popups.push(value), openPopup: async () => {}, setBadgeText: async value => { badges.push(value); },
      setBadgeBackgroundColor: async () => {}, setTitle: async () => {}
    },
    commands: { onCommand: event('command') },
    runtime: {
      id: 'test-extension', getURL: file => `chrome-extension://test-extension/${file}`,
      onInstalled: event('install'), onMessage: event('message')
    },
    contextMenus: {
      removeAll: done => { menus.length = 0; done(); },
      create: value => { menus.push(value); }, onClicked: event('menu')
    },
    tabs: { create: async value => { opened.push(value); }, onRemoved: event('remove') },
    scripting: { executeScript: async value => {
      injected.push(value);
      if (injectionFails) throw new Error('Cannot access this page');
    } }
  };
  await import(`../dist/background.js?test=${crypto.randomUUID()}`);
  return { events, opened, injected, badges, menus, popups };
}

test('clicking the extension activates the current page without opening a library tab', async () => {
  const app = await worker();
  await app.events.click({ id: 42, url: 'https://example.com/' });
  assert.deepEqual(app.injected, [{ target: { tabId: 42 }, files: ['dist/brand.js', 'dist/content.js'] }]);
  assert.equal(app.opened.length, 0);
  assert.deepEqual(app.badges, [{ tabId: 42, text: '' }]);
});

test('a failed picker stays on the current page and displays an error badge', async () => {
  const app = await worker({ injectionFails: true });
  await app.events.click({ id: 7, url: 'chrome://extensions/' });
  assert.equal(app.opened.length, 0);
  assert.deepEqual(app.badges.at(-1), { tabId: 7, text: '!' });
  assert.deepEqual(app.popups.at(-1), {tabId:7,popup:'capture-help.html'});
});

test('install and update register one icon menu without opening anything', async () => {
  const app = await worker();
  app.events.install({ reason: 'install' });
  app.events.install({ reason: 'update' });
  assert.deepEqual(app.menus, [{ id: 'open-library', title: 'Open library', contexts: ['action'] }]);
  assert.equal(app.opened.length, 0);
});

test('library opens only when its menu item or library shortcut is selected', async () => {
  const app = await worker();
  app.events.menu({ menuItemId: 'unrelated' });
  assert.equal(app.opened.length, 0);
  app.events.menu({ menuItemId: 'open-library' });
  app.events.command('open-gallery');
  assert.deepEqual(app.opened, [
    { url: 'chrome-extension://test-extension/gallery.html' },
    { url: 'chrome-extension://test-extension/gallery.html' }
  ]);
});

test('an open library tab is focused instead of opening another one', async () => {
  const app = await worker();
  const updates = [], focused = [];
  chrome.runtime.getContexts = async () => [
    { tabId: -1, windowId: -1, documentUrl: 'chrome-extension://test-extension/capture-help.html' },
    { tabId: 9, windowId: 3, documentUrl: 'chrome-extension://test-extension/gallery.html#old' }
  ];
  chrome.tabs.update = async (tabId, value) => { updates.push([tabId, value]); };
  chrome.windows = { update: async (windowId, value) => { focused.push([windowId, value]); } };
  app.events.menu({ menuItemId: 'open-library' });
  await new Promise(resolve => app.events.message({ type: 'snap:gallery', id: 'abc' }, { id: 'test-extension' }, resolve));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(app.opened.length, 0);
  assert.deepEqual(updates, [[9, { active: true }], [9, { active: true, url: 'chrome-extension://test-extension/gallery.html#abc' }]]);
  assert.deepEqual(focused, [[3, { focused: true }], [3, { focused: true }]]);
});

test('popup drafts survive worker restart and reject wrong documents, tabs, IDs and forged payloads', async () => {
  const records = new Map(), downloads = [];
  let writes = 0;
  globalThis.indexedDB = { open() {
    const request = {};
    request.result = { transaction() {
      const tx = { objectStore() { return { get(id) {
        const request = { result: records.get(id) };
        queueMicrotask(() => { request.onsuccess(); queueMicrotask(() => tx.oncomplete()); });
        return request;
      }, add(record) {
        writes++; records.set(record.id, record);
        queueMicrotask(() => tx.oncomplete());
        return { result: record.id };
      } }; } };
      return tx;
    } };
    queueMicrotask(() => request.onsuccess());
    return request;
  } };
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=';
  globalThis.createImageBitmap = async () => ({ width: 100, height: 100, close() {} });
  globalThis.OffscreenCanvas = class {
    getContext() { return { drawImage() {} }; }
    async convertToBlob() { return (await fetch(png)).blob(); }
  };
  const session = {};
  let app = await worker({ session });
  chrome.tabs.query = async () => [{ id: 42 }];
  chrome.windows = { get: async () => ({ focused: true }) };
  chrome.tabs.sendMessage = async () => ({ valid: true });
  chrome.tabs.captureVisibleTab = async () => png;
  chrome.downloads = { download: async value => { downloads.push(value); } };
  const sender = { id: 'test-extension', frameId: 0, documentId: 'document-one', tab: { id: 42, windowId: 1 }, url: 'https://example.com/original?token=secret#private' };
  const send = (message, origin = sender) => new Promise(resolve => app.events.message(message, origin, resolve));
  const result = await send({ type: 'snap:capture', title: 'Original title', label: 'article', token: 'test', rect: { x: 0, y: 0, width: 40, height: 30 }, viewport: { width: 100, height: 100 } });
  assert.equal(result.ok, true);
  assert.equal(writes, 0);
  assert.equal(downloads.length, 0);
  const draft = result.draft;
  assert.equal(draft.width,40); assert.equal(draft.height,30);
  assert.equal(draft.url,'https://example.com/original');
  assert.match(draft.dataURL,/^data:image\/png;base64,/);
  assert.equal(app.opened.length,0,'capture stays on the current webpage');
  for (const type of ['snap:save-draft','snap:download-draft','snap:discard-draft']) {
    for(const origin of [{...sender,frameId:1},{...sender,documentId:'different-document'},{...sender,tab:{id:99}}]) {
      assert.equal((await send({type,id:draft.id},origin)).ok,false);
    }
    assert.equal((await send({type,id:'guessed-id'})).ok,false);
  }
  app = await worker({session});
  chrome.downloads = {download:async value=>downloads.push(value)};
  assert.equal((await send({type:'snap:download-draft',id:draft.id})).ok,true);
  assert.equal(downloads.length,1); assert.equal(writes,0);
  assert.equal((await send({type:'snap:save-draft',id:draft.id,draft:{url:'https://evil.test/',dataURL:'invalid'}})).ok,true);
  const saved=records.get(draft.id);
  assert.equal(saved.url,'https://example.com/original');
  assert.equal(saved.blob.type,'image/png');
  saved.folderId='filed-later'; saved.favorite=true;
  await send({type:'snap:save-draft',id:draft.id});
  assert.equal(records.size,1); assert.equal(records.get(draft.id).folderId,'filed-later');
  assert.equal((await send({type:'snap:discard-draft',id:draft.id})).ok,true);
  assert.equal((await send({type:'snap:save-draft',id:draft.id})).ok,false);
  session.settings = {saveSource:false};
  session['captureDraft:42'] = {draft:{...draft,id:'new-private-capture'},documentId:sender.documentId};
  assert.equal((await send({type:'snap:save-draft',id:'new-private-capture'})).ok,true);
  assert.equal(records.get('new-private-capture').title,'Snapshot');
  assert.equal(records.get('new-private-capture').url,'');
  assert.equal(records.get(draft.id).url,'https://example.com/original','existing saves are unchanged');
  assert.equal('saveAs' in downloads[0],false,'by default Chrome decides where downloads go');
  session.settings = {askWhere:true};
  session['captureDraft:42'] = {draft:{...draft,id:'ask-where'},documentId:sender.documentId};
  assert.equal((await send({type:'snap:download-draft',id:'ask-where'})).ok,true);
  assert.equal(downloads.at(-1).saveAs,true,'Ask where to save shows the Save As dialog');

});
