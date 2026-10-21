import { describe, expect, it } from "vitest"
import { assignSpeakerLabels } from "./speaker-diarization"

function tone(hz: number, seconds: number, sampleRate = 16_000): Float32Array {
  const length = Math.floor(seconds * sampleRate)
  const samples = new Float32Array(length)
  for (let index = 0; index < length; index += 1) {
    samples[index] = 0.45 * Math.sin((2 * Math.PI * hz * index) / sampleRate)
  }
  return samples
}

function concat(parts: readonly Float32Array[]): Float32Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const samples = new Float32Array(length)
  let offset = 0
  for (const part of parts) {
    samples.set(part, offset)
    offset += part.length
  }
  return samples
}

describe("speaker diarization", () => {
  it("gives a different participant to a clearly different voice and returns to the first", () => {
    const sampleRate = 16_000
    const pcm = concat([tone(120, 0.8), tone(240, 0.8), tone(120, 0.8)])
    const labeled = assignSpeakerLabels(pcm, sampleRate, [
      { startSeconds: 0, endSeconds: 0.8, text: "primeira" },
      { startSeconds: 0.8, endSeconds: 1.6, text: "segunda" },
      { startSeconds: 1.6, endSeconds: 2.4, text: "primeira de novo" },
    ])

    expect(labeled.map((segment) => segment.speakerLabel)).toEqual(["A", "B", "A"])
  })

  it("keeps two stretches of the same voice together", () => {
    const sampleRate = 16_000
    const pcm = concat([tone(140, 0.8), tone(140, 0.8)])
    const labeled = assignSpeakerLabels(pcm, sampleRate, [
      { startSeconds: 0, endSeconds: 0.8, text: "oi" },
      { startSeconds: 0.8, endSeconds: 1.6, text: "de novo" },
    ])

    expect(labeled.map((segment) => segment.speakerLabel)).toEqual(["A", "A"])
  })
})
