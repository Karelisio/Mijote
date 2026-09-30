import type { ImportedRecipe } from '@/db/types';
import { parseDuration } from '../duration';
import { mapCategory } from '../category';
import { cleanText, normalizeTags, resolveUrl } from './util';

/** True when `el`'s nearest ancestor itemscope (below `root`) is `root` itself, not a nested scope. */
function belongsToScope(el: Element, root: Element): boolean {
  let cur = el.parentElement;
  while (cur && cur !== root) {
    if (cur.hasAttribute('itemscope')) return false;
    cur = cur.parentElement;
  }
  return cur === root;
}

function getProp(root: Element, name: string): Element[] {
  return Array.from(root.querySelectorAll(`[itemprop~="${name}"]`)).filter((el) => belongsToScope(el, root));
}

/** Value of a microdata property element, per the usual `content`/`src`/`href`/`datetime` rules. */
function propValue(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.hasAttribute('content')) return el.getAttribute('content') ?? '';
  if (tag === 'img' || tag === 'source') return el.getAttribute('src') ?? '';
  if (tag === 'a' || tag === 'link') return el.getAttribute('href') ?? '';
  if (tag === 'time' && el.hasAttribute('datetime')) return el.getAttribute('datetime') ?? '';
  return cleanText(el.textContent ?? '');
}

function extractServingsFromText(text: string): number | null {
  const m = /(\d+)/.exec(text);
  return m?.[1] ? parseInt(m[1], 10) : null;
}

/** Instructions may hold li/p children directly, or itemListElement/HowToStep sub-items. */
function extractSteps(instructionEls: Element[]): string[] {
  const steps: string[] = [];
  for (const el of instructionEls) {
    const stepNodes = Array.from(
      el.querySelectorAll('[itemprop~="itemListElement"], [itemtype*="HowToStep"]'),
    );
    if (stepNodes.length > 0) {
      for (const node of stepNodes) {
        const textEl = node.querySelector('[itemprop~="text"]') ?? node;
        const t = propValue(textEl);
        if (t) steps.push(t);
      }
      continue;
    }
    const liEls = Array.from(el.querySelectorAll('li'));
    if (liEls.length > 0) {
      for (const li of liEls) {
        const t = cleanText(li.textContent ?? '');
        if (t) steps.push(t);
      }
      continue;
    }
    const pEls = Array.from(el.querySelectorAll('p'));
    if (pEls.length > 0) {
      for (const p of pEls) {
        const t = cleanText(p.textContent ?? '');
        if (t) steps.push(t);
      }
      continue;
    }
    const t = propValue(el);
    if (t) steps.push(t);
  }
  return steps;
}

/** Extracts a Recipe from schema.org microdata (`itemscope`/`itemtype`/`itemprop`). */
export function extractMicrodata(doc: Document, url: string): ImportedRecipe | null {
  const root = doc.querySelector('[itemtype*="schema.org/Recipe"]');
  if (!root) return null;

  const nameEl = getProp(root, 'name')[0];
  const title = nameEl ? propValue(nameEl) : '';
  if (!title) return null;

  const imageEls = getProp(root, 'image');
  const firstImage = imageEls[0];
  const imageRaw = firstImage ? propValue(firstImage) : '';
  const imageUrl = imageRaw ? resolveUrl(imageRaw, url) : null;

  const yieldEl = getProp(root, 'recipeYield')[0];
  const servings = yieldEl ? extractServingsFromText(propValue(yieldEl)) : null;

  const prepEl = getProp(root, 'prepTime')[0];
  const cookEl = getProp(root, 'cookTime')[0];
  const prepMinutes = prepEl ? parseDuration(propValue(prepEl)) : null;
  const cookMinutes = cookEl ? parseDuration(propValue(cookEl)) : null;

  const ingredientEls = [...getProp(root, 'recipeIngredient'), ...getProp(root, 'ingredients')];
  const ingredientLines = ingredientEls.map((el) => propValue(el)).filter(Boolean);
  const sections = ingredientLines.length > 0 ? [{ name: '', lines: ingredientLines }] : [];

  const steps = extractSteps(getProp(root, 'recipeInstructions'));

  const categoryEl = getProp(root, 'recipeCategory')[0];
  const category = categoryEl ? mapCategory(propValue(categoryEl)) : null;

  const keywordEls = getProp(root, 'keywords');
  const tags = normalizeTags(keywordEls.flatMap((el) => propValue(el).split(',')));

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
