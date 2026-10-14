import { Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Paginated, ProfileMini } from '../../api/types'
import { Avatar } from '../ui/Avatar'
import { btnSoft } from '../ui/cls'
import { Dialog } from '../ui/Dialog'

export type PeopleKind = 'followers' | 'following'

export function PeopleDialog({ uusername, kind, onClose }: {
  uusername: string
  kind: PeopleKind | null
  onClose: () => void
}) {
  return (
    <Dialog open={kind !== null} onClose={onClose} title={kind === 'following' ? 'Підписки' : 'Підписники'}>
      {kind && <PeopleList uusername={uusername} kind={kind} onNavigate={onClose} />}
    </Dialog>
  )
}

function PeopleList({ uusername, kind, onNavigate }: {
  uusername: string
  kind: PeopleKind
  onNavigate: () => void
}) {
  const q = useInfiniteQuery({
    queryKey: ['people', uusername, kind],
    queryFn: ({ pageParam }) =>
      api<Paginated<ProfileMini>>(`/profiles/${encodeURIComponent(uusername)}/${kind}/?page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.next ? all.length + 1 : undefined),
  })
  const people = q.data?.pages.flatMap((p) => p.results) ?? []

  if (q.isPending) return <p className="text-sm text-stone-500">Завантаження…</p>
  if (q.isError) return <p role="alert" className="text-sm text-red-700">Не вдалося завантажити список.</p>
  if (people.length === 0) {
    return <p className="text-sm text-stone-600">{kind === 'followers' ? 'Підписників ще немає.' : 'Підписок ще немає.'}</p>
  }

  return (
    <>
      <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
        {people.map((p) => (
          <li key={p.id}>
            <Link
              to={`/u/${p.uusername}`}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-sand/30"
            >
              <Avatar src={p.avatar} name={p.uusername} className="size-10" />
              <span className="truncate font-medium">{p.uusername}</span>
            </Link>
          </li>
        ))}
      </ul>
      {q.hasNextPage && (
        <button onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} className={`${btnSoft} mt-3 w-full`}>
          Показати ще
        </button>
      )}
    </>
  )
}