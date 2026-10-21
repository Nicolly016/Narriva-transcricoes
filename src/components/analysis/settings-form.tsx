"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { saveAnalysisSettings, type AnalysisActionState } from "@/server/analysis/actions"

const initialState: AnalysisActionState = { error: null }

export function AnalysisSettingsForm({
  removePunctuation,
  useLemmatization,
  ignoredWords,
}: {
  removePunctuation: boolean
  useLemmatization: boolean
  ignoredWords: readonly string[]
}) {
  const [state, action, pending] = useActionState(saveAnalysisSettings, initialState)

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex items-start gap-3 text-base leading-7">
        <input type="checkbox" name="removePunctuation" value="sim" defaultChecked={removePunctuation} className="mt-1 size-4" />
        <span>Remover pontuação antes de contar as palavras.</span>
      </label>
      <label className="flex items-start gap-3 text-base leading-7">
        <input type="checkbox" name="useLemmatization" value="sim" defaultChecked={useLemmatization} className="mt-1 size-4" />
        <span>Agrupar plurais simples, como casas e casa. Isso não é uma lematização linguística completa.</span>
      </label>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ignoredWords">Palavras ignoradas</Label>
        <Textarea
          id="ignoredWords"
          name="ignoredWords"
          rows={3}
          defaultValue={ignoredWords.join("\n")}
          placeholder="Uma palavra por linha"
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-base text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {pending ? "Salvando…" : "Salvar filtros"}
      </Button>
    </form>
  )
}
