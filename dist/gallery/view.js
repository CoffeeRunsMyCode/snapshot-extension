import { listLibrary, changeCaptures, restoreTrash, setFavorite } from "../db.js";
import { icon } from "../icons.js";
import { filterCaptures, sourceUrl, siteName as sourceName } from "../library.js";
import { $, button, notice, onUndo } from "./dom.js";
import { openMove } from "./move.js";
import { state, byName } from "./state.js";
let urls = [], previewUrl = "";
const viewerFolder = document.createElement("p");
viewerFolder.id = "viewer-folder";
$("viewer-meta").after(viewerFolder);
const viewerMove = button("Move", () => { if (state.selected)
    return openMove([state.selected.id]); }, "secondary", "folder");
viewerMove.id = "viewer-move";
$("viewer-copy").before(viewerMove);
const day = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const dayTime = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
onUndo(() => void restore());
export async function request(type, id) {
    const response = await chrome.runtime.sendMessage({ type, id });
    if (!response?.ok)
        throw new Error(response?.error || "The extension could not complete this action.");
}
function updateNavigation() {
    const { records, folders, filter, site, folder } = state;
    $("trash-count").textContent = String(state.trash.length);
    $("all-count").textContent = String(records.length);
    $("favorite-count").textContent = String(records.filter(r => r.favorite).length);
    document.querySelectorAll("[data-filter]").forEach(el => {
        const active = folder === undefined && !site && el.dataset.filter === filter;
        el.classList.toggle("active", active);
        if (active)
            el.setAttribute("aria-current", "page");
        else
            el.removeAttribute("aria-current");
        el.setAttribute("aria-label", el.dataset.filter === "all" ? "All snapshots" : el.dataset.filter === "recent" ? "Recently saved" : el.dataset.filter === "trash" ? "Recently deleted" : "Favorites");
        el.title = el.getAttribute("aria-label");
    });
    const sites = new Map();
    for (const record of records) {
        const name = sourceName(record.url);
        sites.set(name, (sites.get(name) || 0) + 1);
    }
    $("site-count").textContent = String(sites.size);
    $("sites-empty").hidden = !!sites.size;
    $("sites").replaceChildren();
    for (const [name, count] of [...sites].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
        const item = button("", () => { state.folder = undefined; state.site = name; state.filter = "all"; render(); }, "nav-item site-item" + (site === name ? " active" : ""));
        item.title = name;
        item.setAttribute("aria-label", `Filter by ${name}`);
        if (site === name)
            item.setAttribute("aria-current", "page");
        const dot = document.createElement("span");
        dot.className = "site-dot";
        dot.textContent = name[0].toUpperCase();
        const label = document.createElement("span");
        label.textContent = name;
        const total = document.createElement("span");
        total.className = "site-count";
        total.textContent = String(count);
        item.append(dot, label, total);
        $("sites").append(item);
    }
    $("folders").replaceChildren();
    $("folders-empty").hidden = !!folders.length;
    for (const entry of [{ id: "", name: "Unfiled" }, ...folders]) {
        const item = button("", () => { state.folder = entry.id; state.site = ""; state.filter = "all"; render(); }, "nav-item folder-item" + (folder === entry.id ? " active" : ""));
        item.dataset.folderId = entry.id;
        item.setAttribute("aria-label", `Open folder: ${entry.name}`);
        item.title = entry.name;
        if (folder === entry.id)
            item.setAttribute("aria-current", "page");
        const label = document.createElement("span");
        label.className = "folder-label";
        label.textContent = entry.name;
        const count = document.createElement("span");
        count.className = "nav-count";
        count.textContent = String(records.filter(r => (r.folderId || "") === entry.id).length);
        item.append(icon("folder"), label, count);
        $("folders").append(item);
    }
}
function membership(record) { return state.folders.find(f => f.id === record.folderId)?.name || "Unfiled"; }
export async function copy(record) {
    if (!navigator.clipboard?.write)
        throw new Error("Clipboard access is unavailable. Download the PNG instead.");
    await navigator.clipboard.write([new ClipboardItem({ "image/png": record.blob })]);
}
export function preview(record) {
    state.selected = record;
    $("viewer-move").hidden = state.filter === "trash";
    $("viewer-download").hidden = state.filter === "trash";
    if (previewUrl)
        URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(record.blob);
    const img = $("full-image");
    img.src = previewUrl;
    img.alt = record.title;
    $("viewer-title").textContent = record.title;
    $("viewer-meta").textContent = `${sourceName(record.url)} · ${record.width} × ${record.height} px · ${dayTime.format(record.createdAt)}${record.clipped ? " · Visible portion only" : ""}`;
    $("viewer-status").textContent = "";
    $("viewer-folder").textContent = `Folder: ${membership(record)}`;
    const source = $("viewer-source");
    const href = sourceUrl(record.url);
    source.hidden = !href;
    if (href)
        source.href = href;
    else
        source.removeAttribute("href");
    $("viewer-source-url").textContent = record.url;
    source.title = record.url;
    location.hash = record.id;
    if (!$("viewer").open)
        $("viewer").showModal();
}
$("viewer").addEventListener("close", () => { state.selected = undefined; history.replaceState(null, "", location.pathname); if (previewUrl)
    URL.revokeObjectURL(previewUrl); previewUrl = ""; });
function snapshotCard(record) {
    const { filter, selecting, selectedIds } = state;
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = record.id;
    const wrap = document.createElement("div");
    wrap.className = "preview-wrap";
    const thumbnail = button("", () => { if (state.selecting)
        toggleSelection(record.id);
    else
        preview(record); }, "thumb");
    thumbnail.setAttribute("aria-label", `${selecting ? "Select" : "Preview"} ${record.title}`);
    if (selecting)
        thumbnail.setAttribute("aria-pressed", String(selectedIds.has(record.id)));
    const image = document.createElement("img");
    const url = URL.createObjectURL(record.blob);
    urls.push(url);
    image.src = url;
    image.alt = record.label;
    image.loading = "lazy";
    thumbnail.append(image);
    const star = button("", async () => {
        await setFavorite(record.id, !record.favorite);
        await refresh();
        const next = Array.from(document.querySelectorAll(".favorite-button")).find(el => el.dataset.id === record.id);
        (next || document.querySelector(`[data-filter="${state.filter}"]`))?.focus();
    }, "favorite-button icon-button", "star");
    star.dataset.id = record.id;
    star.setAttribute("aria-pressed", String(!!record.favorite));
    star.setAttribute("aria-label", record.favorite ? `Remove ${record.title} from favorites` : `Favorite ${record.title}`);
    star.title = record.favorite ? "Remove favorite" : "Add to favorites";
    star.hidden = selecting || filter === "trash";
    wrap.append(thumbnail, star);
    if (selecting) {
        const label = document.createElement("label");
        label.className = "card-selection";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = selectedIds.has(record.id);
        checkbox.setAttribute("aria-label", `Select ${record.title}`);
        checkbox.onchange = () => toggleSelection(record.id);
        label.append(checkbox);
        wrap.append(label);
    }
    if (record.clipped) {
        card.dataset.clipped = "";
        const badge = document.createElement("span");
        badge.className = "partial-badge";
        badge.textContent = "Visible portion";
        wrap.append(badge);
    }
    const body = document.createElement("div");
    body.className = "card-body";
    const source = document.createElement("div");
    source.className = "source";
    const dot = document.createElement("span");
    dot.className = "source-dot";
    dot.textContent = sourceName(record.url)[0];
    const href = sourceUrl(record.url);
    const domain = document.createElement(href ? "a" : "span");
    domain.className = "source-domain";
    domain.textContent = record.url || sourceName(record.url);
    domain.title = record.url;
    if (domain instanceof HTMLAnchorElement && href) {
        domain.href = href;
        domain.target = "_blank";
        domain.rel = "noopener noreferrer";
        domain.setAttribute("aria-label", `Open source page: ${record.url}`);
    }
    const time = document.createElement("time");
    time.dateTime = new Date(record.createdAt).toISOString();
    time.textContent = day.format(record.createdAt);
    source.append(dot, domain, time);
    const title = document.createElement("h2");
    title.textContent = record.title;
    title.title = record.title;
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = `${record.width} × ${record.height}`;
    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.append(button("Copy", async () => { await copy(record); notice("Image copied. Ready to paste."); }, "", "copy"), button("", async () => { await request("snap:download", record.id); notice("PNG download started."); }, "download-snapshot icon-action", "download"), button("", () => openMove([record.id]), "move-snapshot icon-action", "folder"), meta, button("", async () => {
        await removeCaptures([record]);
    }, "remove icon-action", "trash"));
    for (const [selector, label, tip] of [[".download-snapshot", "Download", "Download PNG"], [".move-snapshot", "Move", "Move to folder"], [".remove", "Delete", "Delete snapshot"]]) {
        const control = actions.querySelector(selector);
        control.setAttribute("aria-label", `${label} ${record.title}`);
        control.title = tip;
    }
    if (filter === "trash")
        actions.replaceChildren(button("Restore", async () => { await restoreTrash([record.id]); await refresh(); notice("Snapshot restored."); document.querySelector('[data-filter="trash"]')?.focus(); }, "restore-snapshot", "clock"));
    actions.hidden = selecting;
    const filed = document.createElement("div");
    filed.className = "folder-membership";
    const folderLabel = document.createElement("span");
    folderLabel.textContent = membership(record);
    filed.append(icon("folder"), folderLabel, meta);
    body.append(title, source, filed);
    card.append(wrap, body, actions);
    return card;
}
export function render() {
    urls.forEach(url => URL.revokeObjectURL(url));
    urls = [];
    const { records, trash, filter, site, folder, folders, selectedIds } = state;
    const search = $("search").value.toLowerCase().trim();
    const oldest = $("sort").value === "oldest";
    const visible = filterCaptures(filter === "trash" ? trash : records, { filter, site, search, oldest, folder });
    state.visibleRecords = visible;
    const visibleIds = new Set(visible.map(r => r.id));
    for (const id of selectedIds)
        if (!visibleIds.has(id))
            selectedIds.delete(id);
    updateNavigation();
    const title = folder !== undefined ? folders.find(f => f.id === folder)?.name || "Unfiled" : site || (filter === "recent" ? "Recently saved" : filter === "favorites" ? "Favorites" : filter === "trash" ? "Recently deleted" : "All snapshots");
    $("trash-actions").hidden = filter !== "trash";
    $("empty-trash").disabled = !trash.length;
    $("restore-all").disabled = !trash.length;
    $("folder-actions").hidden = !folder;
    $("page-title").textContent = title;
    $("count").textContent = String(visible.length);
    $("result-count").textContent = records.length ? `${visible.length} snapshot${visible.length === 1 ? "" : "s"}${search ? " matching your search" : ""}` : "No saved snapshots";
    $("footer-count").textContent = `Showing ${visible.length} of ${records.length} snapshots`;
    $("library-footer").hidden = !visible.length;
    $("empty").hidden = records.length !== 0 || folder !== undefined;
    $("no-results").hidden = (!records.length && folder === undefined) || !!visible.length;
    $("no-results-title").textContent = filter === "favorites" && !search ? "No favorites yet" : "No snapshots found";
    $("no-results-description").textContent = filter === "favorites" && !search ? "Star any snapshot to find it here." : "Try another search, website, or view.";
    if (folder !== undefined && !search) {
        $("no-results-title").textContent = folder ? "This folder is empty" : "No unfiled snapshots";
        $("no-results-description").textContent = folder ? "Choose Move on a snapshot, or select several in All snapshots, to file them here." : "New snapshots saved to the library appear here until you move them to a folder.";
    }
    if (filter === "trash") {
        $("empty").hidden = true;
        $("no-results").hidden = !!visible.length;
        $("no-results-title").textContent = search ? "No deleted snapshots match" : "Recently deleted is empty";
        $("no-results-description").textContent = "Deleted snapshots stay here until you restore them or empty the trash.";
        $("result-count").textContent = visible.length + " deleted snapshots";
        $("footer-count").textContent = "Showing " + visible.length + " of " + trash.length + " deleted snapshots";
    }
    const grid = $("grid");
    grid.replaceChildren();
    grid.hidden = !visible.length;
    for (const record of visible)
        grid.append(snapshotCard(record));
    updateSelection();
}
async function restore() {
    if (!state.removed.length || state.deleting)
        return;
    state.deleting = true;
    updateSelection();
    try {
        const count = state.removed.length;
        await restoreTrash(state.removed.map(r => r.id));
        state.removed = [];
        await refresh();
        notice(`${count} snapshot${count === 1 ? "" : "s"} restored.`);
    }
    catch (error) {
        notice(error.message, true);
    }
    finally {
        state.deleting = false;
        updateSelection();
    }
}
export async function refresh() {
    try {
        const data = await listLibrary();
        state.records = data.captures;
        state.trash = data.trash;
        state.folders = data.folders.sort(byName);
        if (state.folder && !state.folders.some(f => f.id === state.folder))
            state.folder = "";
        render();
        if (state.selected) {
            const current = [...state.records, ...state.trash].find(r => r.id === state.selected.id);
            if (current) {
                state.selected = current;
                $("viewer-folder").textContent = `Folder: ${membership(current)}`;
            }
            else
                $("viewer").close();
        }
    }
    catch (error) {
        notice(error.message || "The local library could not be opened. Try reloading this extension page.");
    }
}
export function updateSelection() {
    const { selecting, selectedIds, visibleRecords, deleting } = state;
    $("selection-bar").hidden = !selecting;
    $("select-mode").hidden = selecting || state.filter === "trash";
    $("select-mode").disabled = !visibleRecords.length;
    $("select-mode").setAttribute("aria-pressed", String(selecting));
    $("selection-count").textContent = `${selectedIds.size} selected`;
    $("delete-label").textContent = selectedIds.size ? `Delete (${selectedIds.size})` : "Delete selected";
    $("delete-selected").disabled = deleting || !selectedIds.size;
    $("move-selected").disabled = deleting || !selectedIds.size;
    const all = $("select-all");
    all.checked = !!visibleRecords.length && selectedIds.size === visibleRecords.length;
    all.indeterminate = !!selectedIds.size && !all.checked;
    all.disabled = deleting || !visibleRecords.length;
    $("cancel-selection").disabled = deleting;
    document.querySelectorAll(".card").forEach(card => {
        const active = selectedIds.has(card.dataset.id);
        card.classList.toggle("is-selected", active);
        const checkbox = card.querySelector(".card-selection input");
        if (checkbox) {
            checkbox.checked = active;
            checkbox.disabled = deleting;
        }
        if (selecting)
            card.querySelector(".thumb")?.setAttribute("aria-pressed", String(active));
    });
}
function toggleSelection(id) {
    if (state.deleting)
        return;
    if (state.selectedIds.has(id))
        state.selectedIds.delete(id);
    else
        state.selectedIds.add(id);
    updateSelection();
}
export function setSelecting(value) {
    if (state.deleting)
        return;
    state.selecting = value;
    state.selectedIds.clear();
    render();
    $(value ? "select-all" : "select-mode").focus();
}
export async function removeCaptures(captures) {
    if (!captures.length || state.deleting)
        return;
    state.deleting = true;
    updateSelection();
    try {
        const removed = state.removed = await changeCaptures(captures, true);
        const ids = new Set(captures.map(r => r.id));
        state.records = state.records.filter(r => !ids.has(r.id));
        state.trash = [...state.trash.filter(r => !ids.has(r.id)), ...removed];
        state.selectedIds.clear();
        state.selecting = false;
        render();
        notice(`${removed.length} snapshot${removed.length === 1 ? "" : "s"} moved to Recently deleted.`, !!removed.length);
        $(state.visibleRecords.length ? "select-mode" : state.records.length ? "reset-filters" : "empty-help").focus();
    }
    finally {
        state.deleting = false;
        updateSelection();
    }
}
