export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { resumeInterruptedTranscriptions } = await import("@/server/jobs/run-transcription")
    resumeInterruptedTranscriptions()
  }
}
