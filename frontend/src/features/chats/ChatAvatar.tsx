import { Globe, Star, Users } from 'lucide-react'
import type { Chat, ChatMember } from '../../api/types'
import { Avatar } from '../ui/Avatar'

export function chatPeer(chat: Chat, myNick?: string): ChatMember | null {
  if (!chat.is_private || chat.members.length !== 2) return null
  return chat.members.find((m) => m.uusername !== myNick) ?? null
}

export const isFavorites = (chat: Chat) => chat.is_favorites

export function ChatAvatar({ chat, myNick, className = 'size-11' }: {
  chat: Chat
  myNick?: string
  className?: string
}) {
  const peer = chatPeer(chat, myNick)
  if (peer) return <Avatar src={peer.avatar} name={peer.username} className={className} />
  const Icon = chat.is_public ? Globe : isFavorites(chat) ? Star : Users
  return (
    <span aria-hidden className={`${className} grid shrink-0 place-items-center rounded-full bg-sand text-clay`}>
      <Icon className="size-1/2" />
    </span>
  )
}