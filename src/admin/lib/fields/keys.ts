/** Field keys: stable identifiers, ^[a-z][a-z0-9_]{1,62}$ (enforced by the database). */
export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{1,62}$/;

const RESERVED_KEYS = new Set([
  "id",
  "status",
  "search",
  "attributes",
  "display_name",
  "assignment",
]);

/** "Vehicle Type" → "vehicle_type"; accents folded, numbers prefixed. */
export function fieldKeyFromLabel(label: string, taken: Iterable<string> = []): string {
  let key = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
  if (!key) key = "field";
  if (!/^[a-z]/.test(key)) key = `f_${key}`;
  if (key.length < 2) key = `${key}_field`;
  const used = new Set(taken);
  let candidate = key;
  let n = 2;
  while (used.has(candidate) || RESERVED_KEYS.has(candidate)) {
    candidate = `${key}_${n}`;
    n += 1;
  }
  return candidate;
}

export function fieldKeyError(key: string, taken: Iterable<string> = []): string | null {
  if (!FIELD_KEY_PATTERN.test(key)) {
    return "Use 2–63 lowercase letters, digits or underscores, starting with a letter";
  }
  if (RESERVED_KEYS.has(key)) return "This key is reserved by the system";
  for (const existing of taken) if (existing === key) return "Another field already uses this key";
  return null;
}
