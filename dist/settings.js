export async function getSettings() {
    const { settings } = await chrome.storage.local.get("settings");
    return { autoCopy: settings?.autoCopy !== false, saveSource: settings?.saveSource !== false, autoSave: settings?.autoSave === true };
}
export async function saveSettings(settings) {
    await chrome.storage.local.set({ settings: { autoCopy: settings.autoCopy === true, saveSource: settings.saveSource === true, autoSave: settings.autoSave === true } });
}
