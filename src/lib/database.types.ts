export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          owner_id: string
          title: string
          description: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title: string
          description?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string
          updated_at?: string
        }
        Relationships: []
      }
      audio_files: {
        Row: {
          id: string
          owner_id: string
          project_id: string | null
          title: string
          description: string
          original_filename: string
          storage_path: string
          mime_type: string
          format: string
          size_bytes: number
          duration_seconds: number | null
          status: string
          error_message: string | null
          processing_authorized: boolean
          imported_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          project_id?: string | null
          title: string
          description?: string
          original_filename: string
          storage_path: string
          mime_type: string
          format: string
          size_bytes: number
          duration_seconds?: number | null
          status?: string
          error_message?: string | null
          processing_authorized?: boolean
          imported_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          project_id?: string | null
          title?: string
          description?: string
          status?: string
          error_message?: string | null
          duration_seconds?: number | null
          processing_authorized?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      transcription_jobs: {
        Row: {
          id: string
          owner_id: string
          audio_file_id: string
          status: string
          provider: string
          idempotency_key: string
          attempt_count: number
          max_attempts: number
          provider_request_id: string | null
          error_message: string | null
          started_at: string | null
          finished_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          audio_file_id: string
          status?: string
          provider: string
          idempotency_key: string
          attempt_count?: number
          max_attempts?: number
          provider_request_id?: string | null
          error_message?: string | null
          started_at?: string | null
          finished_at?: string | null
        }
        Update: {
          status?: string
          provider?: string
          attempt_count?: number
          provider_request_id?: string | null
          error_message?: string | null
          started_at?: string | null
          finished_at?: string | null
        }
        Relationships: []
      }
      transcriptions: {
        Row: {
          id: string
          owner_id: string
          audio_file_id: string
          language: string
          provider: string
          model: string
          original_full_text: string
          revised_full_text: string | null
          audio_was_split: boolean
          split_limitation_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          audio_file_id: string
          language?: string
          provider: string
          model: string
          original_full_text: string
          revised_full_text?: string | null
          audio_was_split?: boolean
          split_limitation_note?: string | null
        }
        Update: {
          revised_full_text?: string | null
          audio_was_split?: boolean
          split_limitation_note?: string | null
        }
        Relationships: []
      }
      speakers: {
        Row: {
          id: string
          owner_id: string
          transcription_id: string
          provider_label: string
          chunk_index: number
          display_name: string
          color_token: string
          sort_order: number
          merged_into_id: string | null
        }
        Insert: {
          id?: string
          owner_id: string
          transcription_id: string
          provider_label: string
          chunk_index?: number
          display_name: string
          color_token: string
          sort_order: number
          merged_into_id?: string | null
        }
        Update: {
          display_name?: string
          merged_into_id?: string | null
        }
        Relationships: []
      }
      transcription_segments: {
        Row: {
          id: string
          owner_id: string
          transcription_id: string
          speaker_id: string | null
          original_speaker_id: string | null
          segment_index: number
          chunk_index: number
          start_ms: number
          end_ms: number
          original_text: string
          text: string
        }
        Insert: {
          id?: string
          owner_id: string
          transcription_id: string
          speaker_id?: string | null
          original_speaker_id?: string | null
          segment_index: number
          chunk_index?: number
          start_ms: number
          end_ms: number
          original_text: string
          text: string
        }
        Update: {
          speaker_id?: string | null
          text?: string
          end_ms?: number
        }
        Relationships: []
      }
      transcription_revisions: {
        Row: {
          id: string
          owner_id: string
          transcription_id: string
          segment_id: string | null
          speaker_id: string | null
          revision_kind: string
          previous_value: Json
          new_value: Json
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          transcription_id: string
          segment_id?: string | null
          speaker_id?: string | null
          revision_kind: string
          previous_value: Json
          new_value: Json
        }
        Update: Record<string, never>
        Relationships: []
      }
      analysis_settings: {
        Row: {
          id: string
          owner_id: string
          project_id: string | null
          audio_file_id: string | null
          use_lemmatization: boolean
          remove_punctuation: boolean
          custom_ignored_words: string[]
        }
        Insert: {
          id?: string
          owner_id: string
          project_id?: string | null
          audio_file_id?: string | null
          use_lemmatization?: boolean
          remove_punctuation?: boolean
          custom_ignored_words?: string[]
        }
        Update: {
          use_lemmatization?: boolean
          remove_punctuation?: boolean
          custom_ignored_words?: string[]
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
