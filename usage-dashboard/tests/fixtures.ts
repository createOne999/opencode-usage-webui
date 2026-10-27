import type { SessionStatsInfo, UsageLimitsInfo } from "@opencode/client"

export const stats: SessionStatsInfo = {
  range: { from: 1790812800000, to: 1793145600000 },
  sessions: 2, subagents: 1, prompts: 4, steps: 8,
  tokens: { input: 100, output: 20, reasoning: 30, cache: { read: 40, write: 10 } },
  cost: 0.000123,
  tools: { mode: "detail", totals: { calls: 3, succeeded: 1, failed: 1, unfinished: 1 }, usage: [{ name: "read", calls: 3, succeeded: 1, failed: 1, unfinished: 1, durationP50: 12 }] },
  activeDays: 1, streak: 1, activity: [{ date: "2026-10-27", steps: 8 }],
  models: [{ model: { providerID: "openai", id: "example", variant: "high" }, steps: 8, tokens: { input: 90, output: 20, reasoning: 30, cache: { read: 40, write: 10 } }, cost: 0.0001 }],
}

export const limits: UsageLimitsInfo = {
  workspace: { id: "workspace-1", name: "Test workspace", usageURL: "https://opencode.ai/console" },
  go: {
    rolling: { percent: 25, limited: false, resetsAt: 1793145600000 },
    weekly: { percent: 100, limited: true, resetsAt: 1793145600000 },
    monthly: { percent: 60, limited: false, resetsAt: 1793145600000 },
  },
  budgets: [{
    id: "budget-1", limit: 10, spent: 7, scope: "each", per: "model", coverage: "models",
    models: [{ providerID: "openai", modelID: "a", name: "A", spent: 1 }, { providerID: "openai", modelID: "b", name: "B", spent: 7 }],
    vendors: [], picked: true, shared: false, resetsAt: 1793145600000,
  }],
}
