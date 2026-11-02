import { afterEach, describe, expect, spyOn, test } from "bun:test"
import plugin from "../index"
import type { DashboardStatus } from "../rpc"

type Command = { name: string; description?: string; execute: () => Promise<void> }
type SetupContext = Parameters<typeof plugin.setup>[0]

function harness(port: unknown, failCommand = false, failRpc = false) {
  const commands: Command[] = []
  let definition: unknown
  let status: (() => Promise<DashboardStatus>) | undefined
  const context = {
    options: { port },
    location: { directory: "D:/project", project: { id: "current-project" } },
    command: {
      async transform(callback: (editor: { add(definition: Command): void }) => void) {
        if (failCommand) throw new Error("registration failed")
        callback({ add: (definition) => commands.push(definition) })
        return { dispose: async () => {} }
      },
    },
    rpc: {
      async register(value: unknown, handlers: { info: () => Promise<DashboardStatus> }) {
        if (failRpc) throw new Error("RPC registration failed")
        definition = value
        status = handlers.info
        return { dispose: async () => {}, events: { emit: async () => {} } }
      },
    },
  }
  return {
    commands,
    definition: () => definition,
    readStatus: async () => {
      if (!status) throw new Error("RPC status was not registered")
      return status()
    },
    setup: () => plugin.setup(context as unknown as SetupContext),
  }
}

describe("plugin entrypoint", () => {
  const cleanups: (() => Promise<void> | void)[] = []
  afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup() })

  test("registers the command and RPC with the actual server URL", async () => {
    const app = harness(0)
    const cleanup = await app.setup()
    if (cleanup) cleanups.push(cleanup)

    expect(app.commands).toHaveLength(1)
    expect(app.commands[0]).toMatchObject({ name: "usage-dashboard" })
    expect(app.commands[0]!.description).toBeString()
    expect(app.definition()).toMatchObject({
      id: "local.usage-dashboard",
      methods: { info: { input: { additionalProperties: false }, output: { additionalProperties: false, required: ["url", "ready"] } } },
    })

    const status = await app.readStatus()
    expect(status.ready).toBe(true)
    expect(status.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/stats$/)
    expect((await fetch(status.url)).status).toBe(200)

    const bundled = (await import(new URL("../dist/index.js", import.meta.url).href)).default as typeof plugin
    const builtCleanup = await bundled.setup({ ...({ options: { port: 0 }, location: { directory: "D:/project", project: { id: "current-project" } }, command: { transform: async () => ({ dispose: async () => {} }) }, rpc: { register: async (_value: unknown, handlers: { info: () => Promise<DashboardStatus> }) => { expect((await (await fetch((await handlers.info()).url)).text())).toContain('id="root"'); return { dispose: async () => {}, events: { emit: async () => {} } } } } }) } as unknown as SetupContext)
    if (builtCleanup) cleanups.push(builtCleanup)
  })

  test("keeps the command and RPC available when the port is occupied", async () => {
    const occupied = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("occupied") })
    try {
      const app = harness(occupied.port)
      const cleanup = await app.setup()
      if (cleanup) cleanups.push(cleanup)

      expect(app.commands[0]?.name).toBe("usage-dashboard")
      const status = await app.readStatus()
      expect(status).toEqual({
        url: `http://127.0.0.1:${occupied.port}/stats`,
        ready: false,
        error: { code: "portInUse", message: expect.any(String) },
      })
      expect(status.error?.message).toContain("options.port")
      const spawn = spyOn(Bun, "spawn").mockImplementation(() => { throw new Error("must not spawn") })
      try {
        await expect(app.commands[0]!.execute()).rejects.toThrow("options.port")
        expect(spawn).not.toHaveBeenCalled()
      } finally { spawn.mockRestore() }
    } finally {
      await occupied.stop(true)
    }
  })

  test("cleanup releases the listener", async () => {
    const app = harness(0)
    const cleanup = await app.setup()
    const port = Number(new URL((await app.readStatus()).url).port)
    await cleanup?.()

    for (const hostname of ["127.0.0.1", "::1"]) {
      const replacement = Bun.serve({ hostname, port, fetch: () => new Response("ok") })
      try { expect(replacement.port).toBe(port) } finally { await replacement.stop(true) }
    }
  })

  test("closes the listener when command registration fails", async () => {
    const probe = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("probe") })
    const port = probe.port!
    await probe.stop(true)

    for (const failCommand of [true, false]) {
      await expect(harness(port, failCommand, !failCommand).setup()).rejects.toThrow("registration failed")
      for (const hostname of ["127.0.0.1", "::1"]) {
        const replacement = Bun.serve({ hostname, port, fetch: () => new Response("ok") })
        try { expect(replacement.port).toBe(port) } finally { await replacement.stop(true) }
      }
    }
  })

  test("opens only on command execution and reports sanitized failures to the client", async () => {
    const spawn = spyOn(Bun, "spawn").mockImplementation(() => ({ exited: Promise.resolve(0) }) as ReturnType<typeof Bun.spawn>)
    try {
      const app = harness(0)
      const cleanup = await app.setup()
      if (cleanup) cleanups.push(cleanup)
      expect(spawn).not.toHaveBeenCalled()
      const { url } = await app.readStatus()
      await app.commands[0]!.execute()
      const executable = process.platform === "win32" ? "rundll32" : process.platform === "darwin" ? "open" : "xdg-open"
      const command = process.platform === "win32" ? [executable, "url.dll,FileProtocolHandler", url] : [executable, url]
      expect(spawn).toHaveBeenCalledWith(command, { stdin: "ignore", stdout: "ignore", stderr: "ignore" })

      spawn.mockImplementation(() => ({ exited: Promise.resolve(1) }) as ReturnType<typeof Bun.spawn>)
      await expect(app.commands[0]!.execute()).rejects.toThrow(url)
      spawn.mockImplementation(() => { throw new Error("Bearer secret-token") })
      const error = await app.commands[0]!.execute().catch((error: Error) => error)
      expect(error).toBeInstanceOf(Error)
      expect(String(error)).toContain(url)
      expect(String(error)).not.toContain("secret-token")
    } finally { spawn.mockRestore() }
  })

  test("reports a missing build and recovers after the build becomes available", async () => {
    const app = harness(0)
    const cleanup = await app.setup()
    if (cleanup) cleanups.push(cleanup)
    const file = spyOn(Bun, "file").mockImplementation(() => ({ exists: async () => false }) as Bun.BunFile)
    try {
      const status = await app.readStatus()
      expect(status.ready).toBe(false)
      expect(status.error?.code).toBe("missingBuild")
      expect(status.error?.message).toContain("@createone999/opencode-usage-webui")
    } finally { file.mockRestore() }
    expect((await app.readStatus()).ready).toBe(true)
  })

  test("rejects invalid port options before registering", async () => {
    const wrongType = harness("7331")
    await expect(wrongType.setup()).rejects.toThrow("Dashboard port must be a number")
    for (const port of [-1, 70000, 1.5]) {
      const app = harness(port)
      await expect(app.setup()).rejects.toThrow()
      expect(app.commands).toHaveLength(0)
      expect(app.definition()).toBeUndefined()
    }
  })
})
