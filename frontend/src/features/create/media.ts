export const MAX_FILES = 10
export const MAX_SIZE = 50 * 1024 * 1024        // совпадает с сервером
export const ALLOWED = /\.(jpe?g|png|gif|webp|mp4|mov)$/i

export type MediaDraft = { id: number; file: File; url: string; video: boolean }

let uid = 0
export function toDraft(file: File): MediaDraft {
  return {
    id: ++uid,
    file,
    url: URL.createObjectURL(file),
    video: /\.(mp4|mov)$/i.test(file.name),
  }
}