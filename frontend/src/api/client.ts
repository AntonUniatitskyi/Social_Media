const BASE = '/api/v1'

let access: string | null = null

export const tokens = {
  getAccess: () => access,
  setAccess: (t: string | null) => { access = t },
  getRefresh: () => localStorage.getItem('refresh'),
  setRefresh: (t: string | null) =>
    t ? localStorage.setItem('refresh', t) : localStorage.removeItem('refresh'),
}

export class ApiError extends Error {
  public status: number
  public data: unknown

  constructor(status: number, data: unknown) {
    super(`API error ${status}`)
    Object.setPrototypeOf(this, ApiError.prototype) // Сохраняет цепочку прототипов
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

let refreshing: Promise<boolean> | null = null

function refresh(): Promise<boolean> {
  const token = tokens.getRefresh()
  if (!token) return Promise.resolve(false)
  refreshing ??= fetch(`${BASE}/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: token }),
  })
    .then(async (res) => {
      if (!res.ok) return false
      const d = await res.json()
      tokens.setAccess(d.access)
      if (d.refresh) tokens.setRefresh(d.refresh)
      return true
    })
    .finally(() => { refreshing = null })
  return refreshing
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  if (access) headers.set('Authorization', `Bearer ${access}`)
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')   // для FormData браузер сам ставит boundary
  }

  const res = await fetch(BASE + path, { ...init, headers })

  if (res.status === 401 && retry && (await refresh())) {
    return api<T>(path, init, false)
  }
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null))
  return res.status === 204 ? (undefined as T) : res.json()
}

export { refresh as refreshAccess }