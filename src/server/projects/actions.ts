"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentUser } from "@/server/auth/current-user"
import { createClient } from "@/lib/supabase/server"

const projectSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000),
})

export type ProjectActionState = { error: string | null }

export async function createProject(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const parsed = projectSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
  })
  if (!parsed.success) {
    return { error: "Informe um título de até 160 caracteres." }
  }

  const user = await getCurrentUser()
  const supabase = await createClient()
  const { error } = await supabase.from("projects").insert({
    owner_id: user.id,
    title: parsed.data.title,
    description: parsed.data.description,
  })

  if (error) {
    return { error: "Não foi possível criar o projeto. Confirme se a migração do banco foi aplicada." }
  }

  revalidatePath("/projetos")
  revalidatePath("/")
  return { error: null }
}

export async function deleteProject(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = z.uuid().safeParse(formData.get("projectId"))
  if (!projectId.success) {
    return { error: "Projeto inválido." }
  }

  const user = await getCurrentUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId.data)
    .eq("owner_id", user.id)

  if (error) {
    return { error: "Não foi possível excluir o projeto." }
  }

  revalidatePath("/projetos")
  revalidatePath("/")
  return { error: null }
}
