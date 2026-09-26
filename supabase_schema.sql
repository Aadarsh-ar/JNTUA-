-- ==============================================================================
-- Supabase Schema for JNTUA Attendance App
-- Database Tables, Storage Buckets, and Row Level Security (RLS) Policies
-- ==============================================================================

-- 1. Important PDFs Table
-- Stores metadata and storage URLs for study materials, question papers, and syllabi.
create table if not exists public.important_pdfs (
  id text primary key,
  year int not null check (year between 1 and 4),
  semester text not null,
  title text not null,
  subject text not null,
  regulation text,
  file_url text not null,
  file_size text not null,
  file_name text,
  uploaded_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS)
alter table public.important_pdfs enable row level security;

-- Policies for important_pdfs:
-- Allow anyone (anonymous users and app clients) to read PDF records
create policy "Allow public read access on important_pdfs" 
  on public.important_pdfs
  for select 
  using (true);

-- Allow insert/update/delete operations with valid anon/service keys
create policy "Allow full access on important_pdfs" 
  on public.important_pdfs
  for all 
  using (true) 
  with check (true);


-- 2. Push Tokens Table
-- Stores Expo push notification tokens from registered user devices.
create table if not exists public.push_tokens (
  token text primary key,
  platform text,
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS)
alter table public.push_tokens enable row level security;

-- Policies for push_tokens:
-- Allow devices to register and upsert tokens
create policy "Allow public insert on push_tokens" 
  on public.push_tokens
  for insert 
  with check (true);

create policy "Allow public update on push_tokens" 
  on public.push_tokens
  for update 
  using (true);

-- Allow reading tokens for notification broadcasts
create policy "Allow public read on push_tokens" 
  on public.push_tokens
  for select 
  using (true);


-- 3. Supabase Storage Bucket Setup
-- Create the public bucket 'important_pdfs' for storing uploaded PDF files
insert into storage.buckets (id, name, public)
values ('important_pdfs', 'important_pdfs', true)
on conflict (id) do nothing;

-- Storage RLS Policies:
-- Allow public viewing/downloading of uploaded PDFs
create policy "Allow public read of important_pdfs bucket" 
  on storage.objects
  for select 
  using (bucket_id = 'important_pdfs');

-- Allow authenticated/anon uploads to the important_pdfs bucket
create policy "Allow upload to important_pdfs bucket" 
  on storage.objects
  for insert 
  with check (bucket_id = 'important_pdfs');
