import { create } from 'zustand'
import { loginApi, getMeApi, updateDefaultIntegrationApi, User } from '../api/auth'
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from '../api/client'

interface AuthState {
  user: User | null
  accessToken: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  setDefaultIntegration: (integrationId: string | null) => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem(TOKEN_KEY),
  loading: false,

  login: async (username, password) => {
    const { data } = await loginApi(username, password)
    localStorage.setItem(TOKEN_KEY, data.access_token)
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
    set({ user: data.user, accessToken: data.access_token })
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    set({ user: null, accessToken: null })
    window.location.href = '/login'
  },

  checkAuth: async () => {
    if (get().user) return
    try {
      set({ loading: true })
      const { data } = await getMeApi()
      set({ user: data, loading: false })
    } catch {
      set({ user: null, accessToken: null, loading: false })
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
    }
  },

  setDefaultIntegration: async (integrationId) => {
    const { data } = await updateDefaultIntegrationApi(integrationId)
    set({ user: data })
  },
}))
