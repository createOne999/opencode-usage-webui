import { useEffect, useRef, useState } from "react"
import type { SessionStatsInfo } from "@opencode/client"
import { ArrowDownWideNarrow, Coins, Layers, RefreshCw, Terminal, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { NativeSelect } from "@/components/ui/native-select"
import { api, Board, Notice, useApi } from "./shared"
import { colors, UsageChart } from "./charts"
import { dailyStatsQueries, dateTime, money, number, statsQuery, tokenNumber, totalTokens, type Filters } from "./data"

export type StatsSection = "overview" | "models" | "tools"

export function StatsView(props: { stats: SessionStatsInfo; section: StatsSection }) {
  const [sort, setSort] = useState("tokens")
  const stats = props.stats
  const models = stats.models.toSorted((a, b) => sort === "model"
    ? `${a.model.providerID}/${a.model.id}`.localeCompare(`${b.model.providerID}/${b.model.id}`)
    : sort === "cost" ? b.cost - a.cost : sort === "steps" ? b.steps - a.steps : totalTokens(b.tokens) - totalTokens(a.tokens))
  const tokenCells = (tokens: SessionStatsInfo["tokens"]) => [tokens.input, tokens.output, tokens.reasoning, tokens.cache.read, tokens.cache.write, totalTokens(tokens)].map(tokenNumber)
  const tools = stats.tools.mode === "detail" ? stats.tools.usage.toSorted((a, b) => b.calls - a.calls) : []
  const notes = <div className="space-y-2 rounded-lg border border-dashed px-4 py-3"><p className="footnote">전체 토큰 = 입력 + 출력 + 추론 + 캐시 읽기 + 캐시 쓰기. 입력은 비캐시 입력, 출력은 추론을 제외한 값입니다.</p><p className="footnote">비용은 공급자 보고액 또는 카탈로그 단가 추정액으로 실제 청구액과 다를 수 있습니다. 단가 누락으로 $0이 표시될 수도 있습니다. Compaction은 전체 합계에만 포함되어 모델 행 합계와 다를 수 있으며, title 사용량은 제외됩니다.</p></div>

  if (props.section === "overview") return <div className="data-enter space-y-6">
    <section aria-label="사용량 요약">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: "전체 토큰", value: tokenNumber(totalTokens(stats.tokens)), icon: Layers },
        { label: "기록 비용 · USD", value: money(stats.cost), icon: Coins },
        { label: "세션", value: number(stats.sessions), icon: Terminal },
        { label: "모델 Steps", value: number(stats.steps), icon: Zap },
      ].map(({ label, value, icon: Icon }) => <Card key={label} className="min-w-0 gap-4 p-4 sm:p-5"><div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{label}</span><Icon aria-hidden="true" className="size-4 shrink-0 text-primary/80" /></div><strong className="text-xl font-semibold tracking-tight break-all tabular-nums sm:text-2xl xl:text-3xl">{value}</strong></Card>)}</div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span>프롬프트 <b>{number(stats.prompts)}</b></span><span>하위 세션 <b>{number(stats.subagents)}</b></span><span>활동일 <b>{number(stats.activeDays)}일</b></span><span>최장 연속 <b>{number(stats.streak)}일</b></span></div>
      <p className="mt-3 footnote">{dateTime(stats.range.from)} ≤ 기록 시각 &lt; {dateTime(stats.range.to)}</p>
    </section>
    <div className="grid gap-5 xl:grid-cols-2">
      <UsageChart title="날짜별 모델 Steps" description="활동 기록이 있는 날짜만 표시합니다." data={stats.activity.map((day) => ({ label: day.date, steps: day.steps }))} series={[{ key: "steps", name: "Steps", color: colors[0]! }]} />
      <UsageChart title="토큰 구성" tokens data={[{ label: "입력", tokens: stats.tokens.input }, { label: "출력", tokens: stats.tokens.output }, { label: "추론", tokens: stats.tokens.reasoning }, { label: "캐시 읽기", tokens: stats.tokens.cache.read }, { label: "캐시 쓰기", tokens: stats.tokens.cache.write }]} series={[{ key: "tokens", name: "토큰", color: colors[1]! }]} />
    </div>
    <p className="footnote">Steps는 논리적 모델 실행 수이며 HTTP 요청 수가 아닙니다. 일별 토큰은 아래에서 하루 단위 집계를 별도 조회합니다.</p>
    {notes}
  </div>

  if (props.section === "models") return <div className="data-enter space-y-6">
    <div className="section-heading"><div><h2 className="section-title">모델별 사용량</h2><p className="section-description">공급자 / 모델 / variant 기준 · 그래프는 현재 정렬의 앞 10개, 표는 전체</p></div><label className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowDownWideNarrow aria-hidden="true" className="size-3.5" />정렬<NativeSelect name="sort" size="sm" value={sort} onChange={(event) => setSort(event.target.value)}><option value="tokens">토큰 많은 순</option><option value="cost">비용 높은 순</option><option value="steps">Steps 많은 순</option><option value="model">모델 이름순</option></NativeSelect></label></div>
    <div className="grid gap-5 xl:grid-cols-2">
      <UsageChart title="모델 토큰 비교" tokens data={models.slice(0, 10).map((row) => ({ label: `${row.model.providerID}/${row.model.id} · ${row.model.variant || "기본"}`, tokens: totalTokens(row.tokens) }))} series={[{ key: "tokens", name: "전체 토큰", color: colors[0]! }]} />
      <UsageChart title="모델 비용 비교" currency data={models.slice(0, 10).map((row) => ({ label: `${row.model.providerID}/${row.model.id} · ${row.model.variant || "기본"}`, cost: row.cost }))} series={[{ key: "cost", name: "비용 · USD", color: colors[2]! }]} />
    </div>
    <Board title="모델별 사용량" numericFrom={3} headers={["공급자", "모델", "Variant", "Steps", "입력", "출력", "추론", "캐시 읽기", "캐시 쓰기", "전체 토큰", "비용 · USD"]} rows={models.map((row) => [<span className="font-mono text-xs text-muted-foreground">{row.model.providerID}</span>, <span className="model-name">{row.model.id}</span>, <Badge variant="secondary">{row.model.variant || "기본"}</Badge>, number(row.steps), ...tokenCells(row.tokens), money(row.cost)])} footer={["전체 (API)", "—", "—", number(stats.steps), ...tokenCells(stats.tokens), money(stats.cost)]} empty="선택한 기간과 프로젝트의 모델 사용 기록이 없습니다." />
    {notes}
  </div>

  return <div className="data-enter space-y-6">
    <div className="section-heading"><div><h2 className="section-title">도구 사용량</h2><p className="section-description">호출 많은 순 · 그래프는 상위 10개, 표는 전체</p></div>{stats.tools.mode !== "none" && <div className="flex flex-wrap gap-2" aria-label="도구 호출 요약"><Badge variant="outline">전체 {number(stats.tools.totals.calls)}</Badge><Badge variant="secondary">성공 {number(stats.tools.totals.succeeded)}</Badge><Badge variant="outline">실패 {number(stats.tools.totals.failed)}</Badge><Badge variant="outline">미완료 {number(stats.tools.totals.unfinished)}</Badge></div>}</div>
    <UsageChart title="도구 호출 상태" data={tools.slice(0, 10).map((tool) => ({ label: tool.name, succeeded: tool.succeeded, failed: tool.failed, unfinished: tool.unfinished }))} series={[{ key: "succeeded", name: "성공", color: colors[1]! }, { key: "failed", name: "실패", color: colors[4]! }, { key: "unfinished", name: "미완료", color: colors[2]! }]} />
    <Board title="도구별 사용량" headers={["도구", "호출", "성공", "실패", "미완료", "실행시간 P50 · ms"]} rows={tools.map((tool) => [<span className="model-name">{tool.name}</span>, number(tool.calls), number(tool.succeeded), number(tool.failed), number(tool.unfinished), tool.durationP50 === undefined ? "—" : number(tool.durationP50)])} empty="도구 상세 사용 기록이 없습니다." />
  </div>
}

type DailyTokenUsage = { date: string; tokens: SessionStatsInfo["tokens"] }

export function DailyTokens(props: { filters: Filters }) {
  const [data, setData] = useState<DailyTokenUsage[]>()
  const [progress, setProgress] = useState<{ loaded: number; total: number }>()
  const [error, setError] = useState<string>()
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
        const stats = await api<SessionStatsInfo>(`/api/stats?${day.query}`, abort.signal)
        if (abort.signal.aborted) return
        rows.push({ date: day.date, tokens: stats.tokens })
        setProgress({ loaded: rows.length, total: queries.length })
      }
      setData(rows)
    } catch (cause) { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "일별 토큰을 불러오지 못했습니다.") }
    finally { if (!abort.signal.aborted) setProgress(undefined) }
  }
  return <section className="space-y-4" aria-label="일별 토큰 조회" aria-busy={!!progress}>
    <div className="section-heading"><div><h2 className="section-title">일별 토큰 사용량</h2><p className="section-description">{props.filters.from} ~ {props.filters.to} · 브라우저 시간대 · 1일 단위</p></div><Button variant="outline" onClick={load} disabled={!!progress}><RefreshCw aria-hidden="true" className={progress ? "motion-safe:animate-spin" : ""} />{progress ? "일별 토큰 조회 중…" : data ? "일별 토큰 새로고침" : "일별 토큰 불러오기"}</Button></div>
    <p className="footnote">버튼을 누르면 하루당 한 번씩 순차 조회합니다(최대 100일). Steps가 없는 날도 압축 사용량이 있을 수 있어 모든 날짜를 조회합니다. 전체 세션이나 대화 본문은 수집하지 않습니다.</p>
    {progress && <p role="status" className="text-xs text-muted-foreground">{progress.loaded} / {progress.total}일 조회 완료</p>}
    <Notice error={error} retry={load} />
    {data && <UsageChart title="날짜별 토큰 사용량" description="입력은 비캐시 입력, 출력은 추론 제외입니다. 압축 토큰을 포함하며 캐시 읽기·쓰기는 구분합니다." line tokens data={data.map((day) => ({ label: day.date, input: day.tokens.input, output: day.tokens.output, reasoning: day.tokens.reasoning, cacheRead: day.tokens.cache.read, cacheWrite: day.tokens.cache.write }))} series={[{ key: "input", name: "입력", color: colors[0]! }, { key: "output", name: "출력", color: colors[1]! }, { key: "reasoning", name: "추론", color: colors[2]! }, { key: "cacheRead", name: "캐시 읽기", color: colors[3]! }, { key: "cacheWrite", name: "캐시 쓰기", color: colors[4]! }]} />}
  </section>
}

export function StatsPage(props: { filters: Filters; section: StatsSection }) {
  let query: string | undefined
  let error: string | undefined
  try { query = statsQuery(props.filters.from, props.filters.to, props.filters.project) } catch (cause) { error = cause instanceof Error ? cause.message : "조회 기간을 확인해 주세요." }
  const resource = useApi<SessionStatsInfo>(query ? `/api/stats?${query}` : undefined)
  return <div className="space-y-6" aria-busy={resource.loading}><Notice loading={resource.loading} error={error || resource.error} retry={error ? undefined : resource.reload} />{resource.data && <><StatsView stats={resource.data} section={props.section} />{props.section === "overview" && <DailyTokens key={query} filters={props.filters} />}</>}</div>
}
