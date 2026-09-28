import type { ImportedRecipe } from '@/db/types';
import { parseHumanDuration } from './duration';

const URL_RE = /https?:\/\/\S+/;
const TRAILING_URL_PUNCT_RE = /[).,;:!?]+$/;

const HEADING_INGREDIENTS = /^ingr[ée]dients?\s*:?\s*$/i;
const HEADING_STEPS =
  /^(?:pr[ée]paration|[ée]tapes?|instructions?|recette|method|directions?|steps?)\s*:?\s*$/i;
const HEADING_NOTES = /^(?:notes?|astuces?|conseils?|tips?)\s*:?\s*$/i;

const STEP_PREFIX_RE = /^(?:[-•*]\s+|\d+[.)]\s*|[ée]tape\s*\d+\s*[:.)]?\s*|step\s*\d+\s*[:.)]?\s*)/i;

const UNICODE_FRACTION_CHARS = '½¼¾⅓⅔⅛';
const INGREDIENT_START_RE = new RegExp(`^(?:[-•*]|\\d|[${UNICODE_FRACTION_CHARS}])`);

const SERVINGS_RES = [
  /pour\s+(\d+)\s*personnes?/i,
  /serves\s+(\d+)/i,
  /portions?\s*:\s*(\d+)/i,
  /personnes?\s*:\s*(\d+)/i,
  /(\d+)\s*portions?\b/i,
];

const PREP_LABEL_RE = /^(?:pr[ée]paration|prep(?:\s*time)?)\s*:?\s*(.*)$/i;
const COOK_LABEL_RE = /^(?:cuisson|cook(?:ing)?(?:\s*time)?)\s*:?\s*(.*)$/i;

const MAX_METADATA_LINE_LENGTH = 60;

function matchServings(line: string): number | null {
  for (const re of SERVINGS_RES) {
    const m = re.exec(line);
    if (m?.[1]) return parseInt(m[1], 10);
  }
  return null;
}

function matchDurationLabel(line: string, labelRe: RegExp): number | null {
  const m = labelRe.exec(line);
  if (!m) return null;
  const remainder = (m[1] ?? '').trim();
  if (!remainder) return null; // bare heading ("Préparation" / "Préparation :") — not metadata
  return parseHumanDuration(remainder);
}

function looksLikeIngredientStart(s: string): boolean {
  return INGREDIENT_START_RE.test(s);
}

function isHeading(t: string): boolean {
  return HEADING_INGREDIENTS.test(t) || HEADING_STEPS.test(t) || HEADING_NOTES.test(t);
}

function cleanSectionName(line: string): string {
  let s = line.trim().replace(/:$/, '').trim();
  s = s.replace(/^pour\s+(?:la|le|les)\s+/i, '').replace(/^for\s+the\s+/i, '');
  s = s.trim();
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Detects a sub-section header inside the ingredients block ("Pour la pâte :" or "Pâte" alone). */
function matchSubsectionHeader(line: string, nextLine: string | undefined): string | null {
  if (looksLikeIngredientStart(line)) return null;

  if (/:$/.test(line) && line.length <= 50) {
    return cleanSectionName(line);
  }

  if (line.length <= 30 && nextLine !== undefined && looksLikeIngredientStart(nextLine.trim())) {
    return cleanSectionName(line);
  }

  return null;
}

function addToSection(sections: { name: string; lines: string[] }[], name: string, line: string): void {
  let section = sections.find((s) => s.name === name);
  if (!section) {
    section = { name, lines: [] };
    sections.push(section);
  }
  section.lines.push(line);
}

/** Parses pasted plain text (copied from a website or a message) into an ImportedRecipe. */
export function parseRecipeText(text: string): ImportedRecipe {
  const rawLines = text.split(/\r?\n/);

  // 1. Source URL: first line containing an http(s) URL is extracted and dropped entirely.
  let sourceUrl: string | null = null;
  let lines: string[] = [];
  let urlConsumed = false;
  for (const raw of rawLines) {
    if (!urlConsumed && URL_RE.test(raw)) {
      const m = URL_RE.exec(raw);
      if (m) {
        sourceUrl = m[0].replace(TRAILING_URL_PUNCT_RE, '');
        urlConsumed = true;
        continue;
      }
    }
    lines.push(raw);
  }

  // 2. Metadata lines (servings / prep / cook) — matched and removed so they never end up as steps.
  let servings: number | null = null;
  let prepMinutes: number | null = null;
  let cookMinutes: number | null = null;
  const keptLines: string[] = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (t && t.length <= MAX_METADATA_LINE_LENGTH) {
      const s = matchServings(t);
      if (s !== null) {
        servings = s;
        continue;
      }
      const p = matchDurationLabel(t, PREP_LABEL_RE);
      if (p !== null) {
        prepMinutes = p;
        continue;
      }
      const c = matchDurationLabel(t, COOK_LABEL_RE);
      if (c !== null) {
        cookMinutes = c;
        continue;
      }
    }
    keptLines.push(raw);
  }
  lines = keptLines;

  // 3. Title: first non-empty line before the first heading (if any).
  const firstHeadingIdx = lines.findIndex((l) => isHeading(l.trim()));
  const titleSearchEnd = firstHeadingIdx === -1 ? lines.length : firstHeadingIdx;
  let title = '';
  let titleIdx = -1;
  for (let i = 0; i < titleSearchEnd; i++) {
    const t = (lines[i] ?? '').trim();
    if (t) {
      title = t;
      titleIdx = i;
      break;
    }
  }
  if (titleIdx !== -1) lines.splice(titleIdx, 1);

  const hasHeadings = lines.some((l) => isHeading(l.trim()));

  const sections: { name: string; lines: string[] }[] = [];
  const steps: string[] = [];
  const notesLines: string[] = [];

  if (hasHeadings) {
    let mode: 'none' | 'ingredients' | 'steps' | 'notes' = 'none';
    let currentSectionName = '';

    for (let i = 0; i < lines.length; i++) {
      const t = (lines[i] ?? '').trim();
      if (!t) continue;

      if (HEADING_INGREDIENTS.test(t)) {
        mode = 'ingredients';
        currentSectionName = '';
        continue;
      }
      if (HEADING_STEPS.test(t)) {
        mode = 'steps';
        continue;
      }
      if (HEADING_NOTES.test(t)) {
        mode = 'notes';
        continue;
      }

      if (mode === 'ingredients') {
        const sub = matchSubsectionHeader(t, lines[i + 1]);
        if (sub !== null) {
          currentSectionName = sub;
          continue;
        }
        addToSection(sections, currentSectionName, t.replace(/^[-•*]\s+/, ''));
      } else if (mode === 'steps') {
        steps.push(t.replace(STEP_PREFIX_RE, '').trim());
      } else if (mode === 'notes') {
        notesLines.push(t);
      }
    }
  } else {
    // No headings anywhere: classify by shape.
    const ingredientLines: string[] = [];
    for (const raw of lines) {
      const t = raw.trim();
      if (!t) continue;
      if (looksLikeIngredientStart(t)) {
        ingredientLines.push(t.replace(/^[-•*]\s+/, ''));
      } else {
        steps.push(t.replace(STEP_PREFIX_RE, '').trim());
      }
    }
    if (ingredientLines.length > 0) sections.push({ name: '', lines: ingredientLines });
  }

  return {
    title,
    imageUrl: null,
    servings,
    prepMinutes,
    cookMinutes,
    category: null,
    tags: [],
    sourceUrl,
    sections: sections.filter((s) => s.lines.length > 0),
    steps,
    notes: notesLines.join('\n'),
  };
}
