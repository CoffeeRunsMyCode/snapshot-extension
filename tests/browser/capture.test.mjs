import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SNAPSHOT_PLAYWRIGHT_PATH || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.SNAPSHOT_CHROMIUM_PATH || undefined });
});
after(async () => { await browser?.close(); });

const defaultBody = '<style>body{margin:0;background:#d7e9f8;font-family:Georgia}article{width:100vw;height:100vh}</style><article id="target"><h1>Capture test</h1></article>';
async function setup(t, { copyFails = false, autoCopy = true, width = 1200, body = defaultBody } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  page.setDefaultTimeout(8000);
  t.after(() => page.close());
  await page.route('https://snapshot.test/', route => route.fulfill({ contentType: 'text/html', body }));
  await page.goto('https://snapshot.test/');
  const clean = await page.screenshot();
  const captures = [];
  // Screenshot the real painted page at the point where the worker would capture.
  // Chrome messaging and clipboard are mocked; browser rendering is real.
  await page.exposeFunction('recordCapture', async () => {
    captures.push(await page.screenshot());
  });
  await page.evaluate(({ copyFails, autoCopy }) => {
    window.testState = { captures: 0, copies: 0, libraryOpens: 0, saves: [], downloads: [], failCapture: false, copyFails };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async () => {
      if (window.testState.copyFails) throw Error('Clipboard blocked');
      window.testState.copies++;
    } } });
    window.ClipboardItem = class { constructor(value) { this.value = value; } };
    window.chrome = { runtime: { onMessage: { addListener() {} }, sendMessage: async message => {
      if (message.type === 'snap:capture') {
        await window.recordCapture();
        if (window.testState.failCapture) return { ok: false, error: 'Capture failed. Try again.' };
        window.testState.captures++;
        const canvas = document.createElement('canvas');
        canvas.width = 100; canvas.height = 60;
        const context = canvas.getContext('2d');
        context.fillStyle = '#32664f'; context.fillRect(0, 0, 100, 60);
        return { ok: true, autoCopy, draft: { id: `capture-${window.testState.captures}`, width: 100, height: 60, dataURL: canvas.toDataURL() } };
      }
      if (message.type === 'snap:gallery') window.testState.libraryOpens++;
      if (message.type === 'snap:save-draft') window.testState.saves.push(message.id);
      if (message.type === 'snap:download-draft') window.testState.downloads.push(message.id);
      return { ok: true };
    } } };
  }, { copyFails, autoCopy });
  await page.addScriptTag({ path: root + 'dist/brand.js' });
  await page.addScriptTag({ path: root + 'dist/content.js' });
  await page.clock.install();
  const ui = id => page.locator(`#element-snap-overlay #${id}`);
  const snap = async () => {
    const count = captures.length;
    await page.mouse.click(100, 180);
    await page.clock.runFor(100);
    await page.waitForFunction(() => {
      const host = document.getElementById('element-snap-overlay');
      return host.style.display === 'block' && host.shadowRoot.getElementById('toast').style.display === 'block';
    });
    assert.equal(captures.length, count + 1);
  };
  return { page, ui, snap, clean, captures };
}

test('repeated captures exclude every overlay pixel, even with an expanded panel', async t => {
  const { page, ui, snap, clean, captures } = await setup(t);
  const toolbarBefore = await ui('bar').boundingBox();
  await snap();
  assert.equal(await ui('toast-text').textContent(), 'Copied to clipboard');
  for (const id of ['save', 'download']) assert.equal(await ui(id).isVisible(), true);
  const notification = await ui('toast').boundingBox();
  assert.ok(notification.width < 330, 'popup fits its two remaining actions');
  assert.equal(notification.y, 20);
  assert.equal(notification.x + notification.width, 1180);
  const toolbarWithDraft = await ui('bar').boundingBox();
  assert.equal(toolbarWithDraft.y, toolbarBefore.y, 'result actions keep the toolbar at its current edge');
  if (process.env.SNAPSHOT_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.SNAPSHOT_SCREENSHOT_DIR}/capture-top-right.png` });
  }
  await snap();
  assert.deepEqual(captures[0], clean);
  assert.deepEqual(captures[1], clean, 'second capture must contain exactly the clean webpage');
  assert.equal(await page.evaluate(() => testState.copies), 2);
  assert.deepEqual(await page.evaluate(() => testState.saves), []);
  await page.clock.runFor(3100);
  assert.equal(await ui('toast').isVisible(), true);
  await ui('dismiss').click();
  assert.equal(await ui('last-capture').count(), 0, 'there is no Last capture control');
  assert.deepEqual(await ui('bar').boundingBox(), toolbarWithDraft, 'hiding the result does not resize the toolbar');
  await snap();
  assert.deepEqual(captures[2], clean, 'another capture works after hiding the result');
});

test('initial notification hides after five idle seconds without affecting copy or capture mode', async t => {
  const { page, ui, snap } = await setup(t);
  await snap();
  await page.clock.runFor(2500);
  assert.equal(await ui('toast').isVisible(), true);
  await page.clock.runFor(600);
  assert.equal(await ui('toast').isVisible(), true);
  await page.clock.runFor(2000);
  assert.equal(await ui('toast').isVisible(), false);
  assert.equal(await ui('last-capture').count(), 0);
  assert.equal(await ui('notifications').evaluate(el => el.getBoundingClientRect().height), 0);
  assert.equal(await page.evaluate(() => testState.copies), 1, 'hiding does not replace the clipboard');
  assert.equal(await ui('bar').isVisible(), true);
  await snap();
  await ui('download').click();
  await ui('save').click();
  assert.deepEqual(await page.evaluate(() => testState.downloads), ['capture-2']);
  assert.deepEqual(await page.evaluate(() => testState.saves), ['capture-2']);
  assert.equal(await ui('save').isDisabled(), true);
});

test('auto-hide pauses during hover and keyboard use; manual dismissal keeps capture mode active', async t => {
  const { page, ui, snap } = await setup(t);
  await snap();
  await ui('toast-text').hover();
  await page.clock.runFor(5000);
  assert.equal(await ui('toast').isVisible(), true);
  await page.mouse.move(10, 10);
  await ui('save').focus();
  await page.clock.runFor(5000);
  assert.equal(await ui('toast').isVisible(), true);
  await ui('element').focus();
  await page.clock.runFor(5100);
  assert.equal(await ui('toast').isVisible(), false);
  assert.equal(await ui('last-capture').count(), 0);
  await snap();
  await ui('dismiss').click();
  assert.equal(await ui('capture').evaluate(el => el === el.getRootNode().activeElement), true, 'dismissal returns keyboard focus to capture');
  assert.equal(await ui('notifications').evaluate(el => el.getBoundingClientRect().height), 0, 'nothing floats over the page after dismissal');
  assert.equal(await ui('bar').isVisible(), true, 'capture mode stays enabled');
  await snap();
  assert.equal(await page.evaluate(() => testState.captures), 3, 'another capture works without restarting');
  await ui('toast-library').focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#element-snap-overlay').count(), 0);
});

test('countdown bar follows the idle timer and resets during interaction', async t => {
  const { page, ui, snap } = await setup(t);
  const fraction = () => ui('toast').evaluate(el => Number(getComputedStyle(el).getPropertyValue('--countdown')));
  await snap();
  assert.equal(await ui('toast').evaluate(el => getComputedStyle(el, '::after').height), '2px');
  await page.clock.runFor(2400);
  assert.ok(await fraction() > .4 && await fraction() < .6, 'bar shows approximately half the five seconds remaining');
  await ui('save').hover();
  await page.clock.runFor(6000);
  assert.equal(await fraction(), 1, 'hover gives a fresh full countdown rather than a shrinking deadline');
  assert.equal(await ui('toast').isVisible(), true);
  await page.mouse.move(10, 10);
  await ui('save').focus();
  await page.clock.runFor(6000);
  assert.equal(await fraction(), 1, 'keyboard use also keeps the full countdown');
  await ui('element').focus();
  await page.clock.runFor(2400);
  assert.ok(await fraction() > .4 && await fraction() < .6);
  await page.clock.runFor(2700);
  assert.equal(await ui('toast').isVisible(), false, 'bar and dismissal finish together');
  await snap();
  assert.ok(await fraction() > .9, 'a fresh capture restarts the bar');
});

test('reduced motion keeps the countdown still while preserving timed dismissal', async t => {
  const { page, ui, snap } = await setup(t);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await snap();
  await page.clock.runFor(2500);
  assert.equal(await ui('toast').evaluate(el => getComputedStyle(el).getPropertyValue('--countdown')), '1');
  assert.equal(await ui('toast').isVisible(), true);
  await page.clock.runFor(2600);
  assert.equal(await ui('toast').isVisible(), false);
});

test('copy failures stay expanded, recapture works, and capture failures restore the previous draft', async t => {
  const { page, ui, snap } = await setup(t, { copyFails: true });
  await snap();
  await page.clock.runFor(10000);
  assert.equal(await ui('copy').count(), 0);
  assert.match(await ui('toast-text').textContent(), /could not copy/);
  assert.equal(await ui('toast').evaluate(el => getComputedStyle(el, '::after').display), 'none', 'persistent errors do not show a countdown');
  await page.evaluate(() => { testState.copyFails = false; });
  await snap();
  await page.waitForFunction(() => document.getElementById('element-snap-overlay').shadowRoot.getElementById('toast-text').textContent === 'Copied to clipboard');
  assert.equal(await ui('toast-text').textContent(), 'Copied to clipboard');
  await page.evaluate(() => { testState.failCapture = true; });
  await snap();
  await page.clock.runFor(10000);
  assert.match(await ui('toast-text').textContent(), /Capture failed/);
  assert.equal(await ui('save').isVisible(), true);
  await ui('save').click();
  assert.deepEqual(await page.evaluate(() => testState.saves), ['capture-2']);
});

test('narrow layout fits and restarting capture mode starts with no result notification', async t => {
  const { page, ui, snap } = await setup(t, { width: 390 });
  await snap();
  const notification = await ui('toast').boundingBox();
  const help = await ui('help').boundingBox();
  assert.ok(notification.y + notification.height <= help.y, 'notification sits above the toolbar');
  assert.ok(help.y - (notification.y + notification.height) <= 24, 'notification stays close to the toolbar');
  assert.equal(notification.x + notification.width, 378);
  for (const id of ['toast', 'bar', 'help', 'save', 'download', 'toast-library', 'dismiss']) {
    const bounds = await ui(id).boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, `${id} fits horizontally`);
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 800, `${id} fits vertically`);
  }
  if (process.env.SNAPSHOT_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.SNAPSHOT_SCREENSHOT_DIR}/capture-narrow.png` });
  }
  await ui('close').click();
  assert.equal(await page.locator('#element-snap-overlay').count(), 0);
  await page.evaluate(() => window.__elementSnap.toggle());
  assert.equal(await ui('last-capture').count(), 0);
  assert.equal(await ui('toast').isVisible(), false);
  await snap();
  await ui('save').click();
  assert.deepEqual(await page.evaluate(() => testState.saves), ['capture-2']);
});

test('page scripts cannot read captured pixels from the popup or invoke its actions', async t => {
  const {page,snap}=await setup(t); await snap();
  const before=await page.evaluate(()=>JSON.stringify(testState));
  const exposed=await page.evaluate(()=>{
    const root=document.getElementById('element-snap-overlay').shadowRoot;
    for(const id of ['save','download']) root.getElementById(id).click();
    document.getElementById('target').click();
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    return /data:image|blob:|<img|<canvas/.test(root.innerHTML);
  });
  await page.clock.runFor(200);
  assert.equal(exposed,false);
  assert.equal(await page.evaluate(()=>JSON.stringify(testState)),before);
});

test('auto-copy off offers save and download without touching clipboard', async t => {
  const {page,ui,snap}=await setup(t,{autoCopy:false}); await snap();
  assert.equal(await page.evaluate(()=>testState.copies),0);
  assert.match(await ui('toast-text').textContent(),/Captured/);
  assert.equal(await ui('copy').count(),0);
  assert.equal(await ui('download').isVisible(),true);
  await ui('save').click(); assert.deepEqual(await page.evaluate(()=>testState.saves),['capture-1']);
});

test('notification close preserves capture; toolbar exit restores normal page clicks', async t => {
  const {page,ui,snap}=await setup(t);
  await snap();
  await ui('save').click();
  await snap();
  assert.equal(await page.evaluate(()=>testState.copies),2);
  await ui('dismiss').click();
  assert.equal(await ui('last-capture').count(),0);
  await ui('close').click();
  assert.equal(await page.locator('#element-snap-overlay').count(),0);
  await page.evaluate(()=>{ window.normalClicks=0; document.addEventListener('click',()=>window.normalClicks++); });
  await page.mouse.click(100,180);
  assert.equal(await page.evaluate(()=>window.normalClicks),1);
  assert.equal(await page.evaluate(()=>testState.copies),2);
});

test('keyboard-only element capture and coordinate area capture work', async t => {
  const {page, ui} = await setup(t);
  assert.equal(await ui('capture').evaluate(el => el === el.getRootNode().activeElement),true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.clock.runFor(200);
  await ui('save').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>testState.captures),1);
  await ui('area').focus(); await page.keyboard.press('Enter');
  await ui('area-x').fill('20'); await ui('area-y').fill('30');
  await ui('area-width').fill('120'); await ui('area-height').fill('80');
  await ui('capture').focus(); await page.keyboard.press('Enter');
  await page.clock.runFor(200);
  await page.waitForFunction(()=>testState.captures===2);
  await ui('save').click();
  assert.deepEqual(await page.evaluate(()=>testState.saves),['capture-2']);
});

test('toolbar moves out of the way of pinned page elements it would cover', async t => {
  const body = '<style>body{margin:0;height:100vh;background:#fff}#top{position:fixed;top:0;left:0;right:0;height:72px;background:#ddd}#banner{position:fixed;bottom:0;left:0;right:0;height:72px;background:#fc6}</style><header id="top">Header</header><div id="banner">Cookie banner</div>';
  const { page, ui } = await setup(t, { body });
  const hover = async (x, y) => { await page.mouse.move(x, y); await page.clock.runFor(50); };
  assert.ok((await ui('bar').boundingBox()).y > 600, 'toolbar starts at the bottom');
  await hover(20, 770);
  const bar = await ui('bar').boundingBox(), label = await ui('label').boundingBox(), dock = await ui('dock').boundingBox();
  assert.ok(bar.y < 120, 'toolbar moves to the top when it would cover the banner');
  assert.ok(label.y >= dock.y + dock.height && label.y + label.height <= 800, 'banner label stays visible');
  await hover(20, 20);
  assert.ok((await ui('bar').boundingBox()).y > 600, 'toolbar returns when it would cover the header');
  await hover(600, 400);
  assert.ok((await ui('bar').boundingBox()).y > 600, 'elements overlapping both positions do not make it jump');
});

for (const width of [1200, 390]) test(`capture actions stay reachable across sticky page elements at ${width}px`, async t => {
  const body = '<style>body{margin:0;height:100vh;background:#fff}header{position:fixed;top:0;left:0;right:0;height:72px;background:#ddd}footer{position:fixed;bottom:0;left:0;right:0;height:72px;background:#fc6}</style><header>Sticky header</header><footer>Sticky footer</footer>';
  const { page, ui, snap } = await setup(t, { body, width });
  const hover = async (x, y) => { await page.mouse.move(x, y); await page.clock.runFor(50); };
  const center = box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  const clickAt = async point => { await page.mouse.click(point.x, point.y); await page.clock.runFor(50); };
  await snap();
  const save = center(await ui('save').boundingBox());
  const toast = await ui('toast').boundingBox(), bar = await ui('bar').boundingBox();
  for (const y of [30, 770, 30]) {
    await hover(5, y);
    assert.deepEqual(await ui('toast').boundingBox(), toast, 'popup does not flee while approaching Save');
    assert.deepEqual(await ui('bar').boundingBox(), bar, 'toolbar cannot shift the popup indirectly');
  }
  await clickAt(save);
  assert.deepEqual(await page.evaluate(() => testState.saves), ['capture-1'], 'original Save coordinates still save the intended capture');
  assert.equal(await page.evaluate(() => testState.captures), 1, 'Save does not accidentally capture the page underneath');
  const download = center(await ui('download').boundingBox());
  await hover(5, 30);
  await clickAt(download);
  assert.deepEqual(await page.evaluate(() => testState.downloads), ['capture-1']);
  await ui('dismiss').click();
  assert.equal(await ui('last-capture').count(), 0);
});
