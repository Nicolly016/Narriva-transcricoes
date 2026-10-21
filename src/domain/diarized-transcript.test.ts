import { describe, expect, it } from "vitest"
import { parseDiarizedTranscript, secondsToMs, speakerDraftsFromLabels } from "./diarized-transcript"

describe("diarized transcript", () => {
  it("keeps speaker labels from the provider and numbers the display names", () => {
    const parsed = parseDiarizedTranscript({
      duration: 4.2,
      text: "Bom dia. Olá.",
      segments: [
        { id: "seg_1", start: 0, end: 1.5, text: "Bom dia.", speaker: "B" },
        { id: "seg_2", start: 1.5, end: 4.2, text: "Olá.", speaker: "A" },
        { id: "seg_3", start: 4.2, end: 4.2, text: "   ", speaker: "A" },
      ],
    })

    expect(parsed.durationSeconds).toBe(4.2)
    expect(parsed.segments.map((segment) => segment.speakerLabel)).toEqual(["B", "A"])
    expect(speakerDraftsFromLabels(parsed.segments.map((segment) => segment.speakerLabel))).toEqual([
      {
        providerLabel: "B",
        displayName: "Participante 1",
        colorToken: "sky",
        sortOrder: 0,
        chunkIndex: 0,
      },
      {
        providerLabel: "A",
        displayName: "Participante 2",
        colorToken: "emerald",
        sortOrder: 1,
        chunkIndex: 0,
      },
    ])
    expect(secondsToMs(1.234)).toBe(1234)
  })

  it("builds one segment when the response has text and no segments", () => {
    const parsed = parseDiarizedTranscript({ text: "Somente o texto.", duration: 3 })
    expect(parsed.segments).toEqual([
      {
        id: "seg-0",
        speakerLabel: "A",
        startSeconds: 0,
        endSeconds: 3,
        text: "Somente o texto.",
      },
    ])
  })

  it("rejects an empty payload", () => {
    expect(() => parseDiarizedTranscript({ segments: [] })).toThrow(/sem texto/)
  })
})
