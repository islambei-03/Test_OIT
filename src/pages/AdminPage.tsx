import { useEffect, useMemo, useState } from 'react'
import { fetchCatalog, fetchExamAttempts, type Category, type QuestionAnswer, createCategory, createQuestion, deleteQuestion, updateQuestion } from '../lib/db'
import Modal from '../components/Modal'

type ExamAttemptRow = {
  id: string
  fio: string
  exam_type: string
  attempt_no: number
  started_at: string
  finished_at: string
  duration_seconds: number
  score_percent: number
  correct_count: number
  wrong_count: number
  passed: boolean
  errors: any[]
  weak_topics: any[]
  question_count?: number
}

type WeakTopicAgg = { category_id: string; category_name: string; error_count: number }

function formatDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function toCsv(rows: Record<string, any>[], columns: { key: string; label: string }[]) {
  const escapeCell = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v)
    if (/[",\n;]/.test(s)) return `"${s.replaceAll('"', '""')}"`
    return s
  }
  const header = columns.map((c) => escapeCell(c.label)).join(';')
  const body = rows
    .map((r) => columns.map((c) => escapeCell(r[c.key])).join(';'))
    .join('\n')
  return `${header}\n${body}\n`
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function normalizeFio(input: string) {
  return input.trim().replace(/\s+/g, ' ')
}

function parseDateInput(v: string) {
  if (!v) return null
  const d = new Date(`${v}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export default function AdminPage() {
  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined
  const [adminOk, setAdminOk] = useState<boolean>(() => sessionStorage.getItem('admin_ok') === '1')
  const [passwordInput, setPasswordInput] = useState('')

  const [loading, setLoading] = useState(false)
  const [catalog, setCatalog] = useState<{
    categories: Category[]
    questions: (any & { answers: QuestionAnswer[] })[]
  } | null>(null)
  const [attempts, setAttempts] = useState<ExamAttemptRow[]>([])

  const [tab, setTab] = useState<'dashboard' | 'questions' | 'import'>('dashboard')

  const [searchFio, setSearchFio] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed'>('all')

  const [selectedFio, setSelectedFio] = useState<string | null>(null)

  const [questionModalOpen, setQuestionModalOpen] = useState(false)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [questionDraft, setQuestionDraft] = useState<{
    category_id: string
    question_text: string
    explanation: string
    answers: { option_text: string; is_correct: boolean }[]
  }>(() => ({
    category_id: '',
    question_text: '',
    explanation: '',
    answers: [
      { option_text: '', is_correct: true },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false },
    ],
  }))

  const [newCategoryName, setNewCategoryName] = useState('')

  async function reloadAll() {
    setLoading(true)
    try {
      const c = await fetchCatalog()
      const a = await fetchExamAttempts()
      setCatalog(c)
      setAttempts(a as any)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!adminOk) return
    reloadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminOk])

  const weakTopicsOverall: WeakTopicAgg[] = useMemo(() => {
    const map = new Map<string, WeakTopicAgg>()
    for (const t of attempts) {
      const list = Array.isArray(t.weak_topics) ? t.weak_topics : []
      for (const item of list) {
        if (!item?.category_id) continue
        const prev = map.get(item.category_id)
        if (!prev) map.set(item.category_id, { category_id: item.category_id, category_name: item.category_name ?? item.category_id, error_count: Number(item.error_count ?? 0) })
        else prev.error_count += Number(item.error_count ?? 0)
      }
    }
    return Array.from(map.values()).sort((a, b) => b.error_count - a.error_count)
  }, [attempts])

  const dashboardStats = useMemo(() => {
    const total = attempts.length
    const passed = attempts.filter((x) => x.passed).length
    const avg = total === 0 ? 0 : attempts.reduce((s, x) => s + Number(x.score_percent ?? 0), 0) / total
    const passRate = total === 0 ? 0 : (passed / total) * 100
    return { total, passed, avg, passRate }
  }, [attempts])

  const filteredAttempts = useMemo(() => {
    const q = searchFio.trim().toLowerCase()
    const from = parseDateInput(dateFrom)
    const to = parseDateInput(dateTo)

    return attempts.filter((a) => {
      if (q && !a.fio.toLowerCase().includes(q)) return false
      if (statusFilter === 'passed' && !a.passed) return false
      if (statusFilter === 'failed' && a.passed) return false
      if (from || to) {
        const d = new Date(a.finished_at)
        if (Number.isNaN(d.getTime())) return false
        if (from && d < from) return false
        if (to) {
          const dTo = new Date(to)
          dTo.setHours(23, 59, 59, 999)
          if (d > dTo) return false
        }
      }
      return true
    })
  }, [attempts, searchFio, dateFrom, dateTo, statusFilter])

  const selectedEmployeeAttempts = useMemo(() => {
    if (!selectedFio) return []
    const fioNorm = normalizeFio(selectedFio)
    return attempts
      .filter((a) => normalizeFio(a.fio) === fioNorm)
      .sort((a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime())
  }, [attempts, selectedFio])

  const selectedEmployeeWeakTopics: WeakTopicAgg[] = useMemo(() => {
    const map = new Map<string, WeakTopicAgg>()
    for (const t of selectedEmployeeAttempts) {
      const list = Array.isArray(t.weak_topics) ? t.weak_topics : []
      for (const item of list) {
        if (!item?.category_id) continue
        const prev = map.get(item.category_id)
        if (!prev) map.set(item.category_id, { category_id: item.category_id, category_name: item.category_name ?? item.category_id, error_count: Number(item.error_count ?? 0) })
        else prev.error_count += Number(item.error_count ?? 0)
      }
    }
    return Array.from(map.values()).sort((a, b) => b.error_count - a.error_count)
  }, [selectedEmployeeAttempts])

  function openCreateQuestion() {
    if (!catalog) return
    setEditingQuestionId(null)
    setQuestionDraft({
      category_id: catalog.categories[0]?.id ?? '',
      question_text: '',
      explanation: '',
      answers: [
        { option_text: '', is_correct: true },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
      ],
    })
    setQuestionModalOpen(true)
  }

  function openEditQuestion(questionId: string) {
    if (!catalog) return
    const q = catalog.questions.find((x) => x.id === questionId)
    if (!q) return

    const answersSorted = Array.isArray(q.answers) ? [...q.answers].sort((a, b) => a.option_index - b.option_index) : []
    const answers = [0, 1, 2, 3].map((idx) => {
      const a = answersSorted.find((x) => x.option_index === idx)
      return { option_text: a?.option_text ?? '', is_correct: Boolean(a?.is_correct) }
    })

    // гарантируем один правильный вариант
    const correctCount = answers.filter((a) => a.is_correct).length
    if (correctCount === 0) answers[0].is_correct = true

    setEditingQuestionId(questionId)
    setQuestionDraft({
      category_id: q.category_id,
      question_text: q.question_text,
      explanation: q.explanation ?? '',
      answers,
    })
    setQuestionModalOpen(true)
  }

  async function saveQuestion() {
    if (!catalog) return
    if (!questionDraft.category_id) return
    const answers = questionDraft.answers
    const correctIndex = answers.findIndex((a) => a.is_correct)
    if (correctIndex < 0) {
      alert('Выберите правильный вариант ответа.')
      return
    }
    const payload = {
      category_id: questionDraft.category_id,
      question_text: questionDraft.question_text.trim(),
      explanation: questionDraft.explanation.trim(),
      answers: [
        { option_text: answers[0].option_text.trim(), is_correct: answers[0].is_correct },
        { option_text: answers[1].option_text.trim(), is_correct: answers[1].is_correct },
        { option_text: answers[2].option_text.trim(), is_correct: answers[2].is_correct },
        { option_text: answers[3].option_text.trim(), is_correct: answers[3].is_correct },
      ],
    } as const

    if (!payload.question_text || payload.question_text.length < 5) {
      alert('Текст вопроса слишком короткий.')
      return
    }

    if (editingQuestionId) {
      await updateQuestion(editingQuestionId, payload)
    } else {
      await createQuestion(payload)
    }

    setQuestionModalOpen(false)
    await reloadAll()
  }

  async function removeQuestion(questionId: string) {
    if (!confirm('Удалить вопрос?')) return
    await deleteQuestion(questionId)
    await reloadAll()
  }

  async function addCategory() {
    const name = newCategoryName.trim()
    if (!name) return
    await createCategory(name)
    setNewCategoryName('')
    await reloadAll()
  }

  const [importText, setImportText] = useState('')
  const [importCsv, setImportCsv] = useState('')
  const [importBusy, setImportBusy] = useState(false)

  async function runJsonImport() {
    if (!catalog) return
    let parsed: any
    try {
      parsed = JSON.parse(importText)
    } catch {
      alert('JSON невалидный.')
      return
    }
    if (!Array.isArray(parsed)) {
      alert('Ожидается массив вопросов.')
      return
    }
    setImportBusy(true)
    try {
      for (const item of parsed) {
        const categoryName = String(item.category ?? '').trim()
        const category = catalog.categories.find((c) => c.name === categoryName)
        if (!category) {
          alert(`Категория не найдена: ${categoryName}`)
          continue
        }
        const answersIn = Array.isArray(item.answers) ? item.answers : []
        if (answersIn.length !== 4) {
          alert('У каждого вопроса должно быть 4 ответа.')
          continue
        }
        const correctCount = answersIn.filter((a: any) => Boolean(a.correct ?? a.is_correct ?? a.isCorrect)).length
        if (correctCount < 1) {
          alert('Нужен хотя бы один правильный ответ.')
          continue
        }
        const draft = {
          category_id: category.id,
          question_text: String(item.question ?? '').trim(),
          explanation: String(item.explanation ?? '').trim(),
          answers: answersIn.map((a: any) => ({
            option_text: String(a.text ?? a.option_text ?? a.optionText ?? '').trim(),
            is_correct: Boolean(a.correct ?? a.is_correct ?? a.isCorrect),
          })),
        } as any
        await createQuestion(draft)
      }
      await reloadAll()
      setImportText('')
    } finally {
      setImportBusy(false)
    }
  }

  async function runCsvImport() {
    if (!catalog) return
    const raw = importCsv.trim()
    if (!raw) return
    setImportBusy(true)
    try {
      const lines = raw.split(/\r?\n/).filter(Boolean)
      if (lines.length < 2) {
        alert('CSV слишком короткий.')
        return
      }
      const header = lines[0].split(/[;,]/).map((x) => x.trim().toLowerCase())
      // expected: category,question,explanation,optiona,optionb,optionc,optiond,correctoption
      const idxCategory = header.indexOf('category')
      const idxQuestion = header.indexOf('question')
      const idxExplanation = header.indexOf('explanation')
      const idxA = header.indexOf('optiona')
      const idxB = header.indexOf('optionb')
      const idxC = header.indexOf('optionc')
      const idxD = header.indexOf('optiond')
      const idxCorrect = header.indexOf('correctoption')

      if ([idxCategory, idxQuestion, idxA, idxB, idxC, idxD, idxCorrect].some((i) => i < 0)) {
        alert('Неверный заголовок CSV.')
        return
      }

      for (const line of lines.slice(1)) {
        const parts = line.split(/[;,]/).map((x) => x.trim())
        const categoryName = parts[idxCategory]
        const category = catalog.categories.find((c) => c.name === categoryName)
        if (!category) {
          alert(`Категория не найдена: ${categoryName}`)
          continue
        }
        const options = [parts[idxA], parts[idxB], parts[idxC], parts[idxD]]
        const correctRaw = parts[idxCorrect].toUpperCase()
        const correctIdx =
          correctRaw === '1' || correctRaw === 'A'
            ? 0
            : correctRaw === '2' || correctRaw === 'B'
              ? 1
              : correctRaw === '3' || correctRaw === 'C'
                ? 2
                : correctRaw === '4' || correctRaw === 'D'
                  ? 3
                  : -1
        if (correctIdx < 0) continue

        const draft = {
          category_id: category.id,
          question_text: parts[idxQuestion],
          explanation: idxExplanation >= 0 ? parts[idxExplanation] : '',
          answers: [0, 1, 2, 3].map((i) => ({ option_text: options[i] ?? '', is_correct: i === correctIdx })),
        } as any
        await createQuestion(draft)
      }

      await reloadAll()
      setImportCsv('')
    } finally {
      setImportBusy(false)
    }
  }

  if (!adminOk) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Админ-панель</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Введите пароль администратора.</p>

        <label className="mt-4 block">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Пароль</div>
          <input
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            type="password"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>

        <button
          type="button"
          onClick={() => {
            if (!adminPassword) {
              alert('Задайте пароль в файле .env (переменная VITE_ADMIN_PASSWORD) и перезапустите сервер разработки.')
              return
            }
            if (passwordInput === adminPassword) {
              sessionStorage.setItem('admin_ok', '1')
              setAdminOk(true)
            } else {
              alert('Неверный пароль')
            }
          }}
          className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900"
        >
          Войти
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Админ-панель</h1>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Управление вопросами и просмотр попыток.</div>
        </div>

        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem('admin_ok')
            setAdminOk(false)
            setPasswordInput('')
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900/60"
        >
          Выйти
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('dashboard')}
          className={
            tab === 'dashboard'
              ? 'rounded-xl border border-violet-500 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 dark:border-violet-400 dark:bg-violet-500/10 dark:text-violet-200'
              : 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900/60'
          }
        >
          Dashboard
        </button>
        <button
          type="button"
          onClick={() => setTab('questions')}
          className={
            tab === 'questions'
              ? 'rounded-xl border border-violet-500 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 dark:border-violet-400 dark:bg-violet-500/10 dark:text-violet-200'
              : 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900/60'
          }
        >
          Вопросы
        </button>
        <button
          type="button"
          onClick={() => setTab('import')}
          className={
            tab === 'import'
              ? 'rounded-xl border border-violet-500 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 dark:border-violet-400 dark:bg-violet-500/10 dark:text-violet-200'
              : 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900/60'
          }
        >
          Импорт
        </button>
      </div>

      {loading && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/60">
          Загрузка...
        </div>
      )}

      {tab === 'dashboard' && !loading && (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-sm text-slate-600 dark:text-slate-300">Прошли (всего)</div>
              <div className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">{dashboardStats.total}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-sm text-slate-600 dark:text-slate-300">СДАЛ</div>
              <div className="mt-1 text-3xl font-black text-emerald-700 dark:text-emerald-400">{dashboardStats.passed}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-sm text-slate-600 dark:text-slate-300">Средний балл</div>
              <div className="mt-1 text-3xl font-black text-violet-700 dark:text-violet-400">{Math.round(dashboardStats.avg)}%</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-sm text-slate-600 dark:text-slate-300">Процент сдачи</div>
              <div className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">{Math.round(dashboardStats.passRate)}%</div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Слабые темы (по ошибкам)</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Суммарно по всем сотрудникам</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {weakTopicsOverall.slice(0, 6).map((w) => (
                  <div
                    key={w.category_id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200"
                  >
                    {w.category_name}: {w.error_count}
                  </div>
                ))}
                {weakTopicsOverall.length === 0 ? (
                  <div className="text-sm text-slate-600 dark:text-slate-300">Пока нет данных.</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Таблица результатов</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const csv = toCsv(filteredAttempts as any, [
                      { key: 'fio', label: 'fio' },
                      { key: 'finished_at', label: 'date' },
                      { key: 'score_percent', label: 'score_percent' },
                      { key: 'passed', label: 'status' },
                      { key: 'attempt_no', label: 'attempt_no' },
                      { key: 'exam_type', label: 'exam_type' },
                      { key: 'question_count', label: 'question_count' },
                    ])
                    downloadTextFile(`exam_attempts_${new Date().toISOString().slice(0, 10)}.csv`, csv)
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900/60"
                >
                  Экспорт CSV
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <input
                value={searchFio}
                onChange={(e) => setSearchFio(e.target.value)}
                placeholder="Поиск по ФИО"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
              />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
              >
                <option value="all">Все статусы</option>
                <option value="passed">СДАЛ</option>
                <option value="failed">НЕ СДАЛ</option>
              </select>
            </div>

            <div className="mt-4 overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-[720px] w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-slate-600 dark:bg-slate-950/30 dark:text-slate-300">
                  <tr>
                    <th className="p-3">ФИО</th>
                    <th className="p-3">Дата</th>
                    <th className="p-3">Баллы</th>
                    <th className="p-3">Статус</th>
                    <th className="p-3">Попытки</th>
                    <th className="p-3">Вопросов</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredAttempts.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{a.fio}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{formatDateTime(a.finished_at)}</td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{Math.round(Number(a.score_percent ?? 0))}%</td>
                      <td className="p-3 font-semibold">
                        {a.passed ? (
                          <span className="text-emerald-700 dark:text-emerald-400">СДАЛ</span>
                        ) : (
                          <span className="text-rose-700 dark:text-rose-300">НЕ СДАЛ</span>
                        )}
                      </td>
                      <td className="p-3">
                        #{a.attempt_no} <span className="text-xs text-slate-500">({a.exam_type})</span>
                      </td>
                      <td className="p-3 tabular-nums text-slate-700 dark:text-slate-200">
                        {a.question_count != null ? a.question_count : '—'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedFio(a.fio)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900/60"
                        >
                          Карточка
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAttempts.length === 0 ? (
                    <tr>
                      <td className="p-4 text-center text-sm text-slate-600 dark:text-slate-300" colSpan={7}>
                        Нет результатов под выбранными фильтрами.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {selectedEmployeeAttempts.length > 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Карточка сотрудника</div>
                  <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{selectedFio}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFio(null)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900/60"
                >
                  Закрыть
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-sm text-slate-600 dark:text-slate-300">Попыток</div>
                  <div className="mt-1 text-3xl font-black">{selectedEmployeeAttempts.length}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-sm text-slate-600 dark:text-slate-300">Лучший результат</div>
                  <div className="mt-1 text-3xl font-black text-violet-700 dark:text-violet-400">
                    {Math.round(Math.max(...selectedEmployeeAttempts.map((x) => Number(x.score_percent ?? 0))))}%
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-sm text-slate-600 dark:text-slate-300">Слабые темы</div>
                  <div className="mt-2 space-y-1">
                    {selectedEmployeeWeakTopics.slice(0, 3).map((w) => (
                      <div key={w.category_id} className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {w.category_name}: {w.error_count}
                      </div>
                    ))}
                    {selectedEmployeeWeakTopics.length === 0 ? (
                      <div className="text-sm text-slate-600 dark:text-slate-300">Нет ошибок.</div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-[680px] w-full border-collapse text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600 dark:bg-slate-950/30 dark:text-slate-300">
                    <tr>
                      <th className="p-3">Дата</th>
                      <th className="p-3">Баллы</th>
                      <th className="p-3">Статус</th>
                      <th className="p-3">Ошибки</th>
                      <th className="p-3">Попытка</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {selectedEmployeeAttempts.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                        <td className="p-3 text-slate-600 dark:text-slate-300">{formatDateTime(a.finished_at)}</td>
                        <td className="p-3 font-semibold">{Math.round(Number(a.score_percent ?? 0))}%</td>
                        <td className="p-3 font-semibold">
                          {a.passed ? (
                            <span className="text-emerald-700 dark:text-emerald-400">СДАЛ</span>
                          ) : (
                            <span className="text-rose-700 dark:text-rose-300">НЕ СДАЛ</span>
                          )}
                        </td>
                        <td className="p-3">
                          {Array.isArray(a.errors) ? a.errors.length : Number(a.wrong_count ?? 0)}
                        </td>
                        <td className="p-3">
                          #{a.attempt_no} <span className="text-xs text-slate-500">({a.exam_type})</span>
                        </td>
                      </tr>
                    ))}
                    {selectedEmployeeAttempts.length === 0 ? (
                      <tr>
                        <td className="p-4 text-center text-sm text-slate-600 dark:text-slate-300" colSpan={5}>
                          Нет попыток.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'questions' && !loading && catalog && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Управление вопросами</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Создание/редактирование/удаление и назначение правильного ответа</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openCreateQuestion}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
              >
                + Новый вопрос
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Категории</div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Новая категория"
                  className="w-64 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={addCategory}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900/60"
                >
                  Добавить
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {catalog.categories.map((c) => (
                <div key={c.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200">
                  {c.name}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-auto rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <table className="min-w-[900px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-slate-600 dark:bg-slate-950/30 dark:text-slate-300">
                <tr>
                  <th className="p-3">Категория</th>
                  <th className="p-3">Вопрос</th>
                  <th className="p-3">Ответы</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {catalog.questions.map((q) => {
                  const catName = catalog.categories.find((c) => c.id === q.category_id)?.name ?? q.category_id
                  const answersSorted = Array.isArray(q.answers) ? [...q.answers].sort((a: any, b: any) => a.option_index - b.option_index) : []
                  return (
                    <tr key={q.id} className="align-top hover:bg-slate-50 dark:hover:bg-slate-900/30">
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{catName}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{q.question_text}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{q.explanation ? q.explanation.slice(0, 120) : ''}</div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                          {answersSorted.slice(0, 4).map((a: any, idx: number) => (
                            <div key={a.id ?? idx}>
                              {String.fromCharCode(65 + idx)}: {a.option_text} {a.is_correct ? '✓' : ''}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditQuestion(q.id)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900/60"
                          >
                            Редактировать
                          </button>
                          <button
                            type="button"
                            onClick={() => removeQuestion(q.id)}
                            className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-900/30"
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {catalog.questions.length === 0 ? (
                  <tr>
                    <td className="p-4 text-center text-sm text-slate-600 dark:text-slate-300" colSpan={4}>
                      Нет вопросов. Добавьте первый.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'import' && !loading && catalog && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Импорт вопросов</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            JSON ожидается в формате:
          </p>
          <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200">
            <pre style={{ whiteSpace: 'pre-wrap' }}>
{`[
  {
    "category": "Информационная безопасность",
    "question": "....",
    "explanation": "....",
    "answers": [
      {"text":"...", "correct": true},
      {"text":"...", "correct": false},
      {"text":"...", "correct": false},
      {"text":"...", "correct": false}
    ]
  }
]`}
            </pre>
          </div>

          <label className="mt-5 block">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">JSON</div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="mt-2 h-56 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
              placeholder='Вставьте JSON-массив вопросов'
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={runJsonImport}
              disabled={importBusy || !importText.trim()}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Импорт JSON
            </button>
            {importBusy ? <div className="text-sm text-slate-600 dark:text-slate-300">Идёт импорт...</div> : null}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">CSV</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Заголовок: `category;question;explanation;optionA;optionB;optionC;optionD;correctOption` (correctOption: 1-4 или A-D)
            </p>
            <textarea
              value={importCsv}
              onChange={(e) => setImportCsv(e.target.value)}
              className="mt-3 h-40 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
              placeholder="category;question;explanation;optionA;optionB;optionC;optionD;correctOption&#10;..."
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={runCsvImport}
                disabled={importBusy || !importCsv.trim()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900/60 disabled:opacity-50"
              >
                Импорт CSV
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={questionModalOpen}
        title={editingQuestionId ? 'Редактировать вопрос' : 'Новый вопрос'}
        onClose={() => setQuestionModalOpen(false)}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setQuestionModalOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900/60"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={saveQuestion}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Сохранить
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Категория</div>
            <select
              value={questionDraft.category_id}
              onChange={(e) => setQuestionDraft((d) => ({ ...d, category_id: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
            >
              {catalog?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Вопрос</div>
            <textarea
              value={questionDraft.question_text}
              onChange={(e) => setQuestionDraft((d) => ({ ...d, question_text: e.target.value }))}
              className="mt-2 h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
            />
          </label>

          <label className="block">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Пояснение</div>
            <textarea
              value={questionDraft.explanation}
              onChange={(e) => setQuestionDraft((d) => ({ ...d, explanation: e.target.value }))}
              className="mt-2 h-24 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
            />
          </label>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Варианты ответа (4)</div>
            <div className="grid gap-3">
              {[0, 1, 2, 3].map((idx) => {
                const a = questionDraft.answers[idx]
                const checked = a.is_correct
                return (
                  <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Вариант {String.fromCharCode(65 + idx)}</div>
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <input
                          type="radio"
                          name="correct_answer"
                          checked={checked}
                          onChange={() => {
                            setQuestionDraft((d) => {
                              const next = d.answers.map((x, i) => ({ ...x, is_correct: i === idx }))
                              return { ...d, answers: next }
                            })
                          }}
                        />
                        Правильный
                      </label>
                    </div>
                    <textarea
                      value={a.option_text}
                      onChange={(e) => {
                        const value = e.target.value
                        setQuestionDraft((d) => {
                          const next = d.answers.map((x, i) => (i === idx ? { ...x, option_text: value } : x))
                          return { ...d, answers: next }
                        })
                      }}
                      className="mt-2 h-20 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

