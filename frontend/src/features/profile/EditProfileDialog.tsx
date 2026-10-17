import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera } from 'lucide-react'
import { api } from '../../api/client'
import type { Profile } from '../../api/types'
import { fieldErrors } from '../auth/auth'
import { Avatar } from '../ui/Avatar'
import { btnDark, btnSoft, focusRing } from '../ui/cls'
import { Dialog } from '../ui/Dialog'

const MAX_BIO = 300
const MAX_AVATAR = 5 * 1024 * 1024
const HANDLE_RE = /^[a-z0-9._]{3,30}$/
const NAME_RE = /^[\p{L}\p{N}_.@+-]{3,30}$/u

const input =
  'w-full rounded-xl border bg-white/70 px-3.5 py-2.5 outline-none transition focus:border-clay focus:ring-[3px] focus:ring-clay/20'

export function EditProfileDialog({ profile, open, onClose, queryKey }: {
  profile: Profile
  open: boolean
  onClose: () => void
  queryKey: readonly unknown[]
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Редагувати профіль">
      <EditForm profile={profile} onClose={onClose} queryKey={queryKey} />
    </Dialog>
  )
}

function Field({ id, label, hint, error, children }: {
  id: string
  label: string
  hint: string
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-sm text-red-800">{error}</p>
      ) : (
        <p className="mt-1.5 text-xs text-stone-600">{hint}</p>
      )}
    </div>
  )
}

function EditForm({ profile, onClose, queryKey }: {
  profile: Profile
  onClose: () => void
  queryKey: readonly unknown[]
}) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(profile.username)
  const [handle, setHandle] = useState(profile.uusername)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const preview = useMemo(() => (avatar ? URL.createObjectURL(avatar) : null), [avatar])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const cleanName = name.trim()
  const cleanHandle = handle.trim()
  const nameChanged = cleanName !== profile.username
  const handleChanged = cleanHandle !== profile.uusername
  const bioChanged = bio !== (profile.bio ?? '')
  const nameInvalid = nameChanged && !NAME_RE.test(cleanName)
  const handleInvalid = handleChanged && !HANDLE_RE.test(cleanHandle)
  const dirty = nameChanged || handleChanged || bioChanged || avatar !== null

  const m = useMutation({
    mutationFn: () => {
      const fd = new FormData()                              // PATCH: только изменённое
      if (nameChanged) fd.append('username', cleanName)
      if (handleChanged) fd.append('uusername', cleanHandle)
      if (bioChanged) fd.append('bio', bio)
      if (avatar) fd.append('avatar', avatar)
      return api<Profile>(`/profiles/${encodeURIComponent(profile.uusername)}/`, { method: 'PATCH', body: fd })
    },
    onSuccess: (saved) => {
      qc.setQueryData(queryKey, saved)
      qc.invalidateQueries()          // имя и нік попадают в посты, чаты, комментарии, ссылки: обновляем всё
      onClose()
    },
  })

  function pickFile(f: File | undefined) {
    if (!f) return
    if (!f.type.startsWith('image/')) return setFileError('Оберіть зображення.')
    if (f.size > MAX_AVATAR) return setFileError('Аватар завеликий: максимум 5 МБ.')
    setFileError(null)
    setAvatar(f)
  }

  const errs = fieldErrors(m.error)
  const general = m.isError && Object.keys(errs).length === 0 ? 'Не вдалося зберегти. Спробуйте ще раз.' : null
  const nameError = nameInvalid ? '3–30 символів: літери, цифри та . _ @ + -' : (errs.username ?? null)
  const handleError = handleInvalid ? '3–30 символів: малі латинські літери, цифри, крапка та підкреслення.' : (errs.uusername ?? null)

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (dirty && !nameInvalid && !handleInvalid && !m.isPending) m.mutate() }}
      className="space-y-5"
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Змінити фото профілю"
          className={`group relative rounded-full ${focusRing}`}
        >
          <Avatar src={preview ?? profile.avatar} name={profile.username} className="size-20" />
          <span className="absolute inset-0 grid place-items-center rounded-full bg-bark/45 text-cream opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Camera className="size-6" />
          </span>
        </button>
        <div className="text-sm">
          <button type="button" onClick={() => fileRef.current?.click()} className="font-semibold text-clay hover:text-bark hover:underline">
            Обрати фото
          </button>
          <p className="text-stone-600">JPG, PNG або WebP, до 5 МБ.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }}
        />
      </div>
      {(fileError || errs.avatar) && <p role="alert" className="-mt-2 text-sm text-red-800">{fileError ?? errs.avatar}</p>}

      <Field id="name" label="Ім’я" error={nameError} hint="Так вас бачать у публікаціях і чатах. Це також ваш логін для входу.">
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          aria-invalid={!!nameError}
          className={`${input} ${nameError ? 'border-red-400' : 'border-sand'}`}
        />
      </Field>

      <Field id="handle" label="Нік" error={handleError} hint={`Ваша адреса в профілі: /u/${cleanHandle || '…'}`}>
        <input
          id="handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value.toLowerCase())}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={!!handleError}
          className={`${input} ${handleError ? 'border-red-400' : 'border-sand'}`}
        />
      </Field>

      <div>
        <label htmlFor="bio" className="mb-1.5 block text-sm font-medium">Про себе</label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={MAX_BIO}
          rows={3}
          className={`${input} resize-none border-sand`}
        />
        <p className="mt-1 text-right text-xs tabular-nums text-stone-500">{bio.length} / {MAX_BIO}</p>
        {errs.bio && <p role="alert" className="text-sm text-red-800">{errs.bio}</p>}
      </div>

      {general && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{general}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={btnSoft}>Скасувати</button>
        <button type="submit" disabled={!dirty || nameInvalid || handleInvalid || m.isPending} className={btnDark}>
          {m.isPending ? 'Зберігаємо…' : 'Зберегти'}
        </button>
      </div>
    </form>
  )
}