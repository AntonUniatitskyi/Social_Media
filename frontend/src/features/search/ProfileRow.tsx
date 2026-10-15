import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useMe } from '../auth/auth'
import { Avatar } from '../ui/Avatar'
import { btnDark, btnSoft } from '../ui/cls'

export interface RowProfile {
  id: number
  uusername: string
  avatar: string | null
  bio?: string | null
  is_following?: boolean
}

export function ProfileRow({ p }: { p: RowProfile }) {
  const qc = useQueryClient()
  const me = useMe().data
  const [following, setFollowing] = useState(p.is_following ?? false)

  const toggle = useMutation({
    mutationFn: () =>
      api<{ is_following: boolean }>(
        `/profiles/${encodeURIComponent(p.uusername)}/${following ? 'unfollow' : 'follow'}/`,
        { method: 'POST' },
      ),
    onSuccess: (d) => {
      setFollowing(d.is_following)
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })

  const isMe = me?.id === p.id
  const link = isMe ? '/me' : `/u/${p.uusername}`

  return (
    <li className="flex items-center gap-3 p-3">
      <Link to={link} aria-hidden tabIndex={-1} className="shrink-0">
        <Avatar src={p.avatar} name={p.uusername} className="size-12" />
      </Link>
      <div className="min-w-0 flex-1 leading-tight">
        <Link to={link} className="block truncate font-semibold hover:underline">{p.uusername}</Link>
        {p.bio && <p className="mt-0.5 truncate text-sm text-stone-600">{p.bio}</p>}
      </div>
      {isMe ? (
        <span className="text-sm text-stone-500">Це ви</span>
      ) : (
        <button
          type="button"
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          className={following ? btnSoft : btnDark}
        >
          {following ? 'Відписатися' : 'Підписатися'}
        </button>
      )}
    </li>
  )
}