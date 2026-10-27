import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import type { SessionStatsInfo } from "@opencode/client"
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

function Board(props: { title: string; headers: string[]; rows: ReactNode[][]; footer?: ReactNode[]; empty?: string }) {
  return <div className="table-scroll" tabIndex={0} role="region" aria-label={props.title}>
    <table>
      <caption>{props.title}</caption>
      <thead><tr>{props.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
      <tbody>{props.rows.length > 0
        ? props.rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)
        : <tr><td colSpan={props.headers.length} className="empty">{props.empty || "표시할 데이터가 없습니다."}</td></tr>}
      </tbody>
      {props.footer && <tfoot><tr>{props.footer.map((cell, index) => <td key={index}>{cell}</td>)}</tr></tfoot>}
    </table>
  </div>
}

function Notice(props: { loading: boolean; error?: string }) {
  if (props.error) return <div className="notice error" role="alert">{props.error}</div>
  if (props.loading) return <div className="notice" role="status">OpenCode에서 데이터를 불러오는 중입니다…</div>
  return null
}

export function StatsView(props: { stats: SessionStatsInfo }) {
  const [sort, setSort] = useState("tokens")
  const stats = props.stats
  const models = stats.models.toSorted((a, b) => sort === "model"
    ? `${a.model.providerID}/${a.model.id}`.localeCompare(`${b.model.providerID}/${b.model.id}`)
    : sort === "cost" ? b.cost - a.cost : sort === "steps" ? b.steps - a.steps : totalTokens(b.tokens) - totalTokens(a.tokens))
  const tokenCells = (tokens: SessionStatsInfo["tokens"]) => [tokens.input, tokens.output, tokens.reasoning, tokens.cache.read, tokens.cache.write, totalTokens(tokens)].map(number)

  return <>
    <div className="metrics">
      {[["전체 토큰", number(totalTokens(stats.tokens))], ["기록 비용 · USD", money(stats.cost)], ["세션", number(stats.sessions)], ["모델 Steps", number(stats.steps)]].map(([label, value]) =>
        <div className="metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <div className="meta-line">
      <span>프롬프트 <b>{number(stats.prompts)}</b></span><span>하위 세션 <b>{number(stats.subagents)}</b></span>
      <span>활동일 <b>{number(stats.activeDays)}일</b></span><span>최장 연속 <b>{number(stats.streak)}일</b></span>
      <span>{dateTime(stats.range.from)} ≤ 기록 시각 &lt; {dateTime(stats.range.to)}</span>
    </div>
    <section>
      <div className="section-heading"><div><h2>모델별 사용량</h2><p>공급자 / 모델 / variant 기준</p></div>
        <label className="inline-label">정렬<select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="tokens">토큰 많은 순</option><option value="cost">비용 높은 순</option><option value="steps">Steps 많은 순</option><option value="model">모델 이름순</option>
        </select></label>
      </div>
      <Board title="모델별 사용량" headers={["공급자", "모델", "Variant", "Steps", "입력", "출력", "추론", "캐시 읽기", "캐시 쓰기", "전체 토큰", "비용 · USD"]}
        rows={models.map((row) => [row.model.providerID, <span className="model">{row.model.id}</span>, row.model.variant || "기본", number(row.steps), ...tokenCells(row.tokens), money(row.cost)])}
        footer={["전체 (API)", "—", "—", number(stats.steps), ...tokenCells(stats.tokens), money(stats.cost)]}
        empty="선택한 기간과 프로젝트의 모델 사용 기록이 없습니다." />
      <p className="footnote">전체 토큰 = 입력 + 출력 + 추론 + 캐시 읽기 + 캐시 쓰기. 입력은 비캐시 입력, 출력은 추론을 제외한 값입니다.</p>
      <p className="footnote">비용은 공급자 보고액 또는 카탈로그 단가 추정액으로 실제 청구액과 다를 수 있습니다. 단가 누락으로 $0이 표시될 수도 있습니다. Compaction은 전체 합계에만 포함되어 모델 행 합계와 다를 수 있으며, title 사용량은 제외됩니다.</p>
    </section>
    <section>
      <div className="section-heading"><div><h2>도구 사용량</h2><p>호출 상태 및 실행시간 중앙값</p></div>
        {stats.tools.mode !== "none" && <span className="muted">전체 {number(stats.tools.totals.calls)} · 성공 {number(stats.tools.totals.succeeded)} · 실패 {number(stats.tools.totals.failed)} · 미완료 {number(stats.tools.totals.unfinished)}</span>}
      </div>
      <Board title="도구별 사용량" headers={["도구", "호출", "성공", "실패", "미완료", "실행시간 P50 · ms"]}
        rows={stats.tools.mode === "detail" ? stats.tools.usage.map((tool) => [<span className="model">{tool.name}</span>, number(tool.calls), number(tool.succeeded), number(tool.failed), number(tool.unfinished), tool.durationP50 === undefined ? "—" : number(tool.durationP50)]) : []}
        empty="도구 상세 사용 기록이 없습니다." />
    </section>
    <section>
      <details><summary>날짜별 활동 <span className="muted">{stats.activity.length}일 · 모델 Steps</span></summary>
        <Board title="날짜별 모델 Steps" headers={["날짜", "Steps"]} rows={stats.activity.map((day) => [day.date, number(day.steps)])} />
      </details>
      <p className="footnote">Steps는 논리적 모델 실행 수이며 HTTP 요청 수가 아닙니다. 날짜별 토큰·비용은 이 API에서 제공하지 않습니다.</p>
    </section>
  </>
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
    <header className="page-heading"><div><div className="eyebrow">SESSION.STATS()</div><h1>사용량 게시판</h1><p>OpenCode에 저장된 토큰, 비용, 모델 및 도구 사용 기록</p></div></header>
    <form className="filters" onSubmit={apply}>
      <label>시작일<input type="date" required value={filters.from} max={filters.to} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
      <label>종료일<input type="date" required min={filters.from} value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
      <label className="project-filter">프로젝트<select value={filters.project} onChange={(event) => setFilters({ ...filters, project: event.target.value })}>
        <option value="">현재 프로젝트</option><option value="all">전체 프로젝트</option>
        {projects.data?.projects.filter((project) => project.id !== projects.data?.current).map((project) => <option key={project.id} value={project.id}>{project.name || project.canonical}</option>)}
      </select></label>
      <button type="submit" disabled={resource.loading}>{resource.loading ? "조회 중…" : "조회 / 새로고침"}</button>
    </form>
    {projects.data && <p className="location">현재 위치: {projects.data.directory}</p>}
    {projects.error && <p className="notice error" role="alert">프로젝트 목록: {projects.error} <button onClick={projects.reload}>다시 시도</button></p>}
    <Notice loading={resource.loading} error={error || resource.error} />
    {resource.data && <StatsView stats={resource.data} />}
  </>
}

function App() {
  return <>
    <div className="topbar"><a className="brand" href="/stats"><span className="brand-mark">▥</span> OpenCode <span className="muted">/ usage</span></a><span className="local-badge">LOCAL · READ ONLY</span></div>
    <main><StatsPage /><footer>OpenCode V2 · Experimental API · 모든 비용은 USD입니다.</footer></main>
  </>
}

if (typeof document !== "undefined") createRoot(document.getElementById("root")!).render(<App />)
