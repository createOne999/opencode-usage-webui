import { OpenCode } from "@opencode/client"
import { Service } from "@opencode/client/service"
import { Plugin } from "@opencode/plugin"
import { openDashboard } from "./open"
import { DashboardRpc, type DashboardStatus } from "./rpc"
import { startDashboard } from "./server"

export default Plugin.define({
  id: "local.usage-dashboard",
  async setup(context) {
    const port = context.options.port ?? 7331
    if (typeof port !== "number") throw new Error("Dashboard port must be a number")
    let server: ReturnType<typeof startDashboard> | undefined
    try {
      server = startDashboard({
        port,
        directory: context.location.directory,
        projectID: context.location.project.id,
        async connect() {
          // Discovery only: never start, stop, or replace the user's OpenCode service.
          const endpoint = await Service.discover({ version: (version) => version.startsWith("2.") })
          return endpoint ? OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) }) : undefined
        },
      })
    } catch (error) {
      if (!addressInUse(error)) throw error
    }
    const intended = new URL(`http://127.0.0.1:${port}/`)

    async function status(): Promise<DashboardStatus> {
      const url = new URL("stats", server?.url ?? intended).href
      if (!server) return {
        url,
        ready: false,
        error: {
          code: "portInUse",
          message: `포트 ${port}을(를) 다른 프로세스가 사용 중입니다. options.port를 바꾸거나 해당 프로세스를 종료한 뒤 플러그인을 다시 로드해 주세요.`,
        },
      }
      if (!(await Bun.file(new URL("./dist/index.html", import.meta.url)).exists())) return {
        url,
        ready: false,
        error: { code: "missingBuild", message: "대시보드 빌드가 없습니다. usage-dashboard 폴더에서 bun run build를 실행해 주세요." },
      }
      return { url, ready: true }
    }

    try {
      await context.command.transform((editor) => {
        editor.add({
          name: "usage-dashboard",
          description: "사용량 대시보드를 기본 브라우저로 엽니다",
          async execute() {
            const current = await status()
            if (current.error && current.error.code !== "missingBuild") throw new Error(current.error.message)
            const failure = await openDashboard(current.url)
            if (failure) throw new Error(`브라우저를 열지 못했습니다 (${failure}). ${current.url}\n접속 주소와 상태: bun run --cwd usage-dashboard status`)
          },
        })
      })
      // The host disposes RPC registrations together with the plugin.
      await context.rpc.register(DashboardRpc, { info: status })
    } catch (error) {
      await server?.stop(true)
      throw error
    }

    if (server) console.info(`[usage-dashboard] ${server.url}stats · ${server.url}sessions`)
    else console.error(`[usage-dashboard] 포트 ${port}을(를) 사용할 수 없습니다. bun run --cwd usage-dashboard status로 상태를 확인해 주세요.`)
    return () => server?.stop(true)
  },
})

function addressInUse(error: unknown) {
  return typeof error === "object" && error !== null && (
    ("code" in error && error.code === "EADDRINUSE") ||
    (error instanceof Error && /address already in use|EADDRINUSE/i.test(error.message))
  )
}
