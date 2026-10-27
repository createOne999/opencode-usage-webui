import { afterEach, describe, expect, test } from "bun:test"
import type { SessionStatsInput } from "@opencode/client"
import { startDashboard, type DashboardClient } from "../server"
import { messages, session, stats } from "./fixtures"

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
    session: { stats: async () => stats, list: async () => ({ data: [session], cursor: {} }), get: async () => session, message: { get: async ({ messageID }) => messages.find((message) => message.id === messageID)! } },
    message: { list: async () => ({ data: messages.toReversed(), cursor: {} }) },
    project: { list: async () => [{ id: "current-project", canonical: "D:/project", time: { created: 1, updated: 1, active: 1 }, sandboxes: [] }] },
  }

  test("serves the usage page, assets, and safe headers on loopback", async () => {
    const server = start(client)
    expect(server.hostname).toBe("127.0.0.1")
    for (const path of ["/", "/stats", "/models", "/tools", "/sessions", "/sessions/ses_example"]) {
      const response = await request(server, path)
      expect(response.status).toBe(200)
      expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'")
      expect(response.headers.get("content-security-policy")).toContain("style-src 'self'")
      const html = await response.text()
      expect(html).toContain('id="root"')
      const source = html.match(/src="([^"]+\.js)"/)?.[1]
      expect(source).toBeDefined()
      expect(source).toStartWith("/")
      expect((await fetch(new URL(source!, new URL(path, server.url)))).status).toBe(200)
      const stylesheet = html.match(/href="([^"]+\.css)"/)?.[1]
      expect(stylesheet).toBeDefined()
      const css = await request(server, stylesheet!)
      expect(css.status).toBe(200)
      expect(css.headers.get("content-type")).toContain("text/css")
      expect(await css.text()).toContain("prefers-reduced-motion")
      expect(html).not.toContain("<style")
    }
    expect((await request(server, "/server.ts")).status).toBe(404)
    expect((await request(server, "/%2e%2e%2fpackage.json")).status).toBe(404)
  })

  test("forwards validated filters and lists projects", async () => {
    const calls: (SessionStatsInput | undefined)[] = []
    const server = start({ ...client, session: { ...client.session, stats: async (input) => { calls.push(input); return stats } } })
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
    const server = start({ ...client, session: { ...client.session, stats: async () => { throw new Error("Bearer secret-token") } } })
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

  test("lists bounded session and timeline pages without conversation bodies or metadata", async () => {
    const calls: unknown[] = []
    const server = start({ ...client, session: { ...client.session, list: async (input) => { calls.push(input); return { data: [session], cursor: { next: "next-session" } } } }, message: { list: async (input) => { calls.push(input); return { data: messages.toReversed(), cursor: { next: "older-messages" } } } } })
    const response = await request(server, "/api/sessions?search=dashboard&parent=ses_parent")
    const text = await response.text()
    expect(text).not.toContain("not-for-the-browser")
    expect(calls[0]).toEqual({ limit: 20, project: "current-project", search: "dashboard", parentID: "ses_parent" })
    await request(server, "/api/sessions?cursor=next-session&project=other&search=ignored")
    expect(calls[1]).toEqual({ limit: 20, cursor: "next-session" })
    const page = await (await request(server, "/api/sessions/ses_example/requests?cursor=older-messages")).json()
    expect(page.data).toHaveLength(3)
    expect(page.data[0].tokens).toBeUndefined()
    expect(page.scanned).toBe(7)
    expect(JSON.stringify(page)).not.toContain("선택 요청의 응답")
    expect(JSON.stringify(page)).not.toContain("provider-native-secret")
    expect(calls[2]).toEqual({ sessionID: session.id, limit: 100, cursor: "older-messages" })
  })

  test("returns only history before the selected request, with its response separate", async () => {
    const server = start(client)
    const response = await request(server, "/api/sessions/ses_example/history?request=msg_selected")
    expect(response.status).toBe(200)
    const page = await response.json()
    expect(page.data.map((message: { id: string }) => message.id)).toEqual(["msg_user", "msg_first", "msg_checkpoint", "msg_instructions"])
    expect(page.response.blocks[0].text).toBe("선택 요청의 응답")
    expect(JSON.stringify(page.data)).toContain("저장된 도구 결과")
    expect(JSON.stringify(page)).not.toContain("미래 메시지")
    expect((await request(server, "/api/sessions/ses_example/history?request=msg_user")).status).toBe(400)
  })

  test("continues history using the upstream cursor and rejects mismatched pages", async () => {
    const server = start({ ...client, message: { list: async ({ cursor }) => ({ data: cursor === "older" ? messages.slice(0, 2).toReversed() : messages.slice(2).toReversed(), cursor: cursor ? {} : { next: "older" } }) } })
    const first = await (await request(server, "/api/sessions/ses_example/history?request=msg_selected")).json()
    expect(first.next).toBe("older")
    const older = await (await request(server, "/api/sessions/ses_example/history?request=msg_selected&cursor=older&older=1")).json()
    expect(older.data.map((message: { id: string }) => message.id)).toEqual(["msg_user", "msg_first"])
    expect((await request(server, "/api/sessions/ses_example/history?request=msg_selected&cursor=older")).status).toBe(409)
    expect((await request(server, "/api/sessions/ses_example/history?request=msg_selected&older=1")).status).toBe(409)
    expect((await request(server, "/api/sessions/ses_example/history?request=msg_selected&cursor=wrong&older=1")).status).toBe(409)
  })

  test("validates all new read boundaries and blocks writes and cross-origin reads", async () => {
    const server = start(client)
    for (const path of ["/api/sessions?parent=invalid", "/api/sessions?search=" + "a".repeat(257), "/api/sessions?cursor=" + "a".repeat(8193), "/api/sessions/ses_example/history", "/api/sessions/ses_example/history?request=invalid"])
      expect((await request(server, path)).status).toBe(400)
    for (const path of ["/api/sessions", "/api/sessions/ses_example/requests", "/api/sessions/ses_example/history?request=msg_selected"]) {
      expect((await request(server, path, { method: "POST" })).status).toBe(405)
      expect((await request(server, path, { headers: { origin: "https://evil.example" } })).status).toBe(403)
    }
    expect((await request(server, "/api/sessions/ses_example/remove")).status).toBe(404)
  })
})
