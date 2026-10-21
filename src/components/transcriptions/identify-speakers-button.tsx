"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { identifySpeakers, type TranscriptActionState } from "@/server/transcription/actions"

const initialState: TranscriptActionState = { error: null }

export function IdentifySpeakersButton({ audioId }: { audioId: string }) {
  const [state, action, pending] = useActionState(identifySpeakers, initialState)
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
        Identificar participantes
      </Button>
    )
  }

  return (
    <form action={action} className="flex max-w-xl flex-col gap-3">
      <input type="hidden" name="audioId" value={audioId} />
      <p className="text-base leading-7">
        Você tem certeza? As falas serão separadas pelo som em Participante 1, Participante 2 e os seguintes.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Identificando…" : "Sim, identificar"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
          Cancelar
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
