"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentUser } from "@/server/auth/current-user"
import { createClient } from "@/lib/supabase/server"

export type AnalysisActionState = { error: string | null }

function ignoredWords(value: FormDataEntryValue | null): string[] {
  const source = typeof value === "string" ? value : ""
  const words = source
    .split(/[\n,;]+/)
    .map((word) => word.trim().toLocaleLowerCase("pt-BR"))
    .filter((word) => word.length > 0 && word.length <= 40)
  return [...new Set(words)].slice(0, 200)
}

export async function saveAnalysisSettings(
  _previous: AnalysisActionState,
  formData: FormData,
): Promise<AnalysisActionState> {
  const parsed = z
    .object({
      removePunctuation: z.boolean(),
      useLemmatization: z.boolean(),
    })
    .safeParse({
      removePunctuation: formData.get("removePunctuation") === "sim",
      useLemmatization: formData.get("useLemmatization") === "sim",
    })
  if (!parsed.success) {
    return { error: "Não foi possível ler os filtros." }
  }

  const user = await getCurrentUser()
  const supabase = await createClient()
  const words = ignoredWords(formData.get("ignoredWords"))
  const { data: existing, error: existingError } = await supabase
    .from("analysis_settings")
    .select("id")
    .eq("owner_id", user.id)
    .is("project_id", null)
    .is("audio_file_id", null)
    .maybeSingle()
  if (existingError) {
    return { error: "Não foi possível ler os filtros salvos." }
  }

  const payload = {
    remove_punctuation: parsed.data.removePunctuation,
    use_lemmatization: parsed.data.useLemmatization,
    custom_ignored_words: words,
  }
  const { error } = existing
    ? await supabase.from("analysis_settings").update(payload).eq("id", existing.id).eq("owner_id", user.id)
    : await supabase.from("analysis_settings").insert({ ...payload, owner_id: user.id, project_id: null, audio_file_id: null })
  if (error) {
    return { error: "Não foi possível salvar os filtros." }
  }

  revalidatePath("/analises")
  revalidatePath("/nuvem")
  revalidatePath("/relatorios")
  return { error: null }
}
