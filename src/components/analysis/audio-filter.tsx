import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export function AudioFilter({
  action,
  audios,
  selectedId,
  allowAll = true,
}: {
  action: string
  audios: { id: string; title: string }[]
  selectedId: string | null
  allowAll?: boolean
}) {
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Label htmlFor="audio">Áudio</Label>
        <select
          id="audio"
          name="audio"
          defaultValue={selectedId ?? ""}
          className="h-11 rounded-lg border border-input bg-card px-3 text-base"
        >
          {allowAll ? <option value="">Todos os áudios concluídos</option> : null}
          {audios.map((audio) => (
            <option key={audio.id} value={audio.id}>
              {audio.title}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline">
        Atualizar
      </Button>
    </form>
  )
}
