import type { ImportedRecipe } from '@/db/types';
import { parseDuration } from '../duration';
import { mapCategory } from '../category';
import {
  allStrings,
  cleanText,
  decodeEntities,
  firstString,
  isRecord,
  normalizeTags,
  resolveUrl,
  stripHtml,
} from './util';

type JsonRecord = Record<string, unknown>;

function typeIncludesRecipe(t: unknown): boolean {
  if (typeof t === 'string') return t.toLowerCase() === 'recipe';
  if (Array.isArray(t)) return t.some((x) => typeof x === 'string' && x.toLowerCase() === 'recipe');
  return false;
}

/** Finds a Recipe node: top-level, inside an array, inside @graph, or inside mainEntity. */
function findRecipeNode(node: unknown): JsonRecord | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(node)) return null;
  if (typeIncludesRecipe(node['@type'])) return node;
  if ('@graph' in node) {
    const found = findRecipeNode(node['@graph']);
    if (found) return found;
  }
  if ('mainEntity' in node) {
    const found = findRecipeNode(node['mainEntity']);
    if (found) return found;
  }
  return null;
}

function extractImageUrl(img: unknown): string | null {
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) {
    let best: { url: string; area: number } | null = null;
    for (const entry of img) {
      const u = extractImageUrl(entry);
      if (!u) continue;
      let area = 0;
      if (isRecord(entry)) {
        const w = typeof entry['width'] === 'number' ? entry['width'] : 0;
        const h = typeof entry['height'] === 'number' ? entry['height'] : 0;
        area = w * h;
      }
      if (!best || area > best.area) best = { url: u, area };
    }
    return best?.url ?? null;
  }
  if (isRecord(img)) {
    if (typeof img['url'] === 'string') return img['url'];
    if (img['url'] !== undefined) {
      const u = extractImageUrl(img['url']);
      if (u) return u;
    }
    if (typeof img['contentUrl'] === 'string') return img['contentUrl'];
  }
  return null;
}

function extractServings(v: unknown): number | null {
  const val = Array.isArray(v) ? v[0] : v;
  if (typeof val === 'number') return Math.round(val);
  if (typeof val === 'string') {
    const m = /(\d+)/.exec(val);
    if (m?.[1]) return parseInt(m[1], 10);
  }
  return null;
}

function extractIngredientLines(doc: Document, v: unknown): string[] {
  return allStrings(v)
    .map((s) => stripHtml(decodeEntities(doc, s)))
    .filter(Boolean);
}

function nodeTypeString(v: unknown): string {
  const t = isRecord(v) ? v['@type'] : undefined;
  if (typeof t === 'string') return t;
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string').join(',');
  return '';
}

/** Splits an instructions string, often HTML on a single line ("<p>…</p><p>…</p>", "…<br>…"). */
function splitInstructionText(doc: Document, raw: string): string[] {
  const lines = decodeEntities(doc, raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:p|li|ol|ul|div|h[1-6])\b[^>]*>/gi, '\n')
    .split(/\r?\n+/)
    .map((s) =>
      stripHtml(s)
        .replace(/^\d+[.)]\s*/, '')
        .trim(),
    )
    .filter(Boolean);
  if (lines.length !== 1) return lines;
  const text = lines[0]!;
  const numbered = text
    .split(/(?=\d+[.)]\s)/)
    .map((s) => s.replace(/^\d+[.)]\s*/, '').trim())
    .filter(Boolean);
  return numbered.length > 1 ? numbered : [text];
}

/** Flattens recipeInstructions: a string, HowToStep[], HowToSection[], or nested itemListElement. */
function extractSteps(doc: Document, v: unknown): string[] {
  if (typeof v === 'string') return splitInstructionText(doc, v);
  if (Array.isArray(v)) return v.flatMap((item) => extractSteps(doc, item));
  if (isRecord(v)) {
    const type = nodeTypeString(v).toLowerCase();
    if (type.includes('howtosection') || 'itemListElement' in v) {
      return extractSteps(doc, v['itemListElement']);
    }
    const text = v['text'] ?? v['name'];
    if (typeof text === 'string') {
      const cleaned = stripHtml(decodeEntities(doc, text));
      return cleaned ? [cleaned] : [];
    }
  }
  return [];
}

function extractDurations(node: JsonRecord): { prepMinutes: number | null; cookMinutes: number | null } {
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  let prepMinutes = parseDuration(first(node['prepTime']));
  let cookMinutes = parseDuration(first(node['cookTime']));
  const totalMinutes = parseDuration(first(node['totalTime']));

  if (totalMinutes !== null) {
    if (prepMinutes === null && cookMinutes !== null) prepMinutes = Math.max(0, totalMinutes - cookMinutes);
    else if (cookMinutes === null && prepMinutes !== null)
      cookMinutes = Math.max(0, totalMinutes - prepMinutes);
    // Only a total: kept as the preparation time, the recipe's total stays right.
    else if (prepMinutes === null && cookMinutes === null) prepMinutes = totalMinutes;
  }
  return { prepMinutes, cookMinutes };
}

function mapNode(node: JsonRecord, doc: Document, url: string): ImportedRecipe | null {
  const nameRaw = firstString(node['name']);
  if (!nameRaw) return null;
  const title = cleanText(decodeEntities(doc, nameRaw));
  if (!title) return null;

  let imageUrl = extractImageUrl(node['image']);
  if (imageUrl) imageUrl = resolveUrl(decodeEntities(doc, imageUrl), url);

  const servings = extractServings(node['recipeYield']);
  const { prepMinutes, cookMinutes } = extractDurations(node);

  const ingredientLines = extractIngredientLines(doc, node['recipeIngredient'] ?? node['ingredients']);
  const sections = ingredientLines.length > 0 ? [{ name: '', lines: ingredientLines }] : [];

  const steps = extractSteps(doc, node['recipeInstructions']).filter(Boolean);

  const tags = normalizeTags([
    ...allStrings(node['keywords']).flatMap((k) => k.split(',')),
    ...allStrings(node['recipeCuisine']),
  ]);

  const category = mapCategory(firstString(node['recipeCategory']) ?? '');

  return {
    title,
    imageUrl,
    servings,
    prepMinutes,
    cookMinutes,
    category,
    tags,
    sourceUrl: url,
    sections,
    steps,
    notes: '',
  };
}

/** Extracts a Recipe from any `script[type="application/ld+json"]` block on the page. */
export function extractJsonLd(doc: Document, url: string): ImportedRecipe | null {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    const raw = script.textContent ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const node = findRecipeNode(parsed);
    if (node) {
      const recipe = mapNode(node, doc, url);
      if (recipe) return recipe;
    }
  }
  return null;
}
