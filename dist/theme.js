// Applies the Appearance setting to extension pages and keeps open pages in sync when it changes.
import { getSettings, validTheme } from "./settings.js";
export function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try {
        localStorage.setItem("snapshot-theme", theme);
    }
    catch { /* The cached copy only prevents a flash. */ }
}
export function followTheme() {
    void getSettings().then(s => applyTheme(s.theme)).catch(() => { });
    try {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === "local" && changes.settings)
                applyTheme(validTheme(changes.settings.newValue?.theme));
        });
    }
    catch { /* Without extension storage (tests, previews) the page stays on the system theme. */ }
}
