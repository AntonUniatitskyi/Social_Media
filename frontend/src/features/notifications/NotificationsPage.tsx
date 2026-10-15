import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { api } from '../../api/client'
import type { AppNotification, Invitation, Paginated } from '../../api/types'
import { fullDate, timeAgo } from '../../lib/time'
import { useSentinel } from '../../lib/useSentinel'
import { InviteItem } from '../feed/LeftColumn'
import { Avatar } from '../ui/Avatar'
import { btnDark, btnSoft, card } from '../ui/cls'

const TEXT: Partial<Record<AppNotification['kind'], string>> = {
  follow: 'підписався(лась) на вас',
  comment: 'прокоментував(ла) вашу публікацію',
  post: 'опублікував(ла) нову публікацію',
}

function targetOf(n: AppNotification) {
  if ((n.kind === 'comment' || n.kind === 'post') && n.publication) return `/p/${n.publication}`
  return `/u/${n.sender.uusername}`
}

const rowFocus = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-clay'

function Row({ n }: { n: AppNotification }) {
  const text = TEXT[n.kind]
  return (
    <li>
      <Link
        to={targetOf(n)}
        className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-sand/50 ${rowFocus} ${
          n.is_read ? '' : 'bg-sand/40'
        }`}
      >
        <Avatar src={n.sender.avatar} name={n.sender.uusername} className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug">
            {text ? (
              <>
                <span className="font-semibold">{n.sender.uusername}</span> {text}
              </>
            ) : (
              n.message
            )}
          </p>
          <time dateTime={n.created_at} title={fullDate(n.created_at)} className="text-xs text-stone-500">
            {timeAgo(n.created_at)}
          </time>
        </div>
        {!n.is_read && (
          <span className="size-2.5 shrink-0 rounded-full bg-clay">
            <span className="sr-only">Нове</span>
          </span>
        )}
      </Link>
    </li>
  )
}

function RowSkeleton() {
  return (
    <li aria-hidden className="flex items-center gap-3 px-4 py-3 motion-safe:animate-pulse">
      <div className="size-11 rounded-full bg-sand/70" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-3/4 rounded bg-sand/70" />
        <div className="h-3 w-16 rounded bg-sand/60" />
      </div>
    </li>
  )
}

export function NotificationsPage() {
  const qc = useQueryClient()

  const list = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({ pageParam }) => api<Paginated<AppNotification>>(`/notifications/?page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.next ? all.length + 1 : undefined),
    gcTime: 0, // при следующем заходе показываем свежие данные, а не кэш со старой подсветкой «нових»
  })
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.results) ?? [], [list.data])

  const invites = useQuery({
    queryKey: ['invitations'],
    queryFn: () => api<Paginated<Invitation>>('/invitations/'),
  })
  const inviteList = invites.data?.results ?? []

  // Помечаем прочитанными только то, что реально загружено и показано.
  // Подсветка остаётся до ухода со страницы: кэш списка не обновляем.
  const sent = useRef(new Set<number>())
  const markRead = useMutation({
    mutationFn: (ids: number[]) =>
      api<{ marked: number; unread: number }>('/notifications/read/', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
    onSuccess: (d) => qc.setQueryData(['unread'], { unread: d.unread }),
    onError: (_e, ids) => ids.forEach((id) => sent.current.delete(id)),
  })
  const { mutate } = markRead

  useEffect(() => {
    const fresh = items.filter((n) => !n.is_read && !sent.current.has(n.id)).map((n) => n.id)
    if (fresh.length === 0) return
    const t = setTimeout(() => {
      fresh.forEach((id) => sent.current.add(id))
      mutate(fresh)
    }, 1200)
    return () => clearTimeout(t)
  }, [items, mutate])

  const sentinel = useSentinel(
    () => list.fetchNextPage(),
    !!list.hasNextPage && !list.isFetchingNextPage,
  )

  return (
    <main className="mx-auto w-full max-w-[600px] space-y-5 px-3">
      <h1 className="text-xl font-semibold">Сповіщення</h1>

      {inviteList.length > 0 && (
        <section aria-labelledby="inv-title" className={`${card} p-4`}>
          <h2 id="inv-title" className="mb-3 font-semibold">Запрошення до груп</h2>
          <ul className="space-y-3">
            {inviteList.map((i) => <InviteItem key={i.id} invite={i} />)}
          </ul>
        </section>
      )}

      {list.isPending && (
        <ul className={`${card} divide-y divide-sand overflow-hidden`}>
          {Array.from({ length: 5 }, (_, i) => <RowSkeleton key={i} />)}
        </ul>
      )}

      {list.isError && (
        <div role="alert" className={`${card} p-5 text-center`}>
          <p>Не вдалося завантажити сповіщення.</p>
          <button onClick={() => list.refetch()} className={`${btnSoft} mt-3`}>Спробувати ще раз</button>
        </div>
      )}

      {list.isSuccess && items.length === 0 && inviteList.length === 0 && (
        <section className={`${card} px-6 py-12 text-center`}>
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-sand/70 text-clay">
            <Bell className="size-6" />
          </span>
          <h2 className="mt-3 font-semibold">Сповіщень поки немає</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-stone-600">
            Тут з’являться нові підписники, коментарі та публікації тих, на кого ви підписані.
          </p>
          <Link to="/search" className={`${btnDark} mt-5 inline-block`}>Знайти людей</Link>
        </section>
      )}

      {items.length > 0 && (
        <ul className={`${card} divide-y divide-sand overflow-hidden`}>
          {items.map((n) => <Row key={n.id} n={n} />)}
        </ul>
      )}

      <div ref={sentinel} />
      {list.isFetchingNextPage && (
        <p className="py-3 text-center text-sm text-stone-500">Завантаження…</p>
      )}
    </main>
  )
}