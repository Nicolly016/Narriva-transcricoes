import { describe, expect, it } from "vitest"
import { buildWordCloudSvg, placeWordCloud } from "./word-cloud"

describe("word cloud", () => {
  it("places terms and escapes svg text", () => {
    const layout = placeWordCloud([
      { term: "reunião", count: 4 },
      { term: "casa", count: 1 },
    ])
    expect(layout.words).toHaveLength(2)
    expect(layout.words[0]?.fontSize).toBeGreaterThan(layout.words[1]?.fontSize ?? 0)
    expect(buildWordCloudSvg([{ term: "a<b>", count: 2 }])).toContain("a&lt;b&gt;")
  })
})