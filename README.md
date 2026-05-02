# IT Аттестация — тренажёр сотрудников (React + Vite + Tailwind + Supabase)

Production-ready MVP без регистрации:
- Режим 1: **Тренировка** (сразу доступ, тема → вопросы по одному, 4 варианта, мгновенная проверка + пояснение).
- Режим 2: **Экзамен** (форма ввода `Имя Фамилия` → таймер → число вопросов на выбор → итог + сохранение в Supabase).
- Админка: скрытая страница **`/admin`**.

## 1) Supabase: SQL схема и seed

1. Создайте проект в Supabase (бесплатный тариф подходит).
2. Откройте **SQL Editor** в вашем Supabase проекте.
3. Выполните по очереди:
   - `supabase/schema.sql`
   - `supabase/seed.sql`

Если база уже создана по старой схеме без столбца `question_count` в `exam_attempts`, выполните ещё `supabase/migration_add_question_count.sql`.

После этого в БД появятся таблицы:
- `categories`
- `questions`
- `exam_answers`
- `exam_attempts`

## 2) Настройка переменных окружения

Скопируйте `.env.example` в `.env` и заполните значения:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ADMIN_PASSWORD`
- `VITE_EXAM_SECONDS` (по умолчанию 30 минут)
- `VITE_TRIAL_SECONDS` (по умолчанию 15 минут)

## 3) Запуск локально

```bash
npm install
npm run dev
```

Откройте ссылку от Vite (обычно `http://localhost:5173`).

## 4) Деплой на Vercel

1. Запушьте проект в GitHub/GitLab/Bitbucket ( `.env` в git не коммитьте).
2. [vercel.com](https://vercel.com) → **Add New** → **Project** → импорт репозитория.
3. Framework Preset: **Vite** (или Other):  
   **Build Command:** `npm run build` · **Output Directory:** `dist`
4. **Environment Variables** — добавьте те же ключи, что в `.env` (начинаются с `VITE_`).
5. **Deploy.** SPA-роутинг (`/training`, `/exam`, `/admin`) задан в `vercel.json`.

## 5) Деплой на Netlify

1. [netlify.com](https://www.netlify.com) → **Add new site** → импорт из Git.
2. Настройки подтягиваются из **`netlify.toml`** (`npm run build`, каталог `dist`). При необходимости задайте вручную.
3. **Site configuration → Environment variables** — те же переменные, что в `.env`.
4. Деплой. Дополнительно для SPA есть **`public/_redirects`**.

## 6) Админ-панель

Страница: `/admin`

Пароль: `VITE_ADMIN_PASSWORD`

В админке можно:
- посмотреть попытки сотрудников (с фильтрами),
- экспортировать результаты в CSV,
- добавлять/редактировать/удалять вопросы,
- импортировать вопросы из JSON/CSV.

## Важно про безопасность (MVP-ограничение)

Так как проект **без регистрации/авторизации**, в MVP:
- используется anon ключ Supabase для чтения/записи,
- RLS в схеме сделан так, чтобы админ CRUD и сохранение попыток работали “из коробки”.

Для реального production с защитой от несанкционированных изменений:
- перенесите админ CRUD на server-side (Edge/Functions),
- включите строгие RLS-политики и запретите публичные записи на `questions/exam_answers`.

"# Test_OIT" 
