export function Avatar({ src, name, className = 'size-10' }: {
  src?: string | null
  name?: string
  className?: string
}) {
  if (src) {
    return <img src={src} alt="" className={`${className} shrink-0 rounded-full bg-sand object-cover`} />
  }
  const letter = (name ?? '').replace(/[^\p{L}\p{N}]/gu, '').charAt(0).toUpperCase() || '?'
  return (
    <span aria-hidden className={`${className} grid shrink-0 place-items-center rounded-full bg-sand text-sm font-medium text-stone-700`}>
      {letter}
    </span>
  )
}