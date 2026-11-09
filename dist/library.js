export function sourceUrl(url) {
    try {
        if (["https:", "http:", "file:"].includes(new URL(url).protocol))
            return url;
    }
    catch { }
}
export function siteName(url) { try {
    return new URL(url).hostname.replace(/^www\./, "") || "Local file";
}
catch {
    return "Website";
} }
export const displayName = (r) => r.name || r.title;
// A typed name doubles as a download filename, so it follows the strictest common rules (Windows).
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
export const FORBIDDEN_NAME_CHARACTERS = '\\ / : * ? " < > |';
/** Why a typed name can't be used, or undefined when it's fine. Empty is fine: it means "use the page title". */
export function nameProblem(value) {
    const name = value.replace(/\s+/g, " ").trim();
    if (!name)
        return undefined;
    if (/[\\/:*?"<>|\u0000-\u001f]/.test(name))
        return `Names can’t include ${FORBIDDEN_NAME_CHARACTERS}`;
    if (name.endsWith("."))
        return "Names can’t end with a full stop.";
    if (RESERVED.test(name))
        return `“${name}” is reserved by Windows. Try another name.`;
}
export function filterCaptures(records, options) {
    const query = options.search.toLowerCase().trim();
    const weekAgo = (options.now ?? Date.now()) - 7 * 24 * 60 * 60 * 1000;
    return records.filter(r => (options.filter !== "favorites" || r.favorite)
        && (options.filter !== "recent" || r.createdAt >= weekAgo)
        && (!options.site || siteName(r.url) === options.site)
        && (options.folder === undefined || (r.folderId || "") === options.folder)
        && `${r.name || ""} ${r.title} ${r.url} ${r.label}`.toLowerCase().includes(query))
        .sort((a, b) => options.oldest ? a.createdAt - b.createdAt : b.createdAt - a.createdAt);
}
