import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Check, Flag, MessageCircle, PawPrint, Share2, Trash2 } from 'lucide-react'
import { api } from '../../api/client'
import type { Publication } from '../../api/types'
import { fullDate, timeAgo } from '../../lib/time'
import { useMe } from '../auth/auth'
import { Avatar } from '../ui/Avatar'
import { btnSoft, card, focusRing, iconBtn } from '../ui/cls'
import { Dialog } from '../ui/Dialog'
import { Comments } from './Comments'
import { MediaCarousel } from './MediaCarousel'

const action = `inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-stone-600 transition-colors hover:bg-sand/40 hover:text-bark ${focusRing}`

export function PostCard({ post, onComplain, onDeleted }: {
  post: Publication
  onComplain: (id: number) => void
  onDeleted?: () => void
}) {
  const qc = useQueryClient()
  const me = useMe().data
  const isMine = me?.id === post.profile.id
  const profileLink = `/u/${post.profile.uusername}`

  const [liked, setLiked] = useState(post.is_liked)
  const [likes, setLikes] = useState(post.likes_total)
  const [saved, setSaved] = useState(post.is_saved)
  const [commentsTotal, setCommentsTotal] = useState(post.comments_total)
  const [showComments, setShowComments] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const like = useMutation({
    mutationFn: () =>
      api<{ liked: boolean; likes_total: number }>(`/publications/${post.id}/like/`, { method: 'POST' }),
    onMutate: () => {
      setLiked(!liked)
      setLikes(likes + (liked ? -1 : 1))
      return { liked, likes }
    },
    onError: (_e, _v, prev) => {
      if (prev) { setLiked(prev.liked); setLikes(prev.likes) }
    },
    onSuccess: (d) => { setLiked(d.liked); setLikes(d.likes_total) },
  })

  const save = useMutation({
    mutationFn: () => api<{ saved: boolean }>(`/publications/${post.id}/save/`, { method: 'POST' }),
    onMutate: () => { setSaved(!saved); return { saved } },
    onError: (_e, _v, prev) => { if (prev) setSaved(prev.saved) },
    onSuccess: (d) => setSaved(d.saved),
  })

  const del = useMutation({
    mutationFn: () => api<void>(`/publications/${post.id}/`, { method: 'DELETE' }),
    onSuccess: () => {
      setConfirmDelete(false)
      qc.invalidateQueries({ queryKey: ['grid'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['profile'] })   // счётчик публикаций на странице профиля
      onDeleted?.()
    },
  })

  const toggleLike = () => { if (!like.isPending) like.mutate() }
  const likeOnce = () => { if (!liked && !like.isPending) like.mutate() } // двойной тап никогда не снимает лайк

  async function share() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/p/${post.id}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* буфер недоступен */ }
  }

  const long = (post.text?.length ?? 0) > 160

  return (
    <article className={`${card} pb-3`}>
      <header className="flex items-center gap-3 px-4 pb-3 pt-3.5">
        <Link to={profileLink} aria-hidden tabIndex={-1} className="shrink-0">
          <Avatar src={post.profile.avatar} name={post.profile.uusername} className="size-10" />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link to={profileLink} className="block truncate font-semibold hover:underline">
            {post.profile.uusername}
          </Link>
          <time dateTime={post.timestamp} title={fullDate(post.timestamp)} className="text-xs text-stone-500">
            {timeAgo(post.timestamp)}
          </time>
        </div>
        {isMine ? (
          <button type="button" onClick={() => setConfirmDelete(true)} aria-label="Видалити публікацію" className={iconBtn}>
            <Trash2 className="size-[18px]" />
          </button>
        ) : (
          <button type="button" onClick={() => onComplain(post.id)} aria-label="Поскаржитися на публікацію" className={iconBtn}>
            <Flag className="size-[18px]" />
          </button>
        )}
      </header>

      {post.media_items.length > 0 && (
        <div className="px-3">
          <MediaCarousel items={post.media_items} onDoubleTap={likeOnce} />
        </div>
      )}

      <div className="flex items-center gap-0.5 px-2 pt-1.5">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label={liked ? 'Прибрати вподобання' : 'Вподобати'}
          className={`${action} ${liked ? 'text-red-600 hover:text-red-700' : ''}`}
        >
          <PawPrint
            className={`size-[22px] ${liked ? 'motion-safe:animate-paw-bounce' : ''}`}
            fill={liked ? 'currentColor' : 'none'}
          />
          {likes > 0 && <span className="text-sm tabular-nums">{likes}</span>}
        </button>

        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          aria-label="Коментарі"
          className={action}
        >
          <MessageCircle className="size-[22px]" />
          {commentsTotal > 0 && <span className="text-sm tabular-nums">{commentsTotal}</span>}
        </button>

        <button type="button" onClick={share} aria-label="Скопіювати посилання" className={action}>
          {copied ? <Check className="size-[22px]" /> : <Share2 className="size-[22px]" />}
          <span aria-live="polite" className="text-sm">{copied ? 'Скопійовано' : ''}</span>
        </button>

        <button
          type="button"
          onClick={() => save.mutate()}
          aria-pressed={saved}
          aria-label={saved ? 'Прибрати зі збережених' : 'Зберегти'}
          className={`${action} ml-auto`}
        >
          <Bookmark className="size-[22px]" fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {post.text && (
        <div className="px-4 pt-1">
          <p className={`whitespace-pre-line break-words text-[15px] leading-relaxed ${long && !expanded ? 'line-clamp-3' : ''}`}>
            {post.text}
          </p>
          {long && !expanded && (
            <button type="button" onClick={() => setExpanded(true)} className="text-sm text-stone-500 hover:text-bark">
              ще
            </button>
          )}
        </div>
      )}

      {showComments && (
        <Comments publicationId={post.id} onCountChange={(d) => setCommentsTotal((t) => t + d)} />
      )}

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Видалити публікацію?">
        <p className="text-sm text-stone-600">Публікацію, фото та коментарі буде видалено назавжди.</p>
        {del.isError && (
          <p role="alert" className="mt-3 text-sm text-red-800">Не вдалося видалити. Спробуйте ще раз.</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirmDelete(false)} className={btnSoft}>Скасувати</button>
          <button
            type="button"
            onClick={() => del.mutate()}
            disabled={del.isPending}
            className={`rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-800 disabled:opacity-60 ${focusRing}`}
          >
            {del.isPending ? 'Видаляємо…' : 'Видалити'}
          </button>
        </div>
      </Dialog>
    </article>
  )
}