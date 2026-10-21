"use client"

import { useEffect, useState } from "react"
import { useLiveAudio } from "@/components/transcriptions/live-progress"
import { estimatedProgress, progressRemainingPhrase, visiblePercent } from "@/domain/transcription-progress"
import type { ProcessingStatus } from "@/domain/processing-status"

export function ProgressMeter({
  audioId,
  status,
  reportedPercent,
  startedAt,
  durationSeconds = null,
  jobStartedAt = null,
  compact = false,
}: {
  audioId: string
  status: ProcessingStatus
  reportedPercent: number | null
  startedAt: number | null
  durationSeconds?: number | null
  jobStartedAt?: number | null
  compact?: boolean
}) {
  const live = useLiveAudio(audioId)
  const currentStatus = live?.status ?? status
  const currentPercent = live ? live.progressPercent : reportedPercent
  const currentStartedAt = live ? live.progressStartedAt : startedAt
  const currentDuration = live ? live.durationSeconds : durationSeconds
  const currentJobStartedAt = live ? live.jobStartedAt : jobStartedAt
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const timer = window.setInterval(tick, 15_000)
    return () => window.clearInterval(timer)
  }, [])

  if (currentStatus === "queued") {
    return (
      <p className={compact ? "text-base text-muted-foreground" : "text-lg text-muted-foreground"}>
        Na fila. Só uma transcrição roda por vez.
      </p>
    )
  }
  const measured = visiblePercent(currentStatus, currentPercent)
  const estimate =
    now != null &&
    measured == null &&
    currentStatus === "transcribing" &&
    currentDuration != null &&
    currentJobStartedAt != null
      ? estimatedProgress(currentDuration, currentJobStartedAt, now)
      : null
  const percent = measured ?? estimate?.percent ?? null
  if (percent == null) {
    if (compact || currentStatus !== "transcribing") {
      return null
    }
    return (
      <p className="text-lg text-muted-foreground">
        A transcrição está em andamento. Esta página atualiza sozinha.
      </p>
    )
  }

  const left = Math.max(0, 100 - percent)
  const measuredRemaining =
    now != null && currentPercent != null && currentStartedAt != null
      ? progressRemainingPhrase(percent, currentStartedAt, now)
      : null
  const summary = estimate
    ? `${percent}% concluído · ${estimate.remaining}`
    : measuredRemaining
      ? `${percent}% concluído · faltam ${left}% · ${measuredRemaining}`
      : `${percent}% concluído · faltam ${left}%`

  return (
    <div className={compact ? "flex max-w-md flex-col gap-2" : "flex max-w-xl flex-col gap-2"}>
      <p className={compact ? "text-base text-muted-foreground" : "text-lg text-muted-foreground"}>{summary}</p>
      <div
        className="h-3 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Andamento da transcrição"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      {compact ? null : <p className="text-base text-muted-foreground">Esta página atualiza sozinha.</p>}
    </div>
  )
}
