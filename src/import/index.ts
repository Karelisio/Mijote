import { Capacitor } from '@capacitor/core';
import type { ImportedRecipe } from '@/db/types';
import { fetchText, type FetchOptions } from './fetchPage';
import { parseRecipeHtml } from './html';

export { parseIsoDuration, parseHumanDuration } from './duration';
export { parseIngredientLine } from './ingredientParser';
export { parseRecipeText } from './textParser';
export { mapCategory } from './category';
export { extractJsonLd } from './html/jsonld';
export { extractMicrodata } from './html/microdata';
export { extractHeuristics } from './html/heuristics';
export { parseRecipeHtml, mergeImported } from './html';
export { fetchText, fetchBinary, normalizeUrl } from './fetchPage';

/** A JSON reply (a recipe API, a schema.org document) is read like a page's JSON-LD block. */
export function asHtml(body: string): string {
  if (!/^\s*[[{]/.test(body)) return body;
  return `<script type="application/ld+json">${body.replace(/</g, '\\u003c')}</script>`;
}

/**
 * Fetches and parses a recipe page. Throws `Error('no_recipe')` when nothing could be extracted,
 * `Error('insecure_http')` for an http:// page that is not available over https (Android blocks
 * clear-text traffic) and `Error('timeout')` when the site does not answer.
 */
export async function importFromUrl(url: string, opts: FetchOptions = {}): Promise<ImportedRecipe> {
  let target = url;
  let body: string;
  if (/^http:\/\//i.test(url)) {
    const secure = url.replace(/^http:/i, 'https:');
    try {
      body = await fetchText(secure, opts);
      target = secure;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      if (!Capacitor.isNativePlatform()) {
        body = await fetchText(url, opts); // the browser (or the dev proxy) can load http://
      } else if (e instanceof Error && /^http_\d+$/.test(e.message)) {
        throw e; // the site answered over https (e.g. 404): nothing to do with clear text
      } else {
        throw new Error('insecure_http');
      }
    }
  } else {
    body = await fetchText(url, opts);
  }
  const recipe = parseRecipeHtml(asHtml(body), target);
  if (!recipe) throw new Error('no_recipe');
  return recipe;
}
