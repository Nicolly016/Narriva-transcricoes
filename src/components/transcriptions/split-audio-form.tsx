"use client"

import { useActionState, useState } from "react"
import { SPLIT_PART_MINUTES } from "@/domain/audio-split"
import { splitAudio, type AudioActionState } from "@/server/audio/actions"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const initialState: AudioActionState = { error: null }

export function SplitAudioForm({ audioId }: { audioId: string }) {
  const [state, action, pending] = useActionState(splitAudio, initialState)
  const [confirming, setConfirming] = useState(false)

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="audioId" value={audioId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="partMinutes">Tamanho de cada parte</Label>
        <select
          id="partMinutes"
          name="partMinutes"
          defaultValue="15"
          className="h-11 max-w-xs rounded-lg border border-input bg-card px-3 text-base"
        >
          {SPLIT_PART_MINUTES.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} minutos
            </option>
          ))}
        </select>
      </div>
      {confirming ? (
        <div className="flex flex-col gap-3">
          <p className="text-base leading-7">
            Você tem certeza? A transcrição deste arquivo para no próximo trecho salvo e o áudio vira partes separadas.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Dividindo…" : "Sim, dividir"}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" className="self-start" onClick={() => setConfirming(true)}>
          Dividir áudio
        </Button>
      )}
      {state.error ? (
        <p role="alert" className="text-base text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
