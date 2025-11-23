import { useTheme } from '@juanie/ui'
import { TRPCClientError } from '@trpc/client'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { trpc } from '@/lib/trpc'

// 类型守卫：检查是否为 tRPC 客户端错误
function isTRPCClientError(error: unknown): error is TRPCClientError<any> {
  return error instanceof TRPCClientError
}

export type Theme = 'light' | 'dark' | 'system'
export type Language = 'zh-CN' | 'en-US'

export const usePreferencesStore = defineStore(
  'preferences',
  () => {
    // 集成 UI 主题系统
    const { themes, currentTheme, mode, setTheme, setMode, toggleMode, isDark } = useTheme()

    // 新的主题偏好
    const themeId = ref<'default' | 'github' | 'bilibili'>('default')
    const themeMode = ref<'light' | 'dark' | 'system'>('system')

    // 语言（与服务端一致）
    const language = ref<'en' | 'zh'>('zh')

    // 通知与显示偏好
    const notificationsEnabled = ref(true)
    const soundEnabled = ref(true)
    const compactMode = ref(false)
    const animationsEnabled = ref(true)

    // 初始化：从服务端拉取用户偏好并应用
    const initialize = async () => {
      try {
        const user = await trpc.users.getMe.query()
        const prefs = user.preferences

        if (prefs) {
          language.value = prefs.language
          themeMode.value = prefs.themeMode
          themeId.value = prefs.themeId as 'default' | 'github' | 'bilibili'

          notificationsEnabled.value = prefs.notifications?.email ?? true
          // 声音开关仍为本地偏好
          compactMode.value = prefs.ui?.compactMode ?? false
          animationsEnabled.value = prefs.ui?.animationsEnabled ?? true
        }

        // 应用主题到 DOM
        setTheme(themeId.value)
        // setMode 只接受 'light' | 'dark'，system 需要特殊处理
        if (themeMode.value === 'system') {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
          setMode(prefersDark ? 'dark' : 'light')
        } else {
          setMode(themeMode.value)
        }

        // 设置文档语言
        document.documentElement.lang = language.value
      } catch (err) {
        // 静默处理未登录错误（用户未登录时无法获取偏好设置）
        if (isTRPCClientError(err) && err.data?.code === 'UNAUTHORIZED') {
          // 用户未登录，使用本地默认设置
        } else {
          console.error('Failed to initialize preferences:', err)
        }
        // 即使失败，也应用当前本地默认
        setTheme(themeId.value)
        if (themeMode.value === 'system') {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
          setMode(prefersDark ? 'dark' : 'light')
        } else {
          setMode(themeMode.value)
        }
      }
    }

    // 保存偏好到服务端
    const savePreferences = async () => {
      try {
        await trpc.users.updatePreferences.mutate({
          language: language.value,
          themeId: themeId.value,
          themeMode: themeMode.value,
          notifications: {
            email: notificationsEnabled.value,
            inApp: true,
          },
          ui: {
            compactMode: compactMode.value,
            animationsEnabled: animationsEnabled.value,
          },
        })
      } catch (err) {
        console.error('Failed to save preferences:', err)
      }
    }

    // 更改主题模式
    const setThemeMode = async (newMode: 'light' | 'dark' | 'system') => {
      themeMode.value = newMode
      // setMode 只接受 'light' | 'dark'，system 需要特殊处理
      if (newMode === 'system') {
        // 根据系统偏好设置主题
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        setMode(prefersDark ? 'dark' : 'light')
      } else {
        setMode(newMode)
      }
      await savePreferences()
    }

    // 更改主题风格
    const setThemeStyle = async (newThemeId: 'default' | 'github' | 'bilibili') => {
      themeId.value = newThemeId
      setTheme(newThemeId)
      await savePreferences()
    }

    // 更改语言
    const setLanguagePref = async (newLanguage: 'en' | 'zh') => {
      language.value = newLanguage
      document.documentElement.lang = newLanguage
      await savePreferences()
    }

    return {
      // 状态
      themeId,
      themeMode,
      themes,
      currentTheme,
      mode,
      isDark,
      language,
      notificationsEnabled,
      soundEnabled,
      compactMode,
      animationsEnabled,

      // 方法
      initialize,
      savePreferences,
      setThemeMode,
      setThemeStyle,
      setLanguage: setLanguagePref,
      toggleMode,
    }
  },
  {
    persist: {
      key: 'user-preferences',
      storage: localStorage,
      // 主题不再通过 Pinia 持久化（由 UI 库控制）
      pick: [
        'language',
        'notificationsEnabled',
        'soundEnabled',
        'compactMode',
        'animationsEnabled',
      ],
    },
  },
)
