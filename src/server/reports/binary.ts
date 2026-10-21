import "server-only"

import { Document, Packer, Paragraph, TextRun } from "docx"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { formatClock } from "@/domain/captions"
import type { ExportDocument } from "@/domain/transcript-export"

function winAnsi(text: string): string {
  let result = ""
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (code === 0x0a || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
      result += char
    } else {
      result += "?"
    }
  }
  return result
}

export async function buildDocx(document: ExportDocument): Promise<Uint8Array> {
  const children = [
    new Paragraph({
      children: [new TextRun({ text: document.title, bold: true, size: 32 })],
    }),
  ]
  for (const segment of document.segments) {
    children.push(
      new Paragraph({
        spacing: { before: 240 },
        children: [
          new TextRun({
            text: `${formatClock(segment.startMs)} ${segment.speakerName}`,
            bold: true,
          }),
        ],
      }),
      new Paragraph({ children: [new TextRun(segment.text)] }),
    )
  }
  const doc = new Document({ sections: [{ children }] })
  return Packer.toBuffer(doc)
}

export async function buildPdf(document: ExportDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pageWidth = 595
  const pageHeight = 842
  const margin = 48
  const maxWidth = pageWidth - margin * 2
  let page = pdf.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  function nextLine(size: number) {
    y -= size + 6
    if (y < margin) {
      page = pdf.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  function drawWrapped(text: string, size: number, face: typeof font) {
    const words = winAnsi(text).split(/\s+/).filter(Boolean)
    let line = ""
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (face.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        page.drawText(line, { x: margin, y, size, font: face, color: rgb(0.16, 0.18, 0.22) })
        nextLine(size)
        line = word
      } else {
        line = candidate
      }
    }
    if (line) {
      page.drawText(line, { x: margin, y, size, font: face, color: rgb(0.16, 0.18, 0.22) })
      nextLine(size)
    }
  }

  drawWrapped(document.title, 16, bold)
  for (const segment of document.segments) {
    drawWrapped(`${formatClock(segment.startMs)} ${segment.speakerName}`, 11, bold)
    drawWrapped(segment.text, 11, font)
    y -= 8
  }

  return pdf.save()
}
