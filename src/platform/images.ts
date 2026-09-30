import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { newId } from '@/lib/id';

export const IMAGE_DIR = 'images';

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function base64ToBlob(b64: string, type = 'image/jpeg'): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Downscales to `max` px on the longest side and re-encodes as JPEG. */
export async function compressImage(blob: Blob, max = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality),
  );
}

/** Compresses and stores an image; returns its relative path. */
export async function saveImage(blob: Blob, compress = true): Promise<string> {
  const data = compress ? await compressImage(blob) : blob;
  const path = `${IMAGE_DIR}/${newId()}.jpg`;
  await Filesystem.writeFile({
    path,
    directory: Directory.Data,
    data: await blobToBase64(data),
    recursive: true,
  });
  return path;
}

export async function writeImageBase64(path: string, base64: string): Promise<void> {
  await Filesystem.writeFile({ path, directory: Directory.Data, data: base64, recursive: true });
}

export async function readImageBase64(path: string): Promise<string> {
  const r = await Filesystem.readFile({ path, directory: Directory.Data });
  return typeof r.data === 'string' ? r.data : blobToBase64(r.data);
}

const urlCache = new Map<string, string>();

/** Displayable URL for a stored image (native file URL, or object URL on web). */
export async function imageUrl(path: string): Promise<string> {
  const cached = urlCache.get(path);
  if (cached) return cached;
  let url: string;
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Data });
    url = Capacitor.convertFileSrc(uri);
  } else {
    url = URL.createObjectURL(base64ToBlob(await readImageBase64(path)));
  }
  urlCache.set(path, url);
  return url;
}

export async function deleteImage(path: string): Promise<void> {
  urlCache.delete(path);
  await Filesystem.deleteFile({ path, directory: Directory.Data }).catch(() => undefined);
}

export interface StoredImage {
  path: string;
  /** Last modification time in ms, 0 when unknown. */
  mtime: number;
}

export async function listImages(): Promise<StoredImage[]> {
  try {
    const r = await Filesystem.readdir({ path: IMAGE_DIR, directory: Directory.Data });
    return r.files
      .filter((f) => f.type === 'file')
      .map((f) => ({ path: `${IMAGE_DIR}/${f.name}`, mtime: f.mtime ?? 0 }));
  } catch {
    return [];
  }
}

/**
 * Photos are written before their recipe is saved (import review, editor photo pick, backup
 * restore), so a recent unreferenced file may still be about to be used.
 */
export const ORPHAN_GRACE_MS = 24 * 3600 * 1000;

/** Images safe to delete: unreferenced and older than the grace period (unknown mtime: kept). */
export function selectOrphanImages(images: StoredImage[], referenced: string[], now: number): string[] {
  const keep = new Set(referenced);
  return images
    .filter((img) => !keep.has(img.path) && img.mtime > 0 && now - img.mtime > ORPHAN_GRACE_MS)
    .map((img) => img.path);
}

/** Deletes stored images no longer referenced by any recipe (see `selectOrphanImages`). */
export async function collectOrphanImages(referenced: string[]): Promise<number> {
  const orphans = selectOrphanImages(await listImages(), referenced, Date.now());
  await Promise.all(orphans.map(deleteImage));
  return orphans.length;
}
