import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Flag, ShieldCheck } from 'lucide-react'
import { api } from '../../api/client'
import type { Paginated, ReportedPost } from '../../api/types'
import { plural } from '../../lib/plural'
import { fullDate, timeAgo } from '../../lib/time'
import { useTitle } from '../../lib/title'
import { useSentinel } from '../../lib/useSentinel'
import { MediaCarousel } from '../feed/MediaCarousel'
import { Avatar } from '../ui/Avatar'
import { btnDanger, btnSoft, card, iconBtn } from '../ui/cls'
import { Dialog } from '../ui/Dialog'

function ReportCard({ post }: { post: ReportedPost }) {
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState(false)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['moderation'] })
    qc.invalidateQueries({ queryKey: ['moderation-count'] })
  }

  const remove = useMutation({
    mutationFn: () => api<void>(`/moderation/${post.id}/remove/`, { method: 'POST' }),
    onSuccess: () => {
      setConfirm(false)
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['grid'] })
      refresh()
    },
    onError: refresh,                      // скорее всего, пост уже обработан: обновляем очередь
  })
  const dismiss = useMutation({
    mutationFn: () => api<{ dismissed: number }>(`/moderation/${post.id}/dismiss/`, { method: 'POST' }),
    onSettled: refresh,
  })
  const busy = remove.isPending || dismiss.isPending

  return (
    <article className={`${card} p-4 sm:p-5`}>
      <header className="flex items-center gap-3">
        <Avatar src={post.profile.avatar} name={post.profile.username} className="size-10" />
        <div className="min-w-0 flex-1 leading-tight">
          <Link to={`/u/${post.profile.uusername}`} className="block truncate font-semibold hover:underline">
            {post.profile.username}
          </Link>
          <p className="truncate text-xs text-stone-600">
            @{post.profile.uusername} ·{' '}
            <time dateTime={post.timestamp} title={fullDate(post.timestamp)}>{timeAgo(post.timestamp)}</time>
          </p>
        </div>
        <Link
          to={`/p/${post.id}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Відкрити публікацію в новій вкладці"
          className={iconBtn}
        >
          <ExternalLink className="size-[18px]" />
        </Link>
      </header>

      {post.media_items.length > 0 && (
        <div className="mt-3">
          <MediaCarousel items={post.media_items} />
        </div>
      )}
      {post.text && (
        <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed">{post.text}</p>
      )}

      <section aria-label="Скарги" className="mt-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Flag className="size-4 text-red-700" />
          {post.reports} {plural(post.reports, ['скарга', 'скарги', 'скарг'])}
        </h2>
        <ul className="space-y-2">
          {post.complaints.map((r) => (
            <li key={r.id} className="rounded-xl bg-sand/30 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="rounded-full border border-sand bg-white px-2.5 py-0.5 text-xs font-medium">
                  {r.reason}
                </span>
                <Link to={`/u/${r.user.uusername}`} className="font-medium hover:underline">
                  {r.user.username}
                </Link>
                <time dateTime={r.created_at} title={fullDate(r.created_at)} className="text-xs text-stone-500">
                  {timeAgo(r.created_at)}
                </time>
              </div>
              {r.text && (
                <p className="mt-1.5 whitespace-pre-line break-words text-sm text-stone-700">{r.text}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {(remove.isError || dismiss.isError) && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          Не вдалося виконати дію. Можливо, цю публікацію вже опрацював інший модератор.
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-sand pt-4">
        <button type="button" onClick={() => dismiss.mutate()} disabled={busy} className={btnSoft}>
          {dismiss.isPending ? 'Відхиляємо…' : 'Відхилити скарги'}
        </button>
        <button type="button" onClick={() => setConfirm(true)} disabled={busy} className={btnDanger}>
          Видалити публікацію
        </button>
      </div>

      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Видалити публікацію?">
        <p className="text-sm text-stone-600">
          Публікацію, фото, коментарі та всі скарги на неї буде видалено назавжди. Автор не отримає сповіщення.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirm(false)} className={btnSoft}>Скасувати</button>
          <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className={btnDanger}>
            {remove.isPending ? 'Видаляємо…' : 'Видалити'}
          </button>
        </div>
      </Dialog>
    </article>
  )
}

function CardSkeleton() {
  return (
    <div aria-hidden className={`${card} p-5 motion-safe:animate-pulse`}>
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-full bg-sand/70" />
        <div className="h-3 w-32 rounded bg-sand/70" />
      </div>
      <div className="mt-3 aspect-[4/3] rounded-xl bg-sand/50" />
      <div className="mt-3 h-12 rounded-xl bg-sand/40" />
    </div>
  )
}

export function ModerationPage() {
  useTitle('Модерація')

  const q = useInfiniteQuery({
    queryKey: ['moderation'],
    queryFn: ({ pageParam }) => api<Paginated<ReportedPost>>(`/moderation/?page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.next ? all.length + 1 : undefined),
  })
  const items = q.data?.pages.flatMap((p) => p.results) ?? []
  const total = q.data?.pages[0].count ?? 0
  const sentinel = useSentinel(() => q.fetchNextPage(), !!q.hasNextPage && !q.isFetchingNextPage)

  return (
    <main className="mx-auto w-full max-w-[640px] space-y-5 px-3">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold">Модерація</h1>
        {q.isSuccess && total > 0 && <p className="text-sm text-stone-600">У черзі: {total}</p>}
      </div>

      {q.isPending && <><CardSkeleton /><CardSkeleton /></>}

      {q.isError && (
        <div role="alert" className={`${card} p-5 text-center`}>
          <p>Не вдалося завантажити чергу.</p>
          <button onClick={() => q.refetch()} className={`${btnSoft} mt-3`}>Спробувати ще раз</button>
        </div>
      )}

      {q.isSuccess && items.length === 0 && (
        <section className={`${card} px-6 py-14 text-center`}>
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-sand/70 text-clay">
            <ShieldCheck className="size-6" />
          </span>
          <h2 className="mt-3 font-semibold">Черга порожня</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-stone-600">Нових скарг немає. Нові з’являться тут.</p>
        </section>
      )}

      {items.map((p) => <ReportCard key={p.id} post={p} />)}

      <div ref={sentinel} />
      {q.isFetchingNextPage && <CardSkeleton />}
    </main>
  )
}