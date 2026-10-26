export type RequestKind = "primary" | "compaction" | "title" | "generate";
export type PartType =
  | "system"
  | "user"
  | "assistant"
  | "reasoning"
  | "tool_call"
  | "tool_result"
  | "image"
  | "file"
  | "tool_def"
  | "unknown";
export interface Usage {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
}
export interface MessagePart {
  request_id: string;
  message_index: number;
  part_index: number;
  role: string;
  part_type: PartType;
  direction: "input" | "output";
  text: string | null;
  estimated_tokens: number;
  char_count: number;
  tool_name: string | null;
  tool_call_id: string | null;
  blob_id: string | null;
  payload: unknown;
}
export interface RequestRecord {
  id: string;
  session_id: string;
  project_id: string;
  agent: string | null;
  kind: RequestKind;
  provider: string;
  model: string;
  assistant_message_id: string | null;
  started_at: string;
  completed_at: string | null;
  latency_ms: number | null;
  status: string;
  error_type: string | null;
  error_message: string | null;
  uncached_input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  usage_available: boolean;
  reported_cost_usd: number | null;
  estimated_cost_usd: number | null;
  estimated_cache_savings_usd: number | null;
  cost_source: string | null;
  request_payload: unknown;
  response_payload: unknown;
}
export interface ContextInput {
  sessionID: string;
  model: { providerID: string; id: string };
  agent?: string;
  system?: readonly unknown[];
  messages?: readonly { role: string; content: unknown }[];
  tools?: Record<string, unknown>;
}
export interface PublicEvent {
  type: string;
  properties: Record<string, unknown>;
}
export interface RequestFilters {
  from?: string;
  to?: string;
  project?: string;
  session?: string;
  provider?: string;
  model?: string;
  kind?: string;
  status?: string;
  hideAuxiliary?: boolean;
  search?: string;
  metric?: string;
  limit?: number;
  offset?: number;
}
