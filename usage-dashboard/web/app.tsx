import { useState, type FormEvent } from "react"
import { createRoot } from "react-dom/client"
import { ChartNoAxesCombined, FolderOpen, LockKeyhole, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Notice, useApi } from "./shared"
import { StatsPage } from "./stats"
import { SessionsPage, SessionDetail } from "./sessions"
import { pageHref, readFilters, statsQuery, type Filters, type Projects } from "./data"
import "./styles.css"

function FiltersForm(props: { filters: Filters; action: string; projects?: Projects }) {
  const [filters, setFilters] = useState(props.filters)
  const [error, setError] = useState<string>()
  function apply(event: FormEvent) {
    event.preventDefault()
    try { statsQuery(filters.from, filters.to, filters.project); window.location.assign(pageHref(props.action.startsWith("/sessions/") && filters.project !== props.filters.project ? "/sessions" : props.action, filters)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "조회 조건을 확인해 주세요.") }
  }
  return <div className="mb-7"><Card className="p-4 sm:p-5"><form className="grid grid-cols-2 items-end gap-4 md:grid-cols-[auto_auto_minmax(0,1fr)_auto]" onSubmit={apply} aria-label="사용량 조회 조건">
    <label className="field-label">시작일<Input name="from" className="h-10 min-w-0 text-foreground" type="date" required value={filters.from} max={filters.to} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
    <label className="field-label">종료일<Input name="to" className="h-10 min-w-0 text-foreground" type="date" required min={filters.from} value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
    <label className="field-label [&>[data-slot=native-select-wrapper]]:w-full">프로젝트<NativeSelect name="project" className="h-10 text-foreground" value={filters.project} onChange={(event) => setFilters({ ...filters, project: event.target.value })}><option value="">현재 프로젝트</option><option value="all">전체 프로젝트</option>{props.projects?.projects.filter((project) => project.id !== props.projects?.current).map((project) => <option key={project.id} value={project.id}>{project.name || project.canonical}</option>)}</NativeSelect></label>
    <Button className="h-10" type="submit"><RefreshCw aria-hidden="true" />조회 / 새로고침</Button>
  </form></Card>{error && <div className="mt-3"><Notice error={error} /></div>}</div>
}

export function App(props: { location?: { pathname: string; search: string } }) {
  const location = props.location ?? (typeof window === "undefined" ? { pathname: "/stats", search: "" } : window.location)
  const filters = readFilters(location.search)
  const params = new URLSearchParams(location.search)
  const projects = useApi<Projects>("/api/projects")
  const detail = location.pathname.match(/^\/sessions\/(ses_[\w-]+)$/)
  const section = location.pathname === "/models" ? "models" : location.pathname === "/tools" ? "tools" : "overview"
  const sessions = location.pathname === "/sessions" || !!detail
  const title = detail ? "세션 · 요청별 컨텍스트" : sessions ? "세션 탐색" : section === "models" ? "모델별 사용량" : section === "tools" ? "도구 사용량" : "사용량 개요"
  return <>
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">본문으로 이동</a>
    <div className="border-b bg-card/60"><div className="mx-auto flex min-h-16 max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8"><a className="flex items-center gap-2.5 font-semibold tracking-tight" href={pageHref("/stats", filters)}><span className="flex size-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"><ChartNoAxesCombined aria-hidden="true" className="size-4" /></span>OpenCode <span className="font-normal text-muted-foreground">/ usage</span></a></div>
      <nav aria-label="주 메뉴" className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 sm:px-8">{[["/stats", "개요"], ["/models", "모델"], ["/tools", "도구"], ["/sessions", "세션 / 요청"]].map(([path, label]) => <a key={path} href={pageHref(path!, filters)} aria-current={(sessions ? path === "/sessions" : path === location.pathname || (path === "/stats" && location.pathname === "/")) ? "page" : undefined} className="nav-link">{label}</a>)}</nav>
    </div>
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1600px] px-4 py-7 sm:px-8 sm:py-10">
      <header className="mb-7"><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1></header>
      <FiltersForm filters={filters} action={location.pathname === "/" ? "/stats" : location.pathname} projects={projects.data} />
      {projects.error && <div className="mb-5"><Notice error={`프로젝트 목록: ${projects.error}`} retry={projects.reload} /></div>}
      {detail ? <SessionDetail sessionID={detail[1]!} filters={filters} params={params} /> : sessions ? <SessionsPage filters={filters} params={params} /> : <StatsPage filters={filters} section={section} />}
      <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t pt-5 text-xs leading-relaxed text-muted-foreground"><span>OpenCode V2 · Experimental API</span></footer>
    </main>
  </>
}

if (typeof document !== "undefined") createRoot(document.getElementById("root")!).render(<App />)
