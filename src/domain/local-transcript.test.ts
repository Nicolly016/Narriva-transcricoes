import { describe, expect, it } from "vitest"
import { collapseRepeatedSpeech, durationLimitError, LOCAL_SPEAKER_LABEL, transcriptFromChunks } from "./local-transcript"

describe("local transcript", () => {
  it("keeps timed chunks under one participant", () => {
    const transcript = transcriptFromChunks(
      [
        { text: " Bom dia.", startSeconds: 0.2, endSeconds: 1.4 },
        { text: "   ", startSeconds: 1.4, endSeconds: 1.6 },
        { text: "Vamos começar.", startSeconds: 1.6, endSeconds: 3 },
      ],
      3,
    )

    expect(transcript.text).toBe("Bom dia. Vamos começar.")
    expect(transcript.segments).toEqual([
      {
        id: "seg-0",
        speakerLabel: LOCAL_SPEAKER_LABEL,
        startSeconds: 0.2,
        endSeconds: 1.4,
        text: "Bom dia.",
      },
      {
        id: "seg-2",
        speakerLabel: LOCAL_SPEAKER_LABEL,
        startSeconds: 1.6,
        endSeconds: 3,
        text: "Vamos começar.",
      },
    ])
  })

  it("drops a phrase that the recognizer looped and keeps a short real repetition", () => {
    expect(collapseRepeatedSpeech("o primeiro? o primeiro? o primeiro? o primeiro? Como é")).toBe(
      "o primeiro? Como é",
    )
    expect(collapseRepeatedSpeech("não, não, não")).toBe("não, não, não")
  })

  it("rejects audio that is too short or longer than two hours", () => {
    expect(durationLimitError(0)).toMatch(/duração/)
    expect(durationLimitError(2 * 60 * 60 + 1)).toMatch(/2 horas/)
    expect(durationLimitError(12)).toBeNull()
  })
})
