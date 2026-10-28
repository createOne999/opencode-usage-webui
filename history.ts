import type { ModelRef, SessionInfo, SessionMessageAssistant, SessionMessageInfo } from "@opencode/client"

export function sessionSummary(session: SessionInfo) {
  return { id: session.id, title: session.title, parentID: session.parentID, projectID: session.projectID, location: session.location, time: session.time, cost: session.cost, tokens: session.tokens }
}

export function requestSummary(message: SessionMessageAssistant) {
  const statusCode = message.error ? "error" : message.time.completed === undefined ? "incomplete" : "completed"
  return { id: message.id, time: message.time, model: message.model, agent: message.agent, tokens: message.tokens, cost: message.cost, finish: message.finish, retry: message.retry?.attempt, status: message.error ? "오류" : message.time.completed === undefined ? "진행 중 / 미완료" : "완료", statusCode }
}

export type SessionSummary = ReturnType<typeof sessionSummary>
export type RequestSummary = ReturnType<typeof requestSummary>
export type Cursor = { previous?: string | null; next?: string | null }
export type SessionPage = { data: SessionSummary[]; cursor: Cursor }
export type RequestPage = { session: SessionSummary; data: RequestSummary[]; cursor: Cursor; scanned: number; from?: number; to?: number }
export type RecordedBlock = {
  label: string
  text: string
  kind?: string
  labelValues?: Record<string, string>
  textKey?: string
  file?: { name?: string; mime: string; description?: string }
}
export type RecordedMessage = {
  id: string
  type: SessionMessageInfo["type"]
  created: number
  label: string
  labelKey?: string
  labelValues?: Record<string, string>
  blocks: RecordedBlock[]
  checkpoint?: { native: boolean; model?: ModelRef; keepID?: string; recent?: string }
}
export type HistoryPage = { request: RequestSummary; response: RecordedMessage; data: RecordedMessage[]; next?: string | null }

// Only model-readable text and attachment descriptions leave the server; no binary payloads or provider replay secrets.
export function recordedMessage(message: SessionMessageInfo, before?: number): RecordedMessage {
  const result: RecordedMessage = { id: message.id, type: message.type, created: message.time.created, label: message.type, blocks: [] }
  const add = (label: string, text: string, extra?: Omit<RecordedBlock, "label" | "text">) => { if (text) result.blocks.push({ label, text, ...extra }) }
  switch (message.type) {
    case "user":
      result.label = "사용자"
      result.labelKey = "user"
      add("메시지", message.text, { kind: "message" })
      message.skills?.forEach((skill) => add("첨부 스킬", skill.text ?? skill.name, { kind: "attachedSkill" }))
      message.files?.forEach((file) => {
        add("첨부 파일", `${file.name || "이름 없음"} · ${file.mime}${file.description ? `\n${file.description}` : ""}`, { kind: "attachedFile", file: { name: file.name, mime: file.mime, description: file.description } })
        if (file.mime === "text/plain" || file.mime === "application/x-directory") add("첨부 텍스트", Buffer.from(file.data, "base64").toString("utf8"), { kind: "attachedText" })
      })
      break
    case "assistant":
      result.label = `응답 · ${message.model.providerID}/${message.model.id}`
      result.labelKey = "assistant"
      result.labelValues = { model: `${message.model.providerID}/${message.model.id}` }
      if (before !== undefined && (message.time.completed === undefined || message.time.completed > before)) {
        add("복원 제한", "이 응답은 선택한 요청 전에 완료된 것으로 확인되지 않아 본문을 제외했습니다.", { kind: "restoreLimited", textKey: "responseIncomplete" })
        break
      }
      message.content.forEach((part) => {
        if (part.type === "text" || part.type === "reasoning") { add(part.type === "text" ? "응답" : "추론 기록", part.text, { kind: part.type === "text" ? "response" : "reasoning" }); return }
        add(`도구 · ${part.name} · ${part.state.status}`, JSON.stringify(part.state.input, null, 2), { kind: "tool", labelValues: { name: part.name, status: part.state.status } })
        if (part.state.status === "completed" || part.state.status === "error") {
          if (before !== undefined && (part.time.completed === undefined || part.time.completed > before)) { add("복원 제한", "요청 전에 종료된 것으로 확인되지 않은 도구 결과를 제외했습니다.", { kind: "restoreLimited", textKey: "toolIncomplete" }); return }
          part.state.content?.forEach((content) => add("도구 결과", content.type === "text" ? content.text : `${content.name || "첨부 파일"} · ${content.mime}`, content.type === "text" ? { kind: "toolResult" } : { kind: "toolResult", file: { name: content.name ?? undefined, mime: content.mime } }))
          if (part.state.status === "error") add("도구 오류", part.state.error.message, { kind: "toolError" })
        }
      })
      break
    case "system": result.label = "저장된 지침 변경"; result.labelKey = "system"; add("지침", message.text, { kind: "instructions" }); break
    case "synthetic": result.label = "추가 컨텍스트"; result.labelKey = "synthetic"; add(message.description || "메시지", message.text, { kind: message.description ? "custom" : "message" }); break
    case "skill": result.label = `스킬 · ${message.name}`; result.labelKey = "skill"; result.labelValues = { name: message.name }; add("스킬", message.text, { kind: "skillText" }); break
    case "shell":
      result.label = "사용자 셸 실행"
      result.labelKey = "shell"
      add("명령", message.command, { kind: "command" })
      if (before === undefined || (message.time.completed !== undefined && message.time.completed <= before)) add("출력", message.output?.output ?? "", { kind: "output" })
      else add("복원 제한", "요청 전에 완료된 것으로 확인되지 않은 셸 출력을 제외했습니다.", { kind: "restoreLimited", textKey: "shellIncomplete" })
      break
    case "compaction":
      result.label = `컨텍스트 압축 · ${message.status}`
      result.labelKey = "compaction"
      result.labelValues = { status: message.status }
      if (message.status !== "failed") add("압축 요약", message.summary, { kind: "compactionSummary" })
      if (message.status === "completed") result.checkpoint = {
        native: message.native?.messages !== undefined,
        model: message.model,
        keepID: typeof message.metadata?.keepID === "string" ? message.metadata.keepID : undefined,
        recent: typeof message.metadata?.recent === "string" ? message.metadata.recent : undefined,
      }
      break
    case "agent-switched": result.label = "에이전트 변경"; result.labelKey = "agentSwitched"; add("에이전트", message.agent, { kind: "agent" }); break
    case "model-switched": result.label = "모델 변경"; result.labelKey = "modelSwitched"; add("모델", `${message.model.providerID}/${message.model.id}${message.model.variant ? ` · ${message.model.variant}` : ""}`, { kind: "model" }); break
    case "location-switched": result.label = "작업 위치 변경"; result.labelKey = "locationSwitched"; add("위치", message.location.directory, { kind: "location" }); break
    case "idle": result.label = "실행 종료 · 컨텍스트에 포함되지 않는 표시"; result.labelKey = "idle"; break
  }
  return result
}

export function historyWindow(messages: RecordedMessage[], model: ModelRef) {
  const boundary = messages.findLastIndex((message) => message.checkpoint && (!message.checkpoint.native || (message.checkpoint.model?.providerID === model.providerID && message.checkpoint.model.id === model.id)))
  const checkpoint = messages[boundary]?.checkpoint
  const keep = checkpoint?.keepID ? messages.findIndex((message) => message.id === checkpoint.keepID) : -1
  return {
    active: boundary < 0 ? messages : messages.slice(boundary),
    archived: boundary < 0 ? [] : messages.slice(0, boundary),
    kept: keep >= 0 && keep < boundary ? messages.slice(keep, boundary) : [],
    recent: checkpoint?.recent,
    missingKept: !!checkpoint?.keepID && (keep < 0 || keep >= boundary) && !checkpoint.recent,
    native: !!checkpoint?.native,
    skippedNative: messages.some((message, index) => index > boundary && message.checkpoint?.native),
  }
}
