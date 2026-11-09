export type Theme = "system" | "light" | "dark";
export interface Settings { autoCopy: boolean; saveSource: boolean; autoSave: boolean; padding: number; askWhere: boolean; theme: Theme }
export const PADDING_CHOICES = [0, 8, 16, 24];
const validPadding = (value: unknown) => PADDING_CHOICES.includes(Number(value)) ? Number(value) : 0;
export const validTheme = (value: unknown): Theme => value === "light" || value === "dark" ? value : "system";
export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  return { autoCopy: settings?.autoCopy !== false, saveSource: settings?.saveSource !== false, autoSave: settings?.autoSave === true, padding: validPadding(settings?.padding), askWhere: settings?.askWhere === true, theme: validTheme(settings?.theme) };
}
export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings: { autoCopy: settings.autoCopy === true, saveSource: settings.saveSource === true, autoSave: settings.autoSave === true, padding: validPadding(settings.padding), askWhere: settings.askWhere === true, theme: validTheme(settings.theme) } });
}
