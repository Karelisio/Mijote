import type { ImportedRecipe } from '@/db/types';
import { fetchText } from './fetchPage';
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

/** Fetches and parses a recipe page. Throws `Error('no_recipe')` when nothing could be extracted. */
export async function importFromUrl(url: string): Promise<ImportedRecipe> {
  const html = await fetchText(url);
  const recipe = parseRecipeHtml(html, url);
  if (!recipe) throw new Error('no_recipe');
  return recipe;
}
