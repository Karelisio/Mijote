import type { Recipe } from '@/db/types';
import { snackbar } from '@/store/snackbar';
import { t } from '@/i18n';
import { useTimers } from './timers';

export function startStepTimer(recipe: Pick<Recipe, 'id' | 'title'>, seconds: number, label: string): void {
  void useTimers
    .getState()
    .start({ label, recipeId: recipe.id, recipeTitle: recipe.title, durationSec: seconds });
  snackbar(t('recipe.startTimer', { label }));
}
