import { useLayoutEffect, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import AdminPage from './pages/AdminPage'
import ExamPage from './pages/ExamPage'
import HomePage from './pages/HomePage'
import TrainingPage from './pages/TrainingPage'

type ThemeChoice = 'light' | 'dark'

export default function App() {
  const location = useLocation()
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    const saved = localStorage.getItem('theme') as ThemeChoice | null
    if (saved === 'light' || saved === 'dark') return saved
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
  })

  useLayoutEffect(() => {
    localStorage.setItem('theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const nav = [
    { to: '/training', label: 'Тренировка' },
    { to: '/exam', label: 'Экзамен' },
    { to: '/admin', label: 'Админ' },
  ]

  return (
    <div className="min-h-dvh bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-sm">
              IT
            </div>
            <div className="leading-tight">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Тренажёр аттестации</div>
              <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Подготовка сотрудников</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 sm:flex">
              {nav.map((item) => {
                const active = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={
                      active
                        ? 'rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white'
                        : 'rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50'
                    }
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {theme === 'dark' ? 'Светлая' : 'Тёмная'}
            </button>
          </div>
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
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Страница не найдена</div>
                <div className="mt-4">
                  <Link to="/" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
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