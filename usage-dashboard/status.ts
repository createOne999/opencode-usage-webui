import { resolve } from "node:path"
import { OpenCode } from "@opencode/client"
import { Service } from "@opencode/client/service"
import { DashboardRpc, type DashboardStatus } from "./rpc"

// Resolve the plugin's project root even when Bun runs this from usage-dashboard.
const root = resolve(import.meta.dir, "..")

export async function runStatus() {
  const endpoint = await Service.discover({ version: (version) => version.startsWith("2.") }).catch(() => undefined)
  if (!endpoint) {
    console.error("error: serviceUnavailable")
    console.error("action: 저장소 루트에서 opencode mini를 실행하고 플러그인이 로드된 서비스에서 /reload를 실행한 뒤 다시 시도해 주세요.")
    return 1
  }

  try {
    // The service enforces authentication; the password stays in these in-memory headers.
    const info = await OpenCode.make({
      baseUrl: endpoint.url,
      headers: Service.headers(endpoint),
    }).rpc(DashboardRpc).info({}, {
      location: { directory: root },
      signal: AbortSignal.timeout(5000),
    }) as DashboardStatus

    console.log(`url: ${info.url}`)
    console.log(`ready: ${info.ready ? "yes" : "no"}`)
    if (info.ready) {
      console.log("action: URL을 브라우저에서 열거나 opencode에서 /usage-dashboard를 실행하세요.")
      return 0
    }
    console.error(`error: ${info.error?.code ?? "serviceUnavailable"}`)
    console.error(`action: ${info.error?.message ?? "대시보드 상태를 확인하지 못했습니다. 플러그인을 다시 로드해 주세요."}`)
    return 1
  } catch {
    console.error("error: serviceUnavailable")
    console.error("action: 저장소 루트에서 opencode mini를 실행하고 플러그인이 로드된 서비스에서 /reload를 실행한 뒤 다시 시도해 주세요.")
    return 1
  }
}

if (import.meta.main) process.exitCode = await runStatus()
