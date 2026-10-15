import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Layers, MessageCircle, PawPrint, Play } from 'lucide-react'
import { api } from '../../api/client'
import type { Paginated, Publication } from '../../api/types'
import { useSentinel } from '../../lib/useSentinel'
import { btnSoft, card, focusRing } from '../ui/cls'

function Tile({ post }: { post: Publication }) {
  const first = post.media_items[0]
  const many = post.media_items.length > 1

  return (
    <li>
      <Link
        to={`/p/${post.id}`}
        aria-label="Відкрити публікацію"
        className={`group relative block aspect-square overflow-hidden rounded-xl bg-sand/50 ${focusRing}`}
      >
        {first ? (
          first.is_video ? (
            <video src={`${first.file}#t=0.1`} muted preload="metadata" className="size-full object-cover" />
          ) : (
            <img src={first.file} alt="" loading="lazy" className="size-full object-cover" />
          )
        ) : (
          <span className="line-clamp-5 grid size-full place-items-center p-3 text-center text-sm text-stone-600">
            {post.text}
          </span>
        )}

        {many ? (
          <Layers aria-hidden className="absolute right-2 top-2 size-4 text-cream drop-shadow" />
        ) : first?.is_video ? (
          <Play aria-hidden className="absolute right-2 top-2 size-4 text-cream drop-shadow" fill="currentColor" />
        ) : null}

        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center gap-5 bg-bark/45 text-cream opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <span className="flex items-center gap-1.5 font-medium tabular-nums">
            <PawPrint className="size-5" fill="currentColor" />{post.likes_total}
          </span>
          <span className="flex items-center gap-1.5 font-medium tabular-nums">
            <MessageCircle className="size-5" fill="currentColor" />{post.comments_total}
          </span>
        </span>
      </Link>
    </li>
  )
}

export function PostGrid({ queryKey, path, empty }: {
  queryKey: readonly unknown[]
  path: string                 // например /publications/?author=mila
  empty: ReactNode
}) {
  const q = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      api<Paginated<Publication>>(`${path}${path.includes('?') ? '&' : '?'}page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.next ? all.length + 1 : undefined),
  })
  const posts = q.data?.pages.flatMap((p) => p.results) ?? []
  const sentinel = useSentinel(() => q.fetchNextPage(), !!q.hasNextPage && !q.isFetchingNextPage)

  if (q.isPending) {
    return (
      <ul aria-hidden className="grid grid-cols-3 gap-1.5 sm:gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="aspect-square rounded-xl bg-sand/50 motion-safe:animate-pulse" />
        ))}
      </ul>
    )
  }

  if (q.isError) {
    return (
      <div role="alert" className={`${card} p-5 text-center`}>
        <p>Не вдалося завантажити публікації.</p>
        <button onClick={() => q.refetch()} className={`${btnSoft} mt-3`}>Спробувати ще раз</button>
      </div>
    )
  }

  if (posts.length === 0) return <>{empty}</>

  return (
    <>
      <ul className="grid grid-cols-3 gap-1.5 sm:gap-3">
        {posts.map((p) => <Tile key={p.id} post={p} />)}
      </ul>
      <div ref={sentinel} />
      {q.isFetchingNextPage && <p className="py-4 text-center text-sm text-stone-500">Завантаження…</p>}
    </>
  )
}