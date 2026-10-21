import { describe, expect, it } from "vitest"
import {
  extensionFromFilename,
  mimeTypeForExtension,
  sanitizeOriginalFilename,
  uploadSizeError,
} from "./audio-file"

describe("audio files", () => {
  it("reads the extension and ignores the directory", () => {
    expect(extensionFromFilename("C:\\audios\\entrevista.MP3")).toBe("mp3")
    expect(extensionFromFilename("entrevista.mp4")).toBe("mp4")
    expect(mimeTypeForExtension("mp4")).toBe("video/mp4")
    expect(mimeTypeForExtension("wav")).toBe("audio/wav")
  })

  it("drops path characters from the original name", () => {
    expect(sanitizeOriginalFilename("../segredo.mp3")).toBe("segredo.mp3")
  })

  it("rejects an empty file and files above the bucket limit", () => {
    expect(uploadSizeError(0)).toMatch(/vazio/)
    expect(uploadSizeError(500 * 1024 * 1024 + 1)).toMatch(/500 MB/)
    expect(uploadSizeError(1024)).toBeNull()
  })
})
