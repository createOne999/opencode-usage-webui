import { useEffect, useRef, useState } from "react"
import { ArrowLeft, Info, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { historyWindow, type HistoryPage, type RecordedMessage, type RequestPage, type SessionPage } from "../history"
import { colors, UsageChart } from "./charts"
import { dateTime, money, number, pageHref, requestHref, requestPoints, statsQuery, totalTokens, type Filters } from "./data"
import { api, Board, Notice, Pagination, useApi } from "./shared"

export function SessionsPage(props: { filters: Filters; params: URLSearchParams }) {
  const search = props.params.get("search") || ""
  const parent = props.params.get("parent") || ""
  const cursor = props.params.get("cursor") || ""
  const resource = useApi<SessionPage>(`/api/sessions?${new URLSearchParams({ project: props.filters.project, search, parent, cursor })}`)
  const href = (value?: string | null) => value ? pageHref("/sessions", props.filters, { search, parent, cursor: value }) : undefined
  return <div className="space-y-5" aria-busy={resource.loading}>
    <p className="footnote">세션 목록은 프로젝트·제목 기준이며 최근 수정 순입니다. 기간 필터는 세션 상세의 요청 기록에 적용됩니다. 세션 비용·토큰은 세션 전체 누적입니다.</p>
    <Card className="p-4"><form action="/sessions" method="get" className="flex flex-wrap items-end gap-3" aria-label="세션 검색">
      {Object.entries(props.filters).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}{parent && <input type="hidden" name="parent" value={parent} />}
      <label className="field-label min-w-0 flex-1">세션 제목<Input name="search" defaultValue={search} maxLength={256} placeholder="제목 검색" /></label><Button type="submit">검색</Button>
    </form></Card>
    {parent && <p className="text-xs">상위 세션: <a className="request-link" href={pageHref(`/sessions/${parent}`, props.filters)}>{parent}</a></p>}
    <Notice loading={resource.loading} error={resource.error} retry={resource.reload} />
    {resource.data && <><Board title="세션 목록" numericFrom={3} headers={["세션", "위치", "최근 수정", "전체 토큰", "누적 비용 · USD"]} rows={resource.data.data.map((session) => [<a className="request-link block min-w-40 max-w-80 whitespace-normal break-words" href={pageHref(`/sessions/${session.id}`, props.filters)}>{session.title || "제목 없음"}{session.parentID && <Badge variant="secondary" className="ml-2">하위 세션</Badge>}</a>, <span className="model-name">{session.location.directory}</span>, dateTime(session.time.updated), number(totalTokens(session.tokens)), money(session.cost)])} empty="조건에 맞는 세션이 없습니다." /><Pagination previous={href(resource.data.cursor.previous)} next={href(resource.data.cursor.next)} /></>}
  </div>
}

export function RecordedMessageView(props: { message: RecordedMessage }) {
  const message = props.message
  return <article className="min-w-0 rounded-lg border bg-card p-4">
    <header className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-semibold">{message.label}</h3><time className="text-[11px] text-muted-foreground" dateTime={new Date(message.created).toISOString()}>{dateTime(message.created)}</time></header>
    {message.checkpoint?.native && <p className="mb-3 footnote">공급자 전용 압축 창입니다. 저장된 요약만 표시하며 원시 재생 데이터는 노출하지 않습니다.</p>}
    {message.blocks.map((block, index) => <details key={index} className="mt-2" open={["메시지", "압축 요약", "지침", "복원 제한"].includes(block.label)}><summary className="py-1 text-xs text-muted-foreground">{block.label}</summary><pre tabIndex={0} aria-label={block.label} className="record-text mt-2">{block.text}</pre></details>)}
    {!message.blocks.length && !message.checkpoint?.native && <p className="footnote">이 기록에는 표시할 텍스트가 없습니다.</p>}
  </article>
}

export function ContextView(props: { data: HistoryPage; prior?: RecordedMessage[]; hasOlder: boolean }) {
  const data = props.data
  const messages = [...(props.prior ?? []), ...data.data]
  const window = historyWindow(messages, data.request.model)
  return <div className="space-y-5">
    <Alert><Info aria-hidden="true" /><AlertTitle>저장 이력 기반 재구성 · 실제 전송 원문이 아닙니다</AlertTitle><AlertDescription><p>선택한 Step 바로 이전 기록을 메시지 순서로 표시합니다. 당시 시스템 지침 전체·도구 정의·플러그인 변환·공급자 최종 입력은 복원할 수 없습니다. 저장된 메시지의 현재 투영본이므로 당시 상태와 차이가 있을 수 있습니다.</p><p>에이전트 변경·실행 종료 등 일부 항목은 흐름 설명용이며 모델 입력에 그대로 포함된다는 뜻이 아닙니다.</p></AlertDescription></Alert>
    <div className="flex flex-wrap gap-2"><Badge variant="outline">요청 시각 {dateTime(data.request.time.created)}</Badge><Badge variant="secondary">{data.request.model.providerID}/{data.request.model.id} · {data.request.model.variant || "기본"}</Badge><Badge variant="outline">{data.request.status}</Badge>{data.request.retry !== undefined && <Badge variant="outline">기록된 재시도 {data.request.retry}</Badge>}</div>
    <p className="footnote break-all">{data.request.id} · 입력 {data.request.tokens ? number(data.request.tokens.input) : "미집계"} · 캐시 읽기 {data.request.tokens ? number(data.request.tokens.cache.read) : "미집계"} · 캐시 쓰기 {data.request.tokens ? number(data.request.tokens.cache.write) : "미집계"} · 출력 {data.request.tokens ? number(data.request.tokens.output) : "미집계"} · 추론 {data.request.tokens ? number(data.request.tokens.reasoning) : "미집계"} · 비용 {data.request.cost === undefined ? "미집계" : money(data.request.cost)}</p>
    {props.hasOlder && <p role="status" className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">앞부분 미조회: 현재 화면은 일부 이력입니다. 아래에서 이전 이력을 더 불러올 수 있습니다.</p>}
    {window.missingKept && <p role="status" className="footnote">압축에서 참조한 유지 기록이 아직 없거나 삭제되었습니다. 이전 이력을 불러오기 전에는 유지 컨텍스트가 불완전합니다.</p>}
    {window.native && <p className="footnote">이 모델과 호환되는 공급자 압축 창을 경계로 사용했습니다. 공급자 전용 내용은 이 화면에서 복원하지 않습니다.</p>}
    {window.skippedNative && <p className="footnote">다른 모델의 공급자 압축 창은 재사용할 수 없어 압축 경계에서 제외했습니다.</p>}
    <section aria-label="요청 직전 저장 이력" className="space-y-3"><h2 className="section-title">요청 직전 저장 이력</h2>{window.active.length ? window.active.map((message) => <RecordedMessageView key={message.id} message={message} />) : <p className="footnote">현재 불러온 범위에는 이 요청 이전 기록이 없습니다.</p>}</section>
    {(window.recent || window.kept.length > 0) && <details className="rounded-lg border p-4"><summary className="text-sm font-medium">압축에서 유지한 최근 이력</summary><p className="my-3 footnote">저장된 유지 텍스트 또는 참조 원기록입니다. 모델별 변환 이후의 최종 입력과는 다릅니다.</p>{window.recent ? <pre className="record-text" tabIndex={0}>{window.recent}</pre> : <div className="space-y-3">{window.kept.map((message) => <RecordedMessageView key={message.id} message={message} />)}</div>}</details>}
    {window.archived.length > 0 && <details className="rounded-lg border p-4"><summary className="text-sm font-medium">압축 이전 원기록 · {window.archived.length}개</summary><p className="my-3 footnote">이 원기록 전체가 선택한 요청에 그대로 전달된 것은 아닙니다.</p><div className="space-y-3">{window.archived.map((message) => <RecordedMessageView key={message.id} message={message} />)}</div></details>}
    <section className="space-y-3 border-t pt-5" aria-label="선택한 요청의 응답"><h2 className="section-title">선택한 요청의 응답</h2><p className="footnote">위 요청 직전 입력 이력에는 포함하지 않습니다.</p><RecordedMessageView message={data.response} /></section>
  </div>
}

function RequestContext(props: { sessionID: string; request: string; cursor?: string }) {
  const base = `/api/sessions/${props.sessionID}/history`
  const resource = useApi<HistoryPage>(`${base}?${new URLSearchParams({ request: props.request, cursor: props.cursor || "" })}`)
  const [older, setOlder] = useState<{ data: RecordedMessage[]; next?: string | null }>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const controller = useRef<AbortController | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => { if (resource.data && window.location.hash === "#request") { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: "start" }) } }, [resource.data])
  const next = older ? older.next : resource.data?.next
  async function loadOlder() {
    if (!next || loading) return
    const abort = new AbortController()
    controller.current = abort
    setLoading(true)
    setError(undefined)
    try {
      const page = await api<HistoryPage>(`${base}?${new URLSearchParams({ request: props.request, cursor: next, older: "1" })}`, abort.signal)
      if (!abort.signal.aborted) setOlder((current) => ({ data: [...page.data, ...(current?.data ?? [])], next: page.next }))
    } catch (cause) { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "이전 이력을 불러오지 못했습니다.") }
    finally { if (!abort.signal.aborted) setLoading(false) }
  }
  return <section id="request" className="scroll-mt-6 space-y-5 border-t pt-7" aria-busy={resource.loading || loading}>
    <h2 ref={heading} tabIndex={-1} className="section-title">선택 시점의 컨텍스트</h2>
    <Notice loading={resource.loading} error={resource.error} retry={resource.reload} />
    {resource.data && <ContextView data={resource.data} prior={older?.data} hasOlder={!!next} />}
    <Notice error={error} />
    {next && <Button variant="outline" onClick={loadOlder} disabled={loading}><RefreshCw aria-hidden="true" className={loading ? "motion-safe:animate-spin" : ""} />{loading ? "이전 이력 조회 중…" : "이전 이력 100개 더 보기"}</Button>}
  </section>
}

export function SessionDetail(props: { sessionID: string; filters: Filters; params: URLSearchParams }) {
  const cursor = props.params.get("cursor") || undefined
  const selected = props.params.get("request") || undefined
  const resource = useApi<RequestPage>(`/api/sessions/${props.sessionID}/requests?${new URLSearchParams(cursor ? { cursor } : {})}`)
  const children = useApi<SessionPage>(`/api/sessions?${new URLSearchParams({ parent: props.sessionID, project: "all" })}`)
  const [metric, setMetric] = useState("tokens")
  let range: URLSearchParams | undefined
  let error: string | undefined
  try { range = new URLSearchParams(statsQuery(props.filters.from, props.filters.to, props.filters.project)) } catch (cause) { error = cause instanceof Error ? cause.message : "기간을 확인해 주세요." }
  const data = resource.data
  const requests = data?.data.filter((request) => range && request.time.created >= Number(range.get("from")) && request.time.created < Number(range.get("to"))) ?? []
  const href = (value?: string | null) => value ? pageHref(`/sessions/${props.sessionID}`, props.filters, { cursor: value }) : undefined
  return <div className="space-y-6" aria-busy={resource.loading}>
    <Button asChild variant="outline" size="sm"><a href={pageHref("/sessions", props.filters)}><ArrowLeft aria-hidden="true" />세션 목록</a></Button>
    <Notice loading={resource.loading} error={error || resource.error} retry={error ? undefined : resource.reload} />
    {data && <>
      <Card className="gap-3 p-5"><h2 className="text-lg font-semibold break-words">{data.session.title || "제목 없음"}</h2><p className="footnote break-all">{data.session.id} · {data.session.location.directory}</p><p className="footnote">세션 전체 누적: {number(totalTokens(data.session.tokens))} 토큰 · {money(data.session.cost)} · 최근 수정 {dateTime(data.session.time.updated)}</p>{data.session.parentID && <a className="request-link text-xs" href={pageHref(`/sessions/${data.session.parentID}`, props.filters)}>상위 세션 보기</a>}</Card>
      <details className="rounded-lg border p-4"><summary className="text-sm font-medium">하위 세션</summary><div className="mt-3 space-y-3"><Notice loading={children.loading} error={children.error} retry={children.reload} />{children.data && (children.data.data.length ? <ul className="space-y-2">{children.data.data.map((child) => <li key={child.id}><a className="request-link text-xs" href={pageHref(`/sessions/${child.id}`, props.filters)}>{child.title || child.id}</a></li>)}</ul> : <p className="footnote">하위 세션이 없습니다.</p>)}{children.data?.cursor.next && <a className="request-link text-xs" href={pageHref("/sessions", { ...props.filters, project: "all" }, { parent: props.sessionID })}>하위 세션 전체 목록</a>}</div></details>
      <div className="section-heading"><div><h2 className="section-title">요청 타임라인 · 모델 Steps</h2><p className="section-description">불러온 메시지 {data.scanned}개 중 기간에 맞는 요청 {requests.length}개 · 전체 세션 그래프가 아닙니다.</p></div><label className="field-label">그래프 지표<NativeSelect name="metric" value={metric} onChange={(event) => setMetric(event.target.value)}><option value="tokens">입력 컨텍스트 / 생성 토큰</option><option value="cost">비용 · USD</option></NativeSelect></label></div>
      {data.from !== undefined && data.to !== undefined && <p className="footnote">현재 메시지 페이지: {dateTime(data.from)} ~ {dateTime(data.to)}. 요청이 없어도 다음 페이지에서 이전 기록을 계속 볼 수 있습니다.</p>}
      <UsageChart title={metric === "cost" ? "요청별 비용" : "요청별 컨텍스트 사용량"} description={metric === "cost" ? "기록된 비용이며 실제 청구액과 다를 수 있습니다." : "입력 = 비캐시 입력 + 캐시 읽기 + 캐시 쓰기. 생성 = 출력 + 추론. 모델의 최대 컨텍스트 크기나 점유율은 아닙니다."} line currency={metric === "cost"} data={requestPoints(requests)} selected={selected} onSelect={(id) => window.location.assign(requestHref(props.sessionID, id, props.filters, cursor))} table={false} series={metric === "cost" ? [{ key: "cost", name: "비용 · USD", color: colors[2]! }] : [{ key: "input", name: "입력 컨텍스트 토큰", color: colors[0]! }, { key: "output", name: "생성 토큰", color: colors[1]! }]} />
      <Board title="요청별 기록" numericFrom={3} headers={["요청 시각 / 컨텍스트", "모델 / variant", "상태", "입력 + 캐시", "생성", "비용 · USD"]} rows={requests.map((request) => [<a className="request-link" aria-current={request.id === selected ? "true" : undefined} href={requestHref(props.sessionID, request.id, props.filters, cursor)}>{dateTime(request.time.created)}</a>, <span className="model-name">{request.model.providerID}/{request.model.id}<br />{request.model.variant || "기본"}</span>, request.status, request.tokens ? number(request.tokens.input + request.tokens.cache.read + request.tokens.cache.write) : "미집계", request.tokens ? number(request.tokens.output + request.tokens.reasoning) : "미집계", request.cost === undefined ? "미집계" : money(request.cost)])} empty="불러온 메시지 범위와 선택한 기간에 맞는 모델 Step이 없습니다." />
      <Pagination previous={href(data.cursor.previous)} next={href(data.cursor.next)} />
      <p className="footnote">그래프 점 또는 요청 시각 링크를 선택하세요. Steps는 개별 HTTP 요청·재시도 전체 목록이 아닙니다. 미집계 값은 0으로 간주하지 않습니다.</p>
    </>}
    {selected ? <RequestContext key={`${props.sessionID}/${selected}/${cursor || ""}`} sessionID={props.sessionID} request={selected} cursor={cursor} /> : <p id="request" className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">요청을 선택하면 해당 시점의 저장 이력을 여기에 표시합니다.</p>}
  </div>
}
