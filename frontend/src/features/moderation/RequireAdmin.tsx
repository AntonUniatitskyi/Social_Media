import { Navigate, Outlet } from 'react-router-dom'
import { useMe } from '../auth/auth'

export function RequireAdmin() {
  const me = useMe().data
  return me?.is_site_admin ? <Outlet /> : <Navigate to="/" replace />
}