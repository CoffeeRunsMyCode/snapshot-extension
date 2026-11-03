import { $, notice } from "./dom.js";
import { state } from "./state.js";
import { copy, render, request, removeCaptures, setSelecting, updateSelection } from "./view.js";
// Selection
$("select-mode").onclick = () => setSelecting(true);
$("cancel-selection").onclick = () => setSelecting(false);
$("select-all").onchange = () => {
    state.selectedIds.clear();
    if ($("select-all").checked)
        for (const record of state.visibleRecords)
            state.selectedIds.add(record.id);
    updateSelection();
};
$("delete-selected").onclick = async () => {
    try {
        await removeCaptures(state.visibleRecords.filter(r => state.selectedIds.has(r.id)));
    }
    catch (error) {
        notice(error.message);
    }
};
// Sidebar and layout
// Wide windows dock the sidebar and remember the choice; narrow windows use it as a drawer that starts closed.
const narrow = matchMedia("(max-width: 720px)");
function dockedCollapsed() { try {
    return localStorage.getItem("snapshot-sidebar-collapsed") === "true";
}
catch {
    return false;
} }
function setSidebar(collapsed) {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    $("sidebar").hidden = collapsed;
    const toggle = $("toggle-sidebar");
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    toggle.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
    if (!narrow.matches)
        try {
            localStorage.setItem("snapshot-sidebar-collapsed", String(collapsed));
        }
        catch { }
}
const drawerOpen = () => narrow.matches && !$("sidebar").hidden;
function closeDrawer() { setSidebar(true); $("toggle-sidebar").focus(); }
$("toggle-sidebar").onclick = () => setSidebar(!$("sidebar").hidden);
narrow.addEventListener("change", () => setSidebar(narrow.matches || dockedCollapsed()));
$("sidebar").addEventListener("click", event => { if (drawerOpen() && event.target.closest(".nav-item"))
    closeDrawer(); });
document.addEventListener("click", event => {
    const target = event.target;
    if (!drawerOpen() || document.querySelector("dialog[open]") || $("sidebar").contains(target) || $("toggle-sidebar").contains(target))
        return;
    event.preventDefault();
    event.stopPropagation();
    closeDrawer();
}, true);
document.addEventListener("keydown", event => { if (event.key === "Escape" && drawerOpen() && !document.querySelector("dialog[open]"))
    closeDrawer(); });
setSidebar(narrow.matches || dockedCollapsed());
const topbar = document.querySelector(".topbar");
new ResizeObserver(() => {
    document.documentElement.style.setProperty("--library-header-height", `${topbar.getBoundingClientRect().height}px`);
}).observe(topbar);
function setLayout(layout) {
    const list = layout === "list";
    $("grid").classList.toggle("list-layout", list);
    for (const [id, active] of [["grid-view", !list], ["list-view", list]]) {
        $(id).classList.toggle("selected", active);
        $(id).setAttribute("aria-pressed", String(active));
    }
    try {
        localStorage.setItem("snapshot-layout", list ? "list" : "grid");
    }
    catch { }
}
$("grid-view").onclick = () => setLayout("grid");
$("list-view").onclick = () => setLayout("list");
try {
    setLayout(localStorage.getItem("snapshot-layout") || "grid");
}
catch { }
// Guide and viewer
function guide() { $("guide").showModal(); }
$("help").onclick = guide;
$("empty-help").onclick = guide;
$("close-guide").onclick = $("got-it").onclick = () => $("guide").close();
$("close-viewer").onclick = () => $("viewer").close();
for (const id of ["viewer-copy", "viewer-download"])
    $(id).onclick = async () => {
        const { selected } = state;
        if (!selected)
            return;
        try {
            if (id === "viewer-copy") {
                await copy(selected);
                $("viewer-status").textContent = "Image copied to clipboard.";
            }
            else {
                await request("snap:download", selected.id);
                $("viewer-status").textContent = "PNG download started.";
            }
        }
        catch (error) {
            $("viewer-status").textContent = error.message;
        }
    };
// Filters and keyboard shortcuts
$("search").addEventListener("input", render);
$("sort").addEventListener("change", render);
document.querySelectorAll("[data-filter]").forEach(el => el.onclick = () => { state.selecting = false; state.selectedIds.clear(); state.folder = undefined; state.filter = el.dataset.filter; state.site = ""; render(); });
$("reset-filters").onclick = () => { state.folder = undefined; state.filter = "all"; state.site = ""; $("search").value = ""; render(); };
document.addEventListener("keydown", event => {
    if (state.selecting && !document.querySelector("dialog[open]") && !(event.target instanceof HTMLInputElement && event.target.type !== "checkbox") && !(event.target instanceof HTMLTextAreaElement) && !(event.target instanceof HTMLSelectElement) && !event.ctrlKey && !event.altKey && !event.metaKey) {
        if (event.key === "Escape") {
            event.preventDefault();
            setSelecting(false);
        }
        if (event.key === "Delete" && state.selectedIds.size) {
            event.preventDefault();
            $("delete-selected").click();
        }
    }
    if (event.key === "/" && !event.ctrlKey && !event.altKey && !event.metaKey && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        $("search").focus();
    }
});
