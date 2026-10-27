import { useEffect, useState, type ReactNode } from "react"
import { CircleAlert, FolderOpen, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { headers: { "x-dashboard-request": "1" }, signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || "데이터를 불러오지 못했습니다.")
  return data
}

export function useApi<T>(path?: string) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ data?: T; loading: boolean; error?: string }>({ loading: !!path })
  useEffect(() => {
    if (!path) { setState({ loading: false }); return }
    const controller = new AbortController()
    setState({ loading: true })
    void api<T>(path, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setState({ data, loading: false }) },
      (error) => { if (!controller.signal.aborted) setState({ loading: false, error: error instanceof Error ? error.message : "연결에 실패했습니다." }) },
    )
    return () => controller.abort()
  }, [path, revision])
  return { ...state, reload: () => setRevision((value) => value + 1) }
}

export function Board(props: { title: string; headers: string[]; rows: ReactNode[][]; footer?: ReactNode[]; empty?: string; numericFrom?: number }) {
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

export function Notice(props: { loading?: boolean; error?: string; retry?: () => void }) {
  if (props.error) return <Alert variant="destructive" className="border-destructive/30">
    <CircleAlert aria-hidden="true" /><AlertTitle>조회하지 못했습니다</AlertTitle>
    <AlertDescription><p>{props.error}</p>{props.retry && <Button variant="outline" size="sm" className="mt-2 text-foreground" onClick={props.retry}><RefreshCw aria-hidden="true" />다시 시도</Button>}</AlertDescription>
  </Alert>
  if (props.loading) return <div role="status" className="space-y-5">
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />OpenCode에서 데이터를 불러오는 중입니다…</p>
    <div aria-hidden="true" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((key) => <Card key={key} className="gap-4 p-5"><Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-3/4" /></Card>)}</div>
  </div>
  return null
}

export function Pagination(props: { previous?: string; next?: string }) {
  return <nav aria-label="페이지 이동" className="mt-4 flex flex-wrap items-center gap-3">
    {props.previous ? <Button asChild variant="outline" size="sm"><a href={props.previous}>이전 페이지</a></Button> : <Button variant="outline" size="sm" disabled>이전 페이지</Button>}
    {props.next ? <Button asChild variant="outline" size="sm"><a href={props.next}>다음 페이지</a></Button> : <Button variant="outline" size="sm" disabled>다음 페이지</Button>}
  </nav>
}
