// 完整的类型定义系统
// 核心类型定义
export type ThemeMode = 'light' | 'dark' | 'system'
export type ThemeSource = 'builtin' | 'imported' | 'custom' | 'external'

// 颜色系统
export interface SemanticColors {
  background: string
  foreground: string
  card: string
  'card-foreground': string
  popover: string
  'popover-foreground': string
  primary: string
  'primary-foreground': string
  secondary: string
  'secondary-foreground': string
  muted: string
  'muted-foreground': string
  accent: string
  'accent-foreground': string
  destructive: string
  'destructive-foreground': string
  success: string
  'success-foreground': string
  warning: string
  'warning-foreground': string
  info: string
  'info-foreground': string
  border: string
  input: string
  ring: string
}

// 设计令牌
export interface DesignTokens {
  radius: string
  'spacing-xs': string
  'spacing-sm': string
  'spacing-md': string
  'spacing-lg': string
  'spacing-xl': string
  'font-size-xs': string
  'font-size-sm': string
  'font-size-base': string
  'font-size-lg': string
  'font-size-xl': string
  'animation-duration-fast': string
  'animation-duration-normal': string
  'animation-duration-slow': string
}

// 主题配置
export interface ThemeConfig {
  id: string
  name: string
  description?: string
  colors: SemanticColors
  tokens: DesignTokens
  custom?: Record<string, string>
}

// 主题预设
export interface ThemePreset {
  id: string
  name: string
  description?: string
  author?: string
  version?: string
  source: ThemeSource
  createdAt?: string
  updatedAt?: string
  variants: {
    light: ThemeConfig
    dark: ThemeConfig
  }
}

// 🎯 新增：主题包格式（用于导入导出）
export interface ThemePackage {
  meta: {
    name: string
    version: string
    author: string
    description?: string
    homepage?: string
    repository?: string
    license?: string
    keywords?: string[]
    createdAt: string
    updatedAt: string
  }
  themes: ThemePreset[]
}

// 🎯 新增：外部主题源
export interface ExternalThemeSource {
  id: string
  name: string
  url: string
  description?: string
  verified?: boolean
  lastSync?: string
}
