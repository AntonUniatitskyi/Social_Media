import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, PawPrint } from 'lucide-react'
import { api, ApiError } from '../../api/client'
import type { Publication } from '../../api/types'
import { btnPrimaryLg, btnSoftLg, card } from '../ui/cls'
import { MediaPicker } from './MediaPicker'
import type { MediaDraft } from './media'

const MAX_TEXT = 2000

// DRF отдаёт {"media": ["..."]}, {"media": {"0": ["..."]}} или {"non_field_errors": ["..."]}
function firstMessage(v: unknown): string | null {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(firstMessage).find(Boolean) ?? null
  if (v && typeof v === 'object') return Object.values(v).map(firstMessage).find(Boolean) ?? null
  return null
}

function publishError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Немає зв’язку із сервером. Спробуйте ще раз.'
  if (err.status === 413) return 'Файли завеликі для сервера.'
  if (err.status === 400) return firstMessage(err.data) ?? 'Не вдалося опублікувати.'
  return 'Не вдалося опублікувати. Спробуйте ще раз.'
}

export function CreatePost() {
  const qc = useQueryClient()
  const [items, setItems] = useState<MediaDraft[]>([])
  const [text, setText] = useState('')

  const publish = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      if (text.trim()) fd.append('text', text.trim())
      items.forEach((i) => fd.append('media', i.file))   // порядок файлов = порядок в карусели
      return api<Publication>('/publications/', { method: 'POST', body: fd })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })          // счётчик публикаций
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })

  // освобождаем blob-ссылки при уходе со страницы
  const itemsRef = useRef(items)
  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), [])

  // защита от случайного закрытия вкладки с несохранёнными файлами
  useEffect(() => {
    if (items.length === 0 || publish.isSuccess) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [items.length, publish.isSuccess])

  function reset() {
    items.forEach((i) => URL.revokeObjectURL(i.url))
    setItems([])
    setText('')
    publish.reset()
  }

  if (publish.isSuccess) {
    return (
      <main className="mx-auto w-full max-w-[600px] px-3">
        <section className={`${card} px-6 py-14 text-center`}>
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-sand/70 text-clay">
            <PawPrint className="size-8 motion-safe:animate-paw-bounce" />
          </span>
          <h1 className="mt-4 text-xl font-semibold">Публікацію створено</h1>
          <p className="mx-auto mt-1 max-w-xs text-sm text-stone-600">
            Підписники побачать її у своїй стрічці.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button type="button" onClick={reset} className={btnSoftLg}>Створити ще</button>
            <Link to="/" className={btnPrimaryLg}>До стрічки</Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-[600px] px-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (items.length > 0 && !publish.isPending) publish.mutate()
        }}
        className={`${card} p-4 sm:p-5`}
      >
        <h1 className="mb-4 text-xl font-semibold">Нова публікація</h1>

        <fieldset disabled={publish.isPending} className="min-w-0 space-y-5 disabled:opacity-70">
          <MediaPicker items={items} onChange={setItems} />

          <div>
            <label htmlFor="caption" className="mb-1.5 block text-sm font-medium">
              Підпис <span className="font-normal text-stone-500">(за бажанням)</span>
            </label>
            <textarea
              id="caption"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_TEXT}
              rows={3}
              placeholder="Розкажіть, що на фото…"
              className="field-sizing-content max-h-64 min-h-24 w-full resize-none rounded-xl border border-sand bg-white/70 px-3.5 py-2.5 text-[15px] leading-relaxed outline-none transition focus:border-clay focus:ring-[3px] focus:ring-clay/20"
            />
            <p className="mt-1 text-right text-xs tabular-nums text-stone-500">
              {text.length} / {MAX_TEXT}
            </p>
          </div>

          {publish.isError && (
            <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
              {publishError(publish.error)}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <Link to="/" className={btnSoftLg}>Скасувати</Link>
            <button type="submit" disabled={items.length === 0 || publish.isPending} className={btnPrimaryLg}>
              {publish.isPending && <Loader2 className="size-4 animate-spin" />}
              {publish.isPending ? 'Публікуємо…' : 'Опублікувати'}
            </button>
          </div>
        </fieldset>
      </form>
    </main>
  )
}