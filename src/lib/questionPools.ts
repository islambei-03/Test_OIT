import type { Category, QuestionAnswer } from './db'

/** Название блока вопросов ВНД в интерфейсе и префикс категорий в БД */
export const TEST_VND_NAME = 'Тест ВНД'
export const TEST_VND_CATEGORY_PREFIX = `${TEST_VND_NAME} · `
export const MIXED_TOPIC_ID = '__mixed__'
export const VND_ALL_TOPIC_ID = '__vnd_all__'

export type QuestionWithAnswers = {
  id: string
  category_id: string
  question_text: string
  explanation: string | null
  answers: QuestionAnswer[]
}

export function isVndCategoryName(name: string) {
  const n = name.trim()
  return (
    n === TEST_VND_NAME ||
    n.startsWith(TEST_VND_CATEGORY_PREFIX) ||
    n.startsWith(`${TEST_VND_NAME}:`) ||
    n.startsWith('ВНД:') // старые категории до переимпорта
  )
}

/** Доля «Тест ВНД» ≈ 1/3, основы ИТ ≈ 2/3 (15 → 5 + 10). */
export function splitVndItCounts(total: number) {
  const safe = Math.max(1, total)
  const vnd = Math.floor(safe / 3)
  return { vnd, it: safe - vnd }
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
  const { vnd, it } = splitVndItCounts(n)
  return `Из ${n} ${pluralRuQuestions(n)}: ${vnd} ${pluralRuQuestions(vnd)} по «${TEST_VND_NAME}» и ${it} ${pluralRuQuestions(it)} по основам ИТ. Пропорция ≈ ⅓ и ⅔.`
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

export function partitionQuestionsByPool(
  questions: QuestionWithAnswers[],
  categories: Category[],
) {
  const nameById = new Map(categories.map((c) => [c.id, c.name]))
  const vnd: QuestionWithAnswers[] = []
  const it: QuestionWithAnswers[] = []
  for (const q of questions) {
    const name = nameById.get(q.category_id) ?? ''
    if (isVndCategoryName(name)) vnd.push(q)
    else it.push(q)
  }
  return { vnd, it }
}

export function filterVndQuestions(questions: QuestionWithAnswers[], categories: Category[]) {
  const nameById = new Map(categories.map((c) => [c.id, c.name]))
  return questions.filter((q) => isVndCategoryName(nameById.get(q.category_id) ?? ''))
}

/** Смешанная выборка: ~⅓ Тест ВНД + ~⅔ ИТ */
export function pickMixedQuestions(
  questions: QuestionWithAnswers[],
  categories: Category[],
  total: number,
): QuestionWithAnswers[] {
  const { vnd, it } = partitionQuestionsByPool(questions, categories)
  const { vnd: wantVnd, it: wantIt } = splitVndItCounts(total)

  let pickedVnd = pickRandom(vnd, wantVnd)
  let pickedIt = pickRandom(it, wantIt)

  let combined = [...pickedVnd, ...pickedIt]
  if (combined.length < total) {
    const used = new Set(combined.map((q) => q.id))
    const rest = shuffle([...vnd, ...it]).filter((q) => !used.has(q.id))
    combined = [...combined, ...rest.slice(0, total - combined.length)]
  }

  return shuffle(combined).slice(0, total)
}
