-- Supabase schema for training/exam MVP
-- Tables: categories, questions, exam_answers, exam_attempts

create extension if not exists pgcrypto;

-- 1) Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- 2) Questions
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  question_text text not null,
  explanation text,
  created_at timestamptz not null default now()
);

-- 3) Answers (exactly 4 options per question is expected by the UI)
create table if not exists public.exam_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_index int not null check (option_index >= 0 and option_index < 4),
  option_text text not null,
  is_correct boolean not null default false,
  created_at timestamptz not null default now(),
  unique (question_id, option_index)
);

-- 4) Exam attempts
create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  fio text not null,

  exam_type text not null check (exam_type in ('exam', 'trial')),
  attempt_no int not null,

  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  duration_seconds int not null default 0,

  score_percent numeric not null,
  correct_count int not null,
  wrong_count int not null,
  passed boolean not null,

  question_count int not null default 20,

  errors jsonb not null default '[]'::jsonb,
  weak_topics jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),

  unique (fio, exam_type, attempt_no)
);

create index if not exists exam_attempts_finished_at_idx on public.exam_attempts (finished_at desc);
create index if not exists exam_attempts_fio_exam_type_idx on public.exam_attempts (fio, exam_type);

-- Row Level Security (RLS)
--
-- MVP note:
-- The app has no user auth. To make the MVP work end-to-end, we allow public read
-- and public write to question-related tables.
-- For real production, switch to server-side admin + strict RLS.

alter table public.categories enable row level security;
alter table public.questions enable row level security;
alter table public.exam_answers enable row level security;
alter table public.exam_attempts enable row level security;

-- Public read (needed for training/exam)
create policy "public read categories" on public.categories
  for select to anon using (true);

create policy "public read questions" on public.questions
  for select to anon using (true);

create policy "public read exam_answers" on public.exam_answers
  for select to anon using (true);

create policy "public read exam_attempts" on public.exam_attempts
  for select to anon using (true);

-- Public writes (needed for admin CRUD + saving attempts without auth)
create policy "public insert exam_attempts" on public.exam_attempts
  for insert to anon with check (true);

create policy "public write categories" on public.categories
  for insert to anon with check (true);

create policy "public write questions" on public.questions
  for insert to anon with check (true);

create policy "public update questions" on public.questions
  for update to anon using (true) with check (true);

create policy "public delete questions" on public.questions
  for delete to anon using (true);

create policy "public write exam_answers" on public.exam_answers
  for insert to anon with check (true);

create policy "public update exam_answers" on public.exam_answers
  for update to anon using (true) with check (true);

create policy "public delete exam_answers" on public.exam_answers
  for delete to anon using (true);

