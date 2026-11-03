export interface Settings { autoCopy: boolean; saveSource: boolean; autoSave: boolean }
export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  return { autoCopy: settings?.autoCopy !== false, saveSource: settings?.saveSource !== false, autoSave: settings?.autoSave === true };
}
export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings: { autoCopy: settings.autoCopy === true, saveSource: settings.saveSource === true, autoSave: settings.autoSave === true } });
}
