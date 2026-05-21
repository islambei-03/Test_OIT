export type SortDir = 'asc' | 'desc'

export function toggleSortKey<T extends string>(currentKey: T, currentDir: SortDir, nextKey: T): { key: T; dir: SortDir } {
  if (currentKey === nextKey) return { key: nextKey, dir: currentDir === 'asc' ? 'desc' : 'asc' }
  return { key: nextKey, dir: 'asc' }
}

export function compareText(a: string, b: string, dir: SortDir) {
  const r = a.localeCompare(b, 'ru', { sensitivity: 'base' })
  return dir === 'asc' ? r : -r
}

export function compareNumber(a: number, b: number, dir: SortDir) {
  return dir === 'asc' ? a - b : b - a
}

export function compareBool(a: boolean, b: boolean, dir: SortDir) {
  const av = a ? 1 : 0
  const bv = b ? 1 : 0
  return dir === 'asc' ? av - bv : bv - av
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total,
    totalPages,
    page: safePage,
    pageSize,
    rangeFrom: total === 0 ? 0 : start + 1,
    rangeTo: Math.min(start + pageSize, total),
  }
}

export function normalizeSearch(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}
