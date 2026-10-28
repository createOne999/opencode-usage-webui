import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { SessionStatsInfo } from "@opencode/client"
import { ArrowDownWideNarrow, Coins, Layers, RefreshCw, Terminal, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { NativeSelect } from "@/components/ui/native-select"
import { api, Board, Notice, useApi } from "./shared"
import { colors, UsageChart } from "./charts"
import { dailyStatsQueries, money, number, statsQuery, tokenNumber, totalTokens, type Filters } from "./data"

export type StatsSection = "overview" | "models" | "tools"

export function StatsView(props: { stats: SessionStatsInfo; section: StatsSection }) {
  const { t } = useTranslation()
  const [sort, setSort] = useState("tokens")
  const stats = props.stats
  const models = stats.models.toSorted((a, b) => sort === "model"
    ? `${a.model.providerID}/${a.model.id}`.localeCompare(`${b.model.providerID}/${b.model.id}`)
    : sort === "cost" ? b.cost - a.cost : sort === "steps" ? b.steps - a.steps : totalTokens(b.tokens) - totalTokens(a.tokens))
  const tokenCells = (tokens: SessionStatsInfo["tokens"]) => [tokens.input, tokens.output, tokens.reasoning, tokens.cache.read, tokens.cache.write, totalTokens(tokens)].map(tokenNumber)
  const tools = stats.tools.mode === "detail" ? stats.tools.usage.toSorted((a, b) => b.calls - a.calls) : []

  if (props.section === "overview") return <div className="data-enter space-y-6">
    <section aria-label={t("사용량 요약")}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: t("전체 토큰"), value: tokenNumber(totalTokens(stats.tokens)), icon: Layers },
        { label: t("기록 비용 · USD"), value: money(stats.cost), icon: Coins },
        { label: t("세션"), value: number(stats.sessions), icon: Terminal },
        { label: t("모델 Steps"), value: number(stats.steps), icon: Zap },
      ].map(({ label, value, icon: Icon }) => <Card key={label} className="min-w-0 gap-4 p-4 sm:p-5"><div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{label}</span><Icon aria-hidden="true" className="size-4 shrink-0 text-primary/80" /></div><strong className="text-xl font-semibold tracking-tight break-all tabular-nums sm:text-2xl xl:text-3xl">{value}</strong></Card>)}</div>
    </section>
    <div className="grid gap-5 xl:grid-cols-2">
      <UsageChart title={t("날짜별 모델 Steps")} data={stats.activity.map((day) => ({ label: day.date, steps: day.steps }))} series={[{ key: "steps", name: "Steps", color: colors[0]! }]} />
      <UsageChart title={t("토큰 구성")} tokens data={[{ label: t("입력"), tokens: stats.tokens.input }, { label: t("출력"), tokens: stats.tokens.output }, { label: t("추론"), tokens: stats.tokens.reasoning }, { label: t("캐시 읽기"), tokens: stats.tokens.cache.read }, { label: t("캐시 쓰기"), tokens: stats.tokens.cache.write }]} series={[{ key: "tokens", name: t("토큰"), color: colors[1]! }]} />
    </div>
  </div>

  if (props.section === "models") return <div className="data-enter space-y-6">
    <div className="section-heading"><div><h2 className="section-title">{t("모델별 사용량")}</h2></div><label className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowDownWideNarrow aria-hidden="true" className="size-3.5" />{t("정렬")}<NativeSelect name="sort" size="sm" value={sort} onChange={(event) => setSort(event.target.value)}><option value="tokens">{t("토큰 많은 순")}</option><option value="cost">{t("비용 높은 순")}</option><option value="steps">{t("Steps 많은 순")}</option><option value="model">{t("모델 이름순")}</option></NativeSelect></label></div>
    <div className="grid gap-5 xl:grid-cols-2">
      <UsageChart title={t("모델 토큰 비교")} tokens data={models.slice(0, 10).map((row) => ({ label: `${row.model.providerID}/${row.model.id} · ${row.model.variant || t("기본")}`, tokens: totalTokens(row.tokens) }))} series={[{ key: "tokens", name: t("전체 토큰"), color: colors[0]! }]} />
      <UsageChart title={t("모델 비용 비교")} currency data={models.slice(0, 10).map((row) => ({ label: `${row.model.providerID}/${row.model.id} · ${row.model.variant || t("기본")}`, cost: row.cost }))} series={[{ key: "cost", name: t("비용 · USD"), color: colors[2]! }]} />
    </div>
    <Board title={t("모델별 사용량")} numericFrom={3} headers={["공급자", "모델", "Variant", "Steps", "입력", "출력", "추론", "캐시 읽기", "캐시 쓰기", "전체 토큰", "비용 · USD"].map((label) => t(label))} rows={models.map((row) => [<span className="font-mono text-xs text-muted-foreground">{row.model.providerID}</span>, <span className="model-name">{row.model.id}</span>, <Badge variant="secondary">{row.model.variant || t("기본")}</Badge>, number(row.steps), ...tokenCells(row.tokens), money(row.cost)])} footer={[t("전체 (API)"), "—", "—", number(stats.steps), ...tokenCells(stats.tokens), money(stats.cost)]} empty={t("선택한 기간과 프로젝트의 모델 사용 기록이 없습니다.")} />
  </div>

  return <div className="data-enter space-y-6">
    <div className="section-heading"><div><h2 className="section-title">{t("도구 사용량")}</h2></div>{stats.tools.mode !== "none" && <div className="flex flex-wrap gap-2" aria-label={t("도구 호출 요약")}><Badge variant="outline">{t("전체 {{value}}", { value: number(stats.tools.totals.calls) })}</Badge><Badge variant="secondary">{t("성공 {{value}}", { value: number(stats.tools.totals.succeeded) })}</Badge><Badge variant="outline">{t("실패 {{value}}", { value: number(stats.tools.totals.failed) })}</Badge><Badge variant="outline">{t("미완료 {{value}}", { value: number(stats.tools.totals.unfinished) })}</Badge></div>}</div>
    <UsageChart title={t("도구 호출 상태")} data={tools.slice(0, 10).map((tool) => ({ label: tool.name, succeeded: tool.succeeded, failed: tool.failed, unfinished: tool.unfinished }))} series={[{ key: "succeeded", name: t("성공"), color: colors[1]! }, { key: "failed", name: t("실패"), color: colors[4]! }, { key: "unfinished", name: t("미완료"), color: colors[2]! }]} />
    <Board title={t("도구별 사용량")} headers={["도구", "호출", "성공", "실패", "미완료", "실행시간 P50 · ms"].map((label) => t(label))} rows={tools.map((tool) => [<span className="model-name">{tool.name}</span>, number(tool.calls), number(tool.succeeded), number(tool.failed), number(tool.unfinished), tool.durationP50 === undefined ? "—" : number(tool.durationP50)])} empty={t("도구 상세 사용 기록이 없습니다.")} />
  </div>
}

type DailyTokenUsage = { date: string; tokens: SessionStatsInfo["tokens"] }

export function DailyTokens(props: { filters: Filters }) {
  const [data, setData] = useState<DailyTokenUsage[]>()
  const [progress, setProgress] = useState<{ loaded: number; total: number }>()
  const [error, setError] = useState<string>()
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage || i18n.language
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  async function load() {
    if (progress) return
    const abort = new AbortController()
    controller.current = abort
    setError(undefined)
    setData(undefined)
    try {
      const queries = dailyStatsQueries(props.filters)
      const rows: DailyTokenUsage[] = []
      setProgress({ loaded: 0, total: queries.length })
      for (const day of queries) {
        const stats = await api<SessionStatsInfo>(`/api/stats?${day.query}`, abort.signal, lng)
        if (abort.signal.aborted) return
        rows.push({ date: day.date, tokens: stats.tokens })
        setProgress({ loaded: rows.length, total: queries.length })
      }
      setData(rows)
    } catch (cause) { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : t("일별 토큰을 불러오지 못했습니다.")) }
    finally { if (!abort.signal.aborted) setProgress(undefined) }
  }
  return <section className="space-y-4" aria-label={t("일별 토큰 조회")} aria-busy={!!progress}>
    <div className="section-heading"><div><h2 className="section-title">{t("일별 토큰 사용량")}</h2><p className="section-description">{props.filters.from} ~ {props.filters.to}</p></div><Button variant="outline" onClick={load} disabled={!!progress}><RefreshCw aria-hidden="true" className={progress ? "motion-safe:animate-spin" : ""} />{progress ? t("일별 토큰 조회 중…") : data ? t("일별 토큰 새로고침") : t("일별 토큰 불러오기")}</Button></div>
    {progress && <p role="status" className="text-xs text-muted-foreground">{t("{{loaded}} / {{total}}일 조회 완료", { ...progress, count: progress.total })}</p>}
    <Notice error={error} retry={load} />
    {data && <UsageChart title={t("날짜별 토큰 사용량")} stacked tokens data={data.filter((day) => totalTokens(day.tokens) > 0).map((day) => ({ label: day.date, input: day.tokens.input, output: day.tokens.output, reasoning: day.tokens.reasoning, cacheRead: day.tokens.cache.read, cacheWrite: day.tokens.cache.write }))} series={[{ key: "input", name: t("입력"), color: colors[0]! }, { key: "output", name: t("출력"), color: colors[1]! }, { key: "reasoning", name: t("추론"), color: colors[2]! }, { key: "cacheRead", name: t("캐시 읽기"), color: colors[3]! }, { key: "cacheWrite", name: t("캐시 쓰기"), color: colors[4]! }]} />}
  </section>
}

export function StatsPage(props: { filters: Filters; section: StatsSection }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.resolvedLanguage || i18n.language
  let query: string | undefined
  let error: string | undefined
  try { query = statsQuery(props.filters.from, props.filters.to, props.filters.project, lng) } catch (cause) { error = cause instanceof Error ? cause.message : t("조회 기간을 확인해 주세요.") }
  const resource = useApi<SessionStatsInfo>(query ? `/api/stats?${query}` : undefined)
  return <div className="space-y-6" aria-busy={resource.loading}><Notice loading={resource.loading} error={error || resource.error} retry={error ? undefined : resource.reload} />{resource.data && <><StatsView stats={resource.data} section={props.section} />{props.section === "overview" && <DailyTokens key={query} filters={props.filters} />}</>}</div>
}
