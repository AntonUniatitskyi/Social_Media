import { useEffect } from 'react'

const APP = 'Roon'
let base = APP
let unread = 0

function apply() {
  const badge = unread > 0 ? `(${unread > 99 ? '99+' : unread}) ` : ''
  document.title = badge + base
}

export function useTitle(title?: string) {
  useEffect(() => {
    base = title ? `${title} · ${APP}` : APP
    apply()
  }, [title])
}

export function setTitleUnread(n: number) {
  unread = n
  apply()
}