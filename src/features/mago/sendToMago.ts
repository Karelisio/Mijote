import { create } from 'zustand';
import { AppLauncher } from '@capacitor/app-launcher';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { MAGO_IMPORT_URL } from '@/config/magoCategories';
import { useSettings } from '@/store/settings';
import { snackbar } from '@/store/snackbar';
import { currentLang, t } from '@/i18n';
import { isNative } from '@/platform/native';
import type { ShoppingDraft } from '@/features/shopping/merge';
import { formatAmount } from '@/features/recipes/format';
import { buildMagoPayload, buildMagoUrl } from './payload';

interface MagoDialogState {
  fallbackText: string | null;
  title: string;
  close: () => void;
}

/** Drives the "Mago is not installed" dialog rendered by <MagoDialogHost />. */
export const useMagoDialog = create<MagoDialogState>((set) => ({
  fallbackText: null,
  title: '',
  close: () => set({ fallbackText: null }),
}));

export function draftsToText(drafts: ShoppingDraft[], title: string): string {
  const lang = currentLang();
  const payload = buildMagoPayload(drafts, { lang });
  const lines = payload.items.map((i) => {
    const amount = formatAmount({ quantity: i.quantity, quantityMax: null, unit: '' }, lang);
    const qty = [amount, i.unit].filter(Boolean).join(' ');
    return `☐ ${qty ? `${qty} ` : ''}${i.name}${i.note ? ` (${i.note})` : ''}`;
  });
  return [`🛒 ${title}`, '', ...lines, '', `— ${t('share.footer')}`].join('\n');
}

async function magoInstalled(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    return (await AppLauncher.canOpenUrl({ url: MAGO_IMPORT_URL })).value;
  } catch {
    return false;
  }
}

/**
 * Sends shopping items to Mago through its mago://import deep link.
 * Duplicates are merged first; falls back to a text share if Mago is absent.
 */
export async function sendToMago(drafts: ShoppingDraft[], title: string): Promise<void> {
  const items = drafts.filter((d) => d.name.trim());
  if (!items.length) {
    snackbar(t('mago.nothingToSend'));
    return;
  }
  const listName = useSettings.getState().magoListName;
  const payload = buildMagoPayload(items, { listName, lang: currentLang() });
  if (await magoInstalled()) {
    const r = await AppLauncher.openUrl({ url: buildMagoUrl(payload) }).catch(() => ({ completed: false }));
    if (r.completed) {
      void Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
      snackbar(t('mago.sent'));
      return;
    }
  }
  useMagoDialog.setState({ fallbackText: draftsToText(items, title), title });
}
