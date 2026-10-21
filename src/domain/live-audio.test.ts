import { describe, expect, it } from "vitest"
import { parseLiveAudioResponse } from "./live-audio"

const audioId = "043ded62-4092-461e-a3de-652db5147cc5"

describe("live audio payload", () => {
  it("accepts a progress snapshot", () => {
    expect(
      parseLiveAudioResponse({
        items: [
          {
            id: audioId,
            status: "transcribing",
            progressPercent: 40,
            progressStartedAt: 10,
            durationSeconds: 90,
            jobStartedAt: 5,
          },
        ],
      }),
    ).toEqual([
      {
        id: audioId,
        status: "transcribing",
        progressPercent: 40,
        progressStartedAt: 10,
        durationSeconds: 90,
        jobStartedAt: 5,
      },
    ])
  })

  it("rejects a payload that is missing progress fields", () => {
    expect(parseLiveAudioResponse({ items: [{ id: audioId, status: "transcribing" }] })).toBeNull()
    expect(parseLiveAudioResponse({ items: "nope" })).toBeNull()
  })
})