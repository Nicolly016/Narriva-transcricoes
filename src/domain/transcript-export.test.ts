import { describe, expect, it } from "vitest"
import { buildPlainTranscript, buildTranscriptCsv, buildTranscriptJson, groupTranscriptTurns } from "./transcript-export"

const document = {
  title: "Entrevista",
  language: "pt",
  segments: [
    { speakerName: "Participante 1", startMs: 0, endMs: 1000, text: 'Disse "olá", e continuou' },
  ],
}

describe("transcript document", () => {
  it("keeps each participant in their own turn", () => {
    expect(
      groupTranscriptTurns([
        { id: "a", speakerName: "Participante 1", colorToken: "sky", text: "Olá." },
        { id: "b", speakerName: "Participante 1", colorToken: "sky", text: "Tudo bem?" },
        { id: "c", speakerName: "Participante 2", colorToken: "emerald", text: "Tudo." },
      ]),
    ).toEqual([
      {
        id: "a",
        speakerName: "Participante 1",
        colorToken: "sky",
        text: "Olá. Tudo bem?",
        extraIds: ["b"],
      },
      {
        id: "c",
        speakerName: "Participante 2",
        colorToken: "emerald",
        text: "Tudo.",
        extraIds: [],
      },
    ])
  })
})

describe("transcript export", () => {
  it("keeps speaker labels in the plain text, csv and json", () => {
    expect(buildPlainTranscript(document)).toContain("[00:00] Participante 1")
    expect(buildTranscriptCsv(document)).toContain('"Disse ""olá"", e continuou"')
    expect(JSON.parse(buildTranscriptJson(document)).segmentos[0].participante).toBe("Participante 1")
  })
})
