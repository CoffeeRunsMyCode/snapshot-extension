/** Retain source context without credentials or query/fragment tokens. */
export function privateSourceUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return "";
    url.username = ""; url.password = ""; url.search = ""; url.hash = "";
    return url.href;
  } catch { return ""; }
}
