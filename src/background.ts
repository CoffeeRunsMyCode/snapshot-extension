import { privateSourceUrl } from "./privacy.js";
import { getSettings } from "./settings.js";
import { cropBounds, filename } from "./geometry.js";
import { saveCapture, getCapture, deleteCapture } from "./db.js";

const draftKey = (tabId: number) => "captureDraft:" + tabId;
chrome.tabs.onRemoved.addListener((tabId: number) => {
  void withDraft(() => chrome.storage.session.remove(draftKey(tabId))).catch(() => {});
});
chrome.tabs.onUpdated?.addListener((tabId: number, change: { status?: string }) => {
  if (change.status === "loading") {
    void withDraft(() => chrome.storage.session.remove(draftKey(tabId))).catch(() => {});
    void chrome.action.setPopup({ tabId, popup: "" }).catch(() => {});
    void chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
  }
});
let captureBusy = false;
let lastCapture = 0;
// Serialize draft replacement with reads/actions so a delayed discard cannot erase a newer capture.
let draftQueue: Promise<unknown> = Promise.resolve();
function withDraft<T>(run: () => Promise<T>): Promise<T> {
  const next = draftQueue.then(run, run);
  draftQueue = next.catch(() => {});
  return next;
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function openGallery(id?: string) {
  const url = new URL(chrome.runtime.getURL("gallery.html"));
  if (id) url.hash = id;
  return chrome.tabs.create({ url: url.href });
}
async function start(tab: { id?: number; url?: string }) {
  if (!tab.id) return;
  try {
    await chrome.action.setPopup({ tabId: tab.id, popup: "" });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
    await chrome.action.setTitle({ tabId: tab.id, title: "Snapshot — click to capture; right-click for library" });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["dist/brand.js", "dist/content.js"] });
    return true;
  } catch {
    // A failed snip must never take the user away from the page they wanted to capture.
    await Promise.allSettled([
      chrome.action.setPopup({ tabId: tab.id, popup: "capture-help.html" }),
      chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#AD4C2A" }),
      chrome.action.setBadgeText({ tabId: tab.id, text: "!" }),
      chrome.action.setTitle({ tabId: tab.id, title: "Cannot snip this page. Try a regular website or reload the page. For local files, enable ‘Allow access to file URLs’ in extension details. Right-click for library." })
    ]);
    try { await chrome.action.openPopup(); } catch { /* Older Chrome: next toolbar click opens help. */ }
    return false;
  }
}
chrome.action.onClicked.addListener(start);
chrome.commands.onCommand.addListener((command: string) => {
  if (command === "open-gallery") void openGallery();
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "open-library", title: "Open library", contexts: ["action"] });
  });
});
chrome.contextMenus.onClicked.addListener((info: { menuItemId: string | number }) => {
  if (info.menuItemId === "open-library") void openGallery();
});

async function blobDataURL(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:image/png;base64,${btoa(binary)}`;
}
async function assertActive(tabId: number, windowId: number) {
  const [active] = await chrome.tabs.query({ active: true, windowId });
  const window = await chrome.windows.get(windowId);
  if (active?.id !== tabId || !window.focused) throw new Error("Keep this tab and Chrome window active while capturing.");
}
async function capture(message: any, sender: any) {
  if (captureBusy) throw new Error("A capture is already in progress. Please try again.");
  if (!sender.tab?.id || sender.frameId !== 0) throw new Error("Capture must start from the selected page.");
  captureBusy = true;
  try {
    const settings = await getSettings();
    const tab = sender.tab;
    // Chrome allows two screenshots per second; leave margin between attempts.
    await sleep(Math.max(0, 600 - (Date.now() - lastCapture)));
    await assertActive(tab.id, tab.windowId);
    const target = sender.documentId ? { documentId: sender.documentId } : { frameId: 0 };
    const before = await chrome.tabs.sendMessage(tab.id, { type: "snap:validate", token: message.token }, target);
    if (!before?.valid) throw new Error("The page moved. Select the element and try again.");
    lastCapture = Date.now();
    const data = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    await assertActive(tab.id, tab.windowId);
    const after = await chrome.tabs.sendMessage(tab.id, { type: "snap:validate", token: message.token }, target);
    if (!after?.valid) throw new Error("The page changed during capture. Please try again.");
    const source = await (await fetch(data)).blob();
    const bitmap = await createImageBitmap(source);
    const bounds = cropBounds(message.rect, message.viewport, bitmap);
    const canvas = new OffscreenCanvas(bounds.width, bounds.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to create the screenshot.");
    context.drawImage(bitmap, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const id = crypto.randomUUID();
    const record = {
      id, title: settings.saveSource ? String(message.title || "Untitled page").slice(0, 300) : "Snapshot",
      url: settings.saveSource ? String(sender.url || tab.url || "").slice(0, 8192) : "", label: String(message.label || "Selection").slice(0, 100),
      createdAt: Date.now(), width: bounds.width, height: bounds.height, clipped: bounds.clipped, blob
    };
    const { blob: _blob, ...metadata } = record;
    const draft = { ...metadata, url: privateSourceUrl(record.url), dataURL: await blobDataURL(blob) };
    if (draft.dataURL.length > 8_000_000) throw new Error("Capture is too large for a temporary preview. Select a smaller area.");
    await withDraft(async () => {
      await chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
      await chrome.storage.session.set({ [draftKey(tab.id)]: { draft, documentId: sender.documentId } });
    });
    // This reply is delivered only to the isolated content-script world, never to page DOM.
    let saved = false, saveError: string | undefined;
    if (settings.autoSave) {
      try { await saveCapture({ ...record, url: draft.url }); saved = true; }
      catch { saveError = "Captured, but automatic save failed. Your draft is available; try Save to library again."; }
    }
    return { draft, autoCopy: settings.autoCopy, saved, saveError };
  } finally { captureBusy = false; }
}
async function handle(message: any, sender: any) {
  if (message.type === "snap:retry") {
    if (sender.url !== chrome.runtime.getURL("capture-help.html")) throw new Error("Open capture help to retry.");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !(await start(tab))) throw new Error("Capture is still unavailable. Follow the steps above, then try again.");
    return {};
  }
  const fromGallery = sender.url === chrome.runtime.getURL("gallery.html") || sender.url?.startsWith(chrome.runtime.getURL("gallery.html") + "#");
  if (message.type === "snap:capture") return capture(message, sender);
  if (["snap:save-draft", "snap:download-draft", "snap:discard-draft"].includes(message.type)) {
    if (!sender.tab?.id || sender.frameId !== 0 || !sender.documentId) throw new Error("Use the original capture controls.");
    return withDraft(async () => {
      const key = draftKey(sender.tab.id);
      const stored = (await chrome.storage.session.get(key))[key];
      if (!stored || stored.documentId !== sender.documentId || stored.draft.id !== message.id) throw new Error("This draft is no longer available. Capture again.");
      const draft = stored.draft;
      if (message.type === "snap:discard-draft") { await chrome.storage.session.remove(key); return {}; }
      if (message.type === "snap:save-draft") {
        const { dataURL, ...metadata } = draft;
        if (!(await getSettings()).saveSource) { metadata.title = "Snapshot"; metadata.url = ""; }
        await saveCapture({ ...metadata, blob: await (await fetch(dataURL)).blob() });
      } else await chrome.downloads.download({ url: draft.dataURL, filename: filename(draft.createdAt), saveAs: false });
      return { id: draft.id };
    });
  }
  if (message.type === "snap:gallery") { await openGallery(message.id); return {}; }
  if (message.type === "snap:delete") {
    if (!fromGallery || sender.frameId !== 0) throw new Error("Open the library to remove this capture.");
    await deleteCapture(message.id); return {};
  }
  if (message.type === "snap:download") {
    if (!fromGallery || sender.frameId !== 0) throw new Error("Open the library to download this capture.");
    const record = await getCapture(message.id);
    if (!record) throw new Error("This capture is no longer in the library.");
    await chrome.downloads.download({ url: await blobDataURL(record.blob), filename: filename(record.createdAt), saveAs: false });
    return {};
  }
  throw new Error("Unknown request.");
}
chrome.runtime.onMessage.addListener((message: any, sender: any, respond: (value: any) => void) => {
  if (sender.id !== chrome.runtime.id || !["snap:retry", "snap:discard-draft", "snap:capture", "snap:save-draft", "snap:download-draft", "snap:gallery", "snap:delete", "snap:download"].includes(message?.type)) return;
  handle(message, sender).then(result => respond({ ok: true, ...result }), error => respond({ ok: false, error: error.message || "Something went wrong." }));
  return true;
});
