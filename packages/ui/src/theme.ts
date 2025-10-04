import type { GlobalTheme, GlobalThemeOverrides } from 'naive-ui'
import { darkTheme, useOsTheme } from 'naive-ui'
import { computed } from 'vue'
import { bilibiliTheme } from './themes/bilibili'

/**
 * 主题配置 - 基于设计令牌的统一主题系统
 */
export const themeConfig = bilibiliTheme

/**
 * 暗色主题配置
 * TODO: 后续可以基于设计令牌创建暗色版本
 */
export const darkThemeConfig = bilibiliTheme

/**
 * 主题覆盖类型
 */
export type ThemeOverrides = GlobalThemeOverrides

/**
 * 主题 Hook - 提供主题切换功能
 */
export function useTheme() {
  const osThemeRef = useOsTheme()

  // 当前主题
  const theme = computed(() => {
    return osThemeRef.value === 'dark' ? darkTheme : null
  })

  // 主题覆盖配置
  const themeOverrides = computed(() => {
    return osThemeRef.value === 'dark' ? darkThemeConfig : themeConfig
  })

  return {
    theme,
    themeConfig: themeOverrides,
    isDark: computed(() => osThemeRef.value === 'dark'),
    osTheme: osThemeRef,
  }
}
