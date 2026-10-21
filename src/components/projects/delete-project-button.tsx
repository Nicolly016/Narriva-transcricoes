"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { deleteProject, type ProjectActionState } from "@/server/projects/actions"

const initialState: ProjectActionState = { error: null }

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(deleteProject, initialState)

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Excluir este projeto? Os áudios associados permanecem, sem o vínculo.")) {
          event.preventDefault()
        }
      }}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Excluindo…" : "Excluir"}
      </Button>
      {state.error ? (
        <p role="alert" className="mt-2 text-base text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
