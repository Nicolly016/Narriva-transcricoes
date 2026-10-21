import { describe, expect, it } from "vitest"
import {
  estimatedProgress,
  progressRemainingPhrase,
  selectSliceChunks,
  transcriptionPercent,
  visiblePercent,
} from "./transcription-progress"

describe("transcription progress", () => {
  it("maps heard audio into the middle of the bar", () => {
    expect(transcriptionPercent(0)).toBe(10)
    expect(transcriptionPercent(0.5)).toBe(51)
    expect(transcriptionPercent(1)).toBe(92)
  })

  it("shows a measured percent only while the audio is being read", () => {
    expect(visiblePercent("queued", null)).toBe(2)
    expect(visiblePercent("preparing", null)).toBe(6)
    expect(visiblePercent("transcribing", null)).toBeNull()
    expect(visiblePercent("transcribing", 40)).toBe(40)
    expect(visiblePercent("saving", null)).toBe(97)
    expect(visiblePercent("completed", 100)).toBeNull()
  })

  it("estimates the remaining time from the audio length when no trecho was recorded", () => {
    const startedAt = 0
    const now = 60 * 60 * 1000
    const estimate = estimatedProgress(60 * 60, startedAt, now)
    expect(estimate?.remaining).toBe("faltam cerca de 36 minutos")
    expect(estimate?.percent).toBeGreaterThan(50)
    expect(estimatedProgress(60 * 60, startedAt, now + 2 * 60 * 60 * 1000)?.remaining).toBe(
      "faltam poucos minutos",
    )
  })

  it("estimates the remaining time after some audio has been read", () => {
    const now = 120_000
    expect(progressRemainingPhrase(10, 0, now)).toBeNull()
    expect(progressRemainingPhrase(50, now - 10_000, now)).toBeNull()
    expect(progressRemainingPhrase(50, now - 120_000, now)).toBe("cerca de 2 minutos")
  })

  it("keeps the new part of an overlapping slice", () => {
    const kept = selectSliceChunks(
      [
        { text: "já ouvido", startSeconds: 20.2, endSeconds: 24 },
        { text: "trecho novo", startSeconds: 26, endSeconds: 32 },
      ],
      20,
      30,
      false,
      false,
    )
    expect(kept.map((chunk) => chunk.text)).toEqual(["trecho novo"])
  })
})
