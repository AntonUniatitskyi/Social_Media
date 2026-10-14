import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { iconBtn } from './cls'

export function Dialog({ open, onClose, title, children }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-sand bg-white p-0 text-stone-800 shadow-xl backdrop:bg-stone-900/40"
    >
      <div className="flex items-center justify-between border-b border-sand px-5 py-3">
        <h2 className="font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Закрити" className={iconBtn}>
          <X className="size-5" />
        </button>
      </div>
      <div className="px-5 py-4">{open && children}</div>
    </dialog>
  )
}