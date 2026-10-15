import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { ArrowLeft, Settings } from 'lucide-react'
import { api, ApiError } from '../../api/client'
import type { Chat, ChatMessage, CursorPage } from '../../api/types'
import { useMe } from '../auth/auth'
import { btnDark, iconBtn } from '../ui/cls'
import { ChatAvatar, chatPeer, isFavorites } from './ChatAvatar'
import { Composer } from './Composer'
import { GroupSettingsDialog } from './GroupSettings'
import { MessageList } from './MessageList'
import { useChatSocket, type SocketStatus } from './useChatSocket'

function membersLabel(n: number) {
  const m10 = n % 10
  const m100 = n % 100
  const word =
    m10 === 1 && m100 !== 11 ? 'учасник'
    : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? 'учасники'
    : 'учасників'
  return `${n} ${word}`
}

// «у чаті» = є відкрите з’єднання саме з цим чатом, а не «онлайн у застосунку»
function statusText(status: SocketStatus, chat: Chat, online: number[], myNick?: string) {
  if (status === 'connecting') return 'З’єднання…'
  if (status === 'reconnecting') return 'Немає зв’язку, перепідключення…'
  if (status === 'denied' || status === 'expired') return ''
  const peer = chatPeer(chat, myNick)
  if (peer) return online.includes(peer.id) ? 'зараз у чаті' : ''
  if (isFavorites(chat)) return 'Ваші нотатки'
  return online.length > 1
    ? `${membersLabel(chat.members.length)}, ${online.length} у чаті`
    : membersLabel(chat.members.length)
}

export function ChatRoomRoute() {
  const { groupName = '' } = useParams()
  return <ChatRoom key={groupName} groupName={groupName} />   // key: при смене чата всё состояние начинается заново
}

function ChatRoom({ groupName }: { groupName: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const me = useMe().data
  const scroller = useRef<HTMLUListElement>(null)
  const [online, setOnline] = useState<number[]>([])
  const [settings, setSettings] = useState(false)

  const chat = useQuery({
    queryKey: ['chat', groupName],
    queryFn: () => api<Chat>(`/chats/${encodeURIComponent(groupName)}/`),
    retry: (n, err) => !(err instanceof ApiError && err.status === 404) && n < 2,
  })

  function addMessage(m: ChatMessage) {
    qc.setQueryData<InfiniteData<CursorPage<ChatMessage>, string>>(['messages', groupName], (old) => {
      if (!old || old.pages.some((p) => p.results.some((x) => x.id === m.id))) return old   // дедупликация
      const [first, ...rest] = old.pages
      return { ...old, pages: [{ ...first, results: [m, ...first.results] }, ...rest] }
    })
  }

  const status = useChatSocket(groupName, (e) => {
    if (e.type === 'message') {
      addMessage(e.message)
      qc.invalidateQueries({ queryKey: ['chats'] })
    } else if (e.type === 'presence') {
      setOnline(e.online)
    } else if (e.type === 'kicked') {
      qc.invalidateQueries({ queryKey: ['chats'] })
      navigate('/chats', { replace: true })
    } else if (e.type === 'reconnected') {
      qc.invalidateQueries({ queryKey: ['messages', groupName] })   // докачиваем то, что пришло, пока были офлайн
      qc.invalidateQueries({ queryKey: ['chat', groupName] })
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
  const group = !c.is_private

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
        {group && (
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

      <MessageList groupName={groupName} group={group || isFavorites(c)} myNick={me?.uusername} scrollerRef={scroller} />

      <Composer
        groupName={groupName}
        onSent={(m) => {
          addMessage(m)
          qc.invalidateQueries({ queryKey: ['chats'] })
          scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />

      {group && <GroupSettingsDialog chat={c} myNick={me?.uusername} open={settings} onClose={() => setSettings(false)} />}
    </>
  )
}