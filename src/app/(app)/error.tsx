"use client"

import { Button } from "@/components/ui/button"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">Não foi possível carregar esta página.</h1>
      <p className="text-lg leading-8 text-muted-foreground">{error.message}</p>
      <Button type="button" variant="outline" className="self-start" onClick={() => reset()}>
        Tentar novamente
      </Button>
    </div>
  )
}
