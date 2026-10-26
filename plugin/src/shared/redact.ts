const secretKey =
  /^(authorization|proxy-authorization|cookie|set-cookie|.*api[-_]?key|.*access[-_]?token|.*refresh[-_]?token|.*secret|password|credentials|credential|bearer[-_]?token)$/i;
export function redactText(text: string): string {
  return text
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(
      /\b(?:sk-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,})\b/g,
      "[REDACTED]",
    )
    .replace(
      /((?:authorization|api[-_]?key|access[-_]?token|password|cookie)["']?\s*[=:]\s*["']?)[^\s,;"'}&]+/gi,
      "$1[REDACTED]",
    )
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[REDACTED]@");
}
export function sanitize(value: unknown, maxBytes = 2097152): unknown {
  const seen = new WeakSet<object>();
  let budget = maxBytes;
  const visit = (item: unknown, depth: number): unknown => {
    if (budget <= 0 || depth > 32) return "[TRUNCATED]";
    if (typeof item === "string") {
      const text = redactText(
        item.replace(
          /data:([^;,]+);base64,[A-Za-z0-9+/=\s]+/g,
          "data:$1;[OMITTED]",
        ),
      );
      const bytes = Buffer.from(text);
      if (bytes.length > budget) {
        const prefix = bytes
          .subarray(0, Math.max(0, budget - 32))
          .toString("utf8");
        budget = 0;
        return prefix + "[TRUNCATED]";
      }
      budget -= bytes.length;
      return text;
    }
    if (!item || typeof item !== "object") {
      budget -= 16;
      return typeof item === "bigint" ? String(item) : item;
    }
    if (seen.has(item)) return "[CIRCULAR]";
    seen.add(item);
    if (item instanceof Headers)
      return visit(Object.fromEntries(item), depth + 1);
    if (item instanceof Uint8Array || item instanceof ArrayBuffer)
      return "[BINARY OMITTED]";
    if (Array.isArray(item)) {
      const result: unknown[] = [];
      for (const child of item) {
        if (budget <= 0) {
          result.push("[TRUNCATED]");
          break;
        }
        result.push(visit(child, depth + 1));
      }
      return result;
    }
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(item)) {
      if (budget <= 0) {
        result._truncated = true;
        break;
      }
      if (Buffer.byteLength(key) + 4 > budget) {
        result._truncated = true;
        break;
      }
      budget -= Buffer.byteLength(key) + 4;
      result[key] = secretKey.test(key)
        ? "[REDACTED]"
        : /^(base64|bytes)$/i.test(key) ||
            (key === "data" &&
              ["base64", "bytes", "image", "file"].includes(
                String((item as Record<string, unknown>).type),
              ))
          ? "[BINARY OMITTED]"
          : visit(child, depth + 1);
    }
    return result;
  };
  return visit(value, 0);
}
