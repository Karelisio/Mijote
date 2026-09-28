import { getUnit } from '@/config/units';
import type { IngredientData } from '@/db/types';

const FRACTIONS: [number, string][] = [
  [0.125, '⅛'],
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.5, '½'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
];

/**
 * Rounds a scaled quantity to something a cook would actually measure:
 * - metric mass/volume: 2 significant-ish steps (1 g under 10, 5 g under 100, 10 g under 1000…)
 * - spoons/cups & free units: nearest ¼ (or ⅓ when closer)
 * - countable items (eggs, cloves…): nearest ½ below 3, whole numbers above
 */
export function roundSmart(value: number, unit: string): number {
  if (value <= 0) return 0;
  const def = getUnit(unit);
  const family = def?.rounding ?? (unit ? 'spoon' : 'whole');
  if (family === 'metric') {
    const step = value < 10 ? (value < 1 ? 0.1 : 1) : value < 100 ? 5 : value < 1000 ? 10 : 50;
    return Math.max(step, Math.round(value / step) * step);
  }
  if (family === 'whole' && value >= 3) return Math.round(value);
  if (family === 'whole') {
    // eggs, onions, cloves…: halves are fine under 3, never zero
    return Math.max(0.5, Math.round(value * 2) / 2);
  }
  // spoons, cups, pinches: quarter or third, whichever is closer
  const whole = Math.floor(value);
  const frac = value - whole;
  let best = 0;
  let bestDiff = frac;
  for (const f of [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1]) {
    const d = Math.abs(frac - f);
    if (d < bestDiff - 1e-9) {
      best = f;
      bestDiff = d;
    }
  }
  const r = whole + best;
  return r === 0 ? 0.25 : r;
}

export function scaleQuantity(q: number | null, factor: number, unit: string): number | null {
  if (q === null) return null;
  if (factor === 1) return q;
  return roundSmart(q * factor, unit);
}

/** Converts big metric amounts to the larger unit (1500 g → 1.5 kg). */
export function normalizeMetric(q: number, unit: string): { q: number; unit: string } {
  if (unit === 'g' && q >= 1000) return { q: q / 1000, unit: 'kg' };
  if (unit === 'ml' && q >= 1000) return { q: q / 1000, unit: 'l' };
  if (unit === 'cl' && q >= 100) return { q: q / 100, unit: 'l' };
  return { q, unit };
}

/** 1.5 → "1 ½", 0.333 → "⅓", 250 → "250", 1.25 kg → "1,25" (fr) */
export function formatQuantity(q: number, lang: 'fr' | 'en', unit = ''): string {
  const def = getUnit(unit);
  const useFractions = !def || def.rounding !== 'metric';
  if (useFractions) {
    const whole = Math.floor(q + 1e-9);
    const frac = q - whole;
    if (frac < 0.02) return String(whole);
    const match = FRACTIONS.find(([v]) => Math.abs(v - frac) < 0.02);
    if (match) return whole > 0 ? `${whole} ${match[1]}` : match[1];
  }
  const rounded = Math.round(q * 100) / 100;
  const s = String(rounded);
  return lang === 'fr' ? s.replace('.', ',') : s;
}

export interface ScaledIngredient extends IngredientData {
  display: string;
}

export function scaleIngredient(i: IngredientData, factor: number): IngredientData {
  const quantity = scaleQuantity(i.quantity, factor, i.unit);
  const quantityMax = scaleQuantity(i.quantityMax, factor, i.unit);
  if (quantity !== null && (i.unit === 'g' || i.unit === 'ml' || i.unit === 'cl') && quantityMax === null) {
    const n = normalizeMetric(quantity, i.unit);
    return { ...i, quantity: n.q, unit: n.unit, quantityMax };
  }
  return { ...i, quantity, quantityMax };
}
