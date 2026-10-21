"use client"

import { useState, type FormEvent } from "react"
import { useFormStatus } from "react-dom"
import { extensionFromFilename, formatBytes, uploadSizeError } from "@/domain/audio-file"
import { ACCEPTED_AUDIO_LABEL } from "@/domain/storage-path"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { registerAudio } from "@/server/audio/actions"

type ProjectOption = { id: string; title: string }

function ImportButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="self-start">
      {pending ? "Enviando…" : "Importar áudio"}
    </Button>
  )
}

export function ImportForm({
  projects,
  serverError,
}: {
  projects: ProjectOption[]
  serverError: string | null
}) {
  const [error, setError] = useState<string | null>(null)
  const [fileNote, setFileNote] = useState<string | null>(null)
  const visibleError = error ?? serverError

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget
    const fileField = form.elements.namedItem("file")
    const file = fileField instanceof HTMLInputElement ? fileField.files?.[0] : undefined
    if (!file) {
      event.preventDefault()
      setError("Escolha um arquivo de áudio.")
      return
    }
    const extension = extensionFromFilename(file.name)
    if (!extension) {
      event.preventDefault()
      setError(`Use ${ACCEPTED_AUDIO_LABEL}.`)
      return
    }
    const sizeError = uploadSizeError(file.size)
    if (sizeError) {
      event.preventDefault()
      setError(sizeError)
      return
    }
    const authorized = form.elements.namedItem("authorized")
    if (!(authorized instanceof HTMLInputElement) || !authorized.checked) {
      event.preventDefault()
      setError("Confirme a autorização para tratar este áudio.")
    }
  }

  return (
    <form action={registerAudio} onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="projectId">Projeto</Label>
        <select
          id="projectId"
          name="projectId"
          className="h-11 rounded-lg border border-input bg-card px-3 text-base"
          defaultValue=""
        >
          <option value="">Sem projeto</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" maxLength={200} placeholder="Se ficar vazio, o nome do arquivo é usado" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" name="description" maxLength={4000} rows={3} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="file">Arquivo</Label>
        <Input
          id="file"
          name="file"
          type="file"
          required
          accept=".mp3,.wav,.m4a,.mp4,.ogg,.webm,audio/mpeg,audio/wav,audio/mp4,video/mp4,audio/ogg,audio/webm"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) {
              setFileNote(null)
              return
            }
            setFileNote(`${file.name} (${formatBytes(file.size)})`)
          }}
        />
        {fileNote ? <p className="text-base text-muted-foreground">{fileNote}</p> : null}
      </div>
      <label className="flex items-start gap-3 text-base leading-7">
        <input name="splitLong" type="checkbox" value="sim" className="mt-1 size-4" />
        <span>Se o áudio passar de 20 minutos, dividir em partes de 15 minutos.</span>
      </label>
      <label className="flex items-start gap-3 text-base leading-7">
        <input name="authorized" type="checkbox" value="sim" required className="mt-1 size-4" />
        <span>Confirmo que tenho autorização para tratar este áudio nesta plataforma.</span>
      </label>
      {visibleError ? (
        <p role="alert" className="text-base text-destructive">
          {visibleError}
        </p>
      ) : null}
      <ImportButton />
    </form>
  )
}
