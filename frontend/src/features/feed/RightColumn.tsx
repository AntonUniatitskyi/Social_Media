import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { ProfileMini } from '../../api/types'
import { useMe } from '../auth/auth'
import { Avatar } from '../ui/Avatar'
import { btnSoft, card, focusRing } from '../ui/cls'
import { PeopleDialog, type PeopleKind } from './PeopleDialog'

function Stat({ value, label, onClick }: { value: number; label: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="block text-lg font-semibold leading-tight tabular-nums">{value}</span>
      <span className="text-xs text-stone-600">{label}</span>
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className={`rounded-lg py-1.5 transition-colors hover:bg-sand/40 ${focusRing}`}>
      {body}
    </button>
  ) : (
    <div className="py-1.5">{body}</div>
  )
}

function Suggested({ p }: { p: ProfileMini }) {
  const qc = useQueryClient()
  const follow = useMutation({
    mutationFn: () => api(`/profiles/${encodeURIComponent(p.uusername)}/follow/`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })
  return (
    <li className="flex items-center gap-3">
      <Avatar src={p.avatar} name={p.uusername} className="size-10" />
      <Link to={`/u/${p.uusername}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
        {p.uusername}
      </Link>
      <button
        type="button"
        onClick={() => follow.mutate()}
        disabled={follow.isPending || follow.isSuccess}
        className={btnSoft}
      >
        {follow.isSuccess ? 'Ви підписані' : 'Підписатися'}
      </button>
    </li>
  )
}

export function RightColumn() {
  const me = useMe().data
  const [people, setPeople] = useState<PeopleKind | null>(null)
  const rec = useQuery({
    queryKey: ['recommended'],
    queryFn: () => api<ProfileMini[]>('/profiles/recommended/'),
    staleTime: 5 * 60_000,
  })

  if (!me) return null

  return (
    <aside className="sticky top-24 space-y-4">
      <section className={`${card} p-4`} aria-label="Мій профіль">
        <div className="flex items-center gap-3">
          <Avatar src={me.avatar} name={me.uusername} className="size-14" />
          <div className="min-w-0">
            <Link to="/me" className="block truncate font-semibold hover:underline">{me.uusername}</Link>
            {me.bio && <p className="line-clamp-2 text-sm text-stone-600">{me.bio}</p>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 text-center">
          <Stat value={me.publications_count} label="публікацій" />
          <Stat value={me.followers_count} label="підписників" onClick={() => setPeople('followers')} />
          <Stat value={me.following_count} label="підписок" onClick={() => setPeople('following')} />
        </div>
      </section>

      {rec.data && rec.data.length > 0 && (
        <section className={`${card} p-4`} aria-labelledby="rec-title">
          <h2 id="rec-title" className="mb-3 font-semibold">Кого читати</h2>
          <ul className="space-y-3">
            {rec.data.map((p) => <Suggested key={p.id} p={p} />)}
          </ul>
        </section>
      )}

      <PeopleDialog uusername={me.uusername} kind={people} onClose={() => setPeople(null)} />
    </aside>
  )
}