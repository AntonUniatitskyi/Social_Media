import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { api } from '../../api/client'
import type { Chat } from '../../api/types'
import { fieldErrors } from '../auth/auth'
import { Avatar } from '../ui/Avatar'
import { btnDark, btnSoft, focusRing, iconBtn } from '../ui/cls'
import { Dialog } from '../ui/Dialog'

const input =
  'w-full rounded-xl border bg-white/70 px-3.5 py-2.5 outline-none transition focus:border-clay focus:ring-[3px] focus:ring-clay/20'

export function GroupSettingsDialog({ chat, myNick, open, onClose }: {
  chat: Chat
  myNick?: string
  open: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Налаштування групи">
      <Body chat={chat} myNick={myNick} onClose={onClose} />
    </Dialog>
  )
}

function Body({ chat, myNick, onClose }: { chat: Chat; myNick?: string; onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const enc = encodeURIComponent(chat.group_name)
  const [name, setName] = useState(chat.title)
  const [nick, setNick] = useState('')
  const [invited, setInvited] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['chat', chat.group_name] })
    qc.invalidateQueries({ queryKey: ['chats'] })
  }
  const done = () => {
    qc.invalidateQueries({ queryKey: ['chats'] })
    onClose()
    navigate('/chats', { replace: true })
  }

  const rename = useMutation({
    mutationFn: () => api<Chat>(`/chats/${enc}/`, { method: 'PATCH', body: JSON.stringify({ group_chat_name: name.trim() }) }),
    onSuccess: refresh,
  })
  const invite = useMutation({
    mutationFn: () => api(`/chats/${enc}/invite/`, { method: 'POST', body: JSON.stringify({ uusername: nick.trim() }) }),
    onSuccess: () => { setNick(''); setInvited(true) },
  })
  const kick = useMutation({
    mutationFn: (userId: number) => api<void>(`/chats/${enc}/members/${userId}/`, { method: 'DELETE' }),
    onSuccess: refresh,
  })
  const leave = useMutation({ mutationFn: () => api<void>(`/chats/${enc}/leave/`, { method: 'POST' }), onSuccess: done })
  const destroy = useMutation({ mutationFn: () => api<void>(`/chats/${enc}/`, { method: 'DELETE' }), onSuccess: done })

  const finalAction = chat.is_admin ? destroy : leave
  const renameError = fieldErrors(rename.error).group_chat_name ?? (rename.isError ? 'Не вдалося зберегти назву.' : null)
  const inviteError = fieldErrors(invite.error).uusername ?? (invite.isError ? 'Не вдалося надіслати запрошення.' : null)

  return (
    <div className="space-y-5">
      {chat.is_admin && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (name.trim() && name.trim() !== chat.title && !rename.isPending) rename.mutate() }}
          className="space-y-1.5"
        >
          <label htmlFor="g-name" className="block text-sm font-medium">Назва</label>
          <div className="flex gap-2">
            <input id="g-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={128} className={`${input} border-sand`} />
            <button type="submit" disabled={!name.trim() || name.trim() === chat.title || rename.isPending} className={btnDark}>
              Зберегти
            </button>
          </div>
          {renameError && <p role="alert" className="text-sm text-red-800">{renameError}</p>}
        </form>
      )}

      <section aria-labelledby="g-members">
        <h3 id="g-members" className="mb-2 text-sm font-medium">Учасники, {chat.members.length}</h3>
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {chat.members.map((m) => {
            const isGroupAdmin = m.id === chat.admin_id
            return (
              <li key={m.id} className="flex items-center gap-3 rounded-lg p-1.5">
                <Avatar src={m.avatar} name={m.uusername} className="size-9" />
                <Link to={m.uusername === myNick ? '/me' : `/u/${m.uusername}`} onClick={onClose} className={`min-w-0 flex-1 truncate font-medium hover:underline ${focusRing}`}>
                  {m.uusername}
                </Link>
                {isGroupAdmin && <span className="text-xs text-stone-600">адміністратор</span>}
                {chat.is_admin && !isGroupAdmin && (
                  <button
                    type="button"
                    onClick={() => kick.mutate(m.id)}
                    disabled={kick.isPending}
                    aria-label={`Видалити ${m.uusername} з групи`}
                    className={`${iconBtn} size-8`}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        {kick.isError && <p role="alert" className="mt-1 text-sm text-red-800">Не вдалося видалити учасника.</p>}
      </section>

      {chat.is_admin && (
        <form
          onSubmit={(e) => { e.preventDefault(); setInvited(false); if (nick.trim() && !invite.isPending) invite.mutate() }}
          className="space-y-1.5"
        >
          <label htmlFor="g-invite" className="block text-sm font-medium">Запросити за ніком</label>
          <div className="flex gap-2">
            <input id="g-invite" value={nick} onChange={(e) => { setNick(e.target.value); setInvited(false) }} autoComplete="off" className={`${input} border-sand`} />
            <button type="submit" disabled={!nick.trim() || invite.isPending} className={btnSoft}>Запросити</button>
          </div>
          {inviteError && <p role="alert" className="text-sm text-red-800">{inviteError}</p>}
          {invited && <p role="status" className="text-sm text-stone-600">Запрошення надіслано.</p>}
        </form>
      )}

      <div className="border-t border-sand pt-4">
        {!confirm ? (
          <button type="button" onClick={() => setConfirm(true)} className={`text-sm font-medium text-red-700 hover:underline ${focusRing}`}>
            {chat.is_admin ? 'Видалити чат' : 'Покинути чат'}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-stone-700">
              {chat.is_admin
                ? 'Чат і всі повідомлення буде видалено для всіх учасників.'
                : 'Ви більше не бачитимете цей чат, доки вас не запросять знову.'}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirm(false)} className={btnSoft}>Скасувати</button>
              <button
                type="button"
                onClick={() => finalAction.mutate()}
                disabled={finalAction.isPending}
                className={`rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-800 disabled:opacity-60 ${focusRing}`}
              >
                {chat.is_admin ? 'Видалити' : 'Покинути'}
              </button>
            </div>
            {finalAction.isError && <p role="alert" className="text-sm text-red-800">Не вдалося виконати дію. Спробуйте ще раз.</p>}
          </div>
        )}
      </div>
    </div>
  )
}