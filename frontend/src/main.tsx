import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { Login } from './features/auth/Login'
import { Register } from './features/auth/Register'
import { RequireAuth } from './features/auth/RequireAuth'
import { AppShell } from './features/shell/AppShell'
import { Feed } from './features/feed/Feed'
import { CreatePost } from "./features/create/CreatePost.tsx";
import { MyProfileRoute } from './features/profile/routes.tsx'
import { ProfileRoute } from './features/profile/routes.tsx'
import { PostPage } from './features/post/PostPage.tsx'
import { SearchPage } from './features/search/SearchPage.tsx'
import { NotificationsPage } from './features/notifications/NotificationsPage.tsx'
import { ChatsLayout } from './features/chats/ChatsLayout.tsx'
import { ChatPlaceholder } from './features/chats/ChatsLayout.tsx'
import { ChatRoomRoute } from './features/chats/ChatRoom.tsx'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Feed />} />
              <Route path="/create" element={<CreatePost />} />
              <Route path="/me" element={<MyProfileRoute />} />
              <Route path="/u/:uusername" element={<ProfileRoute />} />
              <Route path="/p/:id" element={<PostPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />

              <Route path="/chats" element={<ChatsLayout />}>
                <Route index element={<ChatPlaceholder />} />
                <Route path=":groupName" element={<ChatRoomRoute />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)