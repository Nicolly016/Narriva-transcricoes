import "server-only"

import { after } from "next/server"
import Redis from "ioredis"
import { runTranscriptionJob } from "@/server/jobs/run-transcription"

const QUEUE_KEY = "transcription:jobs"

const globalState = globalThis as typeof globalThis & {
  transcriptionRedis?: Redis
  transcriptionConsumer?: boolean
  transcriptionRedisChecked?: { at: number; ok: boolean }
}

function redisUrl(): string {
  return process.env.REDIS_URL?.trim() ?? ""
}

export function scheduleTranscription(jobId: string): void {
  after(() => {
    void runTranscriptionJob(jobId).catch(() => undefined)
  })
  void publish(jobId).catch(() => undefined)
}

async function publish(jobId: string): Promise<void> {
  if (!(await redisReachable())) {
    return
  }
  const redis = client()
  if (!redis) {
    return
  }
  if (redis.status === "wait") {
    await redis.connect()
  }
  await redis.lpush(QUEUE_KEY, jobId)
  startConsumer()
}

function client(): Redis | null {
  const url = redisUrl()
  if (!url) {
    return null
  }
  if (!globalState.transcriptionRedis) {
    const redis = new Redis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
    })
    redis.on("error", () => undefined)
    globalState.transcriptionRedis = redis
  }
  return globalState.transcriptionRedis
}

async function redisReachable(): Promise<boolean> {
  const cached = globalState.transcriptionRedisChecked
  if (cached && Date.now() - cached.at < 15_000) {
    return cached.ok
  }
  const url = redisUrl()
  if (!url) {
    globalState.transcriptionRedisChecked = { at: Date.now(), ok: false }
    return false
  }
  const probe = new Redis(url, {
    connectTimeout: 800,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
  })
  probe.on("error", () => undefined)
  let ok = false
  try {
    await probe.connect()
    ok = (await probe.ping()) === "PONG"
  } catch {
    ok = false
  } finally {
    probe.disconnect()
  }
  globalState.transcriptionRedisChecked = { at: Date.now(), ok }
  return ok
}

function startConsumer(): void {
  if (globalState.transcriptionConsumer) {
    return
  }
  const redis = client()
  if (!redis) {
    return
  }
  globalState.transcriptionConsumer = true
  const blocker = redis.duplicate()
  blocker.on("error", () => undefined)
  void consume(blocker)
}

async function consume(blocker: Redis): Promise<void> {
  for (;;) {
    try {
      if (blocker.status === "wait") {
        await blocker.connect()
      }
      const item = await blocker.brpop(QUEUE_KEY, 0)
      const jobId = item?.[1]
      if (jobId) {
        await runTranscriptionJob(jobId)
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
}
