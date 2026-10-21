-- Foundation schema for transcription storage, jobs, speakers, and analysis settings.
-- Apply in the Supabase SQL editor or with the Supabase CLI.
-- The browser uses the publishable key and Row Level Security.
-- Workers (later stages) use the service role, which bypasses RLS and must stay on the server.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) <= 80)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_title_length check (char_length(btrim(title)) between 1 and 160),
  constraint projects_description_length check (char_length(description) <= 2000)
);

create table public.audio_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  description text not null default '',
  original_filename text not null,
  storage_path text not null,
  mime_type text not null,
  format text not null,
  size_bytes bigint not null,
  duration_seconds numeric(12, 3),
  status text not null default 'uploaded',
  error_message text,
  processing_authorized boolean not null default false,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audio_files_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint audio_files_description_length check (char_length(description) <= 4000),
  constraint audio_files_format check (format in ('mp3', 'wav', 'm4a', 'mp4', 'ogg', 'webm')),
  constraint audio_files_size_positive check (size_bytes > 0 and size_bytes <= 524288000),
  constraint audio_files_duration_nonnegative check (duration_seconds is null or duration_seconds >= 0),
  constraint audio_files_status check (
    status in (
      'uploaded',
      'queued',
      'preparing',
      'transcribing',
      'identifying_speakers',
      'saving',
      'completed',
      'error'
    )
  ),
  constraint audio_files_storage_path_unique unique (storage_path)
);

create table public.transcription_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  audio_file_id uuid not null references public.audio_files (id) on delete cascade,
  status text not null default 'queued',
  provider text not null,
  idempotency_key text not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  provider_request_id text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transcription_jobs_status check (
    status in (
      'queued',
      'preparing',
      'transcribing',
      'identifying_speakers',
      'saving',
      'completed',
      'error'
    )
  ),
  constraint transcription_jobs_attempts check (
    attempt_count >= 0 and max_attempts between 1 and 5 and attempt_count <= max_attempts
  ),
  constraint transcription_jobs_idempotency unique (audio_file_id, idempotency_key)
);

create table public.transcriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  audio_file_id uuid not null unique references public.audio_files (id) on delete cascade,
  language text not null default 'pt',
  provider text not null,
  model text not null,
  original_full_text text not null,
  revised_full_text text,
  audio_was_split boolean not null default false,
  split_limitation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transcriptions_language_length check (char_length(language) between 2 and 16)
);

create table public.speakers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  transcription_id uuid not null references public.transcriptions (id) on delete cascade,
  provider_label text not null,
  chunk_index integer not null default 0,
  display_name text not null,
  color_token text not null,
  sort_order integer not null,
  merged_into_id uuid references public.speakers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint speakers_chunk_nonnegative check (chunk_index >= 0),
  constraint speakers_display_name_length check (char_length(btrim(display_name)) between 1 and 120),
  constraint speakers_provider_label_unique unique (transcription_id, chunk_index, provider_label)
);

create table public.transcription_segments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  transcription_id uuid not null references public.transcriptions (id) on delete cascade,
  speaker_id uuid references public.speakers (id) on delete set null,
  original_speaker_id uuid,
  segment_index integer not null,
  chunk_index integer not null default 0,
  start_ms integer not null,
  end_ms integer not null,
  original_text text not null,
  text text not null,
  is_uncertain boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transcription_segments_order unique (transcription_id, segment_index),
  constraint transcription_segments_time check (start_ms >= 0 and end_ms >= start_ms),
  constraint transcription_segments_chunk check (chunk_index >= 0 and segment_index >= 0)
);

create table public.transcription_revisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  transcription_id uuid not null references public.transcriptions (id) on delete cascade,
  segment_id uuid references public.transcription_segments (id) on delete set null,
  speaker_id uuid references public.speakers (id) on delete set null,
  revision_kind text not null,
  previous_value jsonb not null,
  new_value jsonb not null,
  created_at timestamptz not null default now(),
  constraint transcription_revisions_kind check (
    revision_kind in (
      'text_edit',
      'speaker_rename',
      'speaker_reassign',
      'speaker_merge',
      'segment_split',
      'segment_merge'
    )
  )
);

create table public.analysis_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  audio_file_id uuid references public.audio_files (id) on delete cascade,
  use_lemmatization boolean not null default false,
  remove_punctuation boolean not null default true,
  custom_ignored_words text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_settings_scope check (
    project_id is null or audio_file_id is null
  )
);

create unique index analysis_settings_user_default_idx
  on public.analysis_settings (owner_id)
  where project_id is null and audio_file_id is null;

create unique index analysis_settings_project_idx
  on public.analysis_settings (owner_id, project_id)
  where project_id is not null and audio_file_id is null;

create unique index analysis_settings_audio_idx
  on public.analysis_settings (owner_id, audio_file_id)
  where audio_file_id is not null;

create index projects_owner_created_idx on public.projects (owner_id, created_at desc);
create index audio_files_owner_imported_idx on public.audio_files (owner_id, imported_at desc);
create index audio_files_project_idx on public.audio_files (project_id);
create index audio_files_status_idx on public.audio_files (status);
create index transcription_jobs_status_created_idx on public.transcription_jobs (status, created_at);
create index transcription_segments_transcription_idx
  on public.transcription_segments (transcription_id, segment_index);
create index speakers_transcription_idx on public.speakers (transcription_id, sort_order);
create index transcription_revisions_transcription_idx
  on public.transcription_revisions (transcription_id, created_at desc);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger audio_files_set_updated_at
  before update on public.audio_files
  for each row execute function public.set_updated_at();

create trigger transcription_jobs_set_updated_at
  before update on public.transcription_jobs
  for each row execute function public.set_updated_at();

create trigger transcriptions_set_updated_at
  before update on public.transcriptions
  for each row execute function public.set_updated_at();

create trigger speakers_set_updated_at
  before update on public.speakers
  for each row execute function public.set_updated_at();

create trigger transcription_segments_set_updated_at
  before update on public.transcription_segments
  for each row execute function public.set_updated_at();

create trigger analysis_settings_set_updated_at
  before update on public.analysis_settings
  for each row execute function public.set_updated_at();

create or replace function public.prevent_original_segment_edits()
returns trigger
language plpgsql
as $$
begin
  if new.original_text is distinct from old.original_text
     or new.original_speaker_id is distinct from old.original_speaker_id then
    raise exception 'original segment fields are immutable';
  end if;
  return new;
end;
$$;

create trigger transcription_segments_protect_original
  before update on public.transcription_segments
  for each row execute function public.prevent_original_segment_edits();

create or replace function public.job_requires_processing_authorization()
returns trigger
language plpgsql
as $$
declare
  authorized boolean;
begin
  select processing_authorized into authorized
  from public.audio_files
  where id = new.audio_file_id;

  if authorized is not true then
    raise exception 'processing requires explicit authorization';
  end if;
  return new;
end;
$$;

create trigger transcription_jobs_require_authorization
  before insert on public.transcription_jobs
  for each row execute function public.job_requires_processing_authorization();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.audio_files enable row level security;
alter table public.transcription_jobs enable row level security;
alter table public.transcriptions enable row level security;
alter table public.speakers enable row level security;
alter table public.transcription_segments enable row level security;
alter table public.transcription_revisions enable row level security;
alter table public.analysis_settings enable row level security;

alter table public.profiles force row level security;
alter table public.projects force row level security;
alter table public.audio_files force row level security;
alter table public.transcription_jobs force row level security;
alter table public.transcriptions force row level security;
alter table public.speakers force row level security;
alter table public.transcription_segments force row level security;
alter table public.transcription_revisions force row level security;
alter table public.analysis_settings force row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy projects_all_own on public.projects
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy audio_files_all_own on public.audio_files
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy transcription_jobs_all_own on public.transcription_jobs
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy transcriptions_all_own on public.transcriptions
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy speakers_all_own on public.speakers
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy transcription_segments_all_own on public.transcription_segments
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy transcription_revisions_all_own on public.transcription_revisions
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy analysis_settings_all_own on public.analysis_settings
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

revoke all on table public.profiles from anon;
revoke all on table public.projects from anon;
revoke all on table public.audio_files from anon;
revoke all on table public.transcription_jobs from anon;
revoke all on table public.transcriptions from anon;
revoke all on table public.speakers from anon;
revoke all on table public.transcription_segments from anon;
revoke all on table public.transcription_revisions from anon;
revoke all on table public.analysis_settings from anon;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.audio_files to authenticated;
grant select, insert, update, delete on table public.transcription_jobs to authenticated;
grant select, insert, update, delete on table public.transcriptions to authenticated;
grant select, insert, update, delete on table public.speakers to authenticated;
grant select, insert, update, delete on table public.transcription_segments to authenticated;
grant select, insert, update, delete on table public.transcription_revisions to authenticated;
grant select, insert, update, delete on table public.analysis_settings to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'audio',
  'audio',
  false,
  524288000,
  array[
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
    'audio/ogg',
    'audio/webm',
    'video/webm',
    'video/mp4'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy audio_storage_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy audio_storage_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy audio_storage_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy audio_storage_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
