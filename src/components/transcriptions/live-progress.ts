"use client"

import { useSyncExternalStore } from "react"
import type { LiveAudio } from "@/domain/live-audio"

let current = new Map<string, LiveAudio>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publishLiveProgress(items: readonly LiveAudio[]) {
  const next = new Map(current)
  for (const item of items) {
    next.set(item.id, item)
  }
  current = next
  for (const listener of listeners) {
    listener()
  }
}

export function useLiveAudio(audioId: string): LiveAudio | undefined {
  return useSyncExternalStore(
    subscribe,
    () => current.get(audioId),
    () => undefined,
  )
}
