import { folderName } from "./folders.js";

export interface Capture {
  id: string; title: string; url: string; label: string; createdAt: number;
  width: number; height: number; clipped: boolean; blob: Blob; favorite?: boolean; folderId?: string;
}
export interface Folder { id: string; name: string; nameKey: string; createdAt: number; updatedAt: number }
let connection: Promise<IDBDatabase> | undefined;
function open() {
  return connection ??= new Promise((resolve, reject) => {
    // Preserve the original database so existing libraries survive the SnapShot rename.
    const request = indexedDB.open("element-snap", 3);
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("captures")) db.createObjectStore("captures", { keyPath: "id" });
      if (!db.objectStoreNames.contains("trash")) db.createObjectStore("trash", { keyPath: "id" });
      if (!db.objectStoreNames.contains("folders")) {
        const store = db.createObjectStore("folders", { keyPath: "id" });
        store.createIndex("nameKey", "nameKey", { unique: true });
      }
    };
    request.onblocked = () => {
      blocked = true; connection = undefined;
      reject(new Error("Close other Snapshot library tabs, then reload to finish updating your library."));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => { db.close(); connection = undefined; };
      db.onclose = () => { connection = undefined; };
      resolve(db);
    };
    request.onerror = () => { connection = undefined; reject(request.error); };
  });
}
async function transaction<T>(stores: string[], mode: IDBTransactionMode,
  run: (tx: IDBTransaction, result: (value: T) => void, fail: (message: string) => void) => void): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let value: T, reason: string | undefined;
    tx.oncomplete = () => resolve(value);
    tx.onabort = () => reject(new Error(reason || (tx.error?.name === "ConstraintError"
      ? "A folder with this name already exists. Choose another name."
      : "The library could not be updated. Try again.")));
    const fail = (message: string) => { reason = message; tx.abort(); };
    try { run(tx, result => { value = result; }, fail); }
    catch (error) { fail((error as Error).message); }
  });
}
export const listCaptures = () => transaction<Capture[]>(["captures"], "readonly", (tx, result) => {
  const request = tx.objectStore("captures").getAll(); request.onsuccess = () => result(request.result);
});
export const listFolders = () => transaction<Folder[]>(["folders"], "readonly", (tx, result) => {
  const request = tx.objectStore("folders").getAll(); request.onsuccess = () => result(request.result);
});
export const listLibrary = () => transaction<{ captures: Capture[]; folders: Folder[]; trash: Capture[] }>(["captures", "folders", "trash"], "readonly", (tx, result) => {
  const captures = tx.objectStore("captures").getAll(); const folders = tx.objectStore("folders").getAll();
  const trash = tx.objectStore("trash").getAll();
  trash.onsuccess = () => result({ captures: captures.result, folders: folders.result, trash: trash.result });
});
export const getCapture = (id: string) => transaction<Capture | undefined>(["captures"], "readonly", (tx, result) => {
  const request = tx.objectStore("captures").get(id); request.onsuccess = () => result(request.result);
});
// Re-saving the same in-page draft must preserve subsequent library edits.
export const saveCapture = (capture: Capture) => transaction<void>(["captures"], "readwrite", tx => {
  const store = tx.objectStore("captures"), request = store.get(capture.id);
  request.onsuccess = () => { if (!request.result) store.add(capture); };
});
export const setFavorite = (id: string, favorite: boolean) => transaction<void>(["captures"], "readwrite", (tx, _result, fail) => {
  const store = tx.objectStore("captures"), request = store.get(id);
  request.onsuccess = () => {
    if (!request.result) { fail("This snapshot is no longer in the library. Reload to refresh."); return; }
    store.put({ ...request.result, favorite });
  };
});
export async function deleteCapture(id: string) { const record = await getCapture(id); if (record) await changeCaptures([record], true); }
export const purgeCaptures = (ids: string[]) => transaction<void>(["trash"], "readwrite", tx => {
  for (const id of new Set(ids)) tx.objectStore("trash").delete(id);
});
export const restoreTrash = (ids: string[]) => transaction<void>(["captures", "folders", "trash"], "readwrite", tx => {
  for (const id of new Set(ids)) {
    const trash = tx.objectStore("trash"), request = trash.get(id);
    request.onsuccess = () => {
      const record = request.result as Capture | undefined;
      if (!record) return;
      const save = () => { tx.objectStore("captures").put(record); trash.delete(id); };
      if (!record.folderId) { save(); return; }
      const folder = tx.objectStore("folders").get(record.folderId);
      folder.onsuccess = () => { if (!folder.result) delete record.folderId; save(); };
    };
  }
});

// Both batch deletion and Undo commit atomically. Undo resolves removed folders to Unfiled.
export const changeCaptures = (captures: Capture[], remove = false) => transaction<Capture[]>(["captures", "folders", "trash"], "readwrite", (tx, result) => {
  const store = tx.objectStore("captures");
  const removed: Capture[] = []; result(removed);
  for (const capture of captures) {
    const existing = store.get(capture.id);
    existing.onsuccess = () => {
      if (remove) {
        if (existing.result) { removed.push(existing.result); tx.objectStore("trash").put(existing.result); store.delete(capture.id); }
        return;
      }
      if (existing.result) return;
      tx.objectStore("trash").delete(capture.id);
      if (!capture.folderId) { store.put(capture); return; }
      const folder = tx.objectStore("folders").get(capture.folderId);
      folder.onsuccess = () => {
        const restored = { ...capture };
        if (!folder.result) delete restored.folderId;
        store.put(restored);
      };
    };
  }
});

export async function createFolder(value: string): Promise<Folder> {
  const names = folderName(value), now = Date.now();
  const folder: Folder = { id: crypto.randomUUID(), ...names, createdAt: now, updatedAt: now };
  return transaction<Folder>(["folders"], "readwrite", (tx, result) => {
    tx.objectStore("folders").add(folder); result(folder);
  });
}
export async function renameFolder(id: string, value: string): Promise<void> {
  const names = folderName(value);
  return transaction<void>(["folders"], "readwrite", (tx, _result, fail) => {
    const store = tx.objectStore("folders"), request = store.get(id);
    request.onsuccess = () => {
      if (!request.result) { fail("This folder no longer exists. Reload to refresh."); return; }
      store.put({ ...request.result, ...names, updatedAt: Date.now() });
    };
  });
}
export const moveCaptures = (ids: string[], folderId?: string) => transaction<void>(["captures", "folders"], "readwrite", (tx, _result, fail) => {
  const move = () => {
    const store = tx.objectStore("captures");
    for (const id of new Set(ids)) {
      const request = store.get(id);
      request.onsuccess = () => {
        if (!request.result) { fail("A selected snapshot was deleted. Reload and select the snapshots again."); return; }
        const capture = { ...request.result };
        if (folderId) capture.folderId = folderId; else delete capture.folderId;
        store.put(capture);
      };
    }
  };
  if (!folderId) { move(); return; }
  const request = tx.objectStore("folders").get(folderId);
  request.onsuccess = () => {
    if (!request.result) { fail("This folder no longer exists. Choose another folder."); return; }
    move();
  };
});
export const deleteFolder = (id: string) => transaction<void>(["captures", "folders"], "readwrite", tx => {
  const store = tx.objectStore("captures"), request = store.openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    if (cursor.value.folderId === id) {
      const capture = { ...cursor.value }; delete capture.folderId; cursor.update(capture);
    }
    cursor.continue();
  };
  tx.objectStore("folders").delete(id);
});
