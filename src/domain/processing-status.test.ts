import { describe, expect, it } from "vitest"
import {
  PROCESSING_STATUS_LABELS,
  activeAudioFinished,
  canReloadTranscription,
  canRetryProcessing,
  canTransitionStatus,
} from "./processing-status"

describe("processing status", () => {
  it("uses the real processing labels", () => {
    expect(Object.values(PROCESSING_STATUS_LABELS)).toEqual([
      "Arquivo enviado",
      "Aguardando processamento",
      "Preparando áudio",
      "Transcrevendo",
      "Identificando participantes",
      "Salvando resultados",
      "Concluído",
      "Erro",
    ])
  })

  it("follows the pipeline and allows a bounded retry", () => {
    expect(canTransitionStatus("uploaded", "queued")).toBe(true)
    expect(canTransitionStatus("uploaded", "transcribing")).toBe(false)
    expect(canTransitionStatus("transcribing", "error")).toBe(true)
    expect(canTransitionStatus("completed", "error")).toBe(false)
    expect(canTransitionStatus("error", "queued")).toBe(true)
    expect(canRetryProcessing("error")).toBe(true)
    expect(canRetryProcessing("transcribing")).toBe(false)
    expect(canReloadTranscription("completed")).toBe(true)
    expect(canReloadTranscription("error")).toBe(false)
  })

  it("notices when a rendered audio leaves the active set", () => {
    expect(activeAudioFinished(["audio-a"], ["audio-a"])).toBe(false)
    expect(activeAudioFinished(["audio-a", "audio-b"], ["audio-a"])).toBe(true)
    expect(activeAudioFinished(["audio-a"], [])).toBe(true)
    expect(activeAudioFinished([], [])).toBe(false)
  })
})
