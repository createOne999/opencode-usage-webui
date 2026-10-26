import type { RequestKind } from "../shared/types.ts";
export class Correlator {
  private pending = new Map<
    string,
    { session: string; kind: RequestKind; provider: string; model: string }
  >();
  private assistants = new Map<string, string>();
  constructor(private diagnostic: (message: string) => void = console.warn) {}
  add(
    id: string,
    session: string,
    kind: RequestKind,
    provider: string,
    model: string,
  ) {
    this.pending.set(id, { session, kind, provider, model });
  }
  match(
    session: string,
    kind: RequestKind,
    provider?: string,
    model?: string,
  ): string | undefined {
    const matches = [...this.pending].filter(
      ([, p]) =>
        p.session === session &&
        p.kind === kind &&
        (!provider || p.provider === provider) &&
        (!model || p.model === model),
    );
    if (matches.length > 1) {
      this.diagnostic("Ambiguous request correlation; usage not attached");
      return;
    }
    return matches[0]?.[0];
  }
  bind(id: string, session: string, assistant: string) {
    this.assistants.set(`${session}:${assistant}`, id);
    this.pending.delete(id);
  }
  assistant(session: string, assistant: string) {
    return this.assistants.get(`${session}:${assistant}`);
  }
  remove(id: string) {
    this.pending.delete(id);
    for (const [key, value] of this.assistants)
      if (value === id) this.assistants.delete(key);
  }
}
