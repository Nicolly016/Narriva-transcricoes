"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { speakerColorClass } from "@/components/transcriptions/speaker-color"
import type { TranscriptTurn } from "@/domain/transcript-export"
import { updateTranscriptDocument, type TranscriptActionState } from "@/server/transcription/actions"

const initialState: TranscriptActionState = { error: null }

export function TranscriptDocument({
  transcriptionId,
  turns,
}: {
  transcriptionId: string
  turns: TranscriptTurn[]
}) {
  const [state, action, pending] = useActionState(updateTranscriptDocument, initialState)

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="transcriptionId" value={transcriptionId} />
      <div className="flex flex-col rounded-md border border-neutral-300 bg-white px-8 py-8">
        {turns.map((turn, index) => (
          <section key={turn.id} className={index === 0 ? "" : "mt-8 border-t border-neutral-200 pt-6"}>
            <input type="hidden" name="turnId" value={turn.id} />
            <input type="hidden" name="turnExtra" value={turn.extraIds.join(",")} />
            <p className={`w-fit rounded-md px-2 py-1 text-sm font-semibold ${speakerColorClass(turn.colorToken)}`}>
              {turn.speakerName}
            </p>
            <textarea
              name="turnText"
              defaultValue={turn.text}
              required
              maxLength={200000}
              rows={Math.min(18, Math.max(4, turn.text.split("\n").length + 1))}
              className="mt-3 w-full resize-y border-0 bg-transparent p-0 text-base leading-8 text-neutral-900 outline-none"
            />
          </section>
        ))}
      </div>
      {state.error ? (
        <p role="alert" className="text-base text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  )
}
