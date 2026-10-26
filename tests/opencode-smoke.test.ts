import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

// Opt-in: starts a real private OpenCode process, never the user's managed service.
test.skipIf(process.env.OPENCODE_SMOKE !== "1")(
  "real OpenCode V2 loads project config -> local directory -> TypeScript plugin with DuckDB",
  async () => {
    const root = resolve(import.meta.dir, ".."),
      tempRoot =
        process.platform === "win32"
          ? join(process.env.LOCALAPPDATA!, "Temp", "opencode")
          : tmpdir();
    const dir = await mkdtemp(join(tempRoot, "inspector-opencode-smoke-"));
    await mkdir(join(dir, "config"), { recursive: true });
    const password = crypto.randomUUID();
    const command = process.env.OPENCODE_BIN ?? Bun.which("opencode");
    if (!command)
      throw new Error("Set OPENCODE_BIN to the OpenCode executable");
    const child = Bun.spawn(
      [command, "serve", "--stdio", "--hostname", "127.0.0.1", "--port", "0"],
      {
        cwd: root,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          XDG_CONFIG_HOME: join(dir, "config"),
          XDG_DATA_HOME: join(dir, "data"),
          XDG_CACHE_HOME: join(dir, "cache"),
          OPENCODE_PASSWORD: password,
        },
      },
    );
    let output = "",
      errors = "",
      url = "";
    const stdout = (async () => {
      for await (const bytes of child.stdout) {
        output = (output + new TextDecoder().decode(bytes)).slice(-65536);
        const match = output.match(/\{"url":"(http:\/\/127\.0\.0\.1:\d+)"\}/);
        if (match) url = match[1];
      }
    })();
    const stderr = (async () => {
      for await (const bytes of child.stderr)
        errors = (errors + new TextDecoder().decode(bytes)).slice(-65536);
    })();
    const deadline = Date.now() + 30000;
    try {
      const config = Bun.JSONC.parse(
        await Bun.file(join(root, "opencode.jsonc")).text(),
      ) as { plugins: string[] };
      expect(config.plugins).toContain("./plugin");
      while (!url && Date.now() < deadline && child.exitCode === null)
        await Bun.sleep(100);
      if (!url) throw new Error("Private OpenCode did not start: " + errors);
      const headers = {
        Authorization:
          "Basic " + Buffer.from("opencode:" + password).toString("base64"),
      };
      let active = false;
      while (Date.now() < deadline) {
        const response = await fetch(
          url + "/api/plugin?directory=" + encodeURIComponent(root),
          { headers },
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        const plugin = body.data?.find(
          (p: { id?: string }) => p.id === "opencode-usage-dashboard",
        );
        if (plugin?.state.status === "failed")
          throw new Error(
            "OpenCode plugin failed: " + plugin.state.error + " " + errors,
          );
        if (plugin?.state.status === "active") {
          expect(plugin.source.path.replaceAll("\\", "/")).toEndWith(
            "/plugin/index.ts",
          );
          active = true;
          break;
        }
        await Bun.sleep(150);
      }
      expect(active).toBe(true);
      const health = await fetch("http://127.0.0.1:7331/api/health");
      expect(health.status).toBe(200);
      const state = await health.json();
      expect(state.duckdb_version).toMatch(/^v2\.0\./);
      expect(state.dataDir).toStartWith(dir);
      expect(errors).not.toContain("Initialization failed");
    } finally {
      child.stdin.end();
      const timeout = setTimeout(() => child.kill(), 10000);
      try {
        expect(await child.exited).toBe(0);
        await stdout;
        await stderr;
      } finally {
        clearTimeout(timeout);
        await rm(dir, { recursive: true, force: true });
      }
    }
  },
  60000,
);
