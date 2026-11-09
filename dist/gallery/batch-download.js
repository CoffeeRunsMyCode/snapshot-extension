// Select mode → Download: one PNG for a single snapshot, otherwise one ZIP, so "Ask where to save"
// prompts once and the downloads list gets one entry. Files inside use the same names as single downloads.
import { downloadName } from "../geometry.js";
import { getSettings } from "../settings.js";
import { buildZip, uniqueNames } from "../zip.js";
import { $, notice } from "./dom.js";
import { state } from "./state.js";
import { request } from "./view.js";
export async function downloadSelected() {
    const chosen = state.visibleRecords.filter(r => state.selectedIds.has(r.id));
    if (!chosen.length)
        return;
    if (chosen.length === 1) {
        await request("snap:download", chosen[0].id);
        notice("PNG download started.");
        return;
    }
    const names = uniqueNames(chosen.map(r => downloadName(r).replace(/^Snapshot\//, "")));
    const entries = await Promise.all(chosen.map(async (r, i) => ({ name: names[i], data: new Uint8Array(await r.blob.arrayBuffer()), modified: r.createdAt })));
    const url = URL.createObjectURL(buildZip(entries));
    const filename = `Snapshot/Snapshot ${new Date().toLocaleDateString("en-CA")} (${chosen.length} images).zip`;
    try {
        const id = await chrome.downloads.download({ url, filename, ...((await getSettings()).askWhere ? { saveAs: true } : {}) });
        // Keep the ZIP in memory until Chrome has finished writing it.
        const done = (delta) => {
            if (delta.id !== id || !delta.state || delta.state.current === "in_progress")
                return;
            URL.revokeObjectURL(url);
            chrome.downloads.onChanged.removeListener(done);
        };
        chrome.downloads.onChanged.addListener(done);
        notice(`ZIP of ${chosen.length} snapshots download started.`);
    }
    catch (error) {
        URL.revokeObjectURL(url);
        throw new Error("The ZIP download didn’t start. Try again, or download images one at a time.");
    }
}
$("download-selected").onclick = async () => {
    const button = $("download-selected");
    button.disabled = true;
    try {
        await downloadSelected();
    }
    catch (error) {
        notice(error.message);
    }
    finally {
        button.disabled = !state.selectedIds.size;
    }
};
