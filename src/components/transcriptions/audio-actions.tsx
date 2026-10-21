"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { deleteAudio, pauseTranscription, reloadTranscription, resumePausedTranscription, retryTranscription, type AudioActionState } from "@/server/audio/actions"

const initialState: AudioActionState = { error: null }

export function RetryTranscriptionButton({ audioId }: { audioId: string }) {
  const [state, action, pending] = useActionState(retryTranscription, initialState)

  return (
    <form action={action}>
      <input type="hidden" name="audioId" value={audioId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Reiniciando…" : "Tentar de novo"}
      </Button>
      {state.error ? (
        <p role="alert" className="mt-2 text-base text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function ReloadTranscriptionButton({ audioId }: { audioId: string }) {
  const [state, action, pending] = useActionState(reloadTranscription, initialState)
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
        Recarregar
      </Button>
    )
  }

  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <input type="hidden" name="audioId" value={audioId} />
      <p className="text-base leading-7">Você tem certeza? A transcrição atual será substituída por uma nova leitura.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Recarregando…" : "Sim, recarregar"}
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

export function DeleteAudioButton({ audioId }: { audioId: string }) {
  const [state, action, pending] = useActionState(deleteAudio, initialState)
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
        Excluir áudio
      </Button>
    )
  }

  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <input type="hidden" name="audioId" value={audioId} />
      <p className="text-base leading-7">Você tem certeza? O áudio e a transcrição serão apagados.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Excluindo…" : "Sim, excluir"}
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

export function PauseTranscriptionButton({ audioId }: { audioId: string }) {
  const [state, action, pending] = useActionState(pauseTranscription, initialState)

  return (
    <form action={action}>
      <input type="hidden" name="audioId" value={audioId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Pausando…" : "Pausar"}
      </Button>
      {state.error ? (
        <p role="alert" className="mt-2 text-base text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function ResumeTranscriptionButton({ audioId }: { audioId: string }) {
  const [state, action, pending] = useActionState(resumePausedTranscription, initialState)

  return (
    <form action={action}>
      <input type="hidden" name="audioId" value={audioId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Continuando…" : "Continuar"}
      </Button>
      {state.error ? (
        <p role="alert" className="mt-2 text-base text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
