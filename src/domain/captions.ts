export type CaptionCue = {
  startMs: number
  endMs: number
  text: string
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0")
}

export function formatTimestamp(ms: number, decimal: "," | "."): string {
  const safe = Number.isFinite(ms) ? Math.max(0, Math.floor(ms)) : 0
  const hours = Math.floor(safe / 3_600_000)
  const minutes = Math.floor((safe % 3_600_000) / 60_000)
  const seconds = Math.floor((safe % 60_000) / 1000)
  const millis = safe % 1000
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${decimal}${pad(millis, 3)}`
}

export function formatClock(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const clock = `${pad(minutes)}:${pad(seconds)}`
  return hours > 0 ? `${hours}:${clock}` : clock
}

function cueBody(cue: CaptionCue): string {
  return cue.text.replace(/\s+/g, " ").trim()
}

export function buildSrt(cues: readonly CaptionCue[]): string {
  return cues
    .map((cue, index) => {
      const end = Math.max(cue.startMs, cue.endMs)
      return `${index + 1}\n${formatTimestamp(cue.startMs, ",")} --> ${formatTimestamp(end, ",")}\n${cueBody(cue)}`
    })
    .join("\n\n")
    .concat(cues.length > 0 ? "\n" : "")
}

export function buildVtt(cues: readonly CaptionCue[]): string {
  const body = cues
    .map((cue) => {
      const end = Math.max(cue.startMs, cue.endMs)
      return `${formatTimestamp(cue.startMs, ".")} --> ${formatTimestamp(end, ".")}\n${cueBody(cue)}`
    })
    .join("\n\n")
  return `WEBVTT\n\n${body}${cues.length > 0 ? "\n" : ""}`
}
