const STOPWORDS = new Set([
  "a", "o", "os", "as", "um", "uma", "uns", "umas", "de", "da", "do", "das", "dos", "e", "em", "no", "na",
  "nos", "nas", "num", "numa", "dum", "duma", "para", "pra", "pro", "por", "com", "sem", "que", "se",
  "eu", "tu", "você", "voce", "ele", "ela", "eles", "elas", "nós", "nos", "vos", "me", "te", "lhe", "lhes",
  "não", "nao", "sim", "mas", "ou", "como", "mais", "já", "ja", "também", "tambem", "é", "eh", "ser", "foi",
  "são", "sao", "está", "esta", "estão", "estao", "isso", "isto", "esse", "essa", "este", "aquele", "aquela",
  "ao", "aos", "à", "às", "pelo", "pela", "pelos", "pelas", "seu", "sua", "seus", "suas", "meu", "minha",
  "meus", "minhas", "tem", "ter", "há", "ha", "era", "eram", "muito", "muita", "muitos", "pouco", "quando",
  "onde", "porque", "porquê", "qual", "quais", "quem", "entre", "sobre", "até", "ate", "depois", "antes",
  "então", "entao", "aí", "ai", "lá", "la", "aqui", "ali", "bem", "só", "so", "ainda", "assim", "mesmo",
  "mesma", "outro", "outra", "outros", "outras", "todo", "toda", "todos", "todas", "cada", "qualquer",
  "nenhum", "nenhuma", "nada", "tudo", "alguém", "alguem", "ninguém", "ninguem", "né", "ne", "tá", "ta",
  "dele", "dela", "deles", "delas", "disso", "daquilo", "tipo", "ah", "oh", "hum", "uhm",
])

export type AnalysisSettingsInput = {
  removePunctuation: boolean
  useLemmatization: boolean
  ignoredWords: readonly string[]
}

export type TermCount = {
  term: string
  count: number
}

export type SpeakerStat = {
  name: string
  talkMs: number
  turns: number
  words: number
}

export type TranscriptUtterance = {
  speakerName: string
  startMs: number
  endMs: number
  text: string
}

export type TranscriptAnalysis = {
  wordCount: number
  durationMs: number
  terms: TermCount[]
  speakers: SpeakerStat[]
}

export function foldPortuguesePlural(word: string): string {
  if (word.length < 5) {
    return word
  }
  if (word.endsWith("ções")) {
    return `${word.slice(0, -3)}ão`
  }
  if (word.endsWith("ões") || word.endsWith("ães")) {
    return `${word.slice(0, -3)}ão`
  }
  if (word.endsWith("as") || word.endsWith("os")) {
    return word.slice(0, -1)
  }
  return word
}

export function tokenize(text: string, removePunctuation: boolean): string[] {
  const normalized = text.toLocaleLowerCase("pt-BR")
  const parts = removePunctuation ? normalized.split(/[^\p{L}\p{N}]+/u) : normalized.split(/\s+/)
  return parts.map((part) => part.trim()).filter((part) => part.length > 0)
}

export function analyzeUtterances(
  utterances: readonly TranscriptUtterance[],
  settings: AnalysisSettingsInput,
): TranscriptAnalysis {
  const ignored = new Set(
    settings.ignoredWords.map((word) => normalizeTerm(word, settings)).filter((word) => word.length > 0),
  )
  const counts = new Map<string, number>()
  const speakers = new Map<string, SpeakerStat>()
  let wordCount = 0
  let durationMs = 0

  for (const utterance of utterances) {
    const span = Math.max(0, utterance.endMs - utterance.startMs)
    durationMs += span
    const tokens = tokenize(utterance.text, settings.removePunctuation).filter((token) => !/^\d+$/.test(token))
    wordCount += tokens.length
    const current = speakers.get(utterance.speakerName) ?? {
      name: utterance.speakerName,
      talkMs: 0,
      turns: 0,
      words: 0,
    }
    current.talkMs += span
    current.turns += 1
    current.words += tokens.length
    speakers.set(utterance.speakerName, current)

    for (const token of tokens) {
      if (token.length < 2 || STOPWORDS.has(token)) {
        continue
      }
      const term = settings.useLemmatization ? foldPortuguesePlural(token) : token
      if (term.length < 2 || STOPWORDS.has(term) || ignored.has(term)) {
        continue
      }
      counts.set(term, (counts.get(term) ?? 0) + 1)
    }
  }

  const terms = [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((left, right) => right.count - left.count || left.term.localeCompare(right.term, "pt-BR"))

  return {
    wordCount,
    durationMs,
    terms,
    speakers: [...speakers.values()].sort((left, right) => right.talkMs - left.talkMs || left.name.localeCompare(right.name, "pt-BR")),
  }
}

function normalizeTerm(word: string, settings: AnalysisSettingsInput): string {
  const [token] = tokenize(word, true)
  if (!token) {
    return ""
  }
  return settings.useLemmatization ? foldPortuguesePlural(token) : token
}
