import type { Category, QuestionAnswer } from './db'

export const PROFILE_NAME = 'Профильные'
export const PROFILE_CATEGORY_PREFIX = `${PROFILE_NAME} · `

export const TEST_VND_NAME = 'Тест ВНД'
export const TEST_VND_CATEGORY_PREFIX = `${TEST_VND_NAME} · `

export const MIXED_TOPIC_ID = '__mixed__'
export const MIXED_TOPIC_LABEL = 'Смешанный 1/3 по ВНД и 2/3 по ИТ и Профильные'
export const PROFILE_ALL_TOPIC_ID = '__profile_all__'
export const VND_ALL_TOPIC_ID = '__vnd_all__'

export type QuestionWithAnswers = {
  id: string
  category_id: string
  question_text: string
  explanation: string | null
  answers: QuestionAnswer[]
}

export function isProfileCategoryName(name: string) {
  const n = name.trim()
  return n === PROFILE_NAME || n.startsWith(PROFILE_CATEGORY_PREFIX) || n.startsWith(`${PROFILE_NAME}:`)
}

export function isVndCategoryName(name: string) {
  const n = name.trim()
  if (isProfileCategoryName(n)) return false
  return n === TEST_VND_NAME || n.startsWith(TEST_VND_CATEGORY_PREFIX) || n.startsWith(`${TEST_VND_NAME}:`)
}

/** Вопросы не по основам ИТ (профильные документы и «Тест ВНД») */
export function isServiceDocCategoryName(name: string) {
  return isProfileCategoryName(name) || isVndCategoryName(name)
}

/** Смешанный режим: ⅓ «Тест ВНД», ⅔ — «Профильные» + основы ИТ (поровну внутри ⅔). */
export function splitMixedCounts(total: number) {
  const safe = Math.max(1, total)
  const vnd = Math.floor(safe / 3)
  const rest = safe - vnd
  const profile = Math.floor(rest / 2)
  const it = rest - profile
  return { vnd, profile, it }
}

export function pluralRuQuestions(n: number) {
  const n10 = Math.abs(n) % 10
  const n100 = Math.abs(n) % 100
  if (n100 >= 11 && n100 <= 14) return 'вопросов'
  if (n10 === 1) return 'вопрос'
  if (n10 >= 2 && n10 <= 4) return 'вопроса'
  return 'вопросов'
}

export function describeMixedComposition(total: number) {
  const n = Math.max(1, total)
  const { vnd, profile, it } = splitMixedCounts(n)
  return `Из ${n} ${pluralRuQuestions(n)}: ~${vnd} «${TEST_VND_NAME}», ~${profile} «${PROFILE_NAME}», ~${it} по основам ИТ.`
}

function shuffle<T>(arr: T[]) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function pickRandom<T>(arr: T[], count: number) {
  return shuffle(arr).slice(0, Math.min(count, arr.length))
}

export function partitionQuestionsByPool(questions: QuestionWithAnswers[], categories: Category[]) {
  const nameById = new Map(categories.map((c) => [c.id, c.name]))
  const service: QuestionWithAnswers[] = []
  const it: QuestionWithAnswers[] = []
  for (const q of questions) {
    const name = nameById.get(q.category_id) ?? ''
    if (isServiceDocCategoryName(name)) service.push(q)
    else it.push(q)
  }
  return { service, it }
}

export function filterProfileQuestions(questions: QuestionWithAnswers[], categories: Category[]) {
  const nameById = new Map(categories.map((c) => [c.id, c.name]))
  return questions.filter((q) => isProfileCategoryName(nameById.get(q.category_id) ?? ''))
}

export function filterVndQuestions(questions: QuestionWithAnswers[], categories: Category[]) {
  const nameById = new Map(categories.map((c) => [c.id, c.name]))
  return questions.filter((q) => isVndCategoryName(nameById.get(q.category_id) ?? ''))
}

export function filterQuestionsByTopicId(
  questions: QuestionWithAnswers[],
  categories: Category[],
  topicId: string,
): QuestionWithAnswers[] {
  if (topicId === MIXED_TOPIC_ID) return questions
  if (topicId === PROFILE_ALL_TOPIC_ID) return filterProfileQuestions(questions, categories)
  if (topicId === VND_ALL_TOPIC_ID) return filterVndQuestions(questions, categories)
  return questions.filter((q) => q.category_id === topicId)
}

export function resolveTopicLabel(categories: Category[], topicId: string): string {
  if (topicId === MIXED_TOPIC_ID) return MIXED_TOPIC_LABEL
  if (topicId === PROFILE_ALL_TOPIC_ID) return PROFILE_NAME
  if (topicId === VND_ALL_TOPIC_ID) return TEST_VND_NAME
  return categories.find((c) => c.id === topicId)?.name ?? topicId
}

export function questionHasAnswers(q: QuestionWithAnswers) {
  return (
    Array.isArray(q.answers) &&
    q.answers.length >= 4 &&
    q.answers.some((a) => a.is_correct) &&
    q.answers.every((a) => String(a.option_text ?? '').trim().length > 0)
  )
}

/** Случайная выборка вопросов по теме (смешанная или одна категория). */
export function pickTopicQuestions(
  questions: QuestionWithAnswers[],
  categories: Category[],
  topicId: string,
  count: number,
): QuestionWithAnswers[] {
  const valid = questions.filter(questionHasAnswers)
  if (topicId === MIXED_TOPIC_ID) {
    return pickMixedQuestions(valid, categories, count)
  }
  const pool = filterQuestionsByTopicId(valid, categories, topicId)
  const n = Math.min(Math.max(1, count), pool.length)
  return shuffle([...pool]).slice(0, n)
}

/** Смешанная выборка: ~⅓ «Тест ВНД», ~⅔ «Профильные» + основы ИТ */
export function pickMixedQuestions(
  questions: QuestionWithAnswers[],
  categories: Category[],
  total: number,
): QuestionWithAnswers[] {
  const nameById = new Map(categories.map((c) => [c.id, c.name]))
  const profile = questions.filter((q) => isProfileCategoryName(nameById.get(q.category_id) ?? ''))
  const vnd = questions.filter((q) => isVndCategoryName(nameById.get(q.category_id) ?? ''))
  const it = questions.filter((q) => !isServiceDocCategoryName(nameById.get(q.category_id) ?? ''))

  const { vnd: wantVnd, profile: wantProfile, it: wantIt } = splitMixedCounts(total)

  let combined = [
    ...pickRandom(vnd, wantVnd),
    ...pickRandom(profile, wantProfile),
    ...pickRandom(it, wantIt),
  ]

  if (combined.length < total) {
    const used = new Set(combined.map((q) => q.id))
    const rest = shuffle([...profile, ...vnd, ...it]).filter((q) => !used.has(q.id))
    combined = [...combined, ...rest.slice(0, total - combined.length)]
  }

  return shuffle(combined).slice(0, total)
}
