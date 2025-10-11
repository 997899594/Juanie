export type ThemeMode = 'light' | 'dark'

export interface ThemeColors {
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
  border: string
  input: string
  ring: string
}

// 主题配置接口 - 用于主题元数据
export interface ThemeConfig {
  name: string
  displayName: string
  mode: ThemeMode
  group: string
  colors?: Partial<ThemeColors>
  radius?: string
  spacing?: Record<string, string>
}

export type ThemeKey = 
  | 'default' 
  | 'default-dark' 
  | 'bilibili' 
  | 'bilibili-dark' 
  | 'notion' 
  | 'notion-dark'