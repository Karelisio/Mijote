import { Clipboard } from '@capacitor/clipboard';
import { isNative } from './native';

/**
 * Text on the clipboard: '' when it is empty, null when it cannot be read. The Android WebView
 * refuses navigator.clipboard.readText() (NotAllowedError), so the native plugin is used there.
 */
export async function readClipboardText(): Promise<string | null> {
  if (isNative()) {
    try {
      return (await Clipboard.read()).value ?? '';
    } catch (e) {
      // The plugin rejects an empty clipboard ("There is no data on the clipboard").
      return e instanceof Error && /no data/i.test(e.message) ? '' : null;
    }
  }
  try {
    return (await navigator.clipboard.readText()) ?? '';
  } catch {
    return null;
  }
}
