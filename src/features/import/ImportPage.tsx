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
import { readClipboardText } from '@/platform/clipboard';
import { snackbar } from '@/store/snackbar';
import { usePendingImport } from './pendingImport';

type Mode = 'url' | 'text';

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
  // The share being handled: a new share while the page is open (e.g. after a network error) is
  // a new object and is analysed too; StrictMode's second effect run sees the same one.
  const handledShare = useRef<object | null>(null);
  // The analysis in progress: a new one cancels it, and its result is dropped once the user has
  // left the page (it used to open the review screen anyway).
  const analysis = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const stillHere = (ctrl: AbortController) =>
    !ctrl.signal.aborted && mounted.current && window.location.pathname === '/import';

  /** Pastes the clipboard into a field, or says why nothing was pasted. */
  const paste = async (apply: (text: string) => void) => {
    const text = await readClipboardText();
    if (text === null) snackbar(t('import.pasteFailed'));
    else if (!text.trim()) snackbar(t('import.clipboardEmpty'));
    else apply(text);
  };

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
    analysis.current?.abort();
    const ctrl = new AbortController();
    analysis.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const recipe = await importFromUrl(target, { signal: ctrl.signal });
      if (stillHere(ctrl)) done(recipe);
    } catch (e) {
      if (!stillHere(ctrl)) return;
      const code = e instanceof Error ? e.message : '';
      setError(
        code === 'no_recipe'
          ? 'import.errorNoRecipe'
          : code === 'insecure_http'
            ? 'import.errorInsecure'
            : code === 'timeout'
              ? 'import.errorTimeout'
              : 'import.errorNetwork',
      );
    } finally {
      if (analysis.current === ctrl) {
        analysis.current = null;
        if (mounted.current) setLoading(false);
      }
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
    if (!shared || handledShare.current === shared) return;
    handledShare.current = shared;
    setShared(null);
    setError(null);
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
                    onClick={() => void paste((c) => setUrl(normalizeUrl(c) ?? c.trim()))}
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
                <Button variant="tonal" icon="content_paste" onClick={() => void paste(setText)}>
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
