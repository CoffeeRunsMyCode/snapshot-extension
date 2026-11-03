// Documentation assets only: synthetic records, mocked clipboard, isolated contexts.
import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('docs/images/', root);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.SNAPSHOT_CHROMIUM_PATH || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, locale: 'en-US', timezoneId: 'Asia/Singapore' });
  const page = await context.newPage();
  await page.route('https://snapshot.test/**', async route => {
    const path = new URL(route.request().url()).pathname.slice(1) || 'gallery.html';
    const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html';
    await route.fulfill({ contentType: type, body: await readFile(new URL(path, root)) });
  });
  await page.addInitScript(() => {
    const values = { settings: { autoCopy: true, autoSave: false, saveSource: true } };
    window.chrome = { storage: { local: {
      get: async key => ({ [key]: values[key] }),
      set: async value => Object.assign(values, value)
    } } };
  });
  await page.goto('https://snapshot.test/gallery.html');
  await page.locator('#empty').waitFor({ state: 'visible' });
  await page.evaluate(async () => {
    const { createFolder, changeCaptures } = await import('/dist/db.js');
    const folder = await createFolder('Design references');
    const records = [];
    const items = [
      ['A calmer workspace', 'example.com/workspace', '#e6eee7', 'A calmer workspace', 'Room to do your best work.'],
      ['A useful pricing card', 'example.com/pricing', '#eee9dd', 'Simple, by design.', 'One plan. Everything you need.'],
      ['Notes worth keeping', 'journal.example/notes', '#e4eaf0', 'Small observations.', 'Good ideas start with noticing.']
    ];
    for (const [i, [title, url, color, headline, subtitle]] of items.entries()) {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#32664f'; ctx.font = '14px sans-serif'; ctx.fillText('FIELDNOTES / EXAMPLE', 40, 60);
      ctx.fillStyle = '#242a26'; ctx.font = 'bold 34px sans-serif'; ctx.fillText(headline, 40, 165);
      ctx.font = '20px sans-serif'; ctx.fillText(subtitle, 40, 205);
      const blob = await new Promise(resolve => canvas.toBlob(resolve));
      records.push({ id: `guide-${i}`, title, url: `https://${url}`, label: 'Section', blob,
        createdAt: new Date('2026-11-02T12:00:00+08:00').getTime() - i * 3600000,
        width: 640, height: 360, clipped: false, favorite: i === 0, folderId: i < 2 ? folder.id : undefined });
    }
    await changeCaptures(records);
  });
  await page.reload();
  await page.locator('.card').nth(2).waitFor();
  await page.screenshot({ path: fileURLToPath(new URL('library.png', output)) });
  await page.locator('#open-settings').click();
  await page.locator('#settings-dialog').waitFor({ state: 'visible' });
  // A smaller viewport makes the settings screenshot readable in the guide.
  await page.setViewportSize({ width: 760, height: 640 });
  await page.screenshot({ path: fileURLToPath(new URL('settings.png', output)) });
  await context.close();

  const captureContext = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const capture = await captureContext.newPage();
  await capture.route('https://example.com/**', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><head><title>Fieldnotes — Example workspace</title><style>
    *{box-sizing:border-box}body{margin:0;background:#f5f4ef;color:#26352c;font:17px/1.6 'Segoe UI',sans-serif}header{padding:26px 70px;border-bottom:1px solid #d8ddd5;display:flex;justify-content:space-between}header span{font-size:14px;color:#58665b}main{max-width:1000px;margin:70px auto}.eyebrow{font-size:13px;letter-spacing:2px;color:#32664f}h1{font-size:54px;line-height:1.15;letter-spacing:-2px;margin:20px 0}section{background:#e6eee7;border:1px solid #c4d2c6;border-radius:12px;padding:38px;max-width:650px}h2{font-size:30px;margin:0 0 12px}p{max-width:550px}button{background:#26352c;color:white;padding:12px 20px;border:0;border-radius:5px;font:inherit}</style></head><body><header><strong>FIELDNOTES</strong><span>A synthetic example website</span></header><main><p class="eyebrow">SPACE FOR GOOD IDEAS</p><h1>Collect a little inspiration.</h1><p>A useful detail can become your next starting point.</p><section><h2>A calmer workspace</h2><p>Keep the references that help you think. Make room for the work you want to do.</p><button>Explore the collection</button></section></main></body></html>` }));
  await capture.goto('https://example.com/workspace');
  await capture.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async () => {} } });
    window.ClipboardItem = class { constructor(value) { this.value = value; } };
    window.chrome = { runtime: { onMessage: { addListener() {} }, sendMessage: async message => {
      if (message.type === 'snap:capture') {
        const canvas = document.createElement('canvas'); canvas.width = Math.round(message.rect.width); canvas.height = Math.round(message.rect.height);
        return { ok: true, autoCopy: true, draft: { id: 'guide-draft', width: canvas.width, height: canvas.height, dataURL: canvas.toDataURL() } };
      }
      return { ok: true };
    } } };
  });
  await capture.addScriptTag({ path: fileURLToPath(new URL('dist/brand.js', root)) });
  await capture.addScriptTag({ path: fileURLToPath(new URL('dist/content.js', root)) });
  await capture.mouse.move(120, 340);
  await capture.mouse.click(120, 340);
  await capture.locator('#element-snap-overlay #toast.success').waitFor({ state: 'visible' });
  await capture.screenshot({ path: fileURLToPath(new URL('capture.png', output)) });
  await captureContext.close();
  console.log('Created docs/images/{capture,library,settings}.png from synthetic content. Review before publishing.');
} finally { await browser.close(); }
