import type { OpenCodeClient, SessionStatsInput } from "@opencode/client"
import { recordedMessage, requestSummary, sessionSummary } from "./history"

export type DashboardClient = {
  session: Pick<OpenCodeClient["session"], "stats" | "list" | "get" | "message">
  message: Pick<OpenCodeClient["message"], "list">
  project: Pick<OpenCodeClient["project"], "list">
}

type Options = {
  port: number
  directory: string
  projectID: string
  connect: () => Promise<DashboardClient | undefined>
}

export function startDashboard(options: Options) {
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535)
    throw new Error("Dashboard port must be an integer between 0 and 65535")

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: options.port,
    idleTimeout: 30,
    async fetch(request) {
      const url = new URL(request.url)
      const origin = request.headers.get("origin")
      const headers = {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
      }
      const json = (value: unknown, status = 200) => Response.json(value, { status, headers })

      if (request.headers.get("host") !== server.url.host || (origin && origin !== server.url.origin) || request.headers.get("sec-fetch-site") === "cross-site")
        return json({ error: "이 대시보드는 로컬 동일 출처에서만 접근할 수 있습니다." }, 403)
      if (request.method !== "GET") return json({ error: "읽기 전용 API입니다." }, 405)

      if (url.pathname.startsWith("/api/")) {
        // A custom header forces cross-origin browser requests through a denied CORS preflight.
        if (request.headers.get("x-dashboard-request") !== "1") return json({ error: "대시보드 요청 헤더가 필요합니다." }, 403)
        const detail = url.pathname.match(/^\/api\/sessions\/(ses_[\w-]{1,252})\/(requests|history)$/)
        if (!["/api/stats", "/api/projects", "/api/sessions"].includes(url.pathname) && !detail) return json({ error: "Not found" }, 404)

        for (const [key, max] of [["project", 256], ["search", 256], ["cursor", 8192]] as const) {
          if ((url.searchParams.get(key)?.length ?? 0) > max) return json({ error: "조회 조건이 너무 깁니다." }, 400)
        }
        const cursor = url.searchParams.get("cursor") || undefined
        const parent = url.searchParams.get("parent") || undefined
        const selected = url.searchParams.get("request") || undefined
        if ((parent && !/^ses_[\w-]{1,252}$/.test(parent)) || (detail?.[2] === "history" && (!selected || !/^msg_[\w-]{1,252}$/.test(selected))))
          return json({ error: "유효한 세션과 요청을 선택해 주세요." }, 400)

        const input: SessionStatsInput = {
          tools: "detail",
          project: url.searchParams.get("project") === "all" ? undefined : url.searchParams.get("project") || options.projectID,
          timezone: url.searchParams.get("timezone") || "UTC",
        }
        if (url.pathname === "/api/stats") {
          for (const key of ["from", "to"] as const) {
            const value = url.searchParams.get(key)
            if (value === null) continue
            const time = Number(value)
            if (!value.trim() || !Number.isSafeInteger(time) || time < 0 || Number.isNaN(new Date(time).getTime()))
              return json({ error: "유효한 조회 기간을 선택해 주세요." }, 400)
            Object.assign(input, { [key]: time })
          }
          if ((input.from ?? 0) >= (input.to ?? Date.now())) return json({ error: "시작일은 종료일보다 빨라야 합니다." }, 400)
          if ((input.project?.length ?? 0) > 256) return json({ error: "유효하지 않은 프로젝트입니다." }, 400)
          try {
            new Intl.DateTimeFormat("en", { timeZone: input.timezone })
          } catch {
            return json({ error: "유효하지 않은 시간대입니다." }, 400)
          }
        }

        try {
          const client = await options.connect()
          if (!client) return json({ error: "실행 중인 OpenCode V2 공유 서비스를 찾지 못했습니다. opencode mini를 실행해 주세요." }, 503)
          const requestOptions = { signal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]) }
          if (url.pathname === "/api/stats") return json(await client.session.stats(input, requestOptions))
          if (url.pathname === "/api/sessions") {
            const page = await client.session.list({ limit: 20, ...(cursor ? { cursor } : { project: input.project, search: url.searchParams.get("search") || undefined, parentID: parent }) }, requestOptions)
            return json({ data: page.data.map(sessionSummary), cursor: page.cursor })
          }
          if (detail) {
            const sessionID = detail[1]!
            const pageInput = { sessionID, limit: 100, ...(cursor ? { cursor } : { order: "desc" as const }) }
            if (detail[2] === "requests") {
              const [session, page] = await Promise.all([client.session.get({ sessionID }, requestOptions), client.message.list(pageInput, requestOptions)])
              return json({ session: sessionSummary(session), data: page.data.filter((message) => message.type === "assistant").map(requestSummary), cursor: page.cursor, scanned: page.data.length, from: page.data.at(-1)?.time.created, to: page.data[0]?.time.created })
            }
            const [message, page] = await Promise.all([client.session.message.get({ sessionID, messageID: selected! }, requestOptions), client.message.list(pageInput, requestOptions)])
            if (message.type !== "assistant") return json({ error: "모델 Step을 선택해 주세요." }, 400)
            const index = page.data.findIndex((item) => item.id === selected)
            const older = url.searchParams.get("older") === "1"
            if ((!older && index < 0) || (older && (!cursor || index >= 0 || page.data.some((item) => item.time.created > message.time.created))))
              return json({ error: "요청 위치가 바뀌었거나 이력 커서가 맞지 않습니다. 요청 목록을 새로고침한 뒤 다시 선택해 주세요." }, 409)
            const prior = older ? page.data : page.data.slice(index + 1)
            return json({ request: requestSummary(message), response: recordedMessage(message), data: prior.toReversed().map((item) => recordedMessage(item, message.time.created)), next: page.cursor.next })
          }
          const projects = await client.project.list(undefined, requestOptions)
          return json({
            directory: options.directory,
            current: options.projectID,
            projects: projects.map((project) => ({ id: project.id, name: project.name, canonical: project.canonical })),
          })
        } catch {
          // Never forward upstream errors: they can contain authentication or provider response details.
          return json({ error: "OpenCode 조회에 실패했습니다. 서비스 상태를 확인한 뒤 다시 시도해 주세요." }, 502)
        }
      }

      if (["/", "/stats", "/models", "/tools", "/sessions"].includes(url.pathname) || /^\/sessions\/ses_[\w-]{1,252}$/.test(url.pathname)) {
        const file = Bun.file(new URL("./dist/index.html", import.meta.url))
        if (!(await file.exists())) return json({ error: "usage-dashboard 폴더에서 bun run build를 먼저 실행해 주세요." }, 503)
        return new Response(file, { headers })
      }
      if (/^\/[\w.-]+\.(js|css)$/.test(url.pathname)) {
        const file = Bun.file(new URL(`./dist${url.pathname}`, import.meta.url))
        if (await file.exists()) return new Response(file, { headers })
      }
      if (url.pathname === "/favicon.ico") return new Response(null, { status: 204, headers })
      return json({ error: "Not found" }, 404)
    },
  })
  return server
}
