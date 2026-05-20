import type { Category, QuestionAnswer } from './db'

export const VND_CATEGORY_PREFIX = 'ВНД:'
export const MIXED_TOPIC_ID = '__mixed__'

export type QuestionWithAnswers = {
  id: string
  category_id: string
  question_text: string
  explanation: string | null
  answers: QuestionAnswer[]
}

export function isVndCategoryName(name: string) {
  return name.trim().startsWith(VND_CATEGORY_PREFIX)
}

/** Доля ВНД ≈ 1/3, основы ИТ ≈ 2/3 (15 → 5 + 10). */
export function splitVndItCounts(total: number) {
  const safe = Math.max(1, total)
  const vnd = Math.floor(safe / 3)
  return { vnd, it: safe - vnd }
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

/** Смешанная выборка: ~⅓ ВНД + ~⅔ ИТ; при нехватке добираем из другого пула. */
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
