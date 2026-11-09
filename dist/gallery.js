// Library page entry. Feature modules attach their own handlers on import.
import { fillIcons } from "./icons.js";
import { notice } from "./gallery/dom.js";
import { state } from "./gallery/state.js";
import { preview, refresh } from "./gallery/view.js";
import "./gallery/folder-dialogs.js";
import "./gallery/trash.js";
import "./gallery/settings-dialog.js";
import "./gallery/controls.js";
import "./gallery/batch-download.js";
import { followTheme } from "./theme.js";
const brandStyle = document.createElement("style");
brandStyle.textContent = window.__snapshotBrand.css;
document.head.prepend(brandStyle);
fillIcons();
followTheme();
document.addEventListener("visibilitychange", () => { if (!document.hidden)
    void refresh(); });
const error = new URL(location.href).searchParams.get("error");
if (error)
    notice(error);
await refresh();
function previewFromHash() { if (location.hash) {
    const record = state.records.find(r => r.id === location.hash.slice(1));
    if (record)
        preview(record);
} }
previewFromHash();
// The worker reuses an open library tab and points it at a new capture by changing the hash.
window.addEventListener("hashchange", async () => { if (state.selected?.id === location.hash.slice(1))
    return; await refresh(); previewFromHash(); });
