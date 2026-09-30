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

const clean = (n: number): number => Math.round(n * 1e6) / 1e6;

/** Rounding step for a metric amount in g or ml: 1,5 g, 12 g, 125 g, 330 g, 1,65 kg. */
function metricStep(base: number): number {
  return base < 1 ? 0.1 : base < 10 ? 0.5 : base < 25 ? 1 : base < 250 ? 5 : base < 1000 ? 10 : 50;
}

/**
 * Rounds a scaled quantity to something a cook would actually measure:
 * - metric mass/volume: rounded in g / ml whatever the unit (0,25 kg stays 250 g, not 0,3 kg)
 * - spoons/cups & free units: nearest ¼ (or ⅓ when closer)
 * - countable items (eggs, cloves…): nearest ½ below 3, whole numbers above
 */
export function roundSmart(value: number, unit: string): number {
  if (value <= 0) return 0;
  const def = getUnit(unit);
  const family = def?.rounding ?? (unit ? 'spoon' : 'whole');
  if (family === 'metric' && def) {
    const base = value * def.base;
    const step = metricStep(base);
    return clean(Math.max(step, Math.round(base / step) * step) / def.base);
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

/**
 * Readable metric unit for an amount of `base` g or ml: kg / l from 1000; once scaled, smaller
 * units below that (0,25 kg → 250 g, 0,125 l → 12,5 cl, 0,5 cl → 5 ml). As typed otherwise.
 */
function metricDisplayUnit(base: number, unit: string, kind: 'mass' | 'volume', scaled: boolean): string {
  if (base >= 1000) return kind === 'mass' ? 'kg' : 'l';
  if (!scaled) return unit;
  if (kind === 'mass') return base >= 1 || unit !== 'mg' ? 'g' : 'mg';
  // French recipes count liquids in cl; ml for the smallest amounts or when written in ml.
  return unit === 'ml' || base < 10 ? 'ml' : 'cl';
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

export function scaleIngredient(i: IngredientData, factor: number): IngredientData {
  const quantity = scaleQuantity(i.quantity, factor, i.unit);
  const quantityMax = scaleQuantity(i.quantityMax, factor, i.unit);
  const def = getUnit(i.unit);
  const scaled = factor !== 1;
  if (quantity === null || !def || def.rounding !== 'metric' || def.kind === 'count') {
    return { ...i, quantity, quantityMax };
  }
  if (!scaled && quantityMax !== null) return { ...i, quantity, quantityMax };
  const unit = metricDisplayUnit((quantityMax ?? quantity) * def.base, i.unit, def.kind, scaled);
  if (unit === i.unit) return { ...i, quantity, quantityMax };
  const ratio = def.base / getUnit(unit)!.base;
  const convert = (q: number | null) => (q === null ? null : clean(q * ratio));
  return { ...i, quantity: convert(quantity), quantityMax: convert(quantityMax), unit };
}
