import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useT } from '@/i18n';
import { fetchBinary } from '@/import';
import { saveImage } from '@/platform/images';
import { snackbar } from '@/store/snackbar';
import { LinearProgress } from '@/ui/Controls';
import { RecipeEditor } from '@/features/recipes/RecipeEditorPage';
import { stateFromImported, type EditState } from '@/features/recipes/editorModel';
import { usePendingImport } from './pendingImport';

/** Review screen: the imported recipe in the editor, photo downloaded and compressed locally. */
export default function ImportReviewPage() {
  const t = useT();
  const navigate = useNavigate();
  const draft = usePendingImport((s) => s.draft);
  const setDraft = usePendingImport((s) => s.setDraft);
  const initial = useMemo(() => (draft ? stateFromImported(draft) : null), [draft]);
  const [ready, setReady] = useState<EditState | null>(null);
  const saved = useRef(false);

  // The draft is dropped once the page is gone: clearing it while still mounted would render the
  // <Navigate to="/recipes"> below, which overrode the navigation to the saved recipe.
  useEffect(
    () => () => {
      if (saved.current) setDraft(null);
    },
    [setDraft],
  );

  useEffect(() => {
    if (!draft || !initial) return;
    let alive = true;
    void (async () => {
      let photo: string | null = null;
      if (draft.imageUrl) {
        try {
          photo = await saveImage(await fetchBinary(draft.imageUrl));
        } catch {
          snackbar(t('import.imageFailed'));
        }
      }
      if (alive) setReady({ ...initial, photo });
    })();
    return () => {
      alive = false;
    };
  }, [draft, initial, t]);

  if (!draft) return <Navigate to="/recipes" replace />;
  if (!ready) {
    return (
      <div className="screen">
        <div style={{ paddingTop: 'calc(var(--safe-top) + 64px)' }}>
          <LinearProgress />
          <p className="pad muted">{t('import.loading')}</p>
        </div>
      </div>
    );
  }
  return (
    <RecipeEditor
      title={t('import.reviewTitle')}
      initial={ready}
      base={null}
      onSaved={(id) => {
        saved.current = true;
        navigate(`/recipes/${id}`, { replace: true });
      }}
    />
  );
}
