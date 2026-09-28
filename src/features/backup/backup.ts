import JSZip from 'jszip';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { db, refreshRecipes } from '@/store/recipes';
import { getMeta, setMeta } from '@/db/meta';
import { readImageBase64, writeImageBase64 } from '@/platform/images';
import { shareFile } from '@/platform/share';
import { useShopping } from '@/features/shopping/store';
import { buildBackupZip, collectBackupData, readBackupZip, restoreBackupData } from './backupData';

const BACKUP_DIR = 'backups';
const KEEP = 5;
const DAY = 24 * 3600 * 1000;

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function createZip(): Promise<JSZip> {
  const d = await db();
  const data = await collectBackupData(d);
  const images = new Map<string, string>();
  for (const r of data.recipes) {
    if (!r.photo || images.has(r.photo)) continue;
    try {
      images.set(r.photo, await readImageBase64(r.photo));
    } catch {
      // missing file: exported without photo
    }
  }
  return buildBackupZip(data, images);
}

/** Exports everything as a .zip and opens the share sheet (Drive, Files…). */
export async function exportBackup(): Promise<void> {
  const zip = await createZip();
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/zip' });
  await shareFile({ blob, fileName: `mijote-${stamp()}.zip`, title: 'Mijote' });
}

export interface LocalBackup {
  path: string;
  name: string;
  date: Date;
  size: number;
}

export async function listBackups(): Promise<LocalBackup[]> {
  try {
    const r = await Filesystem.readdir({ path: BACKUP_DIR, directory: Directory.Data });
    return r.files
      .filter((f) => f.name.endsWith('.zip'))
      .map((f) => ({
        path: `${BACKUP_DIR}/${f.name}`,
        name: f.name,
        date: new Date(f.mtime ?? 0),
        size: f.size ?? 0,
      }))
      .sort((a, b) => b.name.localeCompare(a.name));
  } catch {
    return [];
  }
}

/** Writes a local backup and keeps the most recent five. */
export async function backupNow(): Promise<void> {
  const zip = await createZip();
  const data = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  await Filesystem.writeFile({
    path: `${BACKUP_DIR}/mijote-${stamp()}.zip`,
    directory: Directory.Data,
    data,
    recursive: true,
  });
  const all = await listBackups();
  for (const old of all.slice(KEEP)) {
    await Filesystem.deleteFile({ path: old.path, directory: Directory.Data }).catch(() => undefined);
  }
  await setMeta(await db(), 'lastBackupAt', String(Date.now()));
}

/** Daily automatic backup, skipped when the cookbook is empty. */
export async function runAutoBackup(): Promise<boolean> {
  const d = await db();
  const last = Number((await getMeta(d, 'lastBackupAt')) ?? 0);
  if (Date.now() - last < DAY) return false;
  const [{ n }] = (await d.query<{ n: number }>('SELECT COUNT(*) AS n FROM recipes')) as [{ n: number }];
  if (!Number(n)) return false;
  await backupNow();
  return true;
}

async function restoreZip(zip: JSZip): Promise<void> {
  const { data, images } = await readBackupZip(zip);
  // Safety net: snapshot current data before replacing it.
  await backupNow().catch(() => undefined);
  for (const [path, b64] of images) await writeImageBase64(path, b64);
  await restoreBackupData(await db(), data);
  await refreshRecipes();
  await useShopping.getState().load();
}

export async function importBackupFile(file: Blob): Promise<void> {
  await restoreZip(await JSZip.loadAsync(file));
}

export async function restoreLocalBackup(path: string): Promise<void> {
  const r = await Filesystem.readFile({ path, directory: Directory.Data });
  const zip =
    typeof r.data === 'string'
      ? await JSZip.loadAsync(r.data, { base64: true })
      : await JSZip.loadAsync(r.data);
  await restoreZip(zip);
}
