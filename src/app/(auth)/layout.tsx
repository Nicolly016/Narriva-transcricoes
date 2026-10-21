export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)] lg:grid-cols-[28rem_minmax(0,1fr)]">
      <div className="bg-sidebar px-6 py-8 text-sidebar-foreground lg:flex lg:w-[28rem] lg:shrink-0 lg:flex-col lg:justify-between lg:px-10 lg:py-12">
        <div className="min-w-0">
          <h1 className="max-w-sm text-balance text-2xl font-semibold leading-tight sm:text-3xl">Narriva</h1>
          <p className="mt-3 max-w-sm text-sm font-semibold leading-5 text-sidebar-muted">
            Transcrição e organização de áudios
          </p>
          <p className="mt-4 hidden max-w-sm text-lg leading-8 lg:block">
            Organize projetos e prepare a leitura de falas em português brasileiro.
          </p>
        </div>
      </div>
      <div className="flex w-full min-w-0 items-center justify-center px-4 py-10">
        <div className="w-full min-w-0 max-w-md">{children}</div>
      </div>
    </div>
  )
}
