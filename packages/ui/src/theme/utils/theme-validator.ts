import type { DesignTokens, SemanticColors, ThemeConfig, ThemePackage, ThemePreset } from '../types'

/**
 * 验证主题包格式
 */
export function validateThemePackage(pkg: any): pkg is ThemePackage {
  if (!pkg || typeof pkg !== 'object') return false

  // 验证 meta 信息
  if (!pkg.meta || typeof pkg.meta !== 'object') return false
  if (!pkg.meta.name || !pkg.meta.version || !pkg.meta.author) return false

  // 验证 themes 数组
  if (!Array.isArray(pkg.themes) || pkg.themes.length === 0) return false

  // 验证每个主题
  return pkg.themes.every(validateThemePreset)
}

/**
 * 验证主题预设
 */
export function validateThemePreset(theme: any): theme is ThemePreset {
  if (!theme || typeof theme !== 'object') return false

  // 基础字段验证
  if (!theme.id || !theme.name || !theme.variants) return false

  // 验证变体
  if (!theme.variants.light || !theme.variants.dark) return false

  return validateThemeConfig(theme.variants.light) && validateThemeConfig(theme.variants.dark)
}

/**
 * 验证主题配置
 */
export function validateThemeConfig(config: any): config is ThemeConfig {
  if (!config || typeof config !== 'object') return false

  // 验证必需字段
  if (!config.id || !config.name || !config.colors || !config.tokens) return false

  return validateSemanticColors(config.colors) && validateDesignTokens(config.tokens)
}

/**
 * 验证语义化颜色
 */
export function validateSemanticColors(colors: any): colors is SemanticColors {
  const requiredColors = [
    'background',
    'foreground',
    'primary',
    'secondary',
    'muted',
    'accent',
    'destructive',
    'border',
    'input',
    'ring',
  ]

  return requiredColors.every(
    (color) => typeof colors[color] === 'string' && colors[color].length > 0,
  )
}

/**
 * 验证设计令牌
 */
export function validateDesignTokens(tokens: any): tokens is DesignTokens {
  const requiredTokens = [
    'radius',
    'spacing-xs',
    'spacing-sm',
    'spacing-md',
    'spacing-lg',
    'spacing-xl',
    'font-size-base',
  ]

  return requiredTokens.every(
    (token) => typeof tokens[token] === 'string' && tokens[token].length > 0,
  )
}
