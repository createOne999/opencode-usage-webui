import { describe, expect, spyOn, test } from "bun:test"
import { fileURLToPath } from "node:url"
import * as React from "react"
import { renderToStaticMarkup as renderMarkup } from "react-dom/server"
import { I18nextProvider } from "react-i18next"
import { App } from "../web/app"
import { DailyTokens, StatsView } from "../web/stats"
import { ContextView, RecordedMessageView } from "../web/sessions"
import { dailyStatsQueries, dateTime, languageHref, money, number, pageHref, readFilters, requestHref, requestPoints, statsQuery, tokenNumber, totalTokens } from "../web/data"
import { createI18n, intlLocale, LANGUAGES, localeDir } from "../web/i18n"
import { api } from "../web/shared"
import ko from "../web/locales/ko.json"
import en from "../web/locales/en.json"
import { recordedMessage, requestSummary, type HistoryPage } from "../history"
import { messages, stats } from "./fixtures"

function renderToStaticMarkup(node: React.ReactNode, language = "ko") {
  return renderMarkup(<I18nextProvider i18n={createI18n(language)}>{node}</I18nextProvider>)
}

describe("usage pages", () => {
  test("renders both languages with isolated instances and translated accessibility labels", () => {
    for (const [pathname, heading] of [["/stats", "Usage overview"], ["/models", "Usage by model"], ["/tools", "Tool usage"], ["/sessions", "Browse sessions"], ["/sessions/ses_example", "Sessions · per-request context"]]) {
      const html = renderToStaticMarkup(<App location={{ pathname: pathname!, search: "?lang=en&project=all" }} />)
      for (const value of [heading, 'lang="en"', 'aria-label="Main menu"', "Start date", "End date", "Language", "lang=en"]) expect(html).toContain(value)
      expect(html).toMatch(/<option value="en"[^>]*selected=""/)
      expect(html).not.toContain("조회 / 새로고침")
    }
    const english = renderToStaticMarkup(<StatsView stats={stats} section="overview" />, "en")
    for (const text of ["Cache read", "Cache write", "Chart data table", "$0.000123"]) expect(english).toContain(text)
    expect(english).not.toContain("캐시 읽기")
    expect(renderToStaticMarkup(<StatsView stats={stats} section="overview" />)).toContain("캐시 읽기")
    expect(renderToStaticMarkup(<App location={{ pathname: "/stats", search: "?lang=fr" }} />)).toContain('lang="fr"')
    expect(renderToStaticMarkup(<App location={{ pathname: "/stats", search: "?lang=ar" }} />)).toContain('dir="rtl"')
    expect(renderToStaticMarkup(<App location={{ pathname: "/stats", search: "?lang=unsupported" }} />)).toContain('lang="ko"')
  })

  test("preserves locale, filters, request selection, cursors and hashes without sending locale to the API", () => {
    const location = { pathname: "/sessions/ses_example", search: "?from=2026-10-01&to=2026-10-27&project=all&search=hello&request=msg_selected&cursor=next%2B%2F%3D", hash: "#request" }
    const switched = new URL(languageHref(location, "en"), "http://localhost")
    const original = new URLSearchParams(location.search)
    for (const [key, value] of original) expect(switched.searchParams.get(key)).toBe(value)
    expect(switched.searchParams.get("lang")).toBe("en")
    expect(switched.hash).toBe("#request")
    expect(switched.pathname).toBe(location.pathname)
    const filters = readFilters(switched.search)
    expect(new URL(pageHref("/models", filters), switched).searchParams.get("lang")).toBe("en")
    expect(new URL(requestHref("ses_example", "msg_selected", filters, "next+/="), switched).searchParams.get("lang")).toBe("en")
    expect(new URLSearchParams(dailyStatsQueries(filters)[0]!.query).has("lang")).toBe(false)
    expect(readFilters("?lang=unsupported").lang).toBe("ko")
    expect(new URL(languageHref(location, "unsupported"), switched).searchParams.get("lang")).toBe("ko")
    expect(dateTime(500, "en")).toBe(new Date(500).toLocaleString("en-US"))
    expect(money(0.000123)).toBe("$0.000123")
    expect(() => statsQuery("invalid", "2026-10-27", "all", "en")).toThrow("Select valid start and end dates.")
  })

  test("keeps catalogs complete with matching interpolation variables and English plurals", async () => {
    const normalize = (key: string) => key.replace(/_(one|other)$/, "")
    const expectedKeys = Object.keys(ko).sort()
    const variables = (text: string) => [...text.matchAll(/{{(\w+)}}/g)].map((match) => match[1]).sort()
    for (const item of LANGUAGES) {
      const catalog = await Bun.file(new URL(`../web/locales/${item.code}.json`, import.meta.url)).json() as Record<string, string>
      expect([...new Set(Object.keys(catalog).map(normalize))].sort()).toEqual(expectedKeys)
      for (const [key, value] of Object.entries(catalog)) {
        const original = ko[normalize(key) as keyof typeof ko]
        expect(variables(value)).toEqual(variables(original))
      }
      expect(dateTime(500, item.code)).toBe(new Date(500).toLocaleString(intlLocale(item.code)))
      expect(localeDir(item.code)).toBe(item.code === "ar" ? "rtl" : "ltr")
    }
    for await (const file of new Bun.Glob("*.{ts,tsx}").scan(fileURLToPath(new URL("../web/", import.meta.url)))) {
      const source = await Bun.file(new URL(`../web/${file}`, import.meta.url)).text()
      for (const match of source.matchAll(/\bt\("([^"]+)"/g)) expect(Object.hasOwn(ko, match[1]!)).toBe(true)
    }
    const english = createI18n("en")
    expect(english.t("압축 이전 원기록 · {{count}}개", { count: 1 })).toContain("1 entry")
    expect(english.t("압축 이전 원기록 · {{count}}개", { count: 2 })).toContain("2 entries")
    expect(english.t("{{loaded}} / {{total}}일 조회 완료", { loaded: 1, total: 1, count: 1 })).toBe("1 / 1 day loaded")
    expect(english.t("{{loaded}} / {{total}}일 조회 완료", { loaded: 2, total: 2, count: 2 })).toBe("2 / 2 days loaded")
    english.removeResourceBundle("en", "translation")
    expect(english.t("캐시 읽기")).toBe("캐시 읽기")
  })

  test("translates history labels without changing raw text or the default expanded blocks", () => {
    const selected = messages.find((message) => message.id === "msg_selected")!
    if (selected.type !== "assistant") throw new Error("bad fixture")
    const history: HistoryPage = { request: requestSummary(selected), response: recordedMessage(selected), data: messages.slice(0, 4).map((message) => recordedMessage(message, 500)) }
    const english = renderToStaticMarkup(<ContextView data={history} hasOlder={false} />, "en")
    for (const text of ["Saved history before request", "Response to selected request", "Original history before compaction", "Completed", "선택 요청의 응답", "&lt;script&gt;"]) expect(english).toContain(text)
    expect(english).not.toContain("미래 메시지")
    expect(english).not.toContain("<script>")
    const user = recordedMessage(messages[0]!)
    expect(renderToStaticMarkup(<RecordedMessageView message={user} />, "en")).toMatch(/<details[^>]*open=""[^>]*><summary[^>]*>Message<\/summary>/)
    expect(renderToStaticMarkup(<RecordedMessageView message={recordedMessage(messages[2]!)} />, "en")).toContain("Compaction summary")
    const limited = recordedMessage({ ...selected, time: { created: 500 } }, 600)
    expect(renderToStaticMarkup(<RecordedMessageView message={limited} />, "en")).toContain("not confirmed to have completed")
    const skill = recordedMessage({ id: "msg_skill", type: "skill", time: { created: 100 }, skill: "review", name: "review", text: "raw skill body" })
    const skillHtml = renderToStaticMarkup(<RecordedMessageView message={skill} />, "en")
    expect(skillHtml).toContain("Skill · review")
    expect(skillHtml).not.toContain("{{name}}")
    const file = recordedMessage({ id: "msg_file", type: "user", time: { created: 100 }, text: "첨부 원문", files: [{ mime: "image/png", data: "binary-secret", source: { type: "inline" } }] })
    const fileHtml = renderToStaticMarkup(<RecordedMessageView message={file} />, "en")
    expect(fileHtml).toContain("Unnamed · image/png")
    expect(fileHtml).toContain("첨부 원문")
    expect(fileHtml).not.toContain("binary-secret")
    const synthetic = recordedMessage({ id: "msg_synthetic", type: "synthetic", time: { created: 100 }, text: "raw context" })
    expect(renderToStaticMarkup(<RecordedMessageView message={synthetic} />, "en")).toMatch(/<details[^>]*open=""[^>]*><summary[^>]*>Message<\/summary>/)
  })

  test("translates known API errors and retains safe fallback errors", async () => {
    const fetch = spyOn(globalThis, "fetch")
    try {
      fetch.mockResolvedValueOnce(Response.json({ code: "serviceUnavailable", error: "한국어 원문" }, { status: 503 }))
      await expect(api("/api/stats", undefined, "en")).rejects.toThrow("Could not find a running OpenCode V2 shared service.")
      for (const language of ["ko", "en"]) {
        fetch.mockResolvedValueOnce(Response.json({ code: "buildRequired", error: "Build missing" }, { status: 503 }))
        await expect(api("/stats", undefined, language)).rejects.toThrow("@createone999/oud")
      }
      fetch.mockResolvedValueOnce(Response.json({ code: "unknown", error: "Safe original error" }, { status: 400 }))
      await expect(api("/api/stats", undefined, "en")).rejects.toThrow("Safe original error")
      fetch.mockResolvedValueOnce(Response.json({}, { status: 500 }))
      await expect(api("/api/stats", undefined, "en")).rejects.toThrow("Could not load data.")
    } finally { fetch.mockRestore() }
  })

  test("formats only token counts with uppercase K, M, B, and T suffixes", () => {
    for (const [value, formatted] of [[0, "0"], [999, "999"], [1_000, "1K"], [1_234, "1.23K"], [999_999, "1M"], [1_000_000, "1M"], [1_000_000_000, "1B"], [1_234_567_890_123, "1.23T"]] as const) expect(tokenNumber(value)).toBe(formatted)
    expect(number(1_234)).toBe("1,234")
    const tokens = { ...stats.tokens, input: 1_234_567 }
    const overview = renderToStaticMarkup(<StatsView stats={{ ...stats, tokens, steps: 1_234 }} section="overview" />)
    expect(overview).toContain("1.23M")
    expect(overview).toContain("1,234")
    const models = renderToStaticMarkup(<StatsView stats={{ ...stats, models: [{ ...stats.models[0]!, tokens }] }} section="models" />)
    expect(models).toContain("1.23M")
    const selected = messages.find((message) => message.id === "msg_selected")!
    if (selected.type !== "assistant") throw new Error("bad fixture")
    const context = renderToStaticMarkup(<ContextView data={{ request: requestSummary({ ...selected, tokens }), response: recordedMessage(selected), data: [] }} hasOlder={false} />)
    expect(context).toContain("입력 1.23M")
  })

  test("renders separate pages with shared navigation and URL-preserving filters", () => {
    const search = "?from=2026-10-01&to=2026-10-27&project=all"
    for (const [pathname, heading] of [["/stats", "사용량 개요"], ["/models", "모델별 사용량"], ["/tools", "도구 사용량"], ["/sessions", "세션 탐색"], ["/sessions/ses_example", "세션 · 요청별 컨텍스트"]]) {
      const html = renderToStaticMarkup(<App location={{ pathname: pathname!, search }} />)
      for (const value of [heading, 'href="#main"', 'type="date"', "시작일", "종료일", "프로젝트", 'role="status"', 'data-slot="skeleton"', 'aria-label="주 메뉴"', "aria-current=\"page\"", "project=all"]) expect(html).toContain(value)
      expect(html).not.toContain("/limits")
      expect(html).toContain('value="2026-10-01"')
    }
  })

  test("renders summary charts without duplicating the model and tool boards", () => {
    expect(totalTokens(stats.tokens)).toBe(200)
    const html = renderToStaticMarkup(<StatsView stats={stats} section="overview" />)
    for (const value of ["캐시 읽기", "캐시 쓰기", "추론", "$0.000123", "2026-10-27", "날짜별 모델 Steps", "그래프 데이터 표"]) expect(html).toContain(value)
    expect(html).not.toContain('aria-label="모델별 사용량"')
    expect(html).not.toContain('aria-label="도구별 사용량"')
    const empty = renderToStaticMarkup(<StatsView stats={{ ...stats, activity: [], cost: 0 }} section="overview" />)
    expect(empty).toContain("표시할 그래프 데이터가 없습니다")
    expect(empty).toContain("$0.00")
  })

  test("keeps all model categories and tool measurements on their own pages", () => {
    const model = renderToStaticMarkup(<StatsView stats={stats} section="models" />)
    for (const value of ["캐시 읽기", "캐시 쓰기", "추론", "$0.000123", "전체 (API)", "example", "high"]) expect(model).toContain(value)
    expect(model).toMatch(/<th[^>]*class="[^"]*text-right[^"]*"[^>]*>Steps<\/th>/)
    const tools = renderToStaticMarkup(<StatsView stats={stats} section="tools" />)
    for (const value of ["read", "실행시간 P50", "도구 호출 상태"]) expect(tools).toContain(value)
    expect(renderToStaticMarkup(<StatsView stats={{ ...stats, models: [] }} section="models" />)).toContain("모델 사용 기록이 없습니다")
    expect(renderToStaticMarkup(<StatsView stats={{ ...stats, tools: { mode: "none" } }} section="tools" />)).toContain("도구 상세 사용 기록이 없습니다")
  })

  test("escapes provider-controlled names and conversation text", () => {
    const html = renderToStaticMarkup(<StatsView stats={{ ...stats, models: [{ ...stats.models[0]!, model: { providerID: "openai", id: "<script>alert(1)</script>" } }] }} section="models" />)
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<script>")
    const selected = messages.find((message) => message.id === "msg_selected")!
    if (selected.type !== "assistant") throw new Error("bad fixture")
    const data: HistoryPage = { request: requestSummary(selected), response: recordedMessage(selected), data: messages.slice(0, 4).map((message) => recordedMessage(message, 500)) }
    const context = renderToStaticMarkup(<ContextView data={data} hasOlder={false} />)
    for (const value of ["요청 직전 저장 이력", "압축 이전 원기록", "압축에서 유지한 최근 이력", "선택한 요청의 응답", "&lt;script&gt;"]) expect(context).toContain(value)
    expect(context).not.toContain("미래 메시지")
    expect(context).not.toContain("<script>")
  })

  test("distinguishes missing usage from zero and excludes generated tokens from context size", () => {
    const requests = messages.filter((message) => message.type === "assistant").map(requestSummary)
    const points = requestPoints(requests.toReversed())
    expect(points[0]?.input).toBe(150)
    expect(points[0]?.output).toBe(50)
    expect(points[0]?.cost).toBe(0)
    expect(points.at(-1)?.input).toBeNull()
    expect(points.at(-1)?.cost).toBeNull()
  })

  test("builds contiguous daily queries including inactive dates and the end date", () => {
    const filters = { from: "2026-10-25", to: "2026-10-27", project: "all" }
    const days = dailyStatsQueries(filters)
    expect(days.map((day) => day.date)).toEqual(["2026-10-25", "2026-10-26", "2026-10-27"])
    for (let index = 0; index < days.length; index++) {
      const query = new URLSearchParams(days[index]!.query)
      expect(query.get("tools")).toBe("none")
      expect(query.get("project")).toBe("all")
      expect(query.get("timezone")).toBeTruthy()
      expect(Number(query.get("from"))).toBe(new Date(2026, 9, 25 + index).getTime())
      expect(Number(query.get("to"))).toBe(new Date(2026, 9, 26 + index).getTime())
    }
    expect(dailyStatsQueries({ from: "2024-02-28", to: "2024-03-01", project: "" }).map((day) => day.date)).toEqual(["2024-02-28", "2024-02-29", "2024-03-01"])
    expect(dailyStatsQueries({ from: "2026-12-31", to: "2027-01-01", project: "" }).map((day) => day.date)).toEqual(["2026-12-31", "2027-01-01"])
    expect(dailyStatsQueries({ from: "2026-10-27", to: "2026-10-27", project: "" })).toHaveLength(1)
    const html = renderToStaticMarkup(<DailyTokens filters={filters} />)
    for (const text of ["일별 토큰 불러오기", "2026-10-25", "2026-10-27"]) expect(html).toContain(text)
    expect(html).not.toContain("날짜별 토큰 사용량 데이터")
  })

  test("keeps all five daily token categories and omits zero-usage dates", () => {
    const zero = { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }
    const days = [zero, { ...zero, input: 1 }, { ...zero, output: 2 }, { ...zero, reasoning: 3 }, { ...zero, cache: { read: 4, write: 0 } }, { ...zero, cache: { read: 0, write: 5 } }, stats.tokens]
      .map((tokens, index) => ({ date: `2026-10-${21 + index}`, tokens }))
    const state = spyOn(React, "useState").mockReturnValueOnce([days, () => {}])
    try {
      const html = renderToStaticMarkup(<DailyTokens filters={{ from: "2026-10-20", to: "2026-10-28", project: "" }} />)
      expect(html).not.toContain("2026-10-21")
      for (const day of days.slice(1)) expect(html).toContain(day.date)
      for (const label of ["입력", "출력", "추론", "캐시 읽기", "캐시 쓰기"]) expect(html).toContain(label)
      for (const value of [100, 20, 30, 40, 10]) expect(html).toContain(`>${value}</td>`)
    } finally { state.mockRestore() }
  })

  test("shows the empty chart state when every daily token count is zero", () => {
    const state = spyOn(React, "useState").mockReturnValueOnce([[{ date: "2026-10-27", tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } }], () => {}])
    try {
      const html = renderToStaticMarkup(<DailyTokens filters={{ from: "2026-10-27", to: "2026-10-27", project: "" }} />)
      expect(html).toContain("표시할 그래프 데이터가 없습니다.")
      expect(html).not.toContain("날짜별 토큰 사용량 데이터")
    } finally { state.mockRestore() }
  })

  test("allows more than 100 daily calls and rejects invalid periods before fetching", () => {
    expect(dailyStatsQueries({ from: "2026-01-01", to: "2026-04-10", project: "" })).toHaveLength(100)
    expect(dailyStatsQueries({ from: "2026-01-01", to: "2026-04-11", project: "" })).toHaveLength(101)
    expect(() => dailyStatsQueries({ from: "2026-02-30", to: "2026-03-01", project: "" })).toThrow()
    expect(() => dailyStatsQueries({ from: "2026-10-28", to: "2026-10-27", project: "" })).toThrow()
  })

  test("uses calendar days across both daylight-saving transitions", () => {
    const result = Bun.spawnSync([process.execPath, "--eval", `
      import { dailyStatsQueries } from "../web/data.ts"
      const ranges = [["2026-03-07", "2026-03-09"], ["2026-10-31", "2026-11-02"]]
      console.log(JSON.stringify(ranges.map(([from, to]) => dailyStatsQueries({ from, to, project: "" }).map((day) => {
        const query = new URLSearchParams(day.query)
        return (Number(query.get("to")) - Number(query.get("from"))) / 3_600_000
      }))))
    `], { cwd: import.meta.dir, env: { ...process.env, TZ: "America/New_York" } })
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout.toString())).toEqual([[24, 23, 24], [24, 25, 24]])
  })

  test("includes the end date, validates calendar dates, and preserves request cursors in links", () => {
    const query = new URLSearchParams(statsQuery("2026-10-01", "2026-10-27", "all"))
    expect(Number(query.get("from"))).toBe(new Date(2026, 9, 1).getTime())
    expect(Number(query.get("to"))).toBe(new Date(2026, 9, 28).getTime())
    expect(query.get("timezone")).toBeTruthy()
    for (const [from, to] of [["2026-10-28", "2026-10-27"], ["", "2026-10-27"], ["2026-02-30", "2026-03-01"], ["2026-10-01junk", "2026-10-27"]]) expect(() => statsQuery(from!, to!, "")).toThrow()
    const filters = readFilters("?from=2026-10-01&to=2026-10-27&project=all")
    expect(pageHref("/models", filters)).toContain("project=all")
    const link = new URL(requestHref("ses_example", "msg_selected", filters, "cursor+/="), "http://localhost")
    expect(link.pathname).toBe("/sessions/ses_example")
    expect(link.searchParams.get("request")).toBe("msg_selected")
    expect(link.searchParams.get("cursor")).toBe("cursor+/=")
    expect(link.hash).toBe("#request")
  })
})
