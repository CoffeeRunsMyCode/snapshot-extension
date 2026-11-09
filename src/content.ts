(() => {
  const state = window as unknown as { __elementSnap?: { toggle: () => void } };
  if (state.__elementSnap) { state.__elementSnap.toggle(); return; }
  let enabled = false, busy = false, mode: "element" | "area" = "element";
  let target: Element | null = null, ancestors: Element[] = [], padding = 0;
  let point = { x: 0, y: 0 }, origin: { x: number; y: number } | null = null, press: { x: number; y: number } | null = null;
  let area: { x: number; y: number; width: number; height: number } | null = null;
  let pending: any = null, draft: any = null, saved = false, actionBusy = false, toastTimer = 0, frame = 0, hintTimer = 0;
  let autoHide = false, toastHovered = false, countdownFrame = 0;
  let previousFocus: HTMLElement | null = null;
  // A press only becomes an area drag after moving this far, so ordinary clicks still capture elements.
  const DRAG_THRESHOLD = 5, HINT_MS = 4000;
  const host = document.createElement("div");
  host.id = "element-snap-overlay";
  host.style.cssText = "all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important";
  const shadow = host.attachShadow({ mode: "open" });
  const brand = window.__snapshotBrand;
  const glyph = (name: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${brand.paths[name]}</svg>`;
  shadow.innerHTML = `
    <style>
      ${brand.css}
      /* Same spacing scale, buttons and surfaces as the library. */
      #root{--s1:4px;--s2:8px;--s3:12px;--s4:16px;--s5:24px}
      [hidden]{display:none!important}#root:focus{outline:none}
      button{display:inline-flex;align-items:center;justify-content:center;gap:var(--s2);min-height:36px;padding:0 var(--s4);border:1px solid transparent;border-radius:var(--sn-radius);background:transparent;color:inherit;font-size:13px;font-weight:500;white-space:nowrap;cursor:pointer}
      button:focus-visible,input:focus-visible{outline:2px solid var(--sn-accent);outline-offset:2px}button:disabled{opacity:.5;cursor:default}
      .primary{background:var(--sn-charcoal);border-color:var(--sn-charcoal);color:var(--sn-white)}.primary:hover:not(:disabled){background:var(--sn-charcoal-hover)}
      .secondary{background:var(--sn-white);border-color:var(--sn-border);color:var(--sn-text)}.secondary:hover:not(:disabled){background:var(--sn-hover)}
      .icon-button{width:32px;min-height:32px;padding:0;color:var(--sn-muted)}.icon-button:hover{background:var(--sn-hover);color:var(--sn-text)}
      #outline{position:fixed;display:none;border:2px solid var(--sn-accent);border-radius:4px;box-shadow:0 0 0 1px var(--sn-white);background:color-mix(in srgb,var(--sn-accent) 7%,transparent);pointer-events:none}
      #label{position:absolute;left:-2px;padding:var(--s1) var(--s2);background:var(--sn-charcoal);color:var(--sn-white);border-radius:var(--sn-radius);white-space:nowrap;font-size:12px;line-height:1.5;max-width:85vw;overflow:hidden;text-overflow:ellipsis}
      #hint{position:fixed;bottom:var(--s5);left:0;right:0;margin:0 auto;width:fit-content;display:flex;align-items:center;gap:var(--s2);max-width:calc(100vw - var(--s5));padding:var(--s2) var(--s3) var(--s2) var(--s2);background:var(--sn-charcoal);color:var(--sn-white);border-radius:var(--sn-panel-radius);box-shadow:var(--sn-shadow);font-size:13px;line-height:1.4;pointer-events:none;transition:opacity .3s}
      #hint .brand-mark{flex:none;width:24px;height:24px;background:transparent;color:inherit}#hint.fading{opacity:0}
      #area-fields{position:fixed;bottom:var(--s5);left:0;right:0;margin:0 auto!important;width:fit-content;pointer-events:auto;display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s3);max-width:calc(100vw - var(--s5));background:var(--sn-white);color:var(--sn-text);border:1px solid var(--sn-border);border-radius:var(--sn-panel-radius);box-shadow:var(--sn-shadow);padding:var(--s3) var(--s4)}
      #area-fields legend{float:left;padding:0;font-weight:600}#area-fields label{display:flex;align-items:center;gap:var(--s1);color:var(--sn-muted)}
      #area-fields input{width:72px;min-height:32px;padding:0 var(--s2);font:inherit;color:var(--sn-text);background:var(--sn-white);border:1px solid var(--sn-control-border);border-radius:var(--sn-radius)}
      .field-actions{display:flex;gap:var(--s2)}
      #notifications{position:fixed;top:var(--s5);right:var(--s5);width:max-content;max-width:calc(100vw - 48px);display:flex;flex-direction:column;align-items:flex-end}
      #toast{display:none;pointer-events:auto;position:relative;overflow:hidden;width:max-content;min-width:300px;max-width:min(400px,100%);padding:var(--s4);background:var(--sn-white);border:1px solid var(--sn-border);border-radius:var(--sn-panel-radius);box-shadow:var(--sn-shadow);color:var(--sn-text)}
      /* The auto-hide countdown is a quiet line along the bottom edge. */
      #toast::after{content:"";display:none;position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--sn-accent);pointer-events:none;transform-origin:left;transform:scaleX(var(--countdown,1))}#toast.timed::after{display:block}
      #toast p{margin:0;line-height:1.5;font-size:13px;overflow-wrap:anywhere}
      #toast-head{display:flex;align-items:center;gap:var(--s2);min-height:24px;padding-right:72px}#toast-icon{display:none;color:var(--sn-accent)}#toast.success #toast-icon{display:block}#toast-text{font-weight:600}
      #toast-tools{position:absolute;top:var(--s3);right:var(--s3);display:flex;gap:var(--s1)}
      #toast-details{margin-top:var(--s1)}#toast-meta{color:var(--sn-muted);margin-bottom:var(--s3)!important}#toast-actions{display:flex;flex-wrap:wrap;gap:var(--s2)}
      #save:disabled{background:var(--sn-selected);border-color:var(--sn-selected);color:var(--sn-selected-text);opacity:1}
      #toast.error{border-color:var(--sn-danger)}#toast.error #toast-text{color:var(--sn-danger)}
      @media(max-width:700px){#hint,#area-fields{bottom:var(--s3)}#notifications{top:auto;bottom:var(--s3);right:var(--s3);max-width:calc(100vw - var(--s5))}.fields-open #notifications{top:var(--s3);bottom:auto}#toast{min-width:0;width:calc(100vw - var(--s5));max-width:none}}
      @media(pointer:coarse){button{min-height:44px}.icon-button{width:44px;min-height:44px}#area-fields input{min-height:44px}#toast-head{padding-right:96px}}
      @media(prefers-reduced-motion:reduce){#hint{transition:none}}
    </style>
    <div id="root" class="snapshot-root" tabindex="-1" role="region" aria-label="Snapshot capture mode. Arrow keys select an element, Enter captures, A enters area coordinates, Escape exits.">
    <div id="outline"><span id="label"></span></div>
    <div id="notifications">
    <div id="toast"><div id="toast-tools"><button id="toast-library" class="icon-button" title="Open library" aria-label="Open library">${glyph("folder")}</button><button id="dismiss" class="icon-button" title="Hide notification" aria-label="Hide notification">${glyph("close")}</button></div><div id="toast-head"><span id="toast-icon">${glyph("check")}</span><p id="toast-text" role="status" aria-live="polite" aria-atomic="true"></p></div><div id="toast-details"><p id="toast-meta"></p><div id="toast-actions"><button id="save" class="primary">Save to library</button><button id="download" class="secondary">${glyph("download")} Download PNG</button></div></div></div>
    </div>
    <div id="hint" role="status" aria-live="polite"><span class="brand-mark">${glyph("scan")}</span><span id="hint-text"></span></div>
    <fieldset id="area-fields" hidden><legend>Area (pixels)</legend><label>X <input id="area-x" type="number" min="0"></label><label>Y <input id="area-y" type="number" min="0"></label><label>Width <input id="area-width" type="number" min="2"></label><label>Height <input id="area-height" type="number" min="2"></label><span class="field-actions"><button id="area-capture" class="primary" type="button">Capture</button><button id="area-cancel" class="secondary" type="button">Cancel</button></span></fieldset>
    </div>`;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => shadow.getElementById(id) as T;
  const kinds: Record<string, string> = {
    IMG: "Image", PICTURE: "Image", SVG: "Graphic", CANVAS: "Graphic", VIDEO: "Video", BUTTON: "Button", A: "Link",
    INPUT: "Form field", TEXTAREA: "Form field", SELECT: "Form field", FORM: "Form", TABLE: "Table", UL: "List", OL: "List", LI: "List item",
    H1: "Heading", H2: "Heading", H3: "Heading", H4: "Heading", H5: "Heading", H6: "Heading", P: "Text", SPAN: "Text", BLOCKQUOTE: "Quote",
    NAV: "Navigation", HEADER: "Header", FOOTER: "Footer", ASIDE: "Sidebar", ARTICLE: "Article", SECTION: "Section", FIGURE: "Figure"
  };
  const root = $("root");
  const ownEvent = (e: Event) => e.composedPath().includes(host);
  const fieldsOpen = () => !$("area-fields").hidden;
  function rect() {
    const r = mode === "area" ? area : target?.getBoundingClientRect();
    return r ? { x: r.x - padding, y: r.y - padding, width: r.width + padding * 2, height: r.height + padding * 2 } : null;
  }
  function describe() {
    if (mode === "area") return "Area selection";
    return (target && kinds[target.tagName.toUpperCase()]) || "Element";
  }
  function paint() {
    frame = 0;
    if (!enabled || busy) return;
    const r = rect();
    if (!r || r.width < 1 || r.height < 1) { $("outline").style.display = "none"; return; }
    const x = Math.max(0, r.x), y = Math.max(0, r.y);
    const w = Math.min(innerWidth, r.x + r.width) - x, h = Math.min(innerHeight, r.y + r.height) - y;
    if (w <= 0 || h <= 0) { $("outline").style.display = "none"; return; }
    Object.assign($("outline").style, { display: "block", left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
    const clipped = x !== r.x || y !== r.y || w < r.width || h < r.height;
    $("label").textContent = `${describe()} · ${Math.round(w)} × ${Math.round(h)}${clipped ? " · visible part only" : ""}`;
    $("label").style.top = `${y > 32 ? -29 : 3}px`;
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(paint); }
  // A short reminder of the gestures when capture starts. It never takes clicks and fades on its own.
  function showHint() {
    clearTimeout(hintTimer);
    $("hint-text").textContent = "Click to capture · Drag for an area · ↑ ↓ resize · Esc to exit";
    $("hint").hidden = false; $("hint").classList.remove("fading");
    hintTimer = window.setTimeout(() => {
      $("hint").classList.add("fading");
      hintTimer = window.setTimeout(() => { $("hint").hidden = true; }, 300);
    }, HINT_MS);
  }
  function hideHint() { clearTimeout(hintTimer); $("hint").hidden = true; }
  function resetAutoHide() {
    clearTimeout(toastTimer);
    if (countdownFrame) cancelAnimationFrame(countdownFrame);
    countdownFrame = 0;
    $("toast").classList.toggle("timed", autoHide);
    $("toast").style.setProperty("--countdown", "1");
  }
  function hideToast() {
    autoHide = false;
    toastHovered = false;
    resetAutoHide();
    const hadFocus = $("toast").contains(shadow.activeElement);
    $("toast").style.display = "none";
    if (hadFocus) root.focus({ preventScroll: true });
  }
  function scheduleAutoHide() {
    resetAutoHide();
    if (!autoHide || busy || actionBusy || toastHovered || $("toast").contains(shadow.activeElement)) return;
    const started = performance.now();
    const tick = () => {
      const remaining = Math.max(0, 1 - (performance.now() - started) / 5000);
      $("toast").style.setProperty("--countdown", String(remaining));
      countdownFrame = remaining > 0 ? requestAnimationFrame(tick) : 0;
    };
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) countdownFrame = requestAnimationFrame(tick);
    toastTimer = window.setTimeout(hideToast, 5000);
  }
  function notify(text: string, error = false, actions = false, success = false) {
    clearTimeout(toastTimer);
    $("toast-text").textContent = text;
    $("toast").classList.toggle("error", error);
    $("toast").classList.toggle("success", success);
    $("toast").style.display = "block";
    $("toast-details").style.display = actions ? "block" : "none";
    $<HTMLButtonElement>("save").disabled = saved;
    $("save").textContent = saved ? "Saved to library" : "Save to library";
    $("toast-meta").textContent = actions && draft ? `${draft.width} × ${draft.height}${draft.clipped ? " · visible portion" : ""} · ${saved ? "Saved in your library." : "Not saved to library."}` : "";
    autoHide = !error;
    scheduleAutoHide();
  }
  async function copyDraft() {
    if (!draft) throw new Error("Capture an image first.");
    if (!navigator.clipboard?.write) throw new Error("Automatic copy is unavailable on this page. Save to library or download the PNG.");
    const blob = await (await fetch(draft.dataURL)).blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  }
  async function send(message: any) {
    try {
      const result = await chrome.runtime.sendMessage(message);
      if (!result?.ok) throw new Error(result?.error || "The extension did not respond. Reload the page and try again.");
      return result;
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unable to complete the action.";
      throw new Error(text.includes("context invalidated") ? "The extension was updated. Reload this webpage to capture again." : text);
    }
  }
  function isStable() {
    if (!pending || document.visibilityState !== "visible" || !document.hasFocus()) return false;
    const current = rect();
    return current && ["x", "y", "width", "height"].every(k => Math.abs((current as any)[k] - pending.rect[k]) < 0.5)
      && innerWidth === pending.viewport.width && innerHeight === pending.viewport.height
      && scrollX === pending.scrollX && scrollY === pending.scrollY
      && (visualViewport?.scale || 1) === 1 && (mode !== "element" || target?.isConnected);
  }
  chrome.runtime.onMessage.addListener((message: any, _sender: any, reply: (value: any) => void) => {
    if (message?.type === "snap:validate") reply({ valid: busy && pending?.token === message.token && !!isStable() });
  });
  async function capture() {
    const bounds = rect();
    if (busy || actionBusy || !bounds || bounds.width < 2 || bounds.height < 2) return;
    if ((visualViewport?.scale || 1) !== 1) { notify("Reset pinch zoom before capturing. Standard browser zoom is supported.", true); return; }
    busy = true;
    hideHint();
    const captureFocus = shadow.activeElement as HTMLElement | null;
    pending = { token: crypto.randomUUID(), rect: bounds, viewport: { width: innerWidth, height: innerHeight }, scrollX, scrollY };
    clearTimeout(toastTimer);
    // Remove the whole subtree from painting. Descendant all:initial resets can
    // override inherited visibility, but cannot override an ancestor's display.
    host.style.setProperty("display", "none", "important");
    try {
      // Let Chrome paint a clean frame before taking the screenshot.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const result = await send({ type: "snap:capture", ...pending, title: document.title, label: mode === "area" ? "Area selection" : "Element" });
      draft = result.draft; saved = result.saved === true;
      if (result.autoCopy === false) {
        notify(saved ? "Captured and saved to library." : "Captured. Save to library or download the PNG.", false, true, saved);
      } else try {
        await copyDraft();
        notify("Copied to clipboard", false, true, true);
      } catch {
        notify("Captured, but could not copy. Save to library or download the PNG.", true, true);
      }
      if (result.saveError) notify(result.saveError, true, true);
    } catch (error) { notify((error as Error).message, true, !!draft); }
    finally {
      pending = null; busy = false;
      host.style.setProperty("display", "block", "important");
      (captureFocus || root).focus({ preventScroll: true });
      scheduleAutoHide();
      if (enabled) paint();
    }
  }
  function setMode(next: "element" | "area") {
    if (busy) return;
    mode = next; area = null; origin = null; press = null; target = null; ancestors = [];
    if (mode === "area") { area = { x: 0, y: 0, width: Math.min(320, innerWidth), height: Math.min(200, innerHeight) }; syncArea(); }
    else target = candidates()[0] || document.body;
    paint();
  }
  // Keyboard alternative to dragging: type the rectangle, then Capture.
  function openFields() {
    if (busy) return;
    hideHint();
    setMode("area");
    $("area-fields").hidden = false; root.classList.add("fields-open");
    $<HTMLInputElement>("area-x").focus();
  }
  function closeFields() {
    $("area-fields").hidden = true; root.classList.remove("fields-open");
    setMode("element");
    root.focus({ preventScroll: true });
  }
  function candidates() {
    return Array.from(document.querySelectorAll("body *")).filter(el => {
      if (el === host || ["SCRIPT", "STYLE", "LINK", "META"].includes(el.tagName)) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 2 && r.height >= 2 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && getComputedStyle(el).visibility !== "hidden";
    });
  }
  function syncArea() {
    if (area) for (const key of ["x", "y", "width", "height"] as const) $<HTMLInputElement>("area-" + key).value = String(Math.round(area[key]));
  }
  function larger() { if (!busy && mode === "element" && target?.parentElement) { ancestors.push(target); target = target.parentElement; paint(); } }
  function smaller() { if (!busy && ancestors.length) { target = ancestors.pop()!; paint(); } }
  function move(e: PointerEvent) {
    if (!e.isTrusted || !enabled || busy) return;
    // A drag keeps tracking over Snapshot's own panels; plain hovering over them does not.
    if (ownEvent(e) && !origin) return;
    if (press && !(e.buttons & 1)) { press = null; origin = null; }
    if (press) {
      if (!origin && Math.hypot(e.clientX - press.x, e.clientY - press.y) >= DRAG_THRESHOLD) {
        if (fieldsOpen()) { $("area-fields").hidden = true; root.classList.remove("fields-open"); }
        origin = press; mode = "area"; hideHint();
      }
      if (origin) {
        const x = Math.max(0, Math.min(innerWidth, e.clientX)), y = Math.max(0, Math.min(innerHeight, e.clientY));
        area = { x: Math.min(origin.x, x), y: Math.min(origin.y, y), width: Math.abs(x - origin.x), height: Math.abs(y - origin.y) };
        syncArea(); schedule();
        return;
      }
    }
    if (mode === "area") {
      // After an area capture, moving the pointer returns to element selection.
      if (fieldsOpen()) return;
      mode = "element"; area = null; target = null;
    }
    if (Math.abs(e.clientX - point.x) + Math.abs(e.clientY - point.y) < 3 && target) return;
    point = { x: e.clientX, y: e.clientY };
    const hit = e.composedPath()[0];
    if (hit instanceof Element && hit !== host) { target = hit; ancestors = []; schedule(); }
  }
  function block(e: Event) { e.preventDefault(); e.stopImmediatePropagation(); }
  function down(e: PointerEvent) {
    if (!e.isTrusted) return;
    if (!enabled || ownEvent(e) || e.button !== 0) return;
    block(e);
    if (busy) return;
    press = { x: e.clientX, y: e.clientY };
  }
  function up(e: PointerEvent) {
    if (!e.isTrusted) return;
    if (!enabled || (ownEvent(e) && !origin) || e.button !== 0) return;
    block(e);
    const dragged = !!origin;
    press = null; origin = null;
    if (!busy && dragged) void capture();
  }
  function click(e: MouseEvent) {
    if (!e.isTrusted) return;
    if (!enabled || ownEvent(e) || e.button !== 0) return;
    block(e);
    // A drag ends in an area capture; the click that follows it must not also capture an element.
    if (busy || mode !== "element") return;
    // Preserve keyboard-expanded selection when clicking at the same pointer position.
    if (!target) { const hit = e.composedPath()[0]; if (hit instanceof Element) target = hit; }
    void capture();
  }
  function keyboard(e: KeyboardEvent) {
    if (!e.isTrusted || !enabled) return;
    const own = ownEvent(e);
    if (own && fieldsOpen() && $("area-fields").contains(shadow.activeElement)) {
      if (e.key === "Escape" && !busy) { block(e); closeFields(); }
      else if (e.key === "Enter" && !busy && shadow.activeElement instanceof HTMLInputElement) { block(e); void capture(); }
      return;
    }
    if (!busy && !actionBusy && e.key === "Escape" && own) { block(e); disable(); return; }
    if (e.ctrlKey || e.altKey || e.metaKey || busy || actionBusy) return;
    // Buttons in the notification keep their native keys; the capture region handles shortcuts.
    if (own && shadow.activeElement && shadow.activeElement !== root) return;
    if (["Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "a", "A"].includes(e.key)) {
      block(e);
      hideHint();
      if (e.key === "Escape") disable();
      else if (e.key === "a" || e.key === "A") openFields();
      else if (e.key === "ArrowUp") larger();
      else if (e.key === "ArrowDown") smaller();
      else if (e.key === "Enter") void capture();
      else if (mode === "element") {
        const items = candidates(), index = items.indexOf(target!);
        target = items[(index + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length] || target;
        ancestors = []; paint();
      }
    }
  }
  function scroll() { if (!busy) schedule(); }
  function preventScroll(e: Event) { if (enabled && busy && !ownEvent(e)) block(e); }
  async function loadPadding() {
    try {
      const { settings } = await chrome.storage.local.get("settings");
      const value = Number(settings?.padding);
      padding = [0, 8, 16, 24].includes(value) ? value : 0;
      const theme = settings?.theme;
      root.dataset.theme = theme === "light" || theme === "dark" ? theme : "system";
      if (enabled) paint();
    } catch { padding = 0; }
  }
  function enable() {
    previousFocus = document.activeElement as HTMLElement;
    enabled = true;
    document.documentElement.append(host);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("click", click, true);
    window.addEventListener("keydown", keyboard, true);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", scroll);
    window.addEventListener("wheel", preventScroll, { capture: true, passive: false });
    window.addEventListener("touchmove", preventScroll, { capture: true, passive: false });
    $("area-fields").hidden = true; root.classList.remove("fields-open");
    setMode("element");
    showHint();
    void loadPadding();
    root.focus({ preventScroll: true });
  }
  function disable() {
    if (busy || actionBusy) return;
    enabled = false; host.remove(); target = null; area = null; ancestors = []; origin = null; press = null;
    if (previousFocus?.isConnected) previousFocus.focus();
    autoHide = false; toastHovered = false;
    hideHint();
    resetAutoHide(); $("toast").style.display = "none";
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerdown", down, true);
    window.removeEventListener("pointerup", up, true);
    window.removeEventListener("click", click, true);
    window.removeEventListener("keydown", keyboard, true);
    window.removeEventListener("scroll", scroll, true);
    window.removeEventListener("resize", scroll);
    window.removeEventListener("wheel", preventScroll, true);
    window.removeEventListener("touchmove", preventScroll, true);
  }
  const action = (id: string, fn: () => void | Promise<void>) => $(id).addEventListener("click", e => {
    if (e.isTrusted && !busy && !actionBusy) Promise.resolve().then(fn).catch(error => notify(error.message, true, !!draft));
  });
  async function draftAction(fn: () => Promise<void>) {
    if (!draft || actionBusy) return;
    actionBusy = true;
    scheduleAutoHide();
    for (const id of ["save", "download"]) $<HTMLButtonElement>(id).disabled = true;
    try { await fn(); }
    finally {
      actionBusy = false;
      for (const id of ["save", "download"]) $<HTMLButtonElement>(id).disabled = id === "save" && saved;
      scheduleAutoHide();
    }
  }
  action("toast-library", async () => { await send({ type: "snap:gallery" }); });
  action("save", () => draftAction(async () => {
    if (saved) return;
    await send({ type: "snap:save-draft", id: draft.id }); saved = true;
    notify("Saved to library.", false, true, true);
  }));
  action("download", () => draftAction(async () => {
    await send({ type: "snap:download-draft", id: draft.id });
    notify("PNG download started.", false, true);
  }));
  action("dismiss", hideToast);
  action("area-capture", capture);
  action("area-cancel", closeFields);
  for (const key of ["x", "y", "width", "height"] as const) $("area-" + key).addEventListener("input", () => {
    if (!area || busy) return;
    const value = Number($<HTMLInputElement>("area-" + key).value);
    if (!Number.isFinite(value)) return;
    area[key] = Math.max(key === "width" || key === "height" ? 2 : 0, Math.min(value, key === "x" || key === "width" ? innerWidth : innerHeight));
    paint();
  });
  $("toast").addEventListener("pointerenter", () => { toastHovered = true; scheduleAutoHide(); });
  $("toast").addEventListener("pointerleave", () => { toastHovered = false; scheduleAutoHide(); });
  $("toast").addEventListener("focusin", scheduleAutoHide);
  $("toast").addEventListener("focusout", () => queueMicrotask(scheduleAutoHide));
  state.__elementSnap = { toggle: () => enabled ? disable() : enable() };
  enable();
})();
