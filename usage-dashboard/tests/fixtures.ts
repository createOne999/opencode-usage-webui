import type { SessionInfo, SessionMessageInfo, SessionStatsInfo } from "@opencode/client"

export const stats: SessionStatsInfo = {
  range: { from: 1790812800000, to: 1793145600000 },
  sessions: 2, subagents: 1, prompts: 4, steps: 8,
  tokens: { input: 100, output: 20, reasoning: 30, cache: { read: 40, write: 10 } },
  cost: 0.000123,
  tools: { mode: "detail", totals: { calls: 3, succeeded: 1, failed: 1, unfinished: 1 }, usage: [{ name: "read", calls: 3, succeeded: 1, failed: 1, unfinished: 1, durationP50: 12 }] },
  activeDays: 1, streak: 1, activity: [{ date: "2026-10-27", steps: 8 }],
  models: [{ model: { providerID: "openai", id: "example", variant: "high" }, steps: 8, tokens: { input: 90, output: 20, reasoning: 30, cache: { read: 40, write: 10 } }, cost: 0.0001 }],
}

export const session: SessionInfo = {
  id: "ses_example", title: "대시보드 분석", projectID: "current-project", location: { directory: "D:/project" },
  time: { created: 100, updated: 800 }, cost: stats.cost, tokens: stats.tokens,
  metadata: { private: "not-for-the-browser" },
}

export const messages: SessionMessageInfo[] = [
  { id: "msg_user", type: "user", time: { created: 100 }, text: "첫 질문 <script>unsafe()</script>" },
  { id: "msg_first", type: "assistant", time: { created: 200, completed: 250 }, agent: "build", model: { providerID: "openai", id: "example" }, tokens: stats.tokens, cost: 0, content: [{ type: "text", text: "이전 응답" }, { type: "tool", id: "tool_1", name: "read", time: { created: 210, completed: 240 }, state: { status: "completed", input: { path: "file.ts" }, content: [{ type: "text", text: "저장된 도구 결과" }] } }] },
  { id: "msg_checkpoint", type: "compaction", time: { created: 300 }, status: "completed", reason: "auto", summary: "이전 대화 요약", metadata: { keepID: "msg_user" } },
  { id: "msg_instructions", type: "system", time: { created: 400 }, text: "당시 저장된 지침 변경" },
  { id: "msg_selected", type: "assistant", time: { created: 500, completed: 600 }, agent: "build", model: { providerID: "openai", id: "example", variant: "high" }, tokens: stats.tokens, cost: 0.000123, content: [{ type: "text", text: "선택 요청의 응답" }] },
  { id: "msg_future", type: "user", time: { created: 700 }, text: "미래 메시지" },
  { id: "msg_running", type: "assistant", time: { created: 800 }, agent: "build", model: { providerID: "openai", id: "example" }, content: [], native: { secret: "provider-native-secret" } },
]
