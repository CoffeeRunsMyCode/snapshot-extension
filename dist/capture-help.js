import { fillIcons } from "./icons.js";
const brandStyle = document.createElement("style");
brandStyle.textContent = window.__snapshotBrand.css;
document.head.prepend(brandStyle);
fillIcons();
document.getElementById("retry").onclick = async () => {
    const response = await chrome.runtime.sendMessage({ type: "snap:retry" });
    if (response?.ok)
        window.close();
    else
        document.getElementById("status").textContent = response?.error || "Could not retry. Reload the webpage and try again.";
};
document.getElementById("details").onclick = () => { void chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` }); };
document.getElementById("library").onclick = () => { void chrome.tabs.create({ url: chrome.runtime.getURL("gallery.html") }); };
