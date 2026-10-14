import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, CirclePlus, House, MessageCircle, Search, type LucideIcon } from 'lucide-react'
import { api } from '../../api/client'
import { useMe } from '../auth/auth'
import { Avatar } from '../ui/Avatar'
import { focusRing } from '../ui/cls'

type Item = { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: boolean }

const items: Item[] = [
  { to: '/', label: 'Головна', icon: House, end: true },
  { to: '/create', label: 'Додати', icon: CirclePlus },
  { to: '/chats', label: 'Чати', icon: MessageCircle },
  { to: '/search', label: 'Пошук', icon: Search },
  { to: '/notifications', label: 'Сповіщення', icon: Bell, badge: true },
]

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

function NavItem({ item, unread }: { item: Item; unread: number }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      aria-label={item.label}
      className={({ isActive }) =>
        `relative grid size-11 place-items-center rounded-xl transition-colors ${focusRing} ${
          isActive ? 'bg-sand/60 text-bark' : 'text-stone-600 hover:bg-sand/40 hover:text-bark'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <item.icon className="size-6" strokeWidth={isActive ? 2.4 : 1.8} />
          {item.badge && unread > 0 && (
            <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-medium leading-4 text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export function AppShell() {
  const visible = useHeaderVisible()
  const me = useMe().data
  const unread = useQuery({
    queryKey: ['unread'],
    queryFn: () => api<{ unread: number }>('/notifications/unread-count/'),
    refetchInterval: 60_000,
  })
  const count = unread.data?.unread ?? 0

  return (
    <div className="min-h-dvh pb-24 pt-24 text-bark sm:pb-10">
      <header
        className={`fixed inset-x-3 top-3 z-40 mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-2xl border border-sand bg-cream/90 py-2 pl-5 pr-3 shadow-sm backdrop-blur transition-transform duration-300 ${
          visible ? '' : '-translate-y-24'
        }`}
      >
        <Link to="/" className="font-brand text-2xl leading-none text-bark">
          Roon
        </Link>
        <nav aria-label="Основна навігація" className="hidden gap-1 sm:flex">
          {items.map((i) => <NavItem key={i.to} item={i} unread={count} />)}
        </nav>
        <Link to="/me" aria-label="Мій профіль" className={`rounded-full ${focusRing}`}>
          <Avatar src={me?.avatar} name={me?.uusername} className="size-9" />
        </Link>
      </header>

      <Outlet />

      <nav
        aria-label="Навігація"
        className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-sand bg-cream/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur sm:hidden"
      >
        {items.map((i) => <NavItem key={i.to} item={i} unread={count} />)}
      </nav>
    </div>
  )
}