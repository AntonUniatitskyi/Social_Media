import type { ChatMessage } from '../../api/types'
import { useSocket, type SocketStatus } from '../../lib/useSocket'

export type { SocketStatus }

export type ChatEvent =
  | { type: 'message'; message: ChatMessage }
  | { type: 'presence'; online: number[] }
  | { type: 'kicked' }
  | { type: 'reconnected' }
  | { type: 'pong' }
  | { type: 'error'; detail: string }
  | { type: 'message_deleted'; id: number }

export function useChatSocket(
  groupName: string,
  onEvent: (e: ChatEvent) => void,
): SocketStatus {
  return useSocket<ChatEvent>(
    `/ws/v1/chats/${encodeURIComponent(groupName)}/`,
    onEvent,
  )
}