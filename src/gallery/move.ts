import { listLibrary } from "../db.js";
import { $ } from "./dom.js";
import { state, byName } from "./state.js";

export function populateDestinations(value = "") {
  const select = $<HTMLSelectElement>("move-destination"); select.replaceChildren();
  for (const entry of [{ id: "", name: "Unfiled" }, ...state.folders]) {
    const option = document.createElement("option"); option.value = entry.id; option.textContent = entry.name; select.append(option);
  }
  select.value = state.folders.some(f => f.id === value) ? value : "";
}
export async function openMove(ids: string[]) {
  if (!ids.length || state.folderBusy) return;
  const data = await listLibrary(); state.folders = data.folders.sort(byName);
  state.movingIds = ids;
  const first = data.captures.find(r => r.id === ids[0]);
  const common = ids.every(id => data.captures.find(r => r.id === id)?.folderId === first?.folderId);
  populateDestinations(common ? first?.folderId : "");
  $("move-title").textContent = `Move ${ids.length === 1 ? "snapshot" : `${ids.length} snapshots`}`;
  $("move-error").textContent = "";
  $<HTMLDialogElement>("move-dialog").showModal(); $("move-destination").focus();
}
