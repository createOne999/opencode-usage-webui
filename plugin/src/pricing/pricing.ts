import type { Usage } from "../shared/types.ts";
export interface Price {
  input_per_million: number;
  output_per_million: number;
  cache_read_per_million: number;
  cache_write_per_million: number;
  source: string;
}
export function estimateCost(usage: Usage, price?: Price | null) {
  if (!price)
    return { estimated_cost_usd: null, estimated_cache_savings_usd: null };
  return {
    estimated_cost_usd:
      (usage.input * price.input_per_million +
        (usage.output + usage.reasoning) * price.output_per_million +
        usage.cache.read * price.cache_read_per_million +
        usage.cache.write * price.cache_write_per_million) /
      1e6,
    estimated_cache_savings_usd:
      (usage.cache.read *
        (price.input_per_million - price.cache_read_per_million)) /
      1e6,
  };
}
