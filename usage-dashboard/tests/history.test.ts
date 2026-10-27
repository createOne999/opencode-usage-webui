import { describe, expect, test } from "bun:test"
import type { SessionMessageAssistant, SessionMessageInfo } from "@opencode/client"
import { historyWindow, recordedMessage } from "../history"
import { messages } from "./fixtures"

describe("recorded request context", () => {
  const model = { providerID: "openai", id: "example" }
  const records = messages.slice(0, 4).map((message) => recordedMessage(message, 500))

  test("uses the latest compatible completed checkpoint and locates kept history", () => {
    const window = historyWindow(records, model)
    expect(window.active.map((message) => message.id)).toEqual(["msg_checkpoint", "msg_instructions"])
    expect(window.kept.map((message) => message.id)).toEqual(["msg_user", "msg_first"])
    expect(window.archived).toHaveLength(2)
    expect(window.missingKept).toBe(false)
    expect(historyWindow(records.slice(2), model).missingKept).toBe(true)
    expect(historyWindow(records.slice(0, 2), model).active).toHaveLength(2)
  })

  test("skips native windows made by a different model and ignores failed compactions", () => {
    const native: SessionMessageInfo = { id: "msg_native", type: "compaction", time: { created: 450 }, status: "completed", reason: "auto", model: { providerID: "other", id: "different" }, summary: "", native: { messages: [] } }
    const all = [...records, recordedMessage(native)]
    expect(historyWindow(all, model).skippedNative).toBe(true)
    expect(historyWindow(all, native.model!).native).toBe(true)
    const failed: SessionMessageInfo = { id: "msg_failed", type: "compaction", time: { created: 460 }, status: "failed", reason: "auto", error: { type: "unknown", message: "failed" } }
    expect(historyWindow([...records, recordedMessage(failed)], model).active[0]?.id).toBe("msg_checkpoint")
  })

  test("does not expose later-settled assistant or shell output as historical input", () => {
    const assistant = messages[1] as SessionMessageAssistant
    expect(recordedMessage({ ...assistant, time: { created: 200, completed: 600 } }, 500).blocks).toEqual([{ label: "복원 제한", text: "이 응답은 선택한 요청 전에 완료된 것으로 확인되지 않아 본문을 제외했습니다." }])
    const shell: SessionMessageInfo = { id: "msg_shell", type: "shell", time: { created: 100, completed: 600 }, shellID: "sh_test", command: "echo later", status: "exited", output: { output: "later secret", cursor: 12, size: 12, truncated: false } }
    expect(JSON.stringify(recordedMessage(shell, 500))).not.toContain("later secret")
    expect(JSON.stringify(recordedMessage(shell, 700))).toContain("later secret")
  })

  test("describes binary attachments instead of forwarding bytes or provider native data", () => {
    const user: SessionMessageInfo = { id: "msg_file", type: "user", time: { created: 100 }, text: "첨부", files: [{ mime: "image/png", name: "picture.png", data: "binary-secret", source: { type: "inline" } }] }
    expect(JSON.stringify(recordedMessage(user))).toContain("picture.png")
    expect(JSON.stringify(recordedMessage(user))).not.toContain("binary-secret")
    expect(JSON.stringify(recordedMessage(messages.at(-1)!))).not.toContain("provider-native-secret")
  })
})
