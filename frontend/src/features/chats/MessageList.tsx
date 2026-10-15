import { useMemo, useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ArrowDown, FileText } from 'lucide-react'
import { api } from '../../api/client'
import type { ChatMessage, CursorPage } from '../../api/types'
import { clock, dayLabel } from '../../lib/time'
import { useSentinel } from '../../lib/useSentinel'
import { Avatar } from '../ui/Avatar'
import { btnSoft, focusRing } from '../ui/cls'

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString()

function Bubble({ m, mine, showName }: { m: ChatMessage; mine: boolean; showName: boolean }) {
  return (
    <div
      className={`max-w-[80%] rounded-2xl px-3 py-2 ${
        mine ? 'rounded-br-md bg-bark text-cream' : 'rounded-bl-md border border-sand bg-white'
      }`}
    >
      {showName && (
        <Link to={`/u/${m.author.uusername}`} className="mb-0.5 block text-xs font-semibold text-clay hover:underline">
          {m.author.uusername}
        </Link>
      )}

      {m.file &&
        (m.is_image ? (
          <a href={m.file} target="_blank" rel="noreferrer" className={`mb-1 block rounded-xl ${focusRing}`}>
            <img src={m.file} alt={m.filename ?? 'Зображення'} loading="lazy" className="max-h-64 w-full rounded-xl object-cover" />
          </a>
        ) : (
          <a
            href={m.file}
            target="_blank"
            rel="noreferrer"
            className={`mb-1 flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm ${mine ? 'bg-cream/10' : 'bg-sand/40'} ${focusRing}`}
          >
            <FileText className="size-5 shrink-0" />
            <span className="min-w-0 truncate underline">{m.filename}</span>
          </a>
        ))}

      {m.body && <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.body}</p>}

      <time dateTime={m.created} className={`mt-0.5 block text-right text-[11px] ${mine ? 'text-cream/60' : 'text-stone-500'}`}>
        {clock(m.created)}
      </time>
    </div>
  )
}

export function MessageList({ groupName, group, myNick, scrollerRef }: {
  groupName: string
  group: boolean
  myNick?: string
  scrollerRef: RefObject<HTMLUListElement | null>
}) {
  const [showJump, setShowJump] = useState(false)

  const q = useInfiniteQuery({
    queryKey: ['messages', groupName],
    // курсорная пагинация: next ведёт к более старым; берём из него только ?cursor=...
    queryFn: ({ pageParam }) =>
      api<CursorPage<ChatMessage>>(`/chats/${encodeURIComponent(groupName)}/messages/${pageParam}`),
    initialPageParam: '',
    getNextPageParam: (last) => (last.next ? new URL(last.next).search : undefined),
  })
  const messages = useMemo(() => q.data?.pages.flatMap((p) => p.results) ?? [], [q.data])

  const top = useSentinel(() => q.fetchNextPage(), !!q.hasNextPage && !q.isFetchingNextPage)

  return (
    <div className="relative min-h-0 flex-1">
      <ul
        ref={scrollerRef}
        role="log"
        aria-label="Повідомлення"
        onScroll={(e) => setShowJump(e.currentTarget.scrollTop < -300)}
        className="flex h-full flex-col-reverse overflow-y-auto px-3 py-3"
      >
        {messages.map((m, i) => {
          const older = messages[i + 1]                       // старше по времени = следующий в массиве
          const mine = m.author.uusername === myNick
          const newDay = older ? !sameDay(older.created, m.created) : !q.hasNextPage
          const startsRun = !older || older.author.uusername !== m.author.uusername || newDay

          return (
            <li key={m.id} className={startsRun && !newDay && older ? 'mt-3' : 'mt-0.5'}>
              {newDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-sand/60 px-3 py-1 text-xs text-stone-700">{dayLabel(m.created)}</span>
                </div>
              )}
              <div className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                {group && !mine &&
                  (startsRun ? (
                    <Avatar src={m.author.avatar} name={m.author.uusername} className="size-8" />
                  ) : (
                    <span aria-hidden className="size-8 shrink-0" />
                  ))}
                <Bubble m={m} mine={mine} showName={group && !mine && startsRun} />
              </div>
            </li>
          )
        })}

        {q.isFetchingNextPage && <li className="py-2 text-center text-xs text-stone-500">Завантаження…</li>}
        <li aria-hidden><div ref={top} className="h-1" /></li>
      </ul>

      {q.isPending && (
        <div aria-hidden className="absolute inset-0 space-y-3 p-4 motion-safe:animate-pulse">
          <div className="h-10 w-2/3 rounded-2xl bg-sand/60" />
          <div className="ml-auto h-10 w-1/2 rounded-2xl bg-sand/60" />
          <div className="h-10 w-3/5 rounded-2xl bg-sand/60" />
        </div>
      )}

      {q.isError && (
        <div role="alert" className="absolute inset-0 grid place-items-center bg-cream/80 p-6 text-center">
          <div>
            <p>Не вдалося завантажити повідомлення.</p>
            <button onClick={() => q.refetch()} className={`${btnSoft} mt-3`}>Спробувати ще раз</button>
          </div>
        </div>
      )}

      {q.isSuccess && messages.length === 0 && (
        <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-stone-600">
          Напишіть перше повідомлення.
        </p>
      )}

      {showJump && (
        <button
          type="button"
          onClick={() => scrollerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="До нових повідомлень"
          className={`absolute bottom-3 right-4 grid size-10 place-items-center rounded-full border border-sand bg-cream shadow ${focusRing}`}
        >
          <ArrowDown className="size-5" />
        </button>
      )}
    </div>
  )
}