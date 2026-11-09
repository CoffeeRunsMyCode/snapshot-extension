import { getSettings, saveSettings, validTheme } from "../settings.js";
import { $, notice } from "./dom.js";

let settingsBusy = false;
const settingsDialog = $<HTMLDialogElement>("settings-dialog");
$("open-settings").onclick = async () => {
  const opener = $<HTMLButtonElement>("open-settings"); opener.disabled = true;
  try {
    const settings = await getSettings();
    $<HTMLInputElement>("setting-auto-copy").checked = settings.autoCopy;
    $<HTMLInputElement>("setting-auto-save").checked = settings.autoSave;
    $<HTMLSelectElement>("setting-padding").value = String(settings.padding);
    $<HTMLInputElement>("setting-save-source").checked = settings.saveSource;
    $<HTMLInputElement>("setting-ask-where").checked = settings.askWhere;
    $<HTMLSelectElement>("setting-theme").value = settings.theme;
    $("settings-error").textContent = "";
    settingsDialog.showModal();
  } catch { notice("Could not load settings. Try again."); }
  finally { opener.disabled = false; }
};
$("cancel-settings").onclick = () => settingsDialog.close();
settingsDialog.addEventListener("cancel", e => { if (settingsBusy) e.preventDefault(); });
settingsDialog.addEventListener("close", () => $("open-settings").focus());
$("settings-form").addEventListener("submit", async e => {
  e.preventDefault(); if (settingsBusy) return;
  settingsBusy = true;
  for (const id of ["save-settings", "cancel-settings"]) $<HTMLButtonElement>(id).disabled = true;
  try {
    await saveSettings({ autoSave: $<HTMLInputElement>("setting-auto-save").checked, autoCopy: $<HTMLInputElement>("setting-auto-copy").checked, saveSource: $<HTMLInputElement>("setting-save-source").checked, padding: Number($<HTMLSelectElement>("setting-padding").value), askWhere: $<HTMLInputElement>("setting-ask-where").checked, theme: validTheme($<HTMLSelectElement>("setting-theme").value) });
    settingsDialog.close(); notice("Settings saved.");
  } catch { $("settings-error").textContent = "Could not save settings. Your previous settings are unchanged. Try again."; }
  finally { settingsBusy = false; for (const id of ["save-settings", "cancel-settings"]) $<HTMLButtonElement>(id).disabled = false; }
});
