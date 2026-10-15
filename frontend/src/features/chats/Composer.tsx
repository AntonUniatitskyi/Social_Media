import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Paperclip, Send, X } from 'lucide-react'
import { api } from '../../api/client'
import type { ChatMessage } from '../../api/types'
import { fieldErrors } from '../auth/auth'
import { focusRing, iconBtn } from '../ui/cls'

const MAX_BODY = 400
const MAX_FILE = 10 * 1024 * 1024
const FILE_RE = /\.(jpe?g|png|gif|webp|mp4|mov|mp3|pdf|txt|zip|docx?|xlsx?)$/i
const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.mp3,.pdf,.txt,.zip,.doc,.docx,.xls,.xlsx'

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} КБ` : `${(b / 1024 / 1024).toFixed(1)} МБ`)

export function Composer({ groupName, onSent }: { groupName: string; onSent: (m: ChatMessage) => void }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const send = useMutation({
    mutationFn: ({ body, file }: { body: string; file: File | null }) => {
      const url = `/chats/${encodeURIComponent(groupName)}/messages/`
      if (file) {
        const fd = new FormData()
        if (body) fd.append('body', body)
        fd.append('file', file)
        return api<ChatMessage>(url, { method: 'POST', body: fd })
      }
      return api<ChatMessage>(url, { method: 'POST', body: JSON.stringify({ body }) })
    },
    onSuccess: onSent,
  })

  function submit() {
    const body = text.trim()
    if ((!body && !file) || send.isPending) return
    send.mutate({ body, file }, { onSuccess: () => { setText(''); setFile(null) } })
  }

  function pick(f: File | undefined) {
    if (!f) return
    if (!FILE_RE.test(f.name)) return setFileError('Цей тип файлу не підтримується.')
    if (f.size > MAX_FILE) return setFileError('Файл завеликий: максимум 10 МБ.')
    setFileError(null)
    setFile(f)
  }

  const message =
    fileError ??
    (send.isError ? Object.values(fieldErrors(send.error))[0] ?? 'Не вдалося надіслати. Спробуйте ще раз.' : null)

  return (
    <div className="border-t border-sand p-3">
      {file && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-sand/40 px-3 py-2 text-sm">
          <Paperclip className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="shrink-0 text-xs text-stone-600">{size(file.size)}</span>
          <button type="button" onClick={() => setFile(null)} aria-label="Прибрати файл" className={`${iconBtn} size-7`}>
            <X className="size-4" />
          </button>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); submit() }} className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} aria-label="Додати файл" className={`${iconBtn} size-11`}>
          <Paperclip className="size-5" />
        </button>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          maxLength={MAX_BODY}
          rows={1}
          enterKeyHint="send"
          aria-label="Повідомлення"
          placeholder="Напишіть повідомлення…"
          className="field-sizing-content max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-sand bg-white/70 px-3.5 py-2.5 text-[15px] leading-snug outline-none transition focus:border-clay focus:ring-[3px] focus:ring-clay/20"
        />

        <button
          type="submit"
          disabled={(!text.trim() && !file) || send.isPending}
          aria-label="Надіслати"
          className={`grid size-11 shrink-0 place-items-center rounded-xl bg-bark text-cream transition-colors hover:bg-clay disabled:opacity-40 ${focusRing}`}
        >
          <Send className="size-5" />
        </button>
      </form>

      <div className="mt-1 flex justify-between gap-3 px-1 text-xs">
        <span role="alert" className="text-red-800">{message}</span>
        {text.length > 300 && <span className="tabular-nums text-stone-500">{text.length} / {MAX_BODY}</span>}
      </div>
    </div>
  )
}