import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'
export type Language = 'zh-CN' | 'en-US'

export const usePreferencesStore = defineStore(
  'preferences',
  () => {
    // 主题偏好
    const theme = ref<Theme>('system')
    const isDark = ref(false)

    // 语言偏好
    const language = ref<Language>('zh-CN')

    // 通知偏好
    const notificationsEnabled = ref(true)
    const soundEnabled = ref(true)

    // 显示偏好
    const compactMode = ref(false)
    const animationsEnabled = ref(true)

    // 应用主题
    const applyTheme = () => {
      const root = document.documentElement

      if (theme.value === 'system') {
        // 使用系统偏好
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        isDark.value = prefersDark
        root.classList.toggle('dark', prefersDark)
      } else {
        isDark.value = theme.value === 'dark'
        root.classList.toggle('dark', theme.value === 'dark')
      }
    }

    // 设置主题
    const setTheme = (newTheme: Theme) => {
      theme.value = newTheme
      applyTheme()
    }

    // 切换主题
    const toggleTheme = () => {
      if (theme.value === 'system') {
        setTheme('light')
      } else if (theme.value === 'light') {
        setTheme('dark')
      } else {
        setTheme('system')
      }
    }

    // 设置语言
    const setLanguage = (newLanguage: Language) => {
      language.value = newLanguage
      // 这里可以集成 i18n
      document.documentElement.lang = newLanguage
    }

    // 监听系统主题变化
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', () => {
        if (theme.value === 'system') {
          applyTheme()
        }
      })
    }

    // 监听主题变化
    watch(theme, () => {
      applyTheme()
    })

    // 初始化主题
    applyTheme()

    return {
      // 状态
      theme,
      isDark,
      language,
      notificationsEnabled,
      soundEnabled,
      compactMode,
      animationsEnabled,

      // 方法
      setTheme,
      toggleTheme,
      setLanguage,
      applyTheme,
    }
  },
  {
    persist: {
      key: 'user-preferences',
      storage: localStorage,
      paths: [
        'theme',
        'language',
        'notificationsEnabled',
        'soundEnabled',
        'compactMode',
        'animationsEnabled',
      ],
    },
  },
)
