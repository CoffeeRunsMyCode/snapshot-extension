import { restoreTrash, purgeCaptures } from "../db.js";
import { $, notice } from "./dom.js";
import { state } from "./state.js";
import { refresh } from "./view.js";

let purgeBusy = false, purgeIds: string[] = [];
const trashDialog = $<HTMLDialogElement>("trash-confirm");
$("restore-all").onclick = async () => {
  const control = $<HTMLButtonElement>("restore-all"); control.disabled = true;
  try { await restoreTrash(state.trash.map(r => r.id)); state.removed = []; await refresh(); notice("Deleted snapshots restored."); }
  catch (error) { notice((error as Error).message); }
  finally { control.disabled = !state.trash.length; }
};
$("empty-trash").onclick = () => {
  purgeIds = state.trash.map(r => r.id);
  $("trash-error").textContent = "";
  $("trash-confirm-description").textContent = "Permanently delete " + purgeIds.length + " snapshot(s)? This cannot be undone.";
  trashDialog.showModal(); $("cancel-trash").focus();
};
$("cancel-trash").onclick = () => trashDialog.close();
trashDialog.addEventListener("cancel", e => { if (purgeBusy) e.preventDefault(); });
trashDialog.addEventListener("close", () => document.querySelector<HTMLButtonElement>('[data-filter="trash"]')?.focus());
$("confirm-trash").onclick = async () => {
  if (purgeBusy) return;
  purgeBusy = true;
  for (const id of ["confirm-trash", "cancel-trash"]) $<HTMLButtonElement>(id).disabled = true;
  try {
    await purgeCaptures(purgeIds); state.removed = []; await refresh();
    trashDialog.close(); notice("Trash permanently deleted.");
  } catch (error) { $("trash-error").textContent = (error as Error).message; }
  finally { purgeBusy = false; for (const id of ["confirm-trash", "cancel-trash"]) $<HTMLButtonElement>(id).disabled = false; }
};
