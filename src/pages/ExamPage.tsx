import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCatalog, getNextAttemptNo, saveExamAttempt, type Category, type ExamAttemptErrorItem, type ExamType, type Question, type QuestionAnswer } from '../lib/db'
import { describeMixedComposition, pickMixedQuestions } from '../lib/questionPools'
import { supabaseConfigured } from '../lib/supabaseClient'

type ExamSessionQuestion = {
  question: Question
  categoryId: string
  answers: QuestionAnswer[] // порядок как в БД; на экране перемешиваются отдельно
  correctOptionIndex: number // original option_index
}

type ExamResponse = {
  question_id: string
  category_id: string
  user_option_index: number
  user_option_text: string
  correct_option_index: number
  correct_option_text: string
  question_text: string
  is_correct: boolean
}

function ratingLevel(percent: number) {
  if (percent < 50) return { name: 'Новичок', tone: 'text-slate-700 dark:text-slate-300' }
  if (percent < 80) return { name: 'Уверенный', tone: 'text-violet-700 dark:text-violet-400' }
  return { name: 'Эксперт', tone: 'text-emerald-700 dark:text-emerald-400' }
}

function formatPercent(p: number) {
  if (!Number.isFinite(p)) return '0%'
  return `${Math.round(p)}%`
}

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
}

function shuffle<T>(arr: T[]) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const PASS_PERCENT = 70
const DEFAULT_EXAM_SECONDS = 30 * 60

export default function ExamPage() {
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState<{
    categories: Category[]
    questions: (Question & { answers: QuestionAnswer[] })[]
  } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [fio, setFio] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [examQuestionCount, setExamQuestionCount] = useState(20)

  const [session, setSession] = useState<{
    exam_type: ExamType
    questions: ExamSessionQuestion[]
    idx: number
    responses: ExamResponse[]
    started_at: number
    duration_seconds: number
    question_count: number
    finished: boolean
    remaining_seconds: number
    saved?: boolean
  } | null>(null)

  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null) // original option_index

  const examSeconds = useMemo(() => {
    const raw = import.meta.env.VITE_EXAM_SECONDS as string | undefined
    const n = raw ? Number(raw) : DEFAULT_EXAM_SECONDS
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_EXAM_SECONDS
  }, [])

  const trialSeconds = useMemo(() => {
    const raw = import.meta.env.VITE_TRIAL_SECONDS as string | undefined
    if (raw) {
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) return n
    }
    return Math.max(5 * 60, Math.floor(examSeconds * 0.5))
  }, [examSeconds])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const c = await fetchCatalog()
        if (!mounted) return
        setCatalog(c)
      } catch (e) {
        if (!mounted) return
        setCatalog(null)
        setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить базу вопросов.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const examCountBounds = useMemo(() => {
    const n = catalog?.questions.length ?? 0
    const max = Math.max(5, Math.min(100, n || 5))
    const min = Math.min(5, max)
    return { min: min || 5, max }
  }, [catalog])

  useEffect(() => {
    setExamQuestionCount((c) => Math.min(Math.max(c, examCountBounds.min), examCountBounds.max))
  }, [examCountBounds])

  const mixedCompositionHint = useMemo(() => {
    const n = Math.min(examQuestionCount, catalog?.questions.length ?? examQuestionCount)
    return describeMixedComposition(n)
  }, [examQuestionCount, catalog])

  function buildSessionQuestions(count: number) {
    if (!catalog) return []

    const n = Math.min(Math.max(5, count), catalog.questions.length)
    const selected = pickMixedQuestions(catalog.questions, catalog.categories, n)
    return selected.map((q) => {
      const correct = q.answers.find((a) => a.is_correct)
      const correctOptionIndex = correct?.option_index ?? 0
      return {
        question: q,
        categoryId: q.category_id,
        answers: [...q.answers],
        correctOptionIndex,
      }
    })
  }

  const current = session ? session.questions[session.idx] : null

  const displayAnswers = useMemo(() => {
    if (!current) return []
    return shuffle([...current.answers])
  }, [session?.idx, current?.question.id])

  // percent рассчитывается в конце экзамена (после завершения)

  useEffect(() => {
    if (!session || session.finished) return
    const handle = window.setInterval(() => {
      setSession((s) => {
        if (!s) return s
        const next = s.remaining_seconds - 1
        if (next <= 0) {
          return { ...s, remaining_seconds: 0, finished: true }
        }
        return { ...s, remaining_seconds: next }
      })
    }, 1000)
    return () => window.clearInterval(handle)
  }, [session])

  // auto-save when finished
  useEffect(() => {
    if (!session || !session.finished) return
    if (session.saved) return
    if (!catalog) return
    setSaveError(null)
    ;(async () => {
      setSaving(true)
      try {
        const finished_at = new Date().toISOString()
        const started_at = new Date(session.started_at).toISOString()
        const duration_seconds = session.duration_seconds

        const responseByQuestionId = new Map(session.responses.map((r) => [r.question_id, r]))

        const allResponses: ExamResponse[] = session.questions.map((sq) => {
          const existing = responseByQuestionId.get(sq.question.id)
          if (existing) return existing
          const correctAnswer = sq.answers.find((a) => a.is_correct)
          return {
            question_id: sq.question.id,
            category_id: sq.question.category_id,
            user_option_index: -1,
            user_option_text: '—',
            correct_option_index: correctAnswer?.option_index ?? sq.correctOptionIndex,
            correct_option_text: correctAnswer?.option_text ?? '',
            question_text: sq.question.question_text,
            is_correct: false,
          }
        })

        const correct_count = allResponses.filter((r) => r.is_correct).length
        const wrong_count = allResponses.length - correct_count
        const score_percent = (correct_count / allResponses.length) * 100

        const errors: ExamAttemptErrorItem[] = allResponses
          .filter((r) => !r.is_correct)
          .map((r) => ({
            question_id: r.question_id,
            category_id: r.category_id,
            user_option_index: r.user_option_index,
            correct_option_index: r.correct_option_index,
            user_option_text: r.user_option_text,
            correct_option_text: r.correct_option_text,
            question_text: r.question_text,
          }))

        const errorCounts = new Map<string, number>()
        for (const e of errors) {
          errorCounts.set(e.category_id, (errorCounts.get(e.category_id) ?? 0) + 1)
        }

        const weak_topics = Array.from(errorCounts.entries())
          .map(([category_id, error_count]) => {
            const catName = catalog.categories.find((c) => c.id === category_id)?.name ?? category_id
            return { category_id, category_name: catName, error_count }
          })
          .sort((a, b) => b.error_count - a.error_count)

        const attempt_no = await getNextAttemptNo(fio.trim(), session.exam_type)
        const passed = score_percent >= PASS_PERCENT

        await saveExamAttempt({
          fio: fio.trim(),
          exam_type: session.exam_type,
          attempt_no,
          started_at,
          finished_at,
          duration_seconds,
          score_percent,
          correct_count,
          wrong_count,
          passed,
          question_count: session.question_count,
          errors,
          weak_topics,
        })

        setSession((s) => (s ? { ...s, saved: true, finished: true } : s))
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Не удалось сохранить попытку.'
        setSaveError(msg)
      } finally {
        setSaving(false)
      }
    })()
  }, [session, catalog, fio])

  async function start(type: ExamType) {
    if (!catalog) return
    const trimmed = fio.trim()
    if (!trimmed || trimmed.split(/\s+/).length < 2) {
      alert('Введите Имя Фамилия (минимум два слова).')
      return
    }

    const n = Math.min(Math.max(5, examQuestionCount), catalog.questions.length)
    const base = type === 'exam' ? examSeconds : trialSeconds
    const duration_seconds = Math.max(180, Math.round((base * n) / 20))
    const questions = buildSessionQuestions(n)
    if (questions.length === 0) {
      alert('Недостаточно вопросов в базе.')
      return
    }

    setSelectedOptionIndex(null)
    setSession({
      exam_type: type,
      questions,
      idx: 0,
      responses: [],
      started_at: Date.now(),
      duration_seconds,
      question_count: questions.length,
      finished: false,
      remaining_seconds: duration_seconds,
    })
  }

  function currentAnswered() {
    if (!current) return false
    return selectedOptionIndex !== null
  }

  function nextQuestion() {
    if (!session || !current || selectedOptionIndex === null) return

    const selectedAnswer = displayAnswers.find((a) => a.option_index === selectedOptionIndex)
    const correctAnswer = current.answers.find((a) => a.is_correct)

    const is_correct = selectedAnswer?.is_correct ?? false
    const response: ExamResponse = {
      question_id: current.question.id,
      category_id: current.question.category_id,
      user_option_index: selectedAnswer?.option_index ?? selectedOptionIndex,
      user_option_text: selectedAnswer?.option_text ?? '',
      correct_option_index: correctAnswer?.option_index ?? current.correctOptionIndex,
      correct_option_text: correctAnswer?.option_text ?? '',
      question_text: current.question.question_text,
      is_correct,
    }

    const alreadyAnswered = session.responses.some((r) => r.question_id === response.question_id)
    const responses = alreadyAnswered ? session.responses : [...session.responses, response]
    setSession((s) => {
      if (!s) return s
      const isLast = s.idx >= s.questions.length - 1
      if (isLast) return { ...s, responses, finished: true }
      return { ...s, responses, idx: s.idx + 1 }
    })
    setSelectedOptionIndex(null)
  }

  const finishedState = session?.finished ? session : null

  const summary = useMemo(() => {
    if (!finishedState) return null
    const total = finishedState.questions.length
    const correct = finishedState.responses.filter((r) => r.is_correct).length
    const wrong = total - correct
    const score_percent = total === 0 ? 0 : (correct / total) * 100
    const passed = score_percent >= PASS_PERCENT
    const level = ratingLevel(score_percent)

    return { total, correct, wrong, score_percent, passed, level }
  }, [finishedState])

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/60">
        Загрузка базы вопросов...
      </div>
    )
  }

  if (!catalog) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="font-semibold text-slate-900 dark:text-slate-100">Не удалось загрузить базу вопросов.</div>
        <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {loadError ?? 'Проверьте параметры Supabase в `.env` и перезапустите dev-сервер.'}
        </div>
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Supabase configured: <span className="font-semibold">{String(supabaseConfigured)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!session && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Экзамен</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Введите имя и фамилию. Далее экзамен начнётся случайным набором вопросов.
          </p>

          <label className="mt-5 block">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Имя Фамилия</div>
            <input
              value={fio}
              onChange={(e) => setFio(e.target.value)}
              placeholder="Иванов Иван"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Сколько вопросов</div>
              <div className="text-lg font-black tabular-nums text-violet-700 dark:text-violet-400">{examQuestionCount}</div>
            </div>
            <input
              type="range"
              min={examCountBounds.min}
              max={examCountBounds.max}
              step={1}
              value={examQuestionCount}
              onChange={(e) => setExamQuestionCount(Number(e.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-violet-600"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {[10, 20, 30, 50].map((preset) =>
                preset <= examCountBounds.max ? (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setExamQuestionCount(preset)}
                    className={
                      examQuestionCount === preset
                        ? 'rounded-xl border border-violet-500 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 dark:bg-violet-500/15 dark:text-violet-200'
                        : 'rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200'
                    }
                  >
                    {preset}
                  </button>
                ) : null,
              )}
              <button
                type="button"
                onClick={() => setExamQuestionCount(examCountBounds.max)}
                className={
                  examQuestionCount === examCountBounds.max
                    ? 'rounded-xl border border-violet-500 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 dark:bg-violet-500/15 dark:text-violet-200'
                    : 'rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200'
                }
              >
                Макс. ({examCountBounds.max})
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
              {mixedCompositionHint} Таймер от 3 минут.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => start('exam')}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900"
              disabled={!fio.trim()}
            >
              Начать экзамен ({examQuestionCount} вопросов)
            </button>
            <button
              type="button"
              onClick={() => start('trial')}
              className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700"
              disabled={!fio.trim()}
            >
              Начать пробную аттестацию
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
            Проходной балл: <span className="font-semibold">70%</span>
          </div>
        </div>
      )}

      {session && current && !session.finished && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                {session.exam_type === 'exam' ? 'Экзамен' : 'Пробная аттестация'}
              </div>
              <h2 className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                Вопрос {session.idx + 1} из {session.questions.length}
              </h2>
            </div>

            <div className="text-right">
              <div className="text-sm text-slate-600 dark:text-slate-300">Таймер</div>
              <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                {formatTime(session.remaining_seconds)}
              </div>
            </div>
          </div>

          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
            <div
              className="h-full bg-violet-600 transition-[width] duration-300"
              style={{ width: `${((session.idx + 1) / session.questions.length) * 100}%` }}
            />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Вопрос</div>
            <div className="mt-2 text-base font-medium text-slate-900 dark:text-slate-100">
              {current.question.question_text}
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {displayAnswers.map((a, i) => {
              const checked = selectedOptionIndex === a.option_index
              return (
                <label
                  key={`${a.id}-${i}`}
                  className={[
                    'cursor-pointer select-none rounded-2xl border px-4 py-3 transition-colors',
                    checked
                      ? 'border-violet-500 bg-violet-50 dark:border-violet-400 dark:bg-violet-400/10'
                      : 'border-slate-200 bg-white/70 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/30 dark:hover:bg-slate-900/60',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Вариант {String.fromCharCode(65 + i)}
                    </div>
                    {checked && <div className="text-xs font-semibold text-violet-700 dark:text-violet-300">Выбрано</div>}
                  </div>
                  <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">{a.option_text}</div>
                  <input
                    type="radio"
                    name="exam_option"
                    checked={checked}
                    onChange={() => setSelectedOptionIndex(a.option_index)}
                    className="hidden"
                  />
                </label>
              )
            })}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">Подсказок нет. Результат — в конце.</div>
            <button
              type="button"
              onClick={nextQuestion}
              disabled={!currentAnswered()}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Далее
            </button>
          </div>
        </div>
      )}

      {session && session.finished && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Результат</h2>
          {summary ? (
            <>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-sm text-slate-600 dark:text-slate-300">Процент</div>
                  <div className={`mt-1 text-3xl font-black ${summary.level.tone}`}>{formatPercent(summary.score_percent)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-sm text-slate-600 dark:text-slate-300">Правильных</div>
                  <div className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">{summary.correct}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="text-sm text-slate-600 dark:text-slate-300">Ошибок</div>
                  <div className="mt-1 text-3xl font-black text-rose-700 dark:text-rose-300">{summary.wrong}</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    Статус: <span className="font-bold">{summary.passed ? 'СДАЛ' : 'НЕ СДАЛ'}</span>
                  </div>
                  <div className="text-sm font-semibold text-violet-700 dark:text-violet-400">{summary.level.name}</div>
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {saving
                    ? 'Сохраняем результат...'
                    : session.saved
                      ? 'Результат сохранён в Supabase.'
                      : saveError
                        ? `Ошибка сохранения: ${saveError}`
                        : 'Не удалось сохранить попытку.'}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900/60"
                >
                  На главную
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSession(null)
                    setSelectedOptionIndex(null)
                    setSaving(false)
                    setSaveError(null)
                  }}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  Пройти ещё раз
                </button>
              </div>
            </>
          ) : (
            <div className="mt-4">Идёт подсчёт результата...</div>
          )}
        </div>
      )}
    </div>
  )
}

