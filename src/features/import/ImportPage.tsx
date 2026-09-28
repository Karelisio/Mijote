import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '@/ui/Screen';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';
import { Icon } from '@/ui/Icon';
import { LinearProgress } from '@/ui/Controls';
import { useT, type TKey } from '@/i18n';
import { importFromUrl, normalizeUrl, parseRecipeText } from '@/import';
import type { ImportedRecipe } from '@/db/types';
import { usePendingImport } from './pendingImport';

type Mode = 'url' | 'text';

async function readClipboard(): Promise<string> {
  try {
    return (await navigator.clipboard?.readText()) ?? '';
  } catch {
    return '';
  }
}

export default function ImportPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { shared, setShared, setDraft } = usePendingImport();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'text' ? 'text' : 'url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<TKey | null>(null);
  const handledShare = useRef(false);

  const done = (r: ImportedRecipe) => {
    setDraft(r);
    navigate('/import/review', { replace: true });
  };

  const analyzeUrl = async (raw: string) => {
    const target = normalizeUrl(raw);
    if (!target) {
      setError('import.errorEmpty');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      done(await importFromUrl(target));
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'no_recipe' ? 'import.errorNoRecipe' : 'import.errorNetwork',
      );
    } finally {
      setLoading(false);
    }
  };

  const analyzeText = (raw: string) => {
    if (!raw.trim()) {
      setError('import.errorEmpty');
      return;
    }
    const r = parseRecipeText(raw);
    if (!r.title && !r.steps.length && !r.sections.some((s) => s.lines.length)) {
      setError('import.errorNoRecipe');
      return;
    }
    done(r);
  };

  // Content shared from another app: a link is fetched, anything else is parsed as text.
  useEffect(() => {
    if (!shared || handledShare.current) return;
    handledShare.current = true;
    setShared(null);
    const link = normalizeUrl(shared.text);
    const rest = link ? shared.text.replace(link, '').trim() : shared.text;
    if (link && rest.length < 200) {
      setMode('url');
      setUrl(link);
      void analyzeUrl(link);
    } else {
      setMode('text');
      const full =
        shared.subject && !shared.text.startsWith(shared.subject)
          ? `${shared.subject}\n${shared.text}`
          : shared.text;
      setText(full);
      analyzeText(full);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared]);

  return (
    <Screen title={t('import.title')} back>
      <div className="tabs" role="tablist">
        {(['url', 'text'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`tab ripple${mode === m ? ' active' : ''}`}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
          >
            <Icon name={m === 'url' ? 'link' : 'content_paste'} size={20} />
            {m === 'url' ? t('import.fromUrl') : t('import.fromText')}
            {mode === m && <motion.span layoutId="import-tab" className="tab-indicator" />}
          </button>
        ))}
      </div>
      {loading && <LinearProgress />}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          className="import-body"
          initial={{ opacity: 0, x: mode === 'url' ? -16 : 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {mode === 'url' ? (
            <form
              className="col"
              style={{ gap: 16 }}
              onSubmit={(e) => {
                e.preventDefault();
                void analyzeUrl(url);
              }}
            >
              <TextField
                label={t('import.urlLabel')}
                type="url"
                inputMode="url"
                value={url}
                onChange={setUrl}
                supporting={t('import.urlHint')}
                autoFocus={!url}
                trailing={
                  <Button
                    variant="text"
                    onClick={() => void readClipboard().then((c) => c && setUrl(normalizeUrl(c) ?? c))}
                  >
                    {t('import.paste')}
                  </Button>
                }
              />
              <Button large icon="download" type="submit" disabled={loading || !url.trim()}>
                {loading ? t('import.loading') : t('import.analyze')}
              </Button>
            </form>
          ) : (
            <div className="col" style={{ gap: 16 }}>
              <TextField
                label={t('import.textLabel')}
                multiline
                rows={12}
                value={text}
                onChange={setText}
                supporting={t('import.textHint')}
              />
              <div className="row">
                <Button
                  variant="tonal"
                  icon="content_paste"
                  onClick={() => void readClipboard().then((c) => c && setText(c))}
                >
                  {t('import.paste')}
                </Button>
                <Button
                  className="grow"
                  icon="stars"
                  onClick={() => analyzeText(text)}
                  disabled={!text.trim()}
                >
                  {t('import.analyze')}
                </Button>
              </div>
            </div>
          )}
          <AnimatePresence>
            {error && (
              <motion.div
                className="import-error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Icon name="warning" size={20} />
                {t(error)}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </Screen>
  );
}
