import { Navigate, Outlet } from 'react-router-dom'
import { useMe } from './auth'

export function RequireAuth() {
  const me = useMe()
  if (me.isPending) return <div className="p-8 text-zinc-400">Завантаження…</div>
  if (me.isError) return <Navigate to="/login" replace />
  return <Outlet />
}