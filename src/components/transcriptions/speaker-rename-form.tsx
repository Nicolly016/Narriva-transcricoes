"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { renameSpeaker, type TranscriptActionState } from "@/server/transcription/actions"

const initialState: TranscriptActionState = { error: null }

export function SpeakerRenameForm({ speakerId, displayName }: { speakerId: string; displayName: string }) {
  const [state, action, pending] = useActionState(renameSpeaker, initialState)

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="speakerId" value={speakerId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input name="displayName" defaultValue={displayName} maxLength={120} required aria-label="Nome do participante" />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Salvando…" : "Renomear"}
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-base text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
