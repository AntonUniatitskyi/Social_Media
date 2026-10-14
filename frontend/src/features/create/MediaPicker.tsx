import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ImagePlus, Play, Plus, Trash2 } from 'lucide-react'
import { focusRing } from '../ui/cls'
import { ALLOWED, MAX_FILES, MAX_SIZE, toDraft, type MediaDraft } from './media'

const overlayBtn = `grid size-9 place-items-center rounded-full bg-cream/90 text-bark shadow transition-colors hover:bg-cream disabled:opacity-40 ${focusRing}`

export function MediaPicker({ items, onChange }: {
  items: MediaDraft[]
  onChange: (next: MediaDraft[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [sel, setSel] = useState(0)
  const [drag, setDrag] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const index = Math.min(sel, items.length - 1)
  const current = items[index]
  const pick = () => inputRef.current?.click()

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list)
    const badType = incoming.some((f) => !ALLOWED.test(f.name))
    const tooBig = incoming.some((f) => ALLOWED.test(f.name) && f.size > MAX_SIZE)
    const valid = incoming.filter((f) => ALLOWED.test(f.name) && f.size <= MAX_SIZE)
    const room = MAX_FILES - items.length

    const msgs: string[] = []
    if (badType) msgs.push('Підтримуються JPG, PNG, GIF, WebP, MP4 і MOV.')
    if (tooBig) msgs.push(`Файл завеликий: максимум ${MAX_SIZE / 1024 / 1024} МБ.`)
    if (valid.length > room) msgs.push(`Максимум ${MAX_FILES} файлів.`)
    setNotice(msgs.join(' ') || null)

    const added = valid.slice(0, Math.max(room, 0)).map(toDraft)
    if (added.length) {
      onChange([...items, ...added])
      setSel(items.length)               // показываем первый из добавленных
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return
    const next = [...items]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    onChange(next)
    setSel(to)
  }

  function remove(i: number) {
    URL.revokeObjectURL(items[i].url)
    const next = items.filter((_, k) => k !== i)
    onChange(next)
    setSel(Math.max(0, Math.min(i, next.length - 1)))
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false)
      }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => { addFiles(e.target.files ?? []); e.target.value = '' }}
      />

      {!current ? (
        <button
          type="button"
          onClick={pick}
          className={`flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 text-center transition-colors ${focusRing} ${
            drag ? 'border-clay bg-sand/50' : 'border-sand bg-page/60 hover:bg-sand/30'
          }`}
        >
          <span className="grid size-14 place-items-center rounded-full bg-sand/70 text-clay">
            <ImagePlus className="size-7" />
          </span>
          <span className="block text-base font-semibold">Додайте фото або відео</span>
          <span className="block max-w-xs text-sm text-stone-600">
            Перетягніть файли сюди або натисніть, щоб обрати. До {MAX_FILES} файлів, кожен до{' '}
            {MAX_SIZE / 1024 / 1024} МБ.
          </span>
        </button>
      ) : (
        <div className="space-y-3">
          <div
            className={`relative aspect-[4/3] overflow-hidden rounded-2xl bg-sand/40 ${
              drag ? 'ring-2 ring-clay' : ''
            }`}
          >
            {current.video ? (
              <video key={current.id} src={current.url} controls preload="metadata" className="size-full bg-bark object-contain" />
            ) : (
              <img key={current.id} src={current.url} alt={`Фото ${index + 1} з ${items.length}`} className="size-full object-cover" />
            )}

            <div className="absolute right-3 top-3 flex gap-1.5">
              <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label="Перемістити раніше" className={overlayBtn}>
                <ArrowLeft className="size-4" />
              </button>
              <button type="button" onClick={() => move(index, index + 1)} disabled={index === items.length - 1} aria-label="Перемістити пізніше" className={overlayBtn}>
                <ArrowRight className="size-4" />
              </button>
              <button type="button" onClick={() => remove(index)} aria-label="Видалити файл" className={overlayBtn}>
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          <ul className="flex gap-2 overflow-x-auto px-1 py-1.5">
            {items.map((it, i) => (
              <li key={it.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setSel(i)}
                  aria-label={`Показати файл ${i + 1} з ${items.length}`}
                  aria-current={i === index ? 'true' : undefined}
                  className={`relative block size-16 overflow-hidden rounded-xl bg-sand/50 ring-2 ring-offset-2 ring-offset-cream transition ${focusRing} ${
                    i === index ? 'ring-clay' : 'ring-transparent hover:ring-sand'
                  }`}
                >
                  {it.video ? (
                    <video src={`${it.url}#t=0.1`} muted preload="metadata" className="size-full object-cover" />
                  ) : (
                    <img src={it.url} alt="" className="size-full object-cover" />
                  )}
                  {it.video && (
                    <span className="absolute inset-0 grid place-items-center bg-bark/30 text-cream">
                      <Play className="size-5" fill="currentColor" />
                    </span>
                  )}
                </button>
              </li>
            ))}
            {items.length < MAX_FILES && (
              <li className="shrink-0">
                <button
                  type="button"
                  onClick={pick}
                  aria-label="Додати ще файли"
                  className={`grid size-16 place-items-center rounded-xl border-2 border-dashed border-sand text-stone-600 transition-colors hover:bg-sand/30 ${focusRing}`}
                >
                  <Plus className="size-6" />
                </button>
              </li>
            )}
          </ul>
          <p className="text-xs text-stone-500">
            {items.length} з {MAX_FILES}. Перший файл показується першим.
          </p>
        </div>
      )}

      {notice && <p role="alert" className="mt-2 text-sm text-red-800">{notice}</p>}
    </div>
  )
}