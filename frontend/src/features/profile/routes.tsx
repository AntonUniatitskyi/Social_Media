import { Navigate, useParams } from 'react-router-dom'
import { useMe } from '../auth/auth'
import { ProfilePage } from './ProfilePage'

export function MyProfileRoute() {
  const me = useMe().data
  return me ? <ProfilePage uusername={me.uusername} isMine /> : null
}

export function ProfileRoute() {
  const { uusername = '' } = useParams()
  const me = useMe().data
  // свой профиль всегда живёт на /me: одно место для редактирования
  if (me && me.uusername.toLowerCase() === uusername.toLowerCase()) return <Navigate to="/me" replace />
  return <ProfilePage uusername={uusername} />
}