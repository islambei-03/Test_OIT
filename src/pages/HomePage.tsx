import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Тренажер аттестации
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Интерактивная подготовка: тренировка с мгновенной проверкой и экзамен с сохранением
          результата в Supabase. Панель администратора:{' '}
          <Link to="/admin" className="font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-400">
            /admin
          </Link>{' '}
          — пароль задаётся при настройке проекта (файл <span className="font-mono text-xs">.env</span>).
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="text-sm font-semibold text-violet-700 dark:text-violet-400">
              Режим 1: ТРЕНИРОВКА
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Мгновенная проверка
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Ответьте на вопрос, сразу увидите верный вариант и пояснение, затем переходите дальше.
            </p>
            <Link
              to="/training"
              className="mt-4 inline-flex w-full justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Начать тренировку
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="text-sm font-semibold text-violet-700 dark:text-violet-400">
              Режим 2: ЭКЗАМЕН
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Таймер + сохранение результата
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Случайный набор вопросов (число выбираете сами). Результат сохраняется в Supabase по имени.
            </p>
            <Link
              to="/exam"
              className="mt-4 inline-flex w-full justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Начать экзамен
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Как считается прогресс</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Если сотрудник проходит повторно с тем же именем, попытка будет считаться как №2, №3 и т.д.
          Это позволяет отслеживать динамику и слабые темы по ошибкам.
        </p>
      </div>
    </div>
  )
}

