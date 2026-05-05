-- Create the public avatars bucket (idempotent)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Allow anyone to read avatar files
create policy "Avatars are publicly readable"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- Allow authenticated users to upload/replace their own avatar
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name = (auth.uid()::text || '.' || split_part(name, '.', 2))
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and owner = auth.uid()
  );
