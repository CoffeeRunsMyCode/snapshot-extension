// README assets only: synthetic page and records, mocked clipboard, isolated contexts.
// Creates docs/images/demo.gif (capture flow) and docs/images/library-dark.png.
import { chromium } from 'playwright';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('docs/images/', root);
await mkdir(output, { recursive: true });
const W = 960, H = 600;

const page = `<!doctype html><html lang="en"><head><title>Fieldnotes — Example workspace</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f4ef;color:#26352c;font:16px/1.6 'Segoe UI',sans-serif}
header{padding:22px 56px;border-bottom:1px solid #d8ddd5;display:flex;justify-content:space-between}header span{font-size:13px;color:#58665b}
main{max-width:850px;margin:44px auto 0;padding:0 24px}.eyebrow{font-size:12px;letter-spacing:2px;color:#32664f;margin:0}
h1{font-size:44px;line-height:1.15;letter-spacing:-1.5px;margin:14px 0 8px}
.row{display:flex;gap:20px;margin-top:26px}section{background:#e6eee7;border:1px solid #c4d2c6;border-radius:12px;padding:26px;flex:1}
section.b{background:#eee9dd;border-color:#dbd2bf}h2{font-size:24px;margin:0 0 8px}p{margin:0 0 14px}
button{background:#26352c;color:white;padding:10px 18px;border:0;border-radius:5px;font:inherit}
.price{font-size:34px;font-weight:700;margin:0 0 10px}#cursor{position:fixed;z-index:2147483647;pointer-events:none;width:20px;height:28px;left:0;top:0}
</style></head><body><header><strong>FIELDNOTES</strong><span>A synthetic example website</span></header><main>
<p class="eyebrow">SPACE FOR GOOD IDEAS</p><h1>Collect a little inspiration.</h1><p>A useful detail can become your next starting point.</p>
<div class="row"><section><h2>A calmer workspace</h2><p>Keep the references that help you think.</p><button>Explore</button></section>
<section class="b"><h2>Simple, by design.</h2><p class="price">$0</p><p>One plan. Everything you need.</p></section></div></main>
<svg id="cursor" viewBox="0 0 20 28"><path d="M2 2v21l5.5-5 3.6 8 3.4-1.5-3.5-7.8H18z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>
</body></html>`;

const browser = await chromium.launch({ headless: true, executablePath: process.env.SNAPSHOT_CHROMIUM_PATH || undefined });
try {
  // Decode PNG screenshots to RGBA in a helper page (no image library needed).
  const decoder = await (await browser.newContext()).newPage();
  const rgba = async png => new Uint8Array(Buffer.from(await decoder.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000));
    return btoa(s);
  }, png.toString('base64')), 'base64'));
  const frames = [];
  // Set SNAPSHOT_FRAMES_DIR to also save each frame as a PNG for visual review.
  const shoot = async (target, delay) => {
    const png = await target.screenshot();
    if (process.env.SNAPSHOT_FRAMES_DIR) await writeFile(`${process.env.SNAPSHOT_FRAMES_DIR}/frame-${String(frames.length).padStart(2, '0')}.png`, png);
    frames.push({ data: await rgba(png), delay });
  };

  // 1. Capture flow on a synthetic page.
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const p = await ctx.newPage();
  await p.route('https://example.com/**', route => route.fulfill({ contentType: 'text/html', body: page }));
  await p.goto('https://example.com/workspace');
  await p.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async () => {} } });
    window.ClipboardItem = class { constructor(value) { this.value = value; } };
    window.chrome = { runtime: { onMessage: { addListener() {} }, sendMessage: async message => {
      if (message.type === 'snap:capture') {
        const canvas = document.createElement('canvas'); canvas.width = Math.round(message.rect.width); canvas.height = Math.round(message.rect.height);
        return { ok: true, autoCopy: true, draft: { id: 'demo-draft', width: canvas.width, height: canvas.height, dataURL: canvas.toDataURL() } };
      }
      return { ok: true };
    } } };
  });
  let pos = [420, 219];
  const moveTo = async (x, y, steps, delay = 60) => {
    for (let i = 1; i <= steps; i++) {
      const nx = pos[0] + (x - pos[0]) * i / steps, ny = pos[1] + (y - pos[1]) * i / steps;
      await p.mouse.move(nx, ny);
      await p.evaluate(([cx, cy]) => { const c = document.getElementById('cursor'); c.style.left = cx + 'px'; c.style.top = cy + 'px'; }, [nx, ny]);
      await shoot(p, delay);
    }
    pos = [x, y];
  };
  await p.evaluate(([cx, cy]) => { const c = document.getElementById('cursor'); c.style.left = cx + 'px'; c.style.top = cy + 'px'; }, pos);
  await shoot(p, 700);
  await p.addScriptTag({ path: fileURLToPath(new URL('dist/brand.js', root)) });
  await p.addScriptTag({ path: fileURLToPath(new URL('dist/content.js', root)) });
  await p.mouse.move(pos[0] + 1, pos[1]);
  await p.mouse.move(...pos);
  await p.waitForTimeout(300);
  await shoot(p, 1400);                 // capture mode starts: gesture hint visible
  await moveTo(330, 175, 6);            // over the heading
  await shoot(p, 700);
  await moveTo(560, 370, 6);            // over the pricing card
  await shoot(p, 600);
  await moveTo(150, 330, 7);            // over the workspace card
  await shoot(p, 800);
  await p.mouse.click(150, 330);
  await p.locator('#element-snap-overlay #toast.success').waitFor({ state: 'visible' });
  await p.waitForTimeout(250);
  await shoot(p, 2600);                 // "Copied to clipboard"
  await ctx.close();

  // 2. The library, with the same synthetic records as the guide.
  const library = async (colorScheme, path) => {
    const lctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme, locale: 'en-US', timezoneId: 'Asia/Singapore' });
    const l = await lctx.newPage();
    await l.route('https://snapshot.test/**', async route => {
      const file = new URL(route.request().url()).pathname.slice(1) || 'gallery.html';
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
      await route.fulfill({ contentType: type, body: await readFile(new URL(file, root)) });
    });
    await l.addInitScript(() => {
      const values = { settings: { autoCopy: true, autoSave: false, saveSource: true, theme: 'system' } };
      window.chrome = { storage: { local: { get: async key => ({ [key]: values[key] }), set: async value => Object.assign(values, value) } } };
    });
    await l.goto('https://snapshot.test/gallery.html');
    await l.locator('#empty').waitFor({ state: 'visible' });
    await l.evaluate(async () => {
      const { createFolder, changeCaptures } = await import('/dist/db.js');
      const folder = await createFolder('Design references');
      const items = [
        ['A calmer workspace', 'example.com/workspace', '#e6eee7', 'A calmer workspace', 'Keep the references that help you think.'],
        ['A useful pricing card', 'example.com/pricing', '#eee9dd', 'Simple, by design.', 'One plan. Everything you need.'],
        ['Notes worth keeping', 'journal.example/notes', '#e4eaf0', 'Small observations.', 'Good ideas start with noticing.']
      ];
      const records = [];
      for (const [i, [title, url, color, headline, subtitle]] of items.entries()) {
        const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
        const c = canvas.getContext('2d'); c.fillStyle = color; c.fillRect(0, 0, 640, 360);
        c.fillStyle = '#32664f'; c.font = '14px sans-serif'; c.fillText('FIELDNOTES / EXAMPLE', 40, 60);
        c.fillStyle = '#242a26'; c.font = 'bold 34px sans-serif'; c.fillText(headline, 40, 165);
        c.font = '20px sans-serif'; c.fillText(subtitle, 40, 205);
        records.push({ id: `demo-${i}`, title, url: `https://${url}`, label: 'Section', blob: await new Promise(r => canvas.toBlob(r)),
          createdAt: new Date('2026-11-02T12:00:00+08:00').getTime() - i * 3600000,
          width: 640, height: 360, clipped: false, favorite: i === 0, folderId: i < 2 ? folder.id : undefined });
      }
      await changeCaptures(records);
    });
    await l.reload();
    await l.locator('.card').nth(2).waitFor();
    if (path) await l.screenshot({ path: fileURLToPath(new URL(path, output)) });
    else await shoot(l, 3200);
    await lctx.close();
  };
  await library('light');
  await library('dark', 'library-dark.png');

  const gif = GIFEncoder();
  for (const { data, delay } of frames) {
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), W, H, { palette, delay });
  }
  gif.finish();
  await writeFile(new URL('demo.gif', output), gif.bytes());
  console.log(`Created docs/images/demo.gif (${frames.length} frames, ${(gif.bytes().length / 1024).toFixed(0)} KB) and library-dark.png from synthetic content. Review before publishing.`);
} finally { await browser.close(); }
