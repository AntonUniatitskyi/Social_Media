import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, tokens } from '../../api/client'
import type { Profile } from '../../api/types'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<Profile>('/profiles/me/'),
    retry: false,
    staleTime: Infinity,
  })
}

export async function login(username: string, password: string) {
  const d = await api<{ access: string; refresh: string }>(
    '/auth/token/',
    { method: 'POST', body: JSON.stringify({ username, password }) },
    false, // при неверном пароле 401 не пытаемся «обновлять токен»
  )
  tokens.setAccess(d.access)
  tokens.setRefresh(d.refresh)
}

// ВАЖНО: имена полей должны совпадать с сериализатором RegisterView.
// Если там не password2 — поправь здесь и в Register.tsx.
export interface RegisterPayload {
  email: string
  username: string
  password: string
  password2: string
}

export async function register(p: RegisterPayload) {
  await api('/auth/register/', { method: 'POST', body: JSON.stringify(p) }, false)
  await login(p.username, p.password)
}

/** DRF отдаёт 400 {"email": ["..."], "password": ["..."]} -> {email: "...", password: "..."} */
export function fieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (err instanceof ApiError && err.status === 400 && err.data && typeof err.data === 'object') {
    for (const [k, v] of Object.entries(err.data as Record<string, unknown>)) {
      const msg = Array.isArray(v) ? v[0] : v
      if (typeof msg === 'string') out[k] = msg
    }
  }
  return out
}

export function useLogout() {
  const qc = useQueryClient()
  return () => {
    tokens.setAccess(null)
    tokens.setRefresh(null)
    qc.clear()
  }
}