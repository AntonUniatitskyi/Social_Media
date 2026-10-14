import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { PawPrint } from 'lucide-react'
import { api } from '../../api/client'
import type { Paginated, Publication } from '../../api/types'
import { btnDark, btnSoft, card } from '../ui/cls'
import { ComplaintDialog } from './ComplaintDialog'
import { LeftColumn } from './LeftColumn'
import { PostCard } from './PostCard'
import { RightColumn } from './RightColumn'

function PostSkeleton() {
  return (
    <div aria-hidden className={`${card} p-4 motion-safe:animate-pulse`}>
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-full bg-sand/70" />
        <div className="h-3 w-32 rounded bg-sand/70" />
      </div>
      <div className="mt-3 aspect-[4/3] rounded-xl bg-sand/50" />
      <div className="mt-3 h-3 w-2/3 rounded bg-sand/70" />
    </div>
  )
}

export function Feed() {
  // один seed на сессию ленты: иначе «случайный» порядок меняется между страницами
  const [seed] = useState(() => Math.floor(Math.random() * 1_000_000) + 1)
  const [complaintId, setComplaintId] = useState<number | null>(null)

  const feed = useInfiniteQuery({
    queryKey: ['feed', seed],
    queryFn: ({ pageParam }) =>
      api<Paginated<Publication>>(`/publications/feed/?seed=${seed}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.next ? all.length + 1 : undefined),
  })
  const posts = feed.data?.pages.flatMap((p) => p.results) ?? []

  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage() },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <>
      <div className="mx-auto grid max-w-[1120px] gap-6 px-3 xl:grid-cols-[250px_minmax(0,1fr)_300px]">
        <div className="hidden xl:block"><LeftColumn /></div>

        <main className="mx-auto w-full max-w-[600px] space-y-5">
          <h1 className="sr-only">Стрічка</h1>

          {feed.isPending && <><PostSkeleton /><PostSkeleton /></>}

          {feed.isError && (
            <div role="alert" className={`${card} p-5 text-center`}>
              <p>Не вдалося завантажити стрічку.</p>
              <button onClick={() => feed.refetch()} className={`${btnSoft} mt-3`}>
                Спробувати ще раз
              </button>
            </div>
          )}

          {feed.isSuccess && posts.length === 0 && (
            <section className={`${card} px-6 py-12 text-center`}>
              <PawPrint className="mx-auto size-10 text-stone-400" />
              <h2 className="mt-3 text-lg font-semibold">У стрічці поки порожньо</h2>
              <p className="mx-auto mt-1 max-w-xs text-sm text-stone-600">
                Підпишіться на когось із рекомендацій або опублікуйте перший пост.
              </p>
              <Link to="/create" className={`${btnDark} mt-5 inline-block`}>Створити публікацію</Link>
            </section>
          )}

          {posts.map((p) => <PostCard key={p.id} post={p} onComplain={setComplaintId} />)}

          <div ref={sentinel} />
          {isFetchingNextPage && <PostSkeleton />}
          {feed.isSuccess && !hasNextPage && posts.length > 0 && (
            <p className="py-6 text-center text-sm text-stone-500">Ви переглянули все нове.</p>
          )}
        </main>

        <div className="hidden xl:block"><RightColumn /></div>
      </div>

      <ComplaintDialog publicationId={complaintId} onClose={() => setComplaintId(null)} />
    </>
  )
}