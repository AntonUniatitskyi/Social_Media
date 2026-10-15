export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ProfileMini {
  id: number
  uusername: string
  avatar: string | null
}

export interface Profile extends ProfileMini {
  bio: string | null
  followers_count: number
  following_count: number
  publications_count: number
  is_following: boolean
}

export interface MediaItem {
  id: number
  file: string
  is_video: boolean
}

export interface Publication {
  id: number
  profile: ProfileMini
  text: string | null
  timestamp: string
  media_items: MediaItem[]
  likes_total: number
  comments_total: number
  is_liked: boolean
  is_saved: boolean
}

export interface Comment {
  id: number
  publication: number
  author: ProfileMini
  text_com: string
  created_at: string
}

export interface Invitation {
  id: number
  from_user: { id: number; uusername: string; avatar: string | null }
  group_name: string
  chat_title: string | null
  timestamp: string
}

export interface ProfileCard extends ProfileMini {
  bio: string | null
  is_following: boolean
}

export interface AppNotification {
  id: number
  sender: ProfileMini
  kind: 'follow' | 'comment' | 'post' | 'other'
  publication: number | null
  message: string
  is_read: boolean
  created_at: string
}

export interface ChatMember { id: number; uusername: string; avatar: string | null }   // id пользователя, не профиля

export interface Chat {
  group_name: string
  title: string
  is_private: boolean
  is_admin: boolean
  admin_id: number | null
  members: ChatMember[]
  last_message_body: string | null
  last_message_at: string | null
}

export interface ChatMessage {
  id: number
  author: ChatMember
  body: string | null
  file: string | null
  filename: string | null
  is_image: boolean
  created: string
}

export interface CursorPage<T> { next: string | null; previous: string | null; results: T[] }