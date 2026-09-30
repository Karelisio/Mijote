import type { IngredientData } from '@/db/types';
import { resolveUnit } from '@/config/units';

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
};
const UNICODE_FRACTION_CHARS = '½¼¾⅓⅔⅛';

// Fractions are written with "/" or the fraction slash U+2044 ("1⁄2").
// Mixed number "1 1/2", or hyphenated "1-1/2" (a range like "1-2" has no fraction after the dash).
const MIXED_RE = /^(\d+)(?:\s+|-)(\d+)[/\u2044](\d+)/;
// Whole number and unicode fraction, glued or spaced: "1½", "1 ½" (as written by formatQuantity).
const MIXED_UNICODE_RE = new RegExp(`^(\\d+)\\s*([${UNICODE_FRACTION_CHARS}])`);
const FRACTION_RE = /^(\d+)[/\u2044](\d+)/;
const UNICODE_ALONE_RE = new RegExp(`^([${UNICODE_FRACTION_CHARS}])`);
const PLAIN_NUMBER_RE = /^(\d+(?:[.,]\d+)?)/;
const RANGE_SEP_RE = /^\s*(?:à|a|to|-|–)\s*/i;
const ARTICLE_RE = /^\s*(?:des|du|de)\s+/i;
const ELISION_ARTICLE_RE = /^\s*d['’]\s*/i;
const BULLET_RE = /^[-•*]\s+/;
const TRAILING_PUNCT_RE = /[,;:)\]]+$/;

interface LeadingNumber {
  value: number;
  consumed: number;
}

/**
 * Parses a leading quantity token: mixed number ("1 1/2", "1-1/2", "1½", "1 ½"), unicode fraction
 * alone, simple fraction or decimal.
 */
function parseLeadingNumber(str: string): LeadingNumber | null {
  let m = MIXED_RE.exec(str);
  if (m?.[1] && m[2] && m[3]) {
    const denom = parseInt(m[3], 10);
    if (denom !== 0) {
      return { value: parseInt(m[1], 10) + parseInt(m[2], 10) / denom, consumed: m[0].length };
    }
  }

  m = MIXED_UNICODE_RE.exec(str);
  if (m?.[1] && m[2]) {
    return { value: parseInt(m[1], 10) + (UNICODE_FRACTIONS[m[2]] ?? 0), consumed: m[0].length };
  }

  m = FRACTION_RE.exec(str);
  if (m?.[1] && m[2]) {
    const denom = parseInt(m[2], 10);
    if (denom !== 0) return { value: parseInt(m[1], 10) / denom, consumed: m[0].length };
  }

  m = UNICODE_ALONE_RE.exec(str);
  if (m?.[1]) {
    return { value: UNICODE_FRACTIONS[m[1]] ?? 0, consumed: m[0].length };
  }

  m = PLAIN_NUMBER_RE.exec(str);
  if (m?.[1]) {
    return { value: parseFloat(m[1].replace(',', '.')), consumed: m[0].length };
  }

  return null;
}

interface UnitMatch {
  key: string;
  consumed: number;
}

/**
 * Matches a unit at the start of `rest` (which may be glued to the previous number, e.g. "g de
 * farine" from "200g de farine"). Tries phrases of up to 4 whitespace-separated words, longest
 * first, resolved against the canonical unit aliases — exact whole-word matching keeps a short
 * alias like "g" from matching inside an unrelated word like "gousse".
 */
function matchUnit(rest: string): UnitMatch | null {
  const tokens: { word: string; end: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while (tokens.length < 4 && (m = re.exec(rest))) {
    tokens.push({ word: m[0], end: m.index + m[0].length });
  }

  for (let n = tokens.length; n >= 1; n--) {
    const slice = tokens.slice(0, n);
    const lastToken = slice[n - 1];
    if (!lastToken) continue;
    const lastStripped = lastToken.word.replace(TRAILING_PUNCT_RE, '');
    const phrase = slice.map((t, i) => (i === n - 1 ? lastStripped : t.word)).join(' ');
    const key = resolveUnit(phrase);
    if (key) {
      const consumed = lastToken.end - (lastToken.word.length - lastStripped.length);
      return { key, consumed };
    }
  }
  return null;
}

/**
 * Parses one raw ingredient line (FR or EN) into a structured ingredient.
 * Lines with no leading quantity are kept as-is (name = whole line, no note split).
 */
export function parseIngredientLine(line: string): IngredientData {
  const text = line.replace(BULLET_RE, '').trim();
  if (!text) return { quantity: null, quantityMax: null, unit: '', name: '', note: '' };

  const first = parseLeadingNumber(text);
  if (!first) {
    return { quantity: null, quantityMax: null, unit: '', name: text, note: '' };
  }

  const quantity = first.value;
  let quantityMax: number | null = null;
  let cursor = first.consumed;

  const afterFirst = text.slice(cursor);
  const rangeMatch = RANGE_SEP_RE.exec(afterFirst);
  if (rangeMatch) {
    const afterSep = afterFirst.slice(rangeMatch[0].length);
    const second = parseLeadingNumber(afterSep);
    if (second) {
      quantityMax = second.value;
      cursor += rangeMatch[0].length + second.consumed;
    }
  }

  const rest = text.slice(cursor);
  const unitMatch = matchUnit(rest);
  const unit = unitMatch?.key ?? '';
  let working = unitMatch ? rest.slice(unitMatch.consumed) : rest;

  working = working.replace(ARTICLE_RE, '').replace(ELISION_ARTICLE_RE, '');
  working = working.trim();

  let name = working;
  let note = '';
  const parenMatch = /\(([^)]*)\)/.exec(working);
  if (parenMatch?.[1] !== undefined) {
    note = parenMatch[1].trim();
    name = (working.slice(0, parenMatch.index) + working.slice(parenMatch.index + parenMatch[0].length))
      .replace(/\s+/g, ' ')
      .trim();
  } else {
    const commaIdx = working.indexOf(',');
    if (commaIdx !== -1) {
      note = working.slice(commaIdx + 1).trim();
      name = working.slice(0, commaIdx).trim();
    }
  }

  return { quantity, quantityMax, unit, name, note };
}
