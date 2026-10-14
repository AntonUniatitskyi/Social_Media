import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, Trash2 } from 'lucide-react'
import { api } from '../../api/client'
import type { Comment, Paginated } from '../../api/types'
import { fullDate, timeAgo } from '../../lib/time'
import { useMe } from '../auth/auth'
import { Avatar } from '../ui/Avatar'
import { focusRing, iconBtn } from '../ui/cls'

export function Comments({ publicationId, onCountChange }: {
  publicationId: number
  onCountChange: (delta: number) => void
}) {
  const qc = useQueryClient()
  const me = useMe().data
  const [text, setText] = useState('')
  const key = ['comments', publicationId]

  const list = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) =>
      api<Paginated<Comment>>(`/comments/?publication=${publicationId}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.next ? all.length + 1 : undefined),
  })
  const comments = list.data?.pages.flatMap((p) => p.results) ?? []

  const add = useMutation({
    mutationFn: (body: string) =>
      api<Comment>('/comments/', {
        method: 'POST',
        body: JSON.stringify({ publication: publicationId, text_com: body }),
      }),
    onSuccess: () => {
      setText('')
      onCountChange(1)
      qc.invalidateQueries({ queryKey: key })
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => api<void>(`/comments/${id}/`, { method: 'DELETE' }),
    onSuccess: () => {
      onCountChange(-1)
      qc.invalidateQueries({ queryKey: key })
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (body && !add.isPending) add.mutate(body)
  }

  return (
    <section aria-label="Коментарі" className="mx-4 mt-3 border-t border-sand pt-3">
      {list.isPending && <p className="text-sm text-stone-500">Завантаження…</p>}
      {list.isError && <p role="alert" className="text-sm text-red-700">Не вдалося завантажити коментарі.</p>}
      {list.isSuccess && comments.length === 0 && (
        <p className="text-sm text-stone-500">Коментарів ще немає. Напишіть першим.</p>
      )}

      {comments.length > 0 && (
        <ul className="max-h-64 space-y-3 overflow-y-auto pr-1">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar src={c.author.avatar} name={c.author.uusername} className="size-8" />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">
                  <Link to={`/u/${c.author.uusername}`} className="font-semibold hover:underline">
                    {c.author.uusername}
                  </Link>{' '}
                  <span className="whitespace-pre-line break-words">{c.text_com}</span>
                </p>
                <time dateTime={c.created_at} title={fullDate(c.created_at)} className="text-xs text-stone-500">
                  {timeAgo(c.created_at)}
                </time>
              </div>
              {me?.id === c.author.id && (
                <button
                  type="button"
                  onClick={() => remove.mutate(c.id)}
                  disabled={remove.isPending}
                  aria-label="Видалити коментар"
                  className={`${iconBtn} size-8`}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {list.hasNextPage && (
        <button
          type="button"
          onClick={() => list.fetchNextPage()}
          disabled={list.isFetchingNextPage}
          className="mt-2 text-sm text-stone-500 hover:text-stone-800"
        >
          Показати ще коментарі
        </button>
      )}

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Додати коментар…"
          aria-label="Ваш коментар"
          className={`h-10 min-w-0 flex-1 rounded-xl border border-sand bg-white px-3.5 text-sm outline-none transition focus:border-clay focus:ring-[3px] focus:ring-clay/20`}
        />
        <button
          type="submit"
          disabled={!text.trim() || add.isPending}
          aria-label="Надіслати коментар"
          className={`grid size-10 place-items-center rounded-xl bg-stone-900 text-white transition-colors hover:bg-stone-700 disabled:opacity-40 ${focusRing}`}
        >
          <Send className="size-4" />
        </button>
      </form>
      {add.isError && <p role="alert" className="mt-1.5 text-sm text-red-700">Не вдалося надіслати коментар.</p>}
    </section>
  )
}