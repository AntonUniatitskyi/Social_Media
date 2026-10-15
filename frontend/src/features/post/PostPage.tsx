import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { api, ApiError } from '../../api/client'
import type { Publication } from '../../api/types'
import { ComplaintDialog } from '../feed/ComplaintDialog'
import { PostCard } from '../feed/PostCard'
import { btnDark, btnSoft, card } from '../ui/cls'

export function PostPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [complaintId, setComplaintId] = useState<number | null>(null)

  const q = useQuery({
    queryKey: ['post', id],
    queryFn: () => api<Publication>(`/publications/${encodeURIComponent(id)}/`),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  })

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))

  return (
    <main className="mx-auto w-full max-w-[600px] space-y-4 px-3">
      <button type="button" onClick={back} className={`${btnSoft} inline-flex items-center gap-1.5`}>
        <ArrowLeft className="size-4" />Назад
      </button>

      {q.isPending && <p className="text-stone-500">Завантаження…</p>}

      {q.isError && (
        <section role="alert" className={`${card} px-6 py-12 text-center`}>
          <h1 className="text-lg font-semibold">Публікацію не знайдено</h1>
          <p className="mt-1 text-sm text-stone-600">Її могли видалити, або посилання неповне.</p>
          <Link to="/" className={`${btnDark} mt-5 inline-block`}>До стрічки</Link>
        </section>
      )}

      {q.data && (
        <PostCard
          post={q.data}
          onComplain={setComplaintId}
          onDeleted={() => navigate('/me', { replace: true })}
        />
      )}

      <ComplaintDialog publicationId={complaintId} onClose={() => setComplaintId(null)} />
    </main>
  )
}