import { resolve, join } from "node:path";
import type { Database } from "./src/db/client.ts";
import { migrate } from "./src/db/migrations.ts";
import { Repository } from "./src/db/repository.ts";
import { Collector } from "./src/capture/collector.ts";
import { readConfig, type Config } from "./src/shared/config.ts";
import { startServer } from "./src/server/server.ts";
import type { ContextInput, RequestKind } from "./src/shared/types.ts";

export interface NativeEvent {
  id?: string;
  type: string;
  data: Record<string, unknown>;
}

// Public V2 capabilities used here, structurally typed to avoid a runtime SDK dependency.
export interface InspectorContext {
  options: Record<string, unknown>;
  location: { directory: string; project: { id: string } };
  session: {
    hook(
      name: RequestKind | "context",
      callback: (event: ContextInput & { result?: unknown }) => void,
    ): Promise<{ dispose(): Promise<void> }>;
  };
  event: {
    subscribe(options: { signal: AbortSignal }): AsyncIterable<NativeEvent>;
  };
}
interface Runtime {
  db: Database;
  collector: Collector;
  server?: ReturnType<typeof startServer>;
  retention: ReturnType<typeof setInterval>;
  seen: Set<string>;
  references: number;
}
// OpenCode invalidates local ESM caches per location/reload; the writer must remain process-global.
const runtimeKey = Symbol.for("opencode-usage-dashboard.runtimes.v1");
const shared = globalThis as typeof globalThis & {
  [runtimeKey]?: Map<string, Promise<Runtime>>;
};
const runtimes = (shared[runtimeKey] ??= new Map<string, Promise<Runtime>>());

async function createRuntime(
  config: Config,
  warn: (message: string) => void,
): Promise<Runtime> {
  const { openDatabase } = await import("./src/db/client.ts");
  const db = await openDatabase(join(config.dataDir, "observability.duckdb"));
  try {
    await migrate(db);
    const repository = new Repository(db),
      collector = new Collector(repository, config, warn);
    await collector.deleteData({ olderThanDays: config.retention.days });
    let server: ReturnType<typeof startServer> | undefined;
    try {
      server = startServer(repository, collector, config);
    } catch {
      warn("Local UI could not bind; request capture remains active");
    }
    const retention = setInterval(() => {
      void collector
        .deleteData({ olderThanDays: config.retention.days })
        .catch(() => warn("Retention cleanup failed"));
    }, 86400000);
    retention.unref();
    if (server)
      console.info(
        `[opencode-usage-dashboard] http://127.0.0.1:${server.port}`,
      );
    return { db, collector, server, retention, references: 0, seen: new Set() };
  } catch (error) {
    await db.close();
    throw error;
  }
}

export default {
  id: "opencode-usage-dashboard",
  async setup(context: InspectorContext) {
    let warned = false;
    const warn = (message: string) => {
      if (warned) return;
      warned = true;
      try {
        console.warn(`[opencode-usage-dashboard] ${message}`);
      } catch {}
    };
    const registrations: { dispose(): Promise<void> }[] = [];
    let runtime: Runtime | undefined,
      key: string | undefined,
      cleaned = false;
    const controller = new AbortController();
    let events: Promise<void> = Promise.resolve();
    const cleanup = async () => {
      if (cleaned) return;
      cleaned = true;
      for (const registration of registrations) {
        try {
          await registration.dispose();
        } catch {
          warn("Hook disposal failed");
        }
      }
      controller.abort();
      await events;
      if (!runtime || !key) return;
      runtime.references--;
      if (runtime.references) return;
      runtimes.delete(key);
      clearInterval(runtime.retention);
      try {
        await runtime.server?.stop(true);
      } catch {
        warn("Local UI shutdown failed");
      }
      try {
        await runtime.collector.close();
      } catch {
        warn("Capture shutdown failed");
      }
      try {
        await runtime.db.close();
      } catch {
        warn("Database shutdown failed");
      }
    };
    try {
      const config = readConfig(context.options);
      if (!config.enabled) return;
      key = resolve(config.dataDir);
      let pending = runtimes.get(key);
      const existing = Boolean(pending);
      if (!pending) {
        pending = createRuntime(config, warn);
        runtimes.set(key, pending);
        pending.catch(() => {
          if (runtimes.get(key!) === pending) runtimes.delete(key!);
        });
      }
      runtime = await pending;
      runtime.references++;
      if (existing) {
        const port = config.port || runtime.server?.port || 0;
        try {
          await runtime.server?.stop(true);
        } catch {
          warn("Local UI shutdown failed");
        }
        try {
          runtime.server = startServer(
            new Repository(runtime.db),
            runtime.collector,
            { ...config, port },
          );
        } catch {
          runtime.server = undefined;
          warn("Local UI could not bind; request capture remains active");
        }
      }
      const owner = runtime;
      // OpenCode scopes each event iterator to its plugin instance; surviving locations need their own iterator.
      events = (async () => {
        try {
          for await (const event of context.event.subscribe({
            signal: controller.signal,
          })) {
            if (event.id) {
              if (owner.seen.has(event.id)) continue;
              owner.seen.add(event.id);
              if (owner.seen.size > 8192)
                owner.seen.delete(owner.seen.values().next().value!);
            }
            owner.collector.event({ type: event.type, properties: event.data });
          }
        } catch {
          if (!controller.signal.aborted)
            warn("Event subscription failed; OpenCode continues");
        }
      })();
      for (const name of [
        "context",
        "compaction",
        "generate",
        "title",
      ] as const) {
        const owner = runtime;
        registrations.push(
          await context.session.hook(name, (event) => {
            if (event.result !== undefined) return;
            owner.collector.context(
              event,
              name === "context" ? "primary" : name,
              context.location.project.id,
            );
          }),
        );
      }
      return cleanup;
    } catch {
      warn(
        "Initialization failed; observability disabled and OpenCode continues",
      );
      await cleanup();
    }
  },
};
