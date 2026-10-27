import { afterEach, describe, expect, test } from "bun:test"
import type { SessionStatsInput } from "@opencode/client"
import { startDashboard, type DashboardClient } from "../server"
import { stats } from "./fixtures"

describe("read-only dashboard server", () => {
  const servers: ReturnType<typeof startDashboard>[] = []
  afterEach(() => { servers.splice(0).forEach((server) => server.stop(true)) })
  function start(client?: DashboardClient) {
    const server = startDashboard({
      port: 0, directory: "D:/project", projectID: "current-project",
      connect: async () => client,
    })
    servers.push(server)
    return server
  }
  function request(server: ReturnType<typeof startDashboard>, path: string, init?: RequestInit) {
    return fetch(new URL(path, server.url), { ...init, headers: { "x-dashboard-request": "1", ...init?.headers } })
  }
  const client: DashboardClient = {
    session: { stats: async () => stats },
    project: { list: async () => [{ id: "current-project", canonical: "D:/project", time: { created: 1, updated: 1, active: 1 }, sandboxes: [] }] },
  }

  test("serves the usage page, assets, and safe headers on loopback", async () => {
    const server = start(client)
    expect(server.hostname).toBe("127.0.0.1")
    for (const path of ["/", "/stats"]) {
      const response = await request(server, path)
      expect(response.status).toBe(200)
      expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'")
      const html = await response.text()
      expect(html).toContain('id="root"')
      const source = html.match(/src="([^"]+\.js)"/)?.[1]
      expect(source).toBeDefined()
      expect((await request(server, source!)).status).toBe(200)
    }
    expect((await request(server, "/server.ts")).status).toBe(404)
    expect((await request(server, "/%2e%2e%2fpackage.json")).status).toBe(404)
  })

  test("forwards validated filters and lists projects", async () => {
    const calls: (SessionStatsInput | undefined)[] = []
    const server = start({ ...client, session: { stats: async (input) => { calls.push(input); return stats } } })
    expect(await (await request(server, "/api/stats?from=100&to=200&timezone=Asia%2FSeoul")).json()).toEqual(stats)
    expect(calls[0]).toEqual({ from: 100, to: 200, timezone: "Asia/Seoul", project: "current-project", tools: "detail" })
    await request(server, "/api/stats?project=all")
    expect(calls[1]?.project).toBeUndefined()
    await request(server, "/api/stats?project=other")
    expect(calls[2]?.project).toBe("other")
    const projects = await (await request(server, "/api/projects")).json()
    expect(projects).toEqual({ current: "current-project", directory: "D:/project", projects: [{ id: "current-project", canonical: "D:/project" }] })
  })

  test("returns 404 for removed limits routes without connecting upstream", async () => {
    const server = startDashboard({ port: 0, directory: "D:/project", projectID: "current-project", connect: async () => { throw new Error("must not connect") } })
    servers.push(server)
    for (const path of ["/limits", "/api/limits"]) expect((await request(server, path)).status).toBe(404)
  })

  test("rejects invalid ranges, timezones, writes, and unknown API routes", async () => {
    const server = start(client)
    for (const query of ["from=nope", "from=", "from=-1", "from=1.5", "from=200&to=100", "timezone=invalid-zone", "to=999999999999999999"]) {
      expect((await request(server, `/api/stats?${query}`)).status).toBe(400)
    }
    expect((await request(server, "/api/stats", { method: "POST" })).status).toBe(405)
    expect((await request(server, "/api/credential")).status).toBe(404)
  })

  test("blocks cross-origin access and DNS rebinding without enabling CORS", async () => {
    const server = start(client)
    expect((await fetch(new URL("/api/stats", server.url))).status).toBe(403)
    for (const [name, value] of [["origin", "https://evil.example"], ["host", "evil.example"], ["sec-fetch-site", "cross-site"]]) {
      const response = await request(server, "/api/stats", { headers: { [name!]: value! } })
      expect(response.status).toBe(403)
      expect(response.headers.get("access-control-allow-origin")).toBeNull()
    }
    expect((await request(server, "/api/stats", { method: "OPTIONS", headers: { origin: "https://evil.example" } })).status).toBe(403)
  })

  test("reports unavailable services and never exposes upstream secrets", async () => {
    expect((await request(start(), "/api/stats")).status).toBe(503)
    const server = start({ ...client, session: { stats: async () => { throw new Error("Bearer secret-token") } } })
    const response = await request(server, "/api/stats")
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain("secret-token")
  })

  test("cleanup releases the listener", async () => {
    const server = start(client)
    const port = server.port!
    await server.stop(true)
    const replacement = Bun.serve({ hostname: "127.0.0.1", port, fetch: () => new Response("ok") })
    try { expect(replacement.port).toBe(port) } finally { await replacement.stop(true) }
  })
})
