import { homedir } from "node:os";
import { join } from "node:path";

export interface Config {
  enabled: boolean;
  host: "127.0.0.1";
  port: number;
  dataDir: string;
  capture: {
    messages: boolean;
    toolResults: boolean;
    reasoning: boolean;
    images: "metadata";
    rawProviderBodies: false;
  };
  retention: { days: number };
  privacy: { redactHeaders: true; maxPayloadBytes: number };
  queueLimit: number;
}
export function readConfig(input: Record<string, unknown> = {}): Config {
  const integer = (
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ) => {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max)
      throw new Error("Invalid numeric inspector option");
    return Number(value);
  };
  const object = (value: unknown): Record<string, unknown> => {
    if (value === undefined) return {};
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid inspector configuration");
    return value as Record<string, unknown>;
  };
  const capture = object(input.capture),
    retention = object(input.retention),
    privacy = object(input.privacy);
  if (input.host !== undefined && input.host !== "127.0.0.1")
    throw new Error("Only loopback binding is supported");
  if (capture.rawProviderBodies === true)
    throw new Error("Raw provider capture is not implemented");
  if (capture.images !== undefined && capture.images !== "metadata")
    throw new Error("Only image metadata capture is supported");
  const bool = (value: unknown, fallback: boolean) => {
    if (value === undefined) return fallback;
    if (typeof value !== "boolean")
      throw new Error("Invalid boolean inspector option");
    return value;
  };
  if (
    input.dataDir !== undefined &&
    (typeof input.dataDir !== "string" || !input.dataDir.trim())
  )
    throw new Error("Invalid dataDir");
  return {
    enabled: bool(input.enabled, true),
    host: "127.0.0.1",
    port: integer(input.port, 7331, 0, 65535),
    dataDir:
      (input.dataDir as string) ??
      join(
        process.env.XDG_DATA_HOME ??
          (process.platform === "win32"
            ? (process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"))
            : join(homedir(), ".local", "share")),
        "opencode-request-inspector",
      ),
    capture: {
      messages: bool(capture.messages, true),
      toolResults: bool(capture.toolResults, true),
      reasoning: bool(capture.reasoning, true),
      images: "metadata",
      rawProviderBodies: false,
    },
    retention: { days: integer(retention.days, 90, 1, 36500) },
    privacy: {
      redactHeaders: true,
      maxPayloadBytes: integer(privacy.maxPayloadBytes, 2097152, 128, 16777216),
    },
    queueLimit: integer(input.queueLimit, 256, 1, 10000),
  };
}
