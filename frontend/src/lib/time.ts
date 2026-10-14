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