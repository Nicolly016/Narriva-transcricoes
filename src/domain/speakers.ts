export const SPEAKER_SWATCHES = [
  { token: "sky", name: "azul" },
  { token: "emerald", name: "verde" },
  { token: "amber", name: "âmbar" },
  { token: "rose", name: "rosa" },
  { token: "violet", name: "violeta" },
  { token: "cyan", name: "ciano" },
  { token: "orange", name: "laranja" },
  { token: "slate", name: "cinza" },
] as const

export type SpeakerSwatch = (typeof SPEAKER_SWATCHES)[number]

export function speakerDisplayName(index: number): string {
  if (!Number.isInteger(index) || index < 1) {
    throw new Error("O índice do participante começa em 1.")
  }
  return `Participante ${index}`
}

export function speakerSwatch(index: number): SpeakerSwatch {
  if (!Number.isInteger(index) || index < 1) {
    throw new Error("O índice do participante começa em 1.")
  }
  const swatch = SPEAKER_SWATCHES[(index - 1) % SPEAKER_SWATCHES.length]
  if (!swatch) {
    throw new Error("Paleta de participantes vazia.")
  }
  return swatch
}

export type SpeakerLabelRef = {
  chunkIndex: number
  providerLabel: string
  audioWasSplit: boolean
}

/**
 * Provider labels are voice clusters, not civil identities.
 * When a recording is split, equal labels in different chunks are not the same person.
 */
export function speakersReferToSamePerson(left: SpeakerLabelRef, right: SpeakerLabelRef): boolean {
  if (left.providerLabel.length === 0 || right.providerLabel.length === 0) {
    return false
  }
  if (left.audioWasSplit || right.audioWasSplit) {
    return (
      left.audioWasSplit === right.audioWasSplit &&
      left.chunkIndex === right.chunkIndex &&
      left.providerLabel === right.providerLabel
    )
  }
  return left.providerLabel === right.providerLabel
}
