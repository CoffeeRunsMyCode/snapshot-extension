import { icon } from "../icons.js";
import { state } from "./state.js";
export const $ = (id) => document.getElementById(id);
let noticeTimer = 0, undo = () => { };
export function onUndo(handler) { undo = handler; }
export function notice(text, showUndo = false) {
    const undoLabel = showUndo ? "Undo" : "Undo snapshot deletion";
    showUndo ||= state.removed.length > 0;
    clearTimeout(noticeTimer);
    const box = $("notice");
    box.replaceChildren(document.createTextNode(text));
    box.hidden = false;
    if (!showUndo)
        noticeTimer = window.setTimeout(() => { box.hidden = true; }, 6000);
    if (showUndo) {
        const button = document.createElement("button");
        button.textContent = undoLabel;
        button.onclick = () => undo();
        box.append(button);
    }
}
export function button(text, action, className = "", iconName) {
    const element = document.createElement("button");
    element.textContent = text;
    element.className = className;
    if (iconName)
        element.prepend(icon(iconName));
    element.addEventListener("click", async () => {
        element.disabled = true;
        try {
            await action();
        }
        catch (error) {
            notice(error.message);
        }
        finally {
            element.disabled = false;
        }
    });
    return element;
}
