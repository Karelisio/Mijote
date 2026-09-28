import type { ImportedRecipe } from '@/db/types';
import { extractJsonLd } from './jsonld';
import { extractMicrodata } from './microdata';
import { extractHeuristics } from './heuristics';
import { resolveUrl } from './util';

/** Fills blanks in `primary` from `fallback`; `primary`'s own non-empty values always win. */
export function mergeImported(primary: ImportedRecipe, fallback: ImportedRecipe): ImportedRecipe {
  return {
    title: primary.title || fallback.title,
    imageUrl: primary.imageUrl ?? fallback.imageUrl,
    servings: primary.servings ?? fallback.servings,
    prepMinutes: primary.prepMinutes ?? fallback.prepMinutes,
    cookMinutes: primary.cookMinutes ?? fallback.cookMinutes,
    category: primary.category ?? fallback.category,
    tags: primary.tags.length > 0 ? primary.tags : fallback.tags,
    sourceUrl: primary.sourceUrl ?? fallback.sourceUrl,
    sections: primary.sections.length > 0 ? primary.sections : fallback.sections,
    steps: primary.steps.length > 0 ? primary.steps : fallback.steps,
    notes: primary.notes || fallback.notes,
  };
}

/** Parses a recipe out of an HTML page: JSON-LD, then microdata, then site heuristics. */
export function parseRecipeHtml(html: string, url: string): ImportedRecipe | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const jsonld = extractJsonLd(doc, url);
  const primary = jsonld ?? extractMicrodata(doc, url) ?? extractHeuristics(doc, url);
  if (!primary) return null;

  let result = primary;

  if (!result.imageUrl) {
    const og = doc.querySelector('meta[property="og:image"]');
    const content = og?.getAttribute('content');
    if (content) result = { ...result, imageUrl: resolveUrl(content, url) };
  }

  // JSON-LD sometimes omits ingredients or instructions; the heuristics extractor reads the
  // same markup a person would, so use it to fill whatever is still missing.
  if (jsonld && (result.sections.length === 0 || result.steps.length === 0)) {
    const fallback = extractHeuristics(doc, url);
    if (fallback) result = mergeImported(result, fallback);
  }

  return result;
}
