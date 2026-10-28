import tailwind from "bun-plugin-tailwind"

const result = await Bun.build({
  entrypoints: ["./web/index.html"],
  outdir: "./dist",
  publicPath: "/",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [tailwind],
})

if (!result.success) throw new AggregateError(result.logs, "Dashboard build failed")

console.info("Dashboard ready. From the repository root: opencode mini → /usage-dashboard")
console.info("접속 주소와 상태 / URL and status: bun run status")
