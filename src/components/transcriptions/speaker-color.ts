const SPEAKER_COLORS: Record<string, string> = {
  sky: "bg-sky-200 text-sky-950",
  emerald: "bg-emerald-200 text-emerald-950",
  amber: "bg-amber-200 text-amber-950",
  rose: "bg-rose-200 text-rose-950",
  violet: "bg-violet-200 text-violet-950",
  cyan: "bg-cyan-200 text-cyan-950",
  orange: "bg-orange-200 text-orange-950",
  slate: "bg-slate-200 text-slate-900",
}

export function speakerColorClass(token: string): string {
  return SPEAKER_COLORS[token] ?? SPEAKER_COLORS.slate
}
