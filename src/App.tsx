import { Link, Route, Routes, useLocation } from 'react-router-dom'
import AdminPage from './pages/AdminPage'
import ExamPage from './pages/ExamPage'
import HomePage from './pages/HomePage'
import TrainingPage from './pages/TrainingPage'

export default function App() {
  const location = useLocation()

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 dark:border-slate-800/70 dark:bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white font-semibold">
              IT
            </div>
            <div className="leading-tight">
              <div className="text-sm text-slate-500 dark:text-slate-400">Тренажер к аттестации</div>
              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Подготовка сотрудников
              </div>
            </div>
          </div>

          <nav className="hidden sm:flex items-center gap-4 text-sm">
            <Link
              to="/training"
              className={
                location.pathname === '/training'
                  ? 'font-semibold text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }
            >
              Тренировка
            </Link>
            <Link
              to="/exam"
              className={
                location.pathname === '/exam'
                  ? 'font-semibold text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }
            >
              Экзамен
            </Link>
            <Link
              to="/admin"
              className={
                location.pathname === '/admin'
                  ? 'font-semibold text-violet-700 dark:text-violet-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }
            >
              Админ
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/exam" element={<ExamPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route
            path="*"
            element={
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">Страница не найдена</div>
                <div className="mt-2 text-slate-600 dark:text-slate-300">
                  Вернитесь на главную.
                </div>
                <div className="mt-4">
                  <Link to="/" className="text-violet-600 hover:underline dark:text-violet-400">
                    На главную
                  </Link>
                </div>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  )
}
