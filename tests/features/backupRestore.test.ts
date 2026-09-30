import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listRecipeSummaries } from '@/db/repos/recipes';
import { seedSampleRecipes } from '@/db/seed';
import { memoryDb } from '../helpers/db';

/** In-memory Directory.Data: path → base64 content. */
const files = new Map<string, { data: string; mtime: number }>();
let failWrite: ((path: string) => boolean) | null = null;
let clock = 1_000;

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA', Cache: 'CACHE' },
  Filesystem: {
    readdir: async ({ path }: { path: string }) => ({
      files: [...files.entries()]
        .filter(([p]) => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes('/'))
        .map(([p, f]) => ({
          name: p.slice(path.length + 1),
          type: 'file',
          size: f.data.length,
          mtime: f.mtime,
        })),
    }),
    writeFile: async ({ path, data }: { path: string; data: string }) => {
      if (failWrite?.(path)) throw new Error('No space left on device');
      files.set(path, { data, mtime: clock++ });
    },
    readFile: async ({ path }: { path: string }) => {
      const f = files.get(path);
      if (!f) throw new Error('not found');
      return { data: f.data };
    },
    deleteFile: async ({ path }: { path: string }) => void files.delete(path),
  },
}));

const dbPromise = memoryDb();
vi.mock('@/store/recipes', () => ({ db: () => dbPromise, refreshRecipes: async () => undefined }));

const { backupNow, listBackups, restoreLocalBackup } = await import('@/features/backup/backup');
const { BackupError } = await import('@/features/backup/backupData');

describe('local backups', () => {
  beforeEach(() => {
    files.clear();
    failWrite = null;
  });

  it('keeps five daily backups and never rotates out the pre-restore copy', async () => {
    const db = await dbPromise;
    await seedSampleRecipes(db, 'fr');
    await backupNow();
    await restoreLocalBackup((await listBackups())[0]!.path); // writes the safety copy
    for (let i = 0; i < 6; i++) {
      vi.setSystemTime(new Date(2026, 9, 1, 12, 0, i)); // distinct file names
      await backupNow();
    }
    vi.useRealTimers();
    const list = await listBackups();
    expect(list.filter((b) => b.kind === 'daily')).toHaveLength(5);
    expect(list.filter((b) => b.kind === 'safety')).toHaveLength(1);
  });

  it('does not touch the data when the safety copy cannot be written', async () => {
    const db = await dbPromise;
    await backupNow();
    const [backup] = await listBackups();
    const before = (await listRecipeSummaries(db)).length;
    await seedSampleRecipes(db, 'en'); // changes that the restore would replace
    failWrite = (path) => path.endsWith('mijote-avant-restauration.zip');
    const err = await restoreLocalBackup(backup!.path).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BackupError);
    expect((err as InstanceType<typeof BackupError>).code).toBe('safety_failed');
    expect((await listRecipeSummaries(db)).length).toBe(before + 3);
  });
});
