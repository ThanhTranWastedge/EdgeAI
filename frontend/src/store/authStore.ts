import { create } from 'zustand'
import { loginApi, getMeApi, User } from '../api/auth'

interface AuthState {
  user: User | null
  accessToken: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),
  loading: false,

  login: async (username, password) => {
    const { data } = await loginApi(username, password)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    set({ user: data.user, accessToken: data.access_token })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, accessToken: null })
    window.location.href = '/login'
  },

  checkAuth: async () => {
    try {
      set({ loading: true })
      const { data } = await getMeApi()
      set({ user: data, loading: false })
    } catch {
      set({ user: null, accessToken: null, loading: false })
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }
  },
}))
