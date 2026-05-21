import type { SortDir } from '../../lib/adminListUtils'

export default function SortableTh(props: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  className?: string
}) {
  const { label, active, dir, onClick, className = '' } = props
  return (
    <th className={`p-3 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 font-semibold text-slate-600 transition hover:text-violet-700 dark:text-slate-300 dark:hover:text-violet-300"
      >
        <span>{label}</span>
        <span className={`text-xs tabular-nums ${active ? 'text-violet-600 dark:text-violet-400' : 'opacity-35'}`}>
          {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  )
}
