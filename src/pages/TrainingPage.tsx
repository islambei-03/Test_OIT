import { useEffect, useMemo, useState } from 'react'
import type { Category, Question, QuestionAnswer } from '../lib/db'
import { fetchCatalog } from '../lib/db'
import { MIXED_TOPIC_ID, isVndCategoryName, pickMixedQuestions, splitVndItCounts } from '../lib/questionPools'
import { Link } from 'react-router-dom'
import { supabaseConfigured } from '../lib/supabaseClient'

type TrainingSessionQuestion = {
  question: Question
  answers: QuestionAnswer[] // порядок как в БД; на экране перемешиваются отдельно
  correctOptionIndex: number // option_index from DB
}

const TOPIC_STORAGE_PREFIX = 'repeat_errors_v1:'

function getLocalWrongIds(topicId: string): string[] {
  try {
    const raw = localStorage.getItem(`${TOPIC_STORAGE_PREFIX}${topicId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x) => typeof x === 'string')
  } catch {
    return []
  }
}

function saveLocalWrongIds(topicId: string, wrongIds: string[]) {
  localStorage.setItem(`${TOPIC_STORAGE_PREFIX}${topicId}`, JSON.stringify(wrongIds))
}

function shuffle<T>(arr: T[]) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function ratingLevel(percent: number) {
  if (percent < 50) return { name: 'Новичок', tone: 'text-slate-600 dark:text-slate-300' }
  if (percent < 80) return { name: 'Уверенный', tone: 'text-violet-700 dark:text-violet-400' }
  return { name: 'Эксперт', tone: 'text-emerald-700 dark:text-emerald-400' }
}

function formatPercent(p: number) {
  if (!Number.isFinite(p)) return '0%'
  return `${Math.round(p)}%`
}

export default function TrainingPage() {
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState<{ categories: Category[]; questions: (Question & { answers: QuestionAnswer[] })[] } | null>(
    null,
  )
  const [loadError, setLoadError] = useState<string | null>(null)

  const [topicId, setTopicId] = useState<string>('')
  const [trainingQuestionCount, setTrainingQuestionCount] = useState(20)
  const [repeatErrors, setRepeatErrors] = useState(false)
  const [randomOrder, setRandomOrder] = useState(true)

  const [session, setSession] = useState<{
    topic: Category
    questions: TrainingSessionQuestion[]
    idx: number
    correctCount: number
    wrongCount: number
    finished: boolean
  } | null>(null)

  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const c = await fetchCatalog()
        if (!mounted) return
        setCatalog(c)
        if (c.categories.length > 0) setTopicId(MIXED_TOPIC_ID)
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

  const topic = useMemo(() => {
    if (!catalog) return null
    if (topicId === MIXED_TOPIC_ID) {
      return { id: MIXED_TOPIC_ID, name: 'Смешанный (⅓ ВНД + ⅔ ИТ)' } satisfies Category
    }
    return catalog.categories.find((c) => c.id === topicId) ?? null
  }, [catalog, topicId])

  const isMixedTopic = topicId === MIXED_TOPIC_ID

  const filteredQuestions = useMemo(() => {
    if (!catalog || !topicId) return []
    if (isMixedTopic) return catalog.questions
    return catalog.questions.filter((q) => q.category_id === topicId)
  }, [catalog, topicId, isMixedTopic])

  const mixPreview = useMemo(() => {
    const n = Math.min(trainingQuestionCount, filteredQuestions.length || trainingQuestionCount)
    return splitVndItCounts(n)
  }, [trainingQuestionCount, filteredQuestions.length])

  const vndCategories = useMemo(
    () => (catalog ? catalog.categories.filter((c) => isVndCategoryName(c.name)) : []),
    [catalog],
  )
  const itCategories = useMemo(
    () => (catalog ? catalog.categories.filter((c) => !isVndCategoryName(c.name)) : []),
    [catalog],
  )

  const trainingCountBounds = useMemo(() => {
    const n = catalog?.questions.length ?? 0
    const max = Math.max(5, Math.min(100, n || 5))
    const min = Math.min(5, max)
    return { min: min || 5, max }
  }, [catalog])

  useEffect(() => {
    setTrainingQuestionCount((c) => Math.min(Math.max(c, trainingCountBounds.min), trainingCountBounds.max))
  }, [trainingCountBounds])

  function buildSessionQuestions(): TrainingSessionQuestion[] {
    if (!topic || !catalog) return []

    const length = Math.min(Math.max(5, trainingQuestionCount), catalog.questions.length)

    if (isMixedTopic) {
      const picked = pickMixedQuestions(catalog.questions, catalog.categories, length)
      return picked.map((q) => {
        const correct = q.answers.find((a) => a.is_correct)
        return {
          question: q,
          answers: [...q.answers],
          correctOptionIndex: correct?.option_index ?? 0,
        }
      })
    }

    const topicPool = filteredQuestions
    const allPool = catalog.questions
    const allWrongIds = repeatErrors ? getLocalWrongIds(topic.id) : []
    const wrongSet = new Set(allWrongIds)

    const wrongFirst = topicPool
      .filter((q) => wrongSet.has(q.id))
      .map((q) => {
        const correct = q.answers.find((a) => a.is_correct)
        const correctOptionIndex = correct?.option_index ?? 0
        return { question: q, answers: [...q.answers], correctOptionIndex } satisfies TrainingSessionQuestion
      })

    const remainingTopic = topicPool.filter((q) => !wrongSet.has(q.id))
    const shuffledRemainingTopic = randomOrder ? shuffle(remainingTopic) : remainingTopic

    const combined = [...wrongFirst]
    for (const q of shuffledRemainingTopic) {
      if (combined.length >= length) break
      const correct = q.answers.find((a) => a.is_correct)
      combined.push({
        question: q,
        answers: [...q.answers],
        correctOptionIndex: correct?.option_index ?? 0,
      })
    }

    // если выбранной темы недостаточно — добираем случайными вопросами со всей базы
    if (combined.length < length) {
      const existingIds = new Set(combined.map((x) => x.question.id))
      const toFill = shuffle(allPool.filter((q) => !existingIds.has(q.id))).slice(0, length - combined.length)
      for (const q of toFill) {
        const correct = q.answers.find((a) => a.is_correct)
        combined.push({
          question: q,
          answers: [...q.answers],
          correctOptionIndex: correct?.option_index ?? 0,
        })
      }
    }

    let final = combined
    if (randomOrder && final.length > 1) final = shuffle(final)
    return final.slice(0, length)
  }

  function startTraining() {
    if (!topic || !catalog) return
    const questions = buildSessionQuestions()
    if (questions.length === 0) return
    setSession({
      topic,
      questions,
      idx: 0,
      correctCount: 0,
      wrongCount: 0,
      finished: false,
    })
    setSelectedOptionIndex(null)
    setSubmitted(false)
  }

  const current = session ? session.questions[session.idx] : null

  const displayAnswers = useMemo(() => {
    if (!current) return []
    return shuffle([...current.answers])
  }, [session?.idx, current?.question.id])

  const percent = session
    ? session.questions.length === 0
      ? 0
      : (session.correctCount / session.questions.length) * 100
    : 0

  function submitAnswer() {
    if (!session || !current || selectedOptionIndex === null) return

    const isCorrect = selectedOptionIndex === current.correctOptionIndex
    setSubmitted(true)

    const nextCorrect = isCorrect ? session.correctCount + 1 : session.correctCount
    const nextWrong = isCorrect ? session.wrongCount : session.wrongCount + 1

    // сохраним ошибку для режима повторения
    if (!isCorrect) {
      const prevWrong = getLocalWrongIds(session.topic.id)
      const set = new Set(prevWrong)
      set.add(current.question.id)
      saveLocalWrongIds(session.topic.id, Array.from(set))
    }

    setSession((s) =>
      s
        ? {
            ...s,
            correctCount: nextCorrect,
            wrongCount: nextWrong,
          }
        : s,
    )
  }

  function nextQuestion() {
    if (!session) return
    const isLast = session.idx >= session.questions.length - 1
    if (isLast) {
      setSession((s) => (s ? { ...s, finished: true } : s))
      return
    }
    setSession((s) => (s ? { ...s, idx: s.idx + 1 } : s))
    setSelectedOptionIndex(null)
    setSubmitted(false)
  }

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

  const level = ratingLevel(percent)

  return (
    <div className="space-y-6">
      {!session && (
        <>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Тренировка</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Выберите тему и режим. В ответе будут сразу показаны правильный вариант и пояснение.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Тема</div>
                <select
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value={MIXED_TOPIC_ID}>Смешанный (⅓ ВНД + ⅔ ИТ)</option>
                  {vndCategories.length > 0 ? (
                    <optgroup label="ВНД">
                      {vndCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name.replace(/^ВНД:\s*/i, '')}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {itCategories.length > 0 ? (
                    <optgroup label="Основы ИТ">
                      {itCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </label>

              <div className="space-y-2 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Сколько вопросов в сессии</div>
                  <div className="text-lg font-black tabular-nums text-violet-700 dark:text-violet-400">{trainingQuestionCount}</div>
                </div>
                <input
                  type="range"
                  min={trainingCountBounds.min}
                  max={trainingCountBounds.max}
                  step={1}
                  value={trainingQuestionCount}
                  onChange={(e) => setTrainingQuestionCount(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer accent-violet-600"
                />
                <div className="flex flex-wrap gap-2">
                  {[10, 20, 30, 50].map((preset) =>
                    preset <= trainingCountBounds.max ? (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTrainingQuestionCount(preset)}
                        className={
                          trainingQuestionCount === preset
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
                    onClick={() =>
                      setTrainingQuestionCount(Math.min(filteredQuestions.length || trainingCountBounds.max, trainingCountBounds.max))
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
                    title="Взять не больше, чем вопросов в выбранной теме"
                  >
                    Вся тема ({filteredQuestions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrainingQuestionCount(trainingCountBounds.max)}
                    className={
                      trainingQuestionCount === trainingCountBounds.max
                        ? 'rounded-xl border border-violet-500 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 dark:bg-violet-500/15 dark:text-violet-200'
                        : 'rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200'
                    }
                  >
                    Макс. ({trainingCountBounds.max})
                  </button>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                  {isMixedTopic
                    ? `Смешанный режим: ~${mixPreview.vnd} вопросов ВНД и ~${mixPreview.it} по основам ИТ.`
                    : 'Если в теме мало вопросов, недостающие добираются из всей базы.'}
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Режимы</div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                    <input type="checkbox" checked={repeatErrors} onChange={(e) => setRepeatErrors(e.target.checked)} />
                    Повторить ошибки
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                    <input type="checkbox" checked={randomOrder} onChange={(e) => setRandomOrder(e.target.checked)} />
                    Случайная выдача
                  </label>
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={startTraining}
                  className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                  disabled={filteredQuestions.length === 0}
                >
                  Начать тренировку
                </button>
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Совет: режим “Повторить ошибки” запоминает ваши неправильные ответы на этом устройстве по выбранной теме.
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Подсказки и геймификация</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Новичок</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">&lt; 50%</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Уверенный</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">50% - 79%</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Эксперт</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">80%+</div>
              </div>
            </div>

            <div className="mt-4">
              <Link to="/exam" className="text-sm font-semibold text-violet-700 hover:underline dark:text-violet-400">
                Перейти к экзамену
              </Link>
            </div>
          </div>
        </>
      )}

      {session && current && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                {session.topic.name}
              </div>
              <h2 className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                Вопрос {session.idx + 1} из {session.questions.length}
              </h2>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-600 dark:text-slate-300">Прогресс</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatPercent(percent)}</div>
            </div>
          </div>

          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
            <div
              className="h-full bg-violet-600 transition-[width] duration-300"
              style={{ width: `${((session.idx + 1) / session.questions.length) * 100}%` }}
            />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Вопрос</div>
            <div className="mt-2 text-base font-medium text-slate-900 dark:text-slate-100">{current.question.question_text}</div>
          </div>

          <div className="mt-4 grid gap-3">
            {displayAnswers.map((a, i) => {
              const isSelected = selectedOptionIndex === a.option_index
              const isCorrect = a.is_correct
              const showCorrect = submitted && isCorrect
              const showWrong = submitted && isSelected && !isCorrect

              return (
                <button
                  key={`${a.id}-${i}`}
                  type="button"
                  onClick={() => {
                    if (submitted) return
                    setSelectedOptionIndex(a.option_index)
                  }}
                  className={[
                    'rounded-2xl border px-4 py-3 text-left transition-colors',
                    submitted
                      ? showCorrect
                        ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-400/10'
                        : showWrong
                          ? 'border-rose-500 bg-rose-50 dark:border-rose-400 dark:bg-rose-400/10'
                          : isSelected
                            ? 'border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/40'
                            : 'border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-900/40'
                      : isSelected
                        ? 'border-violet-500 bg-violet-50 dark:border-violet-400 dark:bg-violet-400/10'
                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-900',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Вариант {String.fromCharCode(65 + i)}
                    </div>
                    {submitted && isCorrect && <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Верно</div>}
                    {submitted && showWrong && <div className="text-xs font-semibold text-rose-700 dark:text-rose-300">Неверно</div>}
                  </div>
                  <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">{a.option_text}</div>
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {submitted ? (
                <>
                  {selectedOptionIndex === current.correctOptionIndex ? (
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">Правильно.</span>
                  ) : (
                    <span className="font-semibold text-rose-700 dark:text-rose-300">Неправильно.</span>
                  )}
                  <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    {(() => {
                      const correct = displayAnswers.find((a) => a.is_correct)
                      return (
                        <>
                          Верный ответ: <span className="font-semibold">{correct?.option_text}</span>
                        </>
                      )
                    })()}
                  </div>
                  {current.question.explanation && (
                    <div className="mt-2 rounded-xl border border-slate-200 bg-white/70 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
                      {current.question.explanation}
                    </div>
                  )}
                </>
              ) : (
                'Выберите вариант и нажмите “Проверить”.'
              )}
            </div>

            <div className="flex items-center gap-2">
              {!submitted ? (
                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={selectedOptionIndex === null}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  Проверить
                </button>
              ) : (
                <button
                  type="button"
                  onClick={nextQuestion}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  Следующий вопрос
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {session && session.finished && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Сессия завершена</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Правильных: {session.correctCount}. Ошибок: {session.wrongCount}.
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-600 dark:text-slate-300">Результат</div>
              <div className={`text-3xl font-black ${level.tone}`}>{formatPercent(percent)}</div>
              <div className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{level.name}</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setSession(null)
                setSelectedOptionIndex(null)
                setSubmitted(false)
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              Начать заново
            </button>
            <Link
              to="/exam"
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Перейти к экзамену
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

