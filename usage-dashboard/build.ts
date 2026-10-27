import tailwind from "bun-plugin-tailwind"

const result = await Bun.build({
  entrypoints: ["./web/index.html"],
  outdir: "./dist",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [tailwind],
})

if (!result.success) throw new AggregateError(result.logs, "Dashboard build failed")
