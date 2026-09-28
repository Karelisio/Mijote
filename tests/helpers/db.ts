import { createDriver, type DbDriver } from '@/db/driver';
import { openWasmDb } from '@/db/drivers/wasm';
import { migrate } from '@/db/migrations';

export async function memoryDb(opts: { migrated?: boolean } = {}): Promise<DbDriver> {
  const db = createDriver(await openWasmDb(), 'wasm');
  if (opts.migrated !== false) await migrate(db);
  return db;
}
