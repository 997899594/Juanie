import type { ThemeConfig, ThemePreset } from '../types'

/**
 * 生成 CSS 变量
 */
export function generateCSSVariables(config: ThemeConfig): Record<string, string> {
  const variables: Record<string, string> = {}

  // 颜色变量
  for (const [key, value] of Object.entries(config.colors)) {
    variables[`--${key}`] = value
  }

  // 设计令牌变量
  for (const [key, value] of Object.entries(config.tokens)) {
    variables[`--${key}`] = value
  }

  // 自定义变量
  if (config.custom) {
    for (const [key, value] of Object.entries(config.custom)) {
      variables[`--${key}`] = String(value)
    }
  }

  return variables
}

/**
 * 生成优化的 CSS（构建时使用）
 */
export function generateOptimizedCSS(presets: ThemePreset[]): string {
  let css = ''

  for (const preset of presets) {
    const lightConfig = preset.variants.light
    const darkConfig = preset.variants.dark

    // 生成浅色模式 CSS
    const lightVariables = generateCSSVariables(lightConfig)
    css += `[data-theme="${preset.id}"] {\n`
    for (const [key, value] of Object.entries(lightVariables)) {
      css += `  ${key}: ${value};\n`
    }
    css += '}\n\n'

    // 生成深色模式 CSS
    const darkVariables = generateCSSVariables(darkConfig)
    css += `[data-theme="${preset.id}"].dark {\n`
    for (const [key, value] of Object.entries(darkVariables)) {
      css += `  ${key}: ${value};\n`
    }
    css += '}\n\n'
  }

  return css
}
