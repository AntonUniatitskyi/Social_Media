import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CirclePlus, House, MessageCircle, Search, ShieldCheck, type LucideIcon } from 'lucide-react'
import { api } from '../../api/client'
import { setTitleUnread } from '../../lib/title'
import { useSocket } from '../../lib/useSocket'
import { useMe } from '../auth/auth'
import { Avatar } from '../ui/Avatar'
import { focusRing } from '../ui/cls'

type Badge = 'chats' | 'notifications' | 'moderation'
type Item = { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: Badge }
type UserEvent =
  | { type: 'inbox'; group_name: string | null }
  | { type: 'notification' }
  | { type: 'ready' }
  | { type: 'pong' }
  | { type: 'reconnected' }
  | { type: 'kicked' }

const items: Item[] = [
  { to: '/', label: 'Головна', icon: House, end: true },
  { to: '/create', label: 'Додати', icon: CirclePlus },
  { to: '/chats', label: 'Чати', icon: MessageCircle, badge: 'chats' },
  { to: '/search', label: 'Пошук', icon: Search },
  { to: '/notifications', label: 'Сповіщення', icon: Bell, badge: 'notifications' },
]

const adminItem: Item = { to: '/moderation', label: 'Модерація', icon: ShieldCheck, badge: 'moderation' }

function useHeaderVisible() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      setVisible(y < last || y < 10)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return visible
}

// Один сокет на всё приложение: пока он открыт, вы «в мережі». Пачки сигналов склеиваем в один запрос.
function useInboxSocket() {
  const qc = useQueryClient()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  useSocket<UserEvent>('/ws/v1/me/', (e) => {
    if (e.type === 'notification' || e.type === 'reconnected') {
      qc.invalidateQueries({ queryKey: ['unread'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    }
    if (e.type !== 'inbox' && e.type !== 'reconnected') return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      qc.invalidateQueries({ queryKey: ['chats'] })
      qc.invalidateQueries({ queryKey: ['chats-unread'] })
      qc.invalidateQueries({ queryKey: ['invitations'] })
    }, 250)
  })
}

function NavItem({ item, count }: { item: Item; count: number }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      aria-label={count > 0 ? `${item.label}, нових: ${count}` : item.label}
      className={({ isActive }) =>
        `relative grid size-11 place-items-center rounded-xl transition-colors ${focusRing} ${
          isActive ? 'bg-sand/60 text-bark' : 'text-stone-600 hover:bg-sand/40 hover:text-bark'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <item.icon className="size-6" strokeWidth={isActive ? 2.4 : 1.8} />
          {count > 0 && (
            <span aria-hidden className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-medium leading-4 text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export function AppShell() {
  useInboxSocket()
  const visible = useHeaderVisible()
  const me = useMe().data
  const isAdmin = !!me?.is_site_admin

  const notifications = useQuery({
    queryKey: ['unread'],
    queryFn: () => api<{ unread: number }>('/notifications/unread-count/'),
  })
  const chats = useQuery({
    queryKey: ['chats-unread'],
    queryFn: () => api<{ unread: number }>('/chats/unread-count/'),
  })
  const moderation = useQuery({
    queryKey: ['moderation-count'],
    queryFn: () => api<{ pending: number }>('/moderation/count/'),
    enabled: isAdmin,                         // у обычных пользователей запроса нет вообще
    refetchInterval: 60_000,
  })

  const counts: Record<Badge, number> = {
    notifications: notifications.data?.unread ?? 0,
    chats: chats.data?.unread ?? 0,
    moderation: moderation.data?.pending ?? 0,
  }

  // в заголовок вкладки идут только уведомления и чаты, очередь модерации туда не входит
  const totalUnread = counts.notifications + counts.chats
  useEffect(() => {
    setTitleUnread(totalUnread)
    return () => setTitleUnread(0)            // при выходе из аккаунта счётчик пропадает
  }, [totalUnread])

  const navItems = isAdmin ? [...items, adminItem] : items
  const countOf = (i: Item) => (i.badge ? counts[i.badge] : 0)

  return (
    <div className="min-h-dvh pb-24 pt-24 text-bark sm:pb-10">
      <header
        className={`fixed inset-x-3 top-3 z-40 mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-2xl border border-sand bg-cream/90 py-2 pl-5 pr-3 shadow-sm backdrop-blur transition-transform duration-300 ${
          visible ? '' : '-translate-y-24'
        }`}
      >
        <Link to="/" className="font-brand text-2xl leading-none text-bark">Roon</Link>
        <nav aria-label="Основна навігація" className="hidden gap-1 sm:flex">
          {navItems.map((i) => <NavItem key={i.to} item={i} count={countOf(i)} />)}
        </nav>
        <Link to="/me" aria-label="Мій профіль" className={`rounded-full ${focusRing}`}>
          <Avatar src={me?.avatar} name={me?.username} className="size-9" />
        </Link>
      </header>

      <Outlet />

      <nav
        aria-label="Навігація"
        className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-sand bg-cream/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur sm:hidden"
      >
        {navItems.map((i) => <NavItem key={i.to} item={i} count={countOf(i)} />)}
      </nav>
    </div>
  )
}