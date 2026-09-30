/**
 * The URL when it is an absolute http(s) URL, else null: a recipe source must never become a
 * `javascript:`, `data:` or `file:` link (React 18 renders such hrefs as they are).
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  const s = value?.trim();
  if (!s || !/^https?:\/\//i.test(s)) return null;
  try {
    const { protocol } = new URL(s);
    return protocol === 'http:' || protocol === 'https:' ? s : null;
  } catch {
    return null;
  }
}

/**
 * Source link typed in the editor: a bare domain ("marmiton.org/…") gets https://, anything
 * else that is not an http(s) URL (other schemes, free text) is dropped.
 */
export function normalizeSourceUrl(value: string): string | null {
  const s = value.trim();
  if (/^https?:\/\//i.test(s)) return safeHttpUrl(s);
  if (/^[\w-]+(?:\.[\w-]+)+(?:[/?#]\S*)?$/.test(s)) return safeHttpUrl(`https://${s}`);
  return null;
}
