import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Screen } from '@/ui/Screen';
import { Button } from '@/ui/Button';
import { ListItem, Segmented, Switch, LinearProgress } from '@/ui/Controls';
import { BottomSheet } from '@/ui/BottomSheet';
import { ConfirmDialog, PromptDialog } from '@/ui/Dialog';
import { Icon } from '@/ui/Icon';
import { useLang, useT } from '@/i18n';
import { useSettings, type LanguagePref, type ThemeMode } from '@/store/settings';
import { snackbar } from '@/store/snackbar';
import { SEED_PRESETS } from '@/theme/palette';
import { getDynamicSeed, isNative } from '@/platform/native';
import { seedSampleRecipes } from '@/db/seed';
import { db, refreshRecipes } from '@/store/recipes';
import {
  backupNow,
  exportBackup,
  importBackupFile,
  listBackups,
  restoreLocalBackup,
  type LocalBackup,
} from '@/features/backup/backup';

function pickZip(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip,application/octet-stream';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export default function SettingsPage() {
  const t = useT();
  const lang = useLang();
  const s = useSettings();
  const [dynamicAvailable, setDynamicAvailable] = useState(false);
  const [exactDenied, setExactDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [backups, setBackups] = useState<LocalBackup[]>([]);
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingRestore, setPendingRestore] = useState<LocalBackup | null>(null);
  const [magoPrompt, setMagoPrompt] = useState(false);

  useEffect(() => {
    void getDynamicSeed().then((x) => setDynamicAvailable(x !== null));
    if (isNative()) {
      void LocalNotifications.checkExactNotificationSetting()
        .then((r) => setExactDenied(r.exact_alarm !== 'granted'))
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (backupsOpen) void listBackups().then(setBackups);
  }, [backupsOpen]);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) snackbar(ok);
    } catch (e) {
      console.error(e);
      snackbar(
        e instanceof Error && /backup|format|invalid/.test(e.message)
          ? t('settings.importFailed')
          : t('common.error'),
      );
    } finally {
      setBusy(false);
    }
  };

  const fmtDate = (d: Date) =>
    d.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <Screen title={t('settings.title')} large withNav scrollKey="settings">
      {busy && <LinearProgress />}

      <div className="section-title label-large">{t('settings.appearance')}</div>
      <div className="pad col" style={{ gap: 16, paddingBottom: 12 }}>
        <div className="col" style={{ gap: 8 }}>
          <span className="body-large">{t('settings.theme')}</span>
          <Segmented<ThemeMode>
            value={s.theme}
            onChange={(theme) => s.set({ theme })}
            options={[
              { value: 'system', label: t('settings.themeSystem'), icon: 'brightness_auto' },
              { value: 'light', label: t('settings.themeLight'), icon: 'light_mode' },
              { value: 'dark', label: t('settings.themeDark'), icon: 'dark_mode' },
            ]}
          />
        </div>
      </div>
      {dynamicAvailable && (
        <ListItem
          icon="palette"
          headline={t('settings.dynamicColor')}
          supporting={t('settings.dynamicColorHint')}
          onClick={() => s.set({ dynamicColor: !s.dynamicColor })}
          trailing={
            <Switch
              checked={s.dynamicColor}
              label={t('settings.dynamicColor')}
              onChange={(v) => s.set({ dynamicColor: v })}
            />
          }
        />
      )}
      {(!dynamicAvailable || !s.dynamicColor) && (
        <div className="pad col" style={{ gap: 8, paddingBottom: 8 }}>
          <span className="body-large">{t('settings.seedColor')}</span>
          <div className="seed-row">
            {SEED_PRESETS.map((c) => (
              <motion.button
                key={c}
                type="button"
                className={`seed${s.seedColor === c ? ' on' : ''}`}
                style={{ background: c }}
                whileTap={{ scale: 0.9 }}
                aria-label={c}
                onClick={() => s.set({ seedColor: c })}
              >
                {s.seedColor === c && <Icon name="check" size={20} />}
              </motion.button>
            ))}
          </div>
        </div>
      )}
      <div className="pad col" style={{ gap: 8, paddingTop: 8 }}>
        <span className="body-large">{t('settings.language')}</span>
        <Segmented<LanguagePref>
          value={s.language}
          onChange={(language) => {
            s.set({ language });
            document.documentElement.lang = language === 'system' ? lang : language;
          }}
          options={[
            { value: 'system', label: t('settings.themeSystem'), icon: 'language' },
            { value: 'fr', label: 'Français' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>

      <div className="section-title label-large">{t('settings.cooking')}</div>
      <ListItem
        icon="visibility"
        headline={t('settings.keepScreenOn')}
        supporting={t('settings.keepScreenOnHint')}
        onClick={() => s.set({ keepScreenOn: !s.keepScreenOn })}
        trailing={
          <Switch
            checked={s.keepScreenOn}
            label={t('settings.keepScreenOn')}
            onChange={(v) => s.set({ keepScreenOn: v })}
          />
        }
      />
      {isNative() && exactDenied && (
        <ListItem
          icon="notifications"
          headline={t('settings.exactAlarms')}
          supporting={t('settings.exactAlarmsHint')}
          onClick={() => void LocalNotifications.changeExactNotificationSetting().catch(() => undefined)}
          trailing={<Icon name="open_in_new" size={20} />}
        />
      )}

      <div className="section-title label-large">{t('settings.mago')}</div>
      <ListItem
        icon="shopping_basket"
        headline={t('settings.magoList')}
        supporting={s.magoListName || t('settings.magoListHint')}
        onClick={() => setMagoPrompt(true)}
      />

      <div className="section-title label-large">{t('settings.data')}</div>
      <ListItem
        icon="folder_zip"
        headline={t('settings.export')}
        supporting={t('settings.exportHint')}
        onClick={() => void run(exportBackup)}
      />
      <ListItem
        icon="upload"
        headline={t('settings.import')}
        supporting={t('settings.importHint')}
        onClick={() => void pickZip().then((f) => f && setPendingFile(f))}
      />
      <ListItem
        icon="backup"
        headline={t('settings.backups')}
        supporting={t('settings.backupsHint')}
        onClick={() => setBackupsOpen(true)}
      />
      <ListItem
        icon="menu_book"
        headline={t('settings.samples')}
        supporting={t('settings.samplesHint')}
        onClick={() =>
          void run(async () => {
            await seedSampleRecipes(await db(), lang);
            await refreshRecipes();
          }, t('settings.samplesDone'))
        }
      />

      <div className="section-title label-large">{t('settings.about')}</div>
      <div className="about">
        <img src="/favicon.svg" alt="" width={56} height={56} />
        <div>
          <div className="title-large serif">Mijote</div>
          <div className="body-medium muted">{t('settings.version', { version: __APP_VERSION__ })}</div>
          <div className="body-small muted">{t('settings.aboutBody')}</div>
        </div>
      </div>

      <PromptDialog
        open={magoPrompt}
        title={t('settings.magoList')}
        label={t('settings.magoList')}
        initial={s.magoListName}
        confirmLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        onClose={() => setMagoPrompt(false)}
        onSubmit={(v) => s.set({ magoListName: v })}
      />
      <ConfirmDialog
        open={!!pendingFile}
        icon="upload"
        title={t('settings.importConfirmTitle')}
        body={t('settings.importConfirmBody')}
        confirmLabel={t('settings.import')}
        cancelLabel={t('common.cancel')}
        onClose={() => setPendingFile(null)}
        onConfirm={() => {
          const f = pendingFile;
          if (f) void run(() => importBackupFile(f), t('settings.importDone'));
        }}
      />
      <ConfirmDialog
        open={!!pendingRestore}
        icon="settings_backup_restore"
        title={t('settings.restoreConfirmTitle')}
        body={t('settings.importConfirmBody')}
        confirmLabel={t('settings.restore')}
        cancelLabel={t('common.cancel')}
        onClose={() => setPendingRestore(null)}
        onConfirm={() => {
          const b = pendingRestore;
          setBackupsOpen(false);
          if (b) void run(() => restoreLocalBackup(b.path), t('settings.importDone'));
        }}
      />
      <BottomSheet
        open={backupsOpen}
        onClose={() => setBackupsOpen(false)}
        title={t('settings.backups')}
        actions={
          <Button
            icon="backup"
            variant="tonal"
            onClick={() =>
              void run(async () => {
                await backupNow();
                setBackups(await listBackups());
              }, t('settings.backupDone'))
            }
          >
            {t('settings.backupNow')}
          </Button>
        }
      >
        {backups.length === 0 && <p className="pad muted">{t('settings.noBackups')}</p>}
        {backups.map((b) => (
          <ListItem
            key={b.path}
            icon="history"
            headline={fmtDate(b.date)}
            supporting={`${(b.size / 1024 / 1024).toFixed(1)} Mo`}
            onClick={() => setPendingRestore(b)}
            trailing={<span className="label-large primary-text">{t('settings.restore')}</span>}
          />
        ))}
      </BottomSheet>
    </Screen>
  );
}
