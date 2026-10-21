import { describe, expect, it } from "vitest"
import { assertOwnedStoragePath, buildAudioStoragePath } from "./storage-path"

const userId = "11111111-1111-4111-8111-111111111111"
const audioId = "22222222-2222-4222-8222-222222222222"

describe("storage paths", () => {
  it("builds a path inside the user folder", () => {
    expect(buildAudioStoragePath(userId, audioId, ".MP3")).toBe(`${userId}/${audioId}.mp3`)
  })

  it("rejects another user's path and traversal", () => {
    expect(() => assertOwnedStoragePath(userId, `${audioId}/file.mp3`)).toThrow()
    expect(() => assertOwnedStoragePath(userId, `${userId}/../secret.mp3`)).toThrow()
    expect(() => buildAudioStoragePath(userId, audioId, "exe")).toThrow()
  })
})
