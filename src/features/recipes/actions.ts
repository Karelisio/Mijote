import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { Id, MealPlanEntry, Recipe } from '@/db/types';
import { deleteRecipe, getRecipe, markCooked, patchRecipe, saveRecipe } from '@/db/repos/recipes';
import { collectionIdsForRecipe, setRecipeCollections } from '@/db/repos/collections';
import { restoreMeal } from '@/db/repos/planner';
import { db, refreshRecipes, useRecipes } from '@/store/recipes';
import { snackbar } from '@/store/snackbar';
import { t } from '@/i18n';
import { newId } from '@/lib/id';
import { useShopping } from '@/features/shopping/store';
import type { ShoppingDraft } from '@/features/shopping/merge';
import { scaleIngredient } from './portions';

const tap = () => void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);

export async function toggleFavorite(id: Id, favorite: boolean): Promise<void> {
  tap();
  useRecipes.getState().patchSummary(id, { favorite });
  await patchRecipe(await db(), id, { favorite });
}

export async function setRating(id: Id, rating: number): Promise<void> {
  tap();
  useRecipes.getState().patchSummary(id, { rating });
  await patchRecipe(await db(), id, { rating });
}

export async function markRecipeCooked(id: Id): Promise<void> {
  await markCooked(await db(), id);
  await refreshRecipes();
}

/** Deletes immediately and offers an "Undo" snackbar that restores everything. */
export async function deleteRecipeWithUndo(id: Id): Promise<void> {
  const d = await db();
  const recipe = await getRecipe(d, id);
  if (!recipe) return;
  const collections = await collectionIdsForRecipe(d, id);
  const meals = await d.query<{
    id: string;
    date: string;
    slot: string;
    recipe_id: string;
    text: string;
    servings: number | null;
  }>('SELECT id, date, slot, recipe_id, text, servings FROM meal_plan WHERE recipe_id = ?', [id]);
  await deleteRecipe(d, id);
  await refreshRecipes();
  void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
  snackbar(t('recipes.deleted'), {
    actionLabel: t('common.undo'),
    onAction: () => {
      void (async () => {
        await saveRecipe(d, recipe);
        await setRecipeCollections(d, id, collections);
        for (const m of meals) {
          const entry: MealPlanEntry = {
            id: m.id,
            date: m.date,
            slot: m.slot as MealPlanEntry['slot'],
            recipeId: m.recipe_id,
            text: m.text,
            servings: m.servings,
          };
          await restoreMeal(d, entry);
        }
        await refreshRecipes();
      })();
    },
  });
}

export async function duplicateRecipe(recipe: Recipe): Promise<Id> {
  const now = Date.now();
  const copy: Recipe = {
    ...recipe,
    id: newId(),
    title: `${recipe.title} ${t('recipe.copySuffix')}`,
    cookedCount: 0,
    lastCookedAt: null,
    createdAt: now,
    updatedAt: now,
    sections: recipe.sections.map((s) => ({
      ...s,
      id: newId(),
      items: s.items.map((i) => ({ ...i, id: newId() })),
    })),
    steps: recipe.steps.map((s) => ({ ...s, id: newId() })),
  };
  await saveRecipe(await db(), copy);
  await refreshRecipes();
  return copy.id;
}

/** Shopping drafts for a recipe at the given number of servings. */
export function recipeToDrafts(recipe: Recipe, servings = recipe.servings): ShoppingDraft[] {
  const factor = recipe.servings > 0 ? servings / recipe.servings : 1;
  return recipe.sections.flatMap((s) =>
    s.items.map((i) => {
      const scaled = scaleIngredient(i, factor);
      return {
        name: i.name,
        quantity: scaled.quantityMax ?? scaled.quantity,
        unit: scaled.unit,
        note: '',
        recipeTitle: recipe.title,
      };
    }),
  );
}

export async function addRecipeToShopping(recipe: Recipe, servings: number): Promise<void> {
  const n = await useShopping.getState().addDrafts(recipeToDrafts(recipe, servings));
  tap();
  snackbar(t('recipe.addedToShopping', { count: n }));
}
