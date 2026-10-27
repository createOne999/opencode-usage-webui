import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { LimitsView, StatsView } from "../web/app"
import { budgetRows, statsQuery, totalTokens } from "../web/data"
import { limits, stats } from "./fixtures"

describe("usage pages", () => {
  test("renders token categories, small costs, tools and activity without hiding zeroes", () => {
    expect(totalTokens(stats.tokens)).toBe(200)
    const html = renderToStaticMarkup(<StatsView stats={stats} />)
    for (const value of ["캐시 읽기", "캐시 쓰기", "추론", "$0.000123", "전체 (API)", "example", "high", "read", "2026-10-27"]) expect(html).toContain(value)
    const empty = renderToStaticMarkup(<StatsView stats={{ ...stats, models: [], activity: [], cost: 0, tools: { mode: "none" } }} />)
    expect(empty).toContain("모델 사용 기록이 없습니다")
    expect(empty).toContain("$0.00")
  })

  test("uses each model's spend, not the budget's maximum, and does not double count pooled budgets", () => {
    expect(budgetRows(limits).map((row) => row.remaining)).toEqual([9, 3])
    const pooled = { ...limits, budgets: [{ ...limits.budgets[0]!, per: "set" as const, spent: 12 }] }
    expect(budgetRows(pooled)).toHaveLength(1)
    expect(budgetRows(pooled)[0]?.remaining).toBe(0)
  })

  test("renders Go windows, model budgets, null connections and missing allowances", () => {
    const html = renderToStaticMarkup(<LimitsView info={limits} />)
    for (const text of ["Test workspace", "Rolling", "주간", "월간", "25%", "한도 도달", "openai/a", "$9.00", "$3.00"]) expect(html).toContain(text)
    expect(renderToStaticMarkup(<LimitsView info={null} />)).toContain("/connect")
    const empty = renderToStaticMarkup(<LimitsView info={{ ...limits, go: undefined, budgets: [] }} />)
    expect(empty).toContain("Go 구독 정보가 없습니다")
    expect(empty).toContain("적용되는 예산 한도가 없습니다")
  })

  test("escapes provider-controlled text and rejects unsafe Console links", () => {
    const html = renderToStaticMarkup(<LimitsView info={{ ...limits, workspace: { ...limits.workspace, name: "<script>alert(1)</script>", usageURL: "javascript:alert(1)" } }} />)
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("javascript:")
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
