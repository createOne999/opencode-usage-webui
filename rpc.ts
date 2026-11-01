import { Rpc } from "@opencode/plugin"

export type DashboardErrorCode = "missingBuild" | "portInUse"

export type DashboardStatus = {
  url: string
  ready: boolean
  error?: { code: DashboardErrorCode; message: string }
}

export const DashboardRpc = Rpc.define({
  id: "local.usage-dashboard",
  methods: {
    info: {
      input: {
        type: "object",
        properties: {},
        additionalProperties: false,
      } as const,
      output: {
        type: "object",
        properties: {
          url: { type: "string" },
          ready: { type: "boolean" },
          error: {
            type: "object",
            properties: {
              code: { type: "string", enum: ["missingBuild", "portInUse"] },
              message: { type: "string" },
            },
            required: ["code", "message"],
            additionalProperties: false,
          },
        },
        required: ["url", "ready"],
        additionalProperties: false,
      } as const,
    },
  },
  events: {},
})
