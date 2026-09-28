import { Dialog } from '@/ui/Dialog';
import { Button } from '@/ui/Button';
import { useT } from '@/i18n';
import { shareText } from '@/platform/share';
import { useMagoDialog } from './sendToMago';

export function MagoDialogHost() {
  const t = useT();
  const { fallbackText, title, close } = useMagoDialog();
  return (
    <Dialog
      open={fallbackText !== null}
      onClose={close}
      icon="shopping_basket"
      title={t('mago.notInstalledTitle')}
      actions={
        <>
          <Button variant="text" onClick={close}>
            {t('common.close')}
          </Button>
          <Button
            variant="text"
            icon="share"
            onClick={() => {
              const text = fallbackText ?? '';
              close();
              void shareText(title, text);
            }}
          >
            {t('mago.shareInstead')}
          </Button>
        </>
      }
    >
      {t('mago.notInstalledBody')}
    </Dialog>
  );
}
