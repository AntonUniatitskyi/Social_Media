import { useEffect, useRef, useState } from 'react'
import { refreshAccess, tokens } from '../../api/client'
import type { ChatMessage } from '../../api/types'

export type ChatEvent =
  | { type: 'message'; message: ChatMessage }
  | { type: 'presence'; online: number[] }
  | { type: 'kicked' }
  | { type: 'reconnected' }          // синтетическое: докачиваем пропущенное
  | { type: 'pong' }
  | { type: 'error'; detail: string }

export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'denied' | 'expired'

export function useChatSocket(groupName: string, onEvent: (e: ChatEvent) => void) {
  const [status, setStatus] = useState<SocketStatus>('connecting')
  const handler = useRef(onEvent)
  useEffect(() => { handler.current = onEvent })

  useEffect(() => {
    let ws: WebSocket | null = null
    let stopped = false
    let everOpened = false
    let attempt = 0
    let retry: ReturnType<typeof setTimeout> | undefined
    let ping: ReturnType<typeof setInterval> | undefined

    const connect = () => {
      if (stopped) return
      const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
      const token = encodeURIComponent(tokens.getAccess() ?? '')
      const socket = new WebSocket(
        `${scheme}://${location.host}/ws/v1/chats/${encodeURIComponent(groupName)}/?token=${token}`,
      )
      ws = socket

      socket.onopen = () => {
        attempt = 0
        setStatus('open')
        if (everOpened) handler.current({ type: 'reconnected' })
        everOpened = true
        ping = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send('{"type":"ping"}')
        }, 30_000)
      }

      socket.onmessage = (e) => {
        try { handler.current(JSON.parse(e.data) as ChatEvent) } catch { /* битый кадр */ }
      }

      socket.onclose = async (e) => {
        clearInterval(ping)
        if (stopped) return
        if (e.code === 4403) { handler.current({ type: 'kicked' }); return }   // вас исключили
        if (e.code === 4404) { setStatus('denied'); return }                    // нет чата или доступа
        setStatus('reconnecting')
        if (e.code === 4401 && !(await refreshAccess())) { setStatus('expired'); return }
        if (stopped) return
        retry = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 15_000))
      }
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(retry)
      clearInterval(ping)
      ws?.close()
    }
  }, [groupName])

  return status
}