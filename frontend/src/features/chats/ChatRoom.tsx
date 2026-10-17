import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { ArrowLeft, Settings } from 'lucide-react'
import { api, ApiError } from '../../api/client'
import type { Chat, ChatMessage, CursorPage } from '../../api/types'
import { useMe } from '../auth/auth'
import { btnDark, btnSoft, focusRing, iconBtn } from '../ui/cls'
import { Dialog } from '../ui/Dialog'
import { ChatAvatar, chatPeer, isFavorites } from './ChatAvatar'
import { Composer } from './Composer'
import { GroupSettingsDialog } from './GroupSettings'
import { MessageList } from './MessageList'
import { useChatSocket, type SocketStatus } from './useChatSocket'
import { useTitle } from "../../lib/title"

function membersLabel(n: number) {
  const m10 = n % 10
  const m100 = n % 100
  const word =
    m10 === 1 && m100 !== 11 ? 'учасник'
    : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? 'учасники'
    : 'учасників'
  return `${n} ${word}`
}

// «в мережі» = у человека открыто приложение (хотя бы одна вкладка), а не конкретный чат
function statusText(status: SocketStatus, chat: Chat, online: number[], myNick?: string) {
  if (status === 'connecting') return 'З’єднання…'
  if (status === 'reconnecting') return 'Немає зв’язку, перепідключення…'
  if (status === 'denied' || status === 'expired') return ''
  if (chat.is_public) return 'Спільний чат для всіх'
  const peer = chatPeer(chat, myNick)
  if (peer) return online.includes(peer.id) ? 'в мережі' : ''
  if (isFavorites(chat)) return 'Ваші нотатки'
  const n = membersLabel(chat.members.length)
  return online.length > 0 ? `${n}, ${online.length} в мережі` : n
}

export function ChatRoomRoute() {
  const { groupName = '' } = useParams()
  return <ChatRoom key={groupName} groupName={groupName} />
}

function ChatRoom({ groupName }: { groupName: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const me = useMe().data
  const scroller = useRef<HTMLUListElement>(null)
  const [online, setOnline] = useState<number[]>([])
  const [settings, setSettings] = useState(false)
  const [readTick, setReadTick] = useState(0)

  const chat = useQuery({
    queryKey: ['chat', groupName],
    queryFn: () => api<Chat>(`/chats/${encodeURIComponent(groupName)}/`),
    retry: (n, err) => !(err instanceof ApiError && err.status === 404) && n < 2,
  })

  useTitle(chat.data?.title)

  const [deleting, setDeleting] = useState<ChatMessage | null>(null)

  function removeMessage(id: number) {
    qc.setQueryData<InfiniteData<CursorPage<ChatMessage>, string>>(['messages', groupName], (old) =>
      old && { ...old, pages: old.pages.map((p) => ({ ...p, results: p.results.filter((x) => x.id !== id) })) }
    )
  }

  const del = useMutation({
    mutationFn: (id: number) =>
      api<void>(`/chats/${encodeURIComponent(groupName)}/messages/${id}/`, { method: 'DELETE' }),
    onSuccess: (_d, id) => { removeMessage(id); setDeleting(null) },
  })

  // Отмечаем прочитанным: при открытии, при новых сообщениях и когда вкладка снова видна.
  // В скрытой вкладке не отмечаем: иначе сообщения «прочитаются» без вас.
  useEffect(() => {
    if (document.visibilityState !== 'visible') return
    const t = setTimeout(() => {
      api<void>(`/chats/${encodeURIComponent(groupName)}/read/`, { method: 'POST' }).catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [groupName, readTick])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setReadTick((t) => t + 1) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  function addMessage(m: ChatMessage) {
    qc.setQueryData<InfiniteData<CursorPage<ChatMessage>, string>>(['messages', groupName], (old) => {
      if (!old || old.pages.some((p) => p.results.some((x) => x.id === m.id))) return old
      const [first, ...rest] = old.pages
      return { ...old, pages: [{ ...first, results: [m, ...first.results] }, ...rest] }
    })
  }

  const status = useChatSocket(groupName, (e) => {
    if (e.type === 'message') {
      addMessage(e.message)
      setReadTick((t) => t + 1)
    } else if (e.type === 'presence') {
      setOnline(e.online)
    } else if (e.type === 'kicked') {
      qc.invalidateQueries({ queryKey: ['chats'] })
      navigate('/chats', { replace: true })
    } else if (e.type === 'reconnected') {
      qc.invalidateQueries({ queryKey: ['messages', groupName] })
      qc.invalidateQueries({ queryKey: ['chat', groupName] })
      setReadTick((t) => t + 1)
    } else if (e.type === 'message_deleted') {
      removeMessage(e.id)
    }
  })

  if (chat.isPending) return <div className="grid flex-1 place-items-center text-stone-500">Завантаження…</div>

  if (chat.isError) {
    return (
      <div role="alert" className="grid flex-1 place-items-center p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold">Чат недоступний</h1>
          <p className="mt-1 text-sm text-stone-600">Його могли видалити, або вас виключили з нього.</p>
          <Link to="/chats" className={`${btnDark} mt-4 inline-block`}>До списку чатів</Link>
        </div>
      </div>
    )
  }

  const c = chat.data
  const peer = chatPeer(c, me?.uusername)
  const editable = !c.is_private && !c.is_public       // настройки есть только у обычных групп

  return (
    <>
      <header className="flex items-center gap-3 border-b border-sand px-3 py-2.5">
        <Link to="/chats" aria-label="До списку чатів" className={`${iconBtn} md:hidden`}>
          <ArrowLeft className="size-5" />
        </Link>
        <ChatAvatar chat={c} myNick={me?.uusername} className="size-10" />
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="truncate font-semibold">
            {peer ? <Link to={`/u/${peer.uusername}`} className="hover:underline">{c.title}</Link> : c.title}
          </h1>
          <p aria-live="polite" className="h-4 text-xs text-stone-600">{statusText(status, c, online, me?.uusername)}</p>
        </div>
        {editable && (
          <button type="button" onClick={() => setSettings(true)} aria-label="Налаштування групи" className={iconBtn}>
            <Settings className="size-5" />
          </button>
        )}
      </header>

      {(status === 'denied' || status === 'expired') && (
        <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-800">
          {status === 'expired' ? (
            <>Сесія завершилась. <Link to="/login" className="font-semibold underline">Увійти знову</Link></>
          ) : (
            'Доступ до чату втрачено.'
          )}
        </p>
      )}

      <MessageList
        groupName={groupName}
        group={!peer}
        myNick={me?.uusername}
        scrollerRef={scroller}
        onDelete={c.is_public && me?.is_site_admin ? setDeleting : undefined}
      />

      <Composer
        groupName={groupName}
        onSent={(m) => {
          addMessage(m)
          scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />

      {editable && <GroupSettingsDialog chat={c} myNick={me?.uusername} open={settings} onClose={() => setSettings(false)} />}

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title="Видалити повідомлення?">
        {deleting && (
          <>
            <p className="break-words rounded-xl bg-sand/40 px-3 py-2 text-sm">{deleting.body ?? deleting.filename}</p>
            <p className="mt-3 text-sm text-stone-600">Воно зникне в усіх учасників чату.</p>
            {del.isError && <p role="alert" className="mt-3 text-sm text-red-800">Не вдалося видалити. Спробуйте ще раз.</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleting(null)} className={btnSoft}>Скасувати</button>
              <button
                type="button"
                onClick={() => del.mutate(deleting.id)}
                disabled={del.isPending}
                className={`rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-800 disabled:opacity-60 ${focusRing}`}
              >
                {del.isPending ? 'Видаляємо…' : 'Видалити'}
              </button>
            </div>
          </>
        )}
      </Dialog>
    </>
  )
}