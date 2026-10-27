import type { SessionStatsInfo } from "@opencode/client"

export const stats: SessionStatsInfo = {
  range: { from: 1790812800000, to: 1793145600000 },
  sessions: 2, subagents: 1, prompts: 4, steps: 8,
  tokens: { input: 100, output: 20, reasoning: 30, cache: { read: 40, write: 10 } },
  cost: 0.000123,
  tools: { mode: "detail", totals: { calls: 3, succeeded: 1, failed: 1, unfinished: 1 }, usage: [{ name: "read", calls: 3, succeeded: 1, failed: 1, unfinished: 1, durationP50: 12 }] },
  activeDays: 1, streak: 1, activity: [{ date: "2026-10-27", steps: 8 }],
  models: [{ model: { providerID: "openai", id: "example", variant: "high" }, steps: 8, tokens: { input: 90, output: 20, reasoning: 30, cache: { read: 40, write: 10 } }, cost: 0.0001 }],
}
