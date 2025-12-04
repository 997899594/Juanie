import { computed } from 'vue'
import {
  setMode as _setMode,
  setTheme as _setTheme,
  toggleMode as _toggleMode,
  getCurrentTheme,
  getThemes,
  themeState,
} from './core'
import type { ThemeMode } from './types'

export function useTheme() {
  // 计算属性
  const themes = computed(() => getThemes())
  const currentTheme = computed(() => getCurrentTheme())
  const isDark = computed(() => themeState.mode === 'dark')
  const mode = computed(() => themeState.mode)
  const themeId = computed(() => themeState.current)

  // 方法
  const setTheme = (themeId: string) => _setTheme(themeId)
  const setMode = (mode: ThemeMode) => _setMode(mode)
  const toggleMode = () => _toggleMode()

  return {
    // 状态 - 只读
    themes,
    currentTheme,
    isDark,
    mode,
    themeId,

    // 方法
    setTheme,
    setMode,
    toggleMode,
  }
}
