/** Pure helpers for GitHub-release based updates (unit tested). */

export const RELEASES_API = 'https://api.github.com/repos/Karelisio/Mijote/releases/latest';

export interface ReleaseInfo {
  version: string;
  tag: string;
  notes: string;
  apkUrl: string;
  apkSize: number;
  htmlUrl: string;
}

/** Parses "v1.2.3" / "1.2.3-beta" into [1, 2, 3]; null when not a version. */
export function parseVersion(v: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** > 0 when a is newer than b. Unparseable versions compare as equal. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i]! - pb[i]!;
  return 0;
}

interface GithubAsset {
  name?: unknown;
  browser_download_url?: unknown;
  size?: unknown;
}

/** Release assets are downloaded from github.com only (the native side enforces it too). */
export function isGithubDownloadUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.toLowerCase() === 'github.com';
  } catch {
    return false;
  }
}

/** Extracts the APK release from a GitHub "latest release" API payload. */
export function parseRelease(json: unknown): ReleaseInfo | null {
  if (typeof json !== 'object' || json === null) return null;
  const r = json as Record<string, unknown>;
  if (r.draft === true || r.prerelease === true || typeof r.tag_name !== 'string') return null;
  if (!parseVersion(r.tag_name)) return null;
  const assets = Array.isArray(r.assets) ? (r.assets as GithubAsset[]) : [];
  const apk = assets.find(
    (a) =>
      typeof a.name === 'string' &&
      a.name.toLowerCase().endsWith('.apk') &&
      typeof a.browser_download_url === 'string' &&
      isGithubDownloadUrl(a.browser_download_url),
  );
  if (!apk) return null;
  return {
    version: r.tag_name.replace(/^v/, ''),
    tag: r.tag_name,
    notes: typeof r.body === 'string' ? cleanNotes(r.body) : '',
    apkUrl: apk.browser_download_url as string,
    apkSize: typeof apk.size === 'number' ? apk.size : 0,
    htmlUrl: typeof r.html_url === 'string' ? r.html_url : '',
  };
}

/** Keeps the changelog readable in a dialog: bullet lines without commit hashes. */
export function cleanNotes(body: string): string {
  return body
    .split('\n')
    .filter((l) => l.startsWith('- '))
    .map((l) => l.replace(/\s*\([0-9a-f]{7,}\)\s*$/, ''))
    .slice(0, 12)
    .join('\n');
}
