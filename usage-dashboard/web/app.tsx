import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import type { SessionStatsInfo, UsageLimitsInfo } from "@opencode/client"
import { budgetRows, dateInput, dateTime, money, number, statsQuery, totalTokens, type Projects } from "./data"
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

function Status(props: { reached: boolean }) {
  return <span className={`badge ${props.reached ? "danger" : "ok"}`}>{props.reached ? "한도 도달" : "사용 가능"}</span>
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

export function LimitsView(props: { info: UsageLimitsInfo | null }) {
  const info = props.info
  if (!info) return <div className="empty-state"><h2>Console 한도 정보가 없습니다</h2><p>현재 프로젝트에서 OpenCode Console에 로그인하면 한도를 조회할 수 있습니다.</p><p>OpenCode의 <code>/connect</code>를 이용해 주세요. 외부 공급자의 구독 잔량은 이 API에서 제공하지 않습니다.</p></div>
  const rows = budgetRows(info)
  const consoleURL = (() => {
    try { const url = new URL(info.workspace.usageURL); return url.protocol === "https:" ? url.href : undefined } catch { return undefined }
  })()
  return <>
    <div className="workspace"><div><h2>{info.workspace.name || "OpenCode Console"}</h2><p className="muted">Workspace · {info.workspace.id}</p></div>
      {consoleURL && <a className="button secondary" href={consoleURL} target="_blank" rel="noreferrer">Console에서 보기 ↗</a>}
    </div>
    <section>
      <div className="section-heading"><div><h2>OpenCode Go</h2><p>구간별 사용률과 초기화 시각</p></div></div>
      <Board title="OpenCode Go 한도" headers={["구간", "사용률", "남은 비율", "상태", "초기화 시각"]}
        rows={info.go ? (["rolling", "weekly", "monthly"] as const).map((key) => {
          const meter = info.go![key]
          return [{ rolling: "Rolling", weekly: "주간", monthly: "월간" }[key], <div className="meter"><progress max={100} value={meter.percent} aria-label={`${key} 사용률`} /><span>{number(meter.percent)}%</span></div>, `${number(100 - meter.percent)}%`, <Status reached={meter.limited} />, dateTime(meter.resetsAt)]
        }) : []} empty="이 워크스페이스의 Go 구독 정보가 없습니다." />
    </section>
    <section>
      <div className="section-heading"><div><h2>월간 예산 한도</h2><p>예산별 사용액과 잔액 · USD</p></div><span className="muted">{info.budgets.length}개 예산</span></div>
      <Board title="Console 예산 한도" headers={["예산 ID", "적용 대상", "범위", "집계 방식", "한도", "사용액", "잔액", "상태", "초기화 시각"]}
        rows={rows.map((row) => [<span className="model">{row.budget.id}</span>, <span className="target">{row.target}</span>, row.budget.scope === "each" ? "개인별" : row.budget.shared ? "워크스페이스 공유" : "구성원 합산", row.budget.per === "model" ? "모델별" : "묶음 합산", money(row.budget.limit), money(row.spent), money(row.remaining), <Status reached={row.spent >= row.budget.limit} />, dateTime(row.budget.resetsAt)])}
        empty="적용되는 예산 한도가 없습니다. 제한 없음이 무료 또는 크레딧 무제한을 의미하지는 않습니다." />
      <p className="footnote">공유·묶음 예산은 중복될 수 있으므로 행의 사용액이나 잔액을 합산하지 않습니다. 잔액은 max(0, 한도 − 해당 사용액)입니다.</p>
      {info.budgets.some((budget) => budget.vendors.length > 0 || budget.inputPriceAtLeast !== undefined || budget.picked) && <details><summary>예산 적용 조건</summary>
        <Board title="예산 적용 조건" headers={["예산 ID", "Coverage", "Vendors", "최소 입력 단가 · USD/1M", "개별 모델 지정"]}
          rows={info.budgets.map((budget) => [budget.id, budget.coverage, budget.vendors.join(", ") || "—", budget.inputPriceAtLeast === undefined ? "—" : money(budget.inputPriceAtLeast), budget.picked ? "예" : "아니오"])} />
      </details>}
    </section>
    <p className="footnote">현재 프로젝트의 Console 연결 기준입니다. 로컬 사용량 게시판의 합계와 Console 예산 사용액은 대상과 집계 기준이 다를 수 있습니다.</p>
  </>
}

function LimitsPage() {
  const resource = useApi<UsageLimitsInfo | null>("/api/limits")
  return <>
    <header className="page-heading"><div><div className="eyebrow">USAGE.LIMITS()</div><h1>한도 게시판</h1><p>OpenCode Console 예산 및 Go 사용 한도</p></div>
      <button disabled={resource.loading} onClick={resource.reload}>{resource.loading ? "조회 중…" : "새로고침"}</button>
    </header>
    <Notice loading={resource.loading} error={resource.error} />
    {resource.data !== undefined && <LimitsView info={resource.data} />}
  </>
}

function App() {
  const limits = window.location.pathname === "/limits"
  return <>
    <div className="topbar"><a className="brand" href="/stats"><span className="brand-mark">▥</span> OpenCode <span className="muted">/ usage</span></a><span className="local-badge">LOCAL · READ ONLY</span></div>
    <div className="layout"><nav aria-label="게시판 메뉴">
      <div className="nav-label">WORKSPACE</div>
      <a href="/stats" aria-current={!limits ? "page" : undefined}>사용량 게시판 <span>stats</span></a>
      <a href="/limits" aria-current={limits ? "page" : undefined}>한도 게시판 <span>limits</span></a>
      <p>공개 API 기반<br />별도 수집·저장 없음</p>
    </nav><main>{limits ? <LimitsPage /> : <StatsPage />}<footer>OpenCode V2 · Experimental API · 모든 비용은 USD입니다.</footer></main></div>
  </>
}

if (typeof document !== "undefined") createRoot(document.getElementById("root")!).render(<App />)
