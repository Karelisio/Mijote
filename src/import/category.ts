import type { Category } from '@/db/types';
import { normalizeText } from '@/config/units';

/** FR/EN keyword → canonical category. Checked as substrings of the (normalized) input text. */
const CATEGORY_KEYWORDS: [string[], Category][] = [
  [['entree', 'starter', 'appetizer', 'appetiser'], 'starter'],
  [['plat principal', 'plat', 'main course', 'main dish', 'main'], 'main'],
  [['accompagnement', 'side dish', 'side'], 'side'],
  [['dessert'], 'dessert'],
  [['petit-dejeuner', 'petit dejeuner', 'breakfast', 'brunch'], 'breakfast'],
  [['aperitif', 'snack', 'amuse-gueule', 'amuse gueule', 'gouter'], 'snack'],
  [['boisson', 'cocktail', 'drink', 'beverage'], 'drink'],
  [['sauce', 'condiment'], 'sauce'],
  [['pain', 'viennoiserie', 'bread'], 'bread'],
];

/** Maps a free-text category/course label (FR or EN) to a canonical Category, or null. */
export function mapCategory(text: string): Category | null {
  const n = normalizeText(text);
  if (!n) return null;
  for (const [keywords, category] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => n.includes(k))) return category;
  }
  return null;
}
