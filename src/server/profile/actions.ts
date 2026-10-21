"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentUser } from "@/server/auth/current-user"
import { createClient } from "@/lib/supabase/server"

export type ProfileActionState = { error: string | null; saved: boolean }

const displayNameSchema = z.string().trim().min(1).max(80)

export async function updateDisplayName(
  _previous: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const parsed = displayNameSchema.safeParse(formData.get("displayName"))
  if (!parsed.success) {
    return { error: "Informe um nome de exibição com até 80 caracteres.", saved: false }
  }

  const user = await getCurrentUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data })
    .eq("id", user.id)

  if (error) {
    return {
      error: "Não foi possível salvar o perfil. Confirme se a migração do banco foi aplicada.",
      saved: false,
    }
  }

  revalidatePath("/configuracoes")
  return { error: null, saved: true }
}
