# Transcrição e análise de áudios

Aplicação web para organizar projetos, importar áudios, transcrever neste servidor e revisar o texto em português brasileiro.

## Requisitos

- Node.js 20 ou superior
- npm
- Projeto Supabase com Auth habilitado

A transcrição roda neste servidor, com o modelo Whisper em português. A primeira execução baixa o modelo para `.cache/whisper` e precisa de internet; as seguintes usam essa cópia. Redis, quando está em execução no `REDIS_URL`, também recebe a fila. Sem Redis, o servidor inicia o processamento depois do envio. Áudios acima de 2 horas não são transcritos.

## Instalação

```bash
npm install
cp .env.example .env.local
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Preencha `.env.local`. Não commite esse arquivo.

## Variáveis de ambiente

| Variável | Onde vale | Uso nesta etapa |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | navegador e servidor | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | navegador e servidor | chave publicável do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador e servidor | alternativa legada, se a chave publicável não existir |
| `SUPABASE_SERVICE_ROLE_KEY` | somente servidor | cliente administrativo usado pela transcrição |
| `REDIS_URL` | somente servidor | fila opcional; sem ela o processamento ainda começa no servidor |

A tela de configurações informa se as variáveis de servidor existem. Ela não mostra os valores.

## Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em Authentication, copie a URL e a publishable key para `.env.local`.
3. Execute o arquivo `supabase/migrations/0001_foundation.sql` no SQL Editor.
4. Em Authentication > URL Configuration, inclua `http://localhost:3000/auth/callback` nas URLs de redirecionamento.
5. Para testes locais sem confirmação de e-mail, desative “Confirm email” em Authentication > Providers > Email. Se a confirmação permanecer ativa, o cadastro envia um link para `/auth/callback`.

A migração cria as tabelas `profiles`, `projects`, `audio_files`, `transcription_jobs`, `transcriptions`, `transcription_segments`, `speakers`, `transcription_revisions` e `analysis_settings`. Todas têm Row Level Security por `auth.uid()`. O bucket privado `audio` aceita MP3, WAV, M4A, OGG e WebM, com limite de 500 MB. A transcrição local aceita até 2 horas de áudio.

Um gatilho cria o perfil quando um usuário se cadastra. Jobs de transcrição só podem ser inseridos se `audio_files.processing_authorized` for verdadeiro.

## Transcrição

O servidor converte o arquivo para áudio mono de 16 kHz e transcreve com `Xenova/whisper-small`, em português. O texto fica em trechos com tempo. Todos os trechos usam o mesmo participante, porque este processamento não separa vozes. O rótulo pode ser renomeado na tela da transcrição.

## Execução local

```bash
npm run dev
```

Abra `http://localhost:3000`. Sem as variáveis públicas, a entrada explica a configuração pendente. Com o Supabase configurado e a migração aplicada, é possível criar conta, entrar, criar projetos, importar um áudio autorizado e acompanhar a transcrição.

## Fila

O registro da tarefa fica em `transcription_jobs`. Se `REDIS_URL` responder, o servidor também publica o id da tarefa e um consumidor no processo do Next.js a retira da fila. O processamento principal começa com `after()`, então um Redis parado não impede a transcrição. Os dois caminhos reivindicam a mesma linha; só um segue para a API.

## Testes

```bash
npm test
```

Os testes cobrem autorização de caminho, separação de segredos, transições de status, caminhos de armazenamento, rótulos de participantes e a montagem do texto local. Não há teste de ponta a ponta com navegador: Playwright ainda não foi instalado.

## Deploy

Ainda não há pipeline de publicação. Em um ambiente Next.js, configure as mesmas variáveis. Mantenha `SUPABASE_SERVICE_ROLE_KEY` e `REDIS_URL` fora do prefixo `NEXT_PUBLIC_`. O computador que executa o servidor precisa de memória para o modelo de fala e de internet na primeira transcrição.

## Limitações conhecidas

- Áudios acima de 2 horas são recusados na transcrição.
- As falas não são separadas por voz. Tudo fica em um participante.
- O agrupamento de plurais nos filtros é uma redução simples, não um lematizador.
- O armazenamento no Supabase continua gerando custo quando um áudio é guardado.
