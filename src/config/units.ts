/**
 * Canonical units. `unit` fields store the key when recognised, else free text.
 * `base` converts to the kind's base unit (g for mass, ml for volume).
 */
export type UnitKind = 'mass' | 'volume' | 'count';

export interface UnitDef {
  key: string;
  kind: UnitKind;
  base: number;
  fr: [singular: string, plural: string];
  en: [singular: string, plural: string];
  /** Lower-case, accent-free spellings recognised by parsers (longest first is not required). */
  aliases: string[];
  /** Rounding step family used when scaling portions. */
  rounding: 'metric' | 'spoon' | 'whole';
}

export const UNITS: UnitDef[] = [
  {
    key: 'mg',
    kind: 'mass',
    base: 0.001,
    fr: ['mg', 'mg'],
    en: ['mg', 'mg'],
    aliases: ['mg', 'milligramme', 'milligrammes', 'milligram', 'milligrams'],
    rounding: 'metric',
  },
  {
    key: 'g',
    kind: 'mass',
    base: 1,
    fr: ['g', 'g'],
    en: ['g', 'g'],
    aliases: ['g', 'gr', 'gr.', 'grs', 'gramme', 'grammes', 'gram', 'grams'],
    rounding: 'metric',
  },
  {
    key: 'kg',
    kind: 'mass',
    base: 1000,
    fr: ['kg', 'kg'],
    en: ['kg', 'kg'],
    aliases: ['kg', 'kilo', 'kilos', 'kilogramme', 'kilogrammes', 'kilogram', 'kilograms'],
    rounding: 'metric',
  },
  {
    key: 'oz',
    kind: 'mass',
    base: 28.35,
    fr: ['oz', 'oz'],
    en: ['oz', 'oz'],
    aliases: ['oz', 'ounce', 'ounces', 'once', 'onces'],
    rounding: 'spoon',
  },
  {
    key: 'lb',
    kind: 'mass',
    base: 453.6,
    fr: ['lb', 'lb'],
    en: ['lb', 'lb'],
    aliases: ['lb', 'lbs', 'pound', 'pounds', 'livre', 'livres'],
    rounding: 'spoon',
  },
  {
    key: 'ml',
    kind: 'volume',
    base: 1,
    fr: ['ml', 'ml'],
    en: ['ml', 'ml'],
    aliases: ['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'],
    rounding: 'metric',
  },
  {
    key: 'cl',
    kind: 'volume',
    base: 10,
    fr: ['cl', 'cl'],
    en: ['cl', 'cl'],
    aliases: ['cl', 'centilitre', 'centilitres', 'centiliter', 'centiliters'],
    rounding: 'metric',
  },
  {
    key: 'dl',
    kind: 'volume',
    base: 100,
    fr: ['dl', 'dl'],
    en: ['dl', 'dl'],
    aliases: ['dl', 'decilitre', 'decilitres', 'deciliter', 'deciliters'],
    rounding: 'metric',
  },
  {
    key: 'l',
    kind: 'volume',
    base: 1000,
    fr: ['l', 'l'],
    en: ['l', 'l'],
    aliases: ['l', 'litre', 'litres', 'liter', 'liters'],
    rounding: 'metric',
  },
  {
    key: 'tsp',
    kind: 'volume',
    base: 5,
    fr: ['c. à café', 'c. à café'],
    en: ['tsp', 'tsp'],
    aliases: [
      'c. a cafe',
      'c.a cafe',
      'c a cafe',
      'cuillere a cafe',
      'cuilleres a cafe',
      'cuillère à café',
      'cac',
      'c.a.c',
      'c.a.c.',
      'c. a c.',
      'cc',
      'c.c.',
      'tsp',
      'teaspoon',
      'teaspoons',
      'c. a the',
      'cuillere a the',
      'cuilleres a the',
    ],
    rounding: 'spoon',
  },
  {
    key: 'tbsp',
    kind: 'volume',
    base: 15,
    fr: ['c. à soupe', 'c. à soupe'],
    en: ['tbsp', 'tbsp'],
    aliases: [
      'c. a soupe',
      'c.a soupe',
      'c a soupe',
      'cuillere a soupe',
      'cuilleres a soupe',
      'cas',
      'c.a.s',
      'c.a.s.',
      'c. a s.',
      'cs',
      'c.s.',
      'tbsp',
      'tbs',
      'tablespoon',
      'tablespoons',
    ],
    rounding: 'spoon',
  },
  {
    key: 'cup',
    kind: 'volume',
    base: 240,
    fr: ['tasse', 'tasses'],
    en: ['cup', 'cups'],
    aliases: ['tasse', 'tasses', 'cup', 'cups', 'bol', 'bols'],
    rounding: 'spoon',
  },
  {
    key: 'glass',
    kind: 'volume',
    base: 200,
    fr: ['verre', 'verres'],
    en: ['glass', 'glasses'],
    aliases: ['verre', 'verres', 'glass', 'glasses'],
    rounding: 'spoon',
  },
  {
    key: 'pinch',
    kind: 'count',
    base: 1,
    fr: ['pincée', 'pincées'],
    en: ['pinch', 'pinches'],
    aliases: ['pincee', 'pincees', 'pinch', 'pinches'],
    rounding: 'whole',
  },
  {
    key: 'clove',
    kind: 'count',
    base: 1,
    fr: ['gousse', 'gousses'],
    en: ['clove', 'cloves'],
    aliases: ['gousse', 'gousses', 'clove', 'cloves'],
    rounding: 'whole',
  },
  {
    key: 'slice',
    kind: 'count',
    base: 1,
    fr: ['tranche', 'tranches'],
    en: ['slice', 'slices'],
    aliases: ['tranche', 'tranches', 'slice', 'slices'],
    rounding: 'whole',
  },
  {
    key: 'bunch',
    kind: 'count',
    base: 1,
    fr: ['botte', 'bottes'],
    en: ['bunch', 'bunches'],
    aliases: ['botte', 'bottes', 'bouquet', 'bouquets', 'bunch', 'bunches'],
    rounding: 'whole',
  },
  {
    key: 'sprig',
    kind: 'count',
    base: 1,
    fr: ['brin', 'brins'],
    en: ['sprig', 'sprigs'],
    aliases: ['brin', 'brins', 'branche', 'branches', 'sprig', 'sprigs'],
    rounding: 'whole',
  },
  {
    key: 'leaf',
    kind: 'count',
    base: 1,
    fr: ['feuille', 'feuilles'],
    en: ['leaf', 'leaves'],
    aliases: ['feuille', 'feuilles', 'leaf', 'leaves'],
    rounding: 'whole',
  },
  {
    key: 'can',
    kind: 'count',
    base: 1,
    fr: ['boîte', 'boîtes'],
    en: ['can', 'cans'],
    aliases: ['boite', 'boites', 'conserve', 'conserves', 'can', 'cans', 'tin', 'tins'],
    rounding: 'whole',
  },
  {
    key: 'packet',
    kind: 'count',
    base: 1,
    fr: ['sachet', 'sachets'],
    en: ['packet', 'packets'],
    aliases: [
      'sachet',
      'sachets',
      'paquet',
      'paquets',
      'packet',
      'packets',
      'package',
      'packages',
      'pack',
      'packs',
    ],
    rounding: 'whole',
  },
  {
    key: 'jar',
    kind: 'count',
    base: 1,
    fr: ['pot', 'pots'],
    en: ['jar', 'jars'],
    aliases: ['pot', 'pots', 'jar', 'jars'],
    rounding: 'whole',
  },
  {
    key: 'knob',
    kind: 'count',
    base: 1,
    fr: ['noix', 'noix'],
    en: ['knob', 'knobs'],
    aliases: ['noix', 'noisette', 'noisettes', 'knob', 'knobs'],
    rounding: 'whole',
  },
  {
    key: 'handful',
    kind: 'count',
    base: 1,
    fr: ['poignée', 'poignées'],
    en: ['handful', 'handfuls'],
    aliases: ['poignee', 'poignees', 'handful', 'handfuls'],
    rounding: 'whole',
  },
  {
    key: 'drop',
    kind: 'count',
    base: 1,
    fr: ['goutte', 'gouttes'],
    en: ['drop', 'drops'],
    aliases: ['goutte', 'gouttes', 'trait', 'traits', 'drop', 'drops', 'dash', 'dashes'],
    rounding: 'whole',
  },
  {
    key: 'sheet',
    kind: 'count',
    base: 1,
    fr: ['rouleau', 'rouleaux'],
    en: ['sheet', 'sheets'],
    aliases: ['rouleau', 'rouleaux', 'pate', 'sheet', 'sheets', 'roll', 'rolls'],
    rounding: 'whole',
  },
  {
    key: 'piece',
    kind: 'count',
    base: 1,
    fr: ['pièce', 'pièces'],
    en: ['piece', 'pieces'],
    aliases: ['piece', 'pieces', 'pc', 'pcs', 'unite', 'unites'],
    rounding: 'whole',
  },
];

// "pate" is too ambiguous as an alias ("pâte feuilletée" is an ingredient name).
for (const u of UNITS) u.aliases = u.aliases.filter((a) => a !== 'pate');

const byKey = new Map(UNITS.map((u) => [u.key, u]));

export function getUnit(key: string): UnitDef | undefined {
  return byKey.get(key);
}

/** Lower-case and strip accents. Shared normaliser for all matching logic. */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae').toLowerCase().trim();
}

const aliasMap = new Map<string, string>();
for (const u of UNITS) for (const a of u.aliases) aliasMap.set(normalizeText(a), u.key);

/** Resolve a free-text unit to a canonical key, or null. */
export function resolveUnit(raw: string): string | null {
  const n = normalizeText(raw).replace(/\s+/g, ' ');
  return aliasMap.get(n) ?? aliasMap.get(n.replace(/\.$/, '')) ?? null;
}

/** All aliases, longest first — used by the ingredient line parser. */
export const UNIT_ALIASES_LONGEST_FIRST: { alias: string; key: string }[] = [...aliasMap.entries()]
  .map(([alias, key]) => ({ alias, key }))
  .sort((a, b) => b.alias.length - a.alias.length);

export function formatUnit(key: string, quantity: number | null, lang: 'fr' | 'en'): string {
  const u = byKey.get(key);
  if (!u) return key;
  const [s, p] = u[lang];
  return quantity !== null && quantity > 1 ? p : s;
}
