import { bilibiliTheme } from '../presets/bilibili'
import { defaultTheme } from '../presets/default'
import { notionTheme } from '../presets/notion'
import type { ThemePreset } from '../types'

// 注册的主题
const registeredThemes = new Map<string, ThemePreset>()

// 🎯 内置主题列表
const BUILTIN_THEMES = ['default', 'bilibili', 'notion']

// 🎯 确保主题正确注册
export function registerAllThemes() {
  registeredThemes.set('default', defaultTheme)
  registeredThemes.set('bilibili', bilibiliTheme)
  registeredThemes.set('notion', notionTheme)

  console.log('Registered themes:', Array.from(registeredThemes.keys()))
}

/**
 * 注册主题
 */
export function registerTheme(theme: ThemePreset) {
  registeredThemes.set(theme.id, theme)
}

/**
 * 获取所有注册的主题
 */
export function getRegisteredThemes(): ThemePreset[] {
  return Array.from(registeredThemes.values())
}

/**
 * 加载主题预设
 */
export function loadThemePreset(themeId: string): ThemePreset | null {
  const theme = registeredThemes.get(themeId)
  if (!theme) {
    console.warn(
      `Theme "${themeId}" not found. Available themes:`,
      Array.from(registeredThemes.keys()),
    )
  }
  return theme || null
}

/**
 * 🎯 判断是否为内置主题
 */
export function isBuiltinTheme(themeId: string): boolean {
  return BUILTIN_THEMES.includes(themeId)
}

// 🎯 立即注册所有主题
registerAllThemes()
