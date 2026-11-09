export interface Rect { x: number; y: number; width: number; height: number }
export function cropBounds(rect: Rect, viewport: { width: number; height: number }, image: { width: number; height: number }) {
  const values = [rect.x, rect.y, rect.width, rect.height, viewport.width, viewport.height, image.width, image.height];
  if (!values.every(Number.isFinite) || rect.width <= 0 || rect.height <= 0 || viewport.width <= 0 || viewport.height <= 0 || image.width <= 0 || image.height <= 0) {
    throw new Error("Invalid capture dimensions. Select the element again.");
  }
  const left = Math.max(0, rect.x), top = Math.max(0, rect.y);
  const right = Math.min(viewport.width, rect.x + rect.width), bottom = Math.min(viewport.height, rect.y + rect.height);
  if (right <= left || bottom <= top) throw new Error("That selection is outside the visible page.");
  const scaleX = image.width / viewport.width, scaleY = image.height / viewport.height;
  const x = Math.floor(left * scaleX), y = Math.floor(top * scaleY);
  return {
    x, y, width: Math.min(image.width, Math.ceil(right * scaleX)) - x,
    height: Math.min(image.height, Math.ceil(bottom * scaleY)) - y,
    clipped: left > rect.x || top > rect.y || right < rect.x + rect.width || bottom < rect.y + rect.height
  };
}
export function filename(createdAt: number) {
  return `Snapshot/capture-${new Date(createdAt).toISOString().replace(/[:.]/g, "-")}.png`;
}
/** A renamed snapshot downloads under the user's name; otherwise the neutral timestamp. Never the page title. */
export function downloadName(record: { createdAt: number; name?: string }) {
  const name = record.name?.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/[. ]+$/, "").trim();
  return name ? `Snapshot/${name}.png` : filename(record.createdAt);
}
