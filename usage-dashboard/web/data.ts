import type { TokenUsageInfo } from "@opencode/client"

export type Projects = {
  directory: string
  current: string
  projects: { id: string; name?: string; canonical: string }[]
}

export const number = (value: number) => new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value)
export const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(value)
export const dateTime = (value: number) => new Date(value).toLocaleString("ko-KR")
export const totalTokens = (tokens: TokenUsageInfo) => tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write

export function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function statsQuery(from: string, to: string, project: string) {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  // Advance by a local calendar day, not 24 hours, so DST boundaries stay correct.
  end.setDate(end.getDate() + 1)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end)
    throw new Error("유효한 시작일과 종료일을 선택해 주세요.")
  return new URLSearchParams({ from: String(start.getTime()), to: String(end.getTime()), project, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }).toString()
}
