import type { ImportedRecipe } from '@/db/types';
import { cleanText, resolveUrl } from './util';

type Sections = { name: string; lines: string[] }[];

function addToSection(sections: Sections, name: string, newLines: string[]): void {
  if (newLines.length === 0) return;
  let section = sections.find((s) => s.name === name);
  if (!section) {
    section = { name, lines: [] };
    sections.push(section);
  }
  section.lines.push(...newLines);
}

function textsOf(els: Element[]): string[] {
  return els.map((el) => cleanText(el.textContent ?? '')).filter(Boolean);
}

function extractTitle(doc: Document): string {
  const og = doc.querySelector('meta[property="og:title"]');
  const ogContent = og?.getAttribute('content');
  if (ogContent) return cleanText(ogContent);
  const h1 = doc.querySelector('h1');
  if (h1) {
    const t = cleanText(h1.textContent ?? '');
    if (t) return t;
  }
  const titleTag = doc.querySelector('title');
  return titleTag ? cleanText(titleTag.textContent ?? '') : '';
}

function extractOgImage(doc: Document, url: string): string | null {
  const og = doc.querySelector('meta[property="og:image"]');
  const content = og?.getAttribute('content');
  return content ? resolveUrl(content, url) : null;
}

function emptyRecipe(
  title: string,
  imageUrl: string | null,
  url: string,
  sections: Sections,
  steps: string[],
) {
  return {
    title,
    imageUrl,
    servings: null,
    prepMinutes: null,
    cookMinutes: null,
    category: null,
    tags: [],
    sourceUrl: url,
    sections,
    steps,
    notes: '',
  };
}

function extractMarmiton(doc: Document, url: string): ImportedRecipe | null {
  const title = extractTitle(doc);
  const lines: string[] = [];
  for (const card of Array.from(doc.querySelectorAll('.card-ingredient'))) {
    const qty = card.querySelector('.card-ingredient-quantity');
    const name = card.querySelector('.ingredient-name');
    const complement = card.querySelector('.ingredient-complement');
    const parts = [qty, name, complement]
      .map((e) => (e ? cleanText(e.textContent ?? '') : ''))
      .filter(Boolean);
    if (parts.length > 0) lines.push(parts.join(' '));
  }
  let steps = textsOf(Array.from(doc.querySelectorAll('.recipe-step-list__container')));
  if (steps.length === 0) steps = textsOf(Array.from(doc.querySelectorAll('.recipe-step-list p')));

  if (lines.length === 0 && steps.length === 0) return null;
  const sections: Sections = lines.length > 0 ? [{ name: '', lines }] : [];
  return emptyRecipe(title, extractOgImage(doc, url), url, sections, steps);
}

function extract750g(doc: Document, url: string): ImportedRecipe | null {
  const title = extractTitle(doc);
  const lines = textsOf(Array.from(doc.querySelectorAll('.recipe-ingredients-item')));
  const steps = textsOf(Array.from(doc.querySelectorAll('.recipe-steps-item')));

  if (lines.length === 0 && steps.length === 0) return null;
  const sections: Sections = lines.length > 0 ? [{ name: '', lines }] : [];
  return emptyRecipe(title, extractOgImage(doc, url), url, sections, steps);
}

function extractCuisineAz(doc: Document, url: string): ImportedRecipe | null {
  const title = extractTitle(doc);
  let lines = textsOf(Array.from(doc.querySelectorAll('#ingredients li')));
  if (lines.length === 0) lines = textsOf(Array.from(doc.querySelectorAll('.borderingredient')));
  let steps = textsOf(Array.from(doc.querySelectorAll('#preparation p')));
  if (steps.length === 0) steps = textsOf(Array.from(doc.querySelectorAll('.preparation p')));

  if (lines.length === 0 && steps.length === 0) return null;
  const sections: Sections = lines.length > 0 ? [{ name: '', lines }] : [];
  return emptyRecipe(title, extractOgImage(doc, url), url, sections, steps);
}

const ING_HEADING_RE = /ingr[ée]dients?/i;
const STEPS_HEADING_RE = /pr[ée]parations?|instructions?|[ée]tapes?|method|directions?/i;

function isHeadingEl(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'strong') return true;
  return tag === 'p' && el.classList.contains('title');
}

function cleanSubName(text: string): string {
  let s = text.trim().replace(/:$/, '').trim();
  s = s.replace(/^pour\s+(?:la|le|les)\s+/i, '').replace(/^for\s+the\s+/i, '');
  s = s.trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Generic fallback: walks the body in document order, tracking headings → lists/paragraphs. */
function extractGeneric(doc: Document, url: string): ImportedRecipe | null {
  const body = doc.body ?? doc.documentElement;
  const all = Array.from(body.querySelectorAll('*'));

  let mode: 'none' | 'ingredients' | 'steps' = 'none';
  let currentSectionName = '';
  const sections: Sections = [];
  const steps: string[] = [];
  const consumedLists = new Set<Element>();

  for (const el of all) {
    const tag = el.tagName.toLowerCase();

    if (isHeadingEl(el)) {
      const text = cleanText(el.textContent ?? '');
      if (ING_HEADING_RE.test(text)) {
        mode = 'ingredients';
        currentSectionName = '';
        continue;
      }
      if (STEPS_HEADING_RE.test(text)) {
        mode = 'steps';
        continue;
      }
      if (mode === 'ingredients' && text && text.length <= 50) {
        currentSectionName = cleanSubName(text);
      }
      continue;
    }

    if ((tag === 'ul' || tag === 'ol') && !consumedLists.has(el) && mode !== 'none') {
      const liTexts = textsOf(Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'li'));
      if (liTexts.length === 0) continue;
      consumedLists.add(el);
      if (mode === 'ingredients') addToSection(sections, currentSectionName, liTexts);
      else steps.push(...liTexts);
      continue;
    }

    if (tag === 'p' && mode === 'steps') {
      const t = cleanText(el.textContent ?? '');
      if (t) steps.push(t);
    }
  }

  if (sections.length === 0 && steps.length === 0) return null;
  return emptyRecipe(extractTitle(doc), extractOgImage(doc, url), url, sections, steps);
}

/** Site-specific selectors for known FR recipe sites, falling back to a generic heading/list walk. */
export function extractHeuristics(doc: Document, url: string): ImportedRecipe | null {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    host = '';
  }

  if (host.includes('marmiton.org')) {
    const r = extractMarmiton(doc, url);
    if (r) return r;
  } else if (host.includes('750g.com')) {
    const r = extract750g(doc, url);
    if (r) return r;
  } else if (host.includes('cuisineaz.com')) {
    const r = extractCuisineAz(doc, url);
    if (r) return r;
  }

  return extractGeneric(doc, url);
}
