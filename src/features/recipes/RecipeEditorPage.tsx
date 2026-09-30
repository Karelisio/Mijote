import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '@/ui/Screen';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/Dialog';
import { Spinner } from '@/ui/Controls';
import { useLang, useT } from '@/i18n';
import type { Recipe } from '@/db/types';
import { getRecipe, saveRecipe } from '@/db/repos/recipes';
import { db, refreshRecipes } from '@/store/recipes';
import { snackbar } from '@/store/snackbar';
import { useBackHandler } from '@/platform/backStack';
import { setExternalNavBlocker } from '@/app/navGuard';
import { EmptyState } from '@/ui/EmptyState';
import { RecipeForm } from './RecipeForm';
import { emptyState, recipeFromState, stateFromRecipe, type EditState } from './editorModel';

/** Editor shell shared by "new", "edit" and import review. */
export function RecipeEditor({
  title,
  initial,
  base,
  onSaved,
}: {
  title: string;
  initial: EditState;
  base: Recipe | null;
  onSaved: (id: string) => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const [state, setState] = useState(initial);
  const [titleError, setTitleError] = useState(false);
  // Where to go once the user agrees to drop the changes (back, or a share / deep link).
  const [confirmLeave, setConfirmLeave] = useState<{ proceed: () => void } | null>(null);
  const [saving, setSaving] = useState(false);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const dirty = JSON.stringify(state) !== baseline;

  const goBack = { proceed: () => navigate(-1) };
  const leave = () => (dirty ? setConfirmLeave(goBack) : navigate(-1));
  useBackHandler(dirty && !confirmLeave, () => setConfirmLeave(goBack));
  useEffect(() => {
    if (!dirty) return;
    return setExternalNavBlocker((proceed) => setConfirmLeave({ proceed }));
  }, [dirty]);

  const save = async () => {
    if (!state.title.trim()) {
      setTitleError(true);
      return;
    }
    setSaving(true);
    try {
      const recipe = recipeFromState(state, base);
      await saveRecipe(await db(), recipe);
      await refreshRecipes();
      setBaseline(JSON.stringify(state));
      snackbar(t('editor.saved'));
      onSaved(recipe.id);
    } catch (e) {
      console.error(e);
      snackbar(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title={title}
      back={leave}
      actions={
        <Button variant="text" onClick={() => void save()} disabled={saving}>
          {t('common.save')}
        </Button>
      }
    >
      <RecipeForm state={state} onChange={setState} titleError={titleError} />
      <div className="pad" style={{ paddingTop: 24 }}>
        <Button large block icon="check" onClick={() => void save()} disabled={saving}>
          {t('common.save')}
        </Button>
      </div>
      <ConfirmDialog
        open={!!confirmLeave}
        title={t('editor.discardTitle')}
        body={t('editor.discardBody')}
        confirmLabel={t('editor.discard')}
        cancelLabel={t('common.cancel')}
        danger
        onClose={() => setConfirmLeave(null)}
        onConfirm={() => {
          setBaseline(JSON.stringify(state));
          confirmLeave?.proceed();
        }}
      />
    </Screen>
  );
}

export default function RecipeEditorPage() {
  const { id } = useParams();
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const [base, setBase] = useState<Recipe | null | undefined>(id ? undefined : null);

  useEffect(() => {
    if (!id) return;
    void db()
      .then((d) => getRecipe(d, id))
      .then(setBase);
  }, [id]);

  if (base === undefined) {
    return (
      <Screen title={t('editor.editTitle')} back>
        <div className="center" style={{ padding: 64 }}>
          <Spinner />
        </div>
      </Screen>
    );
  }
  // An unknown id (deleted recipe, stale link) must not open an empty "new recipe" editor.
  if (id && !base) {
    return (
      <Screen title="" back>
        <EmptyState illustration="search" title={t('recipe.notFound')} />
      </Screen>
    );
  }

  return (
    <RecipeEditor
      title={base ? t('editor.editTitle') : t('editor.newTitle')}
      initial={base ? stateFromRecipe(base, lang) : emptyState()}
      base={base}
      onSaved={(rid) => (base ? navigate(-1) : navigate(`/recipes/${rid}`, { replace: true }))}
    />
  );
}
