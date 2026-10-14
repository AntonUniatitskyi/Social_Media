import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock, User } from 'lucide-react'
import { ApiError } from '../../api/client'
import { login } from './auth'
import { AuthLayout, linkCls, submitBtn } from './AuthLayout'
import { InputBox } from './InputBox'

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const qc = useQueryClient()

  const m = useMutation({
    mutationFn: () => login(username, password),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] })
      navigate('/')
    },
  })

  const error = !m.error
    ? null
    : m.error instanceof ApiError && m.error.status === 401
      ? 'Невірний логін або пароль'
      : 'Щось пішло не так'

  return (
    <AuthLayout
      title="Вхід"
      footer={<>Нема акаунта? <Link to="/register" className={linkCls}>Реєстрація</Link></>}
    >
      <form
        onSubmit={(e) => { e.preventDefault(); m.mutate() }}
        className="flex flex-col gap-3.5"
      >
        <InputBox
          label="Юзернейм"
          icon={User}
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <InputBox
          label="Пароль"
          icon={Lock}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{error}</p>
        )}
        <button type="submit" disabled={m.isPending} className={submitBtn}>
          {m.isPending ? 'Входимо…' : 'Увійти'}
        </button>
      </form>
    </AuthLayout>
  )
}