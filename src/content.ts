(() => {
  const state = window as unknown as { __elementSnap?: { toggle: () => void } };
  if (state.__elementSnap) { state.__elementSnap.toggle(); return; }
  let enabled = false, busy = false, mode: "element" | "area" = "element";
  let target: Element | null = null, ancestors: Element[] = [], padding = 0;
  let point = { x: 0, y: 0 }, origin: { x: number; y: number } | null = null;
  let area: { x: number; y: number; width: number; height: number } | null = null;
  let pending: any = null, draft: any = null, saved = false, actionBusy = false, toastTimer = 0, frame = 0;
  let autoHide = false, toastHovered = false, countdownFrame = 0;
  let previousFocus: HTMLElement | null = null;
  const host = document.createElement("div");
  host.id = "element-snap-overlay";
  host.style.cssText = "all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;color-scheme:light!important";
  const shadow = host.attachShadow({ mode: "open" });
  const brand = window.__snapshotBrand;
  const glyph = (name: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${brand.paths[name]}</svg>`;
  shadow.innerHTML = `
    <style>
      ${brand.css}
      button,select{cursor:pointer}button:focus-visible,select:focus-visible{outline:2px solid var(--sn-accent);outline-offset:3px}
      [hidden]{display:none!important}#area-fields{pointer-events:auto;display:flex;flex-wrap:wrap;gap:8px;max-width:100%;background:var(--sn-surface);border:1px solid var(--sn-border);border-radius:5px;padding:8px}#area-fields label{display:flex;align-items:center;gap:4px}#area-fields input{width:64px;min-height:32px;font:inherit;color:var(--sn-text);background:white;border:1px solid var(--sn-control-border)}input:focus-visible{outline:2px solid var(--sn-accent)}
      #outline{position:fixed;display:none;border:2px solid var(--sn-accent);border-radius:4px;background:color-mix(in srgb,var(--sn-accent) 7%,transparent);pointer-events:none}
      #label{position:absolute;left:-2px;padding:5px 8px;background:var(--sn-charcoal);color:var(--sn-white);border-radius:var(--sn-radius);white-space:nowrap;font-size:12px;max-width:85vw;overflow:hidden;text-overflow:ellipsis}
      #dock{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;max-width:calc(100vw - 24px);width:max-content}.dock-top #dock{top:20px;bottom:auto;flex-direction:column-reverse}
      #bar{pointer-events:auto;display:flex;align-items:center;justify-content:center;gap:6px;max-width:100%;flex-wrap:wrap;padding:8px;background:var(--sn-surface);color:var(--sn-text);border:1px solid var(--sn-border);border-radius:var(--sn-panel-radius);box-shadow:var(--sn-shadow)}
      .brand{display:flex;align-items:center;gap:8px;font-weight:650;font-size:14px;letter-spacing:-.3px;padding:0 8px;white-space:nowrap}.divider{width:1px;height:24px;background:var(--sn-line);margin:0 3px}
      button,select{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;border:1px solid transparent;background:transparent;color:inherit;border-radius:var(--sn-radius);padding:7px 10px;white-space:nowrap}
      button:hover,select:hover{background:var(--sn-hover)}button[aria-pressed=true]{background:var(--sn-selected);color:var(--sn-selected-text);font-weight:600}button:disabled{opacity:.55;cursor:default}.icon-button{width:32px;min-height:32px;padding:7px;color:var(--sn-muted)}
      #help{background:var(--sn-charcoal);color:var(--sn-white);padding:6px 10px;border-radius:var(--sn-radius);font-size:12px;text-align:center;max-width:100%;line-height:1.5}
      #notifications{position:fixed;top:20px;right:20px;width:max-content;max-width:calc(100vw - 40px);display:flex;flex-direction:column;align-items:flex-end}.notes-bottom #notifications{top:auto;bottom:20px}.notes-bottom:not(.dock-top) #notifications{bottom:calc(var(--dock-height,96px) + 28px)}.dock-top:not(.notes-bottom) #notifications{top:calc(var(--dock-height,96px) + 28px)}
      #toast{display:none;pointer-events:auto;position:relative;width:min-content;min-width:280px;max-width:100%;box-sizing:border-box;padding:12px;background:var(--sn-surface);border:1px solid var(--sn-border);border-radius:var(--sn-panel-radius);box-shadow:var(--sn-shadow);color:var(--sn-text)}
      #toast::after{content:"";display:none;position:absolute;bottom:4px;left:12px;right:12px;height:2px;background:var(--sn-accent);border-radius:2px;pointer-events:none;transform-origin:left;transform:scaleX(var(--countdown,1))}#toast.timed::after{display:block}
      #toast p{margin:0;line-height:1.5;font-size:13px;overflow-wrap:anywhere}#toast-head{display:flex;align-items:center;gap:8px;padding-right:72px}#toast-icon{display:none;color:var(--sn-accent)}#toast-text{font-weight:600}#toast.success{border-color:var(--sn-accent)}#toast.success #toast-icon{display:block}#save{background:var(--sn-charcoal);color:var(--sn-white);font-size:13px}#save:hover{background:var(--sn-charcoal-hover)}#save:disabled{background:var(--sn-selected);color:var(--sn-selected-text);opacity:1}#toast-details{margin-top:8px}#toast-meta{color:var(--sn-muted);margin-bottom:8px!important}#toast-actions{display:flex;flex-wrap:wrap;gap:8px}#toast-actions button{border-color:var(--sn-control-border);font-size:13px}#toast.error{border-color:var(--sn-danger)}#toast-tools{position:absolute;top:8px;right:8px;display:flex;gap:4px}
      @media(max-width:700px){.brand,.divider{display:none}#dock{bottom:10px}#notifications{top:12px;right:12px;max-width:calc(100vw - 24px)}.notes-bottom #notifications{bottom:12px}.notes-bottom:not(.dock-top) #notifications{bottom:calc(var(--dock-height,96px) + 18px)}.dock-top:not(.notes-bottom) #notifications{top:calc(var(--dock-height,96px) + 18px)}#bar{gap:2px;padding:6px}button,select{padding:7px}.dock-top #dock{top:10px}}
    </style>
    <div id="root" class="snapshot-root">
    <div id="outline"><span id="label"></span></div>
    <div id="notifications">
    <div id="toast"><div id="toast-tools"><button id="toast-library" class="icon-button" title="Open library" aria-label="Open library">${glyph("folder")}</button><button id="dismiss" class="icon-button" title="Hide notification" aria-label="Hide notification">${glyph("close")}</button></div><div id="toast-head"><span id="toast-icon">${glyph("check")}</span><p id="toast-text" role="status" aria-live="polite" aria-atomic="true"></p></div><div id="toast-details"><p id="toast-meta"></p><div id="toast-actions"><button id="save">Save to library</button><button id="download">${glyph("download")} Download PNG</button></div></div></div>
    </div>
    <div id="dock">
    <div id="help" role="status" aria-live="polite">Hover to select · ↑ larger · ↓ smaller · click to copy · Esc to exit</div>
    <div id="bar" role="toolbar" aria-label="Snapshot capture controls">
      <span class="brand"><span class="brand-mark">${glyph("scan")}</span>Snapshot</span>
      <button id="element" aria-pressed="true" title="Select a webpage element">Element</button>
      <button id="area" aria-pressed="false" title="Drag a rectangle">Area</button>
      <span class="divider"></span>
      <button id="larger" class="icon-button" title="Select parent element (Arrow Up)" aria-label="Larger selection">${glyph("up")}</button>
      <button id="smaller" class="icon-button" title="Return to child element (Arrow Down)" aria-label="Smaller selection">${glyph("down")}</button>
      <select id="padding" aria-label="Capture padding"><option value="0">No padding</option><option value="8">8 px padding</option><option value="16">16 px padding</option><option value="24">24 px padding</option></select>
      <button id="capture" title="Capture selection (Enter)">Capture selection</button><button id="library">Library ${glyph("external")}</button><button id="close" class="icon-button" title="Exit (Escape)" aria-label="Exit capture mode">${glyph("close")}</button>
    </div>
    <fieldset id="area-fields" hidden><legend>Area coordinates (pixels)</legend><label>X <input id="area-x" type="number" min="0"></label><label>Y <input id="area-y" type="number" min="0"></label><label>Width <input id="area-width" type="number" min="2"></label><label>Height <input id="area-height" type="number" min="2"></label></fieldset>
    </div>
    </div>`;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => shadow.getElementById(id) as T;
  const kinds: Record<string, string> = {
    IMG: "Image", PICTURE: "Image", SVG: "Graphic", CANVAS: "Graphic", VIDEO: "Video", BUTTON: "Button", A: "Link",
    INPUT: "Form field", TEXTAREA: "Form field", SELECT: "Form field", FORM: "Form", TABLE: "Table", UL: "List", OL: "List", LI: "List item",
    H1: "Heading", H2: "Heading", H3: "Heading", H4: "Heading", H5: "Heading", H6: "Heading", P: "Text", SPAN: "Text", BLOCKQUOTE: "Quote",
    NAV: "Navigation", HEADER: "Header", FOOTER: "Footer", ASIDE: "Sidebar", ARTICLE: "Article", SECTION: "Section", FIGURE: "Figure"
  };
  // Lets narrow layouts stack the notification directly above the toolbar.
  new ResizeObserver(() => $("notifications").style.setProperty("--dock-height", `${$("dock").offsetHeight}px`)).observe($("dock"));
  // Before a capture, the toolbar can move clear of the selection. Keep controls
  // stationary once capture actions are available so they remain reachable.
  const root = $("root"), narrow = matchMedia("(max-width: 700px)");
  const ownEvent = (e: Event) => e.composedPath().includes(host);
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
    $("larger").toggleAttribute("disabled", mode === "area" || !target?.parentElement || target === document.documentElement);
    $("smaller").toggleAttribute("disabled", mode === "area" || !ancestors.length);
    if (!r || r.width < 1 || r.height < 1) { $("outline").style.display = "none"; return; }
    const x = Math.max(0, r.x), y = Math.max(0, r.y);
    const w = Math.min(innerWidth, r.x + r.width) - x, h = Math.min(innerHeight, r.y + r.height) - y;
    if (w <= 0 || h <= 0) { $("outline").style.display = "none"; return; }
    Object.assign($("outline").style, { display: "block", left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
    // Avoid a pinned element while selecting, then hold both corners steady while
    // the popup is visible. Moving the dock also moves the popup.
    const covers = (box: DOMRect, top: number) => x < box.right && x + w > box.left && y < top + box.height && y + h > top;
    let dock = $("dock").getBoundingClientRect();
    const atBottom = dock.top > innerHeight / 2, gap = atBottom ? innerHeight - dock.bottom : dock.top;
    const captureActionsVisible = $("toast").style.display === "block";
    if (!captureActionsVisible && covers(dock, dock.top) && !covers(dock, atBottom ? gap : innerHeight - gap - dock.height)) {
      root.classList.toggle("dock-top", atBottom);
      root.classList.toggle("notes-bottom", atBottom || narrow.matches);
      dock = $("dock").getBoundingClientRect();
    }
    const clipped = x !== r.x || y !== r.y || w < r.width || h < r.height;
    $("label").textContent = `${describe()} · ${Math.round(w)} × ${Math.round(h)}${clipped ? " · visible part only" : ""}`;
    // Keep the size label clear of the toolbar when the selection sits behind it.
    const labelWidth = $("label").offsetWidth;
    let labelTop = y > 32 ? y - 29 : y + 3;
    if (labelTop < dock.bottom && labelTop + 26 > dock.top && x < dock.right && x + labelWidth > dock.left) {
      labelTop = dock.top > innerHeight / 2 ? Math.max(0, dock.top - 32) : dock.bottom + 6;
    }
    $("label").style.top = `${labelTop - y}px`;
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(paint); }
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
    if (hadFocus) $("capture").focus();
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
      captureFocus?.focus();
      scheduleAutoHide();
      if (enabled) paint();
    }
  }
  function setMode(next: "element" | "area") {
    if (busy) return;
    mode = next; area = null; origin = null; target = null; ancestors = [];
    $("element").setAttribute("aria-pressed", String(mode === "element"));
    $("area").setAttribute("aria-pressed", String(mode === "area"));
    $("area-fields").hidden = mode !== "area";
    if (mode === "area") { area = { x: 0, y: 0, width: Math.min(320, innerWidth), height: Math.min(200, innerHeight) }; syncArea(); }
    else target = candidates()[0] || document.body;
    $("help").textContent = mode === "area" ? "Drag an area or enter coordinates, then Capture selection · Esc to exit" : "Hover or use ← / → to select · ↑ larger · ↓ smaller · Enter captures · Esc exits";
    paint();
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
    if (!e.isTrusted) return;
    if (!enabled || busy || ownEvent(e)) return;
    if (mode === "area") {
      if (origin) {
        const x = Math.max(0, Math.min(innerWidth, e.clientX)), y = Math.max(0, Math.min(innerHeight, e.clientY));
        area = { x: Math.min(origin.x, x), y: Math.min(origin.y, y), width: Math.abs(x - origin.x), height: Math.abs(y - origin.y) };
        syncArea(); schedule();
      }
      return;
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
    if (mode === "area") { origin = { x: e.clientX, y: e.clientY }; area = { ...origin, width: 0, height: 0 }; paint(); }
  }
  function up(e: PointerEvent) {
    if (!e.isTrusted) return;
    if (!enabled || ownEvent(e) || e.button !== 0) return;
    block(e);
    if (!busy && mode === "area" && origin) { origin = null; void capture(); }
  }
  function click(e: MouseEvent) {
    if (!e.isTrusted) return;
    if (!enabled || ownEvent(e) || e.button !== 0) return;
    block(e);
    if (busy || mode !== "element") return;
    // Preserve keyboard-expanded selection when clicking at the same pointer position.
    if (!target) { const hit = e.composedPath()[0]; if (hit instanceof Element) target = hit; }
    void capture();
  }
  function keyboard(e: KeyboardEvent) {
    if (!e.isTrusted) return;
    if (enabled && !busy && !actionBusy && e.key === "Escape" && ownEvent(e)) {
      block(e);
      disable();
      return;
    }
    if (!enabled || e.ctrlKey || e.altKey || e.metaKey || busy || actionBusy) return;
    if (ownEvent(e) && shadow.activeElement !== $("capture")) return;
    if (["Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) {
      block(e);
      if (busy) return;
      if (e.key === "Escape") disable();
      else if (e.key === "ArrowUp") larger();
      else if (e.key === "ArrowDown") smaller();
      else if (e.key === "Enter") void capture();
      else if (mode === "element") {
        const items = candidates(), index = items.indexOf(target!);
        target = items[(index + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length] || target;
        ancestors = []; paint();
      }
      if (mode === "element" && e.key.startsWith("Arrow")) $("help").textContent = `${describe()} selected · ← / → next element · ↑ larger · ↓ smaller · Enter captures`;
    }
  }
  function scroll() { if (!busy) schedule(); }
  function preventScroll(e: Event) { if (enabled && busy && !ownEvent(e)) block(e); }
  function enable() {
    root.classList.toggle("dock-top", false); root.classList.toggle("notes-bottom", narrow.matches);
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
    setMode("element");
    $("capture").focus();
  }
  function disable() {
    if (busy || actionBusy) return;
    enabled = false; host.remove(); target = null; area = null; ancestors = []; origin = null;
    if (previousFocus?.isConnected) previousFocus.focus();
    autoHide = false; toastHovered = false;
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
  action("element", () => setMode("element")); action("area", () => setMode("area"));
  action("larger", larger); action("smaller", smaller); action("close", disable);
  for (const id of ["library", "toast-library"]) action(id, async () => { await send({ type: "snap:gallery" }); });
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
  action("capture", capture);
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
  $("padding").addEventListener("change", e => { if (!e.isTrusted) return; padding = Number($<HTMLSelectElement>("padding").value); paint(); });
  state.__elementSnap = { toggle: () => enabled ? disable() : enable() };
  enable();
})();
