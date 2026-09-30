import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/ui/Screen';
import { Chip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { RecipeImage } from '@/ui/RecipeImage';
import { useT } from '@/i18n';
import { useRecipes } from '@/store/recipes';
import { frequentIngredients, matchRecipes } from './cookWith';

let remembered: string[] = [];

export default function CookWithPage() {
  const t = useT();
  const navigate = useNavigate();
  const summaries = useRecipes((s) => s.summaries);
  const [have, setHave] = useState<string[]>(remembered);
  const [input, setInput] = useState('');
  const suggestions = useMemo(
    () => frequentIngredients(summaries).filter((s) => !have.includes(s)),
    [summaries, have],
  );
  const results = useMemo(() => matchRecipes(summaries, have), [summaries, have]);

  const update = (next: string[]) => {
    remembered = next;
    setHave(next);
  };
  const add = (raw: string) => {
    const items = raw
      .split(/[,;\n]/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s && !have.includes(s));
    if (items.length) update([...have, ...items]);
    setInput('');
  };

  return (
    <Screen title={t('cookWith.title')} back>
      <p className="pad muted body-medium" style={{ marginTop: 0 }}>
        {t('cookWith.hint')}
      </p>
      <form
        className="searchbar"
        onSubmit={(e) => {
          e.preventDefault();
          add(input);
        }}
      >
        <Icon name="kitchen" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('cookWith.placeholder')}
          enterKeyHint="done"
          aria-label={t('cookWith.placeholder')}
        />
        <IconButton icon="add" label={t('common.add')} small type="submit" disabled={!input.trim()} />
      </form>

      {have.length > 0 && (
        <div className="chip-wrap pad" style={{ margin: '8px 0' }}>
          <AnimatePresence initial={false}>
            {have.map((h) => (
              <motion.span
                key={h}
                layout
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
              >
                <Chip
                  label={h}
                  selected
                  trailingIcon="close"
                  onClick={() => update(have.filter((x) => x !== h))}
                />
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}

      {suggestions.length > 0 && (
        <>
          <div className="section-title label-large">{t('cookWith.suggestions')}</div>
          <div className="chip-row">
            {suggestions.map((s) => (
              <Chip key={s} label={s} icon="add" onClick={() => add(s)} />
            ))}
          </div>
        </>
      )}

      {have.length === 0 ? (
        <EmptyState illustration="fridge" title={t('cookWith.emptyTitle')} body={t('cookWith.emptyBody')} />
      ) : results.length === 0 ? (
        <EmptyState illustration="search" title={t('cookWith.noMatch')} />
      ) : (
        <motion.div className="match-list" layout>
          <AnimatePresence initial={false}>
            {results.map((m) => (
              <motion.button
                key={m.recipe.id}
                layout
                type="button"
                className="match-item ripple"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => navigate(`/recipes/${m.recipe.id}`)}
              >
                <RecipeImage
                  path={m.recipe.photo}
                  category={m.recipe.category}
                  alt=""
                  iconSize={24}
                  className="match-thumb"
                />
                <div className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                  <div className="title-medium ellipsis">{m.recipe.title}</div>
                  <div className="match-bar">
                    <motion.div
                      className="match-bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${(m.have / m.total) * 100}%` }}
                      transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
                    />
                  </div>
                  <div className="body-small muted ellipsis">
                    {t('cookWith.matches', { have: m.have, count: m.total })} ·{' '}
                    {m.missing.length
                      ? t('cookWith.missing', { list: m.missing.join(', ') })
                      : t('cookWith.nothingMissing')}
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </Screen>
  );
}
