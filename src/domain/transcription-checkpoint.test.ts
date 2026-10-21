import { describe, expect, it } from "vitest"
import { parseSliceCheckpoint, usableSliceCheckpoint } from "./transcription-checkpoint"

describe("transcription checkpoint", () => {
  it("keeps a saved slice when it belongs to the same audio", () => {
    const saved = parseSliceCheckpoint({
      pcmLength: 16000,
      nextOffset: 8000,
      pieces: [{ text: "olá", startSeconds: 0, endSeconds: 1 }],
    })
    expect(usableSliceCheckpoint(saved, 16000)?.nextOffset).toBe(8000)
    expect(usableSliceCheckpoint(saved, 32000)).toBeNull()
  })

  it("rejects a checkpoint that does not match the saved shape", () => {
    expect(parseSliceCheckpoint({ pcmLength: 10, nextOffset: 11, pieces: [] })).toBeNull()
    expect(parseSliceCheckpoint({ pcmLength: 10, nextOffset: 0, pieces: [{ text: 1 }] })).toBeNull()
  })
})
