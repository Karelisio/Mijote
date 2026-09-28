import { AISLES, type Aisle } from '@/config/aisles';
import { MAGO_CATEGORY_BY_AISLE, MAGO_DEFAULT_CATEGORY, MAGO_IMPORT_URL } from '@/config/magoCategories';
import { formatUnit, getUnit } from '@/config/units';
import { mergeDrafts, type ShoppingDraft } from '@/features/shopping/merge';

export interface MagoItem {
  name: string;
  quantity: number | null;
  unit: string;
  category: string;
  note: string;
  recipeTitle: string;
}

export interface MagoPayload {
  version: 1;
  source: 'Mijote';
  listName?: string;
  items: MagoItem[];
}

export function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

const isAisle = (a: string | undefined): a is Aisle => !!a && (AISLES as readonly string[]).includes(a);

/** Merges duplicates and maps Mijote data to Mago's import format. */
export function buildMagoPayload(
  drafts: ShoppingDraft[],
  opts: { listName?: string; lang: 'fr' | 'en' },
): MagoPayload {
  const merged = mergeDrafts(drafts);
  const items: MagoItem[] = merged.map((i) => ({
    name: i.name,
    quantity: i.quantity,
    unit: getUnit(i.unit) ? formatUnit(i.unit, i.quantity, opts.lang) : i.unit,
    category: isAisle(i.aisle) ? MAGO_CATEGORY_BY_AISLE[i.aisle] : MAGO_DEFAULT_CATEGORY,
    note: i.note,
    recipeTitle: i.recipeTitles.join(', '),
  }));
  const payload: MagoPayload = { version: 1, source: 'Mijote', items };
  const listName = opts.listName?.trim();
  if (listName) payload.listName = listName;
  return payload;
}

export function buildMagoUrl(payload: MagoPayload): string {
  return `${MAGO_IMPORT_URL}?data=${encodeBase64Url(JSON.stringify(payload))}`;
}

export function parseMagoUrl(url: string): MagoPayload | null {
  try {
    const data = new URL(url).searchParams.get('data');
    if (!data) return null;
    const v = JSON.parse(decodeBase64Url(data)) as MagoPayload;
    return v.version === 1 && Array.isArray(v.items) ? v : null;
  } catch {
    return null;
  }
}
