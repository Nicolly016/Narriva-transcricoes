import { Suspense } from "react"
import { AppFrame } from "@/components/layout/app-frame"

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-8 text-lg text-muted-foreground">Carregando sessão…</p>}>
      <AppFrame>{children}</AppFrame>
    </Suspense>
  )
}
