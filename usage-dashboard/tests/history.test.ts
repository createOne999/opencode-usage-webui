import { describe, expect, test } from "bun:test"
import type { SessionMessageAssistant, SessionMessageInfo } from "@opencode/client"
import { historyWindow, recordedMessage, requestSummary } from "../history"
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
    expect(historyWindow(records.map((message) => message.checkpoint ? { ...message, checkpoint: { ...message.checkpoint, keepID: "msg_checkpoint" } } : message), model).missingKept).toBe(true)
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
    expect(recordedMessage({ ...assistant, time: { created: 200, completed: 600 } }, 500).blocks).toEqual([{ label: "복원 제한", text: "이 응답은 선택한 요청 전에 완료된 것으로 확인되지 않아 본문을 제외했습니다.", kind: "restoreLimited", textKey: "responseIncomplete" }])
    const lateTool = { ...assistant, content: assistant.content.map((part) => part.type === "tool" ? { ...part, time: { ...part.time, completed: 600 } } : part) }
    expect(JSON.stringify(recordedMessage(lateTool, 500))).not.toContain("저장된 도구 결과")
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

  test("adds stable localization fields while keeping original labels and raw values", () => {
    const [user, first, checkpoint, instructions] = messages as [SessionMessageInfo, SessionMessageAssistant, SessionMessageInfo, SessionMessageInfo]
    expect(requestSummary(messages[4] as SessionMessageAssistant).statusCode).toBe("completed")
    expect(requestSummary(messages[6] as SessionMessageAssistant).statusCode).toBe("incomplete")
    expect(requestSummary({ ...messages[1] as SessionMessageAssistant, error: { type: "unknown", message: "failed" } }).statusCode).toBe("error")

    const userRecord = recordedMessage(user)
    expect(userRecord).toMatchObject({ label: "사용자", labelKey: "user", blocks: [{ label: "메시지", kind: "message", text: "첫 질문 <script>unsafe()</script>" }] })

    const assistantRecord = recordedMessage(first)
    expect(assistantRecord).toMatchObject({ label: "응답 · openai/example", labelKey: "assistant", labelValues: { model: "openai/example" } })
    expect(assistantRecord.blocks.map((block) => block.kind)).toEqual(["response", "tool", "toolResult"])
    expect(assistantRecord.blocks[1]).toMatchObject({ kind: "tool", labelValues: { name: "read", status: "completed" } })

    expect(recordedMessage(checkpoint)).toMatchObject({ label: "컨텍스트 압축 · completed", labelKey: "compaction", labelValues: { status: "completed" }, blocks: [{ kind: "compactionSummary" }] })
    expect(recordedMessage(instructions).labelKey).toBe("system")

    const skill: SessionMessageInfo = { id: "msg_skill", type: "skill", time: { created: 100 }, skill: "review", name: "review", text: "skill body" }
    expect(recordedMessage(skill)).toMatchObject({ labelKey: "skill", labelValues: { name: "review" }, blocks: [{ kind: "skillText" }] })
  })

  test("exposes structured fallbacks for unnamed attachments without exposing hidden data", () => {
    const user: SessionMessageInfo = { id: "msg_unnamed", type: "user", time: { created: 100 }, text: "첨부", files: [{ mime: "image/png", data: "binary-secret", source: { type: "inline" } }] }
    const block = recordedMessage(user).blocks[1]!
    expect(block).toMatchObject({ kind: "attachedFile", file: { mime: "image/png" } })
    expect(JSON.stringify(block)).not.toContain("binary-secret")
  })
})
