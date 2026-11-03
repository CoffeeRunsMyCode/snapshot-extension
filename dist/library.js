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
export function filterCaptures(records, options) {
    const query = options.search.toLowerCase().trim();
    const weekAgo = (options.now ?? Date.now()) - 7 * 24 * 60 * 60 * 1000;
    return records.filter(r => (options.filter !== "favorites" || r.favorite)
        && (options.filter !== "recent" || r.createdAt >= weekAgo)
        && (!options.site || siteName(r.url) === options.site)
        && (options.folder === undefined || (r.folderId || "") === options.folder)
        && `${r.title} ${r.url} ${r.label}`.toLowerCase().includes(query))
        .sort((a, b) => options.oldest ? a.createdAt - b.createdAt : b.createdAt - a.createdAt);
}
