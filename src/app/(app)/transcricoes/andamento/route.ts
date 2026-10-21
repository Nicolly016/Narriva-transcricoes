import { getCurrentUser } from "@/server/auth/current-user"
import { resumeInterruptedTranscriptions } from "@/server/jobs/run-transcription"
import { listActiveAudios } from "@/server/transcription/load"

export async function GET() {
  resumeInterruptedTranscriptions()
  const user = await getCurrentUser()
  const { items, error } = await listActiveAudios(user.id)
  if (error) {
    return Response.json({ items: [] }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
  return Response.json({ items }, { headers: { "Cache-Control": "no-store" } })
}
