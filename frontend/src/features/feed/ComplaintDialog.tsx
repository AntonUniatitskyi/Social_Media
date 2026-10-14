import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../api/client'
import { fieldErrors } from '../auth/auth'
import { btnDark, btnSoft } from '../ui/cls'
import { Dialog } from '../ui/Dialog'

const REASONS = ['Спам', 'Образи або цькування', 'Недозволений контент', 'Шахрайство', 'Інше']

export function ComplaintDialog({ publicationId, onClose }: {
  publicationId: number | null
  onClose: () => void
}) {
  return (
    <Dialog open={publicationId !== null} onClose={onClose} title="Поскаржитися на публікацію">
      {publicationId !== null && <ComplaintForm publicationId={publicationId} onClose={onClose} />}
    </Dialog>
  )
}

function ComplaintForm({ publicationId, onClose }: { publicationId: number; onClose: () => void }) {
  const [reason, setReason] = useState(REASONS[0])
  const [text, setText] = useState('')

  const m = useMutation({
    mutationFn: () =>
      api('/complaints/', {
        method: 'POST',
        body: JSON.stringify({ publication: publicationId, reason, text: text.trim() }),
      }),
  })

  if (m.isSuccess) {
    return (
      <div className="space-y-4">
        <p>Дякуємо. Скаргу передано модераторам.</p>
        <button type="button" onClick={onClose} className={btnDark}>Закрити</button>
      </div>
    )
  }

  const errs = fieldErrors(m.error)
  const message =
    errs.non_field_errors ?? errs.publication ?? errs.reason ??
    (m.isError ? 'Не вдалося надіслати скаргу. Спробуйте ще раз.' : null)

  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate() }} className="space-y-4">
      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium">Причина</legend>
        {REASONS.map((r) => (
          <label key={r} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-sand/30">
            <input
              type="radio"
              name="reason"
              checked={reason === r}
              onChange={() => setReason(r)}
              className="accent-stone-900"
            />
            {r}
          </label>
        ))}
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Деталі (за бажанням)</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-xl border border-sand bg-white px-3.5 py-2.5 outline-none transition focus:border-clay focus:ring-[3px] focus:ring-clay/20"
        />
      </label>

      {message && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{message}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={btnSoft}>Скасувати</button>
        <button type="submit" disabled={m.isPending} className={btnDark}>
          {m.isPending ? 'Надсилаємо…' : 'Надіслати'}
        </button>
      </div>
    </form>
  )
}