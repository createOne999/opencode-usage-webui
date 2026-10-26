import {
  DuckDBInstance,
  DuckDBTypeId,
  type DuckDBConnection,
  type DuckDBValue,
} from "@duckdb/node-api";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
export interface Database {
  query(
    sql: string,
    params?: DuckDBValue[],
  ): Promise<Record<string, unknown>[]>;
  run(sql: string, params?: DuckDBValue[]): Promise<void>;
  transaction<T>(work: (connection: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function openDatabase(path: string): Promise<Database> {
  if (path !== ":memory:") await mkdir(dirname(path), { recursive: true });
  const instance = await DuckDBInstance.create(path);
  let connection: DuckDBConnection;
  try {
    connection = await instance.connect();
  } catch (error) {
    instance.closeSync();
    throw error;
  }
  const direct = {
    query: async (sql: string, params?: DuckDBValue[]) => {
      const reader = await connection.runAndReadAll(sql, params);
      try {
        const rows = reader.getRowObjectsJson() as Record<string, unknown>[];
        const numeric = reader
          .columnNames()
          .filter((_, i) =>
            [
              DuckDBTypeId.BIGINT,
              DuckDBTypeId.UBIGINT,
              DuckDBTypeId.HUGEINT,
              DuckDBTypeId.UHUGEINT,
            ].includes(reader.columnTypeId(i)),
          );
        for (const row of rows)
          for (const key of numeric)
            if (row[key] !== null && Number.isSafeInteger(Number(row[key])))
              row[key] = Number(row[key]);
        return rows;
      } finally {
        reader.closeSync();
      }
    },
    run: async (sql: string, params?: DuckDBValue[]) => {
      (await connection.run(sql, params)).closeSync();
    },
  };
  let tail: Promise<unknown> = Promise.resolve();
  let closed = false;
  const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
    if (closed) return Promise.reject(new Error("Database is closed"));
    const result = tail.then(work);
    tail = result.catch(() => {});
    return result;
  };
  const transaction = async <T>(
    work: (db: Database) => Promise<T>,
  ): Promise<T> => {
    await direct.run("BEGIN TRANSACTION");
    try {
      const result = await work({
        ...direct,
        transaction: async () => {
          throw new Error("Nested transaction");
        },
        close: async () => {
          throw new Error("Cannot close in transaction");
        },
      });
      await direct.run("COMMIT");
      return result;
    } catch (error) {
      await direct.run("ROLLBACK");
      throw error;
    }
  };
  const db: Database = {
    query: (sql, params) => enqueue(() => direct.query(sql, params)),
    run: (sql, params) => enqueue(() => direct.run(sql, params)),
    transaction: (work) => enqueue(() => transaction(work)),
    close: async () => {
      if (closed) return;
      closed = true;
      await tail;
      connection.closeSync();
      instance.closeSync();
    },
  };
  try {
    const version = String(
      (await db.query("SELECT version() AS version"))[0].version,
    );
    if (!/^v2\.0\./.test(version))
      throw new Error(`DuckDB 2.0.x required; got ${version}`);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
