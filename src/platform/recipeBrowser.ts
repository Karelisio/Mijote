import { MijoteNative, isNative } from './native';

export type BrowserResult =
  | { action: 'import'; url: string; title: string; html: string | null }
  | { action: 'closed' }
  /** Web/dev build: the site was opened in a new tab, nothing comes back. */
  | { action: 'external' };

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Opens a recipe site in Mijote's own browser (Android). The user browses, then taps
 * "Import this recipe": the page URL and its rendered HTML come back for parsing.
 */
export async function openRecipeBrowser(
  url: string,
  labels: { import: string; close: string; back: string; reload: string },
): Promise<BrowserResult> {
  if (!isNative()) {
    window.open(url, '_blank', 'noopener');
    return { action: 'external' };
  }
  const r = await MijoteNative.openRecipeBrowser({
    url,
    dark: document.documentElement.dataset.theme === 'dark',
    colors: [
      cssVar('--md-primary', '#9a4521'),
      cssVar('--md-on-primary', '#ffffff'),
      cssVar('--md-surface', '#fff8f6'),
      cssVar('--md-on-surface', '#231a16'),
      cssVar('--md-on-surface-variant', '#53433d'),
    ],
    labels: [labels.import, labels.close, labels.back, labels.reload],
  });
  if (r.action === 'import' && r.url) {
    return { action: 'import', url: r.url, title: r.title ?? '', html: r.html ?? null };
  }
  return { action: 'closed' };
}
