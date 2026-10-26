import { expect, spyOn, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import plugin, {
  type InspectorContext,
  type NativeEvent,
} from "../plugin/index.ts";
import { openDatabase } from "../plugin/src/db/client.ts";
import { Repository } from "../plugin/src/db/repository.ts";
import type { ContextInput } from "../plugin/src/shared/types.ts";

const tempRoot =
  process.platform === "win32"
    ? join(process.env.LOCALAPPDATA!, "Temp", "opencode")
    : tmpdir();
function context(dataDir: string, port = 0) {
  const hooks = new Map<
    string,
    (event: ContextInput & { result?: unknown }) => void
  >();
  let events: ReadableStreamDefaultController<NativeEvent>;
  const stream = new ReadableStream<NativeEvent>({
    start(controller) {
      events = controller;
    },
  });
  let disposed = 0;
  const ctx: InspectorContext = {
    options: { dataDir, port },
    location: { directory: process.cwd(), project: { id: "project-plugin" } },
    session: {
      async hook(name, callback) {
        hooks.set(name, callback);
        return {
          async dispose() {
            hooks.delete(name);
            disposed++;
          },
        };
      },
    },
    event: {
      subscribe({ signal }) {
        signal.addEventListener("abort", () => events.close(), { once: true });
        return stream;
      },
    },
  };
  return {
    ctx,
    hooks,
    emit: (event: NativeEvent) => events.enqueue(event),
    disposed: () => disposed,
  };
}
const input: ContextInput = {
  sessionID: "plugin-session",
  model: { providerID: "openai", id: "gpt-4o" },
  agent: "build",
  system: [{ type: "text", text: "system instructions" }],
  messages: [
    { role: "user", content: [{ type: "text", text: "user question" }] },
  ],
};

test("V2 setup registers all observation hooks, persists usage, and cleanly releases native DB and HTTP", async () => {
  const dir = await mkdtemp(join(tempRoot, "inspector-plugin-"));
  const fixture = context(dir);
  const info = spyOn(console, "info").mockImplementation(() => {});
  let cleanup: (() => Promise<void>) | undefined;
  try {
    cleanup = await plugin.setup(fixture.ctx);
    expect(typeof cleanup).toBe("function");
    expect(plugin.id).toBe("opencode-usage-dashboard");
    expect([...fixture.hooks.keys()]).toEqual([
      "context",
      "compaction",
      "generate",
      "title",
    ]);
    const line = String(info.mock.calls.at(-1)?.[0]),
      url = line.match(/http:\/\/127\.0\.0\.1:\d+/)![0];
    const draft = structuredClone(input),
      before = JSON.stringify(draft);
    fixture.hooks.get("context")!(draft);
    expect(JSON.stringify(draft)).toBe(before);
    fixture.emit({
      type: "session.step.started",
      data: {
        sessionID: input.sessionID,
        assistantMessageID: "plugin-assistant",
        model: input.model,
        started: Date.now(),
      },
    });
    fixture.emit({
      type: "session.text.ended",
      data: {
        sessionID: input.sessionID,
        assistantMessageID: "plugin-assistant",
        ordinal: 0,
        text: "done",
      },
    });
    fixture.emit({
      type: "session.step.ended",
      data: {
        sessionID: input.sessionID,
        assistantMessageID: "plugin-assistant",
        tokens: {
          input: 10,
          output: 4,
          reasoning: 2,
          cache: { read: 5, write: 1 },
        },
        cost: 0,
      },
    });
    expect((await fetch(url + "/api/health")).status).toBe(200);
    await cleanup!();
    await cleanup!();
    expect(fixture.disposed()).toBe(4);
    await expect(fetch(url + "/api/health")).rejects.toThrow();
    const reopened = await openDatabase(join(dir, "observability.duckdb"));
    try {
      const list = await new Repository(reopened).listRequests();
      expect(list.total).toBe(1);
      expect(list.items[0].status).toBe("success");
      expect(list.items[0].output_tokens).toBe(4);
    } finally {
      await reopened.close();
    }
  } finally {
    await cleanup?.();
    info.mockRestore();
    await rm(dir, { recursive: true, force: true });
  }
});

test("port conflict does not disable capture; failed DB/config setup does not fail OpenCode", async () => {
  const dir = await mkdtemp(join(tempRoot, "inspector-conflict-"));
  const blocker = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response("occupied"),
  });
  const warnings = spyOn(console, "warn").mockImplementation(() => {});
  let cleanup: (() => Promise<void>) | undefined;
  try {
    const fixture = context(dir, blocker.port!);
    cleanup = await plugin.setup(fixture.ctx);
    expect(typeof cleanup).toBe("function");
    expect(warnings).toHaveBeenCalledTimes(1);
    expect(() => fixture.hooks.get("context")!(input)).not.toThrow();
    await cleanup!();
    cleanup = undefined;
    const db = await openDatabase(join(dir, "observability.duckdb"));
    try {
      expect((await new Repository(db).listRequests()).total).toBe(1);
    } finally {
      await db.close();
    }
    warnings.mockClear();
    const broken = context(join(dir, "not-a-directory"));
    await writeFile(String(broken.ctx.options.dataDir), "file");
    expect(await plugin.setup(broken.ctx)).toBeUndefined();
    expect(warnings).toHaveBeenCalledTimes(1);
    expect(broken.hooks.size).toBe(0);
    warnings.mockClear();
    const invalid = context(dir);
    invalid.ctx.options.host = "0.0.0.0";
    expect(await plugin.setup(invalid.ctx)).toBeUndefined();
    expect(warnings).toHaveBeenCalledTimes(1);
    const disabled = context(dir);
    disabled.ctx.options.enabled = false;
    expect(await plugin.setup(disabled.ctx)).toBeUndefined();
    expect(disabled.hooks.size).toBe(0);
  } finally {
    await cleanup?.();
    await blocker.stop(true);
    warnings.mockRestore();
    await rm(dir, { recursive: true, force: true });
  }
});

test("multiple location setups share one writer/server until the final cleanup", async () => {
  const dir = await mkdtemp(join(tempRoot, "inspector-shared-")),
    a = context(dir),
    b = context(dir);
  const info = spyOn(console, "info").mockImplementation(() => {});
  let closeA: (() => Promise<void>) | undefined,
    closeB: (() => Promise<void>) | undefined;
  try {
    const reloaded = (await import(
      new URL("../plugin/index.ts?reload-test=1", import.meta.url).href
    )) as { default: typeof plugin };
    [closeA, closeB] = await Promise.all([
      plugin.setup(a.ctx),
      reloaded.default.setup(b.ctx),
    ]);
    expect(info).toHaveBeenCalledTimes(1);
    const url = String(info.mock.calls[0][0]).match(
      /http:\/\/127\.0\.0\.1:\d+/,
    )![0];
    await closeA!();
    expect((await fetch(url + "/api/health")).status).toBe(200);
    b.hooks.get("context")!(input);
    b.emit({
      id: "event-start",
      type: "session.step.started",
      data: {
        sessionID: input.sessionID,
        assistantMessageID: "surviving-location",
        model: input.model,
        started: Date.now(),
      },
    });
    b.emit({
      id: "event-end",
      type: "session.step.ended",
      data: {
        sessionID: input.sessionID,
        assistantMessageID: "surviving-location",
        tokens: {
          input: 1,
          output: 2,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
        cost: 0,
      },
    });
    await closeB!();
    await expect(fetch(url + "/api/health")).rejects.toThrow();
    const db = await openDatabase(join(dir, "observability.duckdb"));
    try {
      expect((await new Repository(db).listRequests()).items[0].status).toBe(
        "success",
      );
    } finally {
      await db.close();
    }
  } finally {
    await closeA?.();
    await closeB?.();
    info.mockRestore();
    await rm(dir, { recursive: true, force: true });
  }
});

test("partial hook-registration failure cleans up startup resources without throwing", async () => {
  const dir = await mkdtemp(join(tempRoot, "inspector-hook-failure-")),
    fixture = context(dir);
  const info = spyOn(console, "info").mockImplementation(() => {}),
    warn = spyOn(console, "warn").mockImplementation(() => {});
  const hook = fixture.ctx.session.hook;
  fixture.ctx.session.hook = async (name, callback) => {
    if (name === "generate") throw new Error("host registration failed");
    return hook(name, callback);
  };
  try {
    expect(await plugin.setup(fixture.ctx)).toBeUndefined();
    expect(fixture.disposed()).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1);
    const db = await openDatabase(join(dir, "observability.duckdb"));
    await db.close();
  } finally {
    info.mockRestore();
    warn.mockRestore();
    await rm(dir, { recursive: true, force: true });
  }
});
