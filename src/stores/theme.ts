import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  // 主题状态
  const isDark = ref(false)
  const isHighContrast = ref(false)
  const isReducedMotion = ref(false)
  
  // 从本地存储恢复主题设置
  const initTheme = () => {
    const savedTheme = localStorage.getItem('bilibili-theme')
    if (savedTheme) {
      const theme = JSON.parse(savedTheme)
      isDark.value = theme.isDark || false
      isHighContrast.value = theme.isHighContrast || false
      isReducedMotion.value = theme.isReducedMotion || false
    } else {
      // 检测系统主题偏好
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
      isReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
    
    applyTheme()
  }
  
  // 应用主题到 DOM
  const applyTheme = () => {
    const root = document.documentElement
    
    // 移除所有主题类
    root.classList.remove('theme-light', 'theme-dark', 'theme-high-contrast')
    
    // 应用主题类
    if (isHighContrast.value) {
      root.classList.add('theme-high-contrast')
    } else if (isDark.value) {
      root.classList.add('theme-dark')
    } else {
      root.classList.add('theme-light')
    }
    
    // 保存到本地存储
    localStorage.setItem('bilibili-theme', JSON.stringify({
      isDark: isDark.value,
      isHighContrast: isHighContrast.value,
      isReducedMotion: isReducedMotion.value
    }))
  }
  
  // 切换主题
  const toggleDark = () => {
    isDark.value = !isDark.value
    applyTheme()
  }
  
  const toggleHighContrast = () => {
    isHighContrast.value = !isHighContrast.value
    applyTheme()
  }
  
  const toggleReducedMotion = () => {
    isReducedMotion.value = !isReducedMotion.value
    applyTheme()
  }
  
  // 设置特定主题
  const setTheme = (theme: 'light' | 'dark' | 'auto') => {
    if (theme === 'auto') {
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    } else {
      isDark.value = theme === 'dark'
    }
    applyTheme()
  }
  
  // 计算属性
  const currentTheme = computed(() => {
    if (isHighContrast.value) return 'high-contrast'
    return isDark.value ? 'dark' : 'light'
  })
  
  const themeIcon = computed(() => {
    if (isHighContrast.value) return 'contrast'
    return isDark.value ? 'moon' : 'sun'
  })
  
  // 监听系统主题变化
  const watchSystemTheme = () => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      // 只有在用户没有手动设置主题时才跟随系统
      const savedTheme = localStorage.getItem('bilibili-theme')
      if (!savedTheme) {
        isDark.value = e.matches
        applyTheme()
      }
    })
    
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    motionQuery.addEventListener('change', (e) => {
      isReducedMotion.value = e.matches
      applyTheme()
    })
  }
  
  return {
    // 状态
    isDark,
    isHighContrast,
    isReducedMotion,
    
    // 计算属性
    currentTheme,
    themeIcon,
    
    // 方法
    initTheme,
    toggleDark,
    toggleHighContrast,
    toggleReducedMotion,
    setTheme,
    watchSystemTheme
  }
})