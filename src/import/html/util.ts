/** Shared helpers for the JSON-LD / microdata / heuristics HTML extractors. */

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Decodes HTML entities in a raw string (e.g. a JSON-LD string value containing "&#039;"). */
export function decodeEntities(doc: Document, s: string): string {
  const el = doc.createElement('textarea');
  el.innerHTML = s;
  return el.value;
}

/** Strips HTML tags and collapses whitespace. */
export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Collapses whitespace runs (for text already free of tags, e.g. from `textContent`). */
export function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Resolves a possibly-relative URL against the page URL; returns the input unchanged on failure. */
export function resolveUrl(maybeRelative: string, base: string): string {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

/** First string found in a value that may be a string, an array (mixed), or something else. */
export function firstString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    for (const item of v) if (typeof item === 'string') return item;
  }
  return null;
}

/** All strings found directly in a value that may be a single string or an array of strings. */
export function allStrings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [];
}

/** Dedupes, lower-cases and trims tag candidates, capped at `max`. */
export function normalizeTags(raw: string[], max = 10): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const t = cleanText(r).toLowerCase();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
    if (out.length >= max) break;
  }
  return out;
}
