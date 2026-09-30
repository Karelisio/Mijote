import { useEffect } from 'react';
import { Dialog } from '@/ui/Dialog';
import { Button } from '@/ui/Button';
import { LinearProgress } from '@/ui/Controls';
import { useT } from '@/i18n';
import { useUpdate } from './update';

/** "New version available" dialog, including the install-permission and download steps. */
export function UpdateDialogHost() {
  const t = useT();
  const {
    prompt,
    latest,
    installed,
    status,
    progress,
    needsPermission,
    init,
    install,
    dismiss,
    openPermissionSettings,
  } = useUpdate();

  useEffect(() => {
    void init();
  }, [init]);

  const downloading = status === 'downloading';
  const sizeMb = latest?.apkSize ? ` · ${(latest.apkSize / 1024 / 1024).toFixed(1)} Mo` : '';

  return (
    <Dialog
      open={prompt && !!latest}
      onClose={downloading ? () => undefined : dismiss}
      icon="download"
      title={
        needsPermission
          ? t('update.permissionTitle')
          : t('update.availableTitle', { version: latest?.version ?? '' })
      }
      actions={
        needsPermission ? (
          <>
            <Button variant="text" onClick={dismiss}>
              {t('common.cancel')}
            </Button>
            <Button variant="text" onClick={openPermissionSettings}>
              {t('update.openSettings')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="text" onClick={dismiss} disabled={downloading}>
              {t('update.later')}
            </Button>
            <Button variant="text" onClick={() => void install()} disabled={downloading}>
              {downloading ? t('update.downloading', { percent: progress }) : t('update.install')}
            </Button>
          </>
        )
      }
    >
      {needsPermission ? (
        t('update.permissionBody')
      ) : (
        <>
          <p style={{ margin: '0 0 8px' }}>
            {t('update.availableBody', { current: installed })}
            {sizeMb}
          </p>
          {latest?.notes && <pre className="update-notes selectable">{latest.notes}</pre>}
          {downloading && (
            <div style={{ marginTop: 12 }}>
              {progress > 0 ? (
                <div className="linear-progress">
                  <div style={{ width: `${progress}%`, animation: 'none', transition: 'width 200ms' }} />
                </div>
              ) : (
                <LinearProgress />
              )}
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
