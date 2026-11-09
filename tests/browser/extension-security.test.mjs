import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdtemp, readFile, writeFile, cp, mkdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';

test('installed extension keeps pixels private and saves only sanitized source metadata', async t => {
  const root = resolve('.');
  await mkdir('artifacts', { recursive: true });
  const fixture = await mkdtemp(resolve('artifacts/extension-test-'));
  for (const entry of ['dist','icons','gallery.html','gallery.css','capture-help.html','capture-help.css']) await cp(join(root,entry), join(fixture,entry), { recursive:true });
  const manifest = JSON.parse(await readFile('manifest.json','utf8'));
  // Automated injection needs host access; production retains activeTab only.
  manifest.host_permissions = ['<all_urls>'];
  await writeFile(join(fixture,'manifest.json'),JSON.stringify(manifest));
  await mkdir(join(fixture,'profile','Default'),{recursive:true});
  await mkdir(join(fixture,'downloads'),{recursive:true});
  await writeFile(join(fixture,'profile','Default','Preferences'),JSON.stringify({download:{default_directory:join(fixture,'downloads'),prompt_for_download:false}}));
  const context = await chromium.launchPersistentContext(join(fixture,'profile'), {
    channel:'chromium', headless:true, downloadsPath:join(fixture,'downloads'),
    args:[`--disable-extensions-except=${fixture}`,`--load-extension=${fixture}`]
  });
  t.after(async () => { await context.close(); await rm(fixture, { recursive: true, force: true }); });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const page = await context.newPage();
  await page.route('https://snapshot.test/**', route => route.fulfill({contentType:'text/html',body:'<style>body{margin:0}article{height:600px;background:#d7e9f8}</style><article>Private capture fixture</article>'}));
  await page.goto('https://snapshot.test/example?token=private#secret'); await page.bringToFront();
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['dist/brand.js','dist/content.js']});
  });
  await page.evaluate(() => {
    document.querySelector('article').click();
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  });
  assert.equal(await worker.evaluate(async () => Object.keys(await chrome.storage.session.get(null)).length),0);
  await page.mouse.click(100,150);
  const ui=id=>page.locator('#element-snap-overlay #'+id);
  await ui('save').waitFor({state:'visible'});
  assert.equal(context.pages().length,2,'no new preview tab');
  assert.equal(await page.evaluate(()=>window.__elementSnap),undefined,'page cannot access isolated script state');
  assert.equal(await page.evaluate(()=>/data:image|blob:|<img|<canvas/.test(document.getElementById('element-snap-overlay').shadowRoot.innerHTML)),false);
  await page.evaluate(()=>{const root=document.getElementById('element-snap-overlay').shadowRoot;for(const id of ['save','download'])root.getElementById(id).click();});
  const result = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({url:'https://snapshot.test/*'});
    return (await chrome.scripting.executeScript({target:{tabId:tab.id},func:async () => {
      const answers=[]; for(const type of ['snap:save-draft','snap:download-draft','snap:discard-draft']) answers.push(await chrome.runtime.sendMessage({type,id:'guessed'}));
      let sessionReadable=false; try { await chrome.storage.session.get(null); sessionReadable=true; } catch {}
      return {answers,sessionReadable};
    }}))[0].result;
  });
  assert.equal(result.sessionReadable,false); assert.ok(result.answers.every(answer=>answer.ok===false));
  const readRecords=()=>worker.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('element-snap');
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('captures')){db.close();resolve([]);return;}
      const tx=db.transaction('captures');const records=tx.objectStore('captures').getAll();
      tx.oncomplete=()=>{db.close();resolve(records.result);};tx.onerror=()=>{db.close();reject(tx.error);};};
  }));
  assert.equal((await readRecords()).length,0,'synthetic Save was rejected');
  assert.equal(await worker.evaluate(async ()=>(await chrome.downloads.search({})).length),0,'synthetic Download was rejected');
  assert.equal(await ui('copy').count(),0);
  const cdp=await context.newCDPSession(page);
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:join(fixture,'downloads'),eventsEnabled:true});
  await ui('download').click(); await ui('toast-text').filter({hasText:'PNG download started.'}).waitFor();
  const downloaded=await worker.evaluate(async ()=>(await chrome.downloads.search({limit:1,orderBy:['-startTime']}))[0]);
  assert.match(downloaded.url,/^data:image\/png;base64,iVBORw0KGgo/);
  await ui('save').click(); await ui('toast-text').filter({hasText:'Saved to library.'}).waitFor();
  const records=await readRecords(); assert.equal(records.length,1); assert.equal(records[0].url,'https://snapshot.test/example');
  await page.setViewportSize({width:390,height:800});
  await page.screenshot({path:resolve('artifacts/popup-capture.png')});
  await ui('root').focus(); await page.keyboard.press('Escape');
  assert.equal(await worker.evaluate(async ()=>Object.keys(await chrome.storage.session.get(null)).length),1,'exit preserves the current draft');
  const gallery=await context.newPage();
  await gallery.goto(worker.url().replace('dist/background.js','gallery.html'));
  // Settings load asynchronously; the dialog opens only once they are filled in.
  await gallery.locator('#open-settings').click(); await gallery.locator('#settings-dialog').waitFor();
  assert.equal(await gallery.locator('#setting-auto-copy').isChecked(),true);
  assert.equal(await gallery.locator('#setting-auto-save').isChecked(),false);
  assert.equal(await gallery.locator('#setting-save-source').isChecked(),true);
  assert.equal(await gallery.locator('#setting-padding').inputValue(),'0','padding defaults to none');
  await gallery.locator('#setting-auto-copy').uncheck(); await gallery.locator('#setting-save-source').uncheck(); await gallery.locator('#setting-padding').selectOption('16'); assert.equal(await gallery.locator('#setting-theme').inputValue(),'system','theme defaults to system'); await gallery.locator('#setting-theme').selectOption('dark');
  await gallery.locator('#save-settings').click(); await gallery.locator('#settings-dialog').waitFor({state:'hidden'});
  await gallery.reload(); await gallery.locator('#open-settings').click(); await gallery.locator('#settings-dialog').waitFor();
  assert.equal(await gallery.locator('#setting-auto-copy').isChecked(),false);
  assert.equal(await gallery.locator('#setting-save-source').isChecked(),false);
  assert.equal(await gallery.locator('#setting-padding').inputValue(),'16','padding persists');
  assert.equal(await gallery.locator('#setting-theme').inputValue(),'dark','theme persists');
  assert.equal(await gallery.evaluate(()=>document.documentElement.dataset.theme),'dark','dark theme applied');
  assert.equal(await gallery.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(23, 26, 25)','dark surface in use');
  await gallery.locator('#setting-auto-copy').check(); await gallery.locator('#cancel-settings').click();
  await gallery.locator('#open-settings').click(); await gallery.locator('#settings-dialog').waitFor(); assert.equal(await gallery.locator('#setting-auto-copy').isChecked(),false);
  await gallery.setViewportSize({width:390,height:800});
  const box=await gallery.locator('#settings-dialog').boundingBox();assert.ok(box.x>=0 && box.x+box.width<=390);
  await gallery.screenshot({path:resolve('artifacts/settings.png')});
  await gallery.keyboard.press('Escape'); assert.equal(await gallery.locator('#settings-dialog').isVisible(),false);
  await page.bringToFront();
  await worker.evaluate(async () => {const [tab]=await chrome.tabs.query({active:true,currentWindow:true});await chrome.scripting.executeScript({target:{tabId:tab.id},files:['dist/brand.js','dist/content.js']});});
  await page.mouse.click(100,150); await ui('toast-text').filter({hasText:'Captured. Save to library'}).waitFor();
  const sessionDraft=await worker.evaluate(async ()=>Object.values(await chrome.storage.session.get(null))[0].draft);
  assert.equal(sessionDraft.title,'Snapshot');assert.equal(sessionDraft.url,'');
  await ui('save').click(); await ui('toast-text').filter({hasText:'Saved to library.'}).waitFor();
  const updated=await readRecords();assert.equal(updated.length,2);
  assert.ok(updated.some(r=>r.title==='Snapshot' && r.url===''));
  assert.ok(updated.some(r=>r.url==='https://snapshot.test/example'),'existing metadata remains intact');
  await gallery.bringToFront(); await gallery.locator('#toggle-sidebar').click(); await gallery.locator('#open-settings').click(); await gallery.locator('#settings-dialog').waitFor();
  await gallery.locator('#setting-auto-save').check(); await gallery.locator('#save-settings').click();
  await gallery.reload(); await gallery.locator('#toggle-sidebar').click(); await gallery.locator('#open-settings').click(); await gallery.locator('#settings-dialog').waitFor();
  assert.equal(await gallery.locator('#setting-auto-save').isChecked(),true);
  await gallery.locator('#cancel-settings').click();
  await page.bringToFront(); await page.mouse.click(100,150);
  await ui('toast-text').filter({hasText:'Captured and saved to library.'}).waitFor();
  assert.equal(await ui('save').isDisabled(),true);
  assert.equal((await readRecords()).length,3);
  await worker.evaluate(()=>{
    const original=IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add=function(...args){ IDBObjectStore.prototype.add=original; throw new DOMException('Test quota failure','QuotaExceededError'); };
  });
  await page.mouse.click(100,150);
  await ui('toast-text').filter({hasText:'automatic save failed'}).waitFor();
  assert.equal((await readRecords()).length,3,'failed auto-save does not claim success');
  assert.equal(await ui('save').isEnabled(),true);
  await ui('save').click(); await ui('toast-text').filter({hasText:'Saved to library.'}).waitFor();
  assert.equal((await readRecords()).length,4,'draft can be saved after automatic save failure');
  await page.reload();
  await page.waitForTimeout(100);
  assert.equal(await worker.evaluate(async ()=>Object.keys(await chrome.storage.session.get(null)).length),0,'navigation clears draft');
  // Named single download and a ZIP of several, through the real downloads API.
  await gallery.bringToFront(); await gallery.reload(); await gallery.locator('.card').first().waitFor();
  const ids=(await readRecords()).map(r=>r.id);
  await gallery.evaluate(async id=>{const {renameCapture}=await import('/dist/db.js');await renameCapture(id,'Release notes card');},ids[0]);
  await gallery.reload(); await gallery.locator('.card').first().waitFor();
  // The test browser saves every file as download.png, so record the filename Snapshot asks Chrome for.
  const recordNames=()=>{const original=chrome.downloads.download.bind(chrome.downloads);self.__names=[];chrome.downloads.download=options=>{self.__names.push(options.filename);return original(options);};};
  await worker.evaluate(recordNames); await gallery.evaluate(recordNames);
  const downloads=()=>worker.evaluate(async ()=>(await chrome.downloads.search({orderBy:['-startTime']})).map(d=>({file:d.filename,state:d.state,mime:d.mime})));
  await gallery.locator(`.card[data-id="${ids[0]}"] .download-snapshot`).click();
  await gallery.waitForFunction(()=>document.getElementById('notice').textContent.includes('PNG download started'));
  assert.deepEqual(await worker.evaluate(()=>self.__names),['Snapshot/Release notes card.png'],'renamed snapshot downloads under its name');
  const before=(await downloads()).length;
  await gallery.locator('#select-mode').click(); await gallery.locator('#select-all').check();
  await gallery.locator('#download-selected').click();
  await gallery.waitForFunction(()=>document.getElementById('notice').textContent.includes('ZIP of'));
  const [zipName]=await gallery.evaluate(()=>self.__names);
  assert.match(zipName,/^Snapshot\/Snapshot \d{4}-\d{2}-\d{2} \(\d+ images\)\.zip$/);
  let zip; for(let i=0;i<150 && !((await downloads()).length>before && (zip=(await downloads())[0]).state==='complete');i++) await gallery.waitForTimeout(100);
  assert.equal(zip?.state,'complete','ZIP download completed');
  const bytes=await readFile(zip.file);
  assert.equal(bytes.readUInt32LE(0),0x04034b50,'ZIP starts with a local file header');
  assert.ok(bytes.includes(Buffer.from('Release notes card.png')),'ZIP uses the snapshot name');
  assert.ok(bytes.includes(Buffer.from('capture-')),'unnamed snapshots keep timestamp names');
  await gallery.locator('#cancel-selection').click();
  const tabsBefore=context.pages().length;
  await page.bringToFront();
  await gallery.evaluate(()=>chrome.runtime.sendMessage({type:'snap:gallery'}));
  await gallery.waitForTimeout(200);
  assert.equal(context.pages().length,tabsBefore,'open library tab is reused');
  const newest=(await readRecords()).sort((a,b)=>b.createdAt-a.createdAt)[0];
  await gallery.evaluate(id=>chrome.runtime.sendMessage({type:'snap:gallery',id}),newest.id);
  await gallery.locator('#viewer').waitFor({state:'visible'});
  assert.equal(context.pages().length,tabsBefore,'library tab is reused when opening a specific capture');

});
