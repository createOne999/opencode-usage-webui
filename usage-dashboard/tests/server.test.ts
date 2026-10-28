import { afterEach, describe, expect, spyOn, test } from "bun:test"
import type { SessionStatsInput } from "@opencode/client"
import { startDashboard, type DashboardClient } from "../server"
import { messages, session, stats } from "./fixtures"

describe("read-only dashboard server", () => {
  const servers: ReturnType<typeof startDashboard>[] = []
  afterEach(async () => { await Promise.all(servers.splice(0).map((server) => server.stop(true))) })
  function start(client?: DashboardClient, projectID = "current-project") {
    const server = startDashboard({
      port: 0, directory: "D:/project", projectID,
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
    await request(server, "/api/stats?from=100&to=200&tools=none")
    expect(calls[3]).toEqual({ from: 100, to: 200, timezone: "UTC", project: "current-project", tools: "none" })
    await request(server, "/api/stats?tools=summary")
    expect(calls[4]?.tools).toBe("summary")
    expect((await request(server, "/api/stats?tools=invalid")).status).toBe(400)
    expect((await request(server, "/api/stats?tools=")).status).toBe(400)
    expect(calls).toHaveLength(5)
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

  test("serves IPv4, localhost, and IPv6 on the same actual ephemeral port", async () => {
    const server = start(client)
    expect(server.url).toBeInstanceOf(URL)
    expect(server.port).toBeGreaterThan(0)
    expect(server.url.port).toBe(String(server.port))
    expect(server.hostname).toBe("127.0.0.1")
    for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
      const origin = `http://${host}:${server.port}`
      const response = await fetch(`${origin}/api/stats`, { headers: { origin, "x-dashboard-request": "1" } })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(stats)
      expect(response.headers.get("access-control-allow-origin")).toBeNull()
    }
  })

  test("requires exact same-authority origins for every alias before connecting upstream", async () => {
    let connections = 0
    const server = startDashboard({ port: 0, directory: "D:/project", projectID: "current-project", connect: async () => { connections++; return client } })
    servers.push(server)
    const authorities = ["127.0.0.1", "localhost", "[::1]"].map((host) => `${host}:${server.port}`)
    const otherPort = server.port === 65535 ? 65534 : server.port! + 1
    const denied = async (headers: Record<string, string>, method = "GET", status = 403) => {
      const before = connections
      const response = await request(server, "/api/stats", { headers, method })
      expect(response.status).toBe(status)
      expect(response.headers.get("access-control-allow-origin")).toBeNull()
      expect(response.headers.get("access-control-allow-methods")).toBeNull()
      expect(connections).toBe(before)
    }
    for (const host of authorities) {
      expect((await request(server, "/api/stats", { headers: { host } })).status).toBe(200)
      expect((await request(server, "/api/stats", { headers: { host, origin: `http://${host}` } })).status).toBe(200)
      for (const origin of [...authorities.filter((other) => other !== host).map((other) => `http://${other}`), `https://${host}`, `http://${host.replace(/:\d+$/, `:${otherPort}`)}`, "null", ""]) {
        await denied({ host, origin })
      }
      await denied({ host, "sec-fetch-site": "cross-site" })
      await denied({ host, "x-dashboard-request": "" })
      for (const method of ["POST", "OPTIONS", "HEAD"]) await denied({ host, origin: `http://${host}` }, method, 405)
    }
    for (const host of ["evil.example", `localhost:${otherPort}`, `127.0.0.1:${otherPort}`, `[::1]:${otherPort}`, "localhost", `localhost.evil.example:${server.port}`, `127.0.0.2:${server.port}`, `[::ffff:127.0.0.1]:${server.port}`, `LOCALHOST:${server.port}`, `localhost.:${server.port}`]) {
      await denied({ host, origin: `http://${host}` })
    }
    expect(connections).toBe(6)
  })

  test("reports unavailable services and never exposes upstream secrets", async () => {
    expect((await request(start(), "/api/stats")).status).toBe(503)
    const server = start({ ...client, session: { ...client.session, stats: async () => { throw new Error("Bearer secret-token") } } })
    const response = await request(server, "/api/stats")
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain("secret-token")
  })

  test("cleanup releases both loopback listeners", async () => {
    const server = start(client)
    const port = server.port!
    await server.stop()
    for (const hostname of ["127.0.0.1", "::1"]) {
      const replacement = Bun.serve({ hostname, port, fetch: () => new Response("ok") })
      try { expect(replacement.port).toBe(port) } finally { await replacement.stop(true) }
    }
  })

  test("an actual IPv6 port conflict fails startup and releases the IPv4 listener", async () => {
    const occupied = Bun.serve({ hostname: "::1", port: 0, fetch: () => new Response("occupied") })
    try {
      expect(() => startDashboard({ port: occupied.port!, directory: "D:/project", projectID: "current-project", connect: async () => client })).toThrow()
      const replacement = Bun.serve({ hostname: "127.0.0.1", port: occupied.port, fetch: () => new Response("released") })
      try { expect(replacement.port).toBe(occupied.port) } finally { await replacement.stop(true) }
      expect(await (await fetch(occupied.url)).text()).toBe("occupied")
    } finally { await occupied.stop(true) }
  })

  test("only explicit unsupported or unavailable IPv6 errors retain IPv4", async () => {
    const serve = Bun.serve
    for (const code of ["EAFNOSUPPORT", "EPROTONOSUPPORT", "EADDRNOTAVAIL", "EADDRINUSE", "EACCES", "EUNKNOWN"]) {
      const error = Object.assign(new Error("IPv6 listen failed"), { code })
      const listener = spyOn(Bun, "serve").mockImplementationOnce(serve).mockImplementationOnce(() => { throw error })
      try {
        if (["EAFNOSUPPORT", "EPROTONOSUPPORT", "EADDRNOTAVAIL"].includes(code)) {
          const server = start(client)
          expect(listener.mock.calls[1]![0].port).toBe(server.port)
          expect((await request(server, "/api/stats")).status).toBe(200)
          await server.stop(true)
        } else {
          expect(() => start(client)).toThrow(error)
        }
        expect(listener.mock.calls.map(([options]) => options.hostname)).toEqual(["127.0.0.1", "::1"])
        const port = listener.mock.calls[1]![0].port as number
        expect(port).toBeGreaterThan(0)
        listener.mockRestore()
        const replacement = Bun.serve({ hostname: "127.0.0.1", port, fetch: () => new Response("released") })
        try { expect(replacement.port).toBe(port) } finally { await replacement.stop(true) }
      } finally { listener.mockRestore() }
    }
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

  test("excludes steered input recorded after dispatch even before the assistant projection", async () => {
    const late = { id: "msg_steered", type: "user" as const, time: { created: 550 }, text: "not in the dispatched request" }
    const ordered = [...messages.slice(0, 4), late, ...messages.slice(4)]
    const server = start({ ...client, message: { list: async () => ({ data: ordered.toReversed(), cursor: {} }) } })
    const page = await (await request(server, "/api/sessions/ses_example/history?request=msg_selected")).json()
    expect(page.data.map((message: { id: string }) => message.id)).not.toContain(late.id)
    expect(page.data.at(-1).id).toBe("msg_instructions")
    const paged = start({ ...client, message: { list: async () => ({ data: [late, messages[0]!], cursor: {} }) } })
    const response = await request(paged, "/api/sessions/ses_example/history?request=msg_selected&cursor=older&older=1")
    expect(response.status).toBe(200)
    expect((await response.json()).data.map((message: { id: string }) => message.id)).toEqual(["msg_user"])
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

  test("adds stable camelCase error codes alongside existing statuses and messages", async () => {
    const server = start(client)
    const read = async (path: string, init?: RequestInit) => {
      const response = await request(server, path, init)
      return { status: response.status, body: await response.json() as { error?: string; code?: string } }
    }
    const cases: [string, number, string, RequestInit?][] = [
      ["/api/stats", 403, "localOnly", { headers: { origin: "https://evil.example" } }],
      ["/api/stats", 405, "readOnly", { method: "POST" }],
      ["/api/unknown", 404, "notFound"],
      ["/api/sessions?cursor=" + "a".repeat(8193), 400, "queryTooLong"],
      ["/api/sessions?parent=invalid", 400, "invalidSelection"],
      ["/api/stats?tools=invalid", 400, "invalidToolMode"],
      ["/api/stats?from=nope", 400, "invalidPeriod"],
      ["/api/stats?from=200&to=100", 400, "invalidRange"],
      ["/api/stats?timezone=invalid-zone", 400, "invalidTimezone"],
      ["/api/sessions/ses_example/history?request=msg_user", 400, "selectStep"],
      ["/api/sessions/ses_example/history?request=msg_selected&cursor=older&older=1", 409, "staleRequest"],
      ["/missing", 404, "notFound"],
    ]
    for (const [path, status, code, init] of cases) {
      const result = await read(path, init)
      expect({ path, status: result.status, code: result.body.code }).toEqual({ path, status, code })
      expect(result.body.error).toBeString()
    }
    const noHeader = await fetch(new URL("/api/stats", server.url))
    expect(noHeader.status).toBe(403)
    expect((await noHeader.json()).code).toBe("requestHeader")
    const unavailable = await request(start(), "/api/stats")
    expect(unavailable.status).toBe(503)
    expect((await unavailable.json()).code).toBe("serviceUnavailable")
    const failing = await request(start({ ...client, session: { ...client.session, stats: async () => { throw new Error("secret") } } }), "/api/stats")
    expect(failing.status).toBe(502)
    const failure = await failing.text()
    expect(JSON.parse(failure).code).toBe("upstreamFailure")
    expect(failure).not.toContain("secret")
    const longProject = await request(start(client, "p".repeat(257)), "/api/stats")
    expect(longProject.status).toBe(400)
    expect((await longProject.json()).code).toBe("invalidProject")
  })
})
