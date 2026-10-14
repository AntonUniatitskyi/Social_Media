import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, PawPrint } from 'lucide-react'
import type { MediaItem } from '../../api/types'

const arrow =
  'absolute top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-stone-800 shadow opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-clay sm:grid'

export function MediaCarousel({ items, onDoubleTap }: { items: MediaItem[]; onDoubleTap: () => void }) {
  const track = useRef<HTMLDivElement>(null)
  const lastTap = useRef(0)
  const [index, setIndex] = useState(0)
  const [burst, setBurst] = useState(0)

  function onScroll() {
    const el = track.current
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  function go(dir: -1 | 1) {
    const el = track.current
    el?.scrollTo({ left: (index + dir) * el.clientWidth, behavior: 'smooth' })
  }

  function tap(e: React.PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const now = Date.now()
    if (now - lastTap.current < 300) {
      lastTap.current = 0
      setBurst((b) => b + 1)
      onDoubleTap()
    } else {
      lastTap.current = now
    }
  }

  return (
    <div
      role="group"
      aria-roledescription="карусель"
      className="group relative overflow-hidden rounded-xl bg-sand/40"
    >
      <div
        ref={track}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((m, i) => (
          <div
            key={m.id}
            role="group"
            aria-roledescription="слайд"
            aria-label={`${i + 1} з ${items.length}`}
            className="aspect-[4/3] w-full shrink-0 snap-center"
          >
            {m.is_video ? (
              <video src={m.file} controls preload="metadata" className="size-full bg-stone-900 object-contain" />
            ) : (
              <img
                src={m.file}
                alt=""
                loading="lazy"
                draggable={false}
                onPointerUp={tap}
                className="size-full touch-manipulation select-none object-cover"
              />
            )}
          </div>
        ))}
      </div>

      {burst > 0 && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <PawPrint key={burst} className="size-24 fill-white text-white drop-shadow-lg motion-safe:animate-paw-pop" />
        </div>
      )}

      {items.length > 1 && (
        <>
          {index > 0 && (
            <button type="button" onClick={() => go(-1)} aria-label="Попереднє фото" className={`${arrow} left-2`}>
              <ChevronLeft className="size-5" />
            </button>
          )}
          {index < items.length - 1 && (
            <button type="button" onClick={() => go(1)} aria-label="Наступне фото" className={`${arrow} right-2`}>
              <ChevronRight className="size-5" />
            </button>
          )}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
            {items.map((m, i) => (
              <span
                key={m.id}
                className={`size-1.5 rounded-full shadow-sm transition-colors ${i === index ? 'bg-white' : 'bg-white/50'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}