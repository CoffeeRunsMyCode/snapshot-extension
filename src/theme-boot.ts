// Loaded as a classic script in <head> so a saved Light or Dark choice applies before the first paint.
(() => {
  try { const theme = localStorage.getItem("snapshot-theme"); if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme; } catch { /* System theme still applies through CSS. */ }
})();
