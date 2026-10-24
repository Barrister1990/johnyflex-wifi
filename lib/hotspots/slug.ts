/** Turn a hotspot name into a URL-safe slug, e.g. "Accra Café" → "accra-cafe". */
export function slugifyHotspotName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "hotspot";
}

/** Ensure slug is unique among existing values; append -2, -3, … if needed. */
export function ensureUniqueSlug(
  base: string,
  existing: Iterable<string>,
): string {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function portalPath(
  hotspot: { slug: string },
  suffix = "",
): string {
  return `/portal/${hotspot.slug}${suffix}`;
}
