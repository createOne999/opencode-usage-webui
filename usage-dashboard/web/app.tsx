import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import type { SessionStatsInfo } from "@opencode/client"
import { Activity, ArrowDownWideNarrow, CalendarDays, ChartNoAxesCombined, ChevronDown, CircleAlert, Coins, FolderOpen, Info, Layers, LockKeyhole, RefreshCw, Terminal, Zap } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { dateInput, dateTime, money, number, statsQuery, totalTokens, type Projects } from "./data"
import "./styles.css"

function useApi<T>(path: string) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ data?: T; loading: boolean; error?: string }>({ loading: true })
  useEffect(() => {
    const controller = new AbortController()
    setState({ loading: true })
    void (async () => {
      try {
        const response = await fetch(path, { headers: { "x-dashboard-request": "1" }, signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "데이터를 불러오지 못했습니다.")
        if (!controller.signal.aborted) setState({ data, loading: false })
      } catch (error) {
        if (!controller.signal.aborted) setState({ loading: false, error: error instanceof Error ? error.message : "연결에 실패했습니다." })
      }
    })()
    return () => controller.abort()
  }, [path, revision])
  return { ...state, reload: () => setRevision((value) => value + 1) }
}

function Board(props: { title: string; headers: string[]; rows: ReactNode[][]; footer?: ReactNode[]; empty?: string; numericFrom?: number }) {
  const numericFrom = props.numericFrom ?? 1
  return <div className="table-scroll" tabIndex={0} role="region" aria-label={props.title}>
    <Table>
      <TableCaption className="sr-only">{props.title}</TableCaption>
      <TableHeader><TableRow>{props.headers.map((header, index) => <TableHead key={header} scope="col" className={index >= numericFrom ? "text-right" : "text-left"}>{header}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{props.rows.length > 0
        ? props.rows.map((row, index) => <TableRow key={index}>{row.map((cell, column) => <TableCell key={column} className={column >= numericFrom ? "text-right" : "text-left"}>{cell}</TableCell>)}</TableRow>)
        : <TableRow><TableCell colSpan={props.headers.length} className="h-36 text-center whitespace-normal text-muted-foreground"><FolderOpen aria-hidden="true" className="mx-auto mb-3 size-6 opacity-60" />{props.empty || "표시할 데이터가 없습니다."}</TableCell></TableRow>}
      </TableBody>
      {props.footer && <TableFooter><TableRow>{props.footer.map((cell, index) => <TableCell key={index} className={index >= numericFrom ? "text-right" : "text-left"}>{cell}</TableCell>)}</TableRow></TableFooter>}
    </Table>
  </div>
}

function Notice(props: { loading: boolean; error?: string; retry?: () => void }) {
  if (props.error) return <Alert variant="destructive" className="border-destructive/30">
    <CircleAlert aria-hidden="true" /><AlertTitle>조회하지 못했습니다</AlertTitle>
    <AlertDescription><p>{props.error}</p>{props.retry && <Button variant="outline" size="sm" className="mt-2 text-foreground" onClick={props.retry}><RefreshCw aria-hidden="true" />다시 시도</Button>}</AlertDescription>
  </Alert>
  if (props.loading) return <div role="status" className="space-y-5">
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />OpenCode에서 데이터를 불러오는 중입니다…</p>
    <div aria-hidden="true" className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((key) => <Card key={key} className="gap-4 p-5"><Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-3/4" /></Card>)}</div>
      <div className="space-y-3 rounded-xl border bg-card p-5">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-10 w-full" />)}</div>
    </div>
  </div>
  return null
}

export function StatsView(props: { stats: SessionStatsInfo }) {
  const [sort, setSort] = useState("tokens")
  const stats = props.stats
  const models = stats.models.toSorted((a, b) => sort === "model"
    ? `${a.model.providerID}/${a.model.id}`.localeCompare(`${b.model.providerID}/${b.model.id}`)
    : sort === "cost" ? b.cost - a.cost : sort === "steps" ? b.steps - a.steps : totalTokens(b.tokens) - totalTokens(a.tokens))
  const tokenCells = (tokens: SessionStatsInfo["tokens"]) => [tokens.input, tokens.output, tokens.reasoning, tokens.cache.read, tokens.cache.write, totalTokens(tokens)].map(number)

  return <div className="data-enter space-y-8">
    <section aria-label="사용량 요약">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "전체 토큰", value: number(totalTokens(stats.tokens)), icon: Layers },
          { label: "기록 비용 · USD", value: money(stats.cost), icon: Coins },
          { label: "세션", value: number(stats.sessions), icon: Terminal },
          { label: "모델 Steps", value: number(stats.steps), icon: Zap },
        ].map(({ label, value, icon: Icon }) => <Card key={label} className="min-w-0 gap-4 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{label}</span><Icon aria-hidden="true" className="size-4 shrink-0 text-primary/80" /></div>
          <strong className="text-xl font-semibold tracking-tight break-all tabular-nums sm:text-2xl xl:text-3xl">{value}</strong>
        </Card>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span>프롬프트 <b className="ml-1 font-medium text-foreground">{number(stats.prompts)}</b></span>
        <span>하위 세션 <b className="ml-1 font-medium text-foreground">{number(stats.subagents)}</b></span>
        <span>활동일 <b className="ml-1 font-medium text-foreground">{number(stats.activeDays)}일</b></span>
        <span>최장 연속 <b className="ml-1 font-medium text-foreground">{number(stats.streak)}일</b></span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{dateTime(stats.range.from)} ≤ 기록 시각 &lt; {dateTime(stats.range.to)}</p>
    </section>
    <section>
      <div className="section-heading"><div><h2 id="models-heading" className="section-title"><Layers aria-hidden="true" className="size-4 text-primary" />모델별 사용량</h2><p className="section-description">공급자 / 모델 / variant 기준</p></div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowDownWideNarrow aria-hidden="true" className="size-3.5" />정렬<NativeSelect size="sm" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="tokens">토큰 많은 순</option><option value="cost">비용 높은 순</option><option value="steps">Steps 많은 순</option><option value="model">모델 이름순</option>
        </NativeSelect></label>
      </div>
      <Board title="모델별 사용량" numericFrom={3} headers={["공급자", "모델", "Variant", "Steps", "입력", "출력", "추론", "캐시 읽기", "캐시 쓰기", "전체 토큰", "비용 · USD"]}
        rows={models.map((row) => [<span className="font-mono text-xs text-muted-foreground">{row.model.providerID}</span>, <span className="model-name">{row.model.id}</span>, <Badge variant="secondary">{row.model.variant || "기본"}</Badge>, number(row.steps), ...tokenCells(row.tokens), money(row.cost)])}
        footer={["전체 (API)", "—", "—", number(stats.steps), ...tokenCells(stats.tokens), money(stats.cost)]}
        empty="선택한 기간과 프로젝트의 모델 사용 기록이 없습니다." />
      <div className="mt-4 space-y-2 rounded-lg border border-dashed px-4 py-3">
        <p className="footnote flex items-start gap-2"><Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /><span>전체 토큰 = 입력 + 출력 + 추론 + 캐시 읽기 + 캐시 쓰기. 입력은 비캐시 입력, 출력은 추론을 제외한 값입니다.</span></p>
        <p className="footnote">비용은 공급자 보고액 또는 카탈로그 단가 추정액으로 실제 청구액과 다를 수 있습니다. 단가 누락으로 $0이 표시될 수도 있습니다. Compaction은 전체 합계에만 포함되어 모델 행 합계와 다를 수 있으며, title 사용량은 제외됩니다.</p>
      </div>
    </section>
    <section>
      <div className="section-heading"><div><h2 id="tools-heading" className="section-title"><Terminal aria-hidden="true" className="size-4 text-primary" />도구 사용량</h2><p className="section-description">호출 상태 및 실행시간 중앙값</p></div>
        {stats.tools.mode !== "none" && <div className="flex flex-wrap gap-2" aria-label="도구 호출 요약"><Badge variant="outline">전체 {number(stats.tools.totals.calls)}</Badge><Badge variant="secondary">성공 {number(stats.tools.totals.succeeded)}</Badge><Badge variant="outline">실패 {number(stats.tools.totals.failed)}</Badge><Badge variant="outline">미완료 {number(stats.tools.totals.unfinished)}</Badge></div>}
      </div>
      <Board title="도구별 사용량" headers={["도구", "호출", "성공", "실패", "미완료", "실행시간 P50 · ms"]}
        rows={stats.tools.mode === "detail" ? stats.tools.usage.map((tool) => [<span className="model-name">{tool.name}</span>, number(tool.calls), number(tool.succeeded), number(tool.failed), number(tool.unfinished), tool.durationP50 === undefined ? "—" : number(tool.durationP50)]) : []}
        empty="도구 상세 사용 기록이 없습니다." />
    </section>
    <section aria-label="날짜별 활동">
      <details className="group rounded-xl border bg-card p-4 sm:p-5"><summary className="flex list-none flex-wrap items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden"><CalendarDays aria-hidden="true" className="size-4 text-primary" />날짜별 활동 <span className="text-xs font-normal text-muted-foreground">{stats.activity.length}일 · 모델 Steps</span><ChevronDown aria-hidden="true" className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" /></summary>
        <div className="mt-4"><Board title="날짜별 모델 Steps" headers={["날짜", "Steps"]} rows={stats.activity.map((day) => [day.date, number(day.steps)])} /></div>
      </details>
      <p className="footnote mt-3">Steps는 논리적 모델 실행 수이며 HTTP 요청 수가 아닙니다. 날짜별 토큰·비용은 이 API에서 제공하지 않습니다.</p>
    </section>
  </div>
}

function StatsPage() {
  const now = new Date()
  const [filters, setFilters] = useState({ from: dateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to: dateInput(now), project: "" })
  const [query, setQuery] = useState(() => statsQuery(filters.from, filters.to, filters.project))
  const [error, setError] = useState<string>()
  const resource = useApi<SessionStatsInfo>(`/api/stats?${query}`)
  const projects = useApi<Projects>("/api/projects")
  function apply(event: FormEvent) {
    event.preventDefault()
    try {
      setQuery(statsQuery(filters.from, filters.to, filters.project))
      setError(undefined)
      resource.reload()
    } catch (error) {
      setError(error instanceof Error ? error.message : "조회 기간을 확인해 주세요.")
    }
  }
  return <>
    <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
      <div><p className="mb-3 font-mono text-[10px] font-medium tracking-[0.2em] text-primary">WORKSPACE ANALYTICS</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">사용량 게시판</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">OpenCode에 저장된 토큰, 비용, 모델 및 도구 사용 기록</p></div>
      <Badge variant="outline" className="gap-1.5 font-mono text-[10px] text-muted-foreground"><Activity aria-hidden="true" />SESSION.STATS()</Badge>
    </header>
    <Card className="mb-3 p-4 sm:p-5">
      <form className="grid grid-cols-2 items-end gap-4 md:grid-cols-[auto_auto_minmax(0,1fr)_auto]" onSubmit={apply} aria-label="사용량 조회 조건">
        <label className="field-label">시작일<Input className="h-10 min-w-0 text-foreground" type="date" required value={filters.from} max={filters.to} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
        <label className="field-label">종료일<Input className="h-10 min-w-0 text-foreground" type="date" required min={filters.from} value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
        <label className="field-label [&>[data-slot=native-select-wrapper]]:w-full">프로젝트<NativeSelect className="h-10 text-foreground" value={filters.project} onChange={(event) => setFilters({ ...filters, project: event.target.value })}>
          <option value="">현재 프로젝트</option><option value="all">전체 프로젝트</option>
          {projects.data?.projects.filter((project) => project.id !== projects.data?.current).map((project) => <option key={project.id} value={project.id}>{project.name || project.canonical}</option>)}
        </NativeSelect></label>
        <Button className="h-10" type="submit" disabled={resource.loading}><RefreshCw aria-hidden="true" className={resource.loading ? "motion-safe:animate-spin" : ""} />{resource.loading ? "조회 중…" : "조회 / 새로고침"}</Button>
      </form>
    </Card>
    {projects.data && <p className="mb-7 flex items-start gap-2 px-1 text-xs leading-relaxed text-muted-foreground"><FolderOpen aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /><span className="min-w-0 break-all">현재 위치: {projects.data.directory}</span></p>}
    {projects.error && <Alert variant="destructive" className="my-5 border-destructive/30"><CircleAlert aria-hidden="true" /><AlertTitle>프로젝트 목록을 불러오지 못했습니다</AlertTitle><AlertDescription><p>{projects.error}</p><Button variant="outline" size="sm" className="mt-2 text-foreground" onClick={projects.reload}>다시 시도</Button></AlertDescription></Alert>}
    <div className="mt-6" aria-busy={resource.loading}>
      <Notice loading={resource.loading} error={error || resource.error} retry={error ? undefined : resource.reload} />
      {resource.data && <StatsView stats={resource.data} />}
    </div>
  </>
}

export function App() {
  return <>
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">본문으로 이동</a>
    <div className="border-b bg-card/60"><div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-8">
      <a className="flex items-center gap-2.5 font-semibold tracking-tight" href="/stats"><span className="flex size-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"><ChartNoAxesCombined aria-hidden="true" className="size-4" /></span>OpenCode <span className="font-normal text-muted-foreground">/ usage</span></a>
      <Badge variant="outline" className="gap-1.5 text-[10px] text-muted-foreground"><LockKeyhole aria-hidden="true" />LOCAL · READ ONLY</Badge>
    </div></div>
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1600px] px-4 py-7 sm:px-8 sm:py-10"><StatsPage />
      <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t pt-5 text-xs leading-relaxed text-muted-foreground"><span>OpenCode V2 · Experimental API · 모든 비용은 USD입니다.</span><span>공개 API 기반 · 별도 수집·저장 없음</span></footer>
    </main>
  </>
}

if (typeof document !== "undefined") createRoot(document.getElementById("root")!).render(<App />)
