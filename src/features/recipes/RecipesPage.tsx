import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/ui/Screen';
import { IconButton, Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Chip } from '@/ui/Chip';
import { Fab } from '@/ui/Fab';
import { EmptyState } from '@/ui/EmptyState';
import { BottomSheet } from '@/ui/BottomSheet';
import { ListItem } from '@/ui/Controls';
import { SwipeToDelete } from '@/ui/SwipeToDelete';
import { useT } from '@/i18n';
import { useSettings } from '@/store/settings';
import { db, useRecipes } from '@/store/recipes';
import { searchRecipeIds } from '@/db/repos/recipes';
import type { Id } from '@/db/types';
import { RecipeCard } from './RecipeCard';
import { activeFilterCount, filterRecipes, pickRandom } from './filter';
import { FiltersSheet } from './FiltersSheet';
import { CollectionsSheet } from './CollectionsSheet';
import { deleteRecipeWithUndo } from './actions';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

function useSearchIds(query: string, version: unknown): Id[] | null {
  const [ids, setIds] = useState<Id[] | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setIds(null);
      return;
    }
    let alive = true;
    const h = setTimeout(() => {
      void db()
        .then((d) => searchRecipeIds(d, q))
        .then((r) => alive && setIds(r));
    }, 120);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [query, version]);
  return ids;
}

export function RecipesPage() {
  const t = useT();
  const navigate = useNavigate();
  const view = useSettings((s) => s.recipeView);
  const setSettings = useSettings((s) => s.set);
  const { summaries, collections, membership, query, filters, scope, setQuery, setScope, loaded } =
    useRecipes();
  const searchIds = useSearchIds(query, summaries);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  const results = useMemo(
    () => filterRecipes(summaries, { filters, scope, membership, searchIds }),
    [summaries, filters, scope, membership, searchIds],
  );
  const filterCount = activeFilterCount(filters);
  const narrowed = !!query.trim() || filterCount > 0 || scope !== 'all';

  const random = () => {
    const r = pickRandom(results.length ? results : summaries);
    if (!r) return;
    void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    navigate(`/recipes/${r.id}`);
  };

  return (
    <Screen
      title={t('recipes.title')}
      large
      withNav
      scrollKey="recipes"
      actions={
        <>
          <IconButton
            icon="casino"
            label={t('recipes.random')}
            onClick={random}
            disabled={!summaries.length}
          />
          <IconButton
            icon={view === 'grid' ? 'view_list' : 'grid_view'}
            label={view === 'grid' ? t('recipes.viewList') : t('recipes.viewGrid')}
            onClick={() => setSettings({ recipeView: view === 'grid' ? 'list' : 'grid' })}
          />
        </>
      }
      fab={(extended) => (
        <Fab icon="add" label={t('recipes.add')} extended={extended} onClick={() => setAddOpen(true)} />
      )}
    >
      <label className="searchbar">
        <Icon name="search" />
        <input
          type="search"
          value={query}
          placeholder={t('recipes.searchPlaceholder')}
          onChange={(e) => setQuery(e.target.value)}
          enterKeyHint="search"
          aria-label={t('common.search')}
        />
        {query && <IconButton icon="close" label={t('common.close')} small onClick={() => setQuery('')} />}
      </label>

      <div className="chip-row">
        <Chip
          label={filterCount ? `${t('recipes.filters')} · ${filterCount}` : t('recipes.filters')}
          icon="tune"
          selected={filterCount > 0}
          onClick={() => setFiltersOpen(true)}
        />
        <Chip label={t('recipes.all')} selected={scope === 'all'} onClick={() => setScope('all')} />
        <Chip
          label={t('recipes.favorites')}
          icon="favorite"
          selected={scope === 'favorites'}
          onClick={() => setScope(scope === 'favorites' ? 'all' : 'favorites')}
        />
        {collections.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            icon="bookmark"
            selected={scope === c.id}
            onClick={() => setScope(scope === c.id ? 'all' : c.id)}
          />
        ))}
        <Chip
          label={t('recipes.collections')}
          icon="collections_bookmark"
          onClick={() => setCollectionsOpen(true)}
        />
      </div>

      <div className="chip-row" style={{ paddingTop: 0 }}>
        <Chip
          label={t('recipes.whatCanICook')}
          icon="kitchen"
          elevated
          onClick={() => navigate('/cook-with')}
        />
        {summaries.length > 0 && (
          <span className="label-medium muted center" style={{ paddingLeft: 4 }}>
            {t('recipes.count', { count: results.length })}
          </span>
        )}
      </div>

      {loaded && summaries.length === 0 ? (
        <EmptyState
          illustration="pot"
          title={t('recipes.emptyTitle')}
          body={t('recipes.emptyBody')}
          action={
            <Button icon="add" onClick={() => setAddOpen(true)}>
              {t('recipes.add')}
            </Button>
          }
        />
      ) : results.length === 0 && narrowed ? (
        <EmptyState
          illustration="search"
          title={t('recipes.noResultsTitle')}
          body={t('recipes.noResultsBody')}
        />
      ) : view === 'grid' ? (
        <div className="recipe-grid">
          {results.map((r, i) => (
            <RecipeCard key={r.id} recipe={r} view="grid" index={i} />
          ))}
        </div>
      ) : (
        <motion.div className="recipe-list" layout>
          <AnimatePresence initial={false}>
            {results.map((r, i) => (
              <SwipeToDelete
                key={r.id}
                label={t('common.delete')}
                onDelete={() => void deleteRecipeWithUndo(r.id)}
              >
                <RecipeCard recipe={r} view="list" index={i} />
              </SwipeToDelete>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <FiltersSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} />
      <CollectionsSheet open={collectionsOpen} onClose={() => setCollectionsOpen(false)} />
      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={t('recipes.add')}>
        <ListItem
          icon="edit"
          headline={t('recipes.newManual')}
          onClick={() => {
            setAddOpen(false);
            navigate('/recipes/new');
          }}
        />
        <ListItem
          icon="link"
          headline={t('recipes.newFromUrl')}
          onClick={() => {
            setAddOpen(false);
            navigate('/import?mode=url');
          }}
        />
        <ListItem
          icon="content_paste"
          headline={t('recipes.newFromText')}
          onClick={() => {
            setAddOpen(false);
            navigate('/import?mode=text');
          }}
        />
      </BottomSheet>
    </Screen>
  );
}
