import { describe, expect, it } from "vitest"
import { AUDIO_PAUSED_MESSAGE, canPauseProcessing, isPausedTranscription } from "./audio-pause"

describe("audio pause", () => {
  it("pauses only a transcription that is waiting or running", () => {
    expect(canPauseProcessing("queued")).toBe(true)
    expect(canPauseProcessing("preparing")).toBe(true)
    expect(canPauseProcessing("transcribing")).toBe(true)
    expect(canPauseProcessing("saving")).toBe(false)
    expect(canPauseProcessing("completed")).toBe(false)
    expect(canPauseProcessing("error")).toBe(false)
  })

  it("recognizes a paused transcription by its message", () => {
    expect(isPausedTranscription("error", AUDIO_PAUSED_MESSAGE)).toBe(true)
    expect(isPausedTranscription("error", "A transcrição falhou.")).toBe(false)
    expect(isPausedTranscription("transcribing", AUDIO_PAUSED_MESSAGE)).toBe(false)
  })
})
