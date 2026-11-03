import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const brandScript = read('../dist/brand.js');
const contentScript = read('../dist/content.js');

function overlay() {
  const nodes = new Map();
  const node = () => ({
    style: { setProperty() {} },
    classList: { toggle() {} },
    focus() {}, addEventListener() {}, toggleAttribute() {}, setAttribute() {}, removeAttribute() {},
    textContent: '', disabled: false
  });
  const shadow = { innerHTML: '', getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, node());
    return nodes.get(id);
  } };
  const host = { ...node(), attachShadow: () => shadow, remove() { attached = false; } };
  let attached = false, creations = 0;
  const window = { addEventListener() {}, removeEventListener() {} };
  const context = createContext({ window, clearTimeout() {}, ResizeObserver: class { observe() {} }, matchMedia: () => ({ matches: false }),
    document: {
      querySelectorAll() { return []; }, createElement() { creations++; return host; },
      documentElement: { append() { attached = true; } }
    }, chrome: { runtime: { onMessage: { addListener() {} } } }
  });
  const inject = () => { runInContext(brandScript, context); runInContext(contentScript, context); };
  inject();
  return { shadow, host, window, inject, attached: () => attached, creations: () => creations };
}

test('capture UI defines typography inside the shadow tree, beyond the host all:initial reset', () => {
  const app = overlay();
  assert.match(app.host.style.cssText, /all:initial!important/);
  const html = app.shadow.innerHTML;
  assert.match(html, /\.snapshot-root\s*\{\s*all:initial; font:400 13px\/1\.5 var\(--sn-font\)/);
  const markup = html.slice(html.indexOf('</style>') + 8);
  assert.match(markup, /^\s*<div id="root" class="snapshot-root">/);
  for (const id of ['outline', 'label', 'dock', 'help', 'bar', 'toast', 'toast-text', 'save', 'download', 'capture', 'dismiss']) {
    assert.ok(markup.includes(`id="${id}"`), `${id} stays within the typography root`);
  }
  assert.ok(html.includes(app.window.__snapshotBrand.css));
  assert.match(app.window.__snapshotBrand.css, /--sn-font:"Segoe UI",system-ui,sans-serif/);
});

test('toolbar and confirmation use shared icons and keep dismiss separate from wrapping actions', () => {
  const { shadow, window } = overlay();
  for (const name of ['scan', 'up', 'down', 'external', 'close']) {
    assert.ok(shadow.innerHTML.includes(window.__snapshotBrand.paths[name]), name);
  }
  assert.doesNotMatch(shadow.innerHTML, /undefined/);
  const actions = shadow.innerHTML.match(/<div id="toast-actions">(.*?)<\/div>/s)[1];
  assert.ok(actions.includes('id="save"'));
  assert.ok(!actions.includes('id="copy"'));
  assert.ok(actions.includes('id="download"'));
  assert.ok(!actions.includes('id="dismiss"'));
  assert.match(shadow.innerHTML, /#toast-tools\{position:absolute;top:8px;right:8px/);
  assert.match(shadow.innerHTML, /#dock\{[^}]*flex-direction:column/);
});

test('repeated brand and picker injection toggles the existing overlay without redeclaration errors', () => {
  const app = overlay();
  assert.equal(app.attached(), true);
  app.inject();
  assert.equal(app.attached(), false);
  app.inject();
  assert.equal(app.attached(), true);
  assert.equal(app.creations(), 1);
});
