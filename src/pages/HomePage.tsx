import { Link } from 'react-router-dom'
import { TEST_VND_NAME } from '../lib/questionPools'

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Тренажёр аттестации</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          База: <span className="font-semibold text-zinc-800 dark:text-zinc-100">~100 вопросов по основам ИТ</span> и{' '}
          <span className="font-semibold text-zinc-800 dark:text-zinc-100">тест «{TEST_VND_NAME}»</span> (профильные документы и
          положение об отделе). В экзамене и смешанной тренировке — пропорция{' '}
          <span className="font-semibold">⅓ «{TEST_VND_NAME}» + ⅔ ИТ</span> (например, 15 вопросов → 5 и 10).
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-950/50">
            <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Тренировка</div>
            <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">С подсказками</div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Тема «{TEST_VND_NAME}», отдельные документы или смешанный режим с основами ИТ.
            </p>
            <Link
              to="/training"
              className="mt-4 inline-flex w-full justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Начать тренировку
            </Link>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-950/50">
            <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Экзамен</div>
            <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Таймер и отчёт</div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Смешанный тест («{TEST_VND_NAME}» + ИТ), результат в базу. Проходной балл — 70%.
            </p>
            <Link
              to="/exam"
              className="mt-4 inline-flex w-full justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Начать экзамен
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Админ-панель</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Статистика, вопросы, импорт.{' '}
          <Link to="/admin" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
            /admin
          </Link>
        </p>
      </div>
    </div>
  )
}
