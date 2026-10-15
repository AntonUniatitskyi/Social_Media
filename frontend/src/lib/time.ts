const rtf = new Intl.RelativeTimeFormat('uk', { numeric: 'auto' })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000], ['month', 2_592_000], ['day', 86_400], ['hour', 3_600], ['minute', 60],
]

export function timeAgo(iso: string) {
  const sec = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, size] of UNITS) {
    if (Math.abs(sec) >= size) return rtf.format(Math.round(sec / size), unit)
  }
  return 'щойно'
}

export const fullDate = (iso: string) =>
  new Date(iso).toLocaleString('uk', { dateStyle: 'medium', timeStyle: 'short' })


const dayRtf = new Intl.RelativeTimeFormat('uk', { numeric: 'auto' })

export function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  d.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0 || diff === -1) {
    const s = dayRtf.format(diff, 'day')
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  return d.toLocaleDateString('uk', {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('uk', { hour: '2-digit', minute: '2-digit' })