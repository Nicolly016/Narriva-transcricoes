import { NextResponse } from "next/server"
import { z } from "zod"
import { buildSrt, buildVtt } from "@/domain/captions"
import { analyzeUtterances } from "@/domain/text-analysis"
import { buildPlainTranscript, buildTranscriptCsv, buildTranscriptJson, captionCues } from "@/domain/transcript-export"
import { buildWordCloudSvg } from "@/domain/word-cloud"
import { buildDocx, buildPdf } from "@/server/reports/binary"
import { getCurrentUser } from "@/server/auth/current-user"
import { loadAnalysisSettings, loadExportDocument, loadUtterances } from "@/server/transcription/load"

const FORMATS = ["txt", "json", "csv", "srt", "vtt", "docx", "pdf", "svg"] as const

type ReportFormat = (typeof FORMATS)[number]

function isFormat(value: string | null): value is ReportFormat {
  return FORMATS.some((format) => format === value)
}

function binaryBody(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy])
}

function attachment(body: BodyInit, contentType: string, filename: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  const url = new URL(request.url)
  const audioId = url.searchParams.get("audio")
  const format = url.searchParams.get("formato")
  if (!z.uuid().safeParse(audioId).success || !isFormat(format)) {
    return new NextResponse("Pedido inválido.", { status: 400 })
  }

  const document = await loadExportDocument(user.id, audioId ?? "")
  if (!document) {
    return new NextResponse("A transcrição ainda não está pronta.", { status: 404 })
  }

  if (format === "txt") {
    return attachment(`\uFEFF${buildPlainTranscript(document)}`, "text/plain; charset=utf-8", "transcricao.txt")
  }
  if (format === "json") {
    return attachment(buildTranscriptJson(document), "application/json; charset=utf-8", "transcricao.json")
  }
  if (format === "csv") {
    return attachment(`\uFEFF${buildTranscriptCsv(document)}`, "text/csv; charset=utf-8", "transcricao.csv")
  }
  if (format === "srt") {
    return attachment(buildSrt(captionCues(document)), "application/x-subrip; charset=utf-8", "transcricao.srt")
  }
  if (format === "vtt") {
    return attachment(buildVtt(captionCues(document)), "text/vtt; charset=utf-8", "transcricao.vtt")
  }
  if (format === "docx") {
    return attachment(
      binaryBody(await buildDocx(document)),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "transcricao.docx",
    )
  }
  if (format === "pdf") {
    return attachment(binaryBody(await buildPdf(document)), "application/pdf", "transcricao.pdf")
  }

  const settings = await loadAnalysisSettings(user.id)
  const analysis = analyzeUtterances(await loadUtterances(user.id, audioId), settings)
  return attachment(buildWordCloudSvg(analysis.terms), "image/svg+xml; charset=utf-8", "nuvem.svg")
}
