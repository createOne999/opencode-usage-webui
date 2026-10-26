import type { MessagePart, Usage } from "./types.ts";
export function normalizeUsage(value?: Partial<Usage>): Usage {
  const safe = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n)
      ? Math.max(0, Math.trunc(n))
      : 0;
  return {
    input: safe(value?.input),
    output: safe(value?.output),
    reasoning: safe(value?.reasoning),
    cache: { read: safe(value?.cache?.read), write: safe(value?.cache?.write) },
  };
}
export function tokenMetrics(usage: Usage) {
  const u = normalizeUsage(usage);
  return {
    uncached_input_tokens: u.input,
    input_plus_cache_read_tokens: u.input + u.cache.read,
    total_input_tokens: u.input + u.cache.read + u.cache.write,
    cache_read_tokens: u.cache.read,
    cache_write_tokens: u.cache.write,
    output_tokens: u.output,
    reasoning_tokens: u.reasoning,
    non_cache_tokens: u.input + u.output + u.reasoning,
    total_tokens:
      u.input + u.cache.read + u.cache.write + u.output + u.reasoning,
    cache_hit_ratio:
      u.input + u.cache.read ? u.cache.read / (u.input + u.cache.read) : 0,
  };
}
export function attributeTokens(parts: MessagePart[], usage?: Usage): void {
  const metrics = usage ? tokenMetrics(usage) : undefined;
  for (const category of ["input", "output", "reasoning"] as const) {
    const group = parts.filter((p) =>
      category === "input"
        ? p.direction === "input"
        : p.direction === "output" &&
          (category === "reasoning"
            ? p.part_type === "reasoning"
            : p.part_type !== "reasoning" && p.part_type !== "tool_result"),
    );
    const weights = group.map((p) => Math.max(1, p.char_count));
    const sum = weights.reduce((a, b) => a + b, 0);
    const total = metrics
      ? category === "input"
        ? metrics.total_input_tokens
        : category === "reasoning"
          ? metrics.reasoning_tokens
          : metrics.output_tokens
      : Math.ceil(sum / 4);
    let assigned = 0,
      cumulative = 0;
    group.forEach((p, i) => {
      cumulative += weights[i];
      const next = Math.round((cumulative * total) / sum);
      p.estimated_tokens = next - assigned;
      assigned = next;
    });
  }
}
