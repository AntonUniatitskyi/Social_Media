import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, ImagePlus, LayoutGrid, LogOut, MessageCircle, Pencil } from 'lucide-react'
import { api, ApiError } from '../../api/client'
import type { Profile } from '../../api/types'
import { useLogout } from '../auth/auth'
import { PeopleDialog, type PeopleKind } from '../feed/PeopleDialog'
import { Avatar } from '../ui/Avatar'
import { btnDark, btnSoft, card, focusRing, iconBtn } from '../ui/cls'
import { EditProfileDialog } from './EditProfileDialog'
import { PostGrid } from './PostGrid'

const btnIcon = `${btnSoft} inline-flex items-center gap-1.5`

function Stat({ value, label, onClick }: { value: number; label: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="block text-lg font-semibold leading-tight tabular-nums">{value}</span>
      <span className="text-sm text-stone-600">{label}</span>
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className={`rounded-lg px-2 py-1 transition-colors hover:bg-sand/40 ${focusRing}`}>
      {body}
    </button>
  ) : (
    <div className="px-2 py-1">{body}</div>
  )
}

function FollowButton({ profile, queryKey }: { profile: Profile; queryKey: readonly unknown[] }) {
  const qc = useQueryClient()
  const m = useMutation({
    mutationFn: () =>
      api<{ is_following: boolean; followers_count: number }>(
        `/profiles/${encodeURIComponent(profile.uusername)}/${profile.is_following ? 'unfollow' : 'follow'}/`,
        { method: 'POST' },
      ),
    onSuccess: (d) => {
      qc.setQueryData<Profile>(queryKey, (old) =>
        old && { ...old, is_following: d.is_following, followers_count: d.followers_count })
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['recommended'] })
    },
  })
  return (
    <button
      type="button"
      onClick={() => m.mutate()}
      disabled={m.isPending}
      className={profile.is_following ? btnSoft : btnDark}
    >
      {profile.is_following ? 'Відписатися' : 'Підписатися'}
    </button>
  )
}

function MessageButton({ uusername }: { uusername: string }) {
  const navigate = useNavigate()
  const m = useMutation({
    mutationFn: () =>
      api<{ group_name: string }>('/chats/direct/', { method: 'POST', body: JSON.stringify({ uusername }) }),
    onSuccess: (c) => navigate(`/chats/${c.group_name}`),
  })
  return (
    <button type="button" onClick={() => m.mutate()} disabled={m.isPending} className={btnIcon}>
      <MessageCircle className="size-4" />Написати
    </button>
  )
}

function TabButton({ active, onClick, icon, children }: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-sm font-medium transition-colors ${focusRing} ${
        active ? 'border-clay text-bark' : 'border-transparent text-stone-500 hover:text-bark'
      }`}
    >
      {icon}{children}
    </button>
  )
}

function EmptyState({ icon, title, text, action }: {
  icon: ReactNode
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className={`${card} px-6 py-12 text-center`}>
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-sand/70 text-clay">{icon}</span>
      <h2 className="mt-3 font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-xs text-sm text-stone-600">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <main aria-hidden className="mx-auto w-full max-w-[720px] space-y-5 px-3">
      <div className={`${card} flex items-center gap-6 p-6 motion-safe:animate-pulse`}>
        <div className="size-24 rounded-full bg-sand/70 sm:size-32" />
        <div className="flex-1 space-y-3">
          <div className="h-5 w-40 rounded bg-sand/70" />
          <div className="h-4 w-56 rounded bg-sand/70" />
        </div>
      </div>
    </main>
  )
}

export function ProfilePage({ uusername, isMine = false }: { uusername: string; isMine?: boolean }) {
  const queryKey = ['profile', uusername] as const
  const navigate = useNavigate()
  const logout = useLogout()
  const [tab, setTab] = useState<'posts' | 'saved'>('posts')
  const [people, setPeople] = useState<PeopleKind | null>(null)
  const [editing, setEditing] = useState(false)

  const profile = useQuery({
    queryKey,
    queryFn: () => api<Profile>(`/profiles/${encodeURIComponent(uusername)}/`),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  })

  if (profile.isPending) return <ProfileSkeleton />

  if (profile.isError) {
    const notFound = profile.error instanceof ApiError && profile.error.status === 404
    return (
      <main className="mx-auto w-full max-w-[720px] px-3">
        <section role="alert" className={`${card} px-6 py-14 text-center`}>
          <h1 className="text-xl font-semibold">{notFound ? 'Користувача не знайдено' : 'Не вдалося завантажити профіль'}</h1>
          <p className="mt-1 text-sm text-stone-600">
            {notFound ? 'Можливо, нік змінили або в посиланні помилка.' : 'Спробуйте оновити сторінку.'}
          </p>
          <Link to="/" className={`${btnDark} mt-5 inline-block`}>До стрічки</Link>
        </section>
      </main>
    )
  }

  const p = profile.data

  return (
    <main className="mx-auto w-full max-w-[720px] space-y-6 px-3">
      <section className={`${card} p-5 sm:p-7`} aria-label="Профіль">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:gap-8 sm:text-left">
          <Avatar src={p.avatar} name={p.uusername} className="size-24 shadow-sm ring-4 ring-cream sm:size-32" />

          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <h1 className="max-w-full truncate text-xl font-semibold">{p.uusername}</h1>
              <div className="flex items-center gap-2 sm:ml-auto">
                {isMine ? (
                  <>
                    <button type="button" onClick={() => setEditing(true)} className={btnIcon}>
                      <Pencil className="size-4" />Редагувати
                    </button>
                    <button
                      type="button"
                      aria-label="Вийти"
                      onClick={() => { logout(); navigate('/login', { replace: true }) }}
                      className={iconBtn}
                    >
                      <LogOut className="size-[18px]" />
                    </button>
                  </>
                ) : (
                  <>
                    <FollowButton profile={p} queryKey={queryKey} />
                    <MessageButton uusername={p.uusername} />
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-center gap-2 sm:justify-start">
              <Stat value={p.publications_count} label="публікацій" />
              <Stat value={p.followers_count} label="підписників" onClick={() => setPeople('followers')} />
              <Stat value={p.following_count} label="підписок" onClick={() => setPeople('following')} />
            </div>

            {p.bio ? (
              <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{p.bio}</p>
            ) : isMine ? (
              <button type="button" onClick={() => setEditing(true)} className="text-sm text-stone-500 hover:text-bark">
                Додайте кілька слів про себе
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section>
        {isMine ? (
          <div role="tablist" aria-label="Розділи профілю" className="mb-5 flex justify-center gap-4 border-b border-sand">
            <TabButton active={tab === 'posts'} onClick={() => setTab('posts')} icon={<LayoutGrid className="size-4" />}>
              Публікації
            </TabButton>
            <TabButton active={tab === 'saved'} onClick={() => setTab('saved')} icon={<Bookmark className="size-4" />}>
              Збережене
            </TabButton>
          </div>
        ) : (
          <h2 className="sr-only">Публікації</h2>
        )}

        <div role={isMine ? 'tabpanel' : undefined}>
          {isMine && tab === 'saved' ? (
            <PostGrid
              queryKey={['grid', 'saved']}
              path="/publications/saved/"
              empty={
                <EmptyState
                  icon={<Bookmark className="size-6" />}
                  title="Збережених публікацій поки немає"
                  text="Натисніть закладку під постом, щоб він з’явився тут."
                />
              }
            />
          ) : (
            <PostGrid
              queryKey={['grid', 'posts', p.uusername]}
              path={`/publications/?author=${encodeURIComponent(p.uusername)}`}
              empty={
                <EmptyState
                  icon={<ImagePlus className="size-6" />}
                  title={isMine ? 'Тут з’являться ваші публікації' : 'Публікацій ще немає'}
                  text={isMine ? 'Поділіться першим фото або відео.' : 'Коли користувач щось опублікує, це буде тут.'}
                  action={isMine ? <Link to="/create" className={`${btnDark} inline-block`}>Створити публікацію</Link> : undefined}
                />
              }
            />
          )}
        </div>
      </section>

      <PeopleDialog uusername={p.uusername} kind={people} onClose={() => setPeople(null)} />
      {isMine && (
        <EditProfileDialog profile={p} open={editing} onClose={() => setEditing(false)} queryKey={queryKey} />
      )}
    </main>
  )
}