import Image from "next/image"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

const STEPS = [
  {
    title: "1. Reúna o material",
    text: "Crie um projeto e envie o áudio da entrevista. Formatos aceitos: MP3, WAV, M4A, MP4, OGG e WebM, até 500 MB. Gravações longas podem ser divididas em partes.",
  },
  {
    title: "2. Leia e revise",
    text: "A fala vira um texto contínuo em português. Você corrige trechos, pausa ou recarrega a leitura e acompanha o andamento de cada arquivo.",
  },
  {
    title: "3. Nomeie quem fala",
    text: "As vozes distinguíveis aparecem como Participante 1, Participante 2 e os seguintes. Troque o rótulo pelo nome usado na pesquisa.",
  },
  {
    title: "4. Analise e exporte",
    text: "Veja tempo de fala, turnos, termos e a nuvem de palavras. Baixe o texto em TXT, DOCX, PDF, legendas ou planilha para o trabalho escrito.",
  },
]

const USES = [
  {
    title: "Entrevistas",
    text: "Passe da gravação para um texto que dá para ler, marcar e citar no relatório, no artigo ou na dissertação.",
  },
  {
    title: "Mais de uma voz",
    text: "Em conversas e grupos, cada voz reconhecida fica separada. O nome civil não é atribuído sozinho: você confirma quem é quem.",
  },
  {
    title: "Organização da pesquisa",
    text: "Projetos, áudios e transcrições ficam na mesma conta, com painel, análises e relatórios a partir do texto revisado.",
  },
]

export default function PresentationPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between gap-4 px-5 py-5 md:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/logo.png" alt="" width={48} height={48} className="size-12 rounded-lg" />
          <p className="truncate text-xl font-semibold">Narriva</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            Entrar
          </Link>
          <Link href="/signup" className={buttonVariants()}>
            Inscrever-se
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-12 md:px-10 md:py-16">
        <p className="text-sm font-semibold text-primary">Uso acadêmico e entrevistas</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Uma ferramenta para transcrever entrevistas e organizar o que foi dito.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
          A Narriva auxilia na transcrição de entrevistas para pesquisa e trabalho acadêmico. O áudio autorizado
          vira texto em português, com participantes separados, revisão na mesma página e material para analisar
          e escrever depois.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className={buttonVariants()}>
            Inscrever-se
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            Entrar
          </Link>
        </div>

        <section className="mt-16 max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">O que o site faz</h2>
          <div className="mt-4 space-y-4 text-base leading-8 text-muted-foreground">
            <p>
              Quem pesquisa com entrevistas costuma gastar horas ouvindo de novo a gravação para anotar falas,
              identificar quem disse o quê e localizar trechos no texto final. A Narriva entra nesse meio do
              caminho: importa o áudio, produz a transcrição e deixa o texto pronto para correção.
            </p>
            <p>
              O resultado não substitui a leitura do pesquisador. A transcrição é um rascunho fiel o bastante
              para revisar, e a versão que você salva é a que segue para a nuvem de palavras, as análises e os
              relatórios. Cada conta guarda os próprios projetos e arquivos.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight">Para o trabalho com falas</h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {USES.map((item) => (
              <li key={item.title} className="rounded-xl border border-border bg-card px-5 py-5">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-base leading-7 text-muted-foreground">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold tracking-tight">Como a entrevista vira texto</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-2">
            {STEPS.map((step) => (
              <li key={step.title} className="rounded-xl border border-border bg-card px-5 py-5">
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-base leading-7 text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16 rounded-xl border border-border bg-card px-6 py-8 md:px-10">
          <h2 className="text-2xl font-semibold tracking-tight">Comece pela sua conta</h2>
          <p className="mt-3 max-w-2xl text-base leading-8 text-muted-foreground">
            Entre se já tem acesso, ou inscreva-se para criar projetos e enviar a primeira entrevista.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signup" className={buttonVariants()}>
              Inscrever-se
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "outline" })}>
              Entrar
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
