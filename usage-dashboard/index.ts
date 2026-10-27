import { OpenCode } from "@opencode/client"
import { Service } from "@opencode/client/service"
import { Plugin } from "@opencode/plugin"
import { startDashboard } from "./server"

export default Plugin.define({
  id: "local.usage-dashboard",
  setup(context) {
    const port = context.options.port ?? 7331
    if (typeof port !== "number") throw new Error("Dashboard port must be a number")
    const server = startDashboard({
      port,
      directory: context.location.directory,
      projectID: context.location.project.id,
      async connect() {
        // Discovery only: never start, stop, or replace the user's OpenCode service.
        const endpoint = await Service.discover({ version: (version) => version.startsWith("2.") })
        return endpoint ? OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) }) : undefined
      },
    })
    console.info(`[usage-dashboard] ${server.url}stats · ${server.url}sessions`)
    return () => server.stop(true)
  },
})
