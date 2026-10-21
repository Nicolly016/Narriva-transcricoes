alter table public.audio_files drop constraint audio_files_format;

alter table public.audio_files
  add constraint audio_files_format check (
    format in ('mp3', 'wav', 'm4a', 'mp4', 'ogg', 'webm')
  );

update storage.buckets
set allowed_mime_types = array[
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
where id = 'audio';
