-- Projects Table for saving estimates
create table if not exists projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  author text,
  start_date date,
  duration text,
  notes text,
  base_area numeric,
  tasks jsonb default '[]'::jsonb, -- Store the task array as JSON
  images jsonb default '[]'::jsonb, -- Store the image state as JSON
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies (Allow Public Read/Write for MVP ease, can restrict later)
alter table projects enable row level security;

create policy "Enable read access for all users" on projects for select using (true);
create policy "Enable insert access for all users" on projects for insert with check (true);
create policy "Enable update access for all users" on projects for update using (true);
