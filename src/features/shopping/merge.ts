import { guessAisle } from '@/config/aisles';
import { getUnit, normalizeText } from '@/config/units';
import type { ShoppingItem } from '@/db/types';
import { newId } from '@/lib/id';

export interface ShoppingDraft {
  name: string;
  quantity: number | null;
  unit: string;
  aisle?: string;
  note?: string;
  recipeTitle?: string;
}

const LEADING = /^(?:(?:de|d'|d’|du|des|la|le|les|l'|l’|un|une|of|the|a|some)\s*)+/;

/** Canonical key for duplicate detection: accent-free, singular, no article. */
export function itemKey(name: string): string {
  return normalizeText(name)
    .replace(/\(.*?\)/g, '')
    .replace(LEADING, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singular)
    .join(' ');
}

function singular(w: string): string {
  if (w.length <= 3) return w;
  if (/[cs]hes$/.test(w)) return w.slice(0, -2);
  if (/(?:s|x)$/.test(w)) return w.slice(0, -1);
  return w;
}

type Family = 'mass' | 'metric-volume' | 'spoon' | 'count';

function familyOf(unit: string): { family: Family; base: number } | null {
  const u = getUnit(unit);
  if (!u) return null;
  if (u.kind === 'mass') return { family: 'mass', base: u.base };
  if (u.kind === 'volume')
    return { family: u.rounding === 'metric' ? 'metric-volume' : 'spoon', base: u.base };
  return null;
}

/** Can two quantities of these units be added together? */
export function compatible(a: string, b: string): boolean {
  if (a === b) return true;
  const fa = familyOf(a);
  const fb = familyOf(b);
  if (!fa || !fb) return false;
  if (fa.family === fb.family) return true;
  // Spoons can fold into a metric volume (1 c. à soupe d'huile + 20 cl d'huile).
  const fams = new Set([fa.family, fb.family]);
  return fams.has('metric-volume') && fams.has('spoon');
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Adds `b` to `a`, converting units; picks a readable unit for the total. */
/** Expresses large metric amounts in the bigger unit (1500 g → 1.5 kg, 100 cl → 1 l). */
function tidy(q: { quantity: number | null; unit: string }): { quantity: number | null; unit: string } {
  if (q.quantity === null) return q;
  const u = getUnit(q.unit);
  if (!u || u.rounding !== 'metric') return q;
  const base = q.quantity * u.base;
  if (u.kind === 'mass' && q.unit !== 'kg' && base >= 1000)
    return { quantity: round(base / 1000), unit: 'kg' };
  if (u.kind === 'volume' && q.unit !== 'l' && base >= 1000)
    return { quantity: round(base / 1000), unit: 'l' };
  return q;
}

export function addQuantities(
  a: { quantity: number | null; unit: string },
  b: { quantity: number | null; unit: string },
): { quantity: number | null; unit: string } {
  if (a.quantity === null)
    return { quantity: b.quantity, unit: b.quantity === null ? a.unit || b.unit : b.unit };
  if (b.quantity === null) return a;
  if (a.unit === b.unit) return tidy({ quantity: round(a.quantity + b.quantity), unit: a.unit });
  const fa = familyOf(a.unit)!;
  const fb = familyOf(b.unit)!;
  const total = a.quantity * fa.base + b.quantity * fb.base;
  if (fa.family === 'mass' && fb.family === 'mass') {
    return total >= 1000
      ? { quantity: round(total / 1000), unit: 'kg' }
      : { quantity: round(total), unit: 'g' };
  }
  if (fa.family === 'spoon' && fb.family === 'spoon') {
    const target = fa.base >= fb.base ? a.unit : b.unit;
    return { quantity: round(total / getUnit(target)!.base), unit: target };
  }
  // metric volume (possibly with spoons)
  if (total >= 1000) return { quantity: round(total / 1000), unit: 'l' };
  if ([a.unit, b.unit].includes('cl') && total >= 10) return { quantity: round(total / 10), unit: 'cl' };
  return { quantity: round(total), unit: 'ml' };
}

/**
 * Merges drafts into an existing list: same item (by key) with compatible
 * units is summed; checked items are not reused so re-shopping stays visible.
 */
export function mergeShopping(
  existing: ShoppingItem[],
  drafts: ShoppingDraft[],
  now = Date.now(),
): ShoppingItem[] {
  const out = existing.map((i) => ({ ...i, recipeTitles: [...i.recipeTitles] }));
  let position = out.reduce((m, i) => Math.max(m, i.position), 0);
  for (const d of drafts) {
    const name = d.name.trim();
    if (!name) continue;
    const key = itemKey(name);
    const match = out.find((i) => !i.checked && itemKey(i.name) === key && compatible(i.unit, d.unit));
    if (match) {
      const sum = addQuantities(match, d);
      match.quantity = sum.quantity;
      match.unit = sum.unit;
      if (d.recipeTitle && !match.recipeTitles.includes(d.recipeTitle))
        match.recipeTitles.push(d.recipeTitle);
      if (d.note && !match.note.includes(d.note))
        match.note = match.note ? `${match.note}, ${d.note}` : d.note;
      continue;
    }
    out.push({
      id: newId(),
      name,
      quantity: d.quantity,
      unit: d.unit,
      aisle: d.aisle ?? guessAisle(name),
      note: d.note ?? '',
      checked: false,
      recipeTitles: d.recipeTitle ? [d.recipeTitle] : [],
      position: ++position,
      createdAt: now,
    });
  }
  return out;
}

/** Deduplicates a standalone list of drafts (e.g. before sending to Mago). */
export function mergeDrafts(drafts: ShoppingDraft[]): ShoppingItem[] {
  return mergeShopping([], drafts, 0);
}
