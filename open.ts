// shortcut: opening uses the service's desktop; add a client-side opener if remote use is required.
export async function openDashboard(url: string) {
  const command = process.platform === "win32"
    ? ["rundll32", "url.dll,FileProtocolHandler", url]
    : process.platform === "darwin"
      ? ["open", url]
      : ["xdg-open", url]
  try {
    const child = Bun.spawn(command, { stdin: "ignore", stdout: "ignore", stderr: "ignore" })
    const code = await child.exited
    return code === 0 ? undefined : `종료 코드 ${code}`
  } catch {
    // Never surface spawn text: it can include local paths or credentials.
    return "실행 실패"
  }
}
