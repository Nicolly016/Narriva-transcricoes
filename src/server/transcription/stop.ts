import "server-only"

export class TranscriptionStopped extends Error {
  constructor() {
    super("A transcrição foi interrompida para dividir o áudio.")
    this.name = "TranscriptionStopped"
  }
}
