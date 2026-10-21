"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { publishLiveProgress } from "@/components/transcriptions/live-progress"
import { parseLiveAudioResponse } from "@/domain/live-audio"
import { activeAudioFinished } from "@/domain/processing-status"

const POLL_MS = 4000
const REFRESH_LOCK_MS = 45_000
let refreshLockedUntil = 0

export function StatusPoller({ active, audioIds }: { active: boolean; audioIds: readonly string[] }) {
  const router = useRouter()
  const renderedKey = audioIds.join("|")

  useEffect(() => {
    if (!active || renderedKey.length === 0) {
      return
    }

    const renderedIds = renderedKey.split("|")
    let cancelled = false
    let pollTimer = 0
    const controller = new AbortController()

    async function poll() {
      try {
        const response = await fetch("/transcricoes/andamento", {
          cache: "no-store",
          redirect: "manual",
          signal: controller.signal,
        })
        if (cancelled || !response.ok) {
          return
        }
        const items = parseLiveAudioResponse(await response.json())
        if (!items) {
          return
        }
        publishLiveProgress(items)
        const finished = activeAudioFinished(
          renderedIds,
          items.map((item) => item.id),
        )
        if (finished && Date.now() >= refreshLockedUntil) {
          refreshLockedUntil = Date.now() + REFRESH_LOCK_MS
          router.refresh()
        }
      } catch {
        // The dev server can drop one poll while a transcription keeps the process busy.
      } finally {
        if (!cancelled) {
          pollTimer = window.setTimeout(() => {
            void poll()
          }, POLL_MS)
        }
      }
    }

    pollTimer = window.setTimeout(() => {
      void poll()
    }, POLL_MS)

    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(pollTimer)
    }
  }, [active, renderedKey, router])

  return null
}
