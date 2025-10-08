import type { ThemeConfig } from '../types'

/**
 * 合并主题配置
 */
export function mergeThemeConfig(base: ThemeConfig, override: Partial<ThemeConfig>): ThemeConfig {
  return {
    ...base,
    colors: {
      ...base.colors,
      ...override.colors,
    },
    tokens: {
      ...base.tokens,
      ...override.tokens,
    },
    custom: {
      ...base.custom,
      ...override.custom,
    },
  }
}
