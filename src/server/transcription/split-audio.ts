import "server-only"

import { spawn } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import ffmpegPath from "ffmpeg-static"
import { splitRanges, type AudioSlice } from "@/domain/audio-split"
import type { AcceptedAudioExtension } from "@/domain/storage-path"

export type SplitAudioPart = AudioSlice & {
  bytes: Uint8Array
}

function binary(): string {
  if (!ffmpegPath) {
    throw new Error("O conversor de áudio não está disponível neste servidor.")
  }
  return ffmpegPath
}

function runFfmpeg(args: string[], stopWhen?: (stderr: string) => boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary(), args, { windowsHide: true })
    let stderr = ""
    let settled = false
    const finish = (error?: Error) => {
      if (settled) {
        return
      }
      settled = true
      if (error) {
        child.kill()
        reject(error)
        return
      }
      resolve(stderr)
    }
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8")
      if (stderr.length > 8000) {
        stderr = stderr.slice(-8000)
      }
      if (stopWhen?.(stderr)) {
        child.kill()
        finish()
      }
    })
    child.on("error", () => finish(new Error("Não foi possível ler o áudio.")))
    child.on("close", (code) => {
      if (settled) {
        return
      }
      if (stopWhen?.(stderr)) {
        finish()
        return
      }
      if (code !== 0) {
        const detail = stderr.replace(/\s+/g, " ").trim().slice(0, 180)
        finish(new Error(detail ? `Não foi possível dividir o áudio. ${detail}` : "Não foi possível dividir o áudio."))
        return
      }
      finish()
    })
  })
}

function durationFromProbe(stderr: string): number | null {
  const match = stderr.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/)
  if (!match) {
    return null
  }
  const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
  return Number.isFinite(seconds) ? seconds : null
}

export async function splitAudioBytes(
  audio: Uint8Array,
  extension: AcceptedAudioExtension,
  partSeconds: number,
): Promise<{ durationSeconds: number; parts: SplitAudioPart[] }> {
  const directory = mkdtempSync(path.join(tmpdir(), "narriva-split-"))
  const input = path.join(directory, `source.${extension}`)
  try {
    writeFileSync(input, audio)
    const probe = await runFfmpeg(["-hide_banner", "-i", input], (stderr) => durationFromProbe(stderr) != null)
    const durationSeconds = durationFromProbe(probe)
    if (durationSeconds == null || durationSeconds < 1) {
      throw new Error("Não foi possível ler a duração deste áudio.")
    }
    const ranges = splitRanges(durationSeconds, partSeconds)
    if (ranges.length < 2) {
      throw new Error("Este áudio cabe em uma parte só.")
    }
    const parts: SplitAudioPart[] = []
    for (let index = 0; index < ranges.length; index += 1) {
      const range = ranges[index]
      if (!range) {
        continue
      }
      const output = path.join(directory, `part-${index + 1}.${extension}`)
      await runFfmpeg([
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        range.startSeconds.toFixed(3),
        "-t",
        range.durationSeconds.toFixed(3),
        "-i",
        input,
        "-map",
        "0:a:0",
        "-c",
        "copy",
        output,
      ])
      const bytes = new Uint8Array(readFileSync(output))
      if (bytes.byteLength < 1024) {
        throw new Error("Uma das partes ficou vazia.")
      }
      parts.push({ ...range, bytes })
    }
    return { durationSeconds, parts }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}
