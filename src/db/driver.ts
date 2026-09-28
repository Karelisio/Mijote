export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

/** Minimal SQL surface used by repositories. */
export interface Sql {
  /** Run one or more statements without parameters. */
  execute(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  query<T extends object = Row>(sql: string, params?: SqlValue[]): Promise<T[]>;
}

export interface DbDriver extends Sql {
  /** Runs `fn` inside BEGIN/COMMIT; other callers wait until it completes. */
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
  readonly kind: 'native' | 'wasm';
  close(): Promise<void>;
}

/** Platform adapter: raw, non-serialised operations. */
export interface RawDb extends Sql {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): Promise<void>;
  /** Called after any successful write outside of a transaction, and after commit. */
  onWrite?(): void;
}

/**
 * Wraps a RawDb so every operation is serialised: a transaction can span
 * several awaits without other queries interleaving inside it.
 */
export function createDriver(raw: RawDb, kind: DbDriver['kind']): DbDriver {
  let chain: Promise<unknown> = Promise.resolve();

  function enqueue<T>(op: () => Promise<T>): Promise<T> {
    const next = chain.then(op, op);
    chain = next.catch(() => undefined);
    return next;
  }

  const written = <T>(p: Promise<T>): Promise<T> =>
    p.then((v) => {
      raw.onWrite?.();
      return v;
    });

  return {
    kind,
    execute: (sql) => enqueue(() => written(raw.execute(sql))),
    run: (sql, params) => enqueue(() => written(raw.run(sql, params))),
    query: <T extends object = Row>(sql: string, params?: SqlValue[]) =>
      enqueue(() => raw.query<T>(sql, params)),
    transaction: <T>(fn: (tx: Sql) => Promise<T>) =>
      enqueue(async () => {
        await raw.begin();
        try {
          const result = await fn(raw);
          await raw.commit();
          raw.onWrite?.();
          return result;
        } catch (e) {
          await raw.rollback().catch(() => undefined);
          throw e;
        }
      }),
    close: () => enqueue(() => raw.close()),
  };
}
