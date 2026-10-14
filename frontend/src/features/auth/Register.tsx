import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock, Mail, User } from 'lucide-react'
import { fieldErrors, register } from './auth'
import { AuthLayout, linkCls, submitBtn } from './AuthLayout'
import { InputBox } from './InputBox'

export function Register() {
  const [form, setForm] = useState({ email: '', username: '', password: '', password2: '' })
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const navigate = useNavigate()
  const qc = useQueryClient()

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const m = useMutation({
    mutationFn: () => register(form),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] })
      navigate('/')
    },
  })

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.password2) {
      setLocalErrors({ password2: 'Паролі не збігаються' })
      return
    }
    setLocalErrors({})
    m.mutate()
  }

  const errs = { ...fieldErrors(m.error), ...localErrors }
  const general = m.error && Object.keys(fieldErrors(m.error)).length === 0
    ? 'Щось пішло не так'
    : null

  return (
    <AuthLayout
      title="Реєстрація"
      footer={<>Є акаунт? <Link to="/login" className={linkCls}>Увійти</Link></>}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <InputBox label="Пошта" icon={Mail} type="email" autoComplete="email"
          value={form.email} onChange={set('email')} error={errs.email} />
        <InputBox label="Юзернейм" icon={User} autoComplete="username"
          value={form.username} onChange={set('username')} error={errs.username} />
        <InputBox label="Пароль" icon={Lock} type="password" autoComplete="new-password"
          value={form.password} onChange={set('password')} error={errs.password} />
        <InputBox label="Повторіть пароль" icon={Lock} type="password" autoComplete="new-password"
          value={form.password2} onChange={set('password2')} error={errs.password2} />
        {general && (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{general}</p>
        )}
        <button type="submit" disabled={m.isPending} className={submitBtn}>
          {m.isPending ? 'Створюємо…' : 'Зареєструватись'}
        </button>
      </form>
    </AuthLayout>
  )
}