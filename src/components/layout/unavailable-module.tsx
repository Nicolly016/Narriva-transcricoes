export function UnavailableModule({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <p className="inline-flex rounded-md bg-warning px-2 py-1 text-sm font-semibold text-warning-foreground">
          Em breve
        </p>
        <p className="mt-4 text-lg leading-8">{detail}</p>
      </div>
    </section>
  )
}
