import { rmSync } from "node:fs"
import tailwind from "bun-plugin-tailwind"

rmSync("./dist", { recursive: true, force: true })

const result = await Bun.build({
  entrypoints: ["./web/index.html"],
  outdir: "./dist",
  publicPath: "/",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [tailwind],
})

if (!result.success) throw new AggregateError(result.logs, "Dashboard build failed")

const plugin = await Bun.build({
  entrypoints: ["./index.ts"],
  outdir: "./dist",
  target: "bun",
  minify: true,
  external: ["@opencode/client", "@opencode/client/service", "@opencode/plugin"],
})

if (!plugin.success) throw new AggregateError(plugin.logs, "Plugin build failed")

console.info("Dashboard ready. From the repository root: opencode mini → /usage-dashboard")
console.info("접속 주소와 상태 / URL and status: bun run status")
