import { Outlet, useMatch } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { card } from '../ui/cls'
import { ChatList } from './ChatList'

export function ChatsLayout() {
  const open = !!useMatch('/chats/:groupName')
  return (
    <main className="mx-auto h-[calc(100dvh-12rem)] min-h-[26rem] w-full max-w-[1000px] px-3 sm:h-[calc(100dvh-8.5rem)]">
      <div className={`${card} grid h-full grid-rows-[minmax(0,1fr)] overflow-hidden md:grid-cols-[320px_minmax(0,1fr)]`}>
        <section aria-label="Чати" className={`${open ? 'hidden md:flex' : 'flex'} min-h-0 flex-col border-sand md:border-r`}>
          <ChatList />
        </section>
        <section className={`${open ? 'flex' : 'hidden md:flex'} min-h-0 flex-col`}>
          <Outlet />
        </section>
      </div>
    </main>
  )
}

export function ChatPlaceholder() {
  return (
    <div className="grid flex-1 place-items-center p-8 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-sand/70 text-clay">
          <MessageCircle className="size-6" />
        </span>
        <h2 className="mt-3 font-semibold">Оберіть чат</h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-stone-600">
          Або відкрийте профіль людини й натисніть «Написати».
        </p>
      </div>
    </div>
  )
}