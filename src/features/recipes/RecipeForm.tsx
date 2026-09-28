import { useState } from 'react';
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion';
import { Button, IconButton } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Segmented, Stepper, ListItem } from '@/ui/Controls';
import { TextField } from '@/ui/TextField';
import { BottomSheet } from '@/ui/BottomSheet';
import { RecipeImage } from '@/ui/RecipeImage';
import { Icon } from '@/ui/Icon';
import { useLang, useT } from '@/i18n';
import { CATEGORIES, type Difficulty } from '@/db/types';
import { newId } from '@/lib/id';
import { pickPhoto } from '@/platform/camera';
import { saveImage } from '@/platform/images';
import { snackbar } from '@/store/snackbar';
import { formatAmount } from './format';
import { ingredientFromText, type EditIngredient, type EditSection, type EditState } from './editorModel';

interface Props {
  state: EditState;
  onChange: (s: EditState) => void;
  titleError: boolean;
}

function IngredientRow({
  item,
  onText,
  onRemove,
  onEnter,
  autoFocus,
}: {
  item: EditIngredient;
  onText: (text: string) => void;
  onRemove: () => void;
  onEnter: () => void;
  autoFocus: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const amount = formatAmount(item.data, lang);
  return (
    <motion.div
      className="ing-row"
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className="grow">
        <input
          className="ing-input"
          value={item.text}
          placeholder={t('editor.pasteLinesHint')}
          autoFocus={autoFocus}
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEnter();
            }
          }}
          aria-label={t('editor.name')}
        />
        {item.text.trim() && (amount || item.data.note) && (
          <div className="ing-parsed">
            {amount && <span className="ing-parsed-qty">{amount}</span>}
            <span>{item.data.name}</span>
            {item.data.note && <span className="muted">· {item.data.note}</span>}
          </div>
        )}
      </div>
      <IconButton icon="close" label={t('common.delete')} small onClick={onRemove} />
    </motion.div>
  );
}

function StepEditItem({
  step,
  index,
  autoFocus,
  onText,
  onRemove,
}: {
  step: { id: string; text: string };
  index: number;
  autoFocus: boolean;
  onText: (text: string) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const controls = useDragControls();
  // Dragging only from the handle keeps text selection and scrolling usable.
  return (
    <Reorder.Item value={step} className="step-edit" dragListener={false} dragControls={controls}>
      <span className="step-num">{index + 1}</span>
      <TextField
        className="grow"
        multiline
        rows={2}
        value={step.text}
        placeholder={t('editor.stepPlaceholder')}
        autoFocus={autoFocus}
        onChange={onText}
      />
      <div className="col" style={{ gap: 0 }}>
        <span
          className="drag-handle"
          onPointerDown={(e) => controls.start(e)}
          aria-label={t('editor.moveDown')}
        >
          <Icon name="drag_indicator" />
        </span>
        <IconButton icon="close" small label={t('common.delete')} onClick={onRemove} />
      </div>
    </Reorder.Item>
  );
}

export function RecipeForm({ state: s, onChange, titleError }: Props) {
  const t = useT();
  const [photoSheet, setPhotoSheet] = useState(false);
  const [pasteFor, setPasteFor] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const set = (patch: Partial<EditState>) => onChange({ ...s, ...patch });

  const updateSection = (id: string, fn: (sec: EditSection) => EditSection) =>
    set({ sections: s.sections.map((sec) => (sec.id === id ? fn(sec) : sec)) });

  const addIngredient = (sectionId: string, after?: string) => {
    const item = ingredientFromText('');
    setFocusId(item.id);
    updateSection(sectionId, (sec) => {
      const idx = after ? sec.items.findIndex((i) => i.id === after) + 1 : sec.items.length;
      const items = [...sec.items];
      items.splice(idx, 0, item);
      return { ...sec, items };
    });
  };

  const choosePhoto = async (source: 'camera' | 'photos') => {
    setPhotoSheet(false);
    const blob = await pickPhoto(source);
    if (!blob) return;
    try {
      set({ photo: await saveImage(blob) });
    } catch {
      snackbar(t('common.error'));
    }
  };

  return (
    <div className="form">
      <button type="button" className="form-photo ripple" onClick={() => setPhotoSheet(true)}>
        {s.photo ? (
          <RecipeImage path={s.photo} category={s.category} alt="" />
        ) : (
          <div className="form-photo-empty">
            <Icon name="photo_camera" size={36} />
            <span className="label-large">{t('editor.photo')}</span>
          </div>
        )}
        {s.photo && (
          <span className="form-photo-badge">
            <Icon name="edit" size={18} />
          </span>
        )}
      </button>

      <TextField
        label={t('editor.title')}
        value={s.title}
        onChange={(title) => set({ title })}
        error={titleError && !s.title.trim() ? t('editor.titleRequired') : null}
      />

      <div className="form-block">
        <div className="title-small muted">{t('editor.category')}</div>
        <div className="chip-wrap">
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={t(`category.${c}`)}
              selected={s.category === c}
              onClick={() => set({ category: c })}
            />
          ))}
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="body-large">{t('editor.servings')}</span>
        <Stepper value={s.servings} onChange={(servings) => set({ servings })} labelMinus="-" labelPlus="+" />
      </div>
      <div className="form-grid">
        <TextField
          label={t('editor.prep')}
          value={s.prep}
          inputMode="numeric"
          onChange={(prep) => set({ prep: prep.replace(/\D/g, '') })}
        />
        <TextField
          label={t('editor.cook')}
          value={s.cook}
          inputMode="numeric"
          onChange={(cook) => set({ cook: cook.replace(/\D/g, '') })}
        />
      </div>

      <div className="form-block">
        <div className="title-small muted">{t('editor.difficulty')}</div>
        <Segmented<Difficulty | 'none'>
          value={s.difficulty ?? 'none'}
          onChange={(v) => set({ difficulty: v === 'none' ? null : v })}
          options={[
            { value: 'easy', label: t('difficulty.easy') },
            { value: 'medium', label: t('difficulty.medium') },
            { value: 'hard', label: t('difficulty.hard') },
          ]}
        />
      </div>

      <h2 className="form-heading serif">{t('editor.ingredients')}</h2>
      {s.sections.map((sec, si) => (
        <div key={sec.id} className="form-section">
          {(s.sections.length > 1 || sec.name) && (
            <div className="row">
              <TextField
                className="grow"
                label={t('editor.sectionName')}
                value={sec.name}
                onChange={(name) => updateSection(sec.id, (x) => ({ ...x, name }))}
              />
              {si > 0 && (
                <IconButton
                  icon="delete"
                  label={t('editor.removeSection')}
                  onClick={() => set({ sections: s.sections.filter((x) => x.id !== sec.id) })}
                />
              )}
            </div>
          )}
          <AnimatePresence initial={false}>
            {sec.items.map((item) => (
              <IngredientRow
                key={item.id}
                item={item}
                autoFocus={focusId === item.id}
                onText={(text) =>
                  updateSection(sec.id, (x) => ({
                    ...x,
                    items: x.items.map((i) => (i.id === item.id ? ingredientFromText(text, item.id) : i)),
                  }))
                }
                onEnter={() => addIngredient(sec.id, item.id)}
                onRemove={() =>
                  updateSection(sec.id, (x) => ({ ...x, items: x.items.filter((i) => i.id !== item.id) }))
                }
              />
            ))}
          </AnimatePresence>
          <div className="row wrap" style={{ paddingLeft: 8 }}>
            <Button variant="text" icon="add" onClick={() => addIngredient(sec.id)}>
              {t('editor.addIngredient')}
            </Button>
            <Button
              variant="text"
              icon="content_paste"
              onClick={() => {
                setPasteText('');
                setPasteFor(sec.id);
              }}
            >
              {t('editor.pasteLines')}
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="outlined"
        icon="playlist_add"
        onClick={() =>
          set({
            sections: [...s.sections, { id: newId(), name: '', items: [ingredientFromText('')] }],
          })
        }
      >
        {t('editor.addSection')}
      </Button>

      <h2 className="form-heading serif">{t('editor.steps')}</h2>
      <Reorder.Group
        axis="y"
        values={s.steps}
        onReorder={(steps) => set({ steps })}
        className="step-edit-list"
      >
        {s.steps.map((st, idx) => (
          <StepEditItem
            key={st.id}
            step={st}
            index={idx}
            autoFocus={focusId === st.id}
            onText={(text) => set({ steps: s.steps.map((x) => (x.id === st.id ? { ...x, text } : x)) })}
            onRemove={() => set({ steps: s.steps.filter((x) => x.id !== st.id) })}
          />
        ))}
      </Reorder.Group>
      <Button
        variant="text"
        icon="add"
        onClick={() => {
          const id = newId();
          setFocusId(id);
          set({ steps: [...s.steps, { id, text: '' }] });
        }}
      >
        {t('editor.addStep')}
      </Button>

      <h2 className="form-heading serif">{t('editor.notes')}</h2>
      <TextField
        label={t('editor.notes')}
        multiline
        rows={3}
        value={s.notes}
        onChange={(notes) => set({ notes })}
      />
      <TextField
        label={t('editor.tags')}
        supporting={t('editor.tagsHint')}
        value={s.tags}
        onChange={(tags) => set({ tags })}
      />
      <TextField
        label={t('editor.sourceUrl')}
        type="url"
        inputMode="url"
        value={s.sourceUrl}
        onChange={(sourceUrl) => set({ sourceUrl })}
      />

      <BottomSheet open={photoSheet} onClose={() => setPhotoSheet(false)} title={t('editor.photo')}>
        <ListItem
          icon="photo_camera"
          headline={t('editor.takePhoto')}
          onClick={() => void choosePhoto('camera')}
        />
        <ListItem
          icon="image"
          headline={t('editor.choosePhoto')}
          onClick={() => void choosePhoto('photos')}
        />
        {s.photo && (
          <ListItem
            icon="delete"
            headline={t('editor.removePhoto')}
            onClick={() => {
              setPhotoSheet(false);
              set({ photo: null });
            }}
          />
        )}
      </BottomSheet>

      <BottomSheet
        open={pasteFor !== null}
        onClose={() => setPasteFor(null)}
        title={t('editor.pasteLines')}
        actions={
          <>
            <Button variant="text" onClick={() => setPasteFor(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                const lines = pasteText
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean);
                const target = pasteFor;
                setPasteFor(null);
                if (!target || !lines.length) return;
                updateSection(target, (x) => ({
                  ...x,
                  items: [
                    ...x.items.filter((i) => i.text.trim()),
                    ...lines.map((l) => ingredientFromText(l)),
                  ],
                }));
              }}
            >
              {t('common.add')}
            </Button>
          </>
        }
      >
        <div className="pad">
          <TextField
            multiline
            rows={8}
            value={pasteText}
            onChange={setPasteText}
            placeholder={t('editor.pasteLinesHint')}
            autoFocus
          />
        </div>
      </BottomSheet>
    </div>
  );
}
