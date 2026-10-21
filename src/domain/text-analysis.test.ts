import { describe, expect, it } from "vitest"
import { analyzeUtterances, foldPortuguesePlural } from "./text-analysis"

describe("text analysis", () => {
  it("counts content words and speaking time", () => {
    const analysis = analyzeUtterances(
      [
        { speakerName: "Participante 1", startMs: 0, endMs: 10_000, text: "A casa e as casas da reunião." },
        { speakerName: "Participante 2", startMs: 10_000, endMs: 12_000, text: "Reunião marcada." },
      ],
      { removePunctuation: true, useLemmatization: true, ignoredWords: ["marcada"] },
    )

    expect(foldPortuguesePlural("casas")).toBe("casa")
    expect(analysis.durationMs).toBe(12_000)
    expect(analysis.speakers[0]).toMatchObject({ name: "Participante 1", talkMs: 10_000, turns: 1 })
    expect(analysis.terms.find((term) => term.term === "casa")?.count).toBe(2)
    expect(analysis.terms.find((term) => term.term === "reunião")?.count).toBe(2)
    expect(analysis.terms.some((term) => term.term === "marcada")).toBe(false)
    expect(analysis.terms.some((term) => term.term === "as")).toBe(false)
  })
})
