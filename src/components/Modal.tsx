import React, { useEffect } from 'react'

export default function Modal(props: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const { open, title, onClose, children, footer } = props

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950/80">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200"
          >
            Закрыть
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer ? <div className="border-t border-slate-200 p-4 dark:border-slate-800">{footer}</div> : null}
      </div>
    </div>
  )
}

