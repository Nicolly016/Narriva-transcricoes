import { describe, expect, it } from "vitest"
import {
  LONG_AUDIO_SPLIT_BYTES,
  offersAudioSplit,
  partTitle,
  splitRanges,
} from "./audio-split"

describe("audio split", () => {
  it("offers the option for a long recording and for a large file without duration", () => {
    expect(offersAudioSplit("transcribing", 60 * 60, 1000, null)).toBe(true)
    expect(offersAudioSplit("transcribing", null, LONG_AUDIO_SPLIT_BYTES, null)).toBe(true)
    expect(offersAudioSplit("transcribing", 10 * 60, LONG_AUDIO_SPLIT_BYTES, null)).toBe(false)
    expect(offersAudioSplit("completed", 60 * 60, LONG_AUDIO_SPLIT_BYTES, null)).toBe(false)
  })

  it("splits an hour into even parts and keeps a short tail with the previous part", () => {
    expect(splitRanges(60 * 60, 15 * 60)).toEqual([
      { startSeconds: 0, durationSeconds: 15 * 60 },
      { startSeconds: 15 * 60, durationSeconds: 15 * 60 },
      { startSeconds: 30 * 60, durationSeconds: 15 * 60 },
      { startSeconds: 45 * 60, durationSeconds: 15 * 60 },
    ])
    const almost = splitRanges(15 * 60 + 20, 15 * 60)
    expect(almost).toEqual([{ startSeconds: 0, durationSeconds: 15 * 60 + 20 }])
  })

  it("names each part within the title limit", () => {
    expect(partTitle("Jesus", 1, 4)).toBe("Jesus · parte 1 de 4")
    expect(partTitle("A".repeat(250), 2, 4).length).toBeLessThanOrEqual(200)
  })
})
