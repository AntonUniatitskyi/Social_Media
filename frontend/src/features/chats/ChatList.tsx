import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Star } from 'lucide-react'
import { api } from '../../api/client'
import type { Chat, Invitation, Paginated } from '../../api/types'
import { timeAgo } from '../../lib/time'
import { fieldErrors, useMe } from '../auth/auth'
import { InviteItem } from '../feed/LeftColumn'
import { btnDark, btnSoft, iconBtn, rowFocus } from '../ui/cls'
import { Dialog } from '../ui/Dialog'
import { ChatAvatar } from './ChatAvatar'

function CreateGroupForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')

  const m = useMutation({
    mutationFn: () =>
      api<Chat>('/chats/', { method: 'POST', body: JSON.stringify({ group_chat_name: name.trim() }) }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['chats'] })
      onClose()
      navigate(`/chats/${encodeURIComponent(c.group_name)}`)
    },
  })
  const error = fieldErrors(m.error).group_chat_name ?? (m.isError ? 'Не вдалося створити групу.' : null)

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (name.trim() && !m.isPending) m.mutate() }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="group-name" className="mb-1.5 block text-sm font-medium">Назва групи</label>
        <input
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={128}
          autoFocus
          autoComplete="off"
          className="w-full rounded-xl border border-sand bg-white/70 px-3.5 py-2.5 outline-none transition focus:border-clay focus:ring-[3px] focus:ring-clay/20"
        />
        {error && <p role="alert" className="mt-1.5 text-sm text-red-800">{error}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={btnSoft}>Скасувати</button>
        <button type="submit" disabled={!name.trim() || m.isPending} className={btnDark}>
          {m.isPending ? 'Створюємо…' : 'Створити'}
        </button>
      </div>
    </form>
  )
}

function RowSkeleton() {
  return (
    <li aria-hidden className="flex items-center gap-3 px-4 py-3 motion-safe:animate-pulse">
      <div className="size-11 rounded-full bg-sand/70" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-32 rounded bg-sand/70" />
        <div className="h-3 w-44 rounded bg-sand/60" />
      </div>
    </li>
  )
}

export function ChatList() {
  const me = useMe().data
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  const chats = useInfiniteQuery({
    queryKey: ['chats'],
    queryFn: ({ pageParam }) => api<Paginated<Chat>>(`/chats/?page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.next ? all.length + 1 : undefined),
    refetchInterval: 20_000,         // список не «живой»: обновляем раз в 20 секунд
  })
  const list = chats.data?.pages.flatMap((p) => p.results) ?? []

  const invites = useQuery({
    queryKey: ['invitations'],
    queryFn: () => api<Paginated<Invitation>>('/invitations/'),
  })
  const inviteList = invites.data?.results ?? []

  const favorites = useMutation({
    mutationFn: () => api<{ group_name: string }>('/chats/favorites/', { method: 'POST' }),
    onSuccess: (c) => {
      chats.refetch()
      navigate(`/chats/${encodeURIComponent(c.group_name)}`)
    },
  })

  return (
    <>
      <header className="flex items-center justify-between border-b border-sand px-4 py-3">
        <h1 className="text-lg font-semibold">Чати</h1>
        <div className="flex gap-1">
          <button type="button" onClick={() => favorites.mutate()} disabled={favorites.isPending} aria-label="Вибране" className={iconBtn}>
            <Star className="size-5" />
          </button>
          <button type="button" onClick={() => setCreating(true)} aria-label="Створити групу" className={iconBtn}>
            <Plus className="size-5" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {inviteList.length > 0 && (
          <section aria-label="Запрошення до груп" className="border-b border-sand p-3">
            <ul className="space-y-3">
              {inviteList.map((i) => <InviteItem key={i.id} invite={i} />)}
            </ul>
          </section>
        )}

        {chats.isPending && <ul>{Array.from({ length: 5 }, (_, i) => <RowSkeleton key={i} />)}</ul>}

        {chats.isError && (
          <div role="alert" className="p-5 text-center text-sm">
            <p>Не вдалося завантажити чати.</p>
            <button onClick={() => chats.refetch()} className={`${btnSoft} mt-3`}>Спробувати ще раз</button>
          </div>
        )}

        {chats.isSuccess && list.length === 0 && (
          <div className="px-6 py-12 text-center">
            <h2 className="font-semibold">Чатів поки немає</h2>
            <p className="mt-1 text-sm text-stone-600">
              Відкрийте профіль людини й натисніть «Написати» або створіть групу.
            </p>
            <button type="button" onClick={() => setCreating(true)} className={`${btnDark} mt-4`}>Створити групу</button>
          </div>
        )}

        {list.length > 0 && (
          <ul className="divide-y divide-sand">
            {list.map((c) => (
              <li key={c.group_name}>
                <NavLink
                  to={`/chats/${encodeURIComponent(c.group_name)}`}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 transition-colors hover:bg-sand/40 ${rowFocus} ${isActive ? 'bg-sand/60' : ''}`
                  }
                >
                  <ChatAvatar chat={c} myNick={me?.uusername} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{c.title}</span>
                      {c.last_message_at && (
                        <span className="shrink-0 text-xs text-stone-500">{timeAgo(c.last_message_at)}</span>
                      )}
                    </div>
                    <p className="truncate text-sm text-stone-600">
                      {c.last_message_body ?? (c.last_message_at ? 'Вкладення' : 'Повідомлень ще немає')}
                    </p>
                  </div>
                </NavLink>
              </li>
            ))}
          </ul>
        )}

        {chats.hasNextPage && (
          <div className="p-3">
            <button onClick={() => chats.fetchNextPage()} disabled={chats.isFetchingNextPage} className={`${btnSoft} w-full`}>
              Показати ще
            </button>
          </div>
        )}
      </div>

      <Dialog open={creating} onClose={() => setCreating(false)} title="Нова група">
        <CreateGroupForm onClose={() => setCreating(false)} />
      </Dialog>
    </>
  )
}