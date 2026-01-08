-- Storage Bucket Setup for Site Photos (Idempotent)

-- 1. Create a public bucket named 'site-photos' if it doesn't exist
insert into storage.buckets (id, name, public)
values ('site-photos', 'site-photos', true)
on conflict (id) do update set public = true;

-- 2. Drop existing policies to ensure clean state (optional, but safer for updates)
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Anyone can upload" on storage.objects;

-- 3. Policy to allow public access to view photos
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'site-photos' );

-- 4. Policy to allow anyone to upload photos
create policy "Anyone can upload"
  on storage.objects for insert
  with check ( bucket_id = 'site-photos' );
