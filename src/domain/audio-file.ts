import {
  APP_MAX_UPLOAD_BYTES,
  isAcceptedAudioExtension,
  type AcceptedAudioExtension,
} from "@/domain/storage-path"

const MIME_BY_EXTENSION: Record<AcceptedAudioExtension, readonly string[]> = {
  mp3: ["audio/mpeg", "audio/mp3"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave"],
  m4a: ["audio/mp4", "audio/x-m4a", "audio/m4a"],
  mp4: ["video/mp4", "audio/mp4"],
  ogg: ["audio/ogg"],
  webm: ["audio/webm", "video/webm"],
}

export function extensionFromFilename(filename: string): AcceptedAudioExtension | null {
  const base = filename.split(/[/\\]/).pop() ?? ""
  const dot = base.lastIndexOf(".")
  if (dot <= 0 || dot === base.length - 1) {
    return null
  }
  const extension = base.slice(dot + 1).toLowerCase()
  return isAcceptedAudioExtension(extension) ? extension : null
}

export function mimeTypeForExtension(extension: AcceptedAudioExtension): string {
  return MIME_BY_EXTENSION[extension][0]
}

export function sanitizeOriginalFilename(filename: string): string {
  const base = (filename.split(/[/\\]/).pop() ?? "").replace(/[\u0000-\u001f]/g, "").trim()
  if (!base) {
    return "audio"
  }
  return base.slice(0, 240)
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B"
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function uploadSizeError(sizeBytes: number): string | null {
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    return "O arquivo está vazio."
  }
  if (sizeBytes > APP_MAX_UPLOAD_BYTES) {
    return "O arquivo passa de 500 MB, que é o limite do armazenamento."
  }
  return null
}

