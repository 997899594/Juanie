import { reactive, watch } from 'vue'
import type { Theme, ThemeMode, ThemeState } from './types'
import { DEFAULT_THEME_STATE, THEMES } from './types'

// 存储键
const STORAGE_KEY = 'theme-state'

// 应用主题到DOM
function applyThemeToDOM(state: ThemeState) {
  const root = document.documentElement

  // 设置主题属性（用于CSS选择器 [data-theme="xxx"]）
  root.setAttribute('data-theme', state.current)

  // 应用模式类（用于CSS选择器 .dark）
  if (state.mode === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

// 保存主题状态
function saveThemeState(state: ThemeState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// 加载主题状态
function loadThemeState(): ThemeState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const state = JSON.parse(saved) as ThemeState
      // 验证主题是否存在
      const theme = THEMES.find((t) => t.id === state.current)
      if (theme?.modes.includes(state.mode)) {
        return state
      }
    }
  } catch (error) {
    console.warn('Failed to load theme state:', error)
  }

  return { ...DEFAULT_THEME_STATE }
}

// 响应式主题状态
export const themeState = reactive<ThemeState>(loadThemeState())

// 监听状态变化，自动应用主题和保存状态
watch(
  themeState,
  (newState) => {
    applyThemeToDOM(newState)
    saveThemeState(newState)
  },
  { immediate: true },
)

// 主题管理函数
export function getThemes(): Theme[] {
  return [...THEMES]
}

export function getCurrentTheme(): Theme | null {
  return THEMES.find((t) => t.id === themeState.current) || null
}

export function setTheme(themeId: string): boolean {
  const theme = THEMES.find((t) => t.id === themeId)
  if (!theme) return false

  // 如果新主题不支持当前模式，使用第一个可用模式
  const mode: ThemeMode = theme.modes.includes(themeState.mode)
    ? themeState.mode
    : (theme.modes[0] as ThemeMode)

  themeState.current = themeId
  themeState.mode = mode
  return true
}

export function setMode(mode: ThemeMode): boolean {
  const theme = getCurrentTheme()
  if (!theme || !theme.modes.includes(mode)) return false

  themeState.mode = mode
  return true
}

export function toggleMode(): ThemeMode {
  const newMode = themeState.mode === 'light' ? 'dark' : 'light'
  setMode(newMode)
  return themeState.mode
}
