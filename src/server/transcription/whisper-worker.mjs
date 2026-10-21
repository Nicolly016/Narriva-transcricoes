import { parentPort, workerData } from "node:worker_threads"
import { pipeline } from "@huggingface/transformers"

const jobs = []
let working = false
let transcriberPromise = null

function loadTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = pipeline("automatic-speech-recognition", workerData.model, {
      dtype: "q8",
      cache_dir: workerData.cacheDir,
      session_options: {
        intraOpNumThreads: workerData.threads,
        interOpNumThreads: 1,
      },
    }).catch((error) => {
      transcriberPromise = null
      throw error
    })
  }
  return transcriberPromise
}

function failureMessage(error) {
  const message = error instanceof Error ? error.message : ""
  if (/fetch|network|ENOTFOUND|ECONN|getaddrinfo|timeout|401|403|404/i.test(message)) {
    return "Não foi possível obter o modelo de transcrição. Na primeira vez este servidor precisa de internet; depois o modelo fica neste computador."
  }
  return "Não foi possível preparar a transcrição neste servidor."
}

async function drain() {
  if (working) {
    return
  }
  working = true
  while (jobs.length > 0) {
    const job = jobs.shift()
    if (!job) {
      continue
    }
    try {
      const transcriber = await loadTranscriber()
      const output = await transcriber(job.pcm, {
        language: workerData.language,
        task: "transcribe",
        return_timestamps: true,
        chunk_length_s: 0,
      })
      const chunks = (output.chunks ?? []).map((chunk) => ({
        text: chunk.text,
        start: typeof chunk.timestamp?.[0] === "number" ? chunk.timestamp[0] : null,
        end: typeof chunk.timestamp?.[1] === "number" ? chunk.timestamp[1] : null,
      }))
      parentPort.postMessage({
        id: job.id,
        text: typeof output.text === "string" ? output.text : "",
        chunks,
      })
    } catch (error) {
      parentPort.postMessage({ id: job.id, error: failureMessage(error) })
    }
  }
  working = false
}

parentPort.on("message", (job) => {
  jobs.push(job)
  void drain()
})
