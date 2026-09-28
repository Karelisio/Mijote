import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { RawDb, Row, SqlValue } from '../driver';

type Sqlite3 = Awaited<ReturnType<typeof sqlite3InitModule>>;
type OoDb = InstanceType<Sqlite3['oo1']['DB']>;

export interface WasmOptions {
  /** Initial database image (e.g. restored from IndexedDB). */
  bytes?: Uint8Array | null;
  /** Called (debounced by caller) with a fresh image after writes. */
  persist?: (bytes: Uint8Array) => void;
}

let modulePromise: Promise<Sqlite3> | null = null;
function loadModule(): Promise<Sqlite3> {
  modulePromise ??= sqlite3InitModule({ print: () => undefined, printErr: () => undefined } as never);
  return modulePromise;
}

/** SQLite compiled to WebAssembly (with FTS5). Used on the web and in tests. */
export async function openWasmDb(opts: WasmOptions = {}): Promise<RawDb> {
  const sqlite3 = await loadModule();
  const db: OoDb = new sqlite3.oo1.DB(':memory:', 'c');

  if (opts.bytes && opts.bytes.byteLength > 0) {
    const p = sqlite3.wasm.allocFromTypedArray(opts.bytes);
    const rc = sqlite3.capi.sqlite3_deserialize(
      db.pointer!,
      'main',
      p,
      opts.bytes.byteLength,
      opts.bytes.byteLength,
      sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
    );
    if (rc !== 0) throw new Error(`sqlite3_deserialize failed (${rc})`);
  }
  db.exec('PRAGMA foreign_keys = ON;');

  let inTx = false;
  const persist = () => {
    if (!inTx && opts.persist) opts.persist(sqlite3.capi.sqlite3_js_db_export(db.pointer!));
  };

  return {
    async execute(sql) {
      db.exec(sql);
    },
    async run(sql, params = []) {
      db.exec({ sql, bind: params });
    },
    async query<T extends object = Row>(sql: string, params: SqlValue[] = []) {
      return db.selectObjects(sql, params) as T[];
    },
    async begin() {
      db.exec('BEGIN');
      inTx = true;
    },
    async commit() {
      db.exec('COMMIT');
      inTx = false;
    },
    async rollback() {
      inTx = false;
      db.exec('ROLLBACK');
    },
    async close() {
      db.close();
    },
    onWrite: persist,
  };
}
