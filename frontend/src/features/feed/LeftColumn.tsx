import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { api } from '../../api/client'
import type { Invitation, Paginated } from '../../api/types'
import { Avatar } from '../ui/Avatar'
import { btnDark, btnSoft, card, focusRing } from '../ui/cls'

export function InviteItem({ invite }: { invite: Invitation }) {
  const qc = useQueryClient()
  const done = () => {
    qc.invalidateQueries({ queryKey: ['invitations'] })
    qc.invalidateQueries({ queryKey: ['chats'] })
  }
  const accept = useMutation({
    mutationFn: () => api(`/invitations/${invite.id}/accept/`, { method: 'POST' }),
    onSuccess: done,
  })
  const decline = useMutation({
    mutationFn: () => api(`/invitations/${invite.id}/decline/`, { method: 'POST' }),
    onSuccess: done,
  })
  const busy = accept.isPending || decline.isPending

  return (
    <li className="rounded-xl border border-sand bg-white p-3">
      <div className="flex items-start gap-2.5">
        <Avatar src={invite.from_user.avatar} name={invite.from_user.uusername} className="size-9" />
        <p className="text-sm leading-snug">
          <span className="font-semibold">{invite.from_user.uusername}</span> запрошує вас до чату «
          {invite.chat_title ?? 'без назви'}»
        </p>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => accept.mutate()} disabled={busy} className={`${btnDark} flex-1`}>Прийняти</button>
        <button onClick={() => decline.mutate()} disabled={busy} className={`${btnSoft} flex-1`}>Відхилити</button>
      </div>
    </li>
  )
}

export function LeftColumn() {
  const navigate = useNavigate()
  const favorites = useMutation({
    mutationFn: () => api<{ group_name: string }>('/chats/favorites/', { method: 'POST' }),
    onSuccess: (c) => navigate(`/chats/${c.group_name}`),
  })
  const invites = useQuery({
    queryKey: ['invitations'],
    queryFn: () => api<Paginated<Invitation>>('/invitations/'),
  })
  const list = invites.data?.results ?? []

  return (
    <aside className="sticky top-24 space-y-4">
      <button
        type="button"
        onClick={() => favorites.mutate()}
        disabled={favorites.isPending}
        className={`${card} flex w-full items-center gap-3 px-4 py-3 text-left font-medium transition-colors hover:bg-white ${focusRing}`}
      >
        <Star className="size-5 text-amber-500" fill="currentColor" />
        Вибране
      </button>

      {list.length > 0 && (
        <section aria-labelledby="invites-title" className={`${card} p-4`}>
          <h2 id="invites-title" className="mb-3 font-semibold">Запрошення до груп</h2>
          <ul className="space-y-3">
            {list.map((i) => <InviteItem key={i.id} invite={i} />)}
          </ul>
        </section>
      )}
    </aside>
  )
}