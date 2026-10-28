import { afterEach, describe, expect, test, spyOn } from "bun:test"
import { resolve } from "node:path"
import { Service } from "@opencode/client/service"
import { runStatus } from "../status"

const secret = "fixture-password-do-not-print"
const logs: string[] = []
const errors: string[] = []
const log = console.log
const error = console.error
let discovery: ReturnType<typeof spyOn<typeof Service, "discover">> | undefined
let server: ReturnType<typeof Bun.serve> | undefined

afterEach(async () => {
  discovery?.mockRestore()
  discovery = undefined
  await server?.stop(true)
  server = undefined
  console.log = log
  console.error = error
})

describe("usage dashboard status CLI", () => {
  test("reports RPC outcomes without leaking credentials or remote errors", async () => {
    const cases = [
      { response: { url: "http://127.0.0.1:7331/stats", ready: true }, code: 0, output: "url: http://127.0.0.1:7331/stats" },
      { response: { url: "http://127.0.0.1:7331/stats", ready: false, error: { code: "missingBuild", message: "Build missing" } }, code: 1, output: "error: missingBuild" },
      { response: { url: "http://127.0.0.1:7331/stats", ready: false, error: { code: "portInUse", message: "Port occupied" } }, code: 1, output: "error: portInUse" },
      { failure: true, code: 1, output: "error: serviceUnavailable" },
    ]

    for (const item of cases) {
      logs.length = 0
      errors.length = 0
      console.log = (...args) => logs.push(args.join(" "))
      console.error = (...args) => errors.push(args.join(" "))
      let requestSeen = false
      server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(request) {
          requestSeen = true
          expect(request.method).toBe("POST")
          expect(new URL(request.url).pathname).toBe("/api/rpc/local.usage-dashboard/info")
          expect(request.headers.get("authorization")).toBe(`Basic ${btoa(`opencode:${secret}`)}`)
          expect(await request.json()).toEqual({ input: {} })
          expect(new URL(request.url).searchParams.get("location[directory]")).toBe(resolve("status-test-project"))
          return item.failure
            ? new Response(secret, { status: 500 })
            : Response.json({ output: item.response })
        },
      })
      discovery = spyOn(Service, "discover").mockResolvedValue({ url: `http://127.0.0.1:${server.port}`, auth: { type: "basic", username: "opencode", password: secret } })

      expect(await runStatus("status-test-project")).toBe(item.code)
      expect([...logs, ...errors].join("\n")).toContain(item.output)
      expect([...logs, ...errors].join("\n")).not.toContain(secret)
      expect(requestSeen).toBe(true)
      expect(discovery).toHaveBeenCalledWith({ version: expect.any(Function) })
      const version = discovery.mock.calls[0]?.[0]?.version
      expect(typeof version).toBe("function")
      if (typeof version === "function") {
        expect(version("2.0.0")).toBe(true)
        expect(version("1.0.0")).toBe(false)
      }
      await server.stop(true)
      server = undefined
      discovery.mockRestore()
      discovery = undefined
    }
  })

  test("handles missing or undiscoverable services without exposing errors", async () => {
    for (const discover of [() => Promise.resolve(undefined), () => Promise.reject(new Error(secret))]) {
      errors.length = 0
      console.error = (...args) => errors.push(args.join(" "))
      discovery = spyOn(Service, "discover").mockImplementation(discover)
      expect(await runStatus()).toBe(1)
      expect(errors.join("\n")).not.toContain(secret)
      expect(errors.join("\n")).toContain("/reload")
      expect(errors.join("\n")).toContain("프로젝트 디렉터리")
      discovery.mockRestore()
      discovery = undefined
    }
  })

  test("defaults the status location to cwd", async () => {
    console.log = (...args) => logs.push(args.join(" "))
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        expect(new URL(request.url).searchParams.get("location[directory]")).toBe(resolve(process.cwd()))
        return Response.json({ output: { url: "http://127.0.0.1:7331/stats", ready: true } })
      },
    })
    discovery = spyOn(Service, "discover").mockResolvedValue({ url: `http://127.0.0.1:${server.port}`, auth: { type: "basic", username: "opencode", password: secret } })
    expect(await runStatus()).toBe(0)
  })
})
