// Library page state shared by the view and its dialogs.
export const state = {
    records: [], trash: [], folders: [],
    // Captures from the latest deletion, offered for Undo.
    removed: [],
    visibleRecords: [],
    selected: undefined,
    filter: "all", site: "", folder: undefined,
    selecting: false, deleting: false, folderBusy: false,
    selectedIds: new Set(),
    movingIds: []
};
export const byName = (a, b) => a.name.localeCompare(b.name);
