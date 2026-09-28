export type Id = string;

export const CATEGORIES = [
  'starter',
  'main',
  'side',
  'dessert',
  'breakfast',
  'snack',
  'drink',
  'sauce',
  'bread',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** A structured ingredient. `unit` is a canonical key from config/units.ts when recognised, else free text. */
export interface IngredientData {
  quantity: number | null;
  /** Upper bound for ranges like "2 à 3 œufs". */
  quantityMax: number | null;
  unit: string;
  name: string;
  note: string;
}

export interface Ingredient extends IngredientData {
  id: Id;
}

export interface IngredientSection {
  id: Id;
  /** Empty string = default (unnamed) section. */
  name: string;
  items: Ingredient[];
}

export interface Step {
  id: Id;
  text: string;
}

export interface Recipe {
  id: Id;
  title: string;
  /** Relative path of the photo inside the app data directory (images/xxx.jpg). */
  photo: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  difficulty: Difficulty | null;
  category: Category;
  tags: string[];
  sourceUrl: string | null;
  notes: string;
  /** 0 = not rated, 1..5 */
  rating: number;
  favorite: boolean;
  cookedCount: number;
  lastCookedAt: number | null;
  createdAt: number;
  updatedAt: number;
  sections: IngredientSection[];
  steps: Step[];
}

export type RecipeSummary = Omit<Recipe, 'sections' | 'steps' | 'notes'> & {
  /** Lower-cased, accent-free ingredient names (for "what can I cook"). */
  ingredientNames: string[];
};

/** Output of every import path (URL, text, share) before user review. */
export interface ImportedRecipe {
  title: string;
  imageUrl: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  category: Category | null;
  tags: string[];
  sourceUrl: string | null;
  /** Raw ingredient lines grouped by section ('' = default section). */
  sections: { name: string; lines: string[] }[];
  steps: string[];
  notes: string;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export interface MealPlanEntry {
  id: Id;
  /** ISO date YYYY-MM-DD */
  date: string;
  slot: MealSlot;
  recipeId: Id | null;
  /** Free text when not linked to a recipe ("Restes", "Resto"...). */
  text: string;
  servings: number | null;
}

export interface ShoppingItem {
  id: Id;
  name: string;
  quantity: number | null;
  unit: string;
  aisle: string;
  note: string;
  checked: boolean;
  /** Titles of recipes this item comes from. */
  recipeTitles: string[];
  position: number;
  createdAt: number;
}

export interface Collection {
  id: Id;
  name: string;
  icon: string;
  recipeCount: number;
  createdAt: number;
}
