import { useEffect, useState } from 'react';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { TextField } from '@/ui/TextField';
import { useLang, useT } from '@/i18n';
import { AISLES, AISLE_LABELS } from '@/config/aisles';
import { resolveUnit } from '@/config/units';
import type { ShoppingItem } from '@/db/types';
import { formatAmount } from '@/features/recipes/format';
import { parseIngredientLine } from '@/import/ingredientParser';
import { useShopping } from './store';

export function EditItemSheet({ item, onClose }: { item: ShoppingItem | null; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const update = useShopping((s) => s.update);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [aisle, setAisle] = useState('other');

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setAmount(formatAmount({ quantity: item.quantity, quantityMax: null, unit: item.unit }, lang));
    setNote(item.note);
    setAisle(item.aisle);
  }, [item, lang]);

  const save = () => {
    if (!item || !name.trim()) return;
    // Parse "1,5 kg" style amounts with the ingredient parser.
    const parsed = amount.trim() ? parseIngredientLine(`${amount.trim()} x`) : null;
    void update({
      ...item,
      name: name.trim(),
      quantity: parsed?.quantity ?? null,
      unit: parsed ? parsed.unit || (resolveUnit(amount.replace(/[\d\s.,/]+/g, '')) ?? '') : '',
      note: note.trim(),
      aisle,
    });
    onClose();
  };

  return (
    <BottomSheet
      open={!!item}
      onClose={onClose}
      title={t('shopping.editItem')}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="pad col" style={{ gap: 12 }}>
        <TextField label={t('editor.name')} value={name} onChange={setName} />
        <TextField
          label={`${t('editor.quantity')} / ${t('editor.unit')}`}
          value={amount}
          onChange={setAmount}
        />
        <TextField label={t('editor.note')} value={note} onChange={setNote} />
        <div className="title-small muted">{t('shopping.aisle')}</div>
        <div className="chip-wrap">
          {AISLES.map((a) => (
            <Chip
              key={a}
              label={`${AISLE_LABELS[a].emoji} ${AISLE_LABELS[a][lang]}`}
              selected={aisle === a}
              onClick={() => setAisle(a)}
            />
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
