import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

export interface User {
  id: string
  email: string
  username: string
  fullName?: string
  role: 'ADMIN' | 'DEVOPS' | 'DEVELOPER'
  avatar?: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  username: string
  email: string
  password: string
  fullName?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(localStorage.getItem('access_token'))
  const refreshToken = ref<string | null>(localStorage.getItem('refresh_token'))
  const isLoading = ref(false)

  const isAuthenticated = computed(() => !!accessToken.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')
  const isDevOps = computed(() => user.value?.role === 'DEVOPS')
  const isDeveloper = computed(() => user.value?.role === 'DEVELOPER')

  // Configure axios defaults
  const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
    timeout: 10000,
  })

  // Request interceptor to add auth token
  apiClient.interceptors.request.use((config) => {
    if (accessToken.value) {
      config.headers.Authorization = `Bearer ${accessToken.value}`
    }
    return config
  })

  // Response interceptor to handle token refresh
  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config
      
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true
        
        try {
          await refreshAccessToken()
          originalRequest.headers.Authorization = `Bearer ${accessToken.value}`
          return apiClient(originalRequest)
        } catch (refreshError) {
          await logout()
          return Promise.reject(refreshError)
        }
      }
      
      return Promise.reject(error)
    }
  )

  const setTokens = (access: string, refresh: string) => {
    accessToken.value = access
    refreshToken.value = refresh
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
  }

  const clearTokens = () => {
    accessToken.value = null
    refreshToken.value = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  const login = async (credentials: LoginCredentials) => {
    try {
      isLoading.value = true
      const response = await apiClient.post('/auth/login', credentials)
      const { access_token, refresh_token, user: userData } = response.data
      
      setTokens(access_token, refresh_token)
      user.value = userData
      
      return { success: true, user: userData }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed'
      return { success: false, error: message }
    } finally {
      isLoading.value = false
    }
  }

  const register = async (credentials: RegisterCredentials) => {
    try {
      isLoading.value = true
      const response = await apiClient.post('/auth/register', credentials)
      const { access_token, refresh_token, user: userData } = response.data
      
      setTokens(access_token, refresh_token)
      user.value = userData
      
      return { success: true, user: userData }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed'
      return { success: false, error: message }
    } finally {
      isLoading.value = false
    }
  }

  const refreshAccessToken = async () => {
    if (!refreshToken.value) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await apiClient.post('/auth/refresh', {
        refresh_token: refreshToken.value
      })
      const { access_token, user: userData } = response.data
      
      accessToken.value = access_token
      localStorage.setItem('access_token', access_token)
      user.value = userData
      
      return access_token
    } catch (error) {
      clearTokens()
      user.value = null
      throw error
    }
  }

  const logout = async () => {
    try {
      if (accessToken.value) {
        await apiClient.post('/auth/logout')
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearTokens()
      user.value = null
    }
  }

  const getCurrentUser = async () => {
    if (!accessToken.value) return null

    try {
      const response = await apiClient.get('/users/profile')
      user.value = response.data
      return response.data
    } catch (error) {
      console.error('Get current user error:', error)
      await logout()
      return null
    }
  }

  const updateProfile = async (profileData: Partial<User>) => {
    try {
      const response = await apiClient.patch('/users/profile', profileData)
      user.value = response.data
      return { success: true, user: response.data }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Profile update failed'
      return { success: false, error: message }
    }
  }

  // Initialize auth state on app start
  const initializeAuth = async () => {
    if (accessToken.value) {
      try {
        await getCurrentUser()
      } catch (error) {
        console.error('Auth initialization error:', error)
        clearTokens()
      }
    }
  }

  return {
    // State
    user,
    accessToken,
    refreshToken,
    isLoading,
    
    // Computed
    isAuthenticated,
    isAdmin,
    isDevOps,
    isDeveloper,
    
    // Actions
    login,
    register,
    logout,
    refreshAccessToken,
    getCurrentUser,
    updateProfile,
    initializeAuth,
    
    // API client
    apiClient,
  }
})