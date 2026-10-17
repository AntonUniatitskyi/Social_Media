import { useEffect, useRef, useState } from 'react'
import { refreshAccess, tokens } from '../api/client'

export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'denied' | 'expired'
type Internal = { type: 'reconnected' } | { type: 'kicked' }

export function useSocket<E extends { type: string }>(
  path: string,
  onEvent: (e: E | Internal) => void,
): SocketStatus {
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
      const socket = new WebSocket(`${scheme}://${location.host}${path}?token=${token}`)
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
        try { handler.current(JSON.parse(e.data) as E) } catch { /* битый кадр */ }
      }

      socket.onclose = async (e) => {
        clearInterval(ping)
        if (stopped) return
        if (e.code === 4403) { handler.current({ type: 'kicked' }); return }
        if (e.code === 4404) { setStatus('denied'); return }
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
  }, [path])

  return status
}