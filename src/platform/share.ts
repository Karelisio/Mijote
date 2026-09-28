import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { isNative } from './native';
import { blobToBase64 } from './images';

export async function shareText(title: string, text: string): Promise<void> {
  try {
    if (isNative() || (await Share.canShare()).value) {
      await Share.share({ title, text, dialogTitle: title });
      return;
    }
  } catch (e) {
    // User cancelled the share sheet: not an error.
    if (e instanceof Error && /cancel/i.test(e.message)) return;
  }
  await navigator.clipboard?.writeText(text).catch(() => undefined);
}

/** Writes a file to the cache and opens the Android share sheet for it. */
export async function shareFile(opts: {
  blob: Blob;
  fileName: string;
  title: string;
  text?: string;
}): Promise<void> {
  if (!isNative()) {
    const url = URL.createObjectURL(opts.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = opts.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  const path = `share/${opts.fileName}`;
  await Filesystem.writeFile({
    path,
    directory: Directory.Cache,
    data: await blobToBase64(opts.blob),
    recursive: true,
  });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  try {
    await Share.share({ title: opts.title, text: opts.text, files: [uri], dialogTitle: opts.title });
  } catch (e) {
    if (!(e instanceof Error && /cancel/i.test(e.message))) throw e;
  }
}
