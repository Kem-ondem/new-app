-- Access rules for the shared course-resources library.
-- Apply this in the Supabase SQL Editor for the project's database.

-- Enforce a matching limit and document MIME allowlist at the storage layer too.
update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/rtf',
      'application/rtf',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.presentation'
    ]
where id = 'course-resources';

alter table public.course_resources enable row level security;

drop policy if exists "GCTU students can view course resources" on public.course_resources;
create policy "GCTU students can view course resources"
on public.course_resources
for select
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) like '%@live.gctu.edu.gh');

drop policy if exists "GCTU students can add their own course resources" on public.course_resources;
create policy "GCTU students can add their own course resources"
on public.course_resources
for insert
to authenticated
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) like '%@live.gctu.edu.gh'
  and created_by = (select auth.uid())
);

drop policy if exists "GCTU students can remove their own course resources" on public.course_resources;
create policy "GCTU students can remove their own course resources"
on public.course_resources
for delete
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) like '%@live.gctu.edu.gh'
  and created_by = (select auth.uid())
);

drop policy if exists "GCTU students can read course resource files" on storage.objects;
create policy "GCTU students can read course resource files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'course-resources'
  and lower(coalesce(auth.jwt() ->> 'email', '')) like '%@live.gctu.edu.gh'
);

drop policy if exists "GCTU students can upload their own course resource files" on storage.objects;
create policy "GCTU students can upload their own course resource files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'course-resources'
  and lower(coalesce(auth.jwt() ->> 'email', '')) like '%@live.gctu.edu.gh'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "GCTU students can remove their own course resource files" on storage.objects;
create policy "GCTU students can remove their own course resource files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'course-resources'
  and lower(coalesce(auth.jwt() ->> 'email', '')) like '%@live.gctu.edu.gh'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
