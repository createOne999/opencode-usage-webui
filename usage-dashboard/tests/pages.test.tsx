import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { App } from "../web/app"
import { DailyTokens, StatsView } from "../web/stats"
import { ContextView } from "../web/sessions"
import { dailyStatsQueries, number, pageHref, readFilters, requestHref, requestPoints, statsQuery, tokenNumber, totalTokens } from "../web/data"
import { recordedMessage, requestSummary, type HistoryPage } from "../history"
import { messages, stats } from "./fixtures"

describe("usage pages", () => {
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
      for (const value of [heading, 'href="#main"', 'type="date"', "시작일", "종료일", "프로젝트", 'role="status"', 'data-slot="skeleton"', "LOCAL · READ ONLY", 'aria-label="주 메뉴"', "aria-current=\"page\"", "project=all"]) expect(html).toContain(value)
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
    for (const value of ["저장 이력 기반 재구성", "실제 전송 원문이 아닙니다", "요청 직전 저장 이력", "압축 이전 원기록", "압축에서 유지한 최근 이력", "선택한 요청의 응답", "&lt;script&gt;"]) expect(context).toContain(value)
    expect(context).not.toContain("미래 메시지")
    expect(context).not.toContain("<script>")
    const partial = renderToStaticMarkup(<ContextView data={{ ...data, data: data.data.slice(2) }} hasOlder />)
    expect(partial).toContain("앞부분 미조회")
    expect(partial).toContain("유지 컨텍스트가 불완전")
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
    for (const text of ["일별 토큰 불러오기", "1일 단위", "최대 100일", "2026-10-25", "2026-10-27"]) expect(html).toContain(text)
    expect(html).not.toContain("날짜별 토큰 사용량 데이터")
  })

  test("bounds daily calls and rejects invalid periods before fetching", () => {
    expect(dailyStatsQueries({ from: "2026-01-01", to: "2026-04-10", project: "" })).toHaveLength(100)
    expect(() => dailyStatsQueries({ from: "2026-01-01", to: "2026-04-11", project: "" })).toThrow("최대 100일")
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
