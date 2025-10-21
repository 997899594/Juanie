// 简化的主题类型定义
export type ThemeMode = 'light' | 'dark'

// 主题定义 - 只保留核心属性
export interface Theme {
  id: string           // 唯一标识，如 'default', 'github'
  name: string         // 显示名称，如 '默认主题', 'GitHub'
  modes: ThemeMode[]   // 支持的模式
}

// 主题状态
export interface ThemeState {
  current: string      // 当前主题ID
  mode: ThemeMode      // 当前模式
}

// 预定义主题
export const THEMES: Theme[] = [
  { id: 'default', name: '默认主题', modes: ['light', 'dark'] },
  { id: 'github', name: 'GitHub', modes: ['light', 'dark'] },
  { id: 'bilibili', name: 'B站', modes: ['light', 'dark'] },
]

// 默认主题状态
export const DEFAULT_THEME_STATE: ThemeState = {
  current: 'default',
  mode: 'light'
}