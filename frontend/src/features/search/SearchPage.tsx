import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Search, SearchX, X } from 'lucide-react'
import { api } from '../../api/client'
import type { Paginated, ProfileCard, ProfileMini } from '../../api/types'
import { useDebounced } from '../../lib/useDebounced'
import { useSentinel } from '../../lib/useSentinel'
import { btnSoft, card, iconBtn } from '../ui/cls'
import { ProfileRow } from './ProfileRow'

const MIN_CHARS = 2

function RowList({ children, dim = false }: { children: ReactNode; dim?: boolean }) {
  return (
    <ul className={`${card} divide-y divide-sand overflow-hidden transition-opacity ${dim ? 'opacity-60' : ''}`}>
      {children}
    </ul>
  )
}

function RowsSkeleton() {
  return (
    <ul aria-hidden className={`${card} divide-y divide-sand overflow-hidden`}>
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex items-center gap-3 p-3 motion-safe:animate-pulse">
          <div className="size-12 rounded-full bg-sand/70" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 rounded bg-sand/70" />
            <div className="h-3 w-48 rounded bg-sand/60" />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [text, setText] = useState(params.get('q') ?? '')
  const q = useDebounced(text.trim(), 300)
  const searching = q.length >= MIN_CHARS

  // запрос живёт в адресе: кнопка «Назад» возвращает к результатам
  useEffect(() => {
    if ((params.get('q') ?? '') !== q) setParams(q ? { q } : {}, { replace: true })
  }, [q, params, setParams])

  const results = useInfiniteQuery({
    queryKey: ['search', q],
    queryFn: ({ pageParam }) =>
      api<Paginated<ProfileCard>>(`/profiles/?search=${encodeURIComponent(q)}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.next ? all.length + 1 : undefined),
    enabled: searching,
    placeholderData: keepPreviousData,    // пока грузится новый запрос, показываем прежний, без мигания
  })
  const people = results.data?.pages.flatMap((p) => p.results) ?? []

  const rec = useQuery({
    queryKey: ['recommended'],
    queryFn: () => api<ProfileMini[]>('/profiles/recommended/'),
    staleTime: 5 * 60_000,
    enabled: !searching,
  })

  const sentinel = useSentinel(
    () => results.fetchNextPage(),
    searching && !!results.hasNextPage && !results.isFetchingNextPage,
  )

  return (
    <main className="mx-auto w-full max-w-[600px] space-y-5 px-3">
      <h1 className="sr-only">Пошук</h1>

      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-stone-600" />
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          enterKeyHint="search"
          autoComplete="off"
          autoFocus
          aria-label="Пошук людей"
          placeholder="Нік користувача"
          className="h-12 w-full rounded-[14px] border border-sand bg-white/70 pl-12 pr-12 text-base outline-none transition focus:border-clay focus:ring-[3px] focus:ring-clay/20 [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button
            type="button"
            onClick={() => setText('')}
            aria-label="Очистити пошук"
            className={`${iconBtn} absolute right-1.5 top-1/2 -translate-y-1/2`}
          >
            <X className="size-5" />
          </button>
        )}
      </form>

      {/* озвучка для скрінрідерів */}
      <p role="status" className="sr-only">
        {searching && results.isSuccess ? `Знайдено: ${results.data.pages[0].count}` : ''}
      </p>

      {!searching && (
        <section aria-labelledby="rec-title" className="space-y-3">
          <h2 id="rec-title" className="font-semibold">Кого читати</h2>
          {text.trim().length === 1 && (
            <p className="text-sm text-stone-600">Введіть щонайменше {MIN_CHARS} символи.</p>
          )}
          {rec.isPending && <RowsSkeleton />}
          {rec.isError && (
            <div role="alert" className={`${card} p-5 text-center`}>
              <p>Не вдалося завантажити рекомендації.</p>
              <button onClick={() => rec.refetch()} className={`${btnSoft} mt-3`}>Спробувати ще раз</button>
            </div>
          )}
          {rec.data && rec.data.length === 0 && (
            <p className="text-sm text-stone-600">Поки що рекомендацій немає. Скористайтеся пошуком.</p>
          )}
          {rec.data && rec.data.length > 0 && (
            <RowList>{rec.data.map((p) => <ProfileRow key={p.id} p={p} />)}</RowList>
          )}
        </section>
      )}

      {searching && (
        <section aria-label="Результати пошуку" aria-busy={results.isFetching}>
          {results.isPending && <RowsSkeleton />}

          {results.isError && (
            <div role="alert" className={`${card} p-5 text-center`}>
              <p>Не вдалося виконати пошук.</p>
              <button onClick={() => results.refetch()} className={`${btnSoft} mt-3`}>Спробувати ще раз</button>
            </div>
          )}

          {results.isSuccess && people.length === 0 && (
            <div className={`${card} px-6 py-12 text-center`}>
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-sand/70 text-clay">
                <SearchX className="size-6" />
              </span>
              <h2 className="mt-3 font-semibold">Нічого не знайдено за «{q}»</h2>
              <p className="mx-auto mt-1 max-w-xs text-sm text-stone-600">
                Перевірте написання або спробуйте частину ніка.
              </p>
            </div>
          )}

          {people.length > 0 && (
            <RowList dim={results.isPlaceholderData}>
              {people.map((p) => <ProfileRow key={p.id} p={p} />)}
            </RowList>
          )}

          <div ref={sentinel} />
          {results.isFetchingNextPage && (
            <p className="py-3 text-center text-sm text-stone-500">Завантаження…</p>
          )}
        </section>
      )}
    </main>
  )
}