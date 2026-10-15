import { useEffect, useRef } from 'react'

export function useSentinel(load: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) loadRef.current() },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [enabled])

  return ref
}