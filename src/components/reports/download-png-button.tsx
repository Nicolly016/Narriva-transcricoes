"use client"

import type { TermCount } from "@/domain/text-analysis"
import { placeWordCloud } from "@/domain/word-cloud"
import { Button } from "@/components/ui/button"

const COLORS = ["#b4236a", "#e0568f", "#8d2f5b", "#f3a0c2", "#6e2448"]

export function DownloadPngButton({ terms }: { terms: TermCount[] }) {
  function download() {
    const layout = placeWordCloud(terms)
    const canvas = document.createElement("canvas")
    canvas.width = layout.width
    canvas.height = layout.height
    const context = canvas.getContext("2d")
    if (!context) {
      return
    }
    context.fillStyle = "#fde7f1"
    context.fillRect(0, 0, layout.width, layout.height)
    layout.words.forEach((word, index) => {
      context.fillStyle = COLORS[index % COLORS.length] ?? "#b4236a"
      context.font = `${word.fontSize}px "Segoe UI", sans-serif`
      context.textBaseline = "alphabetic"
      context.fillText(word.term, word.x, word.y)
    })
    const link = document.createElement("a")
    link.href = canvas.toDataURL("image/png")
    link.download = "nuvem.png"
    link.click()
  }

  return (
    <Button type="button" variant="outline" onClick={download} disabled={terms.length === 0}>
      Baixar PNG
    </Button>
  )
}
