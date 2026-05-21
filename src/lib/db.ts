import { PostgrestError } from '@supabase/supabase-js'
import { requireSupabase } from './supabaseClient'

export type Category = { id: string; name: string }

export type QuestionAnswer = {
  id: string
  question_id: string
  option_index: number
  option_text: string
  is_correct: boolean
}

export type Question = {
  id: string
  category_id: string
  question_text: string
  explanation: string | null
}

export type QuestionWithAnswers = Question & { answers: QuestionAnswer[] }

function toAppError(prefix: string, err: PostgrestError | null) {
  if (!err) return null
  return new Error(`${prefix}: ${err.message}`)
}

const PAGE_SIZE = 1000

/** PostgREST по умолчанию отдаёт не больше 1000 строк — подгружаем всё постранично. */
async function fetchAllRows<T>(
  table: 'questions' | 'exam_answers',
  select: string,
  orderBy?: { column: string; ascending?: boolean },
): Promise<T[]> {
  const supabase = requireSupabase()
  const rows: T[] = []
  let from = 0

  while (true) {
    let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1)
    if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
    const { data, error } = await query
    const err = toAppError(table, error)
    if (err) throw err
    const chunk = (data ?? []) as T[]
    rows.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

export async function fetchCatalog(): Promise<{
  categories: Category[]
  questions: QuestionWithAnswers[]
}> {
  const supabase = requireSupabase()
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name')
    .order('name', { ascending: true })

  const categoriesErr = toAppError('categories', categoriesError)
  if (categoriesErr) throw categoriesErr

  const questionsRaw = await fetchAllRows<Question>('questions', 'id, category_id, question_text, explanation', {
    column: 'id',
    ascending: true,
  })

  const answersRaw = await fetchAllRows<QuestionAnswer>(
    'exam_answers',
    'id, question_id, option_index, option_text, is_correct',
    { column: 'question_id', ascending: true },
  )

  const answerByQuestionId = new Map<string, QuestionAnswer[]>()
  for (const a of answersRaw ?? []) {
    const list = answerByQuestionId.get(a.question_id) ?? []
    list.push(a)
    answerByQuestionId.set(a.question_id, list)
  }

  const questions: QuestionWithAnswers[] = (questionsRaw ?? []).map((q: any) => {
    const answers = answerByQuestionId.get(q.id) ?? []
    // стабильная сортировка
    answers.sort((x, y) => x.option_index - y.option_index)
    return { ...q, answers }
  })

  return { categories: categories ?? [], questions }
}

export type ExamType = 'exam' | 'trial'

export type ExamAttemptErrorItem = {
  question_id: string
  category_id: string
  user_option_index: number
  correct_option_index: number
  user_option_text: string
  correct_option_text: string
  question_text: string
}

export type SaveExamAttemptInput = {
  fio: string
  exam_type: ExamType
  attempt_no: number
  started_at: string // ISO
  finished_at: string // ISO
  duration_seconds: number
  score_percent: number
  correct_count: number
  wrong_count: number
  passed: boolean
  question_count: number
  errors: ExamAttemptErrorItem[]
  weak_topics: { category_id: string; category_name: string; error_count: number }[]
}

export async function getNextAttemptNo(fio: string, exam_type: ExamType) {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('exam_attempts')
    .select('attempt_no')
    .eq('fio', fio)
    .eq('exam_type', exam_type)
    .order('attempt_no', { ascending: true })

  const err = toAppError('exam_attempts select', error)
  if (err) throw err

  return (data?.length ?? 0) + 1
}

export async function saveExamAttempt(input: SaveExamAttemptInput) {
  const supabase = requireSupabase()
  // supabase jsonb хранит массивы/объекты как есть
  const basePayload = {
    fio: input.fio,
    exam_type: input.exam_type,
    attempt_no: input.attempt_no,
    started_at: input.started_at,
    finished_at: input.finished_at,
    duration_seconds: input.duration_seconds,
    score_percent: input.score_percent,
    correct_count: input.correct_count,
    wrong_count: input.wrong_count,
    passed: input.passed,
    errors: input.errors,
    weak_topics: input.weak_topics,
  }

  // На старых БД может не быть колонки question_count.
  // Поэтому делаем попытку с question_count, а при ошибке — повторяем без неё (будет default).
  const { error } = await supabase.from('exam_attempts').insert({
    ...basePayload,
    question_count: input.question_count,
  })

  if (!error) return

  const msg = String(error.message ?? '')
  if (/question_count/i.test(msg)) {
    const { error: error2 } = await supabase.from('exam_attempts').insert(basePayload)
    const err2 = toAppError('exam_attempts insert', error2)
    if (err2) throw err2
    return
  }

  const err = toAppError('exam_attempts insert', error)
  if (err) throw err
}

export async function fetchExamAttempts() {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('exam_attempts')
    .select('*')
    .order('finished_at', { ascending: false })
    .limit(2000)

  const err = toAppError('exam_attempts select', error)
  if (err) throw err

  return data ?? []
}

export type QuestionDraftAnswer = {
  option_text: string
  is_correct: boolean
}

export type QuestionDraft = {
  category_id: string
  question_text: string
  explanation: string
  answers: ReadonlyArray<QuestionDraftAnswer> // ожидается длина 4
}

export async function createQuestion(draft: QuestionDraft) {
  const supabase = requireSupabase()
  if (!draft.answers || draft.answers.length !== 4) {
    throw new Error('answers должен содержать 4 варианта')
  }
  const { data: q, error: qErr } = await supabase
    .from('questions')
    .insert({
      category_id: draft.category_id,
      question_text: draft.question_text,
      explanation: draft.explanation,
    })
    .select('id')
    .single()

  const err = toAppError('questions insert', qErr)
  if (err) throw err
  if (!q?.id) throw new Error('Не удалось создать вопрос')

  const answersToInsert = draft.answers.map((a, idx) => ({
    question_id: q.id,
    option_index: idx,
    option_text: a.option_text,
    is_correct: a.is_correct,
  }))

  const { error: aErr } = await supabase.from('exam_answers').insert(answersToInsert)
  const aErrWrapped = toAppError('exam_answers insert', aErr)
  if (aErrWrapped) throw aErrWrapped

  return q.id as string
}

export async function updateQuestion(questionId: string, draft: QuestionDraft) {
  const supabase = requireSupabase()
  if (!draft.answers || draft.answers.length !== 4) {
    throw new Error('answers должен содержать 4 варианта')
  }
  const { error: qErr } = await supabase
    .from('questions')
    .update({
      category_id: draft.category_id,
      question_text: draft.question_text,
      explanation: draft.explanation,
    })
    .eq('id', questionId)

  const err = toAppError('questions update', qErr)
  if (err) throw err

  const { error: delErr } = await supabase.from('exam_answers').delete().eq('question_id', questionId)
  const delWrapped = toAppError('exam_answers delete', delErr)
  if (delWrapped) throw delWrapped

  const answersToInsert = draft.answers.map((a, idx) => ({
    question_id: questionId,
    option_index: idx,
    option_text: a.option_text,
    is_correct: a.is_correct,
  }))

  const { error: aErr } = await supabase.from('exam_answers').insert(answersToInsert)
  const aErrWrapped = toAppError('exam_answers insert', aErr)
  if (aErrWrapped) throw aErrWrapped
}

export async function deleteQuestion(questionId: string) {
  const supabase = requireSupabase()
  const { error: delAnswersErr } = await supabase.from('exam_answers').delete().eq('question_id', questionId)
  const delAnswersWrapped = toAppError('exam_answers delete', delAnswersErr)
  if (delAnswersWrapped) throw delAnswersWrapped

  const { error: delQErr } = await supabase.from('questions').delete().eq('id', questionId)
  const delQWrapped = toAppError('questions delete', delQErr)
  if (delQWrapped) throw delQWrapped
}

export async function createCategory(name: string) {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('categories')
    .upsert({ name }, { onConflict: 'name' })
    .select('id')
    .single()

  const err = toAppError('categories insert', error)
  if (err) throw err
  return data?.id as string | undefined
}

