import { readFile } from "node:fs/promises";
import type { Database } from "./client.ts";
export async function migrate(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    const exists = await tx.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name='schema_migrations'",
    );
    if (exists.length) {
      const rows = await tx.query(
        "SELECT max(version) AS version FROM schema_migrations",
      );
      if (Number(rows[0].version) !== 1)
        throw new Error("Unsupported schema version");
      return;
    }
    await tx.run(
      await readFile(
        new URL("../../../migrations/001_init.sql", import.meta.url),
        "utf8",
      ),
    );
    await tx.run("INSERT INTO schema_migrations(version) VALUES (1)");
  });
}
