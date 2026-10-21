import { describe, expect, it } from "vitest"
import { buildSrt, buildVtt, formatClock } from "./captions"

describe("captions", () => {
  it("writes SRT and VTT cues", () => {
    const cues = [{ startMs: 1500, endMs: 3200, text: "Bom dia." }]
    expect(formatClock(1500)).toBe("00:01")
    expect(buildSrt(cues)).toContain("00:00:01,500 --> 00:00:03,200")
    expect(buildVtt(cues).startsWith("WEBVTT")).toBe(true)
    expect(buildVtt(cues)).toContain("00:00:01.500 --> 00:00:03.200")
  })
})
