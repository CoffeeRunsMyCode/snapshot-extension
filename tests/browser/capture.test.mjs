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
async function setup(t, { copyFails = false, autoCopy = true, width = 1200, body = defaultBody, settings } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  page.setDefaultTimeout(8000);
  t.after(() => page.close());
  await page.route('https://snapshot.test/', route => route.fulfill({ contentType: 'text/html', body }));
  await page.goto('https://snapshot.test/');
  const clean = await page.screenshot();
  const captures = [];
  // Screenshot the real painted page at the point where the worker would capture.
  // Chrome messaging, storage and clipboard are mocked; browser rendering is real.
  await page.exposeFunction('recordCapture', async () => {
    captures.push(await page.screenshot());
  });
  await page.evaluate(({ copyFails, autoCopy, settings }) => {
    window.testState = { captures: 0, copies: 0, libraryOpens: 0, saves: [], downloads: [], failCapture: false, copyFails, requests: [] };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async () => {
      if (window.testState.copyFails) throw Error('Clipboard blocked');
      window.testState.copies++;
    } } });
    window.ClipboardItem = class { constructor(value) { this.value = value; } };
    window.chrome = { storage: { local: { get: async () => ({ settings }) } }, runtime: { onMessage: { addListener() {} }, sendMessage: async message => {
      if (message.type === 'snap:capture') {
        window.testState.requests.push({ rect: message.rect, label: message.label });
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
  }, { copyFails, autoCopy, settings });
  await page.addScriptTag({ path: root + 'dist/brand.js' });
  await page.addScriptTag({ path: root + 'dist/content.js' });
  await page.clock.install();
  const ui = id => page.locator(`#element-snap-overlay #${id}`);
  const active = async () => await page.locator('#element-snap-overlay').count() === 1;
  const focused = () => page.evaluate(() => document.getElementById('element-snap-overlay')?.shadowRoot.activeElement?.id);
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
  return { page, ui, snap, clean, captures, active, focused };
}

test('repeated captures exclude every overlay pixel, even with an expanded panel', async t => {
  const { page, ui, snap, clean, captures } = await setup(t);
  await snap();
  assert.equal(await ui('toast-text').textContent(), 'Copied to clipboard');
  for (const id of ['save', 'download']) assert.equal(await ui(id).isVisible(), true);
  const notification = await ui('toast').boundingBox();
  assert.ok(notification.width < 330, 'popup fits its two remaining actions');
  assert.equal(notification.y, 24);
  assert.equal(notification.x + notification.width, 1176);
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
  await snap();
  assert.deepEqual(captures[2], clean, 'another capture works after hiding the result');
});

test('initial notification hides after five idle seconds without affecting copy or capture mode', async t => {
  const { page, ui, snap, active } = await setup(t);
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
  assert.equal(await active(), true);
  await snap();
  await ui('download').click();
  await ui('save').click();
  assert.deepEqual(await page.evaluate(() => testState.downloads), ['capture-2']);
  assert.deepEqual(await page.evaluate(() => testState.saves), ['capture-2']);
  assert.equal(await ui('save').isDisabled(), true);
});

test('auto-hide pauses during hover and keyboard use; manual dismissal keeps capture mode active', async t => {
  const { page, ui, snap, active, focused } = await setup(t);
  await snap();
  await ui('toast-text').hover();
  await page.clock.runFor(5000);
  assert.equal(await ui('toast').isVisible(), true);
  await page.mouse.move(10, 10);
  await ui('save').focus();
  await page.clock.runFor(5000);
  assert.equal(await ui('toast').isVisible(), true);
  await ui('root').focus();
  await page.clock.runFor(5100);
  assert.equal(await ui('toast').isVisible(), false);
  assert.equal(await ui('last-capture').count(), 0);
  await snap();
  await ui('dismiss').click();
  assert.equal(await focused(), 'root', 'dismissal returns keyboard focus to the capture region');
  assert.equal(await ui('notifications').evaluate(el => el.getBoundingClientRect().height), 0, 'nothing floats over the page after dismissal');
  assert.equal(await active(), true, 'capture mode stays enabled');
  await snap();
  assert.equal(await page.evaluate(() => testState.captures), 3, 'another capture works without restarting');
  await ui('toast-library').focus();
  await page.keyboard.press('Escape');
  assert.equal(await active(), false);
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
  await ui('root').focus();
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
  const { page, ui, snap, active } = await setup(t, { width: 390 });
  const hint = await ui('hint').boundingBox();
  assert.ok(hint.x >= 0 && hint.x + hint.width <= 390 && hint.y + hint.height <= 800, 'start hint fits');
  await snap();
  const notification = await ui('toast').boundingBox();
  assert.equal(notification.y + notification.height, 788, 'notification sits at the bottom within thumb reach');
  assert.equal(notification.x + notification.width, 378);
  await ui('root').focus();
  await page.keyboard.press('a');
  const fields = await ui('area-fields').boundingBox(), raised = await ui('toast').boundingBox();
  assert.equal(raised.y, 12, 'with the coordinates panel open, the notification moves to the top');
  assert.ok(fields.x >= 0 && fields.x + fields.width <= 390 && fields.y + fields.height <= 800, 'coordinates panel fits');
  await page.keyboard.press('Escape');
  assert.equal(await ui('toast').boundingBox().then(b => b.y + b.height), 788);
  for (const id of ['toast', 'save', 'download', 'toast-library', 'dismiss']) {
    const bounds = await ui(id).boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, `${id} fits horizontally`);
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 800, `${id} fits vertically`);
  }
  if (process.env.SNAPSHOT_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.SNAPSHOT_SCREENSHOT_DIR}/capture-narrow.png` });
  }
  await ui('root').focus();
  await page.keyboard.press('Escape');
  assert.equal(await active(), false);
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
    for(const id of ['save','download','area-capture']) root.getElementById(id).click();
    document.getElementById('target').click();
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));
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

test('notification close preserves capture; Escape exit restores normal page clicks', async t => {
  const {page,ui,snap,active}=await setup(t);
  await snap();
  await ui('save').click();
  await snap();
  assert.equal(await page.evaluate(()=>testState.copies),2);
  await ui('dismiss').click();
  assert.equal(await ui('last-capture').count(),0);
  await page.keyboard.press('Escape');
  assert.equal(await active(),false);
  await page.evaluate(()=>{ window.normalClicks=0; document.addEventListener('click',()=>window.normalClicks++); });
  await page.mouse.click(100,180);
  assert.equal(await page.evaluate(()=>window.normalClicks),1);
  assert.equal(await page.evaluate(()=>testState.copies),2);
});

test('keyboard-only element capture and coordinate area capture work', async t => {
  const {page, ui, focused, active} = await setup(t);
  assert.equal(await focused(), 'root', 'capture region takes focus so shortcuts work at once');
  assert.match(await ui('root').getAttribute('aria-label'), /Arrow keys.*Enter.*A enters area coordinates.*Escape/);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.clock.runFor(200);
  await ui('save').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>testState.captures),1);
  await ui('root').focus();
  await page.keyboard.press('a');
  assert.equal(await ui('area-fields').isVisible(), true);
  assert.equal(await focused(), 'area-x', 'coordinates panel takes focus');
  await ui('area-x').fill('20'); await ui('area-y').fill('30');
  await ui('area-width').fill('120'); await ui('area-height').fill('80');
  await ui('area-height').press('Enter');
  await page.clock.runFor(200);
  await page.waitForFunction(()=>testState.captures===2);
  assert.deepEqual(await page.evaluate(()=>testState.requests[1]), { rect: { x: 20, y: 30, width: 120, height: 80 }, label: 'Area selection' });
  await ui('save').click();
  assert.deepEqual(await page.evaluate(()=>testState.saves),['capture-2']);
  await ui('area-x').focus();
  await page.keyboard.press('Escape');
  assert.equal(await ui('area-fields').isVisible(), false, 'Escape in the panel closes it');
  assert.equal(await active(), true, 'and keeps capture mode on');
  assert.equal(await focused(), 'root');
  await page.keyboard.press('a');
  await ui('area-cancel').focus();
  await page.keyboard.press('Enter');
  assert.equal(await ui('area-fields').isVisible(), false, 'Enter on Cancel cancels instead of capturing');
  assert.equal(await page.evaluate(()=>testState.captures), 2);
});

test('no toolbar: nothing but the outline sits over the page once the start hint fades', async t => {
  const body = '<style>body{margin:0;height:100vh;background:#fff}#banner{position:fixed;bottom:0;left:0;right:0;height:72px;background:#fc6}</style><div id="banner">Cookie banner</div>';
  const { page, ui } = await setup(t, { body });
  for (const id of ['dock', 'bar', 'capture', 'element', 'area', 'padding', 'close']) assert.equal(await ui(id).count(), 0, `no #${id}`);
  assert.equal(await ui('hint').isVisible(), true, 'a hint explains the gestures at the start');
  assert.match(await ui('hint-text').textContent(), /Click to capture.*Drag for an area.*Esc/);
  assert.equal(await ui('hint').evaluate(el => getComputedStyle(el).pointerEvents), 'none', 'the hint never takes clicks');
  const hint = await ui('hint').boundingBox();
  await page.mouse.click(hint.x + hint.width / 2, hint.y + hint.height / 2);
  await page.clock.runFor(200);
  await page.waitForFunction(() => testState.captures === 1);
  assert.equal(await page.evaluate(() => testState.requests[0].rect.y), 728, 'clicking where the hint was captures the banner underneath');
  assert.equal(await ui('hint').isVisible(), false, 'capturing hides the hint');
});

test('the start hint fades by itself after a few seconds', async t => {
  const { page, ui } = await setup(t);
  // Restart capture mode so the hint timer runs on the test clock.
  await page.evaluate(() => { window.__elementSnap.toggle(); window.__elementSnap.toggle(); });
  await page.clock.runFor(3900);
  assert.equal(await ui('hint').isVisible(), true);
  await page.clock.runFor(500);
  assert.equal(await ui('hint').isVisible(), false);
});

test('dragging captures an area; a small wobble while clicking still captures the element', async t => {
  const { page, ui } = await setup(t);
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(300, 250, { steps: 6 });
  await page.clock.runFor(50);
  assert.match(await ui('label').textContent(), /^Area selection · 200 × 150/);
  await page.mouse.up();
  await page.clock.runFor(200);
  await page.waitForFunction(() => testState.captures === 1);
  assert.deepEqual(await page.evaluate(() => testState.requests[0]), { rect: { x: 100, y: 100, width: 200, height: 150 }, label: 'Area selection' }, 'only the area is captured, not an element as well');
  await page.mouse.move(400, 400);
  await page.clock.runFor(50);
  assert.match(await ui('label').textContent(), /^Heading|^Element|^Article/, 'moving afterwards returns to element selection');
  await page.mouse.move(60, 40);
  await page.mouse.down();
  await page.mouse.move(62, 42);
  await page.mouse.up();
  await page.clock.runFor(200);
  await page.waitForFunction(() => testState.captures === 2);
  assert.equal(await page.evaluate(() => testState.requests[1].label), 'Element');
});

test('an area drag released over the notification still finishes the capture', async t => {
  const { page, ui, snap } = await setup(t);
  await snap();
  const toast = await ui('toast').boundingBox();
  await page.mouse.move(100, 300);
  await page.mouse.down();
  await page.mouse.move(toast.x + 20, toast.y + toast.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.clock.runFor(200);
  await page.waitForFunction(() => testState.captures === 2);
  assert.equal(await page.evaluate(() => testState.requests[1].label), 'Area selection');
  await page.mouse.move(300, 500);
  await page.clock.runFor(50);
  assert.doesNotMatch(await ui('label').textContent(), /^Area/, 'the drag does not stay stuck after release');
});

test('capture padding comes from Settings', async t => {
  const body = '<style>body{margin:0;background:#fff}#box{position:absolute;left:200px;top:200px;width:100px;height:50px;background:#fc6}</style><div id="box"></div>';
  const { page, ui } = await setup(t, { body, settings: { padding: 16 } });
  await page.mouse.move(250, 225);
  await page.clock.runFor(50);
  assert.match(await ui('label').textContent(), /132 × 82/);
  await page.mouse.click(250, 225);
  await page.clock.runFor(200);
  await page.waitForFunction(() => testState.captures === 1);
  assert.deepEqual(await page.evaluate(() => testState.requests[0].rect), { x: 184, y: 184, width: 132, height: 82 });
});

for (const width of [1200, 390]) test(`capture actions stay reachable across sticky page elements at ${width}px`, async t => {
  const body = '<style>body{margin:0;height:100vh;background:#fff}header{position:fixed;top:0;left:0;right:0;height:72px;background:#ddd}footer{position:fixed;bottom:0;left:0;right:0;height:72px;background:#fc6}</style><header>Sticky header</header><footer>Sticky footer</footer>';
  const { page, ui, snap } = await setup(t, { body, width });
  const hover = async (x, y) => { await page.mouse.move(x, y); await page.clock.runFor(50); };
  const center = box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  const clickAt = async point => { await page.mouse.click(point.x, point.y); await page.clock.runFor(50); };
  await snap();
  const save = center(await ui('save').boundingBox());
  const toast = await ui('toast').boundingBox();
  for (const y of [30, 770, 30]) {
    await hover(5, y);
    assert.deepEqual(await ui('toast').boundingBox(), toast, 'popup does not flee while approaching Save');
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
