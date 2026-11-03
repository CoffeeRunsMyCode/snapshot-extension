export function folderName(value: string): { name: string; nameKey: string } {
  const name = value.normalize("NFC").trim();
  if (!name) throw new Error("Enter a folder name.");
  if ([...name].length > 80) throw new Error("Use 80 characters or fewer.");
  if (/[\u0000-\u001f\u007f]/.test(name)) throw new Error("Use a name without control characters.");
  const nameKey = name.toLowerCase();
  if (nameKey === "unfiled") throw new Error("Unfiled is reserved. Choose another name.");
  return { name, nameKey };
}
