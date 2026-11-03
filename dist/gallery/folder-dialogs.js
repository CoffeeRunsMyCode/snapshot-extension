import { listFolders, createFolder, renameFolder, deleteFolder, moveCaptures } from "../db.js";
import { folderName } from "../folders.js";
import { $, notice } from "./dom.js";
import { openMove, populateDestinations } from "./move.js";
import { state, byName } from "./state.js";
import { refresh } from "./view.js";
let editingFolder, deletingFolder;
function setFolderBusy(value) {
    state.folderBusy = value;
    for (const id of ["folder-editor", "folder-delete-dialog", "move-dialog"]) {
        const dialog = $(id);
        dialog.setAttribute("aria-busy", String(value));
        dialog.querySelectorAll("input, button, select").forEach(el => { el.disabled = value; });
    }
}
function focusAfterDialog() {
    if (document.activeElement !== document.body)
        return;
    if ($("move-dialog").open)
        $("move-destination").focus();
    else if ($("viewer").open)
        $("viewer-move").focus();
    else
        $(state.selecting ? "move-selected" : "select-mode").focus();
}
for (const id of ["folder-editor", "folder-delete-dialog", "move-dialog"]) {
    $(id).addEventListener("cancel", event => { if (state.folderBusy)
        event.preventDefault(); });
    $(id).addEventListener("close", focusAfterDialog);
}
function editorError(message) {
    $("folder-error").textContent = message;
    $("folder-name").setAttribute("aria-invalid", String(!!message));
}
function validateFolderInput() {
    try {
        const { nameKey } = folderName($("folder-name").value);
        if (state.folders.some(f => f.id !== editingFolder && f.nameKey === nameKey))
            throw new Error("A folder with this name already exists. Choose another name.");
        editorError("");
        return true;
    }
    catch (error) {
        editorError(error.message);
        return false;
    }
}
function openFolderEditor(id) {
    editingFolder = id;
    editorError("");
    $("folder-editor-title").textContent = id ? "Rename folder" : "New folder";
    $("save-folder").textContent = id ? "Save changes" : "Create folder";
    const input = $("folder-name");
    input.value = state.folders.find(f => f.id === id)?.name || "";
    $("folder-editor").showModal();
    input.focus();
    input.select();
}
$("new-folder").onclick = () => openFolderEditor();
$("move-new-folder").onclick = () => openFolderEditor();
$("rename-folder").onclick = () => { if (state.folder)
    openFolderEditor(state.folder); };
$("cancel-folder").onclick = () => $("folder-editor").close();
$("folder-name").addEventListener("blur", () => { if ($("folder-name").value)
    validateFolderInput(); });
$("folder-name").addEventListener("input", () => { if ($("folder-error").textContent)
    validateFolderInput(); });
$("folder-form").onsubmit = async (event) => {
    event.preventDefault();
    if (state.folderBusy)
        return;
    if (!validateFolderInput()) {
        $("folder-name").focus();
        return;
    }
    setFolderBusy(true);
    try {
        const value = $("folder-name").value;
        const inMove = $("move-dialog").open;
        let saved;
        if (editingFolder)
            await renameFolder(editingFolder, value);
        else
            saved = await createFolder(value);
        if (saved && !inMove) {
            state.folder = saved.id;
            state.site = "";
            state.filter = "all";
            $("search").value = "";
        }
        await refresh();
        if (inMove && saved)
            populateDestinations(saved.id);
        setFolderBusy(false);
        $("folder-editor").close();
        if (inMove)
            $("move-destination").focus();
        else {
            notice(editingFolder ? "Folder renamed." : "Folder created. Choose Move on a snapshot to file it here.");
            $("rename-folder").focus();
        }
    }
    catch (error) {
        editorError(error.message);
    }
    finally {
        setFolderBusy(false);
    }
};
$("delete-folder").onclick = () => {
    const current = state.folders.find(f => f.id === state.folder);
    if (!current)
        return;
    deletingFolder = current.id;
    const count = state.records.filter(r => r.folderId === current.id).length;
    $("folder-delete-description").textContent = `Delete “${current.name}”? Its ${count} snapshot${count === 1 ? "" : "s"} will be kept in Unfiled. No snapshots will be deleted.`;
    $("folder-delete-error").textContent = "";
    $("folder-delete-dialog").showModal();
    $("cancel-folder-delete").focus();
};
$("cancel-folder-delete").onclick = () => $("folder-delete-dialog").close();
$("folder-delete-form").onsubmit = async (event) => {
    event.preventDefault();
    if (state.folderBusy || !deletingFolder)
        return;
    setFolderBusy(true);
    try {
        await deleteFolder(deletingFolder);
        state.folder = "";
        $("search").value = "";
        await refresh();
        setFolderBusy(false);
        $("folder-delete-dialog").close();
        notice("Folder deleted. Its snapshots are kept in Unfiled.");
        $("select-mode").focus();
    }
    catch (error) {
        $("folder-delete-error").textContent = error.message;
    }
    finally {
        setFolderBusy(false);
    }
};
$("move-selected").onclick = async () => {
    try {
        await openMove(state.visibleRecords.filter(r => state.selectedIds.has(r.id)).map(r => r.id));
    }
    catch (error) {
        notice(error.message);
    }
};
$("cancel-move").onclick = () => $("move-dialog").close();
$("move-form").onsubmit = async (event) => {
    event.preventDefault();
    if (state.folderBusy)
        return;
    setFolderBusy(true);
    const destination = $("move-destination").value;
    const movingIds = state.movingIds;
    try {
        await moveCaptures(movingIds, destination || undefined);
        state.selectedIds.clear();
        state.selecting = false;
        await refresh();
        setFolderBusy(false);
        $("move-dialog").close();
        notice(`${movingIds.length} snapshot${movingIds.length === 1 ? "" : "s"} moved to ${state.folders.find(f => f.id === destination)?.name || "Unfiled"}.`);
        if ($("viewer").open)
            $("viewer-move").focus();
        else
            $("select-mode").focus();
    }
    catch (error) {
        $("move-error").textContent = error.message;
        try {
            state.folders = (await listFolders()).sort(byName);
            populateDestinations(destination);
        }
        catch { /* Preserve the original error and allow retry. */ }
    }
    finally {
        setFolderBusy(false);
    }
};
