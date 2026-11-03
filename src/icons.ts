import "./brand.js";
const paths = window.__snapshotBrand.paths;
export function icon(name: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = paths[name] || paths.image;
  return svg;
}
export function fillIcons() { document.querySelectorAll<HTMLElement>("[data-icon]").forEach(el => el.replaceChildren(icon(el.dataset.icon!))); }
