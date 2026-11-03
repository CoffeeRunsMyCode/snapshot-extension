import { getSettings, saveSettings } from "../settings.js";
import { $, notice } from "./dom.js";
let settingsBusy = false;
const settingsDialog = $("settings-dialog");
$("open-settings").onclick = async () => {
    const opener = $("open-settings");
    opener.disabled = true;
    try {
        const settings = await getSettings();
        $("setting-auto-copy").checked = settings.autoCopy;
        $("setting-auto-save").checked = settings.autoSave;
        $("setting-save-source").checked = settings.saveSource;
        $("settings-error").textContent = "";
        settingsDialog.showModal();
    }
    catch {
        notice("Could not load settings. Try again.");
    }
    finally {
        opener.disabled = false;
    }
};
$("cancel-settings").onclick = () => settingsDialog.close();
settingsDialog.addEventListener("cancel", e => { if (settingsBusy)
    e.preventDefault(); });
settingsDialog.addEventListener("close", () => $("open-settings").focus());
$("settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (settingsBusy)
        return;
    settingsBusy = true;
    for (const id of ["save-settings", "cancel-settings"])
        $(id).disabled = true;
    try {
        await saveSettings({ autoSave: $("setting-auto-save").checked, autoCopy: $("setting-auto-copy").checked, saveSource: $("setting-save-source").checked });
        settingsDialog.close();
        notice("Settings saved.");
    }
    catch {
        $("settings-error").textContent = "Could not save settings. Your previous settings are unchanged. Try again.";
    }
    finally {
        settingsBusy = false;
        for (const id of ["save-settings", "cancel-settings"])
            $(id).disabled = false;
    }
});
