"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateDisplayName, type ProfileActionState } from "@/server/profile/actions"

const initialState: ProfileActionState = { error: null, saved: false }

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action, pending] = useActionState(updateDisplayName, initialState)

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Nome de exibição</Label>
        <Input id="displayName" name="displayName" defaultValue={displayName} required maxLength={80} />
      </div>
      {state.error ? (
        <p role="alert" className="text-base text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.saved ? <p className="text-base text-muted-foreground">Nome salvo.</p> : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  )
}
