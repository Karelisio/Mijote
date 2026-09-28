import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { RawDb, Row, SqlValue } from '../driver';

const DB_NAME = 'mijote';

/** Android: @capacitor-community/sqlite (SQLCipher build, FTS5 enabled). */
export async function openNativeDb(): Promise<RawDb> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const consistency = await sqlite.checkConnectionsConsistency();
  const exists = (await sqlite.isConnection(DB_NAME, false)).result;
  let conn: SQLiteDBConnection;
  if (consistency.result && exists) {
    conn = await sqlite.retrieveConnection(DB_NAME, false);
  } else {
    conn = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  }
  if (!(await conn.isDBOpen()).result) await conn.open();
  await conn.execute('PRAGMA foreign_keys = ON;', false);

  return {
    async execute(sql) {
      await conn.execute(sql, false);
    },
    async run(sql, params: SqlValue[] = []) {
      await conn.run(sql, params, false);
    },
    async query<T extends object = Row>(sql: string, params: SqlValue[] = []) {
      const res = await conn.query(sql, params);
      return (res.values ?? []) as T[];
    },
    async begin() {
      await conn.beginTransaction();
    },
    async commit() {
      await conn.commitTransaction();
    },
    async rollback() {
      await conn.rollbackTransaction();
    },
    async close() {
      await sqlite.closeConnection(DB_NAME, false);
    },
  };
}
