import { describe, expect, it } from "vitest"
import { NAV_ITEMS } from "./navigation"

describe("navigation", () => {
  it("exposes the eight requested sections", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      "Painel inicial",
      "Meus projetos",
      "Importar áudios",
      "Transcrições",
      "Nuvem de palavras",
      "Análises",
      "Relatórios",
      "Configurações",
    ])
  })
})
