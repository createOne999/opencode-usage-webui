import { useId } from "react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card } from "@/components/ui/card"
import { Board } from "./shared"
import { money, number, tokenNumber } from "./data"

type Point = { label: string; id?: string; [key: string]: string | number | null | undefined }
type Series = { key: string; name: string; color: string }
export const colors = ["#96bbff", "#7edbb8", "#e3bb79", "#beabff", "#f29eb3"]

export function UsageChart(props: { title: string; description?: string; data: Point[]; series: Series[]; line?: boolean; stacked?: boolean; currency?: boolean; tokens?: boolean; selected?: string; onSelect?: (id: string) => void; table?: boolean }) {
  const id = useId()
  const format = props.currency ? money : props.tokens ? tokenNumber : number
  const Chart = props.line ? LineChart : BarChart
  const selected = props.selected ? props.data.find((point) => point.id === props.selected) : undefined
  return <Card className="min-w-0 gap-4 p-4 sm:p-5">
    <div><h2 id={id} className="section-title">{props.title}</h2>{props.description && <p className="section-description">{props.description}</p>}</div>
    {props.data.length ? <>
      <div className="chart-frame" role="region" aria-labelledby={id}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <Chart data={props.data} margin={{ left: 0, right: 16, top: 12, bottom: 8 }} accessibilityLayer onClick={props.onSelect ? (state) => {
            if (state.activeTooltipIndex === undefined || state.activeTooltipIndex === null) return
            const point = props.data[Number(state.activeTooltipIndex)]
            if (point?.id) props.onSelect?.(point.id)
          } : undefined}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(value: string) => value.length > 18 ? `${value.slice(0, 16)}…` : value} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis width={62} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(value: number) => props.currency ? `$${new Intl.NumberFormat("en", { notation: "compact", maximumSignificantDigits: 3 }).format(value)}` : props.tokens ? tokenNumber(value) : new Intl.NumberFormat("ko", { notation: "compact" }).format(value)} tickLine={false} axisLine={false} />
            <Tooltip isAnimationActive={false} cursor={{ stroke: "var(--muted-foreground)", fill: "var(--accent)", fillOpacity: 0.25 }} content={({ active, label, payload }) => active && payload?.length ? <div className="chart-tooltip" role="status"><p className="mb-2 max-w-64 break-all font-medium">{label}</p>{payload.map((entry) => <p key={String(entry.dataKey)}>{entry.name}: {entry.value == null ? "미집계" : format(Number(entry.value))}</p>)}</div> : null} />
            {selected && <ReferenceLine x={selected.label} stroke="var(--foreground)" strokeDasharray="4 3" />}
            {props.series.map((series) => props.line
              ? <Line key={series.key} dataKey={series.key} name={series.name} stroke={series.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} isAnimationActive={false} connectNulls={false} />
              : <Bar key={series.key} dataKey={series.key} name={series.name} fill={series.color} stackId={props.stacked ? "usage" : undefined} radius={props.stacked ? 0 : [3, 3, 0, 0]} maxBarSize={48} isAnimationActive={false} />)}
          </Chart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">{props.series.map((series) => <span key={series.key} className="flex items-center gap-2"><svg aria-hidden="true" width="10" height="10"><rect width="10" height="10" rx="2" fill={series.color} /></svg>{series.name}</span>)}</div>
      {props.table !== false && <details><summary className="text-xs text-primary">그래프 데이터 표</summary><div className="mt-3"><Board title={`${props.title} 데이터`} headers={["항목", ...props.series.map((series) => series.name)]} rows={props.data.map((point) => [point.label, ...props.series.map((series) => point[series.key] == null ? "미집계" : format(Number(point[series.key])))])} /></div></details>}
    </> : <p className="py-12 text-center text-sm text-muted-foreground">표시할 그래프 데이터가 없습니다.</p>}
  </Card>
}
