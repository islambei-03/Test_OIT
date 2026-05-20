import type { Category, QuestionAnswer } from './db'

export const PROFILE_NAME = 'Профильные'
export const PROFILE_CATEGORY_PREFIX = `${PROFILE_NAME} · `

export const TEST_VND_NAME = 'Тест ВНД'
export const TEST_VND_CATEGORY_PREFIX = `${TEST_VND_NAME} · `

export const MIXED_TOPIC_ID = '__mixed__'
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

/** Вопросы не по основам ИТ (для смешанного экзамена: ⅓ служебные + ⅔ ИТ) */
export function isServiceDocCategoryName(name: string) {
  return isProfileCategoryName(name) || isVndCategoryName(name)
}

export function splitServiceItCounts(total: number) {
  const safe = Math.max(1, total)
  const service = Math.floor(safe / 3)
  return { service, it: safe - service }
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
  const { service, it } = splitServiceItCounts(n)
  const profilePart = Math.floor(service / 2)
  const vndPart = service - profilePart
  return `Из ${n} ${pluralRuQuestions(n)}: ~${profilePart} «${PROFILE_NAME}», ~${vndPart} «${TEST_VND_NAME}», ~${it} по основам ИТ (всего служебных ≈ ⅓).`
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

/** Смешанная выборка: ~⅓ (Профильные + Тест ВНД) + ~⅔ ИТ */
export function pickMixedQuestions(
  questions: QuestionWithAnswers[],
  categories: Category[],
  total: number,
): QuestionWithAnswers[] {
  const nameById = new Map(categories.map((c) => [c.id, c.name]))
  const profile = questions.filter((q) => isProfileCategoryName(nameById.get(q.category_id) ?? ''))
  const vnd = questions.filter((q) => isVndCategoryName(nameById.get(q.category_id) ?? ''))
  const it = questions.filter((q) => !isServiceDocCategoryName(nameById.get(q.category_id) ?? ''))

  const { service: wantService, it: wantIt } = splitServiceItCounts(total)
  const wantProfile = Math.floor(wantService / 2)
  const wantVnd = wantService - wantProfile

  let combined = [
    ...pickRandom(profile, wantProfile),
    ...pickRandom(vnd, wantVnd),
    ...pickRandom(it, wantIt),
  ]

  if (combined.length < total) {
    const used = new Set(combined.map((q) => q.id))
    const rest = shuffle([...profile, ...vnd, ...it]).filter((q) => !used.has(q.id))
    combined = [...combined, ...rest.slice(0, total - combined.length)]
  }

  return shuffle(combined).slice(0, total)
}
