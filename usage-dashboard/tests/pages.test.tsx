import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { App, StatsView } from "../web/app"
import { statsQuery, totalTokens } from "../web/data"
import { stats } from "./fixtures"

describe("usage pages", () => {
  test("renders one read-only board with labeled native filters and loading placeholders", () => {
    const html = renderToStaticMarkup(<App />)
    for (const value of ['href="#main"', 'type="date"', "시작일", "종료일", "프로젝트", 'role="status"', 'data-slot="skeleton"', "LOCAL · READ ONLY"]) expect(html).toContain(value)
    expect(html).not.toContain("<nav")
    expect(html).not.toContain("/limits")
  })

  test("renders token categories, small costs, tools and activity without hiding zeroes", () => {
    expect(totalTokens(stats.tokens)).toBe(200)
    const html = renderToStaticMarkup(<StatsView stats={stats} />)
    for (const value of ["캐시 읽기", "캐시 쓰기", "추론", "$0.000123", "전체 (API)", "example", "high", "read", "2026-10-27"]) expect(html).toContain(value)
    const empty = renderToStaticMarkup(<StatsView stats={{ ...stats, models: [], activity: [], cost: 0, tools: { mode: "none" } }} />)
    expect(empty).toContain("모델 사용 기록이 없습니다")
    expect(empty).toContain("$0.00")
    expect(empty).toContain("도구 상세 사용 기록이 없습니다")
    expect(html).toMatch(/<th[^>]*class="[^"]*text-right[^"]*"[^>]*>Steps<\/th>/)
    expect(html).toContain('role="region" aria-label="모델별 사용량"')
  })

  test("escapes provider-controlled model names", () => {
    const html = renderToStaticMarkup(<StatsView stats={{ ...stats, models: [{ ...stats.models[0]!, model: { providerID: "openai", id: "<script>alert(1)</script>" } }] }} />)
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<script>")
  })

  test("includes the selected end date and forwards the browser timezone", () => {
    const query = new URLSearchParams(statsQuery("2026-10-01", "2026-10-27", "all"))
    expect(Number(query.get("from"))).toBe(new Date(2026, 9, 1).getTime())
    expect(Number(query.get("to"))).toBe(new Date(2026, 9, 28).getTime())
    expect(query.get("timezone")).toBeTruthy()
    expect(query.get("project")).toBe("all")
    expect(() => statsQuery("2026-10-28", "2026-10-27", "")).toThrow()
    expect(() => statsQuery("", "2026-10-27", "")).toThrow()
  })
})
