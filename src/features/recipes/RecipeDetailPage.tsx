import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '@/ui/Screen';
import { Button, IconButton } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { OverflowMenu } from '@/ui/Menu';
import { RatingStars, Stepper, Spinner } from '@/ui/Controls';
import { ConfirmDialog } from '@/ui/Dialog';
import { EmptyState } from '@/ui/EmptyState';
import { RecipeImage } from '@/ui/RecipeImage';
import { useLang, useT } from '@/i18n';
import type { Id, Recipe } from '@/db/types';
import { getRecipe } from '@/db/repos/recipes';
import { collectionIdsForRecipe } from '@/db/repos/collections';
import { db, useRecipes } from '@/store/recipes';
import { snackbar } from '@/store/snackbar';
import { startStepTimer } from '@/features/cooking/startStepTimer';
import { sendToMago } from '@/features/mago/sendToMago';
import { AddToPlanSheet } from '@/features/planner/AddToPlanSheet';
import { shareFile, shareText } from '@/platform/share';
import { safeHttpUrl } from '@/lib/url';
import { formatAmount, recipeToText } from './format';
import { scaleIngredient } from './portions';
import { StepText } from './StepText';
import { formatDuration } from './timerDetect';
import {
  addRecipeToShopping,
  deleteRecipeWithUndo,
  duplicateRecipe,
  markRecipeCooked,
  recipeToDrafts,
  setRating,
  toggleFavorite,
} from './actions';
import { RecipeCollectionsSheet } from './CollectionsSheet';
import { renderRecipeCard } from './shareCard';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function RecipeDetailPage() {
  const { id = '' } = useParams();
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const summaries = useRecipes((s) => s.summaries);
  const summary = summaries.find((s) => s.id === id);
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined);
  const [servings, setServings] = useState(4);
  // Servings are set from the recipe once per recipe, not at every reload (favourite, cooked…).
  const servingsFor = useRef<string | null>(null);
  const [collectionIds, setCollectionIds] = useState<Id[]>([]);
  const [planOpen, setPlanOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const d = await db();
      const [r, cols] = await Promise.all([getRecipe(d, id), collectionIdsForRecipe(d, id)]);
      if (!alive) return;
      setRecipe(r);
      setCollectionIds(cols);
      if (r && servingsFor.current !== r.id) {
        servingsFor.current = r.id;
        setServings(r.servings);
      }
    })();
    return () => {
      alive = false;
    };
    // Re-read when the summary changes (favorite, rating, cooked count…)
  }, [id, summary?.updatedAt, summary?.cookedCount]);

  const heroFor = (r: Pick<Recipe, 'id' | 'photo' | 'category' | 'title'>) => (
    <motion.div
      layoutId={`photo-${r.id}`}
      className="detail-hero"
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
    >
      <RecipeImage path={r.photo} category={r.category} alt={r.title} iconSize={72} />
      <div className="detail-hero-shade" />
    </motion.div>
  );

  if (recipe === undefined) {
    // Keep the hero mounted from the first frame so the card → detail container transform can run.
    return (
      <Screen title={summary?.title ?? ''} back hero={summary ? heroFor(summary) : undefined}>
        <div className="center" style={{ padding: 64 }}>
          <Spinner />
        </div>
      </Screen>
    );
  }
  if (!recipe) {
    return (
      <Screen title="" back>
        <EmptyState illustration="search" title={t('recipe.notFound')} />
      </Screen>
    );
  }

  const favorite = summary?.favorite ?? recipe.favorite;
  const rating = summary?.rating ?? recipe.rating;
  const factor = recipe.servings > 0 ? servings / recipe.servings : 1;
  const total = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const sourceLink = safeHttpUrl(recipe.sourceUrl);

  const shareImage = async () => {
    snackbar(t('share.generating'), { duration: 1500 });
    const blob = await renderRecipeCard(recipe, lang, servings);
    const safe = recipe.title.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40);
    await shareFile({ blob, fileName: `${safe || 'recette'}.png`, title: recipe.title });
  };

  const hero = heroFor(recipe);

  return (
    <Screen
      title={recipe.title}
      back
      hero={hero}
      actions={
        <>
          <IconButton
            icon="favorite"
            label={favorite ? t('recipe.unfavorite') : t('recipe.favorite')}
            selected={favorite}
            onClick={() => void toggleFavorite(recipe.id, !favorite)}
          />
          <OverflowMenu
            label={t('common.more')}
            items={[
              {
                label: t('common.edit'),
                icon: 'edit',
                onSelect: () => navigate(`/recipes/${recipe.id}/edit`),
              },
              {
                label: t('recipe.shareText'),
                icon: 'text_snippet',
                onSelect: () => void shareText(recipe.title, recipeToText(recipe, lang, servings)),
              },
              { label: t('recipe.shareImage'), icon: 'image', onSelect: () => void shareImage() },
              {
                label: t('recipe.collections'),
                icon: 'collections_bookmark',
                onSelect: () => setCollectionsOpen(true),
              },
              {
                label: t('recipe.markCooked'),
                icon: 'done_all',
                onSelect: () =>
                  void markRecipeCooked(recipe.id).then(() => snackbar(t('recipe.markedCooked'))),
              },
              {
                label: t('recipe.duplicate'),
                icon: 'content_paste',
                onSelect: () =>
                  void duplicateRecipe(recipe).then((nid) => navigate(`/recipes/${nid}`, { replace: true })),
              },
              {
                label: t('common.delete'),
                icon: 'delete',
                danger: true,
                onSelect: () => setConfirmDelete(true),
              },
            ]}
          />
        </>
      }
    >
      <motion.div
        className="detail-body"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08, ease: [0.2, 0, 0, 1] }}
      >
        <h1 className="detail-title serif">{recipe.title}</h1>
        <div className="detail-meta">
          <span className="meta-pill">{t(`category.${recipe.category}`)}</span>
          {recipe.difficulty && <span className="meta-pill">{t(`difficulty.${recipe.difficulty}`)}</span>}
          <span className="meta-pill">
            <Icon name="done_all" size={16} />
            {t('recipe.cookedTimes', { count: recipe.cookedCount })}
          </span>
        </div>

        <div className="detail-times">
          {recipe.prepMinutes !== null && (
            <div>
              <Icon name="restaurant" />
              <span className="label-medium muted">{t('recipe.prep')}</span>
              <span className="title-medium">{formatDuration(recipe.prepMinutes)}</span>
            </div>
          )}
          {recipe.cookMinutes !== null && (
            <div>
              <Icon name="local_fire_department" />
              <span className="label-medium muted">{t('recipe.cook')}</span>
              <span className="title-medium">{formatDuration(recipe.cookMinutes)}</span>
            </div>
          )}
          {total > 0 && (
            <div>
              <Icon name="schedule" />
              <span className="label-medium muted">{t('recipe.total')}</span>
              <span className="title-medium">{formatDuration(total)}</span>
            </div>
          )}
        </div>

        <div className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
          <RatingStars
            value={rating}
            label={t('recipe.rate')}
            onChange={(v) => void setRating(recipe.id, v)}
            size={28}
          />
        </div>

        {recipe.tags.length > 0 && (
          <div className="chip-wrap" style={{ margin: '8px 0 4px' }}>
            {recipe.tags.map((tag) => (
              <span key={tag} className="tag">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="detail-actions">
          <Button
            large
            icon="skillet"
            onClick={() => navigate(`/recipes/${recipe.id}/cook?servings=${servings}`)}
          >
            {t('recipe.startCooking')}
          </Button>
          <div className="detail-actions-secondary">
            <Button variant="tonal" icon="event" onClick={() => setPlanOpen(true)}>
              {t('recipe.addToPlanner')}
            </Button>
            <Button
              variant="tonal"
              icon="playlist_add"
              onClick={() => void addRecipeToShopping(recipe, servings)}
            >
              {t('nav.shopping')}
            </Button>
            <Button
              variant="tonal"
              icon="send"
              onClick={() =>
                void sendToMago(recipeToDrafts(recipe, servings), t('mago.listFor', { title: recipe.title }))
              }
            >
              Mago
            </Button>
          </div>
        </div>

        <section className="detail-section">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="title-large serif">{t('recipe.ingredients')}</h2>
            <Stepper
              value={servings}
              onChange={setServings}
              labelMinus="-"
              labelPlus="+"
              format={(v) => (
                <span className="row" style={{ gap: 4, justifyContent: 'center' }}>
                  <Icon name="group" size={18} />
                  {v}
                </span>
              )}
            />
          </div>
          {recipe.sections.map((s) => (
            <div key={s.id} className="ingredient-group">
              {s.name && <h3 className="ingredient-section-name">{s.name}</h3>}
              <ul className="ingredient-list">
                {s.items.map((i) => {
                  const scaled = scaleIngredient(i, factor);
                  return (
                    <li key={i.id}>
                      <motion.span
                        key={`${servings}-${i.id}`}
                        className="ingredient-amount"
                        initial={factor !== 1 ? { opacity: 0.3, y: -4 } : false}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        {formatAmount(scaled, lang)}
                      </motion.span>
                      <span className="ingredient-name">
                        {i.name}
                        {i.note && <span className="muted"> · {i.note}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        <section className="detail-section">
          <h2 className="title-large serif">{t('recipe.steps')}</h2>
          <ol className="step-list">
            {recipe.steps.map((s, idx) => (
              <li key={s.id}>
                <span className="step-num">{idx + 1}</span>
                <p className="selectable">
                  <StepText text={s.text} onTimer={(sec, label) => startStepTimer(recipe, sec, label)} />
                </p>
              </li>
            ))}
          </ol>
        </section>

        {recipe.notes.trim() && (
          <section className="detail-section">
            <h2 className="title-large serif">{t('recipe.notes')}</h2>
            <p className="notes-card selectable">{recipe.notes}</p>
          </section>
        )}

        {sourceLink ? (
          <a className="source-link" href={sourceLink} target="_blank" rel="noreferrer">
            <Icon name="public" size={18} />
            <span className="ellipsis">
              {t('recipe.source')} · {hostOf(sourceLink)}
            </span>
            <Icon name="open_in_new" size={16} />
          </a>
        ) : (
          // Anything but an http(s) URL (older data) is shown as text, never as a link.
          recipe.sourceUrl && (
            <p className="source-link selectable">
              <Icon name="public" size={18} />
              <span className="ellipsis">
                {t('recipe.source')} · {recipe.sourceUrl}
              </span>
            </p>
          )
        )}
      </motion.div>

      <AddToPlanSheet
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        recipe={recipe}
        servings={servings}
      />
      <RecipeCollectionsSheet
        open={collectionsOpen}
        onClose={() => setCollectionsOpen(false)}
        recipeId={recipe.id}
        selected={collectionIds}
        onChanged={setCollectionIds}
      />
      <ConfirmDialog
        open={confirmDelete}
        icon="delete"
        title={t('recipe.deleteConfirmTitle')}
        body={t('recipe.deleteConfirmBody', { title: recipe.title })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          navigate(-1);
          void deleteRecipeWithUndo(recipe.id);
        }}
      />
    </Screen>
  );
}
