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
// "Préparation", "Mode de préparation", "Étapes", "Réalisation"… (not "Temps de préparation": TIME_RE).
const STEPS_HEADING_RE =
  /pr[ée]parations?|instructions?|[ée]tapes?|m[ée]thode|method|directions?|r[ée]alisation/i;
const TIME_RE = /\b(?:temps|time|dur[ée]e)\b/i;
const SUBSECTION_RE = /^(?:pour\s+(?:la|le|les|l['’])|for\s+the)\b|:$/i;

/** Parts of a page that are never the recipe: menus, sidebars, footers, comments, forms, sharing. */
const NOT_CONTENT = [
  'nav',
  'aside',
  'footer',
  'form',
  '[role="navigation"]',
  '[role="complementary"]',
  '[role="contentinfo"]',
  '[id*="comment" i]',
  '[class*="comment" i]',
  '[class*="newsletter" i]',
  '[class*="related" i]',
  '[class*="share" i]',
].join(', ');

/**
 * Heading level: h1–h6, then 7 for "p.title" and a short bold label alone in its paragraph
 * ("<p><strong>Préparation</strong></p>"). Bold words inside a sentence are not headings.
 */
function headingLevel(el: Element): number | null {
  const tag = el.tagName.toLowerCase();
  const h = /^h([1-6])$/.exec(tag);
  if (h) return Number(h[1]);
  if (tag === 'p' && el.classList.contains('title')) return 7;
  const block = tag === 'p' ? el : tag === 'strong' || tag === 'b' ? el.parentElement : null;
  const bold = tag === 'p' ? Array.from(el.children).find((c) => /^(?:strong|b)$/i.test(c.tagName)) : el;
  if (!block || !bold) return null;
  const text = cleanText(bold.textContent ?? '');
  // A short label, not a whole bold sentence ("Ne pas trop cuire.").
  if (!text || text.length > 60 || /[.!?]$/.test(text)) return null;
  return text === cleanText(block.textContent ?? '') ? 7 : null;
}

function isStepsHeading(text: string): boolean {
  return STEPS_HEADING_RE.test(text) && !TIME_RE.test(text) && text.length <= 60;
}

function isIngredientsHeading(text: string): boolean {
  return ING_HEADING_RE.test(text) && !TIME_RE.test(text) && text.length <= 60;
}

function cleanSubName(text: string): string {
  let s = text.trim().replace(/:$/, '').trim();
  s = s
    .replace(/^pour\s+(?:la|le|les)\s+/i, '')
    .replace(/^pour\s+l['’]\s*/i, '')
    .replace(/^for\s+the\s+/i, '');
  s = s.trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function isIngredientsHeadingEl(el: Element): boolean {
  return headingLevel(el) !== null && isIngredientsHeading(cleanText(el.textContent ?? ''));
}

const HEADING_CANDIDATES = 'h1, h2, h3, h4, h5, h6, p, strong, b';

/**
 * The part of the page holding the recipe: the innermost article/main containing an
 * ingredients heading, else the body.
 */
function contentRoot(doc: Document): Element {
  const body = doc.body ?? doc.documentElement;
  const candidates = Array.from(body.querySelectorAll('article, main, [role="main"]')).filter((c) =>
    Array.from(c.querySelectorAll(HEADING_CANDIDATES)).some(isIngredientsHeadingEl),
  );
  return candidates.find((c) => !candidates.some((o) => o !== c && c.contains(o))) ?? body;
}

/**
 * Generic fallback: walks the main content in document order, tracking headings → lists and
 * paragraphs. A section ends at the next heading of the same or a higher level, and what is
 * inside a list already read is not read again.
 */
function extractGeneric(doc: Document, url: string): ImportedRecipe | null {
  const root = contentRoot(doc);
  const all = Array.from(root.querySelectorAll('*'));

  let mode: 'none' | 'ingredients' | 'steps' = 'none';
  let modeLevel = 7;
  let currentSectionName = '';
  const sections: Sections = [];
  const steps: string[] = [];
  const done: Element[] = [];

  // A region holding the recipe itself (e.g. an ASP.NET page-wide <form>) is never skipped.
  const anchor = Array.from(root.querySelectorAll(HEADING_CANDIDATES)).find(isIngredientsHeadingEl);
  const excluded = (el: Element) => {
    const region = el.closest(NOT_CONTENT);
    return !!region && root.contains(region) && !(anchor && region.contains(anchor));
  };

  for (const el of all) {
    if (done.some((d) => d.contains(el)) || excluded(el)) continue;
    const tag = el.tagName.toLowerCase();

    const level = headingLevel(el);
    if (level !== null) {
      done.push(el);
      const text = cleanText(el.textContent ?? '');
      if (isIngredientsHeading(text)) {
        // A nested heading of the same kind ("Étape 1" under "Préparation") keeps the outer level.
        modeLevel = mode === 'ingredients' ? Math.min(modeLevel, level) : level;
        mode = 'ingredients';
        currentSectionName = '';
      } else if (isStepsHeading(text)) {
        modeLevel = mode === 'steps' ? Math.min(modeLevel, level) : level;
        mode = 'steps';
      } else if (mode === 'ingredients' && (level > modeLevel || SUBSECTION_RE.test(text))) {
        if (text && text.length <= 50) currentSectionName = cleanSubName(text);
      } else if (mode !== 'none' && level <= modeLevel) {
        mode = 'none'; // next part of the page (comments, "you may also like"…)
      }
      continue;
    }

    if ((tag === 'ul' || tag === 'ol') && mode !== 'none') {
      const liTexts = textsOf(Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'li'));
      if (liTexts.length === 0) continue;
      done.push(el);
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
