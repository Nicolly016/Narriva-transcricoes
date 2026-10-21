import "server-only"

import { spawn } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import ffmpegPath from "ffmpeg-static"
import { durationLimitError, LOCAL_MAX_DURATION_SECONDS, LOCAL_SAMPLE_RATE } from "@/domain/local-transcript"

const MAX_PCM_BYTES = LOCAL_SAMPLE_RATE * LOCAL_MAX_DURATION_SECONDS * 4

function containerExtension(audio: Uint8Array): string {
  if (audio.length >= 8 && audio[4] === 0x66 && audio[5] === 0x74 && audio[6] === 0x79 && audio[7] === 0x70) {
    return "mp4"
  }
  if (audio.length >= 4 && audio[0] === 0x1a && audio[1] === 0x45 && audio[2] === 0xdf && audio[3] === 0xa3) {
    return "webm"
  }
  if (audio.length >= 4 && audio[0] === 0x4f && audio[1] === 0x67 && audio[2] === 0x67 && audio[3] === 0x53) {
    return "ogg"
  }
  if (audio.length >= 12 && audio[0] === 0x52 && audio[1] === 0x49 && audio[2] === 0x46 && audio[3] === 0x46) {
    return "wav"
  }
  return "mp3"
}

export async function decodeAudioToMonoPcm(audio: Uint8Array): Promise<Float32Array> {
  const binary = ffmpegPath
  if (!binary) {
    throw new Error("O conversor de áudio não está disponível neste servidor.")
  }

  const directory = mkdtempSync(path.join(tmpdir(), "narriva-decode-"))
  const input = path.join(directory, `audio.${containerExtension(audio)}`)
  writeFileSync(input, audio)

  try {
    const pcm = await readPcm(binary, input)
    const samples = pcm.length - (pcm.length % 4)
    if (samples < LOCAL_SAMPLE_RATE * 0.1 * 4) {
      throw new Error("O áudio não tem duração suficiente para transcrever.")
    }

    const floats = new Float32Array(samples / 4)
    Buffer.from(floats.buffer).set(pcm.subarray(0, samples))
    const limit = durationLimitError(floats.length / LOCAL_SAMPLE_RATE)
    if (limit) {
      throw new Error(limit)
    }
    return floats
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function readPcm(binary: string, input: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      binary,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        input,
        "-f",
        "f32le",
        "-acodec",
        "pcm_f32le",
        "-ac",
        "1",
        "-ar",
        String(LOCAL_SAMPLE_RATE),
        "pipe:1",
      ],
      { windowsHide: true },
    )
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let total = 0
    let settled = false

    const fail = (message: string) => {
      if (settled) {
        return
      }
      settled = true
      child.kill()
      reject(new Error(message))
    }

    child.stdout.on("data", (chunk: Buffer) => {
      total += chunk.length
      if (total > MAX_PCM_BYTES) {
        fail("O áudio passa de 2 horas. Envie um trecho menor.")
        return
      }
      stdout.push(chunk)
    })
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 8) {
        stderr.push(chunk)
      }
    })
    child.on("error", () => fail("Não foi possível ler o áudio."))
    child.on("close", (code) => {
      if (settled) {
        return
      }
      settled = true
      if (code !== 0) {
        const detail = Buffer.concat(stderr).toString("utf8").replace(/\s+/g, " ").trim().slice(0, 180)
        reject(new Error(detail ? `Não foi possível ler o áudio. ${detail}` : "Não foi possível ler o áudio."))
        return
      }
      resolve(Buffer.concat(stdout))
    })
  })
}
