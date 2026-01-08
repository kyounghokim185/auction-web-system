-- Storage Bucket Setup for Site Photos

-- Create a public bucket named 'site-photos'
insert into storage.buckets (id, name, public)
values ('site-photos', 'site-photos', true);

-- Policy to allow public access to view photos
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'site-photos' );

-- Policy to allow anyone to upload photos (MVP: authenticating strictly is better, but per prompt "allow upload")
create policy "Anyone can upload"
  on storage.objects for insert
  with check ( bucket_id = 'site-photos' );
