import type { TokenUsageInfo } from "@opencode/client"
import type { RequestSummary } from "../history"

export type Projects = {
  directory: string
  current: string
  projects: { id: string; name?: string; canonical: string }[]
}

export const number = (value: number) => new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value)
const tokenFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 })
export const tokenNumber = (value: number) => tokenFormat.format(value)
export const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(value)
export const dateTime = (value: number) => new Date(value).toLocaleString("ko-KR")
export const totalTokens = (tokens: TokenUsageInfo) => tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write

export function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function statsQuery(from: string, to: string, project: string) {
  if (![from, to].every((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))) throw new Error("유효한 시작일과 종료일을 선택해 주세요.")
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (dateInput(start) !== from || dateInput(end) !== to) throw new Error("존재하는 날짜를 선택해 주세요.")
  // Advance by a local calendar day, not 24 hours, so DST boundaries stay correct.
  end.setDate(end.getDate() + 1)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end)
    throw new Error("유효한 시작일과 종료일을 선택해 주세요.")
  return new URLSearchParams({ from: String(start.getTime()), to: String(end.getTime()), project, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }).toString()
}

export type Filters = { from: string; to: string; project: string }

export function dailyStatsQueries(filters: Filters) {
  const query = new URLSearchParams(statsQuery(filters.from, filters.to, filters.project))
  query.set("tools", "none")
  const end = Number(query.get("to"))
  const day = new Date(Number(query.get("from")))
  const queries: { date: string; query: string }[] = []
  while (day.getTime() < end) {
    // shortcut: Cap per-day API calls at 100; replace when OpenCode exposes daily token activity.
    if (queries.length >= 100) throw new Error("일별 토큰은 한 번에 최대 100일까지 조회할 수 있습니다. 조회 기간을 줄여 주세요.")
    const date = dateInput(day)
    query.set("from", String(day.getTime()))
    day.setDate(day.getDate() + 1)
    query.set("to", String(day.getTime()))
    queries.push({ date, query: query.toString() })
  }
  return queries
}

export function readFilters(search: string): Filters {
  const params = new URLSearchParams(search)
  const now = new Date()
  return { from: params.get("from") ?? dateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to: params.get("to") ?? dateInput(now), project: params.get("project") ?? "" }
}

export function pageHref(path: string, filters: Filters, extra: Record<string, string | null | undefined> = {}) {
  const params = new URLSearchParams(filters)
  Object.entries(extra).forEach(([key, value]) => { if (value) params.set(key, value) })
  return `${path}?${params}`
}

export const requestHref = (sessionID: string, request: string, filters: Filters, cursor?: string | null) => `${pageHref(`/sessions/${sessionID}`, filters, { request, cursor })}#request`

export function requestPoints(requests: RequestSummary[]) {
  return requests.toReversed().map((request, index) => ({
    id: request.id, label: `${index + 1}. ${dateTime(request.time.created)}`,
    input: request.tokens ? request.tokens.input + request.tokens.cache.read + request.tokens.cache.write : null,
    output: request.tokens ? request.tokens.output + request.tokens.reasoning : null,
    cost: request.cost ?? null,
  }))
}
