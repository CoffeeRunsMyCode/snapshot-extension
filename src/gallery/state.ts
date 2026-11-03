import type { Capture, Folder } from "../db.js";
import type { LibraryFilter } from "../library.js";

// Library page state shared by the view and its dialogs.
export const state = {
  records: [] as Capture[], trash: [] as Capture[], folders: [] as Folder[],
  // Captures from the latest deletion, offered for Undo.
  removed: [] as Capture[],
  visibleRecords: [] as Capture[],
  selected: undefined as Capture | undefined,
  filter: "all" as LibraryFilter, site: "", folder: undefined as string | undefined,
  selecting: false, deleting: false, folderBusy: false,
  selectedIds: new Set<string>(),
  movingIds: [] as string[]
};
export const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
