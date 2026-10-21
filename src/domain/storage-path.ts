const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const ACCEPTED_AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "mp4", "ogg", "webm"] as const

export type AcceptedAudioExtension = (typeof ACCEPTED_AUDIO_EXTENSIONS)[number]

export const ACCEPTED_AUDIO_LABEL = "MP3, WAV, M4A, MP4, OGG ou WebM"

/** Storage cap for the private bucket. The transcription provider has a smaller per-request limit. */
export const APP_MAX_UPLOAD_BYTES = 500 * 1024 * 1024

export function isAcceptedAudioExtension(value: string): value is AcceptedAudioExtension {
  return (ACCEPTED_AUDIO_EXTENSIONS as readonly string[]).includes(value.toLowerCase())
}

export function buildAudioStoragePath(
  userId: string,
  audioId: string,
  extension: string,
): string {
  if (!UUID_PATTERN.test(userId) || !UUID_PATTERN.test(audioId)) {
    throw new Error("Identificadores de armazenamento precisam ser UUIDs.")
  }
  const normalized = extension.toLowerCase().replace(/^\./, "")
  if (!isAcceptedAudioExtension(normalized)) {
    throw new Error("Extensão de áudio não aceita.")
  }
  return `${userId}/${audioId}.${normalized}`
}

export function assertOwnedStoragePath(userId: string, storagePath: string): void {
  if (!UUID_PATTERN.test(userId)) {
    throw new Error("Usuário inválido.")
  }
  if (
    storagePath.length === 0 ||
    storagePath.includes("..") ||
    storagePath.includes("\\") ||
    storagePath.startsWith("/") ||
    storagePath.includes("//")
  ) {
    throw new Error("Caminho de armazenamento inválido.")
  }
  const prefix = `${userId}/`
  if (!storagePath.startsWith(prefix) || storagePath.length <= prefix.length) {
    throw new Error("O arquivo não pertence ao usuário autenticado.")
  }
}
