-- Добавить количество выбранных вопросов в попытке экзамена (запустите в SQL Editor Supabase один раз)

alter table public.exam_attempts
  add column if not exists question_count int not null default 20;

comment on column public.exam_attempts.question_count is 'Сколько вопросов выбрал пользователь для этой попытки';
