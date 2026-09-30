import { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Screen } from '@/ui/Screen';
import { Button, IconButton } from '@/ui/Button';
import { Checkbox } from '@/ui/Controls';
import { ConfirmDialog } from '@/ui/Dialog';
import { EmptyState } from '@/ui/EmptyState';
import { OverflowMenu } from '@/ui/Menu';
import { SwipeToDelete } from '@/ui/SwipeToDelete';
import { Icon } from '@/ui/Icon';
import { useLang, useT } from '@/i18n';
import { AISLES, AISLE_LABELS, guessAisle, type Aisle } from '@/config/aisles';
import type { ShoppingItem } from '@/db/types';
import { parseIngredientLine } from '@/import/ingredientParser';
import { snackbar } from '@/store/snackbar';
import { shareText } from '@/platform/share';
import { formatAmount } from '@/features/recipes/format';
import { sendToMago, draftsToText } from '@/features/mago/sendToMago';
import { useShopping } from './store';
import { EditItemSheet } from './EditItemSheet';

const toDraft = (i: ShoppingItem) => ({
  name: i.name,
  quantity: i.quantity,
  unit: i.unit,
  aisle: i.aisle,
  note: i.note,
  recipeTitle: i.recipeTitles.join(', ') || undefined,
});

/** One row: re-renders only when its own item changes (actions are read through selectors). */
const ItemRow = memo(function ItemRow({
  item,
  onEdit,
}: {
  item: ShoppingItem;
  onEdit: (item: ShoppingItem) => void;
}) {
  const lang = useLang();
  const t = useT();
  const toggle = useShopping((s) => s.toggle);
  const remove = useShopping((s) => s.remove);
  const restore = useShopping((s) => s.restore);
  const amount = formatAmount({ quantity: item.quantity, quantityMax: null, unit: item.unit }, lang);
  return (
    <SwipeToDelete
      label={t('common.delete')}
      onDelete={() =>
        void remove([item.id]).then((removed) =>
          snackbar(t('shopping.removed'), {
            actionLabel: t('common.undo'),
            onAction: () => void restore(removed),
          }),
        )
      }
    >
      {/* Tapping the row is a shortcut; its checkbox and edit button are the accessible controls. */}
      <div className={`shop-item${item.checked ? ' checked' : ''}`} onClick={() => void toggle(item.id)}>
        <Checkbox checked={item.checked} label={item.name} onChange={() => void toggle(item.id)} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="shop-item-name">
            <span className="shop-strike">{item.name}</span>
            {amount && <span className="shop-item-qty">{amount}</span>}
          </div>
          {(item.note || item.recipeTitles.length > 0) && (
            <div className="body-small muted ellipsis">
              {[
                item.note,
                item.recipeTitles.length
                  ? t('shopping.forRecipes', { list: item.recipeTitles.join(', ') })
                  : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
        </div>
        <IconButton
          icon="edit"
          small
          label={t('shopping.editItem')}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(item);
          }}
        />
      </div>
    </SwipeToDelete>
  );
});

export default function ShoppingPage() {
  const t = useT();
  const lang = useLang();
  const { items, loaded, load, addDrafts, remove, restore, clear } = useShopping();
  const [input, setInput] = useState('');
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const groups = useMemo(() => {
    const open = items.filter((i) => !i.checked);
    return AISLES.map((a) => ({
      aisle: a,
      items: open.filter(
        (i) => (i.aisle as Aisle) === a || (!AISLES.includes(i.aisle as Aisle) && a === 'other'),
      ),
    })).filter((g) => g.items.length);
  }, [items]);
  const checked = items.filter((i) => i.checked);
  const remaining = items.length - checked.length;

  const addFromInput = () => {
    const text = input.trim();
    if (!text) return;
    const p = parseIngredientLine(text);
    void addDrafts([
      {
        name: p.name || text,
        quantity: p.quantity,
        unit: p.unit,
        note: p.note,
        aisle: guessAisle(p.name || text),
      },
    ]);
    setInput('');
  };

  const clearChecked = async () => {
    const removed = await remove(checked.map((i) => i.id));
    snackbar(t('shopping.cleared', { count: removed.length }), {
      actionLabel: t('common.undo'),
      onAction: () => void restore(removed),
    });
  };

  const title = t('shopping.title');
  return (
    <Screen
      title={title}
      large
      withNav
      scrollKey="shopping"
      actions={
        <OverflowMenu
          label={t('common.more')}
          items={[
            {
              label: t('shopping.shareText'),
              icon: 'share',
              hidden: !items.length,
              onSelect: () =>
                void shareText(title, draftsToText(items.filter((i) => !i.checked).map(toDraft), title)),
            },
            {
              label: t('shopping.clearChecked'),
              icon: 'done_all',
              hidden: !checked.length,
              onSelect: () => void clearChecked(),
            },
            {
              label: t('shopping.clearAll'),
              icon: 'remove_shopping_cart',
              danger: true,
              hidden: !items.length,
              onSelect: () => setConfirmClear(true),
            },
          ]}
        />
      }
    >
      <form
        className="searchbar"
        onSubmit={(e) => {
          e.preventDefault();
          addFromInput();
        }}
      >
        <Icon name="add" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('shopping.addPlaceholder')}
          enterKeyHint="done"
          aria-label={t('shopping.addPlaceholder')}
        />
        {input && <IconButton icon="check" label={t('common.add')} small type="submit" />}
      </form>

      {items.length > 0 && (
        <div className="shop-summary">
          <span className="label-large muted">{t('shopping.remaining', { count: remaining })}</span>
          <Button
            variant="tonal"
            icon="send"
            onClick={() => void sendToMago(items.filter((i) => !i.checked).map(toDraft), title)}
            disabled={!remaining}
          >
            {t('shopping.sendToMago')}
          </Button>
        </div>
      )}

      {loaded && items.length === 0 && (
        <EmptyState illustration="basket" title={t('shopping.emptyTitle')} body={t('shopping.emptyBody')} />
      )}

      <AnimatePresence initial={false}>
        {groups.map((g) => (
          <motion.section
            key={g.aisle}
            layout
            className="aisle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h3 className="aisle-title">
              <span aria-hidden="true">{AISLE_LABELS[g.aisle].emoji}</span>
              {AISLE_LABELS[g.aisle][lang]}
              <span className="aisle-count">{g.items.length}</span>
            </h3>
            <AnimatePresence initial={false}>
              {g.items.map((i) => (
                <ItemRow key={i.id} item={i} onEdit={setEditing} />
              ))}
            </AnimatePresence>
          </motion.section>
        ))}
        {checked.length > 0 && (
          <motion.section key="checked" layout className="aisle aisle-checked">
            <h3 className="aisle-title">
              <Icon name="check_circle" size={18} />
              {t('shopping.checked')}
              <span className="aisle-count">{checked.length}</span>
              <span className="grow" />
              <Button variant="text" onClick={() => void clearChecked()}>
                {t('common.delete')}
              </Button>
            </h3>
            <AnimatePresence initial={false}>
              {checked.map((i) => (
                <ItemRow key={i.id} item={i} onEdit={setEditing} />
              ))}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>

      <EditItemSheet item={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={confirmClear}
        title={t('shopping.clearAllConfirm')}
        confirmLabel={t('shopping.clearAll')}
        cancelLabel={t('common.cancel')}
        danger
        onClose={() => setConfirmClear(false)}
        onConfirm={() =>
          void clear().then((removed) =>
            snackbar(t('shopping.cleared', { count: removed.length }), {
              actionLabel: t('common.undo'),
              onAction: () => void restore(removed),
            }),
          )
        }
      />
    </Screen>
  );
}
