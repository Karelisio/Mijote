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

/** Dish keywords found in titles → category, used when a source gives no category. */
const TITLE_KEYWORDS: [RegExp, Category][] = [
  [
    /\b(gateau|cake|tarte (aux|au) (pommes|fraises|citron|poires|chocolat)|tiramisu|mousse au chocolat|cookies?|brownies?|muffins?|clafoutis|fondant|creme brulee|panna cotta|flan|crumble|madeleines?|macarons?|cheesecake|sorbet|glace|biscuits?|financiers?|compote)\b/,
    'dessert',
  ],
  [/\b(crepes?|pancakes?|gaufres?|porridge|granola|smoothie bowl)\b/, 'dessert'],
  [/\b(soupe|veloute|salade|gaspacho|terrine|tartare|carpaccio|soup|salad)\b/, 'starter'],
  [/\b(pain|brioche|baguette|focaccia|croissants?|bread|buns?)\b/, 'bread'],
  [/\b(sauce|vinaigrette|mayonnaise|pesto|coulis|dressing)\b/, 'sauce'],
  [/\b(cocktail|limonade|smoothie|jus|sirop|lemonade|juice)\b/, 'drink'],
  [/\b(houmous|hummus|tapenade|guacamole|rillettes|toasts?|verrines?|dip)\b/, 'snack'],
  [/\b(puree|gratin dauphinois|ratatouille|riz pilaf|frites|legumes rotis|mashed|fries)\b/, 'side'],
];

/** Guesses a category from the recipe title (FR/EN), or null. */
export function guessCategoryFromTitle(title: string): Category | null {
  const n = normalizeText(title);
  for (const [re, category] of TITLE_KEYWORDS) if (re.test(n)) return category;
  return null;
}
