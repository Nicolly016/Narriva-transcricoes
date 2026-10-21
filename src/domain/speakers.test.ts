import { describe, expect, it } from "vitest"
import { speakerDisplayName, speakerSwatch, speakersReferToSamePerson } from "./speakers"

describe("speakers", () => {
  it("uses numbered labels instead of civil names", () => {
    expect(speakerDisplayName(1)).toBe("Participante 1")
    expect(speakerDisplayName(2)).toBe("Participante 2")
    expect(speakerSwatch(1).name).not.toBe(speakerSwatch(2).name)
  })

  it("does not treat equal labels in different chunks as the same person", () => {
    const first = { chunkIndex: 0, providerLabel: "A", audioWasSplit: true }
    const second = { chunkIndex: 1, providerLabel: "A", audioWasSplit: true }
    expect(speakersReferToSamePerson(first, second)).toBe(false)
    expect(
      speakersReferToSamePerson(
        { chunkIndex: 0, providerLabel: "A", audioWasSplit: false },
        { chunkIndex: 0, providerLabel: "A", audioWasSplit: false },
      ),
    ).toBe(true)
  })
})
