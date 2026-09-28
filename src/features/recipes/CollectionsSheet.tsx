import { useState } from 'react';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button, IconButton } from '@/ui/Button';
import { Checkbox, ListItem } from '@/ui/Controls';
import { ConfirmDialog, PromptDialog } from '@/ui/Dialog';
import { OverflowMenu } from '@/ui/Menu';
import { useT } from '@/i18n';
import { db, refreshRecipes, useRecipes } from '@/store/recipes';
import {
  createCollection,
  deleteCollection,
  renameCollection,
  setRecipeCollections,
} from '@/db/repos/collections';
import type { Collection, Id } from '@/db/types';

/** Manage collections (rename/delete/create). */
export function CollectionsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { collections, scope, setScope } = useRecipes();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Collection | null>(null);
  const [deleting, setDeleting] = useState<Collection | null>(null);

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t('recipes.collections')}
        actions={
          <Button icon="add" variant="tonal" onClick={() => setCreating(true)}>
            {t('recipes.newCollection')}
          </Button>
        }
      >
        {collections.length === 0 && <p className="pad muted body-medium">{t('collections.empty')}</p>}
        {collections.map((c) => (
          <ListItem
            key={c.id}
            icon="bookmark"
            headline={c.name}
            supporting={t('recipes.count', { count: c.recipeCount })}
            onClick={() => {
              setScope(c.id);
              onClose();
            }}
            trailing={
              <OverflowMenu
                label={t('common.more')}
                items={[
                  { label: t('common.rename'), icon: 'edit', onSelect: () => setRenaming(c) },
                  { label: t('common.delete'), icon: 'delete', danger: true, onSelect: () => setDeleting(c) },
                ]}
                trigger={(openMenu) => (
                  <IconButton
                    icon="more_vert"
                    label={t('common.more')}
                    onClick={(e) => {
                      e.stopPropagation();
                      openMenu();
                    }}
                  />
                )}
              />
            }
          />
        ))}
      </BottomSheet>
      <PromptDialog
        open={creating}
        title={t('recipes.newCollection')}
        label={t('collections.name')}
        confirmLabel={t('common.create')}
        cancelLabel={t('common.cancel')}
        onClose={() => setCreating(false)}
        onSubmit={(name) =>
          void db()
            .then((d) => createCollection(d, name))
            .then(refreshRecipes)
        }
      />
      <PromptDialog
        open={!!renaming}
        title={t('collections.renameTitle')}
        label={t('collections.name')}
        initial={renaming?.name}
        confirmLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        onClose={() => setRenaming(null)}
        onSubmit={(name) => {
          const c = renaming;
          if (c)
            void db()
              .then((d) => renameCollection(d, c.id, name))
              .then(refreshRecipes);
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title={t('collections.deleteConfirmTitle')}
        body={t('collections.deleteConfirmBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        danger
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          const c = deleting;
          if (!c) return;
          if (scope === c.id) setScope('all');
          void db()
            .then((d) => deleteCollection(d, c.id))
            .then(refreshRecipes);
        }}
      />
    </>
  );
}

/** Pick which collections a recipe belongs to. */
export function RecipeCollectionsSheet({
  open,
  onClose,
  recipeId,
  selected,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  recipeId: Id;
  selected: Id[];
  onChanged: (ids: Id[]) => void;
}) {
  const t = useT();
  const collections = useRecipes((s) => s.collections);
  const [creating, setCreating] = useState(false);
  const toggle = async (id: Id) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    onChanged(next);
    await setRecipeCollections(await db(), recipeId, next);
    await refreshRecipes();
  };
  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t('collections.choose')}
        actions={
          <>
            <Button variant="text" icon="add" onClick={() => setCreating(true)}>
              {t('recipes.newCollection')}
            </Button>
            <Button onClick={onClose}>{t('common.done')}</Button>
          </>
        }
      >
        {collections.length === 0 && <p className="pad muted body-medium">{t('collections.empty')}</p>}
        {collections.map((c) => (
          <ListItem
            key={c.id}
            icon="bookmark"
            headline={c.name}
            onClick={() => void toggle(c.id)}
            trailing={
              <Checkbox checked={selected.includes(c.id)} label={c.name} onChange={() => void toggle(c.id)} />
            }
          />
        ))}
      </BottomSheet>
      <PromptDialog
        open={creating}
        title={t('recipes.newCollection')}
        label={t('collections.name')}
        confirmLabel={t('common.create')}
        cancelLabel={t('common.cancel')}
        onClose={() => setCreating(false)}
        onSubmit={(name) =>
          void (async () => {
            const d = await db();
            const id = await createCollection(d, name);
            const next = [...selected, id];
            onChanged(next);
            await setRecipeCollections(d, recipeId, next);
            await refreshRecipes();
          })()
        }
      />
    </>
  );
}
