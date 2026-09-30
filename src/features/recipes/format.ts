import { formatUnit, getUnit } from '@/config/units';
import type { IngredientData, Recipe } from '@/db/types';
import type { Lang } from '@/i18n';
import { translate } from '@/i18n';
import { formatQuantity, scaleIngredient } from './portions';

/** "1,4 Mo" / "1.4 MB". */
export function formatMegabytes(bytes: number, lang: Lang): string {
  const size = (bytes / 1024 / 1024).toFixed(1);
  return translate(lang, 'common.megabytes', { size: lang === 'fr' ? size.replace('.', ',') : size });
}

/** "250 g", "2–3", "1 ½ c. à soupe", "" */
export function formatAmount(
  i: Pick<IngredientData, 'quantity' | 'quantityMax' | 'unit'>,
  lang: Lang,
): string {
  if (i.quantity === null) return i.unit && !getUnit(i.unit) ? i.unit : '';
  let q = formatQuantity(i.quantity, lang, i.unit);
  if (i.quantityMax !== null && i.quantityMax !== i.quantity)
    q += `–${formatQuantity(i.quantityMax, lang, i.unit)}`;
  if (!i.unit) return q;
  const unit = getUnit(i.unit) ? formatUnit(i.unit, i.quantityMax ?? i.quantity, lang) : i.unit;
  return `${q} ${unit}`;
}

/** One-line human text: "250 g farine (tamisée)". */
export function formatIngredientLine(i: IngredientData, lang: Lang): string {
  const amount = formatAmount(i, lang);
  const note = i.note ? ` (${i.note})` : '';
  return `${amount ? `${amount} ` : ''}${i.name}${note}`;
}

/** Plain-text version of a recipe for sharing. */
export function recipeToText(r: Recipe, lang: Lang, servings = r.servings): string {
  const tr = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) =>
    translate(lang, k, v);
  const factor = r.servings > 0 ? servings / r.servings : 1;
  const lines: string[] = [`🍲 ${r.title}`, ''];
  const meta: string[] = [tr('share.servings', { count: servings })];
  if (r.prepMinutes) meta.push(`${tr('recipe.prep')} ${r.prepMinutes} min`);
  if (r.cookMinutes) meta.push(`${tr('recipe.cook')} ${r.cookMinutes} min`);
  lines.push(meta.join(' · '), '', `🧺 ${tr('share.ingredients')}`);
  for (const s of r.sections) {
    if (s.name) lines.push('', `${s.name} :`);
    for (const i of s.items) lines.push(`• ${formatIngredientLine(scaleIngredient(i, factor), lang)}`);
  }
  lines.push('', `👩‍🍳 ${tr('share.steps')}`);
  r.steps.forEach((s, idx) => lines.push(`${idx + 1}. ${s.text}`));
  if (r.notes.trim()) lines.push('', `📝 ${tr('share.notes')}`, r.notes.trim());
  if (r.sourceUrl) lines.push('', r.sourceUrl);
  lines.push('', `— ${tr('share.footer')}`);
  return lines.join('\n');
}
