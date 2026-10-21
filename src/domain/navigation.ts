export type NavItem = {
  href: string
  label: string
  available: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Painel inicial", available: true },
  { href: "/projetos", label: "Meus projetos", available: true },
  { href: "/importar", label: "Importar áudios", available: true },
  { href: "/transcricoes", label: "Transcrições", available: true },
  { href: "/nuvem", label: "Nuvem de palavras", available: true },
  { href: "/analises", label: "Análises", available: true },
  { href: "/relatorios", label: "Relatórios", available: true },
  { href: "/configuracoes", label: "Configurações", available: true },
]
